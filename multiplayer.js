(() => {
  const SESSION_KEY = 'sonora-cloudflare-session';
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
    playbackSignature: '',
    serverOffset: 0,
    pendingHost: false,
    manuallyClosed: false,
    activeAudio: null,
    audioFrame: 0,
    audioTimeout: 0,
    prepareRequest: 0,
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
    if (label) label.textContent = `Room code · SONORA-${code}`;
    const input = $('#join-code');
    if (input) input.placeholder = `SONORA-${code}`;
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
    };
  }

  async function createRoom(name) {
    const result = await api('/api/rooms', currentSettings(name));
    sessionStore.set({ code: result.code, playerId: result.playerId, token: result.token, host: true });
    setRoomCode(result.code);
    openSetup(name);
    connect();
  }

  async function joinRoom(name, code) {
    const cleanCode = code.trim().toUpperCase().replace(/^SONORA[\s-]*/, '').replace(/[\s-]/g, '');
    if (!/^[A-HJ-NP-Z2-9]{6,7}$/.test(cleanCode)) throw new Error('Enter the full room code.');
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
    if (hostSettings.length >= 4) {
      hostSettings[0].textContent = 'Classic';
      hostSettings[1].textContent = `${room.maxPlayers} max`;
      hostSettings[2].textContent = room.genre;
      hostSettings[3].textContent = '30 sec';
    }
    if (state.session?.host) {
      const playerStepper = $('.player-stepper strong');
      if (playerStepper) playerStepper.textContent = `${room.maxPlayers} players`;
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
      if (host && (settings.name !== host.name || settings.maxPlayers !== room.maxPlayers || settings.genre !== room.genre)) send('configure', settings);
    }
  }

  function updateScoreboard(room) {
    const list = $('.score-list');
    if (!list) return;
    list.innerHTML = [...(room.players || [])]
      .sort((a, b) => b.score - a.score)
      .map((player, index) => `<div class="score-row"><span>0${index + 1}</span><strong>${escapeHtml(player.name)}</strong><b>${player.score}</b></div>`)
      .join('');
  }

  function updateRoundTimer(room) {
    clearInterval(state.timer);
    const clock = $('.round-clock strong');
    const update = () => {
      const remaining = Math.max(0, Math.ceil((room.roundEndsAt - (Date.now() + state.serverOffset)) / 1000));
      if (clock) clock.textContent = String(remaining);
    };
    update();
    state.timer = setInterval(update, 150);
  }

  function updateBreakTimer(room) {
    clearInterval(state.timer);
    const count = $('.result-countdown b');
    const update = () => {
      const remaining = Math.max(0, Math.ceil((room.breakEndsAt - (Date.now() + state.serverOffset)) / 1000));
      if (count) count.textContent = String(remaining);
    };
    update();
    state.timer = setInterval(update, 150);
  }

  function stopSyncedAudio() {
    clearTimeout(state.audioTimeout);
    cancelAnimationFrame(state.audioFrame);
    state.audioFrame = 0;
    if (state.activeAudio) state.activeAudio.pause();
    state.activeAudio = null;
    state.playbackSignature = '';
    $('.game-play')?.classList.remove('is-playing');
    $('.game-play')?.setAttribute('aria-label', 'Play current section');
  }

  function applyPlayback(room) {
    const playback = room.playback || { playing: false };
    const signature = `${playback.playing}:${playback.playAt}:${playback.offset}`;
    if (signature === state.playbackSignature) return;
    if (!playback.playing) {
      stopSyncedAudio();
      state.playbackSignature = signature;
      return;
    }
    state.playbackSignature = signature;
    clearTimeout(state.audioTimeout);
    cancelAnimationFrame(state.audioFrame);
    const source = room.currentRound?.previewUrl;
    if (!source) return;
    if (!state.activeAudio || state.activeAudio.src !== source) {
      if (state.activeAudio) state.activeAudio.pause();
      state.activeAudio = new Audio(source);
      state.activeAudio.preload = 'auto';
      state.activeAudio.volume = Number($('.game-view [aria-label="Volume"]')?.value || 65) / 100;
    }
    const audio = state.activeAudio;
    const stageIndex = Math.max(0, Math.min(4, room.stage || 0));
    const sectionEnd = STAGE_ENDS[stageIndex];
    const targetLocalTime = playback.playAt - state.serverOffset;
    const renderProgress = () => {
      if (!audio || audio !== state.activeAudio || audio.paused) return;
      const value = Math.max(0, Math.min(sectionEnd, audio.currentTime));
      const marks = [0, 8, 20, 46, 74, 100];
      const starts = [0, 0.1, 0.5, 2, 8];
      const fraction = Math.max(0, Math.min(1, (value - starts[stageIndex]) / Math.max(0.001, sectionEnd - starts[stageIndex])));
      $('.track-line i').style.width = `${marks[stageIndex] + fraction * (marks[stageIndex + 1] - marks[stageIndex])}%`;
      if (audio.currentTime >= sectionEnd) {
        audio.pause();
        audio.currentTime = sectionEnd;
        $('.game-play').classList.remove('is-playing');
        $('.game-play').setAttribute('aria-label', 'Play current section');
        return;
      }
      state.audioFrame = requestAnimationFrame(renderProgress);
    };
    state.audioTimeout = setTimeout(async () => {
      if (audio !== state.activeAudio) return;
      audio.currentTime = Math.max(playback.offset || 0, (Date.now() - targetLocalTime) / 1000 + (playback.offset || 0));
      audio.volume = Number($('.game-view [aria-label="Volume"]')?.value || 65) / 100;
      try {
        await audio.play();
        $('.game-play').classList.add('is-playing');
        $('.game-play').setAttribute('aria-label', 'Pause current section');
        renderProgress();
      } catch {
        $('.round-feedback').textContent = 'Your browser blocked audio. Press play to allow sound, then try again.';
      }
    }, Math.max(0, targetLocalTime - Date.now()));
  }

  function renderGame(room) {
    if (!room) return;
    state.room = room;
    enterGame();
    $('.round-result-backdrop').hidden = true;
    $('.winner-backdrop').hidden = true;
    updateScoreboard(room);
    const number = room.roundNumber || 1;
    $('.game-round').textContent = String(number);
    const stage = Math.max(0, room.stage || 0);
    $$('.track-marks span').forEach((mark, index) => mark.classList.toggle('active', index <= stage));
    $('.game-skip').disabled = stage >= 4;
    const choicesContainer = $('.song-choices');
    if (Number(choicesContainer.dataset.roundNumber || 0) !== number || Number(choicesContainer.dataset.stage || -1) !== stage) {
      choicesContainer.dataset.stage = String(stage);
      $('.track-line i').style.width = `${[0, 8, 20, 46, 74, 100][stage]}%`;
    }
    if (room.currentRound) {
      activeRoundSong = [null, '', room.currentRound.artwork || '', room.currentRound.previewUrl || ''];
      const mine = room.players.find((player) => player.id === state.session?.playerId);
      const choices = room.currentRound.choices || [];
      const container = choicesContainer;
      const wasRound = Number(container.dataset.roundNumber || 0);
      const isNewRound = wasRound !== number;
      if (isNewRound) {
        container.dataset.roundNumber = String(number);
        container.classList.remove('locked', 'wrong-locked');
        $('.track-line i').style.width = '0%';
        $('.round-feedback').textContent = 'Choose quickly for the highest score.';
      }
      container.innerHTML = choices.map((choice, index) => `<button class="song-choice" data-choice-index="${index}" type="button"><span class="cover-art cover-${(number + index) % 4}" aria-hidden="true">♪</span><span class="song-title"><strong>${escapeHtml(choice.title)}</strong></span><i>${String.fromCharCode(65 + index)}</i></button>`).join('');
      choices.forEach((choice, index) => {
        const cover = container.querySelector(`[data-choice-index="${index}"] .cover-art`);
      if (cover && choice.artwork) {
        cover.style.backgroundImage = `url("${choice.artwork.replaceAll('"', '')}")`;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
      }
      });
      const disabled = !mine || mine.status !== 'playing';
      container.querySelectorAll('.song-choice').forEach((button) => { button.disabled = disabled; });
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
      applyPlayback(room);
    }
  }

  function renderRoundEnd(room) {
    if (!room) return;
    renderGame(room);
    clearInterval(state.timer);
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
    clearInterval(state.timer);
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
    showNotice('Loading the song catalog…');
    activeCatalog = await loadGenreCatalog(room.genre || 'Everything');
    if (!Array.isArray(activeCatalog) || activeCatalog.length < 4) activeCatalog = roundSongs;
    const candidates = [...activeCatalog, ...roundSongs]
      .filter((song, index, list) => list.findIndex((item) => item[0] === song[0] && item[1] === song[1]) === index)
      .sort(() => Math.random() - 0.5);
    const playable = [];
    for (let offset = 0; offset < candidates.length && playable.length < ROUND_COUNT * 4; offset += 8) {
      if (request !== state.prepareRequest) throw new Error('Song preparation was cancelled.');
      const batch = candidates.slice(offset, offset + 8);
      const results = await Promise.all(batch.map(async (song) => ({ song, asset: await loadSongAsset(song) })));
      for (const { song, asset } of results) {
        if (!asset?.previewUrl) {
          unavailableSongs.add(`${song[0]}|${song[1]}`);
          continue;
        }
        song[3] = song[3] || asset.previewUrl;
        playable.push({ song, asset });
        if (playable.length >= ROUND_COUNT * 4) break;
      }
      showNotice(`Preparing songs · found ${Math.min(playable.length, ROUND_COUNT * 4)} of ${ROUND_COUNT * 4}`);
    }
    if (playable.length < ROUND_COUNT * 4) {
      throw new Error(`Found only ${playable.length} playable songs. Check your connection and try again.`);
    }
    const rounds = [];
    for (let index = 0; index < ROUND_COUNT; index += 1) {
      if (request !== state.prepareRequest) throw new Error('Song preparation was cancelled.');
      const entries = playable.slice(index * 4, index * 4 + 4);
      const choices = entries.map(({ song }) => song);
      const choiceRecords = [];
      for (const [choiceIndex, song] of choices.entries()) {
        const asset = entries[choiceIndex].asset;
        const record = { title: song[0], artwork: asset.artworkUrl100 || song[2] || '' };
        choiceRecords.push(record);
      }
      const song = choices[0];
      const asset = entries[0].asset;
      const answer = {
        title: song[0],
        artist: song[1],
        artwork: asset.artworkUrl100 || song[2] || '',
        previewUrl: song[3] || asset.previewUrl,
      };
      rounds.push({ choices: choiceRecords, answerIndex: 0, answer });
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
    const name = $('.host-name-input')?.value.trim();
    const settings = currentSettings(name);
    send('configure', settings);
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
    clearInterval(state.timer);
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

    if (target.matches('.js-create-room, .mode-card')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const savedName = localStorage.getItem('sonora-profile-name') || '';
      const name = $('.host-name-input')?.value.trim() || savedName;
      if (state.session?.host && state.room?.phase === 'lobby') {
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

    if (target.matches('.copy-button')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!state.session?.code) return showNotice('Create a room first.', true);
      const code = `SONORA-${state.session.code}`;
      try { await navigator.clipboard.writeText(code); showNotice('Room code copied.'); }
      catch { showNotice(`Room code: ${code}`); }
      return;
    }

    if (target.matches('.launch-button')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await startGame();
      return;
    }

    if (target.matches('.game-play')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      send('playback', { playing: !state.room?.playback?.playing });
      return;
    }

    if (target.matches('.game-skip')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      send('skip');
      return;
    }

    if (target.matches('.song-choice')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      send('guess', { choiceIndex: Number(target.dataset.choiceIndex) });
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
    if (event.target.closest('.genre-option') || event.target.closest('.stepper-arrow')) configureFromForm();
  });

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
  }
})();
