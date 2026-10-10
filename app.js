const modeCards = document.querySelectorAll('.mode-card');
const modal = document.querySelector('.modal-backdrop');
const selectedModeLabel = document.querySelector('.selected-mode-label');
const copyStatus = document.querySelector('.copy-status');
let selectedMode = 'Quickfire';
const availableModes = new Set(['Quickfire']);
const modeDisplayNames = { Quickfire: 'Classic' };
const artistQuotes = [
  { en: 'Music is the strongest form of magic.', th: 'ดนตรีคือเวทมนตร์รูปแบบที่ทรงพลังที่สุด', artist: 'Marilyn Manson' },
  { en: 'Music is the shorthand of emotion.', th: 'ดนตรีคือภาษาย่อของอารมณ์', artist: 'Leo Tolstoy' },
  { en: 'Where words fail, music speaks.', th: 'เมื่อคำพูดไม่เพียงพอ ดนตรีจะเป็นผู้พูด', artist: 'Hans Christian Andersen' },
  { en: 'Music can change the world.', th: 'ดนตรีเปลี่ยนโลกได้', artist: 'Bono' },
  { en: 'One good thing about music is that it feels good.', th: 'สิ่งหนึ่งที่ดีของดนตรีคือมันทำให้เรารู้สึกดี', artist: 'Bob Marley' },
  { en: 'Music is the wine that fills the cup of silence.', th: 'ดนตรีคือไวน์ที่เติมเต็มถ้วยแห่งความเงียบ', artist: 'Robert Fripp' },
  { en: 'Music expresses that which cannot be put into words.', th: 'ดนตรีสื่อสิ่งที่ไม่อาจถ่ายทอดเป็นคำพูด', artist: 'Victor Hugo' },
  { en: 'Without music, life would be a mistake.', th: 'หากไร้ดนตรี ชีวิตคงเป็นความผิดพลาด', artist: 'Friedrich Nietzsche' },
  { en: 'Music is my higher power.', th: 'ดนตรีคือพลังที่สูงกว่าของฉัน', artist: 'Oliver Sacks' },
  { en: 'The only truth is music.', th: 'ความจริงเพียงหนึ่งเดียวคือดนตรี', artist: 'Jack Kerouac' },
  { en: 'Music gives a soul to the universe.', th: 'ดนตรีมอบจิตวิญญาณให้จักรวาล', artist: 'Plato' },
  { en: 'Music is the language of the spirit.', th: 'ดนตรีคือภาษาของจิตวิญญาณ', artist: 'Khalil Gibran' },
  { en: 'If I cannot fly, let me sing.', th: 'ถ้าฉันบินไม่ได้ ก็ขอให้ฉันร้องเพลง', artist: 'Stephen Sondheim' },
  { en: 'The music is not in the notes, but in the silence between.', th: 'ดนตรีไม่ได้อยู่ในตัวโน้ต แต่อยู่ในความเงียบระหว่างโน้ต', artist: 'Claude Debussy' },
  { en: 'Music is enough for a lifetime, but a lifetime is not enough for music.', th: 'ดนตรีเพียงพอสำหรับหนึ่งชีวิต แต่หนึ่งชีวิตไม่พอสำหรับดนตรี', artist: 'Sergei Rachmaninoff' },
  { en: 'A great song should lift your heart.', th: 'เพลงที่ดีควรยกหัวใจของคุณให้สูงขึ้น', artist: 'Marvin Gaye' },
  { en: 'Music is the soundtrack of your life.', th: 'ดนตรีคือเพลงประกอบชีวิตของคุณ', artist: 'Dick Clark' },
  { en: 'The power of music makes all the difference.', th: 'พลังของดนตรีสร้างความแตกต่างได้ทั้งหมด', artist: 'Phil Collins' },
  { en: 'Music is a world within itself.', th: 'ดนตรีคือโลกใบหนึ่งในตัวมันเอง', artist: 'Stevie Wonder' },
  { en: 'I have found God in myself and I love her fiercely.', th: 'ฉันค้นพบพระเจ้าในตัวเอง และรักเธออย่างเต็มหัวใจ', artist: 'Ntozake Shange' },
];
const activeQuote = artistQuotes[Math.floor(Math.random() * artistQuotes.length)];

modeCards.forEach((card) => {
  if (!availableModes.has(card.dataset.mode)) {
    card.disabled = true;
    card.classList.add('locked');
    card.setAttribute('aria-disabled', 'true');
  }
  card.addEventListener('click', () => {
    if (card.disabled) return;
    modeCards.forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
    const room = getRoomState();
    room.mode = selectedMode;
    saveRoomState(room);
    openModal();
  });
});

document.querySelector('.js-create-room').addEventListener('click', () => {
  openModal(true);
});

