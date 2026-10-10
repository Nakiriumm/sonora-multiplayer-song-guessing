const modeCards = document.querySelectorAll('.mode-card');
const modal = document.querySelector('.modal-backdrop');
const selectedModeLabel = document.querySelector('.selected-mode-label');
const copyStatus = document.querySelector('.copy-status');
let selectedMode = 'Quickfire';

modeCards.forEach((card) => {
  card.addEventListener('click', () => {
    modeCards.forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
    openModal();
  });
});

document.querySelector('.js-create-room').addEventListener('click', () => {
  openModal();
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
  status.textContent = 'You joined the room. Waiting for the host to start...';
  status.className = 'join-status success';
  nameInput.disabled = true;
  input.disabled = true;
  joinPage.querySelector('.join-form .primary-button').disabled = true;
  const waitingPlayer = joinedRoomPanel.querySelector('.waiting strong');
  const waitingSubtitle = joinedRoomPanel.querySelector('.waiting small');
  waitingPlayer.textContent = playerName;
  waitingSubtitle.textContent = 'You';
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
  event.currentTarget.innerHTML = 'Room is ready <span>✓</span>';
  document.querySelector('.setup-footer > span').innerHTML = '<i class="status-dot"></i> Waiting for players';
});

document.querySelectorAll('.room-setting').forEach((select) => {
  if (select.dataset.setting === 'genre') {
    const genreGrid = document.createElement('div');
    genreGrid.className = 'genre-grid';
    Array.from(select.options).forEach((option) => {
      const genre = document.createElement('button');
      genre.type = 'button';
      genre.className = `genre-option${option.selected ? ' selected' : ''}`;
      genre.textContent = option.text;
      genre.addEventListener('click', () => {
        select.value = option.value;
        genreGrid.querySelectorAll('.genre-option').forEach((item) => item.classList.remove('selected'));
        genre.classList.add('selected');
      });
      genreGrid.appendChild(genre);
    });
    select.replaceWith(genreGrid);
    return;
  }

  if (select.dataset.setting === 'players') {
    const playerStepper = document.createElement('div');
    playerStepper.className = 'player-stepper';
    playerStepper.innerHTML = `<button type="button" class="stepper-arrow" aria-label="Remove player">−</button><strong>${select.options[select.selectedIndex].text}</strong><button type="button" class="stepper-arrow" aria-label="Add player">＋</button>`;
    const value = playerStepper.querySelector('strong');
    playerStepper.querySelector('[aria-label="Remove player"]').addEventListener('click', () => changePlayers(-1));
    playerStepper.querySelector('[aria-label="Add player"]').addEventListener('click', () => changePlayers(1));
    select.replaceWith(playerStepper);

    function changePlayers(direction) {
      const currentPlayers = Number.parseInt(value.textContent, 10) || 8;
      const nextPlayers = Math.max(2, Math.min(20, currentPlayers + direction));
      value.textContent = `${nextPlayers} players`;
    }
    return;
  }

  const stepper = document.createElement('div');
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
  }
});

const joinedPanel = document.createElement('section');
joinedPanel.className = 'joined-panel';
joinedPanel.innerHTML = '<div><p class="eyebrow">The room</p><h3>Who is <em>in?</em></h3><p class="joined-subtitle">Share the code above and watch your crew appear here.</p></div><div class="joined-list"><div class="joined-player"><span class="joined-avatar avatar-yellow">JD</span><span><strong>Jordan</strong><small>Room host</small></span><i>✓</i></div><div class="joined-player"><span class="joined-avatar avatar-blue">MK</span><span><strong>Mika</strong><small>Joined just now</small></span><i>✓</i></div><div class="joined-player waiting"><span class="joined-avatar">+</span><span><strong>Waiting for players</strong><small>Send the invite code to your crew</small></span></div></div>';
document.querySelector('.setup-modal').appendChild(joinedPanel);

const hostNameField = document.createElement('label');
hostNameField.className = 'setup-field host-name-field';
hostNameField.innerHTML = '<span>Your name</span><input class="host-name-input" type="text" value="Jordan" maxlength="20" autocomplete="name" /><small>This is how your crew will see you</small>';
document.querySelector('.setup-fields').prepend(hostNameField);
const hostNameInput = hostNameField.querySelector('.host-name-input');
const hostRosterName = joinedPanel.querySelector('.joined-player strong');
hostNameInput.addEventListener('input', () => {
  hostRosterName.textContent = hostNameInput.value.trim() || 'Jordan';
});

const vinylArtwork = document.querySelector('.hero-art');
const vinylParts = [vinylArtwork.querySelector('.record'), vinylArtwork.querySelector('.record-label')];
let vinylResetFrame;

vinylArtwork.addEventListener('mouseenter', () => {
  cancelAnimationFrame(vinylResetFrame);
  vinylArtwork.classList.add('is-vinyl-hovering');
  vinylParts.forEach((part) => {
    part.style.removeProperty('animation');
    part.style.removeProperty('rotate');
    part.style.removeProperty('transition');
  });
});

vinylArtwork.addEventListener('mouseleave', () => {
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

function openModal() {
  selectedModeLabel.textContent = selectedMode;
  modal.hidden = false;
  modal.classList.add('page-view');
  document.body.style.overflow = 'hidden';
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
