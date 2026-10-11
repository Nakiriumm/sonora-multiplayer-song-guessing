(() => {
  const SESSION_KEY = 'sonora-cloudflare-session';
  const PENDING_ROOM_KEY = 'sonora-pending-room';
  const ROUND_COUNT = 10;
  const DEFAULT_MAX_PLAYERS = 8;
  const STAGE_ENDS = [0.1, 0.5, 2, 8, 15];
  const state = {
    session: null,
    socket: null,
    room: null,
    connectTimer: 0,
    heartbeat: 0,
    timer: 0,
    serverOffset: 0,
    pendingHost: false,
    manuallyClosed: false,
    activeAudio: null,
    audioFrame: 0,
    audioOperation: 0,
    localStage: 0,
    localRound: 0,
    prepareRequest: 0,
    timerKey: '',
    scoreboardKey: '',
    configureTimer: 0,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const sessionStore = {
    get() {
      try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
    },
    set(session) {
      state.session = session;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    },
    clear() {
      sessionStorage.removeItem(SESSION_KEY);
      state.session = null;
    },
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  async function api(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }

  function send(type, extra = {}) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      showNotice('Connection lost. Reconnecting…');
      return false;
    }
    state.socket.send(JSON.stringify({ type, ...extra }));
    return true;
  }

  function showNotice(message, isError = false) {
    const target = $('.copy-status');
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('error', isError);
  }

  function setRoomCode(code) {
    const label = $('.room-code');
    if (label) label.textContent = code;
    const input = $('#join-code');
    if (input) input.placeholder = code;
  }

  function openSetup(name) {
    const modal = $('.modal-backdrop');
    const hostName = $('.host-name-input');
    const nameGate = $('.name-gate');
    if (hostName) {
      hostName.value = name;
      hostName.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (nameGate) nameGate.hidden = true;
    modal.hidden = false;
    modal.classList.add('page-view');
    document.body.style.overflow = 'hidden';
  }

  function currentSettings(name) {
    const saved = getRoomState();
    const playersLabel = $('.player-stepper strong')?.textContent || `${DEFAULT_MAX_PLAYERS} players`;
    const genre = $('.genre-option.selected')?.textContent || saved.genre || 'Everything';
    return {
      name,
      maxPlayers: Number.parseInt(playersLabel, 10) || DEFAULT_MAX_PLAYERS,
      genre,
      difficulty: $('.difficulty-option.selected')?.dataset.difficulty || saved.difficulty || 'medium',
      choiceCount: Number.parseInt($('.choice-stepper strong')?.textContent, 10) || saved.choiceCount || 4,
      durationSeconds: Number.parseInt($('.duration-stepper strong')?.textContent, 10) || Number.parseInt(saved.time, 10) || 30,
    };
  }

  async function createRoom(name) {
    sessionStorage.setItem(PENDING_ROOM_KEY, JSON.stringify({ name, settings: currentSettings(name) }));
    location.assign(new URL('room.html', location.href).href);
  }

  async function finishRoomCreation(name, settings) {
    const result = await api('/api/rooms', settings);
    sessionStore.set({ code: result.code, playerId: result.playerId, token: result.token, host: true });
    sessionStorage.removeItem(PENDING_ROOM_KEY);
    setRoomCode(result.code);
    openSetup(name);
    connect();
  }

  async function joinRoom(name, code) {
    const cleanCode = code.trim().replace(/\D/g, '').slice(0, 7);
    if (!/^\d{7}$/.test(cleanCode)) throw new Error('Enter the full 7 digit room code.');
    const result = await api(`/api/rooms/${encodeURIComponent(cleanCode)}/join`, { name });
    sessionStore.set({ code: result.code, playerId: result.playerId, token: result.token, host: false });
    state.room = result.room;
    $('.joined-room-panel').hidden = false;
    setRoomCode(result.code);
    const form = $('.join-form');
    form.querySelectorAll('input,button').forEach((element) => { element.disabled = true; });
    $('.join-status').textContent = 'Joined. Waiting for the host to start…';
    $('.join-status').className = 'join-status success';
    renderLobby(result.room);
    connect();
  }

  function connect() {
    if (!state.session) return;
    state.manuallyClosed = false;
    clearTimeout(state.connectTimer);
    if (state.socket) {
      state.socket.onclose = null;
      state.socket.close();
    }
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${scheme}//${location.host}/ws/${encodeURIComponent(state.session.code)}?token=${encodeURIComponent(state.session.token)}`);
    state.socket = socket;
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (Number.isFinite(message.serverTime)) state.serverOffset = message.serverTime - Date.now();
      handleMessage(message);
    });
    socket.addEventListener('open', () => {
      clearInterval(state.heartbeat);
      state.heartbeat = setInterval(() => send('ping'), 25000);
      showNotice('Connected to Cloudflare room.');
    });
    socket.addEventListener('close', () => {
      clearInterval(state.heartbeat);
      if (state.manuallyClosed || !state.session) return;
      showNotice('Connection lost. Reconnecting…', true);
      state.connectTimer = setTimeout(connect, 1500);
    });
    socket.addEventListener('error', () => showNotice('Unable to connect to the room. Check that the Cloudflare Worker is deployed.', true));
  }

  function enterGame() {
    $('.modal-backdrop').hidden = true;
    $('.name-gate').hidden = true;
    $('.join-page').hidden = true;
    $('main').hidden = true;
    $('.site-footer').hidden = true;
    $$('.info-page').forEach((page) => { page.hidden = true; });
    $('.game-view').hidden = false;
    document.body.style.overflow = 'auto';
  }

  function renderLobby(room) {
    if (!room) return;
    state.room = room;
    setRoomCode(room.code);
    const players = room.players || [];
    const roomLabel = $('.joined-room-heading .eyebrow');
    if (roomLabel) roomLabel.textContent = 'Cloudflare room';
    const hostSettings = $$('.host-settings strong');
    if (hostSettings.length >= 6) {
      hostSettings[0].textContent = 'Classic';
      hostSettings[1].textContent = `${room.maxPlayers} max`;
      hostSettings[2].textContent = room.genre;
      hostSettings[3].textContent = `${room.durationSeconds || 30} sec`;
      hostSettings[4].textContent = (room.difficulty || 'medium').replace(/^./, (letter) => letter.toUpperCase());
      hostSettings[5].textContent = `${room.choiceCount || 4} choices`;
    }
    if (state.session?.host) {
      const playerStepper = $('.player-stepper strong');
      if (playerStepper) playerStepper.textContent = `${room.maxPlayers} players`;
      const durationStepper = $('.duration-stepper strong');
      if (durationStepper) durationStepper.textContent = `${room.durationSeconds || 30} seconds`;
      const choiceStepper = $('.choice-stepper strong');
      if (choiceStepper) choiceStepper.textContent = `${room.choiceCount || 4} choices`;
    }
    const listMarkup = players.map((player, index) => `<div class="joined-player"><span class="joined-avatar ${index === 0 ? 'avatar-yellow' : 'avatar-blue'}">${escapeHtml(player.name.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(player.name)}</strong><small>${index === 0 ? 'Host' : 'Joined'}${player.connected ? '' : ' · reconnecting'}</small></span><i>${index === 0 ? '★' : '✓'}</i></div>`).join('');
    const free = Math.max(0, room.maxPlayers - players.length);
    const waitingMarkup = free ? `<div class="joined-player waiting"><span class="joined-avatar">+</span><span><strong>Waiting for players</strong><small>${free} spot${free === 1 ? '' : 's'} open</small></span></div>` : '';
    const combined = listMarkup + waitingMarkup;
    const roster = $('.joined-list');
    const joinRoster = $('.joined-room-list');
    if (roster) roster.innerHTML = combined;
    if (joinRoster) joinRoster.innerHTML = combined;
    const joinPanel = $('.joined-room-panel');
    if (joinPanel) joinPanel.hidden = false;
    const launch = $('.launch-button');
    if (launch) {
      launch.disabled = !state.session?.host || room.phase !== 'lobby';
      launch.setAttribute('aria-disabled', String(launch.disabled));
      launch.title = launch.disabled ? 'Only the host can start the room' : 'Start the room';
    }
    if (state.session?.host && room.phase === 'lobby') {
      const settings = currentSettings($('.host-name-input')?.value.trim());
      const host = players.find((player) => player.id === state.session.playerId);
      if (host && (settings.name !== host.name || settings.maxPlayers !== room.maxPlayers || settings.genre !== room.genre || settings.difficulty !== (room.difficulty || 'medium') || settings.choiceCount !== (room.choiceCount || 4) || settings.durationSeconds !== room.durationSeconds)) send('configure', settings);
    }
  }

  function updateScoreboard(room) {
    const list = $('.score-list');
    if (!list) return;
    const players = [...(room.players || [])]
      .sort((a, b) => b.score - a.score);
    const key = players.map((player) => `${player.id}:${player.name}:${player.score}`).join('|');
    if (key === state.scoreboardKey) return;
    state.scoreboardKey = key;
    list.innerHTML = players
      .map((player, index) => `<div class="score-row"><span>0${index + 1}</span><strong>${escapeHtml(player.name)}</strong><b>${player.score}</b></div>`)
      .join('');
  }

  function updateTimer(deadline, selector, key) {
    if (state.timerKey === key) return;
    clearRoomTimer();
    state.timerKey = key;
    const clock = $(selector);
    let lastRemaining = -1;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - (Date.now() + state.serverOffset)) / 1000));
      if (clock && remaining !== lastRemaining) {
        clock.textContent = String(remaining);
        lastRemaining = remaining;
      }
    };
    update();
    state.timer = setInterval(update, 500);
  }

  function updateRoundTimer(room) {
    updateTimer(room.roundEndsAt, '.round-clock strong', `round:${room.roundNumber}:${room.roundEndsAt}`);
  }

  function updateBreakTimer(room) {
    updateTimer(room.breakEndsAt, '.result-countdown b', `break:${room.roundNumber}:${room.breakEndsAt}`);
  }

  function clearRoomTimer() {
    clearInterval(state.timer);
    state.timer = 0;
    state.timerKey = '';
  }

  function stopSyncedAudio() {
    state.audioOperation += 1;
    cancelAnimationFrame(state.audioFrame);
    state.audioFrame = 0;
    if (state.activeAudio) state.activeAudio.pause();
    state.activeAudio = null;
    $('.game-play')?.classList.remove('is-playing');
    $('.game-play')?.setAttribute('aria-label', 'Play current section');
  }

  function renderLocalProgress(audio) {
    const boundaries = [0, ...STAGE_ENDS];
    const marks = [0, 3, 11, 34, 70, 100];
    const end = STAGE_ENDS[state.localStage];
    const time = Math.max(0, Math.min(end, audio.currentTime));
    let segment = 0;
    while (segment < STAGE_ENDS.length - 1 && time > boundaries[segment + 1]) segment += 1;
    const span = boundaries[segment + 1] - boundaries[segment];
    const fraction = Math.max(0, Math.min(1, (time - boundaries[segment]) / span));
    $('.track-line i').style.width = `${marks[segment] + fraction * (marks[segment + 1] - marks[segment])}%`;
  }

  async function playLocalSection(restart = false, startAt = null) {
    const source = state.room?.currentRound?.previewUrl;
    if (!source) return;
    const sourceUrl = new URL(source, location.href).href;
    if (!state.activeAudio || state.activeAudio.src !== sourceUrl) {
      if (state.activeAudio) state.activeAudio.pause();
      state.activeAudio = new Audio(sourceUrl);
      state.activeAudio.preload = 'auto';
    }
    const audio = state.activeAudio;
    const operation = ++state.audioOperation;
    const roundNumber = state.localRound;
    const stageNumber = state.localStage;
    const start = state.localStage === 0 ? 0 : STAGE_ENDS[state.localStage - 1];
    const end = STAGE_ENDS[state.localStage];
    audio.volume = Number($('.game-view [aria-label="Volume"]')?.value || 65) / 100;
    if (startAt !== null) audio.currentTime = startAt;
    else if (restart || audio.currentTime >= end) audio.currentTime = 0;
    if (!audio.paused) {
      audio.pause();
      cancelAnimationFrame(state.audioFrame);
      $('.game-play').classList.remove('is-playing');
      $('.game-play').setAttribute('aria-label', 'Play current section');
      renderLocalProgress(audio);
      return;
    }
    try {
      await audio.play();
      if (operation !== state.audioOperation || audio !== state.activeAudio || roundNumber !== state.localRound || stageNumber !== state.localStage) return;
      $('.game-play').classList.add('is-playing');
      $('.game-play').setAttribute('aria-label', 'Pause current section');
      const animate = () => {
        if (audio !== state.activeAudio || audio.paused) return;
        renderLocalProgress(audio);
        if (audio.currentTime >= end) {
          audio.pause();
          audio.currentTime = end;
          $('.game-play').classList.remove('is-playing');
          $('.game-play').setAttribute('aria-label', 'Play current section');
          renderLocalProgress(audio);
          return;
        }
        state.audioFrame = requestAnimationFrame(animate);
      };
      cancelAnimationFrame(state.audioFrame);
      state.audioFrame = requestAnimationFrame(animate);
    } catch {
      $('.round-feedback').textContent = 'Your browser blocked audio. Press play to allow sound, then try again.';
    }
  }

  function skipLocalClue() {
    if (state.localStage >= STAGE_ENDS.length - 1) return;
    const markTime = STAGE_ENDS[state.localStage];
    state.localStage += 1;
    $('.song-choices').dataset.stage = String(state.localStage);
    const audio = state.activeAudio;
    if (audio) {
      audio.pause();
      audio.currentTime = markTime;
    }
    cancelAnimationFrame(state.audioFrame);
    $$('.track-marks span').forEach((mark, index) => mark.classList.toggle('active', index <= state.localStage));
    $('.game-skip').disabled = state.localStage >= STAGE_ENDS.length - 1;
    $('.round-feedback').textContent = `Continuing to the ${STAGE_ENDS[state.localStage]} second mark.`;
    void playLocalSection(false, markTime);
  }

  function renderGame(room) {
    if (!room) return;
    state.room = room;
    enterGame();
    $('.round-result-backdrop').hidden = true;
    $('.winner-backdrop').hidden = true;
    updateScoreboard(room);
    const number = room.roundNumber || 1;
    const isNewRound = state.localRound !== number;
    if (isNewRound) {
      stopSyncedAudio();
      state.localRound = number;
      state.localStage = 0;
    }
    $('.game-round').textContent = String(number);
    $('.vinyl-stage p').textContent = `ROUND GENRE · ${(room.currentRound?.genre || room.genre || 'Everything').toUpperCase()}`;
    const stage = state.localStage;
    $$('.track-marks span').forEach((mark, index) => mark.classList.toggle('active', index <= stage));
    $('.game-skip').disabled = stage >= 4;
    const choicesContainer = $('.song-choices');
    if (Number(choicesContainer.dataset.stage || -1) !== stage) {
      choicesContainer.dataset.stage = String(stage);
      if (isNewRound) $('.track-line i').style.width = '0%';
    }
    if (room.currentRound) {
      window.updateDifficultyMeter?.(room.currentRound.difficulty || 'medium');
      activeRoundSong = [null, '', room.currentRound.artwork || '', room.currentRound.previewUrl || ''];
      const mine = room.players.find((player) => player.id === state.session?.playerId);
      const choices = room.currentRound.choices || [];
      const container = choicesContainer;
      const wasRound = Number(container.dataset.roundNumber || 0);
      const roundChanged = wasRound !== number;
      const renderChoices = container.dataset.renderedRound !== String(number);
      if (renderChoices) container.dataset.renderedRound = String(number);
      if (roundChanged) {
        container.dataset.roundNumber = String(number);
        container.classList.remove('locked', 'wrong-locked');
        $('.track-line i').style.width = '0%';
        $('.round-feedback').textContent = 'Choose quickly for the highest score.';
      }
      if (renderChoices) container.innerHTML = choices.map((choice, index) => `<button class="song-choice" data-choice-index="${index}" type="button"><span class="cover-art cover-${(number + index) % 4}" aria-hidden="true">♪</span><span class="song-title"><strong>${escapeHtml(choice.title)}</strong></span><i>${String.fromCharCode(65 + index)}</i></button>`).join('');
      if (renderChoices) choices.forEach((choice, index) => {
        const cover = container.querySelector(`[data-choice-index="${index}"] .cover-art`);
      if (cover && choice.artwork) {
        cover.style.backgroundImage = `url("${choice.artwork.replaceAll('"', '')}")`;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
      }
      });
      const disabled = !mine || mine.status !== 'playing';
      container.querySelectorAll('.song-choice').forEach((button) => { button.disabled = disabled; });
      $('.game-play').disabled = disabled;
      $('.game-skip').disabled = disabled || stage >= 4;
      if (mine?.status === 'wrong') {
        container.classList.add('wrong-locked');
        container.querySelectorAll('.song-choice').forEach((button) => button.classList.add('blackout'));
        $('.guess-status').textContent = 'Wrong guess · locked until next round';
      } else if (mine?.status === 'correct') {
        container.classList.add('locked');
        $('.guess-status').textContent = 'Correct · waiting for the others';
      } else {
        $('.guess-status').textContent = `${choices.length} choices`;
      }
      updateRoundTimer(room);
    }
  }

  function renderRoundEnd(room) {
    if (!room) return;
    renderGame(room);
    clearRoomTimer();
    stopSyncedAudio();
    const answer = room.revealedSong;
    if (answer) {
      $('#round-result-title').textContent = answer.title;
      $('.result-artist').textContent = answer.artist;
      const cover = $('.result-vinyl span');
      if (cover && answer.artwork) applySongArtwork(cover, { artworkUrl100: answer.artwork });
      $('.song-choice[data-choice-index="' + answer.answerIndex + '"]')?.classList.add('correct');
    }
    $('.continue-round').textContent = `Continue (${room.readyCount || 0}/${room.players.length})`;
    $('.continue-round').disabled = Boolean(room.players.find((player) => player.id === state.session?.playerId)?.continueReady);
    $('.round-result-backdrop').hidden = false;
    updateBreakTimer(room);
  }

  function renderWinner(room) {
    clearRoomTimer();
    stopSyncedAudio();
    enterGame();
    const winner = [...(room.players || [])].sort((a, b) => b.score - a.score)[0];
    $('#winner-title').textContent = winner ? `${winner.name} wins!` : 'Game complete';
    $('.winner-score').textContent = winner ? `Final score · ${winner.score} points` : '';
    $('.winner-backdrop').hidden = false;
    if (window.sprayNoteConfetti) window.sprayNoteConfetti({ winner: true });
  }

  function handleMessage(message) {
    if (message.type === 'error') {
      if (state.session?.host && state.room?.phase === 'lobby') {
        $('.game-view').hidden = true;
        $('main').hidden = false;
        $('.site-footer').hidden = false;
        $('.modal-backdrop').hidden = false;
        document.body.style.overflow = 'hidden';
      }
      showNotice(message.error, true);
      const launch = $('.launch-button');
      if (launch) launch.disabled = false;
      return;
    }
    const room = message.room;
    if (room) state.room = room;
    switch (message.type) {
      case 'lobby':
        renderLobby(room);
        break;
      case 'game':
        renderGame(room);
        break;
      case 'guess-result':
        if (message.playerId === state.session?.playerId) {
          if (message.correct) {
            if (window.sprayNoteConfetti) window.sprayNoteConfetti();
            $('.round-feedback').textContent = `Correct! +${message.points} points. Waiting for the others.`;
          } else {
            if (window.triggerWrongMark) window.triggerWrongMark();
            $('.round-feedback').textContent = 'Wrong guess · 5 points deducted. Choices are locked until the next round.';
          }
        }
        break;
      case 'round-ended':
        renderRoundEnd(room);
        break;
      case 'game-ended':
        renderWinner(room);
        break;
      case 'closed':
        showNotice('The host closed this room.', true);
        leaveRoom();
        break;
      case 'pong':
        break;
      default:
        break;
    }
  }

  async function prepareRounds() {
    const request = ++state.prepareRequest;
    usedRoundSongs.clear();
    const room = getRoomState();
    showNotice('Loading the song catalog?');
    activeCatalog = await loadGenreCatalog(room.genre || 'Everything');
    if (!Array.isArray(activeCatalog) || activeCatalog.length < 4) activeCatalog = roundSongs;
    const desiredDifficulty = room.difficulty || 'medium';
    const choiceCount = Math.max(4, Math.min(8, Number(room.choiceCount) || 4));
    const catalogs = await window.getRoundSongCatalogs?.(room.genre || 'Everything') || [{ name: room.genre || 'Everything', songs: activeCatalog }];
    const pools = catalogs.map(({ name, songs }) => ({
      name,
      songs: [...new Map(songs.filter((song) => window.getSongDifficulty?.(song) === desiredDifficulty)
        .map((song) => [`${song[0]}|${song[1]}`, song])).values()].sort(() => Math.random() - 0.5),
    }));
    const usedKeys = new Set();
    const rounds = [];
    for (let roundIndex = 0; roundIndex < ROUND_COUNT; roundIndex += 1) {
      if (request !== state.prepareRequest) throw new Error('Song preparation was cancelled.');
      const blocked = new Set();
      let selected = null;
      while (!selected) {
        const eligible = pools.filter((pool) => !blocked.has(pool.name) && pool.songs.filter((song) => !usedKeys.has(`${song[0]}|${song[1]}`)).length >= choiceCount).sort(() => Math.random() - 0.5);
        if (!eligible.length) break;
        const pool = eligible[0];
        const collected = [];
        const candidates = pool.songs.filter((song) => !usedKeys.has(`${song[0]}|${song[1]}`));
        for (let offset = 0; offset < candidates.length && collected.length < choiceCount; offset += 8) {
          if (request !== state.prepareRequest) throw new Error('Song preparation was cancelled.');
          const batch = candidates.slice(offset, offset + 8);
          const results = await Promise.all(batch.map(async (song) => ({ song, asset: await loadSongAsset(song) })));
          for (const { song, asset } of results) {
            if (!asset?.previewUrl) { unavailableSongs.add(`${song[0]}|${song[1]}`); continue; }
            song[3] = song[3] || asset.previewUrl;
            collected.push({ song, asset });
            if (collected.length >= choiceCount) break;
          }
          showNotice(`Preparing round ${roundIndex + 1}/${ROUND_COUNT} ? ${pool.name}`);
        }
        if (collected.length < choiceCount) { blocked.add(pool.name); continue; }
        const entries = collected.slice(0, choiceCount);
        entries.forEach(({ song }) => usedKeys.add(`${song[0]}|${song[1]}`));
        selected = { genre: pool.name, entries };
      }
      if (!selected) throw new Error(`Could not find ${choiceCount} playable ${desiredDifficulty} songs from one genre for round ${roundIndex + 1}. Try another difficulty or genre.`);
      const { genre, entries } = selected;
      const choiceRecords = entries.map(({ song, asset }) => ({ title: song[0], artwork: asset.artworkUrl100 || song[2] || '' }));
      const answerIndex = Math.floor(Math.random() * entries.length);
      const { song, asset } = entries[answerIndex];
      const answer = { title: song[0], artist: song[1], artwork: asset.artworkUrl100 || song[2] || '', previewUrl: song[3] || asset.previewUrl };
      rounds.push({ choices: choiceRecords, answerIndex, answer, difficulty: window.getSongDifficulty?.(song, asset) || 'medium', genre });
    }
    return rounds;
  }

  async function startGame() {
    if (!state.session?.host) return showNotice('Only the host can start the room.', true);
    const button = $('.launch-button');
    button.disabled = true;
    button.textContent = 'Preparing songs…';
    try {
      const rounds = await prepareRounds();
      if (state.socket?.readyState !== WebSocket.OPEN) throw new Error('The room connection was lost. Reconnect and try again.');
      closeModal();
      enterGame();
      $('.round-feedback').textContent = 'Starting the game…';
      send('start', { rounds });
    } catch (error) {
      showNotice(error.message, true);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Start the room <span>→</span>';
      if (state.room) renderLobby(state.room);
    }
  }

  function configureFromForm() {
    if (!state.session?.host || state.room?.phase !== 'lobby') return;
    clearTimeout(state.configureTimer);
    state.configureTimer = setTimeout(() => {
      const name = $('.host-name-input')?.value.trim();
      send('configure', currentSettings(name));
    }, 180);
  }

  function showJoinPage() {
    $('.join-page').hidden = false;
    $('.joined-room-panel').hidden = true;
    $('body').style.overflow = 'hidden';
    $('#player-name').focus();
  }

  function leaveRoom() {
    if (state.session && state.socket?.readyState === WebSocket.OPEN) send('leave');
    state.manuallyClosed = true;
    clearInterval(state.heartbeat);
    clearRoomTimer();
    clearTimeout(state.connectTimer);
    stopSyncedAudio();
    state.socket?.close();
    state.socket = null;
    state.room = null;
    sessionStore.clear();
    $('.winner-backdrop').hidden = true;
    $('.round-result-backdrop').hidden = true;
    $('.game-view').hidden = true;
    $('.modal-backdrop').hidden = true;
    $('.join-page').hidden = true;
    $('main').hidden = false;
    $('.site-footer').hidden = false;
    document.body.style.overflow = '';
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (!state.session && target.matches('.game-play, .game-skip, .song-choice, .continue-round')) return;

    if (target.matches('.mode-card[data-mode="Solo"]')) return;

    if (target.matches('.js-create-room, .mode-card')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const savedName = localStorage.getItem('sonora-profile-name') || '';
      const name = $('.host-name-input')?.value.trim() || savedName;
      if (state.session?.host && state.room?.phase === 'lobby') {
        if (document.body.dataset.roomPage !== 'true') {
          location.assign('room.html');
          return;
        }
        openSetup(name || state.room.players.find((player) => player.id === state.session.playerId)?.name || '');
        setRoomCode(state.session.code);
        if (state.socket?.readyState !== WebSocket.OPEN) connect();
        return;
      }
      if (state.session) leaveRoom();
      if (!name) {
        state.pendingHost = true;
        $('.name-gate').hidden = false;
        $('.name-gate-input').value = '';
        $('.name-gate-input').focus();
        return;
      }
      try { await createRoom(name); } catch (error) { showNotice(error.message, true); $('.modal-backdrop').hidden = false; }
      return;
    }

    if (target.matches('.name-gate-save') && state.pendingHost) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const name = $('.name-gate-input').value.trim();
      if (!name) { $('.name-gate-status').textContent = 'Enter a name to continue.'; return; }
      state.pendingHost = false;
      try { await createRoom(name); } catch (error) { $('.name-gate-status').textContent = error.message; }
      return;
    }

    if (target.matches('.js-join-room')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showJoinPage();
      return;
    }

    if (target.matches('.join-back')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.session) { leaveRoom(); return; }
      $('.join-page').hidden = true;
      document.body.style.overflow = '';
      return;
    }

    if (target.matches('.copy-code-button')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!state.session?.code) return showNotice('Create a room first.', true);
      const code = state.session.code;
      try { await navigator.clipboard.writeText(code); showNotice('Room code copied.'); }
      catch { showNotice(`Room code: ${code}`); }
      return;
    }

    if (target.matches('.copy-button')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!state.session?.code) return showNotice('Create a room first.', true);
      const link = new URL('index.html', location.href);
      link.searchParams.set('join', state.session.code);
      try { await navigator.clipboard.writeText(link.href); showNotice('Room link copied. Opening it lets your friends enter their name and join.'); }
      catch { showNotice(`Copy this room link: ${link.href}`, true); }
      return;
    }

    if (target.matches('.launch-button') && document.querySelector('.modal-backdrop').classList.contains('solo-setup')) return;

    if (target.matches('.launch-button')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await startGame();
      return;
    }

    if (target.matches('.game-play')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void playLocalSection();
      return;
    }

    if (target.matches('.game-skip')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      skipLocalClue();
      return;
    }

    if (target.matches('.song-choice')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      send('guess', { choiceIndex: Number(target.dataset.choiceIndex), stage: state.localStage });
      return;
    }

    if (target.matches('.continue-round')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      target.disabled = true;
      send('continue');
      return;
    }

    if (target.matches('.winner-exit') || target.matches('.game-exit')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      leaveRoom();
    }
  }, true);

  document.addEventListener('submit', async (event) => {
    if (!event.target.matches('.join-form')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const name = $('#player-name').value.trim();
    const code = $('#join-code').value.trim();
    if (!name) { $('.join-status').textContent = 'Add your name to join the room.'; $('.join-status').className = 'join-status error'; return; }
    if (!code) { $('.join-status').textContent = 'Enter the room code from your host.'; $('.join-status').className = 'join-status error'; return; }
    const button = $('.join-form .primary-button');
    button.disabled = true;
    try { await joinRoom(name, code); }
    catch (error) { $('.join-status').textContent = error.message; $('.join-status').className = 'join-status error'; button.disabled = false; }
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.matches('.host-name-input')) configureFromForm();
    if (event.target.matches('.game-view [aria-label="Volume"]') && state.activeAudio) state.activeAudio.volume = Number(event.target.value) / 100;
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.genre-option') || event.target.closest('.stepper-arrow') || event.target.closest('.difficulty-option')) configureFromForm();
  });

  const inviteCode = new URLSearchParams(location.search).get('join');
  if (inviteCode) {
    sessionStore.clear();
    $('#join-code').value = inviteCode.replace(/\D/g, '').slice(0, 7);
    history.replaceState(null, '', `${location.pathname}${location.hash}`);
    showJoinPage();
    if (!/^\d{7}$/.test($('#join-code').value)) {
      $('.join-status').textContent = 'This room link is invalid. Ask the host for a new link.';
      $('.join-status').className = 'join-status error';
    }
  }
  state.session = sessionStore.get();
  if (state.session) {
    setRoomCode(state.session.code);
    if (state.session.host) {
      $('.modal-backdrop').hidden = false;
      $('.modal-backdrop').classList.add('page-view');
      document.body.style.overflow = 'hidden';
    } else {
      $('.join-page').hidden = false;
      $('.join-form').querySelectorAll('input,button').forEach((element) => { element.disabled = true; });
      document.body.style.overflow = 'hidden';
    }
    connect();
  } else if (!inviteCode && document.body.dataset.roomPage === 'true') {
    let pendingRoom = null;
    try { pendingRoom = JSON.parse(sessionStorage.getItem(PENDING_ROOM_KEY) || 'null'); } catch {}
    if (!pendingRoom?.name || !pendingRoom?.settings) {
      location.replace('index.html');
    } else {
      openSetup(pendingRoom.name);
      void finishRoomCreation(pendingRoom.name, pendingRoom.settings).catch((error) => showNotice(error.message, true));
    }
  }
})();
