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
    pendingHostName: '',
    winnerShown: false,
    manuallyClosed: false,
    creatingRoom: false,
    activeAudio: null,
    audioFrame: 0,
    audioOperation: 0,
    localStage: 0,
    localRound: 0,
    prepareRequest: 0,
    timerKey: '',
    bombAudioKey: '',
    revealAudioKey: '',
    bombSearchRequest: 0,
    bombServerSuggestions: [],
    bombSearchTimer: 0,
    bombSubmitting: false,
    bombMessageKey: '',
    lastBombTurnKey: '',
    scoreboardKey: '',
    configureTimer: 0,
    startTimer: 0,
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
  window.reportRoomCatalogProgress = (message) => {
    if (state.session?.host && $('.launch-button')?.disabled) showNotice(message);
  };

  function setRoomCode(code) {
    const roomCode = String(code || '').trim();
    const label = $('.room-code');
    if (label) label.textContent = roomCode || '-------';
    const gateCode = $('.name-gate-code');
    if (gateCode) gateCode.textContent = roomCode || 'Generating…';
    const copyButton = $('.copy-code-button');
    if (copyButton) {
      copyButton.disabled = !roomCode;
      copyButton.title = roomCode ? 'Copy room code' : 'Create the room to get an invite code';
    }
    const input = $('#join-code');
    if (input && roomCode) input.placeholder = roomCode;
  }

  function openSetup(name) {
    const modal = $('.modal-backdrop');
    const hostName = $('.host-name-input');
    const nameGate = $('.name-gate');
    if (hostName) {
      hostName.value = name;
      hostName.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const launch = $('.launch-button');
    if (launch) launch.innerHTML = state.session?.host ? (window.getSelectedGameMode?.() === 'SongBomb' ? 'Start Song Bomb <span>&rarr;</span>' : 'Start Classic <span>&rarr;</span>') : 'Create room <span>&rarr;</span>';
    if (nameGate) nameGate.hidden = true;
    modal.hidden = false;
    modal.classList.add('page-view');
    document.body.style.overflow = 'hidden';
  }

  function currentSettings(name) {
    const saved = getRoomState();
    const playersLabel = $('.player-stepper strong')?.textContent || `${DEFAULT_MAX_PLAYERS} players`;
    const genre = $('.genre-option.selected')?.dataset.genre || saved.genre || 'Everything';
    return {
      name,
      mode: window.getSelectedGameMode?.() || null,
      maxPlayers: Number.parseInt(playersLabel, 10) || DEFAULT_MAX_PLAYERS,
      genre,
      difficulty: $('.difficulty-option.selected')?.dataset.difficulty || saved.difficulty || 'medium',
      choiceCount: Number.parseInt($('.choice-stepper strong')?.textContent, 10) || saved.choiceCount || 4,
      roundCount: Number.parseInt($('.rounds-stepper strong')?.textContent, 10) || saved.roundCount || 10,
      durationSeconds: Number.parseInt($('.duration-stepper strong')?.textContent, 10) || Number.parseInt(saved.time, 10) || 30,
    };
  }

  async function createRoom(name) {
    const mode = window.getSelectedGameMode?.();
    if (!mode) throw new Error('Choose a game mode before creating a room.');
    if (!['Quickfire', 'SongBomb'].includes(mode)) throw new Error('Solo play does not create a room.');
    // The room API requires a host name, so create with a temporary label and
    // ask for the real name as soon as the room and invite code exist.
    const settings = currentSettings(name || 'Host');
    settings.mode = mode;
    await finishRoomCreation(name, settings);
  }

  async function finishRoomCreation(name, settings) {
    if (state.creatingRoom) return;
    state.creatingRoom = true;
    const roomSettings = { ...settings, name: name || settings.name || 'Host' };
    try {
      const result = await api('/api/rooms', roomSettings);
      const code = result.code || result.room?.code;
      if (!code) throw new Error('The room was created, but no invite code was returned. Try again.');
      const finalName = name || state.pendingHostName;
      sessionStore.set({ code, playerId: result.playerId, token: result.token, host: true, mode: settings.mode || null });
      sessionStorage.removeItem(PENDING_ROOM_KEY);
      setRoomCode(code);
      openSetup(finalName || '');
      showNotice('Room created. Copy the code to invite players.');
      connect();
      if (!finalName) {
        state.pendingHost = true;
        $('.name-gate').hidden = false;
        $('.name-gate-save').disabled = false;
        $('.name-gate-input').focus();
      } else {
        state.pendingHost = false;
        state.pendingHostName = '';
      }
    } finally {
      state.creatingRoom = false;
    }
  }

  window.createRoomFromModeButton = () => {
    if (state.creatingRoom) return;
    if (state.session?.host && state.room?.phase === 'lobby') {
      const host = state.room.players?.find((player) => player.id === state.session.playerId);
      openSetup(host?.name || $('.host-name-input')?.value || '');
      setRoomCode(state.session.code);
      return;
    }
    if (state.session) leaveRoom();
    const name = localStorage.getItem('sonora-profile-name') || $('.host-name-input')?.value.trim() || '';
    state.pendingHostName = '';
    state.pendingHost = !name;
    window.selectQuickfireModeForHost?.();
    window.selectSetupGenre?.('Everything');
    openSetup(name);
    const launch = $('.launch-button');
    if (!name) {
      state.pendingHost = true;
      $('.name-gate-status').textContent = '';
      $('.name-gate-input').value = '';
      $('.name-gate-save').disabled = false;
      $('.name-gate').hidden = false;
      $('.name-gate-input').focus();
    }
    if (launch) {
      launch.disabled = true;
      launch.textContent = 'Creating room…';
    }
    showNotice('Creating your room and invite code…');
    void finishRoomCreation(name, currentSettings(name)).catch((error) => {
      showNotice(error.message, true);
      if ($('.name-gate-code')) $('.name-gate-code').textContent = 'Unavailable';
      if (!name) state.pendingHost = true;
      if (launch) {
        launch.disabled = false;
        launch.innerHTML = window.getSelectedGameMode?.() === 'SongBomb' ? 'Start Song Bomb <span>→</span>' : 'Start Classic <span>→</span>';
      }
    });
  };

  async function joinRoom(name, code) {
    const cleanCode = code.trim().replace(/\D/g, '').slice(0, 7);
    if (!/^\d{7}$/.test(cleanCode)) throw new Error('Enter the full 7 digit room code.');
    const result = await api(`/api/rooms/${encodeURIComponent(cleanCode)}/join`, { name });
    sessionStore.set({ code: result.code, playerId: result.playerId, token: result.token, host: false });
    state.room = result.room;
    $('.joined-room-panel').hidden = false;
    setRoomCode(result.code);
    const form = $('.join-form');
    $('#player-name').disabled = false;
    $('#join-code').disabled = true;
    const saveNameButton = form.querySelector('button[type="submit"]');
    saveNameButton.disabled = false;
    saveNameButton.innerHTML = 'Save name <span>→</span>';
    $('.join-status').textContent = 'Joined. You can edit your name while waiting.';
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
      const hostName = $('.host-name-input')?.value.trim();
      if (state.session?.host && hostName) send('configure', currentSettings(hostName));
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

  function enterGame(mode = 'Classic') {
    $('.modal-backdrop').hidden = true;
    $('.name-gate').hidden = true;
    $('.join-page').hidden = true;
    $('main').hidden = true;
    $('.site-footer').hidden = true;
    $$('.info-page').forEach((page) => { page.hidden = true; });
    const isSongBomb = mode === 'SongBomb';
    $('.game-view').hidden = isSongBomb;
    $('.song-bomb-panel').hidden = !isSongBomb;
    window.setSongBombVolumePlacement?.(isSongBomb);
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
    if (hostSettings.length >= 7) {
      hostSettings[0].textContent = room.mode === 'SongBomb' ? 'Song Bomb' : 'Classic';
      hostSettings[1].textContent = `${room.maxPlayers} max`;
      hostSettings[2].textContent = room.genre;
      hostSettings[3].textContent = `${room.durationSeconds || 30} sec`;
      hostSettings[4].textContent = (room.difficulty || 'medium').replace(/^./, (letter) => letter.toUpperCase());
      hostSettings[5].textContent = `${room.choiceCount || 4} choices`;
      hostSettings[6].textContent = `${room.roundCount || 10}`;
    }
    if (state.session?.host) {
      const playerStepper = $('.player-stepper strong');
      if (playerStepper) playerStepper.textContent = `${room.maxPlayers} players`;
      const durationStepper = $('.duration-stepper strong');
      if (durationStepper) durationStepper.textContent = `${room.durationSeconds || 30} seconds`;
      const choiceStepper = $('.choice-stepper strong');
      if (choiceStepper) choiceStepper.textContent = `${room.choiceCount || 4} choices`;
      const roundsStepper = $('.rounds-stepper strong');
      if (roundsStepper) roundsStepper.textContent = `${room.roundCount || 10} rounds`;
    }
    const listMarkup = players.map((player, index) => `<div class="joined-player"><span class="joined-avatar ${index === 0 ? 'avatar-yellow' : 'avatar-blue'}">${escapeHtml(player.name.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(player.name)}</strong><small>${index === 0 ? 'Host' : 'Joined'}${player.connected ? '' : ' · reconnecting'}</small></span>${state.session?.playerId === room.hostId && player.id !== room.hostId ? `<button class="kick-player" type="button" data-player-id="${escapeHtml(player.id)}" aria-label="Kick ${escapeHtml(player.name)} from lobby" title="Kick from lobby">×</button>` : `<i>${index === 0 ? '★' : '✓'}</i>`}</div>`).join('');
    const free = Math.max(0, room.maxPlayers - players.length);
    const waitingMarkup = free ? `<div class="joined-player waiting"><span class="joined-avatar">+</span><span><strong>Waiting for players</strong><small>${free} spot${free === 1 ? '' : 's'} open</small></span></div>` : '';
    const combined = listMarkup + waitingMarkup;
    const roster = $('.joined-list');
    const joinRoster = $('.joined-room-list');
    if (roster) roster.innerHTML = combined;
    if (joinRoster) joinRoster.innerHTML = combined;
    const joinPanel = $('.joined-room-panel');
    if (joinPanel) joinPanel.hidden = false;
    if (state.session && !state.session.host) {
      $('#player-name').disabled = room.phase !== 'lobby';
      $('#join-code').disabled = true;
      const saveNameButton = $('.join-form button[type="submit"]');
      if (saveNameButton) {
        saveNameButton.disabled = room.phase !== 'lobby';
        saveNameButton.innerHTML = room.phase === 'lobby' ? 'Save name <span>→</span>' : 'Match in progress';
      }
    }
    const launch = $('.launch-button');
    if (launch) {
      launch.disabled = !state.session?.host || room.phase !== 'lobby' || !window.getSelectedGameMode?.();
      launch.setAttribute('aria-disabled', String(launch.disabled));
      launch.title = launch.disabled ? 'Only the host can start the room' : room.mode === 'SongBomb' ? 'Start Song Bomb' : 'Start Classic';
    }
    if (state.session?.host && room.phase === 'lobby') {
      const settings = currentSettings($('.host-name-input')?.value.trim());
      const host = players.find((player) => player.id === state.session.playerId);
      if (host && (settings.name !== host.name || settings.mode !== room.mode || settings.maxPlayers !== room.maxPlayers || settings.genre !== room.genre || settings.difficulty !== (room.difficulty || 'medium') || settings.choiceCount !== (room.choiceCount || 4) || settings.roundCount !== (room.roundCount || 10) || settings.durationSeconds !== room.durationSeconds)) send('configure', settings);
    }
    window.refreshSetupLanguage?.();
  }

  function updateScoreboard(room) {
    const list = $('.score-list');
    if (!list) return;
    const players = [...(room.players || [])]
      .sort((a, b) => b.score - a.score);
    const key = players.map((player) => `${player.id}:${player.name}:${player.score}:${player.connected}`).join('|');
    if (key === state.scoreboardKey) return;
    state.scoreboardKey = key;
    list.innerHTML = players
      .map((player, index) => `<div class="score-row${player.connected ? '' : ' is-disconnected'}"><span>0${index + 1}</span><strong>${escapeHtml(player.name)}</strong><b>${player.score}</b></div>`)
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
    state.bombAudioKey = '';
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
    enterGame(room.mode || 'Classic');
    $('.game-layout').hidden = false;
    const roundNumber = Math.max(1, Number(room.roundNumber) || 1);
    const roundCount = Math.max(1, Number(room.roundCount) || 10);
    const topbar = $('.game-topbar>span');
    if (topbar) topbar.innerHTML = `ROUND <strong class="game-round">${roundNumber}</strong> / ${roundCount}`;
    $('.round-result-backdrop').hidden = true;
    $('.winner-backdrop').hidden = true;
    updateScoreboard(room);
    const number = room.roundNumber || 1;
    const isNewRound = state.localRound !== number;
    if (isNewRound) {
      stopSyncedAudio();
      state.revealAudioKey = '';
      state.localRound = number;
      state.localStage = 0;
    }
    const roundLabel = $('.game-round');
    if (roundLabel) roundLabel.textContent = String(number);
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
      if (renderChoices) container.innerHTML = choices.map((choice, index) => `<button class="song-choice" data-choice-index="${index}" type="button"><span class="cover-art cover-${(number + index) % 4}" aria-hidden="true">♪</span><span class="song-title"><strong>${escapeHtml(choice.title)}</strong>${choice.subtitle && (room.currentRound?.genre || room.genre) !== 'Vocaloid' ? `<small class="song-title-subtitle">${escapeHtml(choice.subtitle)}</small>` : ''}${choice.anime ? `<small class="song-origin">From ${escapeHtml(choice.anime)}</small>` : ''}</span><i>${String.fromCharCode(65 + index)}</i></button>`).join('');
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
        container.querySelectorAll('.song-choice').forEach((button) => button.classList.add('dimmed'));
        $('.guess-status').textContent = 'Wrong guess · waiting for other players';
      } else if (mine?.status === 'correct') {
        container.classList.add('locked');
        container.querySelectorAll('.song-choice').forEach((button) => button.classList.add('dimmed'));
        $('.guess-status').textContent = 'Correct · waiting for the others';
      } else {
        $('.guess-status').textContent = `${choices.length} choices`;
      }
      updateRoundTimer(room);
    }
  }

  function renderSongBomb(room) {
    if (!room?.bomb) return;
    state.room = room;
    enterGame('SongBomb');
    clearRoomTimer();
    $('.round-result-backdrop').hidden = true;
    $('.winner-backdrop').hidden = true;
    $('.bomb-topbar>span').textContent = 'SONG BOMB';
    const bomb = room.bomb;
    const activePlayer = room.players.find((player) => player.id === bomb.turnPlayerId);
    const me = room.players.find((player) => player.id === state.session?.playerId);
    const isMyTurn = Boolean(me && !me.eliminated && me.id === bomb.turnPlayerId);
    const lives = Math.max(0, Number(me?.lives) || 0);
    $('.bomb-lives').textContent = me?.eliminated ? 'You are out' : `Your lives: ${'♥'.repeat(lives)}${'♡'.repeat(Math.max(0, 3 - lives))}`;
    $('.bomb-turn-status').textContent = isMyTurn ? 'Your turn — name the song or artist!' : `${activePlayer?.name || 'A player'} has the bomb`;
    const input = $('#bomb-song-input');
    const turnKey = `${bomb.turnNumber}:${bomb.turnPlayerId}`;
    const priorTurnNumber = Number(String(state.lastBombTurnKey || '').split(':')[0]) || 0;
    if (state.lastBombTurnKey !== turnKey) {
      state.lastBombTurnKey = turnKey;
      state.bombSubmitting = false;
      input.value = '';
      $('.bomb-suggestions').replaceChildren();
    }
    input.disabled = !isMyTurn || state.bombSubmitting;
    $('.bomb-submit').disabled = !isMyTurn || state.bombSubmitting;
    $('.bomb-skip').disabled = !isMyTurn || state.bombSubmitting;
    input.placeholder = isMyTurn ? 'Type a song name or artist…' : 'Waiting for your turn…';
    const bombLog = room.bombLog || [];
    renderBombLog(bombLog);
    const latestLog = bombLog[bombLog.length - 1];
    const resultKey = latestLog ? `${latestLog.turnNumber}:${latestLog.playerId}:${latestLog.result}` : '';
    if (resultKey && resultKey !== state.bombMessageKey) {
      state.bombMessageKey = resultKey;
      if (latestLog.result === 'timeout' && latestLog.turnNumber === priorTurnNumber) triggerBombExplosion();
    }
    const arena = $('.bomb-arena');
    const seats = $('.bomb-seats');
    seats.replaceChildren();
    const radius = Math.min(arena.clientWidth, arena.clientHeight) * 0.39;
    room.players.forEach((player, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / room.players.length;
      const x = arena.clientWidth / 2 + Math.cos(angle) * radius;
      const y = arena.clientHeight / 2 + Math.sin(angle) * radius;
      const seat = document.createElement('div');
      seat.className = `bomb-player${player.id === bomb.turnPlayerId ? ' is-turn' : ''}${player.eliminated ? ' is-eliminated' : ''}`;
      seat.style.left = `${x}px`;
      seat.style.top = `${y}px`;
      seat.innerHTML = `<span class="bomb-avatar">${escapeHtml(player.name.slice(0, 1).toUpperCase())}</span><strong class="bomb-player-name">${escapeHtml(player.name)}</strong><small class="bomb-player-lives">${'♥'.repeat(Math.max(0, player.lives || 0))}${'♡'.repeat(Math.max(0, 3 - (player.lives || 0)))}</small>`;
      seats.appendChild(seat);
      if (player.id === bomb.turnPlayerId) {
        const pointer = $('.bomb-pointer');
        const pointerRadius = radius * 0.63;
        pointer.style.left = `${arena.clientWidth / 2 + Math.cos(angle) * pointerRadius}px`;
        pointer.style.top = `${arena.clientHeight / 2 + Math.sin(angle) * pointerRadius}px`;
        pointer.style.transform = `translate(-50%, -50%) rotate(${angle * 180 / Math.PI}deg)`;
      }
    });
    const audioUrl = room.currentRound?.previewUrl;
    const audioKey = `${bomb.turnNumber}:${audioUrl || ''}`;
    if (audioUrl && audioKey !== state.bombAudioKey) {
      stopSyncedAudio();
      state.bombAudioKey = audioKey;
      state.activeAudio = new Audio(audioUrl);
      state.activeAudio.preload = 'auto';
      state.activeAudio.volume = Number($('.song-bomb-panel [aria-label="Volume"]')?.value || 65) / 100;
      $('.bomb-audio-status').textContent = 'Starting song preview…';
      state.activeAudio.play().then(() => {
        if (state.bombAudioKey === audioKey) $('.bomb-audio-status').textContent = 'Song preview playing';
      }).catch(() => {
        if (state.bombAudioKey === audioKey) $('.bomb-audio-status').textContent = 'Song preview could not start';
      });
    }
    updateTimer(bomb.turnEndsAt, '.bomb-timer', `bomb:${bomb.turnNumber}:${bomb.turnEndsAt}`);
  }

  function renderBombLog(log) {
    const container = $('.bomb-log');
    if (!container) return;
    const existing = new Map([...container.children].map((line) => [line.dataset.eventKey, line]));
    const eventKeys = new Set(log.map((entry) => `${entry.turnNumber}:${entry.playerId}:${entry.result}`));
    let changed = false;
    for (const [key, line] of existing) {
      if (!eventKeys.has(key)) {
        line.remove();
        existing.delete(key);
        changed = true;
      }
    }
    log.forEach((entry, index) => {
      const key = `${entry.turnNumber}:${entry.playerId}:${entry.result}`;
      let line = existing.get(key);
      if (!line) {
        line = document.createElement('p');
        line.dataset.eventKey = key;
        container.appendChild(line);
        changed = true;
      }
      line.className = `bomb-log-entry${entry.result === 'correct' ? ' is-correct' : ''}${index === log.length - 1 ? ' is-latest' : ''}`;
      if (entry.result === 'wrong' || entry.result === 'timeout' || entry.result === 'skip') {
        const prefix = entry.result === 'wrong'
          ? `${entry.name} guessed incorrectly and lost a life. Answer:`
          : entry.result === 'timeout'
            ? `${entry.name} ran out of time and lost a life. Answer:`
            : `${entry.name} skipped their turn and lost a life. Answer:`;
        line.replaceChildren(document.createTextNode(prefix));
        if (entry.answerTitle) {
          line.appendChild(document.createTextNode(' '));
          const answer = document.createElement('strong');
          answer.className = 'bomb-log-answer';
          answer.textContent = entry.answerTitle;
          line.appendChild(answer);
          if (entry.answerSubtitle) {
            const subtitle = document.createElement('small');
            subtitle.className = 'song-title-subtitle';
            subtitle.textContent = entry.answerSubtitle;
            line.appendChild(subtitle);
          }
        }
      } else {
        line.textContent = entry.result === 'correct'
          ? `${entry.name} guessed correctly. The bomb passed on.`
          : `${entry.name} lost a life.`;
      }
      line.style.setProperty('--entry-opacity', String(Math.max(0.12, 0.9 - (log.length - 1 - index) * 0.22)));
    });
    if (changed) container.scrollTop = container.scrollHeight;
  }

  function triggerBombExplosion() {
    const core = $('.bomb-core');
    if (!core) return;
    const rect = core.getBoundingClientRect();
    const explosion = document.createElement('div');
    explosion.className = 'bomb-explosion';
    explosion.setAttribute('aria-hidden', 'true');
    explosion.style.left = `${rect.left + rect.width / 2}px`;
    explosion.style.top = `${rect.top + rect.height / 2}px`;
    for (let index = 0; index < 14; index += 1) {
      const spark = document.createElement('i');
      spark.style.setProperty('--spark-angle', `${index * (360 / 14)}deg`);
      spark.style.setProperty('--spark-distance', `${72 + Math.random() * 72}px`);
      explosion.appendChild(spark);
    }
    document.body.appendChild(explosion);
    setTimeout(() => explosion.remove(), 950);
  }

  function renderRoundEnd(room) {
    if (!room) return;
    renderGame(room);
    clearRoomTimer();
    const answer = room.revealedSong;
    if (answer) {
      $('#round-result-title').textContent = answer.title;
      $('#round-result-subtitle').textContent = answer.subtitle || '';
      $('.result-artist').textContent = answer.artist;
      const cover = $('.result-vinyl span');
      if (cover && answer.artwork) applySongArtwork(cover, { artworkUrl100: answer.artwork });
      $('.song-choice[data-choice-index="' + answer.answerIndex + '"]')?.classList.add('correct');
    }
    const revealKey = `${room.roundNumber}:${answer?.previewUrl || ''}`;
    if (answer?.previewUrl && revealKey !== state.revealAudioKey) {
      stopSyncedAudio();
      state.revealAudioKey = revealKey;
      state.activeAudio = new Audio(answer.previewUrl);
      state.activeAudio.preload = 'auto';
      state.activeAudio.volume = Number($('.game-view [aria-label="Volume"]')?.value || 65) / 100;
      void state.activeAudio.play().catch(() => {});
    }
    const mine = room.players.find((player) => player.id === state.session?.playerId);
    const guessedCorrectly = mine?.status === 'correct';
    const playerResult = $('.result-player-status');
    playerResult.textContent = guessedCorrectly ? 'You guessed correctly' : 'You’re incorrect';
    playerResult.className = `result-player-status ${guessedCorrectly ? 'is-correct' : 'is-incorrect'}`;
    const connectedPlayers = room.players.filter((player) => player.connected).length;
    const continueNeeded = Math.max(1, Math.ceil(connectedPlayers / 2));
    $('.continue-round').textContent = `Continue (${room.readyCount || 0}/${continueNeeded})`;
    $('.continue-round').disabled = Boolean(room.players.find((player) => player.id === state.session?.playerId)?.continueReady);
    $('.round-result-backdrop').hidden = false;
    updateBreakTimer(room);
  }

  const bombArtistNameCache = new Map();

  async function getEnglishBombArtist(song) {
    const artistName = String(song.artistName || '');
    if (!/[\u3040-\u30ff\u3400-\u9fff]/u.test(artistName)) return artistName;
    const cacheKey = String(song.trackId || `${song.trackName}|${artistName}`);
    if (bombArtistNameCache.has(cacheKey)) return bombArtistNameCache.get(cacheKey);
    const lookup = (async () => {
      const isEnglish = (value) => value && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
      const titleKey = String(song.trackName || '').normalize('NFKC').toLocaleLowerCase();
      try {
        if (song.trackId) {
          const response = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(song.trackId)}&entity=song&country=US`, { signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            const data = await response.json();
            const match = (data.results || []).find((track) => track.trackId === song.trackId) || data.results?.[0];
            if (isEnglish(match?.artistName)) return match.artistName;
          }
        }
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(song.trackName)}&entity=song&country=US&limit=50`, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          const match = (data.results || []).find((track) => String(track.trackName || '').normalize('NFKC').toLocaleLowerCase() === titleKey && isEnglish(track.artistName));
          if (match) return match.artistName;
        }
      } catch {}
      return artistName;
    })();
    bombArtistNameCache.set(cacheKey, lookup);
    const resolved = await lookup;
    bombArtistNameCache.set(cacheKey, resolved);
    return resolved;
  }

  function searchBombSuggestions(query) {
    clearTimeout(state.bombSearchTimer);
    const list = $('.bomb-suggestions');
    const value = query.trim();
    const request = ++state.bombSearchRequest;
    state.bombServerSuggestions = [];
    if (value.length < (/[\u3040-\u30ff\u3400-\u9fff]/u.test(value) ? 1 : 2)) { list.replaceChildren(); return; }
    list.innerHTML = '<p class="bomb-suggestions-hint">Searching songs…</p>';
    state.bombSearchTimer = setTimeout(async () => {
      send('bomb-search', { query: value, requestId: request });
      const genre = state.room?.genre || '';
      const country = genre === 'Thai songs' ? 'TH' : genre === 'J-Pop' || genre === 'Vocaloid' || genre === 'Anime' || genre.startsWith('Anime ') ? 'JP' : 'US';
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(value)}&entity=song&country=${country}&limit=50`;
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const data = response.ok ? await response.json() : { results: [] };
        if (request !== state.bombSearchRequest || value !== $('#bomb-song-input').value.trim()) return;
        const results = (data.results || []).filter((song) => song.trackName && song.artistName).slice(0, 12);
        const suggestions = await Promise.all(results.map(async (song) => ({ song, artist: await getEnglishBombArtist(song) })));
        if (request !== state.bombSearchRequest || value !== $('#bomb-song-input').value.trim()) return;
        renderBombSuggestionList(suggestions, request);
      } catch {
        if (request === state.bombSearchRequest) renderBombSuggestionList([], request);
      }
    }, 220);
  }

  function renderBombSuggestionList(externalSuggestions, request) {
    if (request !== state.bombSearchRequest) return;
    const list = $('.bomb-suggestions');
    const combined = [...state.bombServerSuggestions.map((song) => ({ song, artist: song.artist })), ...externalSuggestions];
    const seen = new Set();
    const unique = combined.filter(({ song, artist }) => {
      const key = `${String(song.title || song.trackName).toLocaleLowerCase()}|${String(artist).toLocaleLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
    list.innerHTML = unique.length ? unique.map(({ song, artist }) => {
      const title = song.title || song.trackName;
      return `<button class="bomb-suggestion" type="button" role="option" data-title="${escapeHtml(title)}" data-artist="${escapeHtml(artist)}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(artist)}</small></button>`;
    }).join('') : '<p class="bomb-suggestions-hint">No matching songs found.</p>';
  }

  function submitBombGuess(guess, title = '', artist = '') {
    if (state.bombSubmitting || state.room?.phase !== 'bomb') return;
    state.bombSubmitting = true;
    const sent = send('bomb-guess', { guess, title, artist });
    if (sent) {
      $('.bomb-submit').disabled = true;
      $('#bomb-song-input').disabled = true;
      $('.bomb-suggestions').replaceChildren();
    } else state.bombSubmitting = false;
  }

  function skipBombTurn() {
    if (state.bombSubmitting || state.room?.phase !== 'bomb') return;
    state.bombSubmitting = true;
    if (send('bomb-skip')) {
      $('.bomb-submit').disabled = true;
      $('.bomb-skip').disabled = true;
      $('#bomb-song-input').disabled = true;
      $('.bomb-suggestions').replaceChildren();
    } else state.bombSubmitting = false;
  }

  function renderWinner(room) {
    if (state.winnerShown) return;
    state.winnerShown = true;
    clearRoomTimer();
    stopSyncedAudio();
    enterGame(room.mode || 'Classic');
    if (room.mode === 'SongBomb') renderBombLog(room.bombLog || []);
    const latestBombEvent = room.mode === 'SongBomb' ? room.bombLog?.[room.bombLog.length - 1] : null;
    if (latestBombEvent?.result === 'timeout') {
      const resultKey = `${latestBombEvent.turnNumber}:${latestBombEvent.playerId}:${latestBombEvent.result}`;
      if (state.bombMessageKey !== resultKey) {
        state.bombMessageKey = resultKey;
        triggerBombExplosion();
      }
    }
    const winner = room.winner || [...(room.players || [])].sort((a, b) => b.score - a.score)[0];
    $('#winner-title').textContent = winner ? `${winner.name} wins!` : 'Game complete';
    $('.winner-score').textContent = winner ? (room.mode === 'SongBomb' ? `Last player standing \u00b7 ${winner.lives} lives left` : `Final score \u00b7 ${winner.score} points`) : '';
    $('.winner-backdrop').hidden = false;
    if (window.sprayNoteConfetti) window.sprayNoteConfetti({ winner: true });
  }

  function handleMessage(message) {
    if (message.type === 'bomb-suggestions') {
      const request = Number(message.requestId) || 0;
      const query = $('#bomb-song-input')?.value.trim() || '';
      if (request === state.bombSearchRequest && query.length >= (/[\u3040-\u30ff\u3400-\u9fff]/u.test(query) ? 1 : 2)) {
        state.bombServerSuggestions = Array.isArray(message.suggestions) ? message.suggestions : [];
        renderBombSuggestionList([], request);
      }
      return;
    }
    if (message.type === 'error') {
      clearTimeout(state.startTimer);
      state.startTimer = 0;
      if (state.session && !state.session.host) {
        $('.join-status').textContent = message.error;
        $('.join-status').className = 'join-status error';
        return;
      }
      if (state.session?.host && state.room?.phase === 'lobby') {
        $('.game-view').hidden = true;
        $('.song-bomb-panel').hidden = true;
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
    if (room) {
      state.room = room;
      if (state.session) {
        const wasHost = Boolean(state.session.host);
        const isHost = room.hostId === state.session.playerId;
        if (wasHost !== isHost) {
          sessionStore.set({ ...state.session, host: isHost });
          if (isHost && room.phase === 'lobby') {
            const promotedPlayer = room.players?.find((player) => player.id === state.session.playerId);
            $('.join-page').hidden = true;
            $('main').hidden = false;
            $('.site-footer').hidden = false;
            window.selectQuickfireModeForHost?.(room.mode);
            openSetup(promotedPlayer?.name || $('.host-name-input')?.value || '');
            setRoomCode(room.code);
          }
        }
      }
    }
    switch (message.type) {
      case 'lobby':
        // A lobby transition can mean the host is starting a fresh match in
        // this same room. Clear round render caches so round 1 is initialized
        // again instead of retaining the previous match's "Starting" state.
        state.localRound = 0;
        state.localStage = 0;
        state.timerKey = '';
        const choices = $('.song-choices');
        if (choices) {
          choices.dataset.renderedRound = '';
          choices.dataset.roundNumber = '0';
          choices.dataset.stage = '-1';
          choices.classList.remove('locked', 'wrong-locked');
        }
        if (state.winnerShown && !state.session?.host) {
          state.winnerShown = false;
          $('.winner-backdrop').hidden = true;
          $('.round-result-backdrop').hidden = true;
          $('.game-view').hidden = true;
          showJoinPage();
          $('.joined-room-panel').hidden = false;
        }
        renderLobby(room);
        break;
      case 'game':
        clearTimeout(state.startTimer);
        state.startTimer = 0;
        state.winnerShown = false;
        renderGame(room);
        break;
      case 'bomb':
        state.winnerShown = false;
        renderSongBomb(room);
        break;
      case 'bomb-result':
        break;
      case 'guess-result':
        if (message.playerId === state.session?.playerId) {
          if (message.correct) {
            if (window.sprayNoteConfetti) window.sprayNoteConfetti();
            $('.round-feedback').textContent = `Correct! +${message.points} points. Waiting for the other players.`;
          } else {
            if (window.triggerWrongMark) window.triggerWrongMark();
            $('.round-feedback').textContent = 'Wrong guess · 5 points deducted. Waiting for the other players…';
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
      case 'kicked':
        leaveRoom({ kicked: true });
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
    const desiredDifficulty = room.difficulty || 'medium';
    const choiceCount = Math.max(4, Math.min(8, Number(room.choiceCount) || 4));
    const roundCount = Math.max(1, Math.min(50, Number(room.roundCount) || ROUND_COUNT));
    const selectedGenre = room.genre || 'Everything';
    showNotice('Preparing playable songs…');
    const catalogs = await window.getRoomStartupCatalogs?.(selectedGenre, roundCount * choiceCount, desiredDifficulty)
      || await window.getRoundSongCatalogs?.(selectedGenre)
      || [{ name: selectedGenre, songs: activeCatalog }];
    activeCatalog = catalogs.flatMap((pool) => pool.songs || []);
    const pools = catalogs.map(({ name, songs }) => ({
      name,
      songs: [...new Map(songs.filter((song) => window.getSongDifficulty?.(song) === desiredDifficulty)
        .map((song) => [`${song[0]}|${song[1]}`, song])).values()].sort(() => Math.random() - 0.5),
    }));
    const usedKeys = new Set();
    const rounds = [];
    const vocaloidAnswerEntries = [];
    for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
      if (request !== state.prepareRequest) throw new Error('Song preparation was cancelled.');
      showNotice(`Preparing round ${roundIndex + 1} of ${roundCount}…`);
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
          showNotice(`Preparing round ${roundIndex + 1} of ${roundCount} · ${pool.name}`);
        }
        if (collected.length < choiceCount) { blocked.add(pool.name); continue; }
        const entries = collected.slice(0, choiceCount);
        entries.forEach(({ song }) => usedKeys.add(`${song[0]}|${song[1]}`));
        selected = { genre: pool.name, entries };
      }
      if (!selected) throw new Error(`Could not find ${choiceCount} playable ${desiredDifficulty} songs from one genre for round ${roundIndex + 1}. Try another difficulty or genre.`);
      const { genre, entries } = selected;
      const choiceRecords = entries.map(({ song, asset }) => {
        const choice = { title: song[0], artwork: asset.artworkUrl100 || song[2] || '', anime: song[6] || '', subtitle: genre === 'Vocaloid' ? '' : (window.getJPopSubtitle?.(song, genre) || '') };
        return choice;
      });
      const answerIndex = Math.floor(Math.random() * entries.length);
      const { song, asset } = entries[answerIndex];
      const answer = { title: song[0], artist: song[1], subtitle: choiceRecords[answerIndex].subtitle || '', artwork: asset.artworkUrl100 || song[2] || '', previewUrl: song[3] || asset.previewUrl };
      if (genre === 'Vocaloid') vocaloidAnswerEntries.push({ song, answer });
      rounds.push({ choices: choiceRecords, answerIndex, answer, difficulty: window.getSongDifficulty?.(song, asset) || 'medium', genre });
    }
    if (vocaloidAnswerEntries.length) {
      showNotice(`Finishing Vocaloid titles for ${roundCount} rounds…`);
      await Promise.all(vocaloidAnswerEntries.map(async ({ song, answer }) => {
        answer.subtitle = await window.resolveVocaloidTitleSubtitle?.(song) || window.getVocaloidTitleSubtitle?.(song) || '';
      }));
    }
    return rounds;
  }

  async function prepareBombSongs() {
    const request = ++state.prepareRequest;
    usedRoundSongs.clear();
    const settings = getRoomState();
    const difficulty = settings.difficulty || 'medium';
    const genre = settings.genre || 'Everything';
    const catalogs = window.getRoomStartupCatalogs
      ? await window.getRoomStartupCatalogs(genre, 4, difficulty)
      : await window.getCachedRoundSongCatalogs?.(genre) || await window.getRoundSongCatalogs?.(genre) || [{ name: genre, songs: activeCatalog }];
    activeCatalog = catalogs.flatMap(({ songs }) => songs || []);
    const candidates = [...new Map(catalogs.flatMap(({ songs }) => songs || [])
      .filter((song) => song?.[3] && window.getSongDifficulty?.(song) === difficulty)
      .map((song) => [`${song[0]}|${song[1]}`, song])).values()].sort(() => Math.random() - 0.5);
    const songs = [];
    for (let offset = 0; offset < candidates.length && songs.length < 100; offset += 12) {
      if (request !== state.prepareRequest) throw new Error('Song preparation was cancelled.');
      const batch = candidates.slice(offset, offset + 12);
      const results = await Promise.all(batch.map(async (song) => ({ song, asset: await loadSongAsset(song) })));
      for (const { song, asset } of results) {
        const previewUrl = song[3] || asset?.previewUrl;
        if (!previewUrl || !asset?.previewUrl) continue;
        songs.push({ title: song[0], artist: song[1], artwork: asset.artworkUrl100 || song[2] || '', previewUrl, sourceSong: song });
        if (songs.length >= 100) break;
      }
      showNotice(`Preparing Song Bomb songs… ${Math.min(songs.length, 100)}/100`);
    }
    if (songs.length < 4) throw new Error('Could not prepare enough playable songs. Try another genre or difficulty.');
    if (settings.genre === 'Vocaloid') {
      songs.forEach((item) => {
        item.subtitle = window.getVocaloidTitleSubtitle?.(item.sourceSong) || '';
        delete item.sourceSong;
      });
    } else {
      songs.forEach((item) => { delete item.sourceSong; });
    }
    return songs;
  }

  async function startGame() {
    if (!state.session?.host) return showNotice('Only the host can start the room.', true);
    if (!window.getSelectedGameMode?.()) return showNotice('Choose a game mode on the home page before starting.', true);
    const button = $('.launch-button');
    let showingGameStart = false;
    button.disabled = true;
    button.textContent = window.getSelectedGameMode?.() === 'SongBomb' ? 'Preparing Song Bomb…' : 'Preparing songs…';
    try {
      if (window.getSelectedGameMode?.() === 'SongBomb') {
        const songs = await prepareBombSongs();
        if (state.socket?.readyState !== WebSocket.OPEN) throw new Error('The room connection was lost. Reconnect and try again.');
        closeModal();
        enterGame('SongBomb');
        send('start-bomb', { songs });
        return;
      }
      const rounds = await prepareRounds();
      if (state.socket?.readyState !== WebSocket.OPEN) throw new Error('The room connection was lost. Reconnect and try again.');
      // A host can reuse the same page/session to start another room without
      // receiving a lobby WebSocket event. Force round 1 to render as new.
      state.localRound = 0;
      state.localStage = 0;
      state.timerKey = '';
      stopSyncedAudio();
      const choices = $('.song-choices');
      if (choices) {
        choices.dataset.renderedRound = '';
        choices.dataset.roundNumber = '0';
        choices.dataset.stage = '-1';
        choices.classList.remove('locked', 'wrong-locked');
      }
      closeModal();
      enterGame('Classic');
      $('.game-layout').hidden = false;
      $('.round-feedback').textContent = 'Starting the game…';
      showingGameStart = true;
      if (!send('start', { rounds })) throw new Error('The room connection was lost before the match could start. Reconnect and try again.');
      clearTimeout(state.startTimer);
      state.startTimer = setTimeout(() => {
        state.startTimer = 0;
        if (state.room?.phase === 'game' || state.room?.phase === 'break') return;
        $('.game-view').hidden = true;
        $('main').hidden = false;
        $('.site-footer').hidden = false;
        $('.modal-backdrop').hidden = false;
        document.body.style.overflow = 'hidden';
        showNotice('The room did not confirm the match start. Check your connection and try again.', true);
      }, 12000);
    } catch (error) {
      clearTimeout(state.startTimer);
      state.startTimer = 0;
      if (showingGameStart) {
        $('.game-view').hidden = true;
        $('main').hidden = false;
        $('.site-footer').hidden = false;
        $('.modal-backdrop').hidden = false;
        document.body.style.overflow = 'hidden';
      }
      showNotice(error.message, true);
    } finally {
      button.disabled = false;
      button.innerHTML = window.getSelectedGameMode?.() === 'SongBomb' ? 'Start Song Bomb <span>&rarr;</span>' : 'Start Classic <span>&rarr;</span>';
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
    $('#player-name').value = localStorage.getItem('sonora-profile-name') || $('.host-name-input')?.value.trim() || '';
    $('.join-page').hidden = false;
    $('.joined-room-panel').hidden = true;
    $('body').style.overflow = 'hidden';
    $('#player-name').focus();
  }

  function resetJoinForm() {
    const name = $('#player-name');
    const code = $('#join-code');
    const button = $('.join-form button[type="submit"]');
    if (name) name.disabled = false;
    if (code) {
      code.value = '';
      code.disabled = false;
      code.placeholder = '1234567';
    }
    if (button) {
      button.disabled = false;
      button.innerHTML = 'Join room <span>→</span>';
    }
    const status = $('.join-status');
    if (status) {
      status.textContent = '';
      status.className = 'join-status';
    }
    $('.joined-room-panel').hidden = true;
    setRoomCode('');
  }

  function leaveRoom({ kicked = false } = {}) {
    window.setSongBombVolumePlacement?.(false);
    if (!kicked && state.session && state.socket?.readyState === WebSocket.OPEN) send('leave');
    state.manuallyClosed = true;
    clearInterval(state.heartbeat);
    clearRoomTimer();
    clearTimeout(state.connectTimer);
    clearTimeout(state.startTimer);
    state.startTimer = 0;
    stopSyncedAudio();
    state.socket?.close();
    state.socket = null;
    state.room = null;
    sessionStore.clear();
    resetJoinForm();
    $('.winner-backdrop').hidden = true;
    $('.round-result-backdrop').hidden = true;
    $('.game-view').hidden = true;
    $('.song-bomb-panel').hidden = true;
    $('.modal-backdrop').hidden = true;
    $('.join-page').hidden = !kicked;
    $('main').hidden = false;
    $('.site-footer').hidden = false;
    document.body.style.overflow = '';
    window.scrollTo(0, 0);
    if (kicked) {
      showJoinPage();
      $('.join-status').textContent = 'You were removed from the room. Enter a room code to join another room.';
      $('.join-status').className = 'join-status error';
    } else if (document.body.dataset.roomPage === 'true') location.assign('index.html');
  }

  function returnToLobby() {
    window.setSongBombVolumePlacement?.(false);
    clearRoomTimer();
    clearTimeout(state.startTimer);
    state.startTimer = 0;
    stopSyncedAudio();
    if (state.session?.host && state.room?.phase === 'finished') send('return-lobby');
    $('.winner-backdrop').hidden = true;
    $('.round-result-backdrop').hidden = true;
    $('.game-view').hidden = true;
    $('.song-bomb-panel').hidden = true;
    const room = state.room;
    if (state.session?.host) {
      const host = room?.players?.find((player) => player.id === state.session.playerId);
      openSetup(host?.name || $('.host-name-input')?.value || '');
    } else {
      showJoinPage();
      $('.joined-room-panel').hidden = false;
    }
    if (room) renderLobby(room);
    if (state.session?.code) setRoomCode(state.session.code);
  }

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    if (target.matches('.kick-player')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.session?.playerId === state.room?.hostId && state.room?.phase === 'lobby') send('kick', { playerId: target.dataset.playerId });
      return;
    }
    if (target.matches('.bomb-suggestion')) {
      event.preventDefault();
      submitBombGuess('', target.dataset.title || '', target.dataset.artist || '');
      return;
    }
    if (target.matches('.bomb-skip')) {
      event.preventDefault();
      skipBombTurn();
      return;
    }
    if (!state.session && target.matches('.game-play, .game-skip, .song-choice, .continue-round, .winner-exit, .game-exit')) return;

    if (target.matches('.modal-close') && state.session) {
      event.preventDefault();
      event.stopImmediatePropagation();
      leaveRoom();
      return;
    }

    if (target.matches('.mode-card[data-mode="Solo"]')) return;

    if (target.matches('.js-create-room') && !window.getSelectedGameMode?.()) {
      if (document.body.dataset.roomPage !== 'true') {
        location.assign(new URL('room.html?setup=1', location.href).href);
        return;
      }
      return;
    }

    // Choosing a mode only opens its setup. Room creation happens when the
    // user presses Create a room after configuring that mode.
    if (target.matches('.js-create-room')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.body.dataset.roomPage !== 'true') {
        const mode = window.getSelectedGameMode?.();
        const url = new URL('room.html?setup=1', location.href);
        if (mode) url.searchParams.set('mode', mode);
        location.assign(url.href);
        return;
      }
      const name = $('.host-name-input')?.value.trim() || '';
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
      try { await createRoom(name); } catch (error) { showNotice(error.message, true); $('.modal-backdrop').hidden = false; }
      return;
    }

    if (target.matches('.name-gate-save') && state.pendingHost) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const name = $('.name-gate-input').value.trim();
      if (!name) { $('.name-gate-status').textContent = 'Enter a name to continue.'; return; }
      state.pendingHost = false;
      if (state.session?.host) {
        $('.name-gate').hidden = true;
        const hostName = $('.host-name-input');
        if (hostName) {
          hostName.value = name;
          hostName.dispatchEvent(new Event('input', { bubbles: true }));
        }
        send('configure', currentSettings(name));
        localStorage.setItem('sonora-profile-name', name);
      } else if (state.creatingRoom) {
        state.pendingHostName = name;
        localStorage.setItem('sonora-profile-name', name);
      } else {
        try { await createRoom(name); } catch (error) { $('.name-gate-status').textContent = error.message; }
      }
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
      if (state.creatingRoom) return;
      if (!state.session && ['Quickfire', 'SongBomb'].includes(window.getSelectedGameMode?.())) {
        const name = $('.host-name-input')?.value.trim() || '';
        try { await finishRoomCreation(name, currentSettings(name)); }
        catch (error) { showNotice(error.message, true); }
        return;
      }
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

    if (target.matches('.winner-exit')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      returnToLobby();
      return;
    }

    if (target.matches('.game-exit')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      leaveRoom();
    }
  }, true);

  document.addEventListener('submit', async (event) => {
    if (event.target.matches('.bomb-guess-form')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const guess = $('#bomb-song-input').value.trim();
      if (guess) submitBombGuess(guess);
      return;
    }
    if (!event.target.matches('.join-form')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const name = $('#player-name').value.trim();
    const isRoomMember = Boolean(state.session && !state.session.host
      && state.room?.players?.some((player) => player.id === state.session.playerId));
    if (state.session && !state.session.host && !isRoomMember) {
      leaveRoom();
      showJoinPage();
      $('.join-status').textContent = 'Your room session ended. Enter a room code to join again.';
      $('.join-status').className = 'join-status error';
      return;
    }
    if (isRoomMember) {
      if (!name) { $('.join-status').textContent = 'Enter your name first.'; $('.join-status').className = 'join-status error'; return; }
      if (state.room?.phase !== 'lobby') { $('.join-status').textContent = 'Names can only be changed while waiting in the lobby.'; $('.join-status').className = 'join-status error'; return; }
      const button = $('.join-form .primary-button');
      button.disabled = true;
      if (send('rename', { name })) {
        localStorage.setItem('sonora-profile-name', name);
        const hostNameInput = $('.host-name-input');
        if (hostNameInput) {
          hostNameInput.value = name;
          hostNameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        $('.join-status').textContent = 'Name saved.';
        $('.join-status').className = 'join-status success';
      }
      button.disabled = false;
      return;
    }
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
    if ((event.target.matches('.game-view [aria-label="Volume"]') || event.target.matches('.sound-button [aria-label="Volume"]')) && state.activeAudio) state.activeAudio.volume = Number(event.target.value) / 100;
    if (event.target.matches('#bomb-song-input')) searchBombSuggestions(event.target.value);
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.genre-option') || event.target.closest('.stepper-arrow') || event.target.closest('.difficulty-option') || event.target.closest('.mode-choice')) configureFromForm();
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('.room-setting')) configureFromForm();
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
  const isFreshSetupPage = !inviteCode
    && document.body.dataset.roomPage === 'true'
    && new URLSearchParams(location.search).get('setup') === '1';
  if (isFreshSetupPage) {
    // A new setup must not reopen an old room session or its saved host.
    sessionStore.clear();
    sessionStorage.removeItem(PENDING_ROOM_KEY);
    state.room = null;
    window.selectSetupGenre?.('Everything');
    setRoomCode('');
    const savedRoom = getRoomState();
    const rememberedName = localStorage.getItem('sonora-profile-name') || localStorage.getItem('sonora-room-setup-name') || '';
    savedRoom.hostName = '';
    if (savedRoom.players?.[0]) savedRoom.players[0].name = '';
    saveRoomState(savedRoom);
    openSetup(rememberedName);
    const launch = $('.launch-button');
    if (!rememberedName) {
      state.pendingHost = true;
      $('.name-gate-status').textContent = '';
      $('.name-gate-input').value = '';
      $('.name-gate-save').disabled = false;
      $('.name-gate').hidden = false;
    }
    if (launch) {
      launch.disabled = true;
      launch.textContent = 'Creating room…';
    }
    showNotice('Creating your room and invite code…');
    if (!rememberedName) $('.name-gate-input').focus();
    void finishRoomCreation(rememberedName, currentSettings(rememberedName)).catch((error) => {
      showNotice(error.message, true);
      if ($('.name-gate-code')) $('.name-gate-code').textContent = 'Unavailable';
      if (!rememberedName) {
        state.pendingHost = true;
        if (state.pendingHostName) $('.name-gate-input').value = state.pendingHostName;
        $('.name-gate').hidden = false;
        $('.name-gate-save').disabled = false;
      }
      if (launch) {
        launch.disabled = false;
        launch.innerHTML = window.getSelectedGameMode?.() === 'SongBomb' ? 'Start Song Bomb <span>→</span>' : 'Start Classic <span>→</span>';
      }
    });
  } else if (state.session) {
    setRoomCode(state.session.code);
    if (state.session.host) {
      $('.modal-backdrop').hidden = false;
      $('.modal-backdrop').classList.add('page-view');
      document.body.style.overflow = 'hidden';
    } else {
      $('.join-page').hidden = false;
      $('#player-name').disabled = false;
      $('#join-code').disabled = true;
      $('.join-form button[type="submit"]').disabled = true;
      $('.join-form button[type="submit"]').innerHTML = 'Save name <span>→</span>';
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
