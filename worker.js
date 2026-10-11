import { DurableObject } from 'cloudflare:workers';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROUND_SECONDS = 30;
const BREAK_SECONDS = 5;
const ROUND_COUNT = 10;
const STAGES = [0.1, 0.5, 2, 8, 15];
const STAGE_STARTS = [0, ...STAGES.slice(0, -1)];
const ROUND_POINTS = [100, 80, 60, 35, 20];

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

function cleanRound(round) {
  if (!round || !Array.isArray(round.choices) || round.choices.length !== 4) return null;
  if (!Number.isInteger(round.answerIndex) || round.answerIndex < 0 || round.answerIndex > 3) return null;
  const safeArtwork = (value) => {
    const candidate = String(value || '');
    try { return new URL(candidate).hostname.endsWith('.mzstatic.com') ? candidate.slice(0, 1000) : ''; } catch { return ''; }
  };
  const choices = round.choices.map((choice) => ({
    title: String(choice?.title || '').slice(0, 160),
    artwork: safeArtwork(choice?.artwork),
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
        body: JSON.stringify({ code, name: body.name.trim(), maxPlayers: body.maxPlayers, genre: body.genre }),
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
      maxPlayers: room.maxPlayers,
      genre: room.genre,
      phase: room.phase,
      players: room.players.map(({ id, name, score, connected, status, continueReady }) => ({ id, name, score, connected, status, continueReady })),
      roundNumber: room.roundIndex >= 0 ? room.roundIndex + 1 : 0,
      stage: room.stage,
      roundStartedAt: room.roundStartedAt,
      roundEndsAt: room.roundEndsAt,
      breakEndsAt: room.breakEndsAt,
      playback: room.playback,
      currentRound: room.phase === 'game' || room.phase === 'break'
        ? {
            choices: room.rounds[room.roundIndex]?.choices || [],
            previewUrl: room.rounds[room.roundIndex]?.answer.previewUrl || '',
            artwork: room.rounds[room.roundIndex]?.answer.artwork || '',
          }
        : null,
      revealedSong: room.phase === 'break' || room.phase === 'finished' ? room.revealedSong : null,
      readyCount: room.players.filter((player) => player.continueReady).length,
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
        maxPlayers: Math.max(2, Math.min(20, Number(body.maxPlayers) || 8)),
        genre: String(body.genre || 'Everything').slice(0, 60),
        phase: 'lobby',
        players: [{ id: hostId, token, name: body.name, score: 0, connected: false, status: 'playing', continueReady: false }],
        rounds: [],
        roundIndex: -1,
        stage: 0,
        roundStartedAt: 0,
        roundEndsAt: 0,
        breakEndsAt: 0,
        playback: { playing: false, playAt: 0, offset: 0 },
        revealedSong: null,
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
      this.broadcast({ type: room.phase === 'lobby' ? 'lobby' : room.phase === 'game' ? 'game' : room.phase === 'break' ? 'round-ended' : 'game-ended' });
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
      this.send(server, { type: room.phase === 'lobby' ? 'lobby' : room.phase === 'game' ? 'game' : room.phase === 'break' ? 'round-ended' : 'game-ended', room: this.publicRoom() });
      this.broadcast({ type: room.phase === 'lobby' ? 'lobby' : room.phase === 'game' ? 'game' : room.phase === 'break' ? 'round-ended' : 'game-ended' });
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
      room.players = room.players.filter((item) => item.id !== player.id);
      if (!room.players.length) {
        await this.ctx.storage.deleteAll();
        this.state = null;
        return;
      }
      await this.save();
      if (room.phase === 'game' && room.players.every((item) => item.status === 'correct')) await this.endRound(room);
      else if (room.phase === 'break' && room.players.every((item) => item.continueReady)) await this.beginNextRound(room);
      else this.broadcast({ type: room.phase === 'lobby' ? 'lobby' : room.phase === 'game' ? 'game' : room.phase === 'break' ? 'round-ended' : 'game-ended' });
      ws.close(1000, 'Left room');
      return;
    }

    if (action.type === 'configure' && room.phase === 'lobby' && player.id === room.hostId) {
      if (validName(action.name)) {
        player.name = action.name.trim();
        room.players[0].name = player.name;
      }
      if (Number.isFinite(Number(action.maxPlayers))) room.maxPlayers = Math.max(room.players.length, Math.min(20, Math.max(2, Number(action.maxPlayers))));
      if (typeof action.genre === 'string') room.genre = action.genre.slice(0, 60);
      await this.save();
      this.broadcast({ type: 'lobby' });
      return;
    }

    if (action.type === 'start' && room.phase === 'lobby' && player.id === room.hostId) {
      if (!Array.isArray(action.rounds) || action.rounds.length !== ROUND_COUNT) {
        this.send(ws, { type: 'error', error: 'The host needs to prepare ten playable rounds before starting.' });
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

    if (action.type === 'skip' && room.phase === 'game' && room.stage < 4 && player.status === 'playing') {
      room.stage += 1;
      const playAt = Date.now() + 900;
      room.playback = { playing: true, playAt, offset: STAGE_STARTS[room.stage], endsAt: playAt + (STAGES[room.stage] - STAGE_STARTS[room.stage]) * 1000 };
      await this.scheduleGameAlarm(room);
      await this.save();
      this.broadcast({ type: 'game' });
      return;
    }

    if (action.type === 'playback' && room.phase === 'game' && player.status === 'playing') {
      if (action.playing) {
        const playAt = Date.now() + 900;
        room.playback = { playing: true, playAt, offset: STAGE_STARTS[room.stage], endsAt: playAt + (STAGES[room.stage] - STAGE_STARTS[room.stage]) * 1000 };
        await this.scheduleGameAlarm(room);
      } else {
        room.playback = { playing: false, playAt: 0, offset: STAGE_STARTS[room.stage], endsAt: 0 };
        await this.ctx.storage.setAlarm(room.roundEndsAt);
      }
      await this.save();
      this.broadcast({ type: 'game' });
      return;
    }

    if (action.type === 'guess' && room.phase === 'game' && player.status === 'playing') {
      const round = room.rounds[room.roundIndex];
      const correct = Number(action.choiceIndex) === round.answerIndex;
      if (correct) {
        const correctBefore = room.players.filter((item) => item.status === 'correct').length;
        const elapsed = Math.max(0, Math.floor((Date.now() - room.roundStartedAt) / 1000));
        const timePenalty = Math.min(25, Math.floor(elapsed / 4) * 5);
        const orderPenalty = Math.min(25, correctBefore * 5);
        const points = Math.max(5, ROUND_POINTS[room.stage] - timePenalty - orderPenalty);
        player.score += points;
        player.status = 'correct';
        this.broadcast({ type: 'guess-result', playerId: player.id, correct: true, points });
      } else {
        player.score = Math.max(0, player.score - 5);
        player.status = 'wrong';
        this.broadcast({ type: 'guess-result', playerId: player.id, correct: false, points: -5 });
      }
      await this.save();
      if (room.players.every((item) => item.status === 'correct')) await this.endRound(room);
      else this.broadcast({ type: 'game' });
      return;
    }

    if (action.type === 'continue' && room.phase === 'break' && !player.continueReady) {
      player.continueReady = true;
      await this.save();
      this.broadcast({ type: 'round-ended' });
      if (room.players.every((item) => item.continueReady)) await this.beginNextRound(room);
    }
  }

  async beginRound(room) {
    room.phase = 'game';
    room.stage = 0;
    room.roundStartedAt = Date.now();
    room.roundEndsAt = room.roundStartedAt + ROUND_SECONDS * 1000;
    room.breakEndsAt = 0;
    room.revealedSong = null;
    room.playback = { playing: false, playAt: 0, offset: 0, endsAt: 0 };
    room.players.forEach((player) => { player.status = 'playing'; player.continueReady = false; });
    await this.ctx.storage.setAlarm(room.roundEndsAt);
  }

  async scheduleGameAlarm(room) {
    const playbackEnd = room.playback.playing ? room.playback.endsAt : room.roundEndsAt;
    await this.ctx.storage.setAlarm(Math.min(room.roundEndsAt, playbackEnd));
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
    if (room.phase === 'game' && room.playback.playing && now >= room.playback.endsAt && now < room.roundEndsAt) {
      room.playback = { playing: false, playAt: 0, offset: STAGE_STARTS[room.stage], endsAt: 0 };
      await this.save();
      await this.ctx.storage.setAlarm(room.roundEndsAt);
      this.broadcast({ type: 'game' });
    } else if (room.phase === 'game' && now >= room.roundEndsAt) await this.endRound(room);
    else if (room.phase === 'break' && now >= room.breakEndsAt) await this.beginNextRound(room);
    else await this.ctx.storage.setAlarm(room.phase === 'game' ? room.roundEndsAt : room.breakEndsAt || room.createdAt + 24 * 60 * 60 * 1000);
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
    this.broadcast({ type: room.phase === 'lobby' ? 'lobby' : room.phase === 'game' ? 'game' : room.phase === 'break' ? 'round-ended' : 'game-ended' });
  }
}