const joinPage = document.createElement('div');
joinPage.className = 'join-page';
joinPage.hidden = true;
joinPage.innerHTML = '<button class="join-back" type="button">← Back to home</button><div class="join-content"><p class="eyebrow">Join the room</p><h2>Find your<br /><em>music people.</em></h2><p>Enter your name and the invite code your host sent you.</p><form class="join-form"><label for="player-name">Your name</label><input id="player-name" type="text" placeholder="e.g. Jamie" autocomplete="name" maxlength="20" /><label for="join-code">Room code</label><input id="join-code" type="text" placeholder="SONORA-7K4P" autocomplete="off" maxlength="11" /><button class="primary-button" type="submit">Join room <span>→</span></button><small class="join-status" aria-live="polite"></small></form></div><div class="join-note"><span class="wordmark-mark">S</span><strong>SONORA</strong><span>Make some noise.</span></div>';
document.body.appendChild(joinPage);
const joinedRoomPanel = document.createElement('div');
joinedRoomPanel.className = 'joined-room-panel';
joinedRoomPanel.innerHTML = '<div class="joined-room-heading"><p class="eyebrow">Room live</p><h3>Your crew is <em>here.</em></h3><div class="host-settings"><span><small>Mode</small><strong>Quickfire</strong></span><span><small>Players</small><strong>8 max</strong></span><span><small>Genre</small><strong>Everything</strong></span><span><small>Per song</small><strong>30 sec</strong></span></div></div><div class="joined-room-list"><div class="joined-player"><span class="joined-avatar avatar-yellow">AL</span><span><strong>Alex</strong><small>Host</small></span><i>★</i></div><div class="joined-player"><span class="joined-avatar avatar-blue">MK</span><span><strong>Mika</strong><small>Joined</small></span><i>✓</i></div><div class="joined-player"><span class="joined-avatar avatar-pink">RP</span><span><strong>Riley</strong><small>Joined</small></span><i>✓</i></div><div class="joined-player waiting"><span class="joined-avatar">+</span><span><strong>Waiting for you</strong><small>You will appear here</small></span></div></div>';
joinedRoomPanel.hidden = true;
joinPage.querySelector('.join-content').appendChild(joinedRoomPanel);

document.querySelector('.js-join-room').addEventListener('click', () => {
  joinPage.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('#player-name').focus();
});

joinPage.querySelector('.join-back').addEventListener('click', closeJoinPage);
joinPage.querySelector('.join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const nameInput = document.querySelector('#player-name');
  const input = document.querySelector('#join-code');
  const status = joinPage.querySelector('.join-status');
  const playerName = nameInput.value.trim();
  const code = input.value.trim().toUpperCase();
  if (!playerName) {
    status.textContent = 'Add your name so the room knows who joined.';
    status.className = 'join-status error';
    nameInput.focus();
    return;
  }
  if (code !== 'SONORA-7K4P') {
    status.textContent = 'That code does not match an active room.';
    status.className = 'join-status error';
    return;
  }
  const room = getRoomState();
  const alreadyJoined = room.players.some((player) => player.name.toLowerCase() === playerName.toLowerCase());
  if (!alreadyJoined && room.players.length >= room.maxPlayers) {
    status.textContent = 'This room is full.';
    status.className = 'join-status error';
    return;
  }
  if (!alreadyJoined) room.players.push({ name: playerName, role: 'Joined' });
  saveRoomState(room);
  status.textContent = 'You joined the room. Waiting for the host to start...';
  status.className = 'join-status success';
  nameInput.disabled = true;
  input.disabled = true;
  joinPage.querySelector('.join-form .primary-button').disabled = true;
  joinedRoomPanel.hidden = false;
});

document.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

document.querySelector('.copy-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText('SONORA-7K4P');
    copyStatus.textContent = 'Copied to clipboard';
    button.firstChild.textContent = 'Code copied ';
  } catch {
    copyStatus.textContent = 'Room code: SONORA-7K4P';
  }
});

document.querySelector('.launch-button').addEventListener('click', (event) => {
  if (event.currentTarget.disabled) return;
  event.currentTarget.innerHTML = 'Room is ready <span>✓</span>';
  document.querySelector('.setup-footer > span').innerHTML = '<i class="status-dot"></i> Waiting for players';
});

document.querySelectorAll('.room-setting').forEach((select) => {
  if (select.dataset.setting === 'genre') {
    const originalField = select.parentElement;
    const genreField = document.createElement('div');
    genreField.className = originalField.className;
    while (originalField.firstChild) genreField.appendChild(originalField.firstChild);
    originalField.replaceWith(genreField);
    genreField.classList.add('genre-setting-field');
    const genreGrid = document.createElement('div');
    genreGrid.className = 'genre-grid';
    Array.from(select.options).forEach((option) => {
      const genre = document.createElement('button');
      genre.type = 'button';
      genre.className = 'genre-option';
      genre.textContent = option.text;
      genre.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        select.value = option.value;
        genreGrid.querySelectorAll('.genre-option').forEach((item) => item.classList.remove('selected'));
        genre.classList.add('selected');
        const room = getRoomState();
        room.genre = option.text;
        saveRoomState(room);
      });
      genreGrid.appendChild(genre);
    });
    select.replaceWith(genreGrid);
    return;
  }

  if (select.dataset.setting === 'players') {
    const originalField = select.parentElement;
    const playerField = document.createElement('div');
    playerField.className = originalField.className;
    while (originalField.firstChild) playerField.appendChild(originalField.firstChild);
    originalField.replaceWith(playerField);
    playerField.classList.add('player-setting-field');
    const playerStepper = document.createElement('div');
    playerStepper.className = 'player-stepper';
    playerStepper.innerHTML = `<button type="button" class="stepper-arrow" aria-label="Remove player">−</button><strong>${select.options[select.selectedIndex].text}</strong><button type="button" class="stepper-arrow" aria-label="Add player">＋</button>`;
    const value = playerStepper.querySelector('strong');
    playerStepper.querySelector('[aria-label="Remove player"]').addEventListener('click', () => changePlayers(-1));
    playerStepper.querySelector('[aria-label="Add player"]').addEventListener('click', () => changePlayers(1));
    select.replaceWith(playerStepper);
    playerStepper.parentElement.addEventListener('click', (event) => {
      if (!event.target.closest('.stepper-arrow')) event.preventDefault();
    });

    function changePlayers(direction) {
      const currentPlayers = Number.parseInt(value.textContent, 10) || 8;
      const nextPlayers = Math.max(2, Math.min(20, currentPlayers + direction));
      value.textContent = `${nextPlayers} players`;
      const room = getRoomState();
      room.maxPlayers = nextPlayers;
      saveRoomState(room);
    }
    return;
  }

  const stepper = document.createElement('div');
  const originalField = select.parentElement;
  const timeField = document.createElement('div');
  timeField.className = originalField.className;
  while (originalField.firstChild) timeField.appendChild(originalField.firstChild);
  originalField.replaceWith(timeField);
  timeField.classList.add('time-setting-field');
  stepper.className = 'setting-stepper';
  stepper.innerHTML = `<button type="button" class="stepper-arrow" aria-label="Previous option">←</button><strong>${select.options[select.selectedIndex].text}</strong><button type="button" class="stepper-arrow" aria-label="Next option">→</button>`;
  const value = stepper.querySelector('strong');
  const arrows = stepper.querySelectorAll('.stepper-arrow');

  arrows[0].addEventListener('click', () => changeSetting(-1));
  arrows[1].addEventListener('click', () => changeSetting(1));
  select.replaceWith(stepper);

  function changeSetting(direction) {
    const currentIndex = select.selectedIndex;
    const nextIndex = (currentIndex + direction + select.options.length) % select.options.length;
    select.selectedIndex = nextIndex;
    value.textContent = select.options[nextIndex].text;
    const room = getRoomState();
    room.time = select.options[nextIndex].text;
    saveRoomState(room);
  }
});

