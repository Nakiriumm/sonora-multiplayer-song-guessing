import { DurableObject } from 'cloudflare:workers';

const CODE_ALPHABET = '0123456789';
const DEFAULT_ROUND_SECONDS = 30;
const BREAK_SECONDS = 5;
const ROUND_COUNT = 10;
const STAGES = [0.1, 0.5, 2, 8, 15];
const STAGE_STARTS = [0, ...STAGES.slice(0, -1)];
const ROUND_POINTS = [100, 80, 60, 35, 20];
const bombTurnSeconds = (room) => [30, 45, 60].includes(Number(room.durationSeconds))
  ? Number(room.durationSeconds)
  : DEFAULT_ROUND_SECONDS;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function validName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 20;
}

function cleanBombSong(song) {
  if (!song?.title || !song?.artist || !song?.previewUrl) return null;
  const previewUrl = String(song.previewUrl).slice(0, 2000);
  try { if (!new URL(previewUrl).hostname.endsWith('.itunes.apple.com')) return null; } catch { return null; }
  const artwork = String(song.artwork || '').slice(0, 1000);
  try { if (artwork && !new URL(artwork).hostname.endsWith('.mzstatic.com')) return null; } catch { return null; }
  return { title: String(song.title).slice(0, 160), artist: String(song.artist).slice(0, 160), artwork, previewUrl };
}

function normalizeGuess(value) {
  // Keep combining marks: NFKD + stripping diacritics turns voiced kana such
  // as が into か, making Japanese catalog entries impossible to find.
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
}

function roomEventType(room) {
  if (room.phase === 'lobby') return 'lobby';
  if (room.phase === 'bomb') return 'bomb';
  if (room.phase === 'game') return 'game';
  if (room.phase === 'break') return 'round-ended';
  return 'game-ended';
}