const joinedPanel = document.createElement('section');
joinedPanel.className = 'joined-panel';
joinedPanel.innerHTML = '<div><p class="eyebrow">The room</p><h3>Who is <em>in?</em></h3><p class="joined-subtitle">Share the code above and watch your crew appear here.</p></div><div class="joined-list"><div class="joined-player"><span class="joined-avatar avatar-yellow">JD</span><span><strong>Jordan</strong><small>Room host</small></span><i>✓</i></div><div class="joined-player"><span class="joined-avatar avatar-blue">MK</span><span><strong>Mika</strong><small>Joined just now</small></span><i>✓</i></div><div class="joined-player waiting"><span class="joined-avatar">+</span><span><strong>Waiting for players</strong><small>Send the invite code to your crew</small></span></div></div>';
document.querySelector('.setup-modal').appendChild(joinedPanel);

const roomStateKey = 'sonora-room-state';
const defaultRoomState = { hostName: '', maxPlayers: 8, mode: 'Quickfire', choices: 4, difficulty: 'Normal', genre: '', time: '30 seconds', active: true, players: [{ name: '', role: 'Host' }] };

function getRoomState() {
  try {
    const room = JSON.parse(localStorage.getItem(roomStateKey)) || structuredClone(defaultRoomState);
    room.players = (room.players || []).filter((player) => !['Mika', 'Riley'].includes(player.name));
    if (room.hostName === 'Jordan') room.hostName = '';
    if (room.players[0]?.name === 'Jordan') room.players[0].name = '';
    return room;
  } catch { return structuredClone(defaultRoomState); }
}

function saveRoomState(room) {
  localStorage.setItem(roomStateKey, JSON.stringify(room));
  renderRoomRosters();
  updateLaunchAvailability();
}

function updateLaunchAvailability() {
  const launchButton = document.querySelector('.launch-button');
  if (!launchButton) return;
  const room = getRoomState();
  const ready = Boolean(room.hostName?.trim() && room.mode && room.choices && room.difficulty && room.maxPlayers && room.genre && room.time);
  launchButton.disabled = !ready;
  launchButton.setAttribute('aria-disabled', String(!ready));
  launchButton.title = ready ? 'Start the room' : 'Complete the room settings first';
}

function escapeRoomText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function renderRoster(list, room, waitingLabel) {
  if (!list) return;
  const cards = room.players.map((player, index) => `<div class="joined-player"><span class="joined-avatar ${index === 0 ? 'avatar-yellow' : 'avatar-blue'}">${escapeRoomText(player.name.slice(0, 2).toUpperCase())}</span><span><strong>${escapeRoomText(player.name)}</strong><small>${index === 0 ? 'Host' : 'Joined'}</small></span><i>${index === 0 ? '★' : '✓'}</i></div>`);
  if (room.players.length < room.maxPlayers) cards.push(`<div class="joined-player waiting"><span class="joined-avatar">+</span><span><strong>${waitingLabel}</strong><small>${room.maxPlayers - room.players.length} spot${room.maxPlayers - room.players.length === 1 ? '' : 's'} open</small></span></div>`);
  list.innerHTML = cards.join('');
}

function renderRoomRosters() {
  const room = getRoomState();
  renderRoster(document.querySelector('.joined-list'), room, 'Waiting for players');
  renderRoster(document.querySelector('.joined-room-list'), room, 'Waiting for players');
  const hostSettings = document.querySelectorAll('.host-settings strong');
  if (hostSettings.length === 4) {
    hostSettings[0].textContent = modeDisplayNames[room.mode] || room.mode;
    hostSettings[1].textContent = `${room.maxPlayers} max`;
    hostSettings[2].textContent = room.genre;
    hostSettings[3].textContent = room.time.replace(' seconds', ' sec');
  }
}

renderRoomRosters();
window.addEventListener('storage', renderRoomRosters);

const hostNameField = document.createElement('label');
hostNameField.className = 'setup-field host-name-field';
hostNameField.innerHTML = '<span>Your name</span><input class="host-name-input" type="text" value="" placeholder="Enter your name" maxlength="20" autocomplete="name" /><small>This is how your crew will see you</small>';
document.querySelector('.setup-fields').prepend(hostNameField);
const hostNameInput = hostNameField.querySelector('.host-name-input');
const hostRosterName = joinedPanel.querySelector('.joined-player strong');
hostNameInput.addEventListener('input', () => {
  const hostName = hostNameInput.value.trim();
  hostRosterName.textContent = hostName;
  const room = getRoomState();
  room.hostName = hostName;
  if (room.players[0]) room.players[0].name = hostName;
  saveRoomState(room);
});

const nameGate = document.createElement('div');
nameGate.className = 'name-gate';
nameGate.hidden = true;
nameGate.innerHTML = '<section class="name-gate-card" role="dialog" aria-modal="true" aria-labelledby="name-gate-title"><p class="eyebrow">Before we start</p><h2 id="name-gate-title">What should<br /><em>we call you?</em></h2><p>Your name will appear in the room for everyone to see.</p><input class="name-gate-input" type="text" placeholder="Enter your name" maxlength="20" autocomplete="name" /><button class="primary-button name-gate-save" type="button">Continue <span>→</span></button><small class="name-gate-status" aria-live="polite"></small></section></div>';
document.body.appendChild(nameGate);
const nameGateInput = nameGate.querySelector('.name-gate-input');
nameGate.querySelector('.name-gate-save').addEventListener('click', () => {
  const name = nameGateInput.value.trim();
  if (!name) {
    nameGate.querySelector('.name-gate-status').textContent = 'Enter a name to continue.';
    nameGateInput.focus();
    return;
  }
  hostNameInput.value = name;
  hostNameInput.dispatchEvent(new Event('input'));
  nameGate.hidden = true;
  document.body.style.overflow = 'hidden';
  hostNameInput.focus();
});

const originalModeField = selectedModeLabel.parentElement;
const modeField = document.createElement('div');
modeField.className = originalModeField.className;
while (originalModeField.firstChild) modeField.appendChild(originalModeField.firstChild);
originalModeField.replaceWith(modeField);
const modeChoices = document.createElement('div');
modeChoices.className = 'mode-choices';
let currentLanguage = 'EN';
['Quickfire', 'Decades', 'Head to head', 'Blind spot'].forEach((mode) => {
  const choice = document.createElement('button');
  choice.type = 'button';
  choice.className = 'mode-choice';
  choice.dataset.mode = mode;
  if (!availableModes.has(mode)) {
    choice.disabled = true;
    choice.classList.add('locked');
  }
  choice.textContent = modeDisplayNames[mode] || mode;
  choice.addEventListener('click', () => {
    selectedMode = mode;
    updateModeSelection(true);
    const room = getRoomState();
    room.mode = mode;
    saveRoomState(room);
  });
  modeChoices.appendChild(choice);
});
modeField.appendChild(modeChoices);

const choicesField = document.createElement('div');
choicesField.className = 'setup-field choices-setting-field';
choicesField.innerHTML = '<span>Choices per song</span><div class="choice-options" role="group" aria-label="Choices per song"><button type="button" data-choices="4" class="selected">4</button><button type="button" data-choices="5">5</button><button type="button" data-choices="6">6</button></div><small>How many answers players can choose from</small>';
modeField.parentElement.insertBefore(choicesField, modeField.nextElementSibling);
choicesField.querySelectorAll('[data-choices]').forEach((choice) => {
  choice.addEventListener('click', () => {
    choicesField.querySelectorAll('[data-choices]').forEach((item) => item.classList.remove('selected'));
    choice.classList.add('selected');
    const room = getRoomState();
    room.choices = Number(choice.dataset.choices);
    saveRoomState(room);
  });
});

const difficultyField = document.createElement('div');
difficultyField.className = 'setup-field difficulty-setting-field';
difficultyField.innerHTML = '<span>Difficulty</span><div class="difficulty-options" role="group" aria-label="Difficulty"><button type="button" data-difficulty="Easy">Easy</button><button type="button" data-difficulty="Normal" class="selected normal">Normal</button><button type="button" data-difficulty="Hard">Hard</button><button type="button" data-difficulty="Extreme">Extreme</button></div><small>Set how forgiving the guesses will be</small>';
modeField.parentElement.insertBefore(difficultyField, modeField.nextElementSibling);
difficultyField.querySelectorAll('[data-difficulty]').forEach((choice) => {
  choice.addEventListener('click', () => {
    difficultyField.querySelectorAll('[data-difficulty]').forEach((item) => item.className = '');
    choice.classList.add('selected', choice.dataset.difficulty.toLowerCase());
    const room = getRoomState();
    room.difficulty = choice.dataset.difficulty;
    saveRoomState(room);
  });
});

function updateModeSelection(showSetupSelection = false) {
  const modeIndex = ['Quickfire', 'Decades', 'Head to head', 'Blind spot'].indexOf(selectedMode);
  selectedModeLabel.textContent = modeIndex >= 0 ? modeDisplayNames[selectedMode] || languageCopy[currentLanguage].modes[modeIndex][0] : selectedMode;
  modeChoices.querySelectorAll('.mode-choice').forEach((choice) => {
    choice.classList.toggle('selected', showSetupSelection && choice.dataset.mode === selectedMode);
  });
  modeCards.forEach((card) => card.classList.toggle('selected', card.dataset.mode === selectedMode));
}

const vinylArtwork = document.querySelector('.hero-art');
const vinylParts = [vinylArtwork.querySelector('.record'), vinylArtwork.querySelector('.record-label')];
const hoverPreviewAudio = new Audio();
hoverPreviewAudio.preload = 'none';
hoverPreviewAudio.volume = 0.7;
let hoverTargetVolume = 0.7;
let hoverPreviewLoading;
let isVinylHovering = false;
let hoverFadeFrame;
let vinylResetFrame;