function cleanRound(round) {
  if (!round || !Array.isArray(round.choices) || round.choices.length < 4 || round.choices.length > 8) return null;
  if (!Number.isInteger(round.answerIndex) || round.answerIndex < 0 || round.answerIndex >= round.choices.length) return null;
  const safeArtwork = (value) => {
    const candidate = String(value || '');
    try { return new URL(candidate).hostname.endsWith('.mzstatic.com') ? candidate.slice(0, 1000) : ''; } catch { return ''; }
  };
  const choices = round.choices.map((choice) => ({
    title: String(choice?.title || '').slice(0, 160),
    subtitle: String(choice?.subtitle || '').slice(0, 220),
    artwork: safeArtwork(choice?.artwork),
    anime: String(choice?.anime || '').slice(0, 120),
  }));
  const answer = round.answer;
  if (!answer || !choices[round.answerIndex].title || !answer.title || !answer.artist || !answer.previewUrl) return null;
  if (choices[round.answerIndex].title !== answer.title) return null;
  try {
    const previewHost = new URL(answer.previewUrl).hostname;
    if (!previewHost.endsWith('.itunes.apple.com')) return null;
  } catch { return null; }
  return {
    choices,
    answerIndex: round.answerIndex,
    difficulty: ['easy', 'medium', 'hard', 'extreme'].includes(round.difficulty) ? round.difficulty : 'medium',
    genre: String(round.genre || 'Everything').slice(0, 60),
    answer: {
      title: String(answer.title).slice(0, 160),
      artist: String(answer.artist).slice(0, 160),
      artwork: safeArtwork(answer.artwork),
      previewUrl: String(answer.previewUrl).slice(0, 2000),
    },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Send valid JSON.' }, 400); }
      if (!validName(body.name)) return json({ error: 'Enter a name up to 20 characters.' }, 400);
      const code = randomCode();
      const id = env.GAME_ROOMS.idFromName(code);
      const stub = env.GAME_ROOMS.get(id);
      return stub.fetch('https://room.internal/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, name: body.name.trim(), mode: body.mode, maxPlayers: body.maxPlayers, genre: body.genre, difficulty: body.difficulty, choiceCount: body.choiceCount, roundCount: body.roundCount, durationSeconds: body.durationSeconds }),
      });
    }

    const joinMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6,7})\/join$/i);
    if (joinMatch && request.method === 'POST') {
      const code = joinMatch[1].toUpperCase();
      const stub = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(code));
      return stub.fetch('https://room.internal/join', { method: 'POST', body: request.body, headers: request.headers });
    }

    const socketMatch = url.pathname.match(/^\/ws\/([A-Z0-9]{6,7})$/i);
    if (socketMatch) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'A WebSocket connection is required.' }, 426);
      const code = socketMatch[1].toUpperCase();
      const stub = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(code));
      return stub.fetch(new Request(`https://room.internal/ws${url.search}`, request));
    }

    return env.ASSETS.fetch(request);
  },
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.state = null;
    this.eventQueue = Promise.resolve();
  }

  enqueue(callback) {
    const result = this.eventQueue.then(callback, callback);
    this.eventQueue = result.catch(() => {});
    return result;
  }

  async load() {
    if (!this.state) this.state = await this.ctx.storage.get('room');
    return this.state;
  }

  async save() {
    await this.ctx.storage.put('room', this.state);
  }

  publicRoom() {
    const room = this.state;
    return {
      code: room.code,
      hostId: room.hostId,
      mode: room.mode === 'SongBomb' ? 'SongBomb' : 'Quickfire',
      winner: room.winner || null,
      maxPlayers: room.maxPlayers,
      genre: room.genre,
      difficulty: ['easy', 'medium', 'hard', 'extreme'].includes(room.difficulty) ? room.difficulty : 'medium',
      choiceCount: Math.max(4, Math.min(8, Number(room.choiceCount) || 4)),
      roundCount: Math.max(1, Math.min(50, Math.round(Number(room.roundCount) || ROUND_COUNT))),
      durationSeconds: room.durationSeconds || DEFAULT_ROUND_SECONDS,
      phase: room.phase,
      players: room.players.map(({ id, name, score, connected, status, continueReady, lives, eliminated }) => ({ id, name, score, connected, status, continueReady, lives: Number.isInteger(lives) ? lives : 3, eliminated: Boolean(eliminated) })),
      roundNumber: room.roundIndex >= 0 ? room.roundIndex + 1 : 0,
      stage: room.stage,
      roundStartedAt: room.roundStartedAt,
      roundEndsAt: room.roundEndsAt,
      breakEndsAt: room.breakEndsAt,
      playback: room.playback,
      bombLog: (room.bombLog || []).map(({ playerId, name, result, turnNumber, answerTitle }) => ({ playerId, name, result, turnNumber, answerTitle })),
      bomb: room.phase === 'bomb' ? {
        turnPlayerId: room.bombTurnPlayerId,
        turnNumber: room.bombTurnNumber,
        turnEndsAt: room.bombTurnEndsAt,
        songIndex: room.bombSongIndex,
        playerCount: room.players.filter((player) => !player.eliminated).length,
        lastResult: room.bombLastResult || null,
      } : null,
      currentRound: room.phase === 'bomb'
        ? {
            choices: [],
            previewUrl: room.bombSongs?.[room.bombSongIndex]?.previewUrl || '',
            artwork: room.bombSongs?.[room.bombSongIndex]?.artwork || '',
            difficulty: room.difficulty || 'medium',
            genre: room.genre || 'Everything',
          }
        : room.phase === 'game' || room.phase === 'break'
        ? {
            choices: room.rounds[room.roundIndex]?.choices || [],
            previewUrl: room.rounds[room.roundIndex]?.answer.previewUrl || '',
            artwork: room.rounds[room.roundIndex]?.answer.artwork || '',
            difficulty: room.rounds[room.roundIndex]?.difficulty || 'medium',
            genre: room.rounds[room.roundIndex]?.genre || room.genre || 'Everything',
          }
        : null,
      revealedSong: room.phase === 'break' || room.phase === 'finished' ? room.revealedSong : null,
      readyCount: room.players.filter((player) => player.connected && player.continueReady).length,
    };
  }

  send(ws, payload) {
    try { ws.send(JSON.stringify({ ...payload, serverTime: Date.now() })); } catch { /* The socket is closing. */ }
  }

  broadcast(payload) {
    const message = JSON.stringify({ ...payload, room: this.publicRoom(), serverTime: Date.now() });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(message); } catch { /* A closing socket will be removed by the runtime. */ }
    }
  }

  fetch(request) {
    return this.enqueue(() => this.handleFetch(request));
  }

  async handleFetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/create' && request.method === 'POST') {
      if (await this.load()) return json({ error: 'Room code collision. Try again.' }, 409);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Send valid JSON.' }, 400); }
      const hostId = crypto.randomUUID();
      const token = crypto.randomUUID();
      this.state = {
        code: body.code,
        hostId,
        mode: body.mode === 'SongBomb' ? 'SongBomb' : 'Quickfire',
        maxPlayers: Math.max(2, Math.min(20, Number(body.maxPlayers) || 8)),
        genre: String(body.genre || 'Everything').slice(0, 60),
        difficulty: ['easy', 'medium', 'hard', 'extreme'].includes(body.difficulty) ? body.difficulty : 'medium',
        choiceCount: Math.max(4, Math.min(8, Number(body.choiceCount) || 4)),
        roundCount: Math.max(1, Math.min(50, Math.round(Number(body.roundCount) || ROUND_COUNT))),
        durationSeconds: [30, 45, 60].includes(Number(body.durationSeconds)) ? Number(body.durationSeconds) : DEFAULT_ROUND_SECONDS,
        phase: 'lobby',
        players: [{ id: hostId, token, name: body.name, score: 0, connected: false, status: 'playing', continueReady: false, lives: 3, eliminated: false }],
        rounds: [],
        roundIndex: -1,
        stage: 0,
        roundStartedAt: 0,
        roundEndsAt: 0,
        breakEndsAt: 0,
        playback: { playing: false, playAt: 0, offset: 0 },
        revealedSong: null,
        bombSongs: [],
        bombSongIndex: 0,
        bombTurnNumber: 0,
        bombTurnPlayerId: null,
        bombTurnEndsAt: 0,
        createdAt: Date.now(),
      };
      await this.save();
      await this.ctx.storage.setAlarm(this.state.createdAt + 24 * 60 * 60 * 1000);
      return json({ code: this.state.code, playerId: hostId, token, host: true, room: this.publicRoom() });
    }

    if (url.pathname === '/join' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Send valid JSON.' }, 400); }
      const room = await this.load();
      if (!room) return json({ error: 'That room was not found.' }, 404);
      if (!validName(body.name)) return json({ error: 'Enter a name up to 20 characters.' }, 400);
      if (room.phase !== 'lobby') return json({ error: 'This game has already started.' }, 409);
      if (room.players.length >= room.maxPlayers) return json({ error: 'This room is full.' }, 409);
      const player = { id: crypto.randomUUID(), token: crypto.randomUUID(), name: body.name.trim(), score: 0, connected: false, status: 'playing', continueReady: false };
      room.players.push(player);
      await this.save();
      this.broadcast({ type: roomEventType(room) });
      return json({ code: room.code, playerId: player.id, token: player.token, host: false, room: this.publicRoom() });
    }

    if (url.pathname === '/ws') {
      const room = await this.load();
      if (!room) return json({ error: 'That room was not found.' }, 404);
      const token = url.searchParams.get('token');
      const player = room.players.find((item) => item.token === token);
      if (!player) return json({ error: 'This room session is invalid. Rejoin with the room code.' }, 401);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.serializeAttachment({ playerId: player.id });
      this.ctx.acceptWebSocket(server);
      player.connected = true;
      await this.save();
      this.send(server, { type: roomEventType(room), room: this.publicRoom() });
      this.broadcast({ type: roomEventType(room) });
      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ error: 'Unknown room action.' }, 404);
  }

  webSocketMessage(ws, message) {
    return this.enqueue(() => this.handleWebSocketMessage(ws, message));
  }

  async handleWebSocketMessage(ws, message) {
    const room = await this.load();
    if (!room) return;
    const { playerId } = ws.deserializeAttachment() || {};
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return;
    let action;
    try { action = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)); } catch { return; }

    if (action.type === 'ping') {
      this.send(ws, { type: 'pong' });
      return;
    }

    if (action.type === 'bomb-search' && room.phase === 'bomb' && player.id === room.bombTurnPlayerId && !player.eliminated) {
      const query = normalizeGuess(action.query);
      const requestId = Number(action.requestId) || 0;
      const currentSong = room.bombSongs?.[room.bombSongIndex];
      const compact = (value) => normalizeGuess(value).replace(/\s+/g, '');
      const compactQuery = compact(query);
      const matches = (song) => {
        const title = normalizeGuess(song.title);
        const artist = normalizeGuess(song.artist);
        return title.includes(query) || artist.includes(query)
          || compact(title).includes(compactQuery) || compact(artist).includes(compactQuery);
      };
      const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/u.test(query);
      const suggestions = (query.length < (hasJapanese ? 1 : 2)) ? [] : (room.bombSongs || [])
        .filter(matches)
        .sort((a, b) => Number(b === currentSong) - Number(a === currentSong)
          || Number(normalizeGuess(b.title).startsWith(query)) - Number(normalizeGuess(a.title).startsWith(query)))
        .slice(0, 12)
        .map(({ title, artist }) => ({ title, artist }));
      this.send(ws, { type: 'bomb-suggestions', requestId, suggestions });
      return;
    }

    if (action.type === 'leave') {
      if (room.phase === 'lobby' && player.id === room.hostId) {
        room.phase = 'closed';
        await this.save();
        this.broadcast({ type: 'closed' });
        await this.ctx.storage.deleteAll();
        this.state = null;
        for (const socket of this.ctx.getWebSockets()) socket.close(1000, 'Host closed the room');
        return;
      }
      if (room.phase === 'finished' && !room.winner) room.winner = this.getWinner(room);
      const leftBombTurn = room.phase === 'bomb' && room.bombTurnPlayerId === player.id;
      room.players = room.players.filter((item) => item.id !== player.id);
      if (!room.players.length) {
        await this.ctx.storage.deleteAll();
        this.state = null;
        return;
      }
      if (room.hostId === player.id) room.hostId = room.players[0].id;
      await this.save();
      if (room.phase === 'bomb') {
        if (leftBombTurn || room.players.filter((item) => !item.eliminated && item.lives > 0).length <= 1) await this.advanceBombTurn(room, false);
        else this.broadcast({ type: 'bomb' });
      } else if (room.phase === 'game' && room.players.every((item) => item.status !== 'playing')) await this.endRound(room);
      else if (room.phase === 'break' && room.players.filter((item) => item.connected && item.continueReady).length >= Math.max(1, Math.ceil(room.players.filter((item) => item.connected).length / 2))) await this.beginNextRound(room);
      else this.broadcast({ type: roomEventType(room) });
      ws.close(1000, 'Left room');
      return;
    }

    if (action.type === 'kick' && room.phase === 'lobby' && player.id === room.hostId) {
      const targetId = String(action.playerId || '');
      const target = room.players.find((item) => item.id === targetId && item.id !== room.hostId);
      if (!target) return;
      room.players = room.players.filter((item) => item.id !== target.id);
      await this.save();
      const targetSockets = this.ctx.getWebSockets().filter((socket) => socket.deserializeAttachment()?.playerId === target.id);
      for (const socket of targetSockets) this.send(socket, { type: 'kicked' });
      this.broadcast({ type: 'lobby' });
      for (const socket of targetSockets) socket.close(1000, 'Removed by host');
      return;
    }

    if (action.type === 'configure' && room.phase === 'lobby' && player.id === room.hostId) {
      const name = validName(action.name) ? action.name.trim() : player.name;
      const maxPlayers = Number.isFinite(Number(action.maxPlayers))
        ? Math.max(room.players.length, Math.min(20, Math.max(2, Number(action.maxPlayers))))
        : room.maxPlayers;
      const genre = typeof action.genre === 'string' ? action.genre.slice(0, 60) : room.genre;
      const mode = action.mode === 'SongBomb' || action.mode === 'Quickfire' ? action.mode : (room.mode || 'Quickfire');
      const difficulty = ['easy', 'medium', 'hard', 'extreme'].includes(action.difficulty) ? action.difficulty : (room.difficulty || 'medium');
      const choiceCount = Math.max(4, Math.min(8, Number(action.choiceCount) || Number(room.choiceCount) || 4));
      const roundCount = Math.max(1, Math.min(50, Math.round(Number(action.roundCount) || Number(room.roundCount) || ROUND_COUNT)));
      const durationSeconds = [30, 45, 60].includes(Number(action.durationSeconds)) ? Number(action.durationSeconds) : room.durationSeconds;
      if (name === player.name && maxPlayers === room.maxPlayers && genre === room.genre && mode === (room.mode || 'Quickfire') && difficulty === (room.difficulty || 'medium') && choiceCount === (room.choiceCount || 4) && roundCount === (room.roundCount || ROUND_COUNT) && durationSeconds === room.durationSeconds) return;
      player.name = name;
      room.players[0].name = name;
      room.maxPlayers = maxPlayers;
      room.genre = genre;
      room.mode = mode;
      room.difficulty = difficulty;
      room.choiceCount = choiceCount;
      room.roundCount = roundCount;
      room.durationSeconds = durationSeconds;
      await this.save();
      this.broadcast({ type: 'lobby' });
      return;
    }

    if (action.type === 'rename' && room.phase === 'lobby') {
      if (!validName(action.name)) {
        this.send(ws, { type: 'error', error: 'Enter a name up to 20 characters.' });
        return;
      }
      player.name = action.name.trim();
      await this.save();
      this.broadcast({ type: 'lobby' });
      return;
    }

    if (action.type === 'return-lobby' && room.phase === 'finished' && player.id === room.hostId) {
      room.phase = 'lobby';
      room.winner = null;
      room.rounds = [];
      room.roundIndex = -1;
      room.stage = 0;
      room.roundStartedAt = 0;
      room.roundEndsAt = 0;
      room.breakEndsAt = 0;
      room.revealedSong = null;
      room.bombSongs = [];
      room.bombSongIndex = 0;
      room.bombTurnNumber = 0;
      room.bombTurnPlayerId = null;
      room.bombTurnEndsAt = 0;
      room.bombLastResult = null;
      room.playback = { playing: false, playAt: 0, offset: 0, endsAt: 0 };
      room.players.forEach((item) => {
        item.score = 0;
        item.lives = 3;
        item.eliminated = false;
        item.status = 'playing';
        item.continueReady = false;
      });
      await this.save();
      await this.ctx.storage.setAlarm(room.createdAt + 24 * 60 * 60 * 1000);
      this.broadcast({ type: 'lobby' });
      return;
    }

    if (action.type === 'start-bomb' && room.phase === 'lobby' && room.mode === 'SongBomb' && player.id === room.hostId) {
      const activePlayers = room.players.filter((item) => !item.eliminated);
      if (activePlayers.length < 1) {
        this.send(ws, { type: 'error', error: 'Song Bomb needs at least one player in the room.' });
        return;
      }
      const songs = Array.isArray(action.songs) ? action.songs.slice(0, 100).map(cleanBombSong).filter(Boolean) : [];
      if (songs.length < 4) {
        this.send(ws, { type: 'error', error: 'The host could not prepare enough playable songs. Try again.' });
        return;
      }
      room.bombSongs = songs;
      room.bombSongIndex = 0;
      room.bombTurnNumber = 1;
      room.bombTurnPlayerId = room.players.find((item) => !item.eliminated)?.id || player.id;
      room.bombTurnEndsAt = Date.now() + bombTurnSeconds(room) * 1000;
      room.bombLastResult = null;
      room.bombLog = [];
      room.bombSolo = activePlayers.length === 1;
      room.winner = null;
      room.players.forEach((item) => { item.score = 0; item.lives = 3; item.eliminated = false; item.status = 'playing'; item.continueReady = false; });
      room.phase = 'bomb';
      await this.save();
      await this.ctx.storage.setAlarm(room.bombTurnEndsAt);
      this.broadcast({ type: 'bomb' });
      return;
    }

    if (action.type === 'bomb-skip' && room.phase === 'bomb' && player.id === room.bombTurnPlayerId && !player.eliminated) {
      const result = Date.now() >= room.bombTurnEndsAt ? 'timeout' : 'skip';
      room.bombLastResult = {
        playerId: player.id,
        result,
        turnNumber: room.bombTurnNumber,
        answerTitle: room.bombSongs?.[room.bombSongIndex]?.title || '',
      };
      await this.advanceBombTurn(room, true);
      return;
    }

    if (action.type === 'bomb-guess' && room.phase === 'bomb' && player.id === room.bombTurnPlayerId && !player.eliminated) {
      if (Date.now() >= room.bombTurnEndsAt) {
        room.bombLastResult = {
          playerId: player.id,
          result: 'timeout',
          turnNumber: room.bombTurnNumber,
          answerTitle: room.bombSongs?.[room.bombSongIndex]?.title || '',
        };
        await this.advanceBombTurn(room, true);
        return;
      }
      const answer = room.bombSongs?.[room.bombSongIndex];
      const guess = normalizeGuess(action.guess);
      const title = normalizeGuess(action.title);
      const artist = normalizeGuess(action.artist);
      const answerTitle = normalizeGuess(answer?.title);
      const answerArtist = normalizeGuess(answer?.artist);
      const correct = Boolean(answer) && (
        (title && title === answerTitle)
        || (artist && artist === answerArtist)
        || (guess && (guess === answerTitle || guess === answerArtist))
      );
      room.bombLastResult = {
        playerId: player.id,
        result: correct ? 'correct' : 'wrong',
        turnNumber: room.bombTurnNumber,
        answerTitle: correct ? '' : answer?.title || '',
      };
      this.send(ws, { type: 'bomb-result', correct });
      await this.advanceBombTurn(room, !correct);
      return;
    }

    if (action.type === 'start' && room.phase === 'lobby' && player.id === room.hostId) {
      const roundCount = Math.max(1, Math.min(50, Math.round(Number(room.roundCount) || ROUND_COUNT)));
      if (!Array.isArray(action.rounds) || action.rounds.length !== roundCount) {
        this.send(ws, { type: 'error', error: `The host needs to prepare ${roundCount} playable rounds before starting.` });
        return;
      }
      const rounds = action.rounds.map(cleanRound);
      if (rounds.some((round) => !round)) {
        this.send(ws, { type: 'error', error: 'A song preview could not be prepared. Try starting again.' });
        return;
      }
      room.rounds = rounds;
      room.players.forEach((item) => { item.score = 0; item.status = 'playing'; item.continueReady = false; });
      room.roundIndex = 0;
      await this.beginRound(room);
      await this.save();
      this.broadcast({ type: 'game' });
      return;
    }

    if (action.type === 'start') {
      this.send(ws, {
        type: 'error',
        error: room.phase !== 'lobby' ? 'This room is not waiting to start a match.' : 'Only the current host can start the match.',
      });
      return;
    }

    if (action.type === 'guess' && room.phase === 'game' && player.status === 'playing') {
      const round = room.rounds[room.roundIndex];
      const correct = Number(action.choiceIndex) === round.answerIndex;
      if (correct) {
        const correctBefore = room.players.filter((item) => item.status === 'correct').length;
        const elapsed = Math.max(0, Math.floor((Date.now() - room.roundStartedAt) / 1000));
        const guessStage = Math.max(0, Math.min(4, Number.isInteger(Number(action.stage)) ? Number(action.stage) : room.stage));
        const timePenalty = Math.min(25, Math.floor(elapsed / 4) * 5);
        const orderPenalty = Math.min(25, correctBefore * 5);
        const points = Math.max(5, ROUND_POINTS[guessStage] - timePenalty - orderPenalty);
        player.score += points;
        player.status = 'correct';
        this.broadcast({ type: 'guess-result', playerId: player.id, correct: true, points });
      } else {
        player.score = Math.max(0, player.score - 5);
        player.status = 'wrong';
        this.broadcast({ type: 'guess-result', playerId: player.id, correct: false, points: -5 });
      }
      await this.save();
      if (room.players.every((item) => item.status !== 'playing')) await this.endRound(room);
      else this.broadcast({ type: 'game' });
      return;
    }

    if (action.type === 'continue' && room.phase === 'break' && !player.continueReady) {
      player.continueReady = true;
      await this.save();
      this.broadcast({ type: 'round-ended' });
      if (room.players.filter((item) => item.connected && item.continueReady).length >= Math.max(1, Math.ceil(room.players.filter((item) => item.connected).length / 2))) await this.beginNextRound(room);
    }
  }

  async advanceBombTurn(room, loseLife) {
    const oldTurnIndex = room.players.findIndex((item) => item.id === room.bombTurnPlayerId);
    const current = oldTurnIndex >= 0 ? room.players[oldTurnIndex] : null;
    const result = room.bombLastResult;
    if (result && result.turnNumber === room.bombTurnNumber && current) {
      room.bombLog ||= [];
      room.bombLog.push({
        playerId: current.id,
        name: current.name,
        result: result.result,
        turnNumber: room.bombTurnNumber,
        answerTitle: result.answerTitle || (result.result !== 'correct' ? room.bombSongs?.[room.bombSongIndex]?.title || '' : ''),
      });
      if (room.bombLog.length > 80) room.bombLog.splice(0, room.bombLog.length - 80);
    }
    if (loseLife && current) {
      current.lives = Math.max(0, (Number.isInteger(current.lives) ? current.lives : 3) - 1);
      if (current.lives <= 0) current.eliminated = true;
    }
    const alive = room.players.filter((item) => !item.eliminated && item.lives > 0);
    if (alive.length === 0 || (alive.length === 1 && room.bombSolo !== true)) {
      room.phase = 'finished';
      room.bombTurnEndsAt = 0;
      room.winner = alive[0] ? { id: alive[0].id, name: alive[0].name, lives: alive[0].lives } : null;
      await this.save();
      await this.ctx.storage.setAlarm(room.createdAt + 24 * 60 * 60 * 1000);
      this.broadcast({ type: 'game-ended' });
      return;
    }
    let next = null;
    for (let offset = 1; offset <= room.players.length; offset += 1) {
      const startIndex = oldTurnIndex >= 0 ? oldTurnIndex : -1;
      const candidate = room.players[(startIndex + offset + room.players.length) % room.players.length];
      if (!candidate.eliminated && candidate.lives > 0) { next = candidate; break; }
    }
    if (!next) return;
    room.bombTurnPlayerId = next.id;
    room.bombTurnNumber += 1;
    room.bombSongIndex = (room.bombSongIndex + 1) % room.bombSongs.length;
    room.bombTurnEndsAt = Date.now() + bombTurnSeconds(room) * 1000;
    await this.save();
    await this.ctx.storage.setAlarm(room.bombTurnEndsAt);
    this.broadcast({ type: 'bomb' });
  }

  async beginRound(room) {
    room.phase = 'game';
    room.stage = 0;
    room.roundStartedAt = Date.now();
    room.roundEndsAt = room.roundStartedAt + (room.durationSeconds || DEFAULT_ROUND_SECONDS) * 1000;
    room.breakEndsAt = 0;
    room.revealedSong = null;
    room.playback = { playing: false, playAt: 0, offset: 0, endsAt: 0 };
    room.players.forEach((player) => { player.status = 'playing'; player.continueReady = false; });
    await this.ctx.storage.setAlarm(room.roundEndsAt);
  }

  async endRound(room) {
    if (room.phase !== 'game') return;
    room.phase = 'break';
    room.breakEndsAt = Date.now() + BREAK_SECONDS * 1000;
    room.playback = { playing: false, playAt: 0, offset: STAGE_STARTS[room.stage], endsAt: 0 };
    const round = room.rounds[room.roundIndex];
    room.revealedSong = { ...round.answer, answerIndex: round.answerIndex };
    room.players.forEach((player) => { player.continueReady = false; });
    await this.save();
    await this.ctx.storage.setAlarm(room.breakEndsAt);
    this.broadcast({ type: 'round-ended' });
  }

  async beginNextRound(room) {
    if (room.phase !== 'break') return;
    if (room.roundIndex + 1 >= room.rounds.length) {
      room.phase = 'finished';
      room.breakEndsAt = 0;
      room.winner = this.getWinner(room);
      await this.save();
      await this.ctx.storage.setAlarm(room.createdAt + 24 * 60 * 60 * 1000);
      this.broadcast({ type: 'game-ended' });
      return;
    }
    room.roundIndex += 1;
    await this.beginRound(room);
    await this.save();
    this.broadcast({ type: 'game' });
  }

  getWinner(room) {
    const winner = [...(room.players || [])].sort((a, b) => b.score - a.score)[0];
    return winner ? { id: winner.id, name: winner.name, score: winner.score } : null;
  }

  alarm() {
    return this.enqueue(() => this.handleAlarm());
  }

  async handleAlarm() {
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    if (now - room.createdAt >= 24 * 60 * 60 * 1000) {
      await this.ctx.storage.deleteAll();
      this.state = null;
      return;
    }
    if (room.phase === 'bomb' && now >= room.bombTurnEndsAt) {
      room.bombLastResult = {
        playerId: room.bombTurnPlayerId,
        result: 'timeout',
        turnNumber: room.bombTurnNumber,
        answerTitle: room.bombSongs?.[room.bombSongIndex]?.title || '',
      };
      await this.advanceBombTurn(room, true);
    } else if (room.phase === 'game' && room.playback.playing && now >= room.playback.endsAt && now < room.roundEndsAt) {
      room.playback = { playing: false, playAt: 0, offset: STAGE_STARTS[room.stage], endsAt: 0 };
      await this.save();
      await this.ctx.storage.setAlarm(room.roundEndsAt);
      this.broadcast({ type: 'game' });
    } else if (room.phase === 'game' && now >= room.roundEndsAt) await this.endRound(room);
    else if (room.phase === 'break' && now >= room.breakEndsAt) await this.beginNextRound(room);
    else await this.ctx.storage.setAlarm(room.phase === 'bomb' ? room.bombTurnEndsAt : room.phase === 'game' ? room.roundEndsAt : room.breakEndsAt || room.createdAt + 24 * 60 * 60 * 1000);
  }

  async webSocketClose(ws) {
    await this.setConnected(ws, false);
  }

  async webSocketError(ws) {
    await this.setConnected(ws, false);
  }

  setConnected(ws, connected) {
    return this.enqueue(() => this.handleSetConnected(ws, connected));
  }

  async handleSetConnected(ws, connected) {
    const room = await this.load();
    const { playerId } = ws.deserializeAttachment() || {};
    const player = room?.players.find((item) => item.id === playerId);
    if (!player) return;
    const anotherConnection = this.ctx.getWebSockets().some((socket) => socket !== ws && socket.deserializeAttachment()?.playerId === playerId);
    player.connected = connected || anotherConnection;
    await this.save();
    if (room.phase === 'break' && room.players.filter((item) => item.connected && item.continueReady).length >= Math.max(1, Math.ceil(room.players.filter((item) => item.connected).length / 2))) {
      await this.beginNextRound(room);
      return;
    }
    this.broadcast({ type: roomEventType(room) });
  }
}