vinylArtwork.addEventListener('mouseenter', async () => {
  isVinylHovering = true;
  cancelAnimationFrame(vinylResetFrame);
  vinylArtwork.classList.add('is-vinyl-hovering');
  vinylParts.forEach((part) => {
    part.style.removeProperty('animation');
    part.style.removeProperty('rotate');
    part.style.removeProperty('transition');
  });
  if (!hoverPreviewLoading) hoverPreviewLoading = loadRandomPreview();
  try {
    const previewUrl = await hoverPreviewLoading;
    if (isVinylHovering && previewUrl) {
      hoverPreviewAudio.src = previewUrl;
      hoverPreviewAudio.volume = 0;
      await hoverPreviewAudio.play();
      fadePreviewIn();
    }
  } catch {
    // Audio preview access can be blocked by the browser or the network.
  } finally {
    hoverPreviewLoading = null;
  }
});

vinylArtwork.addEventListener('mouseleave', () => {
  isVinylHovering = false;
  cancelAnimationFrame(hoverFadeFrame);
  hoverPreviewAudio.pause();
  hoverPreviewAudio.currentTime = 0;
  hoverPreviewAudio.volume = 0;
  vinylParts.forEach((part) => {
    const currentRotation = getComputedStyle(part).rotate;
    part.style.setProperty('animation', 'none', 'important');
    part.style.setProperty('rotate', currentRotation === 'none' ? '0deg' : currentRotation, 'important');
    part.style.setProperty('transition', 'rotate .85s cubic-bezier(.2,.8,.2,1)', 'important');
  });
  vinylArtwork.classList.remove('is-vinyl-hovering');

  vinylResetFrame = requestAnimationFrame(() => {
    vinylParts.forEach((part) => part.style.setProperty('rotate', '0deg', 'important'));
  });
});

function fadePreviewIn() {
  const fadeStartedAt = performance.now();
  const fadeDuration = 900;
  const animateVolume = (now) => {
    const progress = Math.min((now - fadeStartedAt) / fadeDuration, 1);
    hoverPreviewAudio.volume = hoverTargetVolume * progress;
    if (progress < 1 && isVinylHovering) hoverFadeFrame = requestAnimationFrame(animateVolume);
  };
  cancelAnimationFrame(hoverFadeFrame);
  hoverFadeFrame = requestAnimationFrame(animateVolume);
}

async function loadRandomPreview() {
  const terms = ['pop', 'rock', 'indie', 'dance', 'r&b', 'alternative'];
  const term = terms[Math.floor(Math.random() * terms.length)];
  const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&country=US&limit=50`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`iTunes Search failed: ${response.status}`);
  const data = await response.json();
  const previews = data.results.filter((track) => track.previewUrl).map((track) => track.previewUrl);
  return previews[Math.floor(Math.random() * previews.length)];
}

function openModal(requireName = false) {
  updateModeSelection(true);
  const room = getRoomState();
  choicesField.querySelectorAll('[data-choices]').forEach((choice) => choice.classList.toggle('selected', Number(choice.dataset.choices) === (room.choices || 4)));
  difficultyField.querySelectorAll('[data-difficulty]').forEach((choice) => {
    const isSelected = choice.dataset.difficulty === (room.difficulty || 'Normal');
    choice.className = isSelected ? `selected ${choice.dataset.difficulty.toLowerCase()}` : '';
  });
  modal.hidden = false;
  modal.classList.add('page-view');
  document.body.style.overflow = 'hidden';
  if (requireName && !hostNameInput.value.trim()) {
    nameGate.hidden = false;
    nameGateInput.value = '';
    nameGateInput.focus();
  }
  updateLaunchAvailability();
}

function closeModal() {
  modal.hidden = true;
  modal.classList.remove('page-view');
  document.body.style.overflow = '';
}

function closeJoinPage() {
  joinPage.hidden = true;
  document.body.style.overflow = '';
}

const mainContent = document.querySelector('main');
const siteFooter = document.querySelector('.site-footer');
const infoPages = document.querySelectorAll('.info-page');

document.querySelector('.footer-terms').addEventListener('click', (event) => {
  event.preventDefault();
  openInfoPage(document.querySelector('#terms-page'));
});

document.querySelector('.footer-about').addEventListener('click', (event) => {
  event.preventDefault();
  openInfoPage(document.querySelector('#about-page'));
});

document.querySelectorAll('.info-back').forEach((button) => {
  button.addEventListener('click', closeInfoPage);
});

function openInfoPage(page) {
  mainContent.hidden = true;
  siteFooter.hidden = true;
  infoPages.forEach((item) => { item.hidden = item !== page; });
  document.body.style.overflow = 'auto';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeInfoPage() {
  infoPages.forEach((page) => { page.hidden = true; });
  mainContent.hidden = false;
  siteFooter.hidden = false;
  document.body.style.overflow = '';
  window.location.hash = 'top';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const userTools = document.querySelector('.user-tools');
const avatarButton = userTools.querySelector('.avatar-button');
avatarButton.textContent = '';
const languageButton = userTools.querySelector('.language-button');
const soundButton = document.createElement('button');
soundButton.className = 'sound-button';
soundButton.type = 'button';
soundButton.setAttribute('aria-label', 'Adjust volume');
soundButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10"></path></svg><input class="volume-slider" type="range" min="0" max="100" value="70" aria-label="Volume" />';
userTools.insertBefore(soundButton, languageButton);
const volumeSlider = soundButton.querySelector('.volume-slider');
const soundIcon = soundButton.querySelector('svg');
const volumeHoverBridge = document.createElement('span');
volumeHoverBridge.setAttribute('aria-hidden', 'true');
volumeHoverBridge.style.position = 'absolute';
volumeHoverBridge.style.left = '-145px';
volumeHoverBridge.style.top = '-10px';
volumeHoverBridge.style.width = '145px';
volumeHoverBridge.style.height = '48px';
volumeHoverBridge.style.zIndex = '0';
volumeHoverBridge.style.pointerEvents = 'none';
soundButton.appendChild(volumeHoverBridge);
function setSoundExpanded(expanded) {
  soundButton.classList.toggle('is-expanded', expanded);
  volumeHoverBridge.style.pointerEvents = expanded ? 'auto' : 'none';
  soundIcon.style.setProperty('left', 'auto', 'important');
  soundIcon.style.setProperty('right', '0', 'important');
  soundIcon.style.setProperty('transform', 'none', 'important');
  volumeSlider.style.setProperty('left', expanded ? '-132px' : 'auto', 'important');
  volumeSlider.style.setProperty('right', expanded ? 'auto' : '0', 'important');
  volumeSlider.style.setProperty('width', expanded ? '110px' : '0px', 'important');
  volumeSlider.style.setProperty('max-width', expanded ? '110px' : '0px', 'important');
  volumeSlider.style.setProperty('opacity', expanded ? '1' : '0', 'important');
  volumeSlider.style.setProperty('pointer-events', expanded ? 'auto' : 'none', 'important');
  volumeSlider.style.setProperty('z-index', expanded ? '2' : 'auto', 'important');
}
soundButton.addEventListener('mouseenter', () => setSoundExpanded(true));
soundButton.addEventListener('mouseleave', () => setSoundExpanded(false));
soundButton.addEventListener('focusout', (event) => {
  if (!soundButton.contains(event.relatedTarget)) setSoundExpanded(false);
});
soundButton.addEventListener('focusin', () => setSoundExpanded(true));
volumeSlider.addEventListener('input', (event) => {
  document.documentElement.style.setProperty('--volume-level', `${event.target.value}%`);
  hoverTargetVolume = Number(event.target.value) / 100;
  if (!hoverPreviewAudio.paused) hoverPreviewAudio.volume = hoverTargetVolume;
});
const profilePanel = document.createElement('div');
profilePanel.className = 'profile-panel';
profilePanel.hidden = true;
profilePanel.innerHTML = '<p class="eyebrow">Your profile</p><label for="profile-name">Display name</label><input id="profile-name" type="text" value="" placeholder="Enter your name" maxlength="20" /><button class="primary-button profile-save" type="button">Save name</button><small class="profile-status" aria-live="polite"></small>';
userTools.appendChild(profilePanel);

const languageMenu = document.createElement('div');
languageMenu.className = 'language-menu';
languageMenu.hidden = true;
languageMenu.innerHTML = '<button type="button" data-language="EN">English</button><button type="button" data-language="TH">ไทย</button>';
userTools.appendChild(languageMenu);

avatarButton.addEventListener('click', () => {
  profilePanel.hidden = !profilePanel.hidden;
  languageMenu.hidden = true;
});

languageButton.addEventListener('click', () => {
  languageMenu.hidden = !languageMenu.hidden;
  profilePanel.hidden = true;
  languageButton.setAttribute('aria-expanded', String(!languageMenu.hidden));
});

profilePanel.querySelector('.profile-save').addEventListener('click', () => {
  const name = profilePanel.querySelector('#profile-name').value.trim();
  const nameParts = name.split(/\s+/);
  const initials = nameParts.length === 1 ? name.slice(0, 2) : nameParts.map((part) => part[0]).join('').slice(0, 2);
  avatarButton.textContent = initials.toUpperCase();
  const status = profilePanel.querySelector('.profile-status');
  status.textContent = 'Name saved';
  if (typeof hostNameInput !== 'undefined') {
    hostNameInput.value = name;
    hostNameInput.dispatchEvent(new Event('input'));
  }
});

languageMenu.querySelectorAll('button').forEach((choice) => {
  choice.addEventListener('click', () => {
    languageButton.querySelector('span').textContent = choice.dataset.language;
    languageMenu.hidden = true;
    languageButton.setAttribute('aria-expanded', 'false');
    applyLanguage(choice.dataset.language);
  });
});

const languageCopy = {
  EN: {
    navModes: 'Game modes', navHow: 'How it works', warmup: 'The room is warming up',
    heroTitle: 'Hear it.<br /><em>Know it.</em><br />Name it.', heroDescription: 'A fast, friendly music guessing game for the people who can identify a song from the first three seconds.',
    create: '＋ Create a room', join: 'Join with a code', guessed: 'players guessed today', pick: 'Pick your poison', choose: 'Choose a mode',
    modes: [['Classic', '10 songs · 60 seconds'], ['Decades', 'Travel through time'], ['Head to head', 'One song. One winner.'], ['Blind spot', 'No hints. No mercy.']], genres: ['Pop anthems', 'Indie & alternative', 'Hip-hop & R&B', 'Throwback classics'],
    zero: 'ZERO FRICTION', howTitle: 'Built for the<br /><em>perfect chorus.</em>', howText: 'Make a room, send the code, and let the music do the talking. No accounts. No setup. Just your people and a playlist.',
    profile: 'Your profile', display: 'Display name', save: 'Save name', saved: 'Name saved', setup: 'Room setup', make: 'Make it <em>yours.</em>',
    gameMode: 'Game mode', modeHint: 'Set by the mode you picked', max: 'Max players', maxHint: 'Everyone gets a turn to guess', genre: 'Song genre', genreHint: 'Keep the playlist unpredictable', time: 'Time per song', timeHint: 'How long players have to lock in', invite: 'Invite your people', sendCode: 'Send them<br /><em>the code.</em>', inviteHint: 'They can join from any device. No account needed.', copy: 'Copy room code', private: 'Room is private', start: 'Start the room', room: 'The room', who: 'Who is <em>in?</em>', roomHint: 'Share the code above and watch your crew appear here.', host: 'Room host', joined: 'Joined just now', waiting: 'Waiting for players', waitingHint: 'Send the invite code to your crew',
    joinRoom: 'Join the room', joinTitle: 'Find your<br /><em>music people.</em>', joinText: 'Enter your name and the invite code your host sent you.', yourName: 'Your name', roomCode: 'Room code', joinButton: 'Join room', noName: 'Add your name so the room knows who joined.', badCode: 'That code does not match an active room.', joinedMessage: 'You joined the room. Waiting for the host to start...', live: 'Room live', crew: 'Your crew is <em>here.</em>', modeLabel: 'Mode', playersLabel: 'Players', genreLabel: 'Genre', perSong: 'Per song', you: 'You',
  },
  TH: {
    navModes: 'โหมดเกม', navHow: 'วิธีเล่น', warmup: 'ห้องกำลังเตรียมพร้อม',
    heroTitle: 'ฟังให้ดี<br /><em>รู้ให้ทัน</em><br />ทายชื่อเพลง', heroDescription: 'เกมทายเพลงแบบรวดเร็วและเป็นกันเอง สำหรับคนที่จำเพลงได้ตั้งแต่สามวินาทีแรก',
    create: '＋ สร้างห้อง', join: 'เข้าร่วมด้วยรหัส', guessed: 'ผู้เล่นทายเพลงแล้ววันนี้', pick: 'เลือกโหมดของคุณ', choose: 'เลือกโหมด',
    modes: [['คลาสสิก', '10 เพลง · 60 วินาที'], ['ย้อนวันวาน', 'เดินทางผ่านยุคสมัย'], ['ดวลตัวต่อตัว', 'เพลงเดียว ผู้ชนะหนึ่งคน'], ['จุดบอด', 'ไม่มีคำใบ้ ไม่มีปรานี']], genres: ['เพลงป๊อป', 'อินดี้และอัลเทอร์เนทีฟ', 'ฮิปฮอปและอาร์แอนด์บี', 'เพลงคลาสสิกย้อนยุค'],
    zero: 'เล่นได้ทันที', howTitle: 'สร้างมาเพื่อ<br /><em>ท่อนฮุกที่ใช่</em>', howText: 'สร้างห้อง ส่งรหัส แล้วให้เสียงเพลงเป็นคนพูด ไม่ต้องสมัคร ไม่ต้องตั้งค่า มีแค่เพื่อนและเพลย์ลิสต์ของคุณ',
    profile: 'โปรไฟล์ของคุณ', display: 'ชื่อที่แสดง', save: 'บันทึกชื่อ', saved: 'บันทึกชื่อแล้ว', setup: 'ตั้งค่าห้อง', make: 'จัดห้องในแบบ<br /><em>ของคุณ</em>',
    gameMode: 'โหมดเกม', modeHint: 'เลือกจากโหมดที่คุณต้องการ', max: 'ผู้เล่นสูงสุด', maxHint: 'ทุกคนจะได้มีโอกาสทาย', genre: 'แนวเพลง', genreHint: 'ทำให้เพลย์ลิสต์คาดเดาไม่ได้', time: 'เวลาต่อเพลง', timeHint: 'เวลาที่ใช้ล็อกคำตอบ', invite: 'ชวนเพื่อนของคุณ', sendCode: 'ส่งรหัส<br /><em>ให้เพื่อน</em>', inviteHint: 'เข้าร่วมได้จากทุกอุปกรณ์ ไม่ต้องสมัครบัญชี', copy: 'คัดลอกรหัสห้อง', private: 'ห้องส่วนตัว', start: 'เริ่มห้อง', room: 'ในห้องนี้', who: 'ใคร<em>เข้าร่วมแล้ว?</em>', roomHint: 'แชร์รหัสด้านบน แล้วดูเพื่อนของคุณเข้าร่วมที่นี่', host: 'เจ้าของห้อง', joined: 'เข้าร่วมเมื่อครู่', waiting: 'รอผู้เล่น', waitingHint: 'ส่งรหัสเชิญให้เพื่อนของคุณ',
    joinRoom: 'เข้าร่วมห้อง', joinTitle: 'พบแก๊ง<br /><em>คนรักเพลง</em>', joinText: 'ใส่ชื่อและรหัสเชิญที่เจ้าของห้องส่งให้คุณ', yourName: 'ชื่อของคุณ', roomCode: 'รหัสห้อง', joinButton: 'เข้าร่วมห้อง', noName: 'ใส่ชื่อของคุณเพื่อให้ห้องรู้ว่าใครเข้าร่วม', badCode: 'รหัสนี้ไม่ตรงกับห้องที่กำลังเปิดอยู่', joinedMessage: 'คุณเข้าร่วมห้องแล้ว กำลังรอเจ้าของห้องเริ่มเกม...', live: 'ห้องกำลังเปิด', crew: 'แก๊งของคุณ<br /><em>อยู่ที่นี่แล้ว</em>', modeLabel: 'โหมด', playersLabel: 'ผู้เล่น', genreLabel: 'แนวเพลง', perSong: 'ต่อเพลง', you: 'คุณ',
  },
};

function renderArtistQuote(language) {
  const quote = document.querySelector('.quote-copy');
  if (quote) quote.innerHTML = `${language === 'TH' ? activeQuote.th : activeQuote.en}<strong>${activeQuote.artist}</strong>`;
}

renderArtistQuote('EN');

function applyLanguage(language) {
  currentLanguage = language;
  const copy = languageCopy[language] || languageCopy.EN;
  const setText = (selector, value) => { const element = document.querySelector(selector); if (element) element.textContent = value; };
  const setHtml = (selector, value) => { const element = document.querySelector(selector); if (element) element.innerHTML = value; };
  setText('.topbar-links a:first-child', copy.navModes); setText('.topbar-links a:last-child', copy.navHow); setText('.eyebrow', copy.warmup);
  setHtml('.hero h1', copy.heroTitle); setText('.hero-description', copy.heroDescription); setText('.js-create-room', copy.create); setText('.js-join-room', copy.join + ' →'); renderArtistQuote(language);
  setText('.section-heading .eyebrow', copy.pick); setText('.section-heading h2', copy.choose); setText('.how-label', `01 ${copy.zero}`); setHtml('.how-copy h2', copy.howTitle); setText('.how-copy p', copy.howText);
  document.querySelectorAll('.mode-card').forEach((card, index) => { setTextFor(card, '.mode-name', copy.modes[index][0]); setTextFor(card, '.mode-detail', copy.modes[index][1]); });
  modeChoices.querySelectorAll('.mode-choice').forEach((choice, index) => { choice.textContent = index === 0 ? modeDisplayNames.Quickfire : copy.modes[index][0]; });
  document.querySelectorAll('.genre-option').forEach((choice, index) => { choice.textContent = copy.genres[index]; });
  const selectedModeIndex = ['Quickfire', 'Decades', 'Head to head', 'Blind spot'].indexOf(selectedMode);
  if (selectedModeIndex >= 0) setText('.selected-mode-label', modeDisplayNames[selectedMode] || copy.modes[selectedModeIndex][0]);
  setText('.profile-panel .eyebrow', copy.profile); setText('.profile-panel label', copy.display); setText('.profile-save', copy.save);
  setText('.setup-header .eyebrow', copy.setup); setHtml('.setup-header h2', copy.make); setText('.setup-fields .setup-field:nth-child(1)>span', copy.yourName); setText('.setup-fields .setup-field:nth-child(2)>span', copy.gameMode); setText('.setup-fields .setup-field:nth-child(2) small', copy.modeHint); setText('.setup-fields .player-setting-field>span', copy.max); setText('.setup-fields .player-setting-field small', copy.maxHint); setText('.setup-fields .genre-setting-field>span', copy.genre); setText('.setup-fields .genre-setting-field small', copy.genreHint); setText('.setup-fields .time-setting-field>span', copy.time); setText('.setup-fields .time-setting-field small', copy.timeHint);
  setText('.invite-panel .eyebrow', copy.invite); setHtml('.invite-panel h3', copy.sendCode); setText('.invite-panel p:not(.eyebrow):not(.copy-status)', copy.inviteHint); setText('.copy-button', copy.copy); setText('.setup-footer>span', copy.private); setText('.launch-button', copy.start);
  setText('.join-content .eyebrow', copy.joinRoom); setHtml('.join-content h2', copy.joinTitle); setText('.join-content>p:not(.eyebrow)', copy.joinText); setText('label[for="player-name"]', copy.yourName); setText('label[for="join-code"]', copy.roomCode); setText('.join-form .primary-button', copy.joinButton);
  setText('.joined-room-heading .eyebrow', copy.live); setHtml('.joined-room-heading h3', copy.crew); setText('.joined-room-heading .host-settings span:nth-child(1) small', copy.modeLabel); setText('.joined-room-heading .host-settings span:nth-child(2) small', copy.playersLabel); setText('.joined-room-heading .host-settings span:nth-child(3) small', copy.genreLabel); setText('.joined-room-heading .host-settings span:nth-child(4) small', copy.perSong);
  const playerValue = document.querySelector('.player-stepper strong');
  if (playerValue) playerValue.textContent = `${Number.parseInt(playerValue.textContent, 10) || 8} ${language === 'TH' ? 'ผู้เล่น' : 'players'}`;
  const timeValue = document.querySelector('.time-setting-field .setting-stepper strong');
  if (timeValue) timeValue.textContent = `${Number.parseInt(timeValue.textContent, 10) || 30} ${language === 'TH' ? 'วินาที' : 'seconds'}`;
  setText('.host-name-field small', language === 'TH' ? 'นี่คือชื่อที่เพื่อนจะเห็น' : 'This is how your crew will see you');
  setHtml('.joined-panel h3', copy.who); setText('.joined-panel .joined-subtitle', copy.roomHint); setText('.joined-panel .joined-player:first-child small', copy.host); setText('.joined-panel .joined-player:nth-child(2) small', copy.joined); setText('.joined-panel .joined-player:last-child strong', copy.waiting); setText('.joined-panel .joined-player:last-child small', copy.waitingHint); setText('.joined-room-heading .joined-subtitle', copy.roomHint); setText('.joined-room-list .joined-player:first-child small', copy.host); setText('.joined-room-list .joined-player:nth-child(2) small', copy.joined); setText('.joined-room-list .joined-player:nth-child(3) small', copy.joined); setText('.joined-room-list .joined-player:last-child small', copy.you);
  document.documentElement.lang = language === 'TH' ? 'th' : 'en';
}

function setTextFor(parent, selector, value) { const element = parent.querySelector(selector); if (element) element.textContent = value; }
