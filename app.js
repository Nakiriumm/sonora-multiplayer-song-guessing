const modeCards = document.querySelectorAll('.mode-card');
const modal = document.querySelector('.modal-backdrop');
const selectedModeLabel = document.querySelector('.selected-mode-label');
const copyStatus = document.querySelector('.copy-status');
const availableModes = new Set(['Quickfire', 'SongBomb', 'Solo']);
const modeDisplayNames = { Quickfire: 'Classic', SongBomb: 'Song Bomb', Solo: 'Solo Play' };
const getAppModeName = (mode) => currentLanguage === 'TH'
  ? ({ Quickfire: 'คลาสสิก', SongBomb: 'เกมระเบิดเพลง', Solo: 'เล่นคนเดียว' }[mode] || mode)
  : (modeDisplayNames[mode] || mode);
window.getAppModeName = getAppModeName;
let selectedMode = null;
try {
  // A saved session must not select Solo on the home page. Only restore the
  // multiplayer mode when arriving at the room setup page.
  if (document.body.dataset.roomPage === 'true') {
    const pendingMode = JSON.parse(sessionStorage.getItem('sonora-pending-room') || 'null')?.settings?.mode;
    const sessionMode = JSON.parse(sessionStorage.getItem('sonora-cloudflare-session') || 'null')?.mode;
    const requestedMode = new URLSearchParams(location.search).get('mode');
    if (availableModes.has(requestedMode) && requestedMode !== 'Solo') selectedMode = requestedMode;
    else if (new URLSearchParams(location.search).get('setup') === '1') selectedMode = 'Quickfire';
    else if (availableModes.has(pendingMode) && pendingMode !== 'Solo') selectedMode = pendingMode;
    else if (availableModes.has(sessionMode) && sessionMode !== 'Solo') selectedMode = sessionMode;
  }
} catch {}
window.getSelectedGameMode = () => selectedMode;
const modeRequiredStatus = document.createElement('p');
modeRequiredStatus.className = 'mode-required-status';
modeRequiredStatus.setAttribute('role', 'status');
modeRequiredStatus.textContent = 'Choose a game mode before creating a room.';
modeRequiredStatus.hidden = true;
document.querySelector('.js-create-room')?.parentElement.after(modeRequiredStatus);

modeCards.forEach((card) => {
  card.addEventListener('click', () => {
    if (card.disabled) return;
    modeCards.forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
    modeRequiredStatus.hidden = true;
    const room = getRoomState();
    room.mode = selectedMode;
    saveRoomState(room);
    if (selectedMode !== 'Solo') {
      location.assign(new URL(`room.html?setup=1&mode=${encodeURIComponent(selectedMode)}`, location.href).href);
      return;
    }
    openModal();
  });
});

const joinPage = document.createElement('div');
joinPage.className = 'join-page';
joinPage.hidden = true;
joinPage.innerHTML = '<button class="join-back" type="button">← Back to home</button><div class="join-content"><p class="eyebrow">Join the room</p><h2>Find your<br /><em>music people.</em></h2><p>Enter your name and the room code shared by the host.</p><form class="join-form"><label for="player-name">Your name</label><input id="player-name" type="text" placeholder="e.g. Jamie" autocomplete="name" maxlength="20" /><label for="join-code">Room code</label><input id="join-code" type="text" placeholder="1234567" autocomplete="off" maxlength="7" inputmode="numeric" pattern="[0-9]{7}" /><button class="primary-button" type="submit">Join room <span>→</span></button><small class="join-status" aria-live="polite"></small></form></div><div class="join-note"><span class="wordmark-mark">S</span><strong>SONORA</strong><span>Make some noise.</span></div>';
document.body.appendChild(joinPage);
const joinNameInput = joinPage.querySelector('#player-name');
const joinedRoomPanel = document.createElement('div');
joinedRoomPanel.className = 'joined-room-panel';
joinedRoomPanel.innerHTML = '<div class="joined-room-heading"><p class="eyebrow">Cloudflare room</p><h3>Your crew is <em>here.</em></h3><div class="host-settings"><span><small>Mode</small><strong>Classic</strong></span><span><small>Players</small><strong>8 max</strong></span><span><small>Genre</small><strong>Everything</strong></span><span><small>Per song</small><strong>30 sec</strong></span><span><small>Difficulty</small><strong>Medium</strong></span><span><small>Choices</small><strong>4 choices</strong></span><span><small>Rounds</small><strong>10</strong></span></div></div><div class="joined-room-list"></div>';
joinedRoomPanel.hidden = true;
joinPage.querySelector('.join-content').appendChild(joinedRoomPanel);

document.querySelector('.js-join-room').addEventListener('click', () => {
  joinNameInput.value = localStorage.getItem(profileNameKey) || hostNameInput.value.trim() || '';
  joinPage.hidden = false;
  document.body.style.overflow = 'hidden';
  joinNameInput.focus();
});

joinPage.querySelector('.join-back').addEventListener('click', closeJoinPage);
document.querySelector('.modal-close').addEventListener('click', (event) => {
  if (document.body.dataset.roomPage === 'true') {
    event.preventDefault();
    location.replace(new URL('index.html', location.href).href);
    return;
  }
  closeModal();
});
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

// Round UI and synced room game state.
const gameView = document.createElement('section');
gameView.className = 'game-view'; gameView.hidden = true;
gameView.innerHTML = `<header class="game-topbar"><button class="game-exit" type="button">← Leave room</button><b>SONORA</b><span>ROUND <strong class="game-round">1</strong> / 10</span></header><div class="game-layout"><section class="round-play"><div class="round-heading"><div><p class="eyebrow">Listen close</p><h1>Name that <em>track.</em></h1></div><div class="round-clock"><strong>30</strong><small>SECONDS LEFT</small></div></div><div class="vinyl-stage"><div class="game-vinyl"><span>?</span></div><p>THE NEXT SONG IS READY</p></div><div class="track-progress"><div class="track-line"><i></i></div><div class="track-marks"><span class="active">0.1s</span><span>0.5s</span><span>2s</span><span>8s</span><span>15s</span></div></div><div class="player-controls"><label><span class="speaker-icon">◖))</span><input aria-label="Volume" type="range" min="0" max="100" value="65"></label><button class="game-play" type="button" aria-label="Play current section"><span class="play-icon" aria-hidden="true"></span></button><button class="game-skip" type="button">Skip <span>→</span></button></div><div class="answer-heading"><strong>Pick the song</strong><span class="difficulty-meter difficulty-medium" role="status" aria-label="Song difficulty: medium"><span class="difficulty-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b class="difficulty-label">Medium</b></span><span class="guess-status">4 choices</span></div><div class="song-choices"></div><p class="round-feedback" aria-live="polite">Choose quickly for the highest score.</p></section><aside class="game-leaderboard"><p class="eyebrow">Live scores</p><h2>Leaderboard</h2><div class="score-list"></div><div class="scoring-note"><b>How scoring works</b><p>Correct at 0.1s earns the most. Wrong guesses, later clues, and slower answers reduce your points.</p></div></aside></div>`;
document.body.appendChild(gameView);
const catalogLoadingIndicator=document.createElement('div');
catalogLoadingIndicator.className='catalog-loading-indicator';
catalogLoadingIndicator.innerHTML='<div class="catalog-loading-track" role="progressbar" aria-label="Loading song catalog"><i></i></div><small>First-time catalog loading may take a while.</small>';
gameView.querySelector('.round-feedback').after(catalogLoadingIndicator);
const songBombView = document.createElement('section');
songBombView.className = 'song-bomb-panel';
songBombView.hidden = true;
songBombView.innerHTML = `<header class="game-topbar bomb-topbar"><button class="game-exit" type="button">← Leave room</button><b>SONORA</b><span>SONG BOMB</span></header><p class="eyebrow bomb-mode-label">SONG BOMB</p><div class="bomb-hud"><strong class="bomb-lives"></strong><span class="bomb-turn-status" aria-live="polite"></span></div><div class="bomb-arena"><div class="bomb-seats"></div><div class="bomb-pointer" aria-hidden="true">➤</div><div class="bomb-core"><span class="bomb-icon" aria-hidden="true">💣</span><strong class="bomb-timer">30</strong><small>SECONDS</small></div></div><div class="bomb-log" role="log" aria-live="polite" aria-label="Song Bomb events"></div><p class="bomb-instruction">Name the song or artist before the bomb goes off.</p><form class="bomb-guess-form"><label class="visually-hidden" for="bomb-song-input">Song name or artist</label><input id="bomb-song-input" type="text" maxlength="160" autocomplete="off" placeholder="Type a song name or artist…" /><button class="secondary-button bomb-skip" type="button">Skip turn</button><button class="primary-button bomb-submit" type="submit">Submit guess</button></form><div class="bomb-suggestions" role="listbox" aria-label="Song suggestions"></div><div class="bomb-actions"><span class="bomb-audio-status" aria-live="polite">Song preview</span></div>`;
document.body.appendChild(songBombView);
const roundResult = document.createElement('div');
roundResult.className = 'round-result-backdrop';
roundResult.hidden = true;
roundResult.innerHTML = '<section class="round-result-card" role="dialog" aria-modal="true" aria-labelledby="round-result-title"><div class="result-vinyl"><span>SONORA</span></div><p class="eyebrow">Round complete</p><h2 id="round-result-title" class="notranslate" translate="no">Song revealed</h2><p id="round-result-subtitle" class="song-title-subtitle notranslate" translate="no"></p><p class="result-artist notranslate" translate="no"></p><p class="result-player-status" aria-live="polite"></p><p class="result-countdown">Next round in <b>10</b>s</p><button class="continue-round" type="button">Continue (0/1)</button></section>';
document.body.appendChild(roundResult);
const winnerResult=document.createElement('div');
winnerResult.className='winner-backdrop';
winnerResult.hidden=true;
winnerResult.innerHTML='<section class="winner-card" role="dialog" aria-modal="true" aria-labelledby="winner-title"><div class="winner-crown" aria-hidden="true">♛</div><p class="eyebrow">GAME COMPLETE</p><h2 id="winner-title">The winner</h2><p class="winner-score"></p><button class="winner-exit" type="button">Back to room</button></section>';
document.body.appendChild(winnerResult);
gameView.querySelector('.round-heading h1').hidden = true;
gameView.querySelector('.speaker-icon').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10"></path></svg>';
// Keep the legacy elapsed-time readout node available for the scoring clock.
const elapsedClock = document.createElement('span');
elapsedClock.className = 'attempt-clock';
elapsedClock.hidden = true;
gameView.appendChild(elapsedClock);
const initialGameVolume = Number(localStorage.getItem('sonora-volume'));
const gameVolumeInput = gameView.querySelector('.player-controls input[type="range"]');
if (localStorage.getItem('sonora-volume') !== null && Number.isFinite(initialGameVolume)) {
  gameVolumeInput.value = initialGameVolume;
  gameVolumeInput.style.setProperty('--volume-level', `${initialGameVolume}%`);
}
const roundSongs=[['Blinding Lights','The Weeknd','https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/3f/6c/1a3f6c8c-d367-1bf8-e62e-cb1728eb7042/20UMGIM72379.rgb.jpg/300x300bb.jpg'],['Levitating','Dua Lipa','https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/36/5e/ce/365ece1e-408f-20da-9352-a4d5d12d2bb7/190295089214.jpg/300x300bb.jpg'],['As It Was','Harry Styles','https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/0b/0a/6e/0b0a6e0e-5934-4f4e-2c06-937b772a1b15/196589447485.jpg/300x300bb.jpg'],['Bad Guy','Billie Eilish','https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/47/d7/1d/47d71d60-d0f8-b10c-b0cf-35e3b4fa5b02/19UMGIM17541.rgb.jpg/300x300bb.jpg']];
// Expand the starter four into the demo's 100-song catalog.
roundSongs.push(...[
  ['Hey Jude','The Beatles'],['Let It Be','The Beatles'],['Come Together','The Beatles'],['Here Comes the Sun','The Beatles'],
  ['Bohemian Rhapsody','Queen'],['Don’t Stop Me Now','Queen'],['We Will Rock You','Queen'],['Livin’ on a Prayer','Bon Jovi'],
  ['Billie Jean','Michael Jackson'],['Beat It','Michael Jackson'],['Smooth Criminal','Michael Jackson'],['Thriller','Michael Jackson'],
  ['Smells Like Teen Spirit','Nirvana'],['Come As You Are','Nirvana'],['Wonderwall','Oasis'],['Creep','Radiohead'],
  ['I Wanna Dance with Somebody','Whitney Houston'],['I Will Always Love You','Whitney Houston'],['Fantasy','Mariah Carey'],['No Scrubs','TLC'],
  ['Crazy in Love','Beyoncé'],['Halo','Beyoncé'],['Umbrella','Rihanna'],['Diamonds','Rihanna'],
  ['Rolling in the Deep','Adele'],['Someone Like You','Adele'],['Shape of You','Ed Sheeran'],['Thinking Out Loud','Ed Sheeran'],
  ['Shake It Off','Taylor Swift'],['Blank Space','Taylor Swift'],['Cruel Summer','Taylor Swift'],['Anti-Hero','Taylor Swift'],
  ['Uptown Funk','Mark Ronson'],['Just the Way You Are','Bruno Mars'],['Locked Out of Heaven','Bruno Mars'],['24K Magic','Bruno Mars'],
  ['Starboy','The Weeknd'],['Save Your Tears','The Weeknd'],['Can’t Feel My Face','The Weeknd'],['Dance the Night','Dua Lipa'],
  ['Don’t Start Now','Dua Lipa'],['New Rules','Dua Lipa'],['Happier Than Ever','Billie Eilish'],['Birds of a Feather','Billie Eilish'],
  ['Dynamite','BTS'],['Butter','BTS'],['Viva La Vida','Coldplay'],['Yellow','Coldplay'],
  ['Fix You','Coldplay'],['The Scientist','Coldplay'],['In the End','Linkin Park'],['Numb','Linkin Park'],
  ['What I’ve Done','Linkin Park'],['Lose Yourself','Eminem'],['Without Me','Eminem'],['Not Afraid','Eminem'],
  ['California Gurls','Katy Perry'],['Firework','Katy Perry'],['Roar','Katy Perry'],['Bad Romance','Lady Gaga'],
  ['Poker Face','Lady Gaga'],['Shallow','Lady Gaga'],['Sorry','Justin Bieber'],['Love Yourself','Justin Bieber'],
  ['Peaches','Justin Bieber'],
  ['Dancing Queen','ABBA'],['Mamma Mia','ABBA'],['Gimme! Gimme! Gimme!','ABBA'],['Take On Me','a-ha'],
  ['The Final Countdown','Europe'],['Eye of the Tiger','Survivor'],['Africa','Toto'],['Rosanna','Toto'],
  ['September','Earth, Wind & Fire'],['I Will Survive','Gloria Gaynor'],['Girls Just Want to Have Fun','Cyndi Lauper'],['Like a Prayer','Madonna'],
  ['Vogue','Madonna'],['Crazy','Gnarls Barkley'],['Get Lucky','Daft Punk'],['One More Time','Daft Punk'],
].map(([title,artist])=>[title,artist,'']));
const songAssetCache = new Map();
function normalizeSongText(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
let itunesRequestQueue=Promise.resolve();
let itunesNextRequestAt=0;
function fetchItunesSearch(url,{timeoutMs=12000,status='',intervalMs=3100}={}){
  const request=itunesRequestQueue.then(async()=>{
    const waitMs=Math.max(0,itunesNextRequestAt-Date.now());
    if(waitMs)await new Promise(resolve=>setTimeout(resolve,waitMs));
    itunesNextRequestAt=Date.now()+Math.max(0,Number(intervalMs)||0);
    if(status&&!gameView.hidden&&gameView.dataset.catalogPreparing==='true'){const feedback=gameView.querySelector('.round-feedback');if(feedback)feedback.textContent=status;}
    if(status)window.reportRoomCatalogProgress?.(status);
    return fetch(url,{signal:AbortSignal.timeout(timeoutMs)});
  });
  itunesRequestQueue=request.then(()=>undefined,()=>undefined);
  return request;
}
function loadSongAsset(song){
  const key=`${song[0]}|${song[1]}`;
  if(songAssetCache.has(key))return songAssetCache.get(key);
  if(song[3]){
    const asset=Promise.resolve({trackName:song[0],artistName:song[1],artworkUrl100:song[2]||'',previewUrl:song[3],releaseDate:song[4]||'',catalogRank:song[5]||0});
    songAssetCache.set(key,asset);
    return asset;
  }
  const request=(async()=>{try{const term=encodeURIComponent(`${song[0]} ${song[1]}`);const response=await fetchItunesSearch(`https://itunes.apple.com/search?term=${term}&entity=song&country=US&limit=50`,{timeoutMs:10000,status:`Finding a playable preview for ${song[0]}…`});if(!response.ok)return null;const data=await response.json();const title=normalizeSongText(song[0]),artist=normalizeSongText(song[1]);const matchIndex=data.results.findIndex(result=>normalizeSongText(result.trackName)===title&&normalizeSongText(result.artistName)===artist);return matchIndex<0?null:{...data.results[matchIndex],searchRank:matchIndex+1};}catch{return null;}})();
  songAssetCache.set(key,request);
  return request;
}
const genreArtistSeeds={
  'Everything':['Taylor Swift','The Weeknd','Dua Lipa','Bruno Mars','Beyonce','Rihanna','Drake','Kendrick Lamar','Ariana Grande','Lady Gaga','Coldplay','The Beatles','Queen','Michael Jackson','ABBA','Arctic Monkeys','Radiohead','Ed Sheeran','Adele','YOASOBI','Bodyslam','Jeff Satur'],
  'Pop anthems':['Taylor Swift','Dua Lipa','The Weeknd','Ariana Grande','Bruno Mars','Mark Ronson','Daft Punk','Lady Gaga','Katy Perry','Rihanna','Beyonce','Ed Sheeran','Justin Bieber','Miley Cyrus','Adele','Harry Styles','Olivia Rodrigo','Sabrina Carpenter','Chappell Roan','Billie Eilish','Maroon 5','Kesha','P!nk','Shawn Mendes','Lizzo','Kylie Minogue','Kelly Clarkson','Britney Spears','Christina Aguilera','Demi Lovato','Selena Gomez','Camila Cabello','Sam Smith','Ellie Goulding','One Direction','Niall Horan','Jonas Brothers','The Chainsmokers','Calvin Harris','David Guetta','Avicii','Sia','Jason Derulo','Ne-Yo','Rita Ora','Alicia Keys','Carly Rae Jepsen','The Pussycat Dolls','Destiny’s Child','Fifth Harmony','Tove Lo','Anne-Marie','Ava Max','Tate McRae','Reneé Rapp','Charlie Puth','Khalid','RAYE','Tori Kelly','Pharrell Williams'],
  'Indie & alternative':['Arctic Monkeys','Radiohead','The Strokes','The Killers','Coldplay','Imagine Dragons','Tame Impala','The 1975','Florence + The Machine','Lorde','Twenty One Pilots','Paramore','Nirvana','Oasis','The Cure','Muse','Foo Fighters','Green Day','Weezer','Vampire Weekend','Cage the Elephant','Lana Del Rey','The Cranberries','Blur','Arcade Fire','The National','The Shins','Yeah Yeah Yeahs','The White Stripes','The Black Keys','Kings of Leon','The Lumineers','Of Monsters and Men','Mumford & Sons','Bastille','The xx','MGMT','Foster the People','The Neighbourhood','Hozier','Bon Iver','Sufjan Stevens','Modest Mouse','The Smiths','The War on Drugs','The Kooks','Franz Ferdinand','Placebo','Snow Patrol','Keane','The Script','Garbage','No Doubt','The Smashing Pumpkins','Pixies','Fall Out Boy','Panic! At The Disco','My Chemical Romance','Evanescence','Royal Blood','Nothing But Thieves','The Verve','The B-52s','Blondie'],
  'Hip-hop & R&B':['Drake','Kendrick Lamar','Eminem','SZA','The Weeknd','Beyonce','Rihanna','TLC','Usher','Alicia Keys','Outkast','Jay-Z','Missy Elliott','Tupac','Notorious B.I.G.','Lauryn Hill','Chris Brown','Doja Cat','Post Malone','Travis Scott','Childish Gambino','Mary J. Blige','Bruno Mars','50 Cent','Nas','Lil Wayne','J. Cole','Future','T.I.','Nelly','LL Cool J','Run-DMC','Wu-Tang Clan','A Tribe Called Quest','De La Soul','Beastie Boys','The Roots','Nicki Minaj','Cardi B','Megan Thee Stallion','Ice Cube','Dr. Dre','Snoop Dogg','Wiz Khalifa','Tyler, The Creator','A$AP Rocky','Lil Uzi Vert','Lil Baby','21 Savage','Ludacris','Busta Rhymes','T-Pain','Flo Rida','Frank Ocean','Miguel','John Legend','Ne-Yo','Jhené Aiko','H.E.R.','Brandy','Monica','Erykah Badu','D’Angelo','Maxwell','Boyz II Men'],
  'Throwback classics':['The Beatles','Queen','Michael Jackson','ABBA','Whitney Houston','Elton John','Madonna','Prince','Stevie Wonder','Earth, Wind & Fire','Fleetwood Mac','David Bowie','The Rolling Stones','Bee Gees','Cyndi Lauper','Bon Jovi','a-ha','Toto','Journey','Gloria Gaynor','Eurythmics','Aretha Franklin','The Supremes','Elvis Presley','The Beach Boys','The Kinks','The Who','The Doors','Creedence Clearwater Revival','Simon & Garfunkel','The Carpenters','The Police','The Clash','The Pretenders','The Monkees','The Jackson 5','The Temptations','The Four Tops','Diana Ross','Marvin Gaye','James Brown','Ray Charles','Chuck Berry','The B-52s','Blondie','Tears for Fears','Duran Duran','Culture Club','Def Leppard','Wham!','Hall & Oates','Foreigner','Chicago','Boston','Heart','The Eagles','The Doobie Brothers','The Mamas & the Papas','KISS','Aerosmith','The Velvet Underground','The Meters','The Pointer Sisters','The Bangles','The Go-Go’s'],
  'Thai songs':['Bodyslam','Palmy','Bird Thongchai McIntyre','Slot Machine','Getsunova','Lula','Da Endorphine','Lipta','Three Man Down','Tilly Birds','Only Monday','Ink Waruntorn','Polycat','Scrubb','Potato','Big Ass','Labanoon','Cocktail','Pang Nakarin','Klear','Joey Phuwasit','Jeff Satur','Nont Tanont','Bowkylion','Asanee-Wasan','Carabao','Sek Loso','Pongsit Kamphee','Tata Young','Christina Aguilar','Mai Charoenpura','Thaitanium','F.HERO','Joey Boy','Clash','Retrospect','Sweet Mullet','Musketeers','25hours','Zeal','The Yers','Safeplanet','Desktop Error','Mild','Season Five','Room39','The Parkinson','Violette Wautier','Stamp Apiwat','Tor Saksit','Klear','Lomosonic','Silly Fools','Paradox','Modern Dog','Calories Blah Blah','Bie Sukrit','Kamikaze','Four-Mod','Tata Young','Da Endorphine','The Toys','Max Jenmana','WANYAi','MEAN','SERIOUS BACON','Zom Marie','Three Man Down'],
  'J-Pop':['YOASOBI','Ado','Official HIGE DANdism','Mrs. GREEN APPLE','King Gnu','Kenshi Yonezu','LiSA','Aimyon','Hikaru Utada','AKB48','Perfume','Arashi','Snow Man','back number','Vaundy','Eve','Aimer','RADWIMPS','BUMP OF CHICKEN','Sakanaction','Yorushika','Sukima Switch','Nogizaka46','ONE OK ROCK','UVERworld','Ai Otsuka','Spitz','Mr.Children','B’z','Southern All Stars','YUI','Kana Nishino','milet','Gen Hoshino','Ringo Sheena','Tokyo Jihen','Kyary Pamyu Pamyu','GReeeeN','Koda Kumi','Eir Aoi','Kalafina','UNISON SQUARE GARDEN','ASIAN KUNG-FU GENERATION','The Oral Cigarettes','Miki Matsubara','TM NETWORK','globe','L’Arc-en-Ciel','GLAY','LUNA SEA','Miyavi','NiziU','King & Prince','KAT-TUN','Hey! Say! JUMP','Yuzu','Ikimono-gakari','Superfly','MONGOL800','Every Little Thing','SPEED','ZONE','Mika Nakashima','Mai Kuraki','Misia','Aqua Timez','Fujii Kaze','MONGOL800','Salyu','Chara','JUJU','Kana-Boon','Mrs. GREEN APPLE'],
  'Anime openings':[],
  'Anime endings':[],
  'Vocaloid':['DECO*27','PinocchioP','wowaka','ryo','supercell','kz livetune','livetune','Hachi','Mitchie M','Giga','Kikuo','Kanaria','Neru','Jin','kemu','40mP','buzzG','n-buna','Orangestar','Eve','Ayase','Mikito-P','Hachioji-P','samfree','OSTER project','cosMo@BousouP','sasakure.UK','doriko','rerulili','Last Note.','Junky','halyosy','koyori','Teniwoha','iyowa','MARETU','Utsu-P','Yunosuke','Police Piccadilly','R Sound Design','Chinozo','Surii','Shimon','Satsuki','Harumaki Gohan','Aqu3ra','DIVELA','YurryCanon','Natsushiro Takaaki','164','150P','Hitoshizuku','Yama△','Hitoshizuku×Yama△','YuchaP','SLAVE.V-V-R','MIMI','Hiiragi Magnetite','Yasuha.','Oonuma Paseri','Mafumafu','Tsumiki','niki','Clean Tears','EZFG','Aira','Kairiki Bear','Mao Sasagawa','Yuyoyuppe','Keeno','Tohma','Nakiso','Kinoshita','LamazeP','NayutalieN','Dixie Flatline','AVTechNO!','Iroha(sasaki)','baker','FuwariP','Crusher-P','CircusP','EmpathP','KIRA','GHOST','STEAKA','Mellowcle','Yukopi','R-906','Fushi','Kashii Moimi','Inabakumori','Hachiya Nanashi','kz','Pinocchio P']
};
const animeSeriesSearchTerms = {
  'Anime openings':[
    'Naruto','One Piece','Bleach','Dragon Ball Z','Attack on Titan','Demon Slayer','Jujutsu Kaisen','My Hero Academia','Chainsaw Man','Tokyo Ghoul',
    'Fullmetal Alchemist Brotherhood','Death Note','Hunter x Hunter','Sailor Moon','Neon Genesis Evangelion','Cowboy Bebop','JoJo Bizarre Adventure','Sword Art Online','Fairy Tail','Black Clover',
    'Spy x Family','Haikyu','Oshi no Ko','Frieren Beyond Journey’s End','Blue Lock','Bocchi the Rock','Kaguya-sama Love Is War','Your Lie in April','One Punch Man','Mob Psycho 100',
    'Gintama','Code Geass','Steins Gate','Re Zero','The Apothecary Diaries','Solo Leveling','Psycho-Pass','Fate Stay Night','Inuyasha','The Seven Deadly Sins',
    'Violet Evergarden','Dandadan','Dr Stone','The Promised Neverland','Vinland Saga','Beastars','Made in Abyss','Parasyte','Assassination Classroom','Food Wars',
    'Blue Exorcist','K-On','Initial D','Trigun','Samurai Champloo','Yu Yu Hakusho','Cardcaptor Sakura','Black Butler','Ouran High School Host Club','Pokémon'
  ],
  'Anime endings':[
    'Naruto','One Piece','Bleach','Dragon Ball Z','Attack on Titan','Demon Slayer','Jujutsu Kaisen','My Hero Academia','Chainsaw Man','Tokyo Ghoul',
    'Fullmetal Alchemist Brotherhood','Death Note','Hunter x Hunter','Sailor Moon','Neon Genesis Evangelion','Cowboy Bebop','JoJo Bizarre Adventure','Sword Art Online','Fairy Tail','Black Clover',
    'Spy x Family','Haikyu','Oshi no Ko','Frieren Beyond Journey’s End','Blue Lock','Bocchi the Rock','Kaguya-sama Love Is War','Your Lie in April','One Punch Man','Mob Psycho 100',
    'Gintama','Code Geass','Steins Gate','Re Zero','The Apothecary Diaries','Solo Leveling','Psycho-Pass','Fate Stay Night','Inuyasha','The Seven Deadly Sins',
    'Violet Evergarden','Dandadan','Dr Stone','The Promised Neverland','Vinland Saga','Beastars','Made in Abyss','Parasyte','Assassination Classroom','Food Wars',
    'Blue Exorcist','K-On','Initial D','Trigun','Samurai Champloo','Yu Yu Hakusho','Cardcaptor Sakura','Black Butler','Ouran High School Host Club','Pokémon'
  ]
};
const GENRE_CATALOG_SIZE=3000;
const ANIME_CATALOG_SIZE=300;
const ANIME_SOURCE_CATALOG_SIZE=ANIME_CATALOG_SIZE/2;
const disabledGenres=new Set(['Vocaloid','Anime','Anime openings','Anime endings']);
const getGenreCatalogTarget=(genre)=>genre==='Vocaloid'?1000:animeSeriesSearchTerms[genre]?ANIME_SOURCE_CATALOG_SIZE:GENRE_CATALOG_SIZE;
const getGenreCatalogStorageKey=(genre)=>genre==='Vocaloid'?'sonora-song-catalog-vocaloid-v1':genre==='Thai songs'?'sonora-song-catalog-v10-'+genre:'sonora-song-catalog-v9-'+genre;
const catalogVersionCue=/(?:\b(?:live(?:\s+(?:at|from|in|version|performance))?|demo(?:nstration)?|remaster(?:ed|ing)?|re[\s-]?master(?:ed)?|remix(?:es|ed)?|re[\s-]?record(?:ed|ing)?|alternate(?:\s+take)?|alternative(?:\s+take)?|acoustic|unplugged|radio\s+(?:edit|mix|version)|single\s+(?:edit|mix|version)|album\s+(?:edit|mix|version)|extended(?:\s+(?:version|mix))?|club\s+mix|12[ -]?inch(?:\s+mix)?|instrumental|off[\s-]?vocal|karaoke|cover(?:\s+version)?|tribute\s+(?:to|album|songs?)|made\s+famous\s+by|original\s+(?:artist|version|soundtrack|mix)|sped[\s-]?up|slowed(?:\s+down)?|nightcore|acapella|a[ -]?cappella|clean\s+version|explicit\s+version|full\s+version|music\s+box|piano\s+version|string\s+quartet|anniversary\s+edition|deluxe\s+edition|expanded\s+edition|special\s+edition|collector['\u2019]?s\s+edition|bonus\s+track|mono|stereo|taylor['\u2019]?s\s+version|(?:english|japanese|thai|korean|chinese)\s+version)\b|\u30e9\u30a4\u30d6|\u30ab\u30d0\u30fc|\u30ea\u30df\u30c3\u30af\u30b9|\u30a2\u30b3\u30fc\u30b9\u30c6\u30a3\u30c3\u30af|\u30ea\u30de\u30b9\u30bf\u30fc|\u30ab\u30e9\u30aa\u30b1|\u30a4\u30f3\u30b9\u30c8|\u4f34\u594f)/iu;
const catalogVocaloidAlternateCue=/(?:\b(?:self[-\s]?cover|(?:vocaloid|vocal\s+synth)\s+(?:version|ver\.?|mix)|(?:short|long|alternate|alt)\s+version|alternate\s+mix)\b|\u30bb\u30eb\u30d5\u30ab\u30d0\u30fc|\u5225\u30d0\u30fc\u30b8\u30e7\u30f3)/iu;
const catalogThaiVersionCue=/(?:\u0e04\u0e31\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c|\u0e23\u0e35\u0e21\u0e34\u0e01\u0e0b\u0e4c|\u0e04\u0e32\u0e23\u0e32\u0e42\u0e2d\u0e40\u0e01\u0e30|\u0e1a\u0e23\u0e23\u0e40\u0e25\u0e07|\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e0a\u0e31\u0e19|\u0e2d\u0e30\u0e04\u0e39\u0e2a\u0e15\u0e34\u0e01|\u0e23\u0e35\u0e21\u0e32\u0e2a\u0e40\u0e15\u0e2d\u0e23\u0e4c|\u30e9\u30a4\u30d6|\u30ab\u30d0\u30fc|\u30ea\u30df\u30c3\u30af\u30b9|\u30a2\u30b3\u30fc\u30b9\u30c6\u30a3\u30c3\u30af|\u30ea\u30de\u30b9\u30bf\u30fc|\u30ab\u30e9\u30aa\u30b1|\u30d0\u30fc\u30b8\u30e7\u30f3|\u30a4\u30f3\u30b9\u30c8|\u4f34\u594f)/iu;
const catalogAlternateTitleSuffixCue=/(?:\s+(?:live|demo(?:nstration)?|remaster(?:ed|ing)?|re[\s-]?master(?:ed)?|remix(?:es|ed)?|re[\s-]?record(?:ed|ing)?|alternate(?:\s+take)?|alternative(?:\s+take)?|acoustic|unplugged|radio\s+(?:edit|mix|version)|single\s+(?:edit|mix|version)|album\s+(?:edit|mix|version)|instrumental|off[\s-]?vocal|karaoke|sped[\s-]?up|slowed(?:\s+down)?|nightcore|taylor['\u2019]?s\s+version)|\s[-\u2013\u2014:]\s*(?:live|demo(?:nstration)?|remaster(?:ed|ing)?|remix(?:es|ed)?|acoustic|unplugged|radio\s+(?:edit|mix|version)|instrumental|karaoke|sped[\s-]?up|slowed(?:\s+down)?|nightcore|taylor['\u2019]?s\s+version))$/iu;
const catalogAlternateCollectionCue=/(?:\b(?:live|concert|demo(?:nstration)?|remaster(?:ed|ing)?|re[\s-]?master(?:ed)?|remix(?:es|ed)?|re[\s-]?record(?:ed|ing)?|alternate|alternative|acoustic|unplugged|karaoke|instrumental|off[\s-]?vocal|sped[\s-]?up|slowed|nightcore|taylor['\u2019]?s\s+version|piano\s+version|music\s+box|tribute|covers?)\b|\u30e9\u30a4\u30d6|\u30ab\u30d0\u30fc|\u30ea\u30df\u30c3\u30af\u30b9|\u30a2\u30b3\u30fc\u30b9\u30c6\u30a3\u30c3\u30af|\u30ea\u30de\u30b9\u30bf\u30fc|\u30ab\u30e9\u30aa\u30b1|\u30a4\u30f3\u30b9\u30c8|\u4f34\u594f)/iu;
const catalogCoverMetadataCue=/(?:\b(?:karaoke|tribute\s+(?:to|album|songs?)|covers?\s+(?:version|versions|of|to|songs?|album|collection)|(?:piano|guitar|acoustic|anime|instrumental)\s+covers?|made\s+famous\s+by|originally\s+performed\s+by|in\s+the\s+style\s+of|instrumental\s+versions?|piano\s+versions?|music\s+box|lullaby\s+renditions|rockabye\s+baby|kidz?\s+bop|glee\s+cast|vitamin\s+string\s+quartet|the\s+hit\s+crew|countdown\s+singers|postmodern\s+jukebox|richard\s+cheese)\b)/iu;
const catalogAiSlopCue=/(?:\b(?:suno|udio|elevenlabs|stable\s+audio|ai[ -]?(?:generated|music|song|cover|slop)|generated\s+by\s+ai|made\s+with\s+ai|synthetic\s+(?:artist|music)|voice[ -]?clon(?:e|ed|ing))\b)/iu;
const catalogNonTargetScriptCue=/(?:\p{Script=Hangul}|\p{Script=Cyrillic}|\p{Script=Arabic}|\p{Script=Greek}|\p{Script=Hebrew}|\p{Script=Devanagari}|\p{Script=Bengali}|\p{Script=Gurmukhi}|\p{Script=Gujarati}|\p{Script=Tamil}|\p{Script=Telugu}|\p{Script=Kannada}|\p{Script=Malayalam}|\p{Script=Sinhala}|\p{Script=Lao}|\p{Script=Myanmar})/u;
const catalogNonTargetTitleCue=/(?:\b(?:despacito|bailando|coraz[oó]n|mi\s+gente|la\s+tortura|chantaje|ojos\s+as[ií]|sale\s+el\s+sol|d[ií]a\s+de\s+enero)\b|[áéíóúñü¿¡ãõçàèìòùâêîôûäëïöß])/iu;
function normalizeCatalogName(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();}
for(const genre of Object.keys(genreArtistSeeds))genreArtistSeeds[genre]=[...new Map(genreArtistSeeds[genre].map((artist)=>[normalizeCatalogName(artist),artist])).values()];
genreArtistSeeds['Thai songs'].push(
  '4EVE','PiXXiE','BNK48','CGM48','PROXIE','BUS','LYKN','PERSES','ATLAS','DICE','bamm','Pretzelle','TRINITY',
  'K-OTIC','Faye Fang Kaew','Neko Jump','Girly Berry','Atom Chanakan','Pop Pongkool','Num Kala','Singto Numchok',
  'Ben Chalatit','Boyd Kosiyabong','Pause','Pru','Flure','Crescendo','ETC.','Jetseter','Sqweez Animal','Yokee Playboy',
  'Tattoo Colour','The Richman Toy','P.O.P','B5','Loso','Kala','AB Normal','So Cool','Ebola','The Rube','Karamail',
  'MILLI','SPRITE','YOUNGOHM','UrboyTJ','FIIXD','OG-ANIC','Maiyarap','Wonderframe','Jintara Poonlarp','Tai Orathai',
  'Lamyai Haithongkham','Baitoey R Siam','Monkan Kankoon','TaitosmitH','D Gerrard','Mew Suppasit','Billkin','PP Krit',
  'Nanon Korapat','Ploychompoo','Gam Wichayanee','The Mousses','Kong Saharat','Ruj Suparuj','Aof Pongsak','Lydia Sarunrat',
  'New Jiew','Keng Tachaya','Pijika','Silly Fools','Paradox','Palmy','Zeal','Clash','Retrospect','Sweet Mullet','Musketeers'
);
genreArtistSeeds['Thai songs']=[...new Map(genreArtistSeeds['Thai songs'].map(artist=>[normalizeCatalogName(artist),artist])).values()];
const THAI_CATALOG_ARTIST_CAP=6;
const THAI_CATALOG_BREADTH_TARGET=18;
function capCatalogSongsPerArtist(songs,genre,limit=THAI_CATALOG_ARTIST_CAP){
  if(genre!=='Thai songs'||!Number.isFinite(limit))return songs;
  const counts=new Map();
  return songs.filter(song=>{
    const artist=normalizeCatalogName(song?.[1]);
    if(!artist)return true;
    const count=counts.get(artist)||0;
    if(count>=limit)return false;
    counts.set(artist,count+1);
    return true;
  });
}
function hasThaiCatalogArtistBreadth(catalogs){
  if(!Array.isArray(catalogs))return false;
  const artists=new Set(catalogs.flatMap(pool=>pool.songs||[]).map(song=>normalizeCatalogName(song?.[1])).filter(Boolean));
  return artists.size>=THAI_CATALOG_BREADTH_TARGET;
}
for(const genre of Object.keys(animeSeriesSearchTerms))animeSeriesSearchTerms[genre]=[...new Set(animeSeriesSearchTerms[genre])];
function normalizeCatalogDedupPart(value){return String(value||'').normalize('NFKC').toLowerCase().normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu,'$1').replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim();}
function getCatalogSongDedupeKeys(song,asset=null){
  const metadata=(asset&&typeof asset==='object'?asset:song?.[9])||{};
  const trackId=metadata.trackId||song?.[9]?.trackId;
  const isrc=String(metadata.isrc||song?.[9]?.isrc||'').trim().toUpperCase();
  const title=normalizeCatalogDedupPart(song?.[0]||metadata.trackName).replace(/\b(?:feat(?:uring)?|featuring)\b.*$/u,'').trim();
  const artist=normalizeCatalogDedupPart(song?.[1]||metadata.artistName).replace(/\b(?:feat(?:uring)?|featuring)\b.*$/u,'').trim();
  const keys=[];
  if(trackId)keys.push(`id:${trackId}`);
  if(isrc)keys.push(`isrc:${isrc}`);
  if(title&&artist)keys.push(`title:${title}|artist:${artist}`);
  return keys;
}
function dedupeCatalogSongs(songs){
  const seen=new Set();
  const unique=[];
  for(const song of songs||[]){
    const keys=getCatalogSongDedupeKeys(song);
    if(!keys.length||keys.some((key)=>seen.has(key)))continue;
    keys.forEach((key)=>seen.add(key));
    unique.push(song);
  }
  return unique;
}
function hasVersionAnnotation(title){
  const value=String(title||'').normalize('NFKC');
  const annotations=[...value.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/gu)].map(match=>match[1]||match[2]);
  const suffix=value.match(/\s[-\u2013\u2014:]\s*([^()[\]]+)$/u)?.[1];
  if(suffix)annotations.push(suffix);
  return annotations.some(annotation=>catalogVersionCue.test(annotation)||catalogThaiVersionCue.test(annotation));
}
function isCoverOrAlternateTrack(song,asset=null){
  const metadata=(asset&&typeof asset==='object'?asset:song?.[9])||{};
  const title=String(song?.[0]||metadata.trackName||'').normalize('NFKC');
  const artist=String(song?.[1]||metadata.artistName||'').normalize('NFKC');
  const collection=String(metadata.collectionName||song?.[10]||'').normalize('NFKC');
  if(hasVersionAnnotation(title)||catalogAlternateTitleSuffixCue.test(title)||catalogVocaloidAlternateCue.test(title)||catalogVocaloidAlternateCue.test(collection))return true;
  if(catalogCoverMetadataCue.test(title)||catalogCoverMetadataCue.test(collection)||catalogThaiVersionCue.test(title))return true;
  if(catalogAlternateCollectionCue.test(collection)||catalogThaiVersionCue.test(collection))return true;
  return /\b(?:karaoke|tribute|cover\s+band|cover\s+artists?|cover\s+versions?|the\s+hit\s+crew|countdown\s+singers|glee\s+cast|vitamin\s+string\s+quartet|rockabye\s+baby|kidz?\s+bop|postmodern\s+jukebox|richard\s+cheese)\b/iu.test(artist);
}
function matchesCatalogSeedArtist(artist,seeds){
  const actual=normalizeCatalogName(artist);
  if(!actual)return false;
  return (seeds||[]).some(seed=>{
    const expected=normalizeCatalogName(seed);
    return expected&&(actual===expected||actual.includes(` ${expected} `)||actual.startsWith(`${expected} `)||actual.endsWith(` ${expected}`));
  });
}
function isExpectedCatalogArtist(song,genre){
  const seeds=genreArtistSeeds[genre];
  // Artist searches can return unrelated cover acts; keep tracks credited to a searched performer.
  return !seeds||matchesCatalogSeedArtist(song?.[1],seeds);
}
function getCatalogLanguageHint(song,genre){
  if(genre==='Thai songs'||matchesCatalogSeedArtist(song?.[1],genreArtistSeeds['Thai songs']))return 'th';
  if(genre==='J-Pop'||genre==='Vocaloid'||genre.startsWith('Anime ')||song?.[6]||matchesCatalogSeedArtist(song?.[1],genreArtistSeeds['J-Pop']))return 'ja';
  return 'en';
}
function getSongCatalogLanguage(song,fallbackGenre=''){
  const title=String(song?.[0]||'');
  if(/\p{Script=Thai}/u.test(title))return 'th';
  if(/[\u3040-\u30ff]/u.test(title))return 'ja';
  return getCatalogLanguageHint(song,song?.[9]?.catalogGenre||fallbackGenre||'');
}
window.getSongCatalogLanguage=getSongCatalogLanguage;
function isAllowedCatalogLanguage(song,genre,asset=null){
  const metadata=(asset&&typeof asset==='object'?asset:song?.[9])||{};
  const explicitLanguage=[metadata.language,metadata.languageCode,metadata.trackLanguage,metadata.primaryLanguage,metadata.attributes?.language,metadata.attributes?.languageCode]
    .map(value=>String(value||'').trim().toLowerCase()).find(Boolean);
  if(explicitLanguage){
    const code=explicitLanguage.split(/[-_]/)[0];
    const name=explicitLanguage.replace(/[^a-z]/g,'');
    if(!(['en','th','ja'].includes(code)||['english','thai','japanese'].includes(name)))return false;
  }
  const title=String(song?.[0]||metadata.trackName||'').normalize('NFKC');
  const artist=String(song?.[1]||metadata.artistName||'').normalize('NFKC');
  if(!title)return false;
  if(catalogNonTargetScriptCue.test(title))return false;
  const hasThai=/\p{Script=Thai}/u.test(title);
  const hasKana=/[\u3040-\u30ff]/u.test(title);
  const hasHan=/\p{Script=Han}/u.test(title);
  if(hasThai||hasKana)return true;
  const sourceLanguage=getCatalogLanguageHint(song,genre);
  if(hasHan)return sourceLanguage==='ja';
  // Apple Search lacks a per-track lyric-language field; screen obvious foreign-title cases
  // and use the curated artist list plus storefront for romanized Thai/Japanese releases.
  if(sourceLanguage==='en'&&catalogNonTargetTitleCue.test(title))return false;
  // Japanese and Thai catalogs are built from their native artist lists and storefronts;
  // romanized song titles are common there, so retain those entries as well.
  if(sourceLanguage==='th'||sourceLanguage==='ja')return true;
  // BTS is represented only by its English-language releases in the starter catalog.
  if(normalizeCatalogName(artist)==='bts')return ['dynamite','butter'].includes(normalizeCatalogName(title));
  return true;
}
function isRemixOrInstrumental(song){
  const title=String(song?.[0]||'').normalize('NFKC');
  return /(?:\bremix(?:es|ed)?\b|\binstrumental\b|\boff[\s-]?vocal\b|\bkaraoke\b|\bbacking\s+track\b|\bno\s+vocals\b|\bwithout\s+vocals\b|\u4f34\u594f|\u30a4\u30f3\u30b9\u30c8|\u30ab\u30e9\u30aa\u30b1|\u0e04\u0e32\u0e23\u0e32\u0e42\u0e2d\u0e40\u0e01\u0e30|\u0e1a\u0e23\u0e23\u0e40\u0e25\u0e07|\u0e23\u0e35\u0e21\u0e34\u0e01\u0e0b\u0e4c)/iu.test(title);
}
function isExcludedAnimeTrack(song){
  const title=String(song?.[0]||'').normalize('NFKC');
  return isRemixOrInstrumental(song)||/(?:\btheme(?:\s+song)?\b|\bsoundtrack\b|\boriginal\s+score\b|\bost\b|\bbgm\b|\u30b5\u30a6\u30f3\u30c9\u30c8\u30e9\u30c3\u30af|\u30c6\u30fc\u30de\u66f2)/iu.test(title);
}
function isExcludedCatalogTrack(song,isAnimeSource=false,asset=null,genre=''){
  const metadata=(asset&&typeof asset==='object'?asset:song?.[9])||{};
  const artist=String(song?.[1]||metadata.artistName||'');
  const collection=String(metadata.collectionName||song?.[10]||'');
  return isCoverOrAlternateTrack(song,asset)||catalogAiSlopCue.test(`${song?.[0]||''} ${artist} ${collection}`)||!isAllowedCatalogLanguage(song,genre,asset)||(isAnimeSource?isExcludedAnimeTrack(song):isRemixOrInstrumental(song))||(!isAnimeSource&&!isExpectedCatalogArtist(song,genre));
}
const genreCatalogCache=new Map();
const genreCatalogLoadTasks=new Map();
const everythingGenreCatalogs=new Map();
let activeCatalog=roundSongs;
const genreAliases={'เพลงป๊อป':'Pop anthems','อินดี้และอัลเทอร์เนทีฟ':'Indie & alternative','ฮิปฮอปและอาร์แอนด์บี':'Hip-hop & R&B','เพลงคลาสสิกย้อนยุค':'Throwback classics','เพลงไทย':'Thai songs','เจป๊อป':'J-Pop'};
const catalogDatabasePromise=(()=>{
  if(!('indexedDB' in window))return Promise.resolve(null);
  return new Promise(resolve=>{
    try{
      const request=indexedDB.open('sonora-song-catalogs',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('catalogs'))request.result.createObjectStore('catalogs');};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>resolve(null);
      request.onblocked=()=>resolve(null);
    }catch{resolve(null);}
  });
})();
async function readCatalogStorage(key){
  try{
    const database=await catalogDatabasePromise;
    if(database){
      const value=await new Promise(resolve=>{
        try{const request=database.transaction('catalogs','readonly').objectStore('catalogs').get(key);request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>resolve(null);}catch{resolve(null);}
      });
      if(value!==null)return value;
    }
  }catch{}
  try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}
}
async function writeCatalogStorage(key,value){
  try{
    const database=await catalogDatabasePromise;
    if(database){
      const saved=await new Promise(resolve=>{
        try{
          const transaction=database.transaction('catalogs','readwrite');
          transaction.objectStore('catalogs').put(value,key);
          transaction.oncomplete=()=>resolve(true);
          transaction.onerror=()=>resolve(false);
          transaction.onabort=()=>resolve(false);
        }catch{resolve(false);}
      });
      if(saved)return true;
    }
  }catch{}
  try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
async function removeCatalogStorage(key){
  try{
    const database=await catalogDatabasePromise;
    if(database)await new Promise(resolve=>{
      try{const transaction=database.transaction('catalogs','readwrite');transaction.objectStore('catalogs').delete(key);transaction.oncomplete=()=>resolve();transaction.onerror=()=>resolve();transaction.onabort=()=>resolve();}catch{resolve();}
    });
  }catch{}
  try{localStorage.removeItem(key);}catch{}
}
async function loadSingleGenreCatalogInner(genre, requestedTarget=null) {
  genre = genreAliases[genre] || genre;
  if(disabledGenres.has(genre))return [];
  const artists = genreArtistSeeds[genre];
  const searchTerms = animeSeriesSearchTerms[genre] || artists;
  if (!searchTerms) return roundSongs;
  if (genreCatalogCache.has(genre)) return genreCatalogCache.get(genre);

  const hasAnimeSource = Boolean(animeSeriesSearchTerms[genre]);
  const fullCatalogTarget=getGenreCatalogTarget(genre);
  const catalogTarget=requestedTarget!==null&&requestedTarget!==undefined&&Number.isFinite(Number(requestedTarget))?Math.max(4,Math.min(fullCatalogTarget,Math.round(Number(requestedTarget)))):fullCatalogTarget;
  const thaiArtistLimit=genre==='Thai songs'?(requestedTarget?THAI_CATALOG_ARTIST_CAP:60):Number.POSITIVE_INFINITY;
  const storageKey = getGenreCatalogStorageKey(genre);
  const previousStorageKeys = [
    ...(genre==='Thai songs'?['sonora-song-catalog-v9-'+genre]:[]),
    'sonora-song-catalog-v8-' + genre,
    'sonora-song-catalog-v7-' + genre,
    'sonora-song-catalog-v6-' + genre,
    'sonora-song-catalog-v5-' + genre,
    'sonora-song-catalog-' + (hasAnimeSource ? 'v4-' : 'v3-') + genre,
    'sonora-song-catalog-v2-' + genre,
    'sonora-song-catalog-v1-' + genre
  ];
  const savedRecord=await readCatalogStorage(storageKey);
  const savedSongs=Array.isArray(savedRecord)?savedRecord:(Array.isArray(savedRecord?.songs)?savedRecord.songs:[]);
  const savedComplete=Array.isArray(savedRecord)?savedSongs.length>=fullCatalogTarget:Boolean(savedRecord?.complete&&(genre!=='Vocaloid'||savedSongs.length>=fullCatalogTarget));
  const cleanSaved=capCatalogSongsPerArtist(dedupeCatalogSongs(savedSongs.filter(song=>!isExcludedCatalogTrack(song,hasAnimeSource,null,genre))),genre,thaiArtistLimit).slice(0,fullCatalogTarget);
  if(savedComplete&&cleanSaved.length>=4){
    for(const song of cleanSaved){
      song[9]={...((song[9]&&typeof song[9]==='object')?song[9]:{}),catalogGenre:song[9]?.catalogGenre||genre};
      if(Array.isArray(song)&&song.length>=4)songAssetCache.set(song[0]+'|'+song[1],Promise.resolve({trackName:song[0],artistName:song[1],artworkUrl100:song[2],previewUrl:song[3],...(song[9]||{}),releaseDate:song[4]||'',catalogRank:song[5]||0}));
    }
    genreCatalogCache.set(genre,cleanSaved);
    if(cleanSaved.length!==savedSongs.length)await writeCatalogStorage(storageKey,{complete:true,songs:cleanSaved});
    for(const previousStorageKey of previousStorageKeys)await removeCatalogStorage(previousStorageKey);
    return cleanSaved;
  }

  const catalog = [];
  const seen = new Set();
  const artistCounts = new Map();
  const addSong = (song, asset) => {
    if (!song?.[0] || !song?.[1] || !song?.[3] || isExcludedCatalogTrack(song,hasAnimeSource,asset,genre)) return;
    const artistKey=normalizeCatalogName(song[1]);
    if(genre==='Thai songs'&&(artistCounts.get(artistKey)||0)>=thaiArtistLimit)return;
    song[9]={...((song[9]&&typeof song[9]==='object')?song[9]:{}),catalogGenre:song[9]?.catalogGenre||genre};
    const keys=getCatalogSongDedupeKeys(song,asset);
    if(!keys.length||keys.some((key)=>seen.has(key)))return;
    keys.forEach((key)=>seen.add(key));
    songAssetCache.set(song[0] + '|' + song[1], Promise.resolve(asset || {
      trackName: song[0], artistName: song[1], artworkUrl100: song[2] || '', previewUrl: song[3],
      releaseDate: song[4] || '', catalogRank: song[5] || 0
    }));
    catalog.push(song);
    if(genre==='Thai songs')artistCounts.set(artistKey,(artistCounts.get(artistKey)||0)+1);
  };

  for(const song of cleanSaved)addSong(song);
  for (const previousStorageKey of previousStorageKeys) {
    const previous=await readCatalogStorage(previousStorageKey);
    if(Array.isArray(previous))for(const song of previous)addSong(song);
  }
  if(catalog.length>catalogTarget)catalog.length=catalogTarget;
  if(requestedTarget&&catalog.length>=catalogTarget){catalogSnapshotByGenre.set(genre,catalog);return catalog;}

  let searchesComplete=true;
  for (let offset = 0; offset < searchTerms.length && catalog.length < catalogTarget; offset += 8) {
    const batch = searchTerms.slice(offset, offset + 8);
    const country = genre === 'Thai songs' ? 'TH' : genre === 'J-Pop' || genre === 'Vocaloid' || genre.startsWith('Anime ') ? 'JP' : 'US';
    const results = await Promise.all(batch.map(async (term) => {
      try {
        const searchTerm = animeSeriesSearchTerms[genre] ? `${term} anime ${genre.endsWith('openings') ? 'opening' : 'ending'}` : genre==='Vocaloid' ? `${term} Vocaloid` : term;
        const searchLimit=requestedTarget?80:200;
        const url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(searchTerm)
          + '&entity=song&country=' + country + '&limit=' + searchLimit;
        const response = await fetchItunesSearch(url,{timeoutMs:15000,status:`Searching ${genre} catalog…`,intervalMs:requestedTarget?600:3100});
        if (!response.ok) return { tracks: [], anime: animeSeriesSearchTerms[genre] ? term : '', ok: false };
        const data = await response.json();
        return { tracks: data.results || [], anime: animeSeriesSearchTerms[genre] ? term : '', ok: true };
      } catch {
        return { tracks: [], anime: animeSeriesSearchTerms[genre] ? term : '', ok: false };
      }
    }));
    for(const {ok} of results)if(!ok)searchesComplete=false;
    const maxTrackCount=Math.max(0,...results.map((result)=>result.tracks.length));
    // Interleave each artist/series result list so one prolific search cannot crowd out the rest.
    for(let trackIndex=0;trackIndex<maxTrackCount;trackIndex++){
      for(const {tracks,anime} of results){
        const track=tracks[trackIndex];
        if(!track)continue;
        if (!track.previewUrl || !track.trackName || !track.artistName) continue;
        const entry=[
          track.trackName,
          track.artistName,
          track.artworkUrl100 || '',
          track.previewUrl,
          track.releaseDate || '',
          trackIndex + 1,
          anime
        ];
        entry[9]={collectionName:track.collectionName||'',trackId:track.trackId||0,isrc:track.isrc||''};
        addSong(entry, { ...track, catalogRank: trackIndex + 1 });
        if (catalog.length >= catalogTarget) break;
      }
      if (catalog.length >= catalogTarget) break;
    }
    const batchComplete=catalog.length>=fullCatalogTarget||(genre!=='Vocaloid'&&offset+batch.length>=searchTerms.length&&searchesComplete);
    if(catalog.length>0){
      const stored=await writeCatalogStorage(storageKey,{complete:batchComplete,songs:catalog});
      if(stored)for(const previousStorageKey of previousStorageKeys)await removeCatalogStorage(previousStorageKey);
    }
    catalogSnapshotByGenre.set(genre,catalog);
    if(everythingGenreCatalogs.has(genre))everythingGenreCatalogs.set(genre,catalog);
    if(!gameView.hidden&&gameView.dataset.catalogPreparing==='true'){const feedback=gameView.querySelector('.round-feedback');if(feedback)feedback.textContent=`${genre}: ${catalog.length.toLocaleString()} screened songs found.`;}
  }

  if(!requestedTarget||catalog.length>=fullCatalogTarget)genreCatalogCache.set(genre, catalog);
  if(catalog.length>0){
    const complete=catalog.length>=fullCatalogTarget||(genre!=='Vocaloid'&&searchesComplete&&(!requestedTarget||catalog.length<catalogTarget));
    const stored=await writeCatalogStorage(storageKey,{complete,songs:catalog});
    if(stored)for(const previousStorageKey of previousStorageKeys)await removeCatalogStorage(previousStorageKey);
  }
  return catalog;
}
async function loadSingleGenreCatalog(genre){
  genre=genreAliases[genre]||genre;
  if(disabledGenres.has(genre))return [];
  if(genreCatalogCache.has(genre))return genreCatalogCache.get(genre);
  if(genreCatalogLoadTasks.has(genre))return genreCatalogLoadTasks.get(genre);
  const task=loadSingleGenreCatalogInner(genre);
  genreCatalogLoadTasks.set(genre,task);
  try{return await task;}finally{if(genreCatalogLoadTasks.get(genre)===task)genreCatalogLoadTasks.delete(genre);}
}
async function loadQuickGenreCatalog(genre,target){
  genre=genreAliases[genre]||genre;
  if(disabledGenres.has(genre))return [];
  const cachedCatalog=genreCatalogCache.get(genre);
  if(cachedCatalog&&cachedCatalog.length>=target)return cachedCatalog;
  const key=`${genre}:${target}`;
  if(quickCatalogLoadTasks.has(key))return quickCatalogLoadTasks.get(key);
  const task=loadSingleGenreCatalogInner(genre,target);
  quickCatalogLoadTasks.set(key,task);
  try{return await task;}finally{if(quickCatalogLoadTasks.get(key)===task)quickCatalogLoadTasks.delete(key);}
}
const sourceGenres=['Pop anthems','Indie & alternative','Hip-hop & R&B','Throwback classics','Thai songs','J-Pop'];
const getGenreBalanceKey=genre=>String(genre||'Everything').startsWith('Anime ')?'Anime':String(genre||'Everything');
window.getGenreBalanceKey=getGenreBalanceKey;
const combinedGenres=['Everything',...sourceGenres];
function splitGenreSelection(value){return String(value||'Everything').split('|').map(genre=>genreAliases[genre]||genre).filter(genre=>genre&&!disabledGenres.has(genre));}
function expandGenrePools(genre){return genre==='Anime'?['Anime openings','Anime endings']:[genre];}
function genreSelectionKeys(value){const selected=splitGenreSelection(value);return [...new Set([...selected,...selected.flatMap(expandGenrePools)])];}
function mergeGenrePools(pools){return [...new Map(pools.map(pool=>[pool.name,pool])).values()];}
let catalogSnapshotsReady=false;
const catalogSnapshotByGenre=new Map();
const catalogExpansionTasks=new Map();
const quickCatalogLoadTasks=new Map();
const deferredCatalogExpansionGenres=new Set();
async function loadCachedGenreSnapshot(genre){
  if(disabledGenres.has(genreAliases[genre]||genre))return [];
  const hasAnimeSource=Boolean(animeSeriesSearchTerms[genre]);
  const keys=[
    getGenreCatalogStorageKey(genre),'sonora-song-catalog-v9-'+genre,'sonora-song-catalog-v8-'+genre,'sonora-song-catalog-v7-'+genre,
    'sonora-song-catalog-v6-'+genre,'sonora-song-catalog-v5-'+genre,
    'sonora-song-catalog-'+(hasAnimeSource?'v4-':'v3-')+genre,
    'sonora-song-catalog-v2-'+genre,'sonora-song-catalog-v1-'+genre
  ];
  const records=await Promise.all(keys.map(readCatalogStorage));
  const songs=[];
  for(const record of records){
    if(Array.isArray(record))songs.push(...record);
    else if(Array.isArray(record?.songs))songs.push(...record.songs);
  }
  const clean=capCatalogSongsPerArtist(dedupeCatalogSongs(songs.filter(song=>!isExcludedCatalogTrack(song,hasAnimeSource,null,genre))),genre).slice(0,getGenreCatalogTarget(genre));
  for(const song of clean){
    song[9]={...((song[9]&&typeof song[9]==='object')?song[9]:{}),catalogGenre:song[9]?.catalogGenre||genre};
    if(song[3])songAssetCache.set(`${song[0]}|${song[1]}`,Promise.resolve({trackName:song[0],artistName:song[1],artworkUrl100:song[2]||'',previewUrl:song[3],...(song[9]||{}),releaseDate:song[4]||'',catalogRank:song[5]||0}));
  }
  return clean;
}
function mergeCatalogEntries(songs){
  const merged=[];
  const seen=new Set();
  let animeCount=0;
  const animeCountBySource=new Map();
  for(const song of songs){
    if(disabledGenres.has(song?.[9]?.catalogGenre))continue;
    if(disabledGenres.has('Anime')&&song?.[6])continue;
    if(!Array.isArray(song)||!song[0]||!song[1]||isExcludedCatalogTrack(song,Boolean(song[6]),null,song[9]?.catalogGenre||''))continue;
    if(!song[6]&&!roundSongs.includes(song)&&!sourceGenres.some(name=>matchesCatalogSeedArtist(song[1],genreArtistSeeds[name])))continue;
    const catalogGenre=song[9]?.catalogGenre||'';
    const animeSource=catalogGenre==='Anime openings'||catalogGenre==='Anime endings'?catalogGenre:'';
    if(animeSource&&(animeCount>=ANIME_CATALOG_SIZE||(animeCountBySource.get(animeSource)||0)>=ANIME_SOURCE_CATALOG_SIZE))continue;
    if(!animeSource&&song[6]&&animeCount>=ANIME_CATALOG_SIZE)continue;
    const keys=getCatalogSongDedupeKeys(song);
    if(!keys.length||keys.some(key=>seen.has(key)))continue;
    keys.forEach(key=>seen.add(key));
    merged.push(song);
    if(animeSource){animeCount+=1;animeCountBySource.set(animeSource,(animeCountBySource.get(animeSource)||0)+1);}
    else if(song[6])animeCount+=1;
  }
  return merged;
}
async function prepareCatalogSnapshots(){
  if(!catalogSnapshotsReady){
    const snapshots=await Promise.all(sourceGenres.map(async name=>[name,await loadCachedGenreSnapshot(name)]));
    everythingGenreCatalogs.clear();
    snapshots.forEach(([name,songs])=>{everythingGenreCatalogs.set(name,songs);catalogSnapshotByGenre.set(name,songs);});
    catalogSnapshotsReady=true;
  }
  return mergeCatalogEntries([...roundSongs,...[...everythingGenreCatalogs.values()].flat()]);
}
async function loadGenreCatalog(genre) {
  genre=genreAliases[genre]||genre;
  if(disabledGenres.has(genre))return [];
  if(genre==='Anime'){
    const catalogs=await Promise.all([loadSingleGenreCatalog('Anime openings'),loadSingleGenreCatalog('Anime endings')]);
    return dedupeCatalogSongs(catalogs.flat());
  }
  if(genre!=='Everything')return loadSingleGenreCatalog(genre);
  if(genreCatalogCache.has('Everything')&&everythingGenreCatalogs.size)return genreCatalogCache.get('Everything');
  const cacheKey='sonora-song-catalog-v9-Everything';
  let cachedSongs=[];
  for(const key of [cacheKey,'sonora-song-catalog-v8-Everything','sonora-song-catalog-v7-Everything','sonora-song-catalog-v6-Everything','sonora-song-catalog-v5-Everything']){
    const cached=await readCatalogStorage(key);
    const complete=cached?.counts&&combinedGenres.every((name)=>cached.counts[name]>=getGenreCatalogTarget(name));
    if(complete&&Array.isArray(cached.songs)){cachedSongs=cached.songs;break;}
  }
  const existing=[];
  for(const key of ['sonora-song-catalog-v4-Everything','sonora-song-catalog-v3-Everything','sonora-song-catalog-v2-Everything','sonora-song-catalog-v1-Everything']){
    const saved=await readCatalogStorage(key);
    if(Array.isArray(saved))existing.push(...saved);
  }
  const catalogs=await Promise.all(sourceGenres.map(loadSingleGenreCatalog));
  everythingGenreCatalogs.clear();
  sourceGenres.forEach((name,index)=>everythingGenreCatalogs.set(name,catalogs[index]));
  const merged=mergeCatalogEntries([...roundSongs,...existing,...cachedSongs,...catalogs.flat()]);
  genreCatalogCache.set('Everything',merged);
  const counts=Object.fromEntries(sourceGenres.map((name,index)=>[name,catalogs[index].length]));
  counts.Everything=merged.length;
  if(combinedGenres.every((name)=>counts[name]>=getGenreCatalogTarget(name))){
    await writeCatalogStorage(cacheKey,{counts,songs:merged});
  } else await removeCatalogStorage(cacheKey);
  for(const key of ['sonora-song-catalog-v8-Everything','sonora-song-catalog-v7-Everything','sonora-song-catalog-v6-Everything','sonora-song-catalog-v5-Everything','sonora-song-catalog-v4-Everything','sonora-song-catalog-v3-Everything','sonora-song-catalog-v2-Everything','sonora-song-catalog-v1-Everything'])await removeCatalogStorage(key);
  return merged;
}
window.getRoundSongCatalogs=async(genre='Everything')=>{
  genre=genreAliases[genre]||genre;
  if(disabledGenres.has(genre))return [];
  if(genre.includes('|')){
    const selected=splitGenreSelection(genre);
    if(catalogExpansionTasks.has(genre)||deferredCatalogExpansionGenres.has(genre)){
      return mergeGenrePools(selected.flatMap(expandGenrePools).map(name=>({name,songs:catalogSnapshotByGenre.get(name)||[]})));
    }
    const catalogs=await Promise.all(selected.map(name=>window.getRoundSongCatalogs(name)));
    return mergeGenrePools(catalogs.flat());
  }
  if(genre==='Anime'){
    if(catalogExpansionTasks.has('Anime')||deferredCatalogExpansionGenres.has('Anime')){
      const openings=catalogSnapshotByGenre.get('Anime openings')||[];
      const endings=catalogSnapshotByGenre.get('Anime endings')||[];
      return [{name:'Anime openings',songs:openings},{name:'Anime endings',songs:endings}];
    }
    const [openings,endings]=await Promise.all([loadSingleGenreCatalog('Anime openings'),loadSingleGenreCatalog('Anime endings')]);
    return [{name:'Anime openings',songs:openings},{name:'Anime endings',songs:endings}];
  }
  if(genre==='Everything'){
    if(catalogExpansionTasks.has('Everything')||catalogSnapshotsReady||deferredCatalogExpansionGenres.has('Everything')){
      const snapshots=[...everythingGenreCatalogs].filter(([,songs])=>songs.length>=4).map(([name,songs])=>({name,songs}));
      return snapshots.length?snapshots:[{name:'Everything',songs:[]}];
    }
    await loadGenreCatalog('Everything');
    return [...everythingGenreCatalogs].map(([name,songs])=>({name,songs}));
  }
  if(catalogExpansionTasks.has(genre)||deferredCatalogExpansionGenres.has(genre))return [{name:genre,songs:catalogSnapshotByGenre.get(genre)||[]}];
  return [{name:genre,songs:await loadSingleGenreCatalog(genre)}];
};
window.getCachedRoundSongCatalogs=async(genre='Everything')=>{
  genre=genreAliases[genre]||genre;
  if(disabledGenres.has(genre))return [];
  if(genre.includes('|')){
    const selected=splitGenreSelection(genre);
    const catalogs=await Promise.all(selected.map(name=>window.getCachedRoundSongCatalogs(name)));
    return mergeGenrePools(catalogs.flat());
  }
  if(genre==='Everything'){
    await prepareCatalogSnapshots();
    const catalogs=[...everythingGenreCatalogs].filter(([,entries])=>entries.length>=4).map(([name,entries])=>({name,songs:entries}));
    return catalogs.length?catalogs:[{name:'Everything',songs:[]}];
  }
  if(genre==='Anime'){
    const [openings,endings]=await Promise.all([loadCachedGenreSnapshot('Anime openings'),loadCachedGenreSnapshot('Anime endings')]);
    catalogSnapshotByGenre.set('Anime openings',openings);
    catalogSnapshotByGenre.set('Anime endings',endings);
    const catalogs=[['Anime openings',openings],['Anime endings',endings]].filter(([,entries])=>entries.length>=4).map(([name,entries])=>({name,songs:entries}));
    return catalogs.length?catalogs:[{name:'Anime openings',songs:openings},{name:'Anime endings',songs:endings}];
  }
  const songs=await loadCachedGenreSnapshot(genre);
  catalogSnapshotByGenre.set(genre,songs);
  return [{name:genre,songs}];
};
window.getRoomStartupCatalogs=async(genre='Everything',requiredCount=40,difficulty='medium',minimumChoiceCount=4,requireAllGenres=false)=>{
  genre=genreAliases[genre]||genre;
  if(disabledGenres.has(genre))genre='Everything';
  const required=Math.max(4,Math.min(500,Number(requiredCount)||40));
  const minimumPerPool=Math.max(4,Math.min(8,Number(minimumChoiceCount)||4));
  const difficultyMultiplier={easy:2,medium:4,hard:8,extreme:12}[difficulty]||4;
  const rankCoverageTarget={easy:64,medium:144,hard:304,extreme:480}[difficulty]||144;
  const expansionTarget=(count,sourceGenre)=>Math.min(getGenreCatalogTarget(sourceGenre),Math.max(count+4,count*difficultyMultiplier+4,rankCoverageTarget));
  const playableCount=catalogs=>(catalogs||[]).reduce((sum,pool)=>sum+(pool.songs||[]).filter(song=>song?.[3]&&getSongDifficulty(song)===difficulty).length,0);
  const hasPlayablePool=catalogs=>(catalogs||[]).some(pool=>(pool.songs||[]).filter(song=>song?.[3]&&getSongDifficulty(song)===difficulty).length>=minimumPerPool);
  const everythingBalanceGenres=[...new Set(sourceGenres.map(getGenreBalanceKey))];
  const requiredRounds=Math.ceil(required/minimumPerPool);
  const requiredPerEverythingGenre=Math.max(minimumPerPool,Math.ceil(requiredRounds/everythingBalanceGenres.length)*minimumPerPool);
  const playableCountsByGenre=catalogs=>{
    const counts=new Map();
    for(const pool of catalogs||[]){
      const count=(pool.songs||[]).filter(song=>song?.[3]&&getSongDifficulty(song)===difficulty).length;
      const key=getGenreBalanceKey(pool.name);
      counts.set(key,(counts.get(key)||0)+count);
    }
    return counts;
  };
  const hasEverythingGenreCoverage=catalogs=>{
    const counts=playableCountsByGenre(catalogs);
    return everythingBalanceGenres.every(name=>(counts.get(name)||0)>=requiredPerEverythingGenre);
  };
  let catalogs=await window.getCachedRoundSongCatalogs(genre);
  const cachedCatalogsReady=playableCount(catalogs)>=required&&hasPlayablePool(catalogs);
  const includesThaiSongs=genre==='Thai songs'||(genre.includes('|')&&splitGenreSelection(genre).includes('Thai songs'));
  const thaiCatalogHasBreadth=!includesThaiSongs||hasThaiCatalogArtistBreadth(catalogs.filter(pool=>pool.name==='Thai songs'));
  const hasAllSourceGenres=sourceGenres.every(name=>catalogs.some(pool=>pool.name===name));
  const everythingCatalogReady=genre!=='Everything'||(requireAllGenres?hasAllSourceGenres:required<=minimumPerPool||hasEverythingGenreCoverage(catalogs));
  if(cachedCatalogsReady&&thaiCatalogHasBreadth&&everythingCatalogReady)return catalogs;
  if(genre.includes('|')){
    const selected=splitGenreSelection(genre).flatMap(expandGenrePools);
    const groups=new Map(catalogs.map(({name,songs})=>[name,songs||[]]));
    for(const sourceGenre of selected.sort(()=>Math.random()-.5)){
      const target=expansionTarget(Math.ceil(required/selected.length),sourceGenre);
      groups.set(sourceGenre,await loadQuickGenreCatalog(sourceGenre,target));
      catalogs=[...groups].map(([name,songs])=>({name,songs}));
    }
    catalogs=[...groups].map(([name,songs])=>({name,songs}));
    if(playableCount(catalogs)<required||!hasPlayablePool(catalogs))throw new Error(`Only ${playableCount(catalogs)} playable ${difficulty} songs are cached for ${genre.replaceAll('|', ', ')}. Check your connection and try again.`);
    return catalogs;
  }
  if(genre==='Everything'){
    const groups=new Map(sourceGenres.map(name=>[name,[]]));
    for(const pool of catalogs)if(pool.name!=='Everything')groups.set(pool.name,pool.songs||[]);
    const cachedCounts=playableCountsByGenre(catalogs);
    let genresToLoad;
    if(required<=minimumPerPool){
      // Start the first round quickly from a few pools; fill all selected genres in the background.
      genresToLoad=requireAllGenres?[...sourceGenres]:[...sourceGenres].sort(()=>Math.random()-.5).slice(0,3);
    }else{
      const underfilledGenres=new Set(everythingBalanceGenres.filter(name=>(cachedCounts.get(name)||0)<requiredPerEverythingGenre));
      genresToLoad=sourceGenres.filter(name=>underfilledGenres.has(getGenreBalanceKey(name)));
    }
    const perGenreRequired=Math.ceil(required/everythingBalanceGenres.length);
    const loadedPools=await Promise.all(genresToLoad.map(async sourceGenre=>{
      const target=expansionTarget(perGenreRequired,sourceGenre);
      return [sourceGenre,await loadQuickGenreCatalog(sourceGenre,target)];
    }));
    loadedPools.forEach(([name,songs])=>groups.set(name,songs));
    catalogs=[...groups].map(([name,songs])=>({name,songs}));
  }else if(genre==='Anime'){
    const target=expansionTarget(Math.ceil(required/2),'Anime openings');
    const [openings,endings]=await Promise.all([loadQuickGenreCatalog('Anime openings',target),loadQuickGenreCatalog('Anime endings',target)]);
    catalogs=[{name:'Anime openings',songs:openings},{name:'Anime endings',songs:endings}];
  }else{
    catalogs=[{name:genre,songs:await loadQuickGenreCatalog(genre,expansionTarget(required,genre))}];
  }
  if(playableCount(catalogs)<required||!hasPlayablePool(catalogs))throw new Error(`Only ${playableCount(catalogs)} playable ${difficulty} songs are cached for ${genre}. Check your connection and try again.`);
  return catalogs;
};
function getSongDifficulty(song,asset){
  const streamCount=[song?.totalStreams,song?.streams,song?.[7],asset?.totalStreams,asset?.playCount,asset?.streams]
    .map(Number).find((value)=>Number.isFinite(value)&&value>0);
  if(streamCount){
    if(streamCount>=1_000_000_000)return 'easy';
    if(streamCount>=100_000_000)return 'medium';
    if(streamCount>=10_000_000)return 'hard';
    return 'extreme';
  }
  const popularityValue=[song?.popularity,song?.[8],asset?.popularity]
    .map(Number).find((value)=>Number.isFinite(value)&&value>=0&&value<=100);
  if(popularityValue!==undefined){
    if(popularityValue>=90)return 'easy';
    if(popularityValue>=70)return 'medium';
    if(popularityValue>=30)return 'hard';
    return 'extreme';
  }
  const rank=Number(song?.[5]||asset?.catalogRank||asset?.searchRank)||0;
  // Apple Search has no stream totals; its result order is the available popularity proxy.
  if(rank>0&&rank<=8)return 'easy';
  if(rank<=18&&rank>8)return 'medium';
  if(rank<=38&&rank>18)return 'hard';
  if(rank>38)return 'extreme';
  return 'medium';
}
const jpopTitleAliases = new Map([
  ['\u591c\u306b\u99c6\u3051\u308b', { english: 'Into the Night', romaji: 'Yoru ni Kakeru' }],
  ['\u602a\u7269', { english: 'Monster', romaji: 'Kaibutsu' }],
  ['\u7fa4\u9752', { english: 'Blue', romaji: 'Gunjou' }],
  ['\u52c7\u8005', { english: 'The Brave', romaji: 'Yuusha' }],
  ['\u30a2\u30a4\u30c9\u30eb', { english: 'Idol', romaji: 'Aidoru' }],
  ['\u795d\u798f', { english: 'The Blessing', romaji: 'Shukufuku' }],
  ['\u4e09\u539f\u8272', { english: 'RGB', romaji: 'Sangenshoku' }],
  ['\u305f\u3076\u3093', { english: 'Probably', romaji: 'Tabun' }],
  ['\u3042\u306e\u5922\u3092\u306a\u305e\u3063\u3066', { english: 'Tracing That Dream', romaji: 'Ano Yume wo Nazotte' }],
  ['\u65b0\u6642\u4ee3', { english: 'New Genesis', romaji: 'Shin Jidai' }],
  ['\u79c1\u306f\u6700\u5f37', { english: "I'm Invincible", romaji: 'Watashi wa Saikyou' }],
  ['\u9006\u5149', { english: 'Backlight', romaji: 'Gyakkou' }],
  ['\u9752\u306e\u3059\u307f\u304b', { english: 'Where Our Blue Is', romaji: 'Ao no Sumika' }],
  ['\u305f\u3060\u541b\u306b\u6674\u308c', { english: 'Just a Sunny Day for You', romaji: 'Tada Kimi ni Hare' }],
  ['\u6625\u6ce5\u68d2', { english: 'Spring Thief', romaji: 'Haru Dorobou' }],
  ['\u82b1\u306b\u306a\u3063\u3066', { english: 'Be a Flower', romaji: 'Hana ni Natte' }],
  ['\u512a\u3057\u3044\u5f57\u661f', { english: 'Comet', romaji: 'Yasashii Suisei' }],
  ['\u6c38\u9060\u306e\u3042\u304f\u308b\u65e5', { romaji: 'Eien no Akuru Hi' }],
  ['\u5411\u65e5\u8475', { romaji: 'Himawari' }],
  ['\u611f\u96fb', { romaji: 'Kanden' }],
  ['\u99ac\u3068\u9e7f', { romaji: 'Uma to Shika' }],
  ['\u5730\u7403\u5100', { english: 'Spinning Globe', romaji: 'Chikyuu Gi' }],
  ['\u7070\u8272\u3068\u9752', { english: 'Gray and Blue', romaji: 'Haiiro to Ao' }],
  ['\u88f8\u306e\u5fc3', { romaji: 'Hadaka no Kokoro' }],
  ['\u541b\u306f\u30ed\u30c3\u30af\u3092\u8074\u304b\u306a\u3044', { romaji: 'Kimi wa Rock wo Kikanai' }],
  ['\u30de\u30ea\u30fc\u30b4\u30fc\u30eb\u30c9', { romaji: 'Marigold' }],
  ['\u30ab\u30bf\u30aa\u30e2\u30a4', { romaji: 'Kataomoi' }],
  ['\u7d05\u84ee\u83ef', { romaji: 'Gurenge' }],
  ['\u708e', { romaji: 'Homura' }],
  ['\u6b8b\u97ff\u6563\u6b4c', { romaji: 'Zankyosanka' }],
  ['\u30ae\u30e9\u30ae\u30e9', { romaji: 'Gira Gira' }],
  ['\u963f\u4fee\u7f85\u3061\u3083\u3093', { romaji: 'Ashura-chan' }],
  ['\u4f1a\u3044\u305f\u304f\u3066', { romaji: 'Aitakute' }],
  ['\u3082\u3057\u3082\u547d\u304c\u63cf\u3051\u305f\u3089', { english: 'If I Could Draw Life', romaji: 'Moshimo Inochi ga Egaketara' }],
  ['\u6bce\u65e5', { romaji: 'Mainichi' }],
  ['\u541b\u3068\u590f\u30d5\u30a7\u30b9', { romaji: 'Kimi to Natsu Fesu' }],
  ['\u5f37\u98a8\u30aa\u30fc\u30eb\u30d0\u30c3\u30af', { romaji: 'Kyoufuu All Back' }],
]);
const kanaToRomaji = new Map(Object.entries({
  '\u3042':'a','\u3044':'i','\u3046':'u','\u3048':'e','\u304a':'o','\u304b':'ka','\u304d':'ki','\u304f':'ku','\u3051':'ke','\u3053':'ko','\u3055':'sa','\u3057':'shi','\u3059':'su','\u305b':'se','\u305d':'so','\u305f':'ta','\u3061':'chi','\u3064':'tsu','\u3066':'te','\u3068':'to','\u306a':'na','\u306b':'ni','\u306c':'nu','\u306d':'ne','\u306e':'no','\u306f':'ha','\u3072':'hi','\u3075':'fu','\u3078':'he','\u307b':'ho','\u307e':'ma','\u307f':'mi','\u3080':'mu','\u3081':'me','\u3082':'mo','\u3084':'ya','\u3086':'yu','\u3088':'yo','\u3089':'ra','\u308a':'ri','\u308b':'ru','\u308c':'re','\u308d':'ro','\u308f':'wa','\u3090':'wi','\u3091':'we','\u3092':'o','\u3093':'n',
  '\u304c':'ga','\u304e':'gi','\u3050':'gu','\u3052':'ge','\u3054':'go','\u3056':'za','\u3058':'ji','\u305a':'zu','\u305c':'ze','\u305e':'zo','\u3060':'da','\u3062':'ji','\u3065':'zu','\u3067':'de','\u3069':'do','\u3070':'ba','\u3073':'bi','\u3076':'bu','\u3079':'be','\u307c':'bo','\u3071':'pa','\u3074':'pi','\u3077':'pu','\u307a':'pe','\u307d':'po','\u3094':'vu',
  '\u3041':'a','\u3043':'i','\u3045':'u','\u3047':'e','\u3049':'o','\u3083':'ya','\u3085':'yu','\u3087':'yo','\u3063':'','\u30fc':'-'
}));
const kanaDigraphs = new Map(Object.entries({
  '\u304d\u3083':'kya','\u304d\u3085':'kyu','\u304d\u3087':'kyo','\u3057\u3083':'sha','\u3057\u3085':'shu','\u3057\u3087':'sho','\u3061\u3083':'cha','\u3061\u3085':'chu','\u3061\u3087':'cho','\u306b\u3083':'nya','\u306b\u3085':'nyu','\u306b\u3087':'nyo','\u3072\u3083':'hya','\u3072\u3085':'hyu','\u3072\u3087':'hyo','\u307f\u3083':'mya','\u307f\u3085':'myu','\u307f\u3087':'myo','\u308a\u3083':'rya','\u308a\u3085':'ryu','\u308a\u3087':'ryo','\u304e\u3083':'gya','\u304e\u3085':'gyu','\u304e\u3087':'gyo','\u3058\u3083':'ja','\u3058\u3085':'ju','\u3058\u3087':'jo','\u3073\u3083':'bya','\u3073\u3085':'byu','\u3073\u3087':'byo','\u3074\u3083':'pya','\u3074\u3085':'pyu','\u3074\u3087':'pyo'
}));
function romanizeKana(value) {
  const hiragana = value.replace(/[\u30a1-\u30f6]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
  const output = [];
  let geminate = false;
  for (let index = 0; index < hiragana.length; index += 1) {
    const character = hiragana[index];
    if (character === '\u3063') { geminate = true; continue; }
    if (character === '\u30fc') {
      const previous = output.at(-1) || '';
      const vowel = previous.match(/[aeiou](?!.*[aeiou])/i)?.[0];
      if (vowel) output.push(vowel);
      continue;
    }
    const pair = kanaDigraphs.get(character + (hiragana[index + 1] || ''));
    const romaji = pair || kanaToRomaji.get(character);
    if (!romaji) { output.push(character); geminate = false; continue; }
    if (pair) index += 1;
    const next = geminate && romaji ? romaji[0] + romaji : romaji;
    if (character === '\u3093' && /^[aeiouy]/i.test(next)) output.push("n'");
    else output.push(next);
    geminate = false;
  }
  return output.join('').replace(/\s+/g, ' ').trim();
}
function getJPopSubtitle(song, genre = activeRoundGenre) {
  if (genre !== 'J-Pop' || !song?.[0] || !/[\u3040-\u30ff\u3400-\u9fff]/u.test(song[0])) return '';
  const alias = song[7] && typeof song[7] === 'object' ? song[7] : {};
  const known = jpopTitleAliases.get(song[0].normalize('NFC')) || {};
  return alias.english || known.english || '';
}
window.getJPopSubtitle = getJPopSubtitle;
const vocaloidSubtitleCacheKey='sonora-vocaloid-title-subtitles-v2';
const vocaloidSubtitleCache=new Map();
const vocaloidSubtitleRequests=new Map();
try{const saved=JSON.parse(localStorage.getItem(vocaloidSubtitleCacheKey)||'{}');for(const [key,value] of Object.entries(saved))if(value&&typeof value.subtitle==='string'&&value.expires>Date.now())vocaloidSubtitleCache.set(key,value.subtitle);}catch{}
function normalizeVocaloidTitle(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,'').trim();}
function getVocaloidTitleSubtitle(song){
  const title=String(song?.[0]||'');
  if(!title||!/[\u3040-\u30ff\u3400-\u9fff]/u.test(title))return '';
  const metadata=song?.[9]&&typeof song[9]==='object'?song[9]:{};
  const alias=metadata.vocaloidTitleAliases||{};
  const known=jpopTitleAliases.get(title.normalize('NFC'))||{};
  if(alias.english||known.english)return alias.english||known.english;
  return '';
}
function saveVocaloidTitleSubtitle(key,subtitle){
  vocaloidSubtitleCache.set(key,subtitle);
  try{localStorage.setItem(vocaloidSubtitleCacheKey,JSON.stringify(Object.fromEntries([...vocaloidSubtitleCache].map(([cacheKey,value])=>[cacheKey,{subtitle:value,expires:Date.now()+30*24*60*60*1000}]))));}catch{}
}
async function resolveVocaloidTitleSubtitle(song){
  const title=String(song?.[0]||'');
  if(!title||!/[\u3040-\u30ff\u3400-\u9fff]/u.test(title))return '';
  const fallback=getVocaloidTitleSubtitle(song);
  const key=`${normalizeVocaloidTitle(title)}|${normalizeVocaloidTitle(song?.[1])}`;
  if(vocaloidSubtitleCache.has(key))return vocaloidSubtitleCache.get(key)||fallback;
  if(vocaloidSubtitleRequests.has(key))return vocaloidSubtitleRequests.get(key);
  const request=(async()=>{
    try{
      const params=new URLSearchParams({query:title,nameMatchMode:'Exact',preferAccurateMatches:'true',maxResults:'10',fields:'Names,AdditionalNames,Artists',lang:'English'});
      const response=await fetch(`https://vocadb.net/api/songs?${params}`,{signal:AbortSignal.timeout(4000)});
      if(!response.ok)return fallback;
      const data=await response.json();
      const expectedTitle=normalizeVocaloidTitle(title);
      const expectedArtist=normalizeVocaloidTitle(song?.[1]);
      const entries=Array.isArray(data.items)?data.items:[];
      const match=entries.find(entry=>{
        const names=Array.isArray(entry.names)?entry.names.map(name=>name?.value):[];
        const aliases=String(entry.additionalNames||'').split(',');
        const exactTitle=[entry.defaultName,entry.name,...names,...aliases].some(name=>normalizeVocaloidTitle(name)===expectedTitle);
        if(!exactTitle)return false;
        const artists=Array.isArray(entry.artists)?entry.artists.flatMap(artist=>[artist?.name,artist?.additionalNames]):[entry.artistString];
        const usableArtists=artists.map(normalizeVocaloidTitle).filter(Boolean);
        return !expectedArtist||!usableArtists.length||usableArtists.some(artist=>artist===expectedArtist||(expectedArtist.length>=4&&(artist.includes(expectedArtist)||expectedArtist.includes(artist))));
      });
      const names=Array.isArray(match?.names)?match.names:[];
      const languageName=language=>names.find(name=>String(name?.language||'').toLocaleLowerCase()===language)?.value||'';
      const english=languageName('english');
      const subtitle=english||fallback;
      saveVocaloidTitleSubtitle(key,subtitle);
      return subtitle;
    }catch{return fallback;}
  })();
  vocaloidSubtitleRequests.set(key,request);
  try{return await request;}finally{if(vocaloidSubtitleRequests.get(key)===request)vocaloidSubtitleRequests.delete(key);}
}
window.getVocaloidTitleSubtitle=getVocaloidTitleSubtitle;
window.resolveVocaloidTitleSubtitle=resolveVocaloidTitleSubtitle;
function updateDifficultyMeter(difficulty='medium'){
  const levels=['easy','medium','hard','extreme'];
  const level=levels.includes(difficulty)?difficulty:'medium';
  const meter=gameView.querySelector('.difficulty-meter');
  if(!meter)return;
  meter.className=`difficulty-meter difficulty-${level}`;
  const thai = currentLanguage === 'TH';
  const difficultyNames = thai ? ['ง่าย', 'ปานกลาง', 'ยาก', 'ยากมาก'] : ['Easy', 'Medium', 'Hard', 'Extreme'];
  const difficultyIndex = levels.indexOf(level);
  meter.setAttribute('aria-label', thai ? `ระดับความยากของเพลง: ${difficultyNames[difficultyIndex]}` : `Song difficulty: ${level}`);
  meter.querySelector('.difficulty-label').textContent=difficultyNames[difficultyIndex];
}
window.getSongDifficulty=getSongDifficulty;
window.updateDifficultyMeter=updateDifficultyMeter;
function applySongArtwork(element,asset){if(!element||!asset?.artworkUrl100)return;const imageUrl=asset.artworkUrl100.replace(/^http:/,'https:');const image=new Image();image.onload=()=>{element.style.backgroundImage=`url("${imageUrl}")`;element.style.backgroundSize='cover';element.style.backgroundPosition='center';element.classList.add('cover-loaded');};image.src=imageUrl;}
function setChoiceSubtitle(choice,subtitle){const titleNode=choice.querySelector('.song-title');if(!titleNode)return;let node=choice.querySelector('.song-title-subtitle');if(!subtitle){node?.remove();return;}if(!node){node=document.createElement('small');node.className='song-title-subtitle';const origin=choice.querySelector('.song-origin');titleNode.insertBefore(node,origin);}if(node.textContent!==subtitle)node.textContent=subtitle;}
const choiceArtworkObserver=new MutationObserver(()=>{const currentRound=roundNo;gameView.querySelectorAll('.song-choice').forEach(choice=>{const title=choice.querySelector('.song-title strong')?.textContent;const artist=choice.dataset.artist;const song=[...activeCatalog,...roundSongs].find(item=>item[0]===title&&(!artist||item[1]===artist));if(song){const songGenre=song[9]?.catalogGenre||activeRoundGenre;const subtitle=songGenre==='Vocaloid'?'':getJPopSubtitle(song,songGenre);setChoiceSubtitle(choice,subtitle);loadSongAsset(song).then(asset=>{if(currentRound===roundNo&&choice.isConnected)applySongArtwork(choice.querySelector('.cover-art'),asset);});}});});
choiceArtworkObserver.observe(gameView.querySelector('.song-choices'),{childList:true});
const resultArtworkObserver=new MutationObserver(()=>{if(roundResult.hidden)return;const title=roundResult.querySelector('#round-result-title').textContent;const song=activeRoundSong||roundSongs.find(item=>item[0]===title);if(song)loadSongAsset(song).then(asset=>{if(!roundResult.hidden&&roundResult.querySelector('#round-result-title').textContent===title)applySongArtwork(roundResult.querySelector('.result-vinyl span'),asset);});});
resultArtworkObserver.observe(roundResult,{attributes:true,attributeFilter:['hidden']});
let roundNo=0,stageNo=0,roundLeft=30,elapsed=0,roundTick,attemptTick,breakTick,roundPlayers=[],gameAudio=null,audioUrlIndex=-1,progressFrame=0,activeRoundSong=null,activeRoundSongSubtitle='',activeRoundGenre='',playRequest=0;
const usedRoundSongs=new Set();
const unavailableSongs=new Set();
async function pickPlayableChoices(allowVocaloidExpansionWait=true){
  const room=getRoomState();
  const difficulty=room.difficulty||'medium';
  const choiceCount=room.choiceCount||4;
  const selectedGenre=genreAliases[room.genre]||room.genre||'Everything';
  let catalogs=await window.getRoundSongCatalogs?.(selectedGenre)||[{name:selectedGenre,songs:activeCatalog}];
  if(selectedGenre==='Everything'){
    const songs=[...new Map(catalogs.flatMap(pool=>pool.songs||[]).map(song=>[`${song[0]}|${song[1]}`,song])).values()];
    catalogs=[{name:'Everything',songs}];
  }
  const eligiblePools=catalogs.map(({name,songs})=>({
    name,
    songs:songs.filter(song=>getSongDifficulty(song)===difficulty&&!usedRoundSongs.has(song)&&!unavailableSongs.has(`${song[0]}|${song[1]}`)).sort(()=>Math.random()-.5)
  })).filter(pool=>pool.songs.length>=choiceCount);
  const poolsByGenre=new Map();
  for(const pool of eligiblePools){
    const balanceKey=getGenreBalanceKey(pool.name);
    if(!poolsByGenre.has(balanceKey))poolsByGenre.set(balanceKey,[]);
    poolsByGenre.get(balanceKey).push(pool);
  }
  const shuffleRandom=items=>{
    const shuffled=[...items];
    for(let index=shuffled.length-1;index>0;index--){
      const swapIndex=Math.floor(Math.random()*(index+1));
      [shuffled[index],shuffled[swapIndex]]=[shuffled[swapIndex],shuffled[index]];
    }
    return shuffled;
  };
  if(selectedGenre==='Everything'){
    const languagePools=new Map();
    for(const song of eligiblePools.flatMap(pool=>pool.songs)){
      const language=window.getSongCatalogLanguage?.(song,song[9]?.catalogGenre)||'en';
      if(!languagePools.has(language))languagePools.set(language,[]);
      languagePools.get(language).push(song);
    }
    const answerablePools=[...languagePools.values()].filter(songs=>songs.length>=choiceCount);
    const answerableSongs=answerablePools.flat();
    if(answerableSongs.length){
      const anchor=answerableSongs[Math.floor(Math.random()*answerableSongs.length)];
      const anchorLanguage=window.getSongCatalogLanguage?.(anchor,anchor[9]?.catalogGenre)||'en';
      const sameLanguage=languagePools.get(anchorLanguage)||[];
      const choices=shuffleRandom([anchor,...shuffleRandom(sameLanguage.filter(song=>song!==anchor)).slice(0,choiceCount-1)]);
      choices.forEach(song=>usedRoundSongs.add(song));
      activeRoundGenre='Everything';
      return choices;
    }
    if(allowVocaloidExpansionWait&&catalogExpansionTasks.has('Everything')){
      if(gameView.querySelector('.round-feedback'))gameView.querySelector('.round-feedback').textContent=window.getAppLanguage?.()==='TH'?'กำลังโหลดเพลงเพิ่มเพื่อให้ตัวเลือกเป็นภาษาเดียวกัน…':'Loading more songs to keep answer choices in one language…';
      await catalogExpansionTasks.get('Everything');
      return pickPlayableChoices(false);
    }
    activeRoundGenre='Everything';
    return [];
  }
  const pools=shuffleRandom([...poolsByGenre.values()]).flatMap(group=>shuffleRandom(group));
  const feedback=gameView.querySelector('.round-feedback');
  for(const pool of pools){
    const choices=[];
    for(let offset=0;offset<pool.songs.length&&choices.length<choiceCount;offset+=8){
      const batch=pool.songs.slice(offset,offset+8);
      const assets=await Promise.all(batch.map(song=>loadSongAsset(song)));
      for(let index=0;index<batch.length;index++){
        const song=batch[index],asset=assets[index];
        if(!asset?.previewUrl){unavailableSongs.add(`${song[0]}|${song[1]}`);continue;}
        if(!song[3])song[3]=asset.previewUrl;
        if(!song[4]&&asset.releaseDate)song[4]=asset.releaseDate;
        if(!song[5]&&(asset.catalogRank||asset.searchRank))song[5]=asset.catalogRank||asset.searchRank;
        choices.push(song);
        if(choices.length===choiceCount)break;
      }
      if(choices.length<choiceCount&&feedback)feedback.textContent=`Finding songs with playable previews… ${Math.min(offset+batch.length,pool.songs.length)}/${pool.songs.length}`;
    }
    if(choices.length===choiceCount){
      choices.forEach(song=>usedRoundSongs.add(song));
      activeRoundGenre=pool.name;
      return choices;
    }
  }
  const expandingGenre=genreAliases[room.genre]||room.genre||'Everything';
  if(allowVocaloidExpansionWait&&catalogExpansionTasks.has(expandingGenre)){
    if(feedback)feedback.textContent=`Loading more ${expandingGenre} songs…`;
    await catalogExpansionTasks.get(expandingGenre);
    return pickPlayableChoices(false);
  }
  activeRoundGenre=room.genre||'Everything';
  return [];
}
async function launchGame(){
  usedRoundSongs.clear();
  unavailableSongs.clear();
  const r=getRoomState();
  roundPlayers=r.players.filter(p=>p.name).map(p=>({name:p.name,score:0}));
  if(!roundPlayers.length)roundPlayers=[{name:'You',score:0}];
  roundNo=0;roundResult.hidden=true;winnerResult.hidden=true;songBombView.hidden=true;
  gameView.querySelector('.game-layout').hidden=false;
  document.querySelector('main').hidden=true;document.querySelector('.site-footer').hidden=true;
  gameView.hidden=false;document.body.style.overflow='auto';
  const feedback=gameView.querySelector('.round-feedback');
  feedback.textContent='Preparing the song list…';
  gameView.dataset.catalogPreparing='true';
  let deferredExpansionGenre='';
  try{
    const selectedGenre=genreAliases[r.genre]||r.genre||'Everything';
    if(selectedGenre==='Everything'){
      activeCatalog=await prepareCatalogSnapshots();
      if(activeCatalog.length<4)activeCatalog=roundSongs;
      deferredExpansionGenre='Everything';
    }else{
      const cachedCatalogs=await window.getCachedRoundSongCatalogs?.(selectedGenre)||[];
      for(const {name,songs} of cachedCatalogs){catalogSnapshotByGenre.set(name,songs||[]);everythingGenreCatalogs.set(name,songs||[]);}
      activeCatalog=cachedCatalogs.flatMap(pool=>pool.songs||[]);
      genreSelectionKeys(selectedGenre).forEach(name=>deferredCatalogExpansionGenres.add(name));
      if(selectedGenre.includes('|'))deferredCatalogExpansionGenres.add(selectedGenre);
      deferredExpansionGenre=selectedGenre;
    }
    if(activeCatalog.length<4)activeCatalog=roundSongs;
    const choiceCount=Math.max(4,Math.min(8,Number(r.choiceCount)||4));
    const difficulty=r.difficulty||'medium';
    if(window.getRoomStartupCatalogs){
      feedback.textContent='Finding playable songs for the first round…';
      const startupCatalogs=await window.getRoomStartupCatalogs(selectedGenre,choiceCount,difficulty,choiceCount);
      activeCatalog=startupCatalogs.flatMap(pool=>pool.songs||[]);
      for(const {name,songs} of startupCatalogs){
        catalogSnapshotByGenre.set(name,songs||[]);
        everythingGenreCatalogs.set(name,songs||[]);
      }
    }
    gameView.dataset.catalogPreparing='false';
    await nextRound();
    if(deferredExpansionGenre){
      if(deferredExpansionGenre==='Everything')sourceGenres.forEach(name=>deferredCatalogExpansionGenres.delete(name));
      else genreSelectionKeys(deferredExpansionGenre).forEach(name=>deferredCatalogExpansionGenres.delete(name));
      deferredCatalogExpansionGenres.delete(deferredExpansionGenre);
      if(!catalogExpansionTasks.has(deferredExpansionGenre)){
        const selectedGenre=deferredExpansionGenre;
        const target=Math.min(500,((Number(r.roundCount)||ROUND_COUNT)+1)*choiceCount);
        const task=(window.getRoomStartupCatalogs
          ? window.getRoomStartupCatalogs(selectedGenre,target,difficulty,choiceCount)
          : loadGenreCatalog(selectedGenre).then(catalog=>[{name:selectedGenre,songs:catalog}])).then(catalogs=>{
          activeCatalog=catalogs.flatMap(pool=>pool.songs||[]);
          for(const {name,songs} of catalogs){
            catalogSnapshotByGenre.set(name,songs||[]);
            if(everythingGenreCatalogs.has(name))everythingGenreCatalogs.set(name,songs||[]);
          }
          return activeCatalog;
        }).catch(()=>activeCatalog);
        catalogExpansionTasks.set(selectedGenre,task);
      }
    }
  }catch(error){
    gameView.dataset.catalogPreparing='false';
    feedback.textContent=`Couldn't prepare songs: ${error?.message||'check your connection and try again.'}`;
    gameView.querySelector('.game-play').disabled=true;
    gameView.querySelector('.game-skip').disabled=true;
  }
}
function scoreBoard(){gameView.querySelector('.score-list').innerHTML=[...roundPlayers].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="score-row"><span>0${i+1}</span><strong>${escapeRoomText(p.name)}</strong><b>${p.score}</b></div>`).join('');}
function continueKey(){return `sonora-continue-${roundNo}`;}
function continueNames(){try{return JSON.parse(localStorage.getItem(continueKey())||'[]');}catch{return [];}}
function updateContinueStatus(button){const ready=continueNames(),needed=Math.ceil(roundPlayers.length/2);button.textContent=`Continue (${ready.length}/${needed})`;if(ready.length>=needed){clearInterval(breakTick);nextRound();}}
window.addEventListener('storage',event=>{if(event.key===continueKey()){const button=roundResult.querySelector('.continue-round');if(button)updateContinueStatus(button);}});
async function nextRound(){
  clearInterval(roundTick);
  clearInterval(attemptTick);
  clearInterval(breakTick);
  playRequest++;
  pauseCurrentPlayback();
  roundResult.hidden=true;
  const pendingChoiceList=gameView.querySelector('.song-choices');
  pendingChoiceList?.replaceChildren();
  pendingChoiceList?.classList.remove('locked','wrong-locked');
  if(gameAudio){gameAudio.pause();gameAudio=null;}
  const totalRounds=Math.max(1,Math.min(50,Number(getRoomState().roundCount)||10));
  if(roundNo>=totalRounds){
    const winner=[...roundPlayers].sort((a,b)=>b.score-a.score)[0]||{name:'You',score:0};
    winnerResult.querySelector('#winner-title').textContent=`${winner.name} wins!`;
    winnerResult.querySelector('.winner-score').textContent=`Final score · ${winner.score} points`;
    winnerResult.hidden=false;
    sprayNoteConfetti({winner:true});
    return;
  }
  roundNo++;
  const topbar=gameView.querySelector('.game-topbar>span');
  if(topbar)topbar.innerHTML=`${currentLanguage==='TH'?'รอบ':'ROUND'} <strong class="game-round">${roundNo}</strong> / ${totalRounds}`;
  const loadingRound=roundNo;
  localStorage.removeItem(continueKey());
  stageNo=0;
  elapsed=0;
  roundLeft=[30,45,60].includes(Number.parseInt(getRoomState().time,10))?Number.parseInt(getRoomState().time,10):30;
  gameView.querySelector('.round-clock')?.classList.remove('is-urgent');
  const feedback=gameView.querySelector('.round-feedback');
  if(feedback)feedback.textContent='Finding songs with playable previews…';
  let choices;
  try{choices=await pickPlayableChoices();}
  catch(error){
    if(loadingRound!==roundNo)return;
    if(feedback)feedback.textContent=`Couldn't find playable songs: ${error?.message||'check your connection and try again.'}`;
    const play=gameView.querySelector('.game-play');if(play)play.disabled=true;
    const skip=gameView.querySelector('.game-skip');if(skip)skip.disabled=true;
    return;
  }
  if(loadingRound!==roundNo)return;
  if(!choices.length){
    if(feedback)feedback.textContent='No playable preview songs are available. Check your connection and try again.';
    const play=gameView.querySelector('.game-play');if(play)play.disabled=true;
    const skip=gameView.querySelector('.game-skip');if(skip)skip.disabled=true;
    return;
  }
  const answerIndex=Math.floor(Math.random()*choices.length);
  const song=choices[answerIndex];
  activeRoundSong=song;
const choiceSubtitles=choices.map(choice=>{const songGenre=choice[9]?.catalogGenre||activeRoundGenre;return songGenre==='Vocaloid'?'':getJPopSubtitle(choice,songGenre);});
  const answerGenre=song[9]?.catalogGenre||activeRoundGenre;
  activeRoundSongSubtitle=answerGenre==='Vocaloid'?getVocaloidTitleSubtitle(song):choiceSubtitles[answerIndex]||'';
  updateDifficultyMeter(getSongDifficulty(song));
  gameView.dataset.answer=song[0];
  const roundLabel=gameView.querySelector('.game-round');if(roundLabel)roundLabel.textContent=roundNo;
  const clock=gameView.querySelector('.round-clock strong');if(clock)clock.textContent=roundLeft;
  const attemptClock=gameView.querySelector('.attempt-clock');if(attemptClock)attemptClock.textContent='';
  const genreLabel=gameView.querySelector('.vinyl-stage p');if(genreLabel)genreLabel.textContent=`ROUND GENRE - ${activeRoundGenre.toUpperCase()}`;
  if(feedback)feedback.textContent='Choose quickly for the highest score.';
  const trackProgress=gameView.querySelector('.track-line i');if(trackProgress)trackProgress.style.width='0';
  const play=gameView.querySelector('.game-play');if(play)play.disabled=false;
  const skip=gameView.querySelector('.game-skip');if(skip)skip.disabled=false;
  gameView.querySelectorAll('.track-marks span').forEach((mark,index)=>mark.classList.toggle('active',index===0));
  const choiceList=gameView.querySelector('.song-choices');
  choiceList?.classList.remove('locked','wrong-locked');
  const guessStatus=gameView.querySelector('.guess-status');if(guessStatus)guessStatus.textContent=`${choices.length} choices`;
  if(choiceList)choiceList.innerHTML=choices.map((choice,index)=>`<button class="song-choice" data-artist="${escapeRoomText(choice[1])}" data-correct="${choice===song}" type="button"><span class="cover-art cover-${(roundNo+index)%4}" aria-hidden="true">♪</span><span class="song-title notranslate" translate="no"><strong>${escapeRoomText(choice[0])}</strong>${choiceSubtitles[index]?`<small class="song-title-subtitle notranslate" translate="no">${escapeRoomText(choiceSubtitles[index])}</small>`:''}${choice[6]?`<small class="song-origin">From ${escapeRoomText(choice[6])}</small>`:''}</span><i>${String.fromCharCode(65+index)}</i></button>`).join('');
  if(activeRoundGenre==='Vocaloid'){
    const selectedRound=roundNo;
    resolveVocaloidTitleSubtitle(song).then(subtitle=>{
      if(selectedRound!==roundNo||activeRoundSong!==song)return;
      activeRoundSongSubtitle=subtitle;
      if(!roundResult.hidden&&roundResult.querySelector('#round-result-title')?.textContent===song[0])roundResult.querySelector('#round-result-subtitle').textContent=subtitle;
    });
  }
  scoreBoard();
  roundTick=setInterval(()=>{
    roundLeft--;
    const roundClock=gameView.querySelector('.round-clock strong');if(roundClock)roundClock.textContent=roundLeft;
    gameView.querySelector('.round-clock')?.classList.toggle('is-urgent',roundLeft<=5);
    if(roundLeft<=0)endRound(`Time is up. It was ${song[0]}.`);
  },1000);
  attemptTick=setInterval(()=>{
    if(!gameView.querySelector('.song-choices')?.classList.contains('locked'))elapsed++;
    const clockElement=gameView.querySelector('.attempt-clock');if(clockElement)clockElement.textContent=`00:${String(elapsed).padStart(2,'0')}`;
  },1000);
}
function endRound(message){clearInterval(roundTick);clearInterval(attemptTick);playRequest++;pauseCurrentPlayback();if(gameAudio){gameAudio.pause();gameAudio=null;}const feedback=gameView.querySelector('.round-feedback');let seconds=10;const song=activeRoundSong;roundResult.querySelector('.result-vinyl').style.setProperty('--result-cover',`var(--cover-${(roundNo-1)%4})`);roundResult.querySelector('.result-vinyl').className=`result-vinyl cover-${(roundNo-1)%4}`;roundResult.querySelector('#round-result-title').textContent=song[0];roundResult.querySelector('#round-result-subtitle').textContent=activeRoundSongSubtitle;roundResult.querySelector('.result-artist').textContent=song[1];const playerResult=roundResult.querySelector('.result-player-status'),guessedCorrectly=Boolean(gameView.querySelector('.song-choice.correct'));playerResult.textContent=guessedCorrectly?'You guessed correctly':'You\u2019re incorrect';playerResult.className=`result-player-status ${guessedCorrectly?'is-correct':'is-incorrect'}`;const needed=Math.ceil(roundPlayers.length/2);roundResult.querySelector('.continue-round').textContent=`Continue (0/${needed})`;roundResult.querySelector('.result-countdown b').textContent=seconds;roundResult.hidden=false;feedback.textContent=message;gameView.querySelectorAll('.song-choice').forEach(b=>b.disabled=true);if(song?.[3]){gameAudio=new Audio();gameAudio.preload='auto';gameAudio.src=song[3];gameAudio.volume=Number(gameVolumeInput.value)/100;void gameAudio.play().catch(()=>{});}const continueButton=roundResult.querySelector('.continue-round');continueButton.onclick=()=>{const room=getRoomState();const playerName=localStorage.getItem(profileNameKey)||room.players[0]?.name||roundPlayers[0].name;const ready=continueNames();if(!ready.includes(playerName)){ready.push(playerName);localStorage.setItem(continueKey(),JSON.stringify(ready));}updateContinueStatus(continueButton);};breakTick=setInterval(()=>{seconds--;const count=roundResult.querySelector('.result-countdown b');if(count)count.textContent=seconds;if(seconds<=0){clearInterval(breakTick);nextRound();}},1000);}
function setPlayButton(playing){const button=gameView.querySelector('.game-play');button.classList.toggle('is-playing',playing);button.setAttribute('aria-label',playing?'Pause current section':'Play current section');}
function pauseCurrentPlayback(){if(gameAudio)gameAudio.pause();cancelAnimationFrame(progressFrame);setPlayButton(false);}
async function playCurrentSection(restartFromBeginning=false,startAt=null){
  const requestedRound=roundNo,requestedStage=stageNo,request=++playRequest,song=activeRoundSong;
  if(!song)return;
  const boundaries=[0,.1,.5,2,8,15],points=[0,3,11,34,70,100],end=boundaries[requestedStage+1];
  if(!gameAudio||gameAudio.dataset.songKey!==`${song[0]}|${song[1]}`){
    const previewUrl=song[3];
    if(!previewUrl){gameView.querySelector('.round-feedback').textContent='This song preview is unavailable. Skip to another song.';return;}
    if(gameAudio)gameAudio.pause();
    gameAudio=new Audio();
    gameAudio.preload='auto';
    gameAudio.dataset.trackId=String(song[9]?.trackId||'');
    gameAudio.dataset.songKey=`${song[0]}|${song[1]}`;
    gameAudio.src=previewUrl;
    const thisAudio=gameAudio;
    thisAudio.addEventListener('waiting',()=>{
      if(thisAudio===gameAudio&&requestedRound===roundNo)gameView.querySelector('.round-feedback').textContent='Buffering song preview…';
    });
    thisAudio.addEventListener('error',()=>{
      if(thisAudio===gameAudio&&requestedRound===roundNo)gameView.querySelector('.round-feedback').textContent='The preview could not load. Check your connection and try again.';
    });
  }
  const activeAudio=gameAudio;
  if(request!==playRequest||requestedRound!==roundNo||requestedStage!==stageNo)return;
  activeAudio.volume=Number(gameVolumeInput.value)/100;
  if(startAt!==null)activeAudio.currentTime=startAt;
  else if(restartFromBeginning||activeAudio.currentTime>=end)activeAudio.currentTime=0;
  const updateProgress=()=>{
    const time=Math.max(0,Math.min(end,activeAudio.currentTime));
    let marker=0;while(marker<boundaries.length-2&&time>boundaries[marker+1])marker++;
    const fraction=Math.max(0,Math.min(1,(time-boundaries[marker])/(boundaries[marker+1]-boundaries[marker])));
    gameView.querySelector('.track-line i').style.width=`${points[marker]+fraction*(points[marker+1]-points[marker])}%`;
  };
  updateProgress();
  const animate=()=>{
    if(activeAudio!==gameAudio||activeAudio.paused||requestedRound!==roundNo||requestedStage!==stageNo)return;
    updateProgress();
    if(activeAudio.currentTime>=end){
      activeAudio.pause();activeAudio.currentTime=end;
      gameView.querySelector('.track-line i').style.width=`${points[requestedStage+1]}%`;
      setPlayButton(false);return;
    }
    progressFrame=requestAnimationFrame(animate);
  };
  try{
    const playback=activeAudio.play();
    await playback;
    if(request!==playRequest||requestedRound!==roundNo)return;
    setPlayButton(true);cancelAnimationFrame(progressFrame);progressFrame=requestAnimationFrame(animate);
  }catch(error){
    if(request!==playRequest||requestedRound!==roundNo)return;
    setPlayButton(false);
    gameView.querySelector('.round-feedback').textContent=error?.name==='NotAllowedError'
      ?'Playback was blocked. Tap Play again and check your browser sound settings.'
      :'Playback could not start. Check your connection and device volume, then try again.';
  }
}
gameView.querySelector('.game-play').addEventListener('click',()=>{if(gameAudio&&!gameAudio.paused){playRequest++;pauseCurrentPlayback();return;}void playCurrentSection();});
gameVolumeInput.addEventListener('input',event=>{event.currentTarget.style.setProperty('--volume-level',`${event.currentTarget.value}%`);if(gameAudio)gameAudio.volume=Number(event.currentTarget.value)/100;});
gameVolumeInput.addEventListener('input', event => {
  const value = event.currentTarget.value;
  localStorage.setItem('sonora-volume', value);
  document.documentElement.style.setProperty('--volume-level', `${value}%`);
  hoverTargetVolume = Number(value) / 100;
  if (!hoverPreviewAudio.paused) hoverPreviewAudio.volume = hoverTargetVolume;
  const homeVolumeInput = document.querySelector('.volume-slider');
  if (homeVolumeInput) homeVolumeInput.value = value;
});
gameView.querySelector('.game-skip').addEventListener('click',async()=>{if(stageNo>=4)return;const boundaries=[0,.1,.5,2,8,15];playRequest++;pauseCurrentPlayback();const markTime=boundaries[stageNo+1];stageNo++;gameView.querySelectorAll('.track-marks span').forEach((m,i)=>m.classList.toggle('active',i<=stageNo));gameView.querySelector('.round-feedback').textContent=`Continuing to the ${boundaries[stageNo+1]} second mark. Fewer points are available now.`;await playCurrentSection(false,markTime);if(stageNo===4)gameView.querySelector('.game-skip').disabled=true;});
function sprayNoteConfetti(options={}){const winner=Boolean(options.winner),burst=document.createElement('div');burst.className=`note-confetti-burst${winner?' winner-confetti':''}`;const count=winner?220:72,symbols=winner?['♫','♪','♬','✦','★','✧','◆','●']:['♫','♪','♬'];for(let i=0;i<count;i++){const note=document.createElement('span');note.textContent=symbols[i%symbols.length];note.style.left=`${Math.random()*100}%`;note.style.setProperty('--note-x',`${(Math.random()-.5)*(winner?420:260)}px`);note.style.setProperty('--note-r',`${(Math.random()-.5)*(winner?720:360)}deg`);note.style.setProperty('--note-delay',`${Math.random()*(winner?450:180)}ms`);note.style.setProperty('--confetti-size',`${18+Math.random()*(winner?28:18)}px`);burst.appendChild(note);}document.body.appendChild(burst);setTimeout(()=>burst.remove(),winner?4800:2700);}
function triggerWrongMark(){const button=gameView.querySelector('.game-play'),rect=button.getBoundingClientRect(),mark=document.createElement('div');mark.className='wrong-guess-mark';mark.style.setProperty('--cross-x',`${rect.left+rect.width/2}px`);mark.style.setProperty('--cross-y',`${rect.top+rect.height/2}px`);mark.setAttribute('aria-hidden','true');mark.innerHTML='<span></span><span></span>';document.body.appendChild(mark);setTimeout(()=>mark.remove(),950);}
gameView.querySelector('.song-choices').addEventListener('click',e=>{const b=e.target.closest('.song-choice');if(!b||b.disabled)return;if(b.dataset.correct==='true'){const pts=Math.max(5,[100,80,60,35,20][stageNo]-Math.min(25,Math.floor(elapsed/4)*5));roundPlayers[0].score+=pts;scoreBoard();b.classList.add('correct');gameView.querySelector('.song-choices').classList.add('locked');gameView.querySelectorAll('.song-choice').forEach(x=>{x.disabled=true;x.classList.add('dimmed');});gameView.querySelector('.guess-status').textContent='You got it · waiting for everyone';gameView.querySelector('.round-feedback').textContent=`Correct! +${pts} points. You’re locked in until the round ends.`;sprayNoteConfetti();if(roundPlayers.length===1)endRound('Correct answer!');}else{triggerWrongMark();roundPlayers[0].score=Math.max(0,roundPlayers[0].score-5);scoreBoard();gameView.querySelector('.song-choices').classList.add('wrong-locked');gameView.querySelectorAll('.song-choice').forEach(x=>{x.disabled=true;x.classList.add('dimmed');});gameView.querySelector('.round-feedback').textContent='Wrong guess — 5 points deducted. Choices are dimmed and locked until the next round.';if(roundPlayers.length===1)endRound(`No correct guesses. It was ${activeRoundSong[0]}.`);}});
winnerResult.querySelector('.winner-exit').addEventListener('click',()=>gameView.querySelector('.game-exit').click());
gameView.querySelector('.game-exit').addEventListener('click',()=>{clearInterval(roundTick);clearInterval(attemptTick);clearInterval(breakTick);playRequest++;pauseCurrentPlayback();winnerResult.hidden=true;roundResult.hidden=true;gameView.hidden=true;songBombView.hidden=true;document.querySelector('main').hidden=false;document.querySelector('.site-footer').hidden=false;window.scrollTo(0,0);});
document.querySelector('.launch-button').addEventListener('click',()=>{
  if (!selectedMode) {
    modeRequiredStatus.hidden = false;
    return;
  }
  if (selectedMode === 'Solo') {
    const room = getRoomState();
    const name = localStorage.getItem(profileNameKey) || room.hostName || 'You';
    room.players = [{ name, role: 'Player', score: 0 }];
    room.maxPlayers = 1;
    saveRoomState(room);
    closeModal();
    launchGame();
  }
});

document.querySelectorAll('.room-setting').forEach((select) => {
  if (select.dataset.setting === 'duration') {
    select.value = String(getRoomState().duration || 30);
    select.addEventListener('change', () => {
      const room = getRoomState();
      room.duration = Number(select.value);
      room.time = `${room.duration} seconds`;
      saveRoomState(room);
    });
    return;
  }

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
      genre.dataset.genre = option.value || option.text;
      genre.textContent = option.text;
      if(disabledGenres.has(genre.dataset.genre)){
        genre.disabled = true;
        genre.title = 'Temporarily unavailable';
        genre.setAttribute('aria-label', `${option.text}, temporarily unavailable`);
      }
      genre.addEventListener('click', (event) => {
        event.preventDefault();
        if(genre.disabled)return;
        const choices = [...genreGrid.querySelectorAll('.genre-option')];
        const categories = choices.filter((item) => item.dataset.genre !== 'Everything' && !disabledGenres.has(item.dataset.genre));
        if (genre.dataset.genre === 'Everything') {
          window.selectSetupGenre?.('Everything');
          return;
        }
        const selected = new Set(categories.filter((item) => item.classList.contains('selected')).map((item) => item.dataset.genre));
        if (selected.size === categories.length) {
          selected.clear();
          selected.add(genre.dataset.genre);
        } else if (selected.has(genre.dataset.genre)) selected.delete(genre.dataset.genre);
        else selected.add(genre.dataset.genre);
        window.selectSetupGenre?.(selected.size ? [...selected].join('|') : 'Everything');
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
    playerStepper.innerHTML = `<button type="button" class="stepper-arrow" aria-label="Remove player">&#8722;</button><strong>${select.options[select.selectedIndex].text}</strong><button type="button" class="stepper-arrow" aria-label="Add player">&#43;</button>`;
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

});

const joinedPanel = document.createElement('section');
joinedPanel.className = 'joined-panel';
joinedPanel.innerHTML = '<div><p class="eyebrow">The room</p><h3>Who is <em>in?</em></h3><p class="joined-subtitle">Invite players in on any device.</p></div><div class="joined-list"></div>';
document.querySelector('.setup-modal').appendChild(joinedPanel);

const roomStateKey = 'sonora-room-state';
const profileNameKey = 'sonora-profile-name';
const setupNameKey = 'sonora-room-setup-name';
const defaultRoomState = { hostName: '', maxPlayers: 8, mode: 'Quickfire', genre: '', difficulty: 'medium', choiceCount: 4, roundCount: 10, duration: 30, time: '30 seconds', active: true, players: [{ name: '', role: 'Host' }] };

function getRoomState() {
  try {
    const room = JSON.parse(localStorage.getItem(roomStateKey)) || structuredClone(defaultRoomState);
    if(room.genre){
      const availableGenres=splitGenreSelection(room.genre).filter(genre=>!disabledGenres.has(genre));
      room.genre=availableGenres.length?availableGenres.join('|'):'Everything';
    }
    if (!availableModes.has(room.mode)) room.mode = 'Quickfire';
    if (!['easy', 'medium', 'hard', 'extreme'].includes(room.difficulty)) room.difficulty = 'medium';
    if (![4, 5, 6, 7, 8].includes(Number(room.choiceCount))) room.choiceCount = 4;
    if (!Number.isInteger(Number(room.roundCount)) || Number(room.roundCount) < 1 || Number(room.roundCount) > 50) room.roundCount = 10;
    return room;
  } catch { return structuredClone(defaultRoomState); }
}

function saveRoomState(room) {
  localStorage.setItem(roomStateKey, JSON.stringify(room));
  renderRoomRosters();
  updateLaunchAvailability();
}

const languageStorageKey = 'sonora-language';
let currentLanguage = (() => {
  try { return localStorage.getItem(languageStorageKey) === 'TH' ? 'TH' : 'EN'; } catch { return 'EN'; }
})();

const durationField = [...document.querySelectorAll('.setup-field')].find((field) => field.querySelector('span')?.textContent.trim() === 'Round length');
if (durationField) {
  durationField.classList.add('time-setting-field');
  const stepper = document.createElement('div');
  stepper.className = 'player-stepper duration-stepper';
  stepper.innerHTML = '<button type="button" class="stepper-arrow" aria-label="Decrease round length">&#8722;</button><strong>30 seconds</strong><button type="button" class="stepper-arrow" aria-label="Increase round length">&#43;</button>';
  durationField.querySelector('strong')?.replaceWith(stepper);
  const durationValue = stepper.querySelector('strong');
  const savedDuration = Number.parseInt(getRoomState().time, 10);
  durationValue.textContent = `${[30, 45, 60].includes(savedDuration) ? savedDuration : 30} ${currentLanguage === 'TH' ? '\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35' : 'seconds'}`;
  const updateDuration = (direction) => {
    const values = [30, 45, 60];
    const current = Number.parseInt(durationValue.textContent, 10) || 30;
    const next = values[Math.max(0, Math.min(values.length - 1, values.indexOf(current) + direction))];
    durationValue.textContent = `${next} ${currentLanguage === 'TH' ? '\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35' : 'seconds'}`;
    const room = getRoomState();
    room.duration = next;
    room.time = `${next} seconds`;
    saveRoomState(room);
  };
  stepper.querySelector('[aria-label="Decrease round length"]').addEventListener('click', () => updateDuration(-1));
  stepper.querySelector('[aria-label="Increase round length"]').addEventListener('click', () => updateDuration(1));
}

const choiceCountField = document.createElement('div');
choiceCountField.className = 'setup-field choice-count-field';
choiceCountField.innerHTML = '<span>Answer choices</span><div class="player-stepper choice-stepper"><button type="button" class="stepper-arrow" aria-label="Decrease answer choices">&#8722;</button><strong>4 choices</strong><button type="button" class="stepper-arrow" aria-label="Increase answer choices">&#43;</button></div><small>Choose from 4 to 8 songs per round</small>';
choiceCountField.querySelector('strong').textContent = `${getRoomState().choiceCount || 4} ${currentLanguage === 'TH' ? '\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01' : 'choices'}`;
durationField?.parentElement.insertBefore(choiceCountField, document.querySelector('.difficulty-setting-field'));
choiceCountField.querySelector('[aria-label="Decrease answer choices"]').addEventListener('click', () => updateChoiceCount(-1));
choiceCountField.querySelector('[aria-label="Increase answer choices"]').addEventListener('click', () => updateChoiceCount(1));
function updateChoiceCount(direction) {
  const value = choiceCountField.querySelector('strong');
  const next = Math.max(4, Math.min(8, (Number.parseInt(value.textContent, 10) || 4) + direction));
  value.textContent = `${next} ${currentLanguage === 'TH' ? '\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01' : 'choices'}`;
  const room = getRoomState();
  room.choiceCount = next;
  saveRoomState(room);
}

const roundsField = document.createElement('div');
roundsField.className = 'setup-field rounds-setting-field';
roundsField.innerHTML = '<span>Rounds</span><div class="player-stepper rounds-stepper"><button type="button" class="stepper-arrow" aria-label="Decrease rounds">&#8722;</button><strong>10 rounds</strong><button type="button" class="stepper-arrow" aria-label="Increase rounds">&#43;</button></div><small>Choose how many rounds to play</small>';
const roundsValue = roundsField.querySelector('strong');
roundsValue.textContent = `${getRoomState().roundCount || 10} ${currentLanguage === 'TH' ? '\u0e23\u0e2d\u0e1a' : 'rounds'}`;
choiceCountField.after(roundsField);
function updateRoundCount(direction) {
  const next = Math.max(1, Math.min(50, (Number.parseInt(roundsValue.textContent, 10) || 10) + direction));
  roundsValue.textContent = `${next} ${currentLanguage === 'TH' ? '\u0e23\u0e2d\u0e1a' : 'rounds'}`;
  const room = getRoomState();
  room.roundCount = next;
  saveRoomState(room);
  updateModeSummary();
}
roundsField.querySelector('[aria-label="Decrease rounds"]').addEventListener('click', () => updateRoundCount(-1));
roundsField.querySelector('[aria-label="Increase rounds"]').addEventListener('click', () => updateRoundCount(1));

const difficultyOptions = document.querySelectorAll('.difficulty-option');
const savedDifficulty = getRoomState().difficulty || 'medium';
difficultyOptions.forEach((option) => {
  option.classList.toggle('selected', option.dataset.difficulty === savedDifficulty);
  option.setAttribute('aria-pressed', String(option.dataset.difficulty === savedDifficulty));
  option.addEventListener('click', () => {
    difficultyOptions.forEach((item) => {
      const selected = item === option;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    const room = getRoomState();
    room.difficulty = option.dataset.difficulty;
    saveRoomState(room);
  });
});

function updateLaunchAvailability() {
  const launchButton = document.querySelector('.launch-button');
  if (!launchButton) return;
  const room = getRoomState();
  const solo = selectedMode === 'Solo';
  const ready = Boolean(
    selectedMode
    && room.mode === selectedMode
    && (solo || modeChoices.querySelector('.mode-choice.selected'))
    && document.querySelector('.genre-option.selected')
    && (solo || (Number.parseInt(document.querySelector('.player-stepper strong')?.textContent, 10) && room.maxPlayers))
    && room.genre
  );
  launchButton.disabled = !ready;
  launchButton.setAttribute('aria-disabled', String(!ready));
  launchButton.title = ready ? (solo ? 'Start solo play' : selectedMode === 'SongBomb' ? 'Start Song Bomb' : 'Start Classic') : 'Complete the game settings first';
}

function escapeRoomText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function renderRoster(list, room, waitingLabel) {
  if (!list) return;
  const players = room.players.filter((player) => player.name.trim());
  const cards = players.map((player, index) => `<div class="joined-player"><span class="joined-avatar ${index === 0 ? 'avatar-yellow' : 'avatar-blue'}">${escapeRoomText(player.name.slice(0, 2).toUpperCase())}</span><span><strong>${escapeRoomText(player.name)}</strong><small>${index === 0 ? 'Host' : 'Joined'}</small></span><i>${index === 0 ? '★' : '✓'}</i></div>`);
  if (players.length < room.maxPlayers) cards.push(`<div class="joined-player waiting"><span class="joined-avatar">+</span><span><strong>${waitingLabel}</strong><small>${room.maxPlayers - players.length} spot${players.length === 1 ? '' : 's'} open</small></span></div>`);
  list.innerHTML = cards.join('');
}

function renderRoomRosters() {
  try {
    if (sessionStorage.getItem('sonora-cloudflare-session')) return;
  } catch {}
  const room = getRoomState();
  renderRoster(document.querySelector('.joined-list'), room, 'Waiting for players');
  renderRoster(document.querySelector('.joined-room-list'), room, 'Waiting for players');
  const hostSettings = document.querySelectorAll('.host-settings strong');
  if (hostSettings.length >= 7) {
    hostSettings[0].textContent = getAppModeName(room.mode);
    hostSettings[1].textContent = `${room.maxPlayers} max`;
    hostSettings[2].textContent = String(room.genre || 'Everything').replaceAll('|', ', ');
    hostSettings[3].textContent = room.time.replace(' seconds', ' sec');
    hostSettings[4].textContent = (room.difficulty || 'medium').replace(/^./, (letter) => letter.toUpperCase());
    hostSettings[5].textContent = `${room.choiceCount || 4} choices`;
    hostSettings[6].textContent = `${room.roundCount || 10}`;
  }
}

renderRoomRosters();
window.addEventListener('storage', renderRoomRosters);

const hostNameField = document.createElement('label');
hostNameField.className = 'setup-field host-name-field';
hostNameField.innerHTML = '<span>Your name</span><input class="host-name-input" type="text" value="" placeholder="Enter your name" maxlength="20" autocomplete="name" /><small>This is how your crew will see you</small>';
document.querySelector('.setup-fields').prepend(hostNameField);
const hostNameInput = hostNameField.querySelector('.host-name-input');
hostNameInput.value = localStorage.getItem(profileNameKey) || localStorage.getItem(setupNameKey) || getRoomState().hostName || '';
hostNameInput.addEventListener('input', () => {
  const hostName = hostNameInput.value.trim();
  localStorage.setItem(setupNameKey, hostName);
  if (hostName) localStorage.setItem(profileNameKey, hostName);
  const room = getRoomState();
  room.hostName = hostName;
  saveRoomState(room);
});

const nameGate = document.createElement('div');
nameGate.className = 'name-gate';
nameGate.hidden = true;
nameGate.innerHTML = '<section class="name-gate-card" role="dialog" aria-modal="true" aria-labelledby="name-gate-title"><p class="eyebrow">Before we start</p><h2 id="name-gate-title">What should<br /><em>we call you?</em></h2><p>Your name will appear in the room for everyone to see.</p><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 14px;padding:12px 14px;border:1px solid #53625d;border-radius:6px;background:#111817"><span style="color:#9da39d;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Room code</span><strong class="name-gate-code" style="color:#e8e5da;font:600 21px \'Space Grotesk\';letter-spacing:.1em">Generating…</strong></div><input class="name-gate-input" type="text" placeholder="Enter your name" maxlength="20" autocomplete="name" /><button class="primary-button name-gate-save" type="button">Continue <span>→</span></button><small class="name-gate-status" aria-live="polite"></small></section></div>';
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
modeField.classList.add('mode-setting-field');
while (originalModeField.firstChild) modeField.appendChild(originalModeField.firstChild);
originalModeField.replaceWith(modeField);
const modeChoices = document.createElement('div');
modeChoices.className = 'mode-choices';
['Quickfire', 'SongBomb'].forEach((mode) => {
  const choice = document.createElement('button');
  choice.type = 'button';
  choice.className = 'mode-choice';
  choice.dataset.mode = mode;
  choice.textContent = getAppModeName(mode);
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

function getModeSummary() {
  const room = getRoomState();
  const rounds = Number.parseInt(document.querySelector('.rounds-stepper strong')?.textContent, 10) || Number(room.roundCount) || 10;
  const duration = Number.parseInt(document.querySelector('.duration-stepper strong')?.textContent, 10) || Number.parseInt(room.duration || room.time, 10) || 30;
  if (selectedMode === 'SongBomb') return currentLanguage === 'TH' ? '\u0e21\u0e35 3 \u0e0a\u0e35\u0e27\u0e34\u0e15 \u00b7 \u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e23\u0e2d\u0e14\u0e40\u0e1b\u0e47\u0e19\u0e04\u0e19\u0e2a\u0e38\u0e14\u0e17\u0e49\u0e32\u0e22' : '3 lives · Last player standing';
  if (selectedMode === 'Solo') return currentLanguage === 'TH' ? `${rounds} \u0e23\u0e2d\u0e1a` : `${rounds} rounds`;
  if (selectedMode === 'Quickfire') return currentLanguage === 'TH' ? `${rounds} \u0e23\u0e2d\u0e1a \u00b7 ${duration} \u0e27\u0e34\u0e19\u0e32\u0e17\u0e35\u0e15\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07` : `${rounds} rounds · ${duration} seconds each`;
  return currentLanguage === 'TH' ? '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e42\u0e2b\u0e21\u0e14\u0e40\u0e01\u0e21\u0e01\u0e48\u0e2d\u0e19' : 'Set by the mode you picked';
}

function updateModeSummary() {
  const modeDescription = selectedModeLabel.nextElementSibling;
  if (modeDescription) modeDescription.textContent = getModeSummary();
}

function updateModeSelection(showSetupSelection = false) {
  selectedModeLabel.textContent = selectedMode ? getAppModeName(selectedMode) : (currentLanguage === 'TH' ? 'เลือกโหมดเกม' : 'Select a mode');
  modal.classList.toggle('solo-setup', selectedMode === 'Solo');
  modal.classList.toggle('songbomb-setup', selectedMode === 'SongBomb');
  const timeLabel = document.querySelector('.time-setting-field>span');
  const timeHint = document.querySelector('.time-setting-field small');
  if (timeLabel) timeLabel.textContent = selectedMode === 'SongBomb' ? (currentLanguage === 'TH' ? '\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32\u0e15\u0e48\u0e2d\u0e40\u0e17\u0e34\u0e23\u0e4c\u0e19' : 'Turn length') : currentLanguage === 'TH' ? '\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32\u0e15\u0e48\u0e2d\u0e23\u0e2d\u0e1a' : 'Round length';
  if (timeHint) timeHint.textContent = selectedMode === 'SongBomb' ? 'How long each player has to answer' : currentLanguage === 'TH' ? '\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e04\u0e07\u0e17\u0e35\u0e48\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e42\u0e2b\u0e21\u0e14 Classic' : 'Fixed for the Classic game';
  const roundTotal = Number(getRoomState().roundCount) || 10;
  const modeDescription = selectedModeLabel.nextElementSibling;
  if (modeDescription) modeDescription.textContent = selectedMode === 'SongBomb' ? '3 lives · Last player standing' : selectedMode === 'Solo' ? `${roundTotal} rounds` : `${roundTotal} rounds · 30 seconds each`;
  if (modeDescription) modeDescription.textContent = getModeSummary();
  document.querySelector('.setup-header .eyebrow').textContent = selectedMode === 'Solo' ? 'Solo game setup' : 'Room setup';
  document.querySelector('.launch-button').innerHTML = selectedMode === 'Solo' ? 'Start solo play <span>&rarr;</span>' : selectedMode === 'SongBomb' ? 'Start Song Bomb <span>&rarr;</span>' : 'Start Classic <span>&rarr;</span>';
  document.querySelector('.setup-footer>span').innerHTML = selectedMode === 'Solo' ? '<i class="status-dot"></i> Single player' : '<i class="status-dot"></i> Cloudflare room';
  modeChoices.querySelectorAll('.mode-choice').forEach((choice) => {
    choice.classList.toggle('selected', showSetupSelection && choice.dataset.mode === selectedMode);
  });
  modeCards.forEach((card) => card.classList.toggle('selected', card.dataset.mode === selectedMode));
}

updateModeSelection(selectedMode !== null);
updateLaunchAvailability();
window.selectQuickfireModeForHost = (mode = 'Quickfire') => {
  selectedMode = availableModes.has(mode) && mode !== 'Solo' ? mode : 'Quickfire';
  updateModeSelection(true);
};

const vinylArtwork = document.querySelector('.hero-art');
const vinylParts = [vinylArtwork.querySelector('.record'), vinylArtwork.querySelector('.record-label')];
const hoverPreviewAudio = new Audio();
hoverPreviewAudio.preload = 'auto';
hoverPreviewAudio.volume = 0.5;
let hoverTargetVolume = 0.5;
let hoverPreviewLoading;
let hoverPreviewUrls = [];
let hoverPreviewIndex = 0;
let hoverPreviewAttempt = 0;
let isVinylHovering = false;
let hoverFadeFrame;
let vinylResetFrame;

vinylArtwork.addEventListener('mouseenter', async () => {
  const attemptId = ++hoverPreviewAttempt;
  isVinylHovering = true;
  cancelAnimationFrame(vinylResetFrame);
  vinylArtwork.classList.add('is-vinyl-hovering');
  vinylParts.forEach((part) => {
    part.style.removeProperty('animation');
    part.style.removeProperty('rotate');
    part.style.removeProperty('transition');
  });
  try {
    if (!hoverPreviewUrls.length) {
      hoverPreviewUrls = await warmHoverPreview();
    }
    if (!isVinylHovering || attemptId !== hoverPreviewAttempt) return;

    let didStartPlayback = false;
    for (let attempt = 0; attempt < hoverPreviewUrls.length && isVinylHovering; attempt += 1) {
      if (attemptId !== hoverPreviewAttempt) return;
      const index = (hoverPreviewIndex + attempt) % hoverPreviewUrls.length;
      if (hoverPreviewAudio.src !== hoverPreviewUrls[index]) {
        hoverPreviewAudio.src = hoverPreviewUrls[index];
        hoverPreviewAudio.load();
      }
      hoverPreviewAudio.volume = 0;
      try {
        await hoverPreviewAudio.play();
        hoverPreviewIndex = (index + 1) % hoverPreviewUrls.length;
        fadePreviewIn();
        didStartPlayback = true;
        break;
      } catch {
        hoverPreviewAudio.pause();
        hoverPreviewAudio.removeAttribute('src');
        hoverPreviewAudio.load();
      }
    }
    if (!didStartPlayback) hoverPreviewUrls = [];
  } catch {
    hoverPreviewUrls = [];
  } finally {
    if (hoverPreviewLoading && !hoverPreviewUrls.length) hoverPreviewLoading = null;
  }
});

vinylArtwork.addEventListener('mouseleave', () => {
  hoverPreviewAttempt += 1;
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

async function loadRandomPreviews() {
  const terms = ['pop', 'rock', 'indie', 'dance', 'r&b', 'alternative'];
  const shuffledTerms = terms.sort(() => Math.random() - 0.5);
  const previews = [];

  for (const term of shuffledTerms) {
    try {
      const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&country=US&limit=50`;
      const response = await fetchItunesSearch(endpoint,{status:'Loading song previews…'});
      if (!response.ok) continue;
      const data = await response.json();
      previews.push(...data.results.filter((track) => track.previewUrl).map((track) => track.previewUrl));
      if (previews.length >= 10) break;
    } catch {
      // Try another catalog search if this request fails.
    }
  }

  return [...new Set(previews)].sort(() => Math.random() - 0.5);
}

function warmHoverPreview() {
  if (hoverPreviewUrls.length) return Promise.resolve(hoverPreviewUrls);
  if (!hoverPreviewLoading) {
    hoverPreviewLoading = loadRandomPreviews().then((previews) => {
      hoverPreviewUrls = previews;
      if (previews[0]) {
        hoverPreviewAudio.src = previews[0];
        hoverPreviewAudio.load();
      }
      return previews;
    }).finally(() => { hoverPreviewLoading = null; });
  }
  return hoverPreviewLoading;
}

warmHoverPreview();

function openModal(requireName = false) {
  updateModeSelection(true);
  const room = getRoomState();
  document.querySelectorAll('.genre-option').forEach((choice) => {
    choice.setAttribute('aria-pressed', String(choice.classList.contains('selected')));
  });
  window.selectSetupGenre?.(room.genre || 'Everything');
  modal.hidden = false;
  modal.classList.toggle('solo-setup', selectedMode === 'Solo');
  document.querySelector('.setup-header .eyebrow').textContent = selectedMode === 'Solo' ? 'Solo game setup' : 'Room setup';
  document.querySelector('.launch-button').innerHTML = selectedMode === 'Solo' ? 'Start solo play <span>&rarr;</span>' : selectedMode === 'SongBomb' ? 'Start Song Bomb <span>&rarr;</span>' : 'Start Classic <span>&rarr;</span>';
  document.querySelector('.setup-footer>span').innerHTML = selectedMode === 'Solo' ? '<i class="status-dot"></i> Single player' : '<i class="status-dot"></i> Cloudflare room';
  modal.classList.add('page-view');
  document.body.style.overflow = 'hidden';
  if (requireName && !hostNameInput.value.trim()) {
    nameGate.hidden = false;
    nameGateInput.value = '';
    nameGateInput.focus();
  }
  updateLaunchAvailability();
}

window.selectSetupGenre = (genreName = 'Everything') => {
  const choices = [...document.querySelectorAll('.genre-option')];
  const genres = choices.filter((choice) => choice.dataset.genre !== 'Everything' && !disabledGenres.has(choice.dataset.genre));
  if (!genres.length) return;
  const requested = String(genreName || 'Everything');
  const selectedGenres = requested === 'Everything'
    ? new Set(genres.map((choice) => choice.dataset.genre))
    : new Set(requested.split('|').filter((genre) => genres.some((choice) => choice.dataset.genre === genre)));
  if (!selectedGenres.size) genres.forEach((choice) => selectedGenres.add(choice.dataset.genre));
  const allSelected = selectedGenres.size === genres.length;
  choices.forEach((choice) => {
    const selected = !choice.disabled && (choice.dataset.genre === 'Everything' ? allSelected : selectedGenres.has(choice.dataset.genre));
    choice.classList.toggle('selected', selected);
    choice.setAttribute('aria-pressed', String(selected));
  });
  const room = getRoomState();
  room.genre = allSelected ? 'Everything' : [...selectedGenres].join('|');
  saveRoomState(room);
  updateLaunchAvailability();
};

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
soundButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10"></path></svg><input class="volume-slider" type="range" min="0" max="100" value="50" aria-label="Volume" />';
userTools.insertBefore(soundButton, languageButton);
const volumeSlider = soundButton.querySelector('.volume-slider');
const savedVolume = Number(localStorage.getItem('sonora-volume'));
const initialVolume = Number.isFinite(savedVolume) && localStorage.getItem('sonora-volume') !== null
  ? Math.max(0, Math.min(100, savedVolume))
  : 50;
volumeSlider.value = String(initialVolume);
document.documentElement.style.setProperty('--volume-level', `${initialVolume}%`);
hoverTargetVolume = initialVolume / 100;
hoverPreviewAudio.volume = hoverTargetVolume;
gameVolumeInput.value = String(initialVolume);
gameVolumeInput.style.setProperty('--volume-level', `${initialVolume}%`);
const soundIcon = soundButton.querySelector('svg');
const volumeHoverBridge = document.createElement('span');
volumeHoverBridge.setAttribute('aria-hidden', 'true');
volumeHoverBridge.style.position = 'absolute';
volumeHoverBridge.style.left = '-150px';
volumeHoverBridge.style.top = '-6px';
volumeHoverBridge.style.width = '150px';
volumeHoverBridge.style.height = '28px';
volumeHoverBridge.style.zIndex = '0';
volumeHoverBridge.style.pointerEvents = 'none';
soundButton.appendChild(volumeHoverBridge);
function setSoundExpanded(expanded) {
  soundButton.classList.toggle('is-expanded', expanded);
  volumeHoverBridge.style.pointerEvents = expanded ? 'auto' : 'none';
  soundIcon.style.setProperty('left', 'auto', 'important');
  soundIcon.style.setProperty('right', '0', 'important');
  soundIcon.style.setProperty('transform', 'none', 'important');
  volumeSlider.style.setProperty('left', '-132px', 'important');
  volumeSlider.style.setProperty('right', 'auto', 'important');
  volumeSlider.style.setProperty('width', expanded ? '110px' : '0px', 'important');
  volumeSlider.style.setProperty('max-width', expanded ? '110px' : '0px', 'important');
  volumeSlider.style.setProperty('opacity', expanded ? '1' : '0', 'important');
  volumeSlider.style.setProperty('pointer-events', expanded ? 'auto' : 'none', 'important');
  volumeSlider.style.setProperty('z-index', expanded ? '2' : 'auto', 'important');
  volumeSlider.style.setProperty('transition', 'width .28s cubic-bezier(.2,.8,.2,1), max-width .28s cubic-bezier(.2,.8,.2,1), opacity .28s cubic-bezier(.2,.8,.2,1)', 'important');
}
window.setSongBombVolumePlacement = (inSongBomb) => {
  setSoundExpanded(false);
  if (inSongBomb) document.querySelector('.bomb-topbar')?.appendChild(soundButton);
  else userTools.insertBefore(soundButton, languageButton);
};
const supportsHoverVolume = window.matchMedia('(hover: hover)').matches;
let volumeCollapseTimer = 0;
soundButton.addEventListener('mouseenter', () => {
  if (!supportsHoverVolume) return;
  clearTimeout(volumeCollapseTimer);
  setSoundExpanded(true);
});
soundButton.addEventListener('mouseleave', () => {
  if (!supportsHoverVolume) return;
  clearTimeout(volumeCollapseTimer);
  volumeCollapseTimer = setTimeout(() => setSoundExpanded(false), 300);
});
soundButton.addEventListener('focusout', (event) => {
  if (supportsHoverVolume && !soundButton.contains(event.relatedTarget)) setSoundExpanded(false);
});
soundButton.addEventListener('focusin', () => { if (supportsHoverVolume) setSoundExpanded(true); });
soundButton.addEventListener('click', (event) => {
  if (supportsHoverVolume || event.target.closest('.volume-slider')) return;
  setSoundExpanded(!soundButton.classList.contains('is-expanded'));
});
document.addEventListener('pointerdown', (event) => {
  if (!supportsHoverVolume && !soundButton.contains(event.target)) setSoundExpanded(false);
});
let volumeKnobAnimation = 0;
let activeVolumePointer = null;
const valueFromPointer = (slider, event) => {
  const bounds = slider.getBoundingClientRect();
  if (!bounds.width) return Number(slider.value);
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  return min + fraction * (max - min);
};
const applyVolumeValue = (slider, value) => {
  slider.value = String(value);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
};
const beginVolumePointer = (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const slider = event.currentTarget === volumeHoverBridge ? volumeSlider : event.currentTarget;
  slider.focus({ preventScroll: true });
  cancelAnimationFrame(volumeKnobAnimation);
  activeVolumePointer = { id: event.pointerId, target: event.currentTarget, slider };
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  const start = Number(slider.value);
  const end = valueFromPointer(slider, event);
  const startTime = performance.now();
  const animate = (now) => {
    const progress = Math.min(1, (now - startTime) / 160);
    const eased = 1 - (1 - progress) ** 3;
    applyVolumeValue(slider, start + (end - start) * eased);
    if (progress < 1) volumeKnobAnimation = requestAnimationFrame(animate);
  };
  volumeKnobAnimation = requestAnimationFrame(animate);
};
const moveVolumePointer = (event) => {
  if (!activeVolumePointer || activeVolumePointer.id !== event.pointerId) return;
  cancelAnimationFrame(volumeKnobAnimation);
  applyVolumeValue(activeVolumePointer.slider, valueFromPointer(activeVolumePointer.slider, event));
};
const endVolumePointer = (event) => {
  if (activeVolumePointer?.id !== event.pointerId) return;
  if (event.type === 'pointercancel') cancelAnimationFrame(volumeKnobAnimation);
  activeVolumePointer = null;
};
for (const target of [volumeSlider, volumeHoverBridge, gameVolumeInput]) {
  target.addEventListener('pointerdown', beginVolumePointer);
  target.addEventListener('pointermove', moveVolumePointer);
  target.addEventListener('pointerup', endVolumePointer);
  target.addEventListener('pointercancel', endVolumePointer);
}
for (const target of [volumeSlider, volumeHoverBridge]) {
  target.addEventListener('mouseenter', () => clearTimeout(volumeCollapseTimer));
}
volumeSlider.addEventListener('input', (event) => {
  document.documentElement.style.setProperty('--volume-level', `${event.target.value}%`);
  hoverTargetVolume = Number(event.target.value) / 100;
  localStorage.setItem('sonora-volume', event.target.value);
  if (!hoverPreviewAudio.paused) hoverPreviewAudio.volume = hoverTargetVolume;
  gameVolumeInput.value = event.target.value;
  gameVolumeInput.style.setProperty('--volume-level', `${event.target.value}%`);
  if (gameAudio) gameAudio.volume = hoverTargetVolume;
});
const profilePanel = document.createElement('div');
profilePanel.className = 'profile-panel';
profilePanel.hidden = true;
profilePanel.innerHTML = '<p class="eyebrow">Your profile</p><label for="profile-name">Display name</label><input id="profile-name" type="text" value="" placeholder="Enter your name" maxlength="20" /><button class="primary-button profile-save" type="button">Save name</button><small class="profile-status" aria-live="polite"></small>';
userTools.appendChild(profilePanel);
const profileNameField = profilePanel.querySelector('#profile-name');
function updateProfileDisplay(name) {
  const cleanName = name.trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  avatarButton.textContent = parts.length > 1
    ? parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();
  avatarButton.setAttribute('aria-label', cleanName ? `Open profile for ${cleanName}` : 'Open profile');
  profileNameField.value = cleanName;
}
updateProfileDisplay(hostNameInput.value || localStorage.getItem(profileNameKey) || '');
hostNameInput.addEventListener('input', () => updateProfileDisplay(hostNameInput.value));
window.addEventListener('storage', (event) => {
  if (![roomStateKey, profileNameKey, setupNameKey].includes(event.key) || document.activeElement === hostNameInput) return;
  const hostName = localStorage.getItem(profileNameKey) || localStorage.getItem(setupNameKey) || getRoomState().hostName || '';
  hostNameInput.value = hostName;
  updateProfileDisplay(hostName);
});

const languageMenu = document.createElement('div');
languageMenu.className = 'language-menu';
languageMenu.hidden = true;
languageMenu.innerHTML = '<button type="button" data-language="EN">English</button><button type="button" data-language="TH">ไทย</button>';
userTools.appendChild(languageMenu);

const dropdownAnimations = new WeakMap();
function setDropdownVisible(panel, visible) {
  dropdownAnimations.get(panel)?.cancel();
  dropdownAnimations.delete(panel);
  if (visible) panel.hidden = false;
  else if (panel.hidden) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation = panel.animate(
    visible
      ? [{ opacity: 0, transform: 'translateY(-8px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }]
      : [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-8px) scale(.98)' }],
    { duration: reducedMotion ? 0 : 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
  );
  dropdownAnimations.set(panel, animation);
  animation.onfinish = () => {
    if (dropdownAnimations.get(panel) !== animation) return;
    if (!visible) panel.hidden = true;
    animation.cancel();
    dropdownAnimations.delete(panel);
  };
}

avatarButton.addEventListener('click', () => {
  profileNameField.value = hostNameInput.value.trim() || localStorage.getItem(profileNameKey) || '';
  const open = profilePanel.hidden;
  setDropdownVisible(profilePanel, open);
  setDropdownVisible(languageMenu, false);
  avatarButton.setAttribute('aria-expanded', String(open));
  languageButton.setAttribute('aria-expanded', 'false');
});

document.addEventListener('click', (event) => {
  if (!userTools.contains(event.target)) {
    setDropdownVisible(profilePanel, false);
    setDropdownVisible(languageMenu, false);
    avatarButton.setAttribute('aria-expanded', 'false');
    languageButton.setAttribute('aria-expanded', 'false');
  }
});

languageButton.addEventListener('click', () => {
  const open = languageMenu.hidden;
  setDropdownVisible(languageMenu, open);
  setDropdownVisible(profilePanel, false);
  languageButton.setAttribute('aria-expanded', String(open));
  avatarButton.setAttribute('aria-expanded', 'false');
});

profilePanel.querySelector('.profile-save').addEventListener('click', () => {
  const name = profileNameField.value.trim();
  if (!name) {
    profilePanel.querySelector('.profile-status').textContent = 'Enter your name first.';
    profileNameField.focus();
    return;
  }
  const status = profilePanel.querySelector('.profile-status');
  status.textContent = 'Name saved';
  localStorage.setItem(profileNameKey, name);
  joinNameInput.value = name;
  if (typeof hostNameInput !== 'undefined') {
    hostNameInput.value = name;
    hostNameInput.dispatchEvent(new Event('input'));
  }
  setDropdownVisible(profilePanel, false);
  avatarButton.setAttribute('aria-expanded', 'false');
});

languageMenu.querySelectorAll('button').forEach((choice) => {
  choice.addEventListener('click', () => {
    setDropdownVisible(languageMenu, false);
    languageButton.setAttribute('aria-expanded', 'false');
    applyLanguage(choice.dataset.language);
  });
});

const languageCopy = {
  EN: {
    navModes: 'Game modes', navHow: 'How it works', warmup: 'The room is warming up',
    heroTitle: 'Hear it.<br /><em>Know it.</em><br />Name it.', heroDescription: 'A fast, friendly music guessing game for the people who can identify a song from the first three seconds.',
    create: '＋ Create a room', join: 'Join with a code', pick: 'Pick your poison', choose: 'Choose a mode',
    modes: [['Classic', '10 songs - 30 seconds'], ['Solo Play', 'Play on your own']], genres: ['Pop anthems', 'Indie & alternative', 'Hip-hop & R&B', 'Throwback classics', 'Thai songs', 'J-Pop'],
    zero: 'ZERO FRICTION', howTitle: 'Built for the<br /><em>perfect chorus.</em>', howText: 'Make a room, send the code, and let the music do the talking. No accounts. No setup. Just your people and a playlist.',
    profile: 'Your profile', display: 'Display name', save: 'Save name', saved: 'Name saved', setup: 'Room setup', make: 'Make it <em>yours.</em>',
    gameMode: 'Game mode', modeHint: 'Set by the mode you picked', max: 'Max players', maxHint: 'Everyone gets a turn to guess', genre: 'Song genre', genreHint: 'Keep the playlist unpredictable', time: 'Time per song', timeHint: 'How long players have to lock in', invite: 'Invite your people', sendCode: 'Send them<br /><em>the code.</em>', inviteHint: 'Players can join from any device using the room code.', copy: 'Copy room code', private: 'Cloudflare room', start: 'Start the room', room: 'The room', who: 'Who is <em>in?</em>', roomHint: 'Share the code above and watch your crew appear here.', host: 'Room host', joined: 'Joined just now', waiting: 'Waiting for players', waitingHint: 'Send the invite code to your crew',
    joinRoom: 'Join the room', joinTitle: 'Find your<br /><em>music people.</em>', joinText: 'Enter your name and the room code shared by the host.', yourName: 'Your name', roomCode: 'Room code', joinButton: 'Join room', noName: 'Add your name so the room knows who joined.', badCode: 'That code does not match an active room.', joinedMessage: 'You joined the room. Waiting for the host to start...', live: 'Room live', crew: 'Your crew is <em>here.</em>', modeLabel: 'Mode', playersLabel: 'Players', genreLabel: 'Genre', perSong: 'Per song', you: 'You',
  },
  TH: {
    navModes: 'โหมดเกม', navHow: 'วิธีเล่น', warmup: 'ห้องกำลังเตรียมพร้อม',
    heroTitle: 'ฟังให้ดี<br /><em>รู้ให้ทัน</em><br />ทายชื่อเพลง', heroDescription: 'เกมทายเพลงแบบรวดเร็วและเป็นกันเอง สำหรับคนที่จำเพลงได้ตั้งแต่สามวินาทีแรก',
    create: '＋ สร้างห้อง', join: 'เข้าร่วมด้วยรหัส', guessed: 'ผู้เล่นทายเพลงแล้ววันนี้', pick: 'เลือกโหมดของคุณ', choose: 'เลือกโหมด',
    modes: [['คลาสสิก', '10 เพลง - 30 วินาที'], ['เล่นคนเดียว', 'เล่นเกมด้วยตัวเอง']], genres: ['เพลงป๊อป', 'อินดี้และอัลเทอร์เนทีฟ', 'ฮิปฮอปและอาร์แอนด์บี', 'เพลงคลาสสิกย้อนยุค', 'เพลงไทย', 'เจป๊อป'],
    zero: 'เล่นได้ทันที', howTitle: 'สร้างมาเพื่อ<br /><em>ท่อนฮุกที่ใช่</em>', howText: 'สร้างห้อง ส่งรหัส แล้วให้เสียงเพลงเป็นคนพูด ไม่ต้องสมัคร ไม่ต้องตั้งค่า มีแค่เพื่อนและเพลย์ลิสต์ของคุณ',
    profile: 'โปรไฟล์ของคุณ', display: 'ชื่อที่แสดง', save: 'บันทึกชื่อ', saved: 'บันทึกชื่อแล้ว', setup: 'ตั้งค่าห้อง', make: 'จัดห้องในแบบ<br /><em>ของคุณ</em>',
    gameMode: 'โหมดเกม', modeHint: 'เลือกจากโหมดที่คุณต้องการ', max: 'ผู้เล่นสูงสุด', maxHint: 'ทุกคนจะได้มีโอกาสทาย', genre: 'แนวเพลง', genreHint: 'ทำให้เพลย์ลิสต์คาดเดาไม่ได้', time: 'เวลาต่อเพลง', timeHint: 'เวลาที่ใช้ล็อกคำตอบ', invite: 'ชวนเพื่อนของคุณ', sendCode: 'ส่งรหัส<br /><em>ให้เพื่อน</em>', inviteHint: 'เข้าร่วมได้จากทุกอุปกรณ์ ไม่ต้องสมัครบัญชี', copy: 'คัดลอกรหัสห้อง', private: 'ห้องส่วนตัว', start: 'เริ่มห้อง', room: 'ในห้องนี้', who: 'ใคร<em>เข้าร่วมแล้ว?</em>', roomHint: 'แชร์รหัสด้านบน แล้วดูเพื่อนของคุณเข้าร่วมที่นี่', host: 'เจ้าของห้อง', joined: 'เข้าร่วมเมื่อครู่', waiting: 'รอผู้เล่น', waitingHint: 'ส่งรหัสเชิญให้เพื่อนของคุณ',
    joinRoom: 'เข้าร่วมห้อง', joinTitle: 'พบแก๊ง<br /><em>คนรักเพลง</em>', joinText: 'ใส่ชื่อและรหัสเชิญที่เจ้าของห้องส่งให้คุณ', yourName: 'ชื่อของคุณ', roomCode: 'รหัสห้อง', joinButton: 'เข้าร่วมห้อง', noName: 'ใส่ชื่อของคุณเพื่อให้ห้องรู้ว่าใครเข้าร่วม', badCode: 'รหัสนี้ไม่ตรงกับห้องที่กำลังเปิดอยู่', joinedMessage: 'คุณเข้าร่วมห้องแล้ว กำลังรอเจ้าของห้องเริ่มเกม...', live: 'ห้องกำลังเปิด', crew: 'แก๊งของคุณ<br /><em>อยู่ที่นี่แล้ว</em>', modeLabel: 'โหมด', playersLabel: 'ผู้เล่น', genreLabel: 'แนวเพลง', perSong: 'ต่อเพลง', you: 'คุณ',
  },
};

const localizedSiteCopy = {
  EN: {
    pageTitle: 'SONORA | Multiplayer music guessing', pageDescription: 'A multiplayer song guessing room for people who know every chorus.',
    profileAria: 'Open profile', languageAria: 'Change language', artAria: 'Abstract illustration of a record player',
    playSomething: 'PLAY SOMETHING', iconic: 'ICONIC', stereo: 'STEREO', copyright: 'Copyright © 2026 thankkyadture.work. All rights reserved.',
    footerHome: 'Home', footerTerms: 'Terms', footerAbout: 'About Us', backHome: '← Back to home', copyRoomLink: 'Copy room link',
    termsTitle: 'Terms Of <em>Service</em>', termsDate: 'Last updated 11/10/2026',
    termsHeadings: ['Acceptance of Terms', 'Changes to Terms', 'User Responsibilities', 'Copyright', 'Refund Policy', 'Contact Us'],
    termsParagraphs: [
      'These Terms of Service apply when you use the SONORA PROJECT website, content, features, products, or services.',
      'Please read these terms carefully before using the service. By using the service, you agree to be bound by and comply with these terms.',
      'We may update these terms from time to time, so you should check regularly to stay informed of any changes.',
      'Continued use of the service after revised terms are published constitutes your acceptance of those changes.',
      'If you discover bugs or vulnerabilities while using SONORA PROJECT, please report them through the project repository or by contacting the project owner.',
      'Publicly disclosing vulnerabilities or using them for commercial exploitation may result in access being suspended.',
      'All illustrations, designs, and other images used in SONORA PROJECT services are provided for this project and may be protected by their respective licenses.',
      'You may use project materials only in accordance with applicable license terms. Commercial use is not permitted unless you have written permission.',
      'SONORA PROJECT does not currently sell paid products or services. If that changes, any applicable refund policy will be published here.',
      'If you have questions about these terms, please contact the project owner through the links on the About Us page.'
    ],
    aboutTitle: 'About <em>Us</em>', aboutParagraphs: [
      'SONORA is a multiplayer song guessing game for friends who know a chorus before it starts.',
      'Follow the project, find the source, or join the community:'
    ],
    joinBack: '← Back to home', joinNote: 'Make some noise.', namePlaceholder: 'Enter your name', profilePlaceholder: 'Enter your name',
    hostNameHint: 'This is how your crew will see you', nameGateEyebrow: 'Before we start', nameGateTitle: 'What should<br /><em>we call you?</em>',
    nameGateDescription: 'Your name will appear in the room for everyone to see.', roomCode: 'Room code', continue: 'Continue',
    joinedRoom: 'Cloudflare room', joinedCrew: 'Your crew is <em>here.</em>',
    settings: ['Mode', 'Players', 'Genre', 'Per song', 'Difficulty', 'Choices', 'Rounds'],
    settingsDifficulty: ['Easy', 'Medium', 'Hard', 'Extreme'],
    setupPlayer: 'Max players', setupPlayerHint: 'Everyone gets a turn to guess',
    setupTimeHint: 'How long players have to lock in', setupChoicesHint: 'Choose from 4 to 8 songs per round',
    setupRoundsHint: 'Choose how many rounds to play', setupDifficultyHint: 'Choose how popular or obscure the songs can be',
    launchSolo: 'Start solo play', launchBomb: 'Start Song Bomb', launchClassic: 'Start Classic',
    modeClassic: 'Classic', modeSolo: 'Solo Play', modeBomb: 'Song Bomb', soloBadge: 'Single player', roomBadge: 'Cloudflare room',
    volume: 'Volume', play: 'Play current section', skip: 'Skip', seconds: 'SECONDS LEFT', roundLabel: 'ROUND',
    ready: 'THE NEXT SONG IS READY', answerChoices: 'choices', score: 'Live scores', leaderboard: 'Leaderboard',
    scoring: 'How scoring works', scoringText: 'Correct at 0.1s earns the most. Wrong guesses, later clues, and slower answers reduce your points.',
    resultCorrect: 'You guessed correctly', resultWrong: 'You’re incorrect', roundComplete: 'Round complete', revealed: 'Song revealed',
    nextRound: 'Next round in', continueRound: 'Continue', winnerEyebrow: 'GAME COMPLETE', winnerTitle: 'The winner', winnerBack: 'Back to room',
    bombHint: 'Name the song or artist before the bomb goes off.', bombPlaceholder: 'Type a song name or artist…',
    bombSkip: 'Skip turn', bombSubmit: 'Submit guess', bombEvents: 'Song Bomb events', bombSeconds: 'SECONDS', bombPreview: 'Song preview',
    firstCatalogLoad: 'First-time catalog loading may take a while.'
  },
  TH: {
    pageTitle: 'SONORA | เกมทายเพลงหลายคน', pageDescription: 'ห้องทายเพลงสำหรับกลุ่มเพื่อนที่จำเพลงโปรดได้ตั้งแต่ท่อนแรก',
    profileAria: 'เปิดโปรไฟล์', languageAria: 'เปลี่ยนภาษา', artAria: 'ภาพประกอบเครื่องเล่นแผ่นเสียง',
    playSomething: 'เปิดเพลงที่', iconic: 'ทุกคนจำได้', stereo: 'สเตอริโอ', copyright: 'ลิขสิทธิ์ © 2026 thankkyadture.work สงวนลิขสิทธิ์',
    footerHome: 'หน้าแรก', footerTerms: 'ข้อกำหนดการใช้งาน', footerAbout: 'เกี่ยวกับเรา', backHome: '← กลับหน้าแรก', copyRoomLink: 'คัดลอกลิงก์ห้อง',
    termsTitle: 'ข้อกำหนด<br /><em>การให้บริการ</em>', termsDate: 'อัปเดตล่าสุด 11/10/2026',
    termsHeadings: ['การยอมรับข้อกำหนด', 'การเปลี่ยนแปลงข้อกำหนด', 'ความรับผิดชอบของผู้ใช้', 'ลิขสิทธิ์', 'นโยบายการคืนเงิน', 'ติดต่อเรา'],
    termsParagraphs: [
      'ข้อกำหนดการให้บริการนี้มีผลเมื่อคุณใช้เว็บไซต์ เนื้อหา ฟีเจอร์ ผลิตภัณฑ์ หรือบริการของ SONORA PROJECT',
      'โปรดอ่านข้อกำหนดเหล่านี้ก่อนใช้บริการ การใช้บริการถือว่าคุณยอมรับและตกลงปฏิบัติตามข้อกำหนดนี้',
      'เราอาจปรับปรุงข้อกำหนดเป็นครั้งคราว โปรดกลับมาตรวจสอบเพื่อรับทราบการเปลี่ยนแปลง',
      'หากคุณใช้บริการต่อหลังจากมีการเผยแพร่ข้อกำหนดฉบับแก้ไข จะถือว่าคุณยอมรับการเปลี่ยนแปลงนั้น',
      'หากพบข้อผิดพลาดหรือช่องโหว่ระหว่างใช้ SONORA PROJECT โปรดแจ้งผ่านคลังโค้ดของโครงการหรือติดต่อเจ้าของโครงการ',
      'การเปิดเผยช่องโหว่ต่อสาธารณะหรือการนำไปใช้เพื่อแสวงหาประโยชน์ทางการค้า อาจทำให้ถูกระงับการเข้าถึง',
      'ภาพประกอบ งานออกแบบ และรูปภาพที่ใช้ในบริการ SONORA PROJECT จัดทำขึ้นสำหรับโครงการนี้ และอาจได้รับความคุ้มครองตามใบอนุญาตของแต่ละรายการ',
      'คุณใช้สื่อของโครงการได้ตามเงื่อนไขใบอนุญาตที่เกี่ยวข้อง ห้ามใช้เพื่อการค้า เว้นแต่ได้รับอนุญาตเป็นลายลักษณ์อักษร',
      'ขณะนี้ SONORA PROJECT ยังไม่มีการจำหน่ายสินค้าหรือบริการแบบชำระเงิน หากมีการเปลี่ยนแปลง เราจะประกาศนโยบายการคืนเงินที่เกี่ยวข้องไว้ที่นี่',
      'หากมีคำถามเกี่ยวกับข้อกำหนด โปรดติดต่อเจ้าของโครงการผ่านลิงก์ในหน้าเกี่ยวกับเรา'
    ],
    aboutTitle: 'เกี่ยวกับ<br /><em>เรา</em>', aboutParagraphs: [
      'SONORA คือเกมทายเพลงแบบหลายคนสำหรับกลุ่มเพื่อนที่จำท่อนฮุกได้ก่อนเพลงจะเริ่ม',
      'ติดตามโครงการ ดูซอร์สโค้ด หรือเข้าร่วมชุมชนของเราได้ที่:'
    ],
    joinBack: '← กลับหน้าแรก', joinNote: 'มาเปิดเพลงกัน', namePlaceholder: 'พิมพ์ชื่อของคุณ', profilePlaceholder: 'พิมพ์ชื่อของคุณ',
    hostNameHint: 'ชื่อที่เพื่อน ๆ จะเห็นในห้อง', nameGateEyebrow: 'ก่อนเริ่มเกม', nameGateTitle: 'อยากให้เรา<br /><em>เรียกคุณว่าอะไร?</em>',
    nameGateDescription: 'ชื่อของคุณจะแสดงให้ทุกคนในห้องเห็น', roomCode: 'รหัสห้อง', continue: 'ดำเนินการต่อ',
    joinedRoom: 'ห้องบน Cloudflare', joinedCrew: 'กลุ่มของคุณ<br /><em>อยู่ที่นี่แล้ว</em>',
    settings: ['โหมด', 'ผู้เล่น', 'แนวเพลง', 'ต่อเพลง', 'ความยาก', 'ตัวเลือก', 'รอบ'],
    settingsDifficulty: ['ง่าย', 'ปานกลาง', 'ยาก', 'ยากมาก'],
    setupPlayer: 'จำนวนผู้เล่นสูงสุด', setupPlayerHint: 'ทุกคนจะได้ผลัดกันทายเพลง',
    setupTimeHint: 'เวลาที่ผู้เล่นมีเพื่อตอบ', setupChoicesHint: 'เลือกเพลงได้รอบละ 4 ถึง 8 เพลง',
    setupRoundsHint: 'กำหนดจำนวนรอบที่ต้องการเล่น', setupDifficultyHint: 'เลือกระดับความนิยมของเพลง',
    launchSolo: 'เริ่มเล่นคนเดียว', launchBomb: 'เริ่มเกมระเบิดเพลง', launchClassic: 'เริ่มเกมคลาสสิก',
    modeClassic: 'คลาสสิก', modeSolo: 'เล่นคนเดียว', modeBomb: 'เกมระเบิดเพลง', soloBadge: 'ผู้เล่นคนเดียว', roomBadge: 'ห้องบน Cloudflare',
    volume: 'ระดับเสียง', play: 'เล่นช่วงเพลงปัจจุบัน', skip: 'ข้าม', seconds: 'วินาทีที่เหลือ', roundLabel: 'รอบ',
    ready: 'เพลงถัดไปพร้อมแล้ว', answerChoices: 'ตัวเลือก', score: 'คะแนนสด', leaderboard: 'ตารางคะแนน',
    scoring: 'วิธีคิดคะแนน', scoringText: 'ตอบถูกตั้งแต่ช่วง 0.1 วินาทีจะได้คะแนนสูงสุด การตอบผิด การขอคำใบ้เพิ่ม หรือการตอบช้าจะทำให้คะแนนลดลง',
    resultCorrect: 'คุณตอบถูกต้อง', resultWrong: 'คำตอบของคุณไม่ถูกต้อง', roundComplete: 'จบรอบแล้ว', revealed: 'เฉลยเพลง',
    nextRound: 'เริ่มรอบถัดไปใน', continueRound: 'เล่นต่อ', winnerEyebrow: 'จบเกม', winnerTitle: 'ผู้ชนะ', winnerBack: 'กลับไปที่ห้อง',
    bombHint: 'พิมพ์ชื่อเพลงหรือศิลปินก่อนระเบิดทำงาน', bombPlaceholder: 'พิมพ์ชื่อเพลงหรือศิลปิน…',
    bombSkip: 'ข้ามตานี้', bombSubmit: 'ส่งคำตอบ', bombEvents: 'เหตุการณ์ในเกมระเบิดเพลง', bombSeconds: 'วินาที', bombPreview: 'ตัวอย่างเพลง',
    firstCatalogLoad: 'การโหลดคลังเพลงครั้งแรกอาจใช้เวลาสักครู่'
  }
};

const thaiGenreNames = {
  'Everything': 'ทุกแนวเพลง', 'Pop anthems': 'เพลงป๊อป', 'Indie & alternative': 'อินดี้และอัลเทอร์เนทีฟ',
  'Hip-hop & R&B': 'ฮิปฮอปและอาร์แอนด์บี', 'Throwback classics': 'เพลงคลาสสิกย้อนยุค',
  'Thai songs': 'เพลงไทย', 'J-Pop': 'เจป๊อป'
};
const thaiStatusCopy = {
  'Choose quickly for the highest score.': 'รีบเลือกคำตอบเพื่อรับคะแนนสูงสุด',
  'Finding songs with playable previews…': 'กำลังค้นหาเพลงที่มีตัวอย่างให้เล่น…',
  'Song preview': 'ตัวอย่างเพลง', 'Song preview playing': 'กำลังเล่นตัวอย่างเพลง',
  'Song preview could not start': 'เล่นตัวอย่างเพลงไม่ได้', 'Starting song preview…': 'กำลังเริ่มเล่นตัวอย่างเพลง…',
  'Song preview could not start. Check your connection and try again.': 'เล่นตัวอย่างเพลงไม่ได้ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
  'Buffering song preview…': 'กำลังโหลดตัวอย่างเพลง…',
  'The preview could not load. Check your connection and try again.': 'โหลดตัวอย่างเพลงไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
  'The preview could not start. Check your connection and try again.': 'เล่นตัวอย่างเพลงไม่ได้ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
  'Starting the game…': 'กำลังเริ่มเกม…', 'Preparing playable songs…': 'กำลังเตรียมเพลงที่เล่นได้…',
  'Preparing the song list…': 'กำลังเตรียมรายชื่อเพลง…', 'Finding playable songs for the first round…': 'กำลังหาเพลงสำหรับรอบแรก…',
  'The host closed this room.': 'เจ้าของห้องปิดห้องนี้แล้ว',
  'Choose a mode on the home page before starting.': 'โปรดเลือกโหมดเกมจากหน้าแรกก่อนเริ่ม',
  'Room created. Copy the code to invite players.': 'สร้างห้องแล้ว คัดลอกรหัสเพื่อชวนผู้เล่น',
  'Creating your room and invite code…': 'กำลังสร้างห้องและรหัสเชิญ…', 'Creating room…': 'กำลังสร้างห้อง…',
  'Connected to Cloudflare room.': 'เชื่อมต่อกับห้องบน Cloudflare แล้ว',
  'Connection lost. Reconnecting…': 'ขาดการเชื่อมต่อ กำลังเชื่อมต่อใหม่…',
  'Unable to connect to the room. Check that the Cloudflare Worker is deployed.': 'เชื่อมต่อห้องไม่ได้ โปรดตรวจสอบว่าได้เผยแพร่ Cloudflare Worker แล้ว',
  'Joined. You can edit your name while waiting.': 'เข้าร่วมห้องแล้ว คุณเปลี่ยนชื่อได้ระหว่างรอ',
  'You guessed correctly': 'คุณตอบถูกต้อง', 'You’re incorrect': 'คำตอบของคุณไม่ถูกต้อง',
  'Wrong guess · waiting for other players': 'ตอบผิด · กำลังรอผู้เล่นคนอื่น',
  'Correct · waiting for the others': 'ตอบถูก · กำลังรอผู้เล่นคนอื่น',
  'Wrong guess · 5 points deducted. Waiting for the other players…': 'ตอบผิด หัก 5 คะแนน กำลังรอผู้เล่นคนอื่น…',
  'Wrong guess — 5 points deducted. Choices are dimmed and locked until the next round.': 'ตอบผิด หัก 5 คะแนน ตัวเลือกจะถูกล็อกจนถึงรอบถัดไป',
  'Name saved.': 'บันทึกชื่อแล้ว', 'Enter a name to continue.': 'โปรดกรอกชื่อเพื่อดำเนินการต่อ',
  'Enter your name first.': 'โปรดกรอกชื่อก่อน', 'Add your name to join the room.': 'โปรดกรอกชื่อเพื่อเข้าร่วมห้อง',
  'Enter the room code from your host.': 'กรอกรหัสห้องที่ได้รับจากเจ้าของห้อง',
  'Room code copied.': 'คัดลอกรหัสห้องแล้ว', 'Create a room first.': 'โปรดสร้างห้องก่อน',
  'You were removed from the room. Enter a room code to join another room.': 'คุณถูกนำออกจากห้องแล้ว กรอกรหัสห้องเพื่อเข้าร่วมห้องอื่น',
  'Reconnecting to the room. Select Back to room again when connected.': 'กำลังเชื่อมต่อห้องใหม่ เมื่อเชื่อมต่อแล้วให้เลือกกลับไปที่ห้องอีกครั้ง',
  'Your room session ended. Enter a room code to join again.': 'เซสชันห้องของคุณสิ้นสุดแล้ว กรอกรหัสห้องเพื่อเข้าร่วมอีกครั้ง',
  'Names can only be changed while waiting in the lobby.': 'เปลี่ยนชื่อได้เฉพาะตอนรออยู่ในห้องล็อบบี้',
  'This room link is invalid. Ask the host for a new link.': 'ลิงก์ห้องนี้ใช้ไม่ได้ โปรดขอลิงก์ใหม่จากเจ้าของห้อง',
  'The room did not confirm the match start. Check your connection and try again.': 'ห้องไม่ได้ยืนยันการเริ่มเกม โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
  'Only the host can start the room.': 'เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้',
  'The preview could not start': 'เล่นตัวอย่างเพลงไม่ได้'
};
function translateAppText(value) {
  const original = String(value ?? '');
  if (currentLanguage !== 'TH') return original;
  if (thaiStatusCopy[original]) return thaiStatusCopy[original];
  let match = original.match(/^Continue \((\d+\/\d+)\)$/);
  if (match) return `เล่นต่อ (${match[1]})`;
  match = original.match(/^Continue \((\d+)\/(\d+)\)$/);
  if (match) return `เล่นต่อ (${match[1]}/${match[2]})`;
  match = original.match(/^Searching (.+) catalog…$/);
  if (match) return `กำลังค้นหาคลังเพลง${thaiGenreNames[match[1]] || match[1]}…`;
  match = original.match(/^(.+): ([\d,]+) screened songs found\.$/);
  if (match) return `พบเพลงที่ผ่านการคัดกรอง ${match[2]} เพลงในแนว${thaiGenreNames[match[1]] || match[1]}`;
  match = original.match(/^Loading more (.+) songs…$/);
  if (match) return `กำลังโหลดเพลงแนว${thaiGenreNames[match[1]] || match[1]} เพิ่ม…`;
  match = original.match(/^Finding songs with playable previews… (\d+)\/(\d+)$/);
  if (match) return `กำลังค้นหาเพลงที่มีตัวอย่างให้เล่น… ${match[1]}/${match[2]}`;
  match = original.match(/^Preparing round (\d+) of (\d+)(?: · (.+))?…$/);
  if (match) return `กำลังเตรียมรอบ ${match[1]} จาก ${match[2]}${match[3] ? ` · ${thaiGenreNames[match[3]] || match[3]}` : ''}…`;
  match = original.match(/^Correct! \+(\d+) points\..*$/);
  if (match) return `ตอบถูก! +${match[1]} คะแนน กำลังรอผู้เล่นคนอื่น…`;
  match = original.match(/^You guessed correctly\./);
  if (match) return 'ตอบถูกต้อง!';
  match = original.match(/^No correct guesses\. It was (.+)\.$/);
  if (match) return `ไม่มีใครตอบถูก เพลงคือ ${match[1]}`;
  match = original.match(/^Couldn't prepare songs: (.+)$/);
  if (match) return `เตรียมเพลงไม่สำเร็จ: ${match[1]}`;
  match = original.match(/^Preparing Song Bomb songs… (\d+)\/(\d+)$/);
  if (match) return `กำลังเตรียมเพลงสำหรับเกมระเบิดเพลง… ${match[1]}/${match[2]}`;
  match = original.match(/^Preparing round (\d+) of (\d+)…$/);
  if (match) return `กำลังเตรียมรอบ ${match[1]} จาก ${match[2]}…`;
  match = original.match(/^Correct! \+(\d+) points\./);
  if (match) return `ตอบถูก! +${match[1]} คะแนน`;
  match = original.match(/^Continue \((\d+)\/(\d+)\)$/);
  if (match) return `เล่นต่อ (${match[1]}/${match[2]})`;
  match = original.match(/^ROUND GENRE · (.+)$/);
  if (match) return `แนวเพลงประจำรอบ · ${thaiGenreNames[match[1]] || match[1]}`;
  match = original.match(/^Your lives: ([♥♡]+)$/);
  if (match) return `ชีวิตที่เหลือ: ${match[1]}`;
  match = original.match(/^(.+) has the bomb$/);
  if (match) return `${match[1]} ถือระเบิดอยู่`;
  match = original.match(/^Final score · (\d+) points$/);
  if (match) return `คะแนนสุดท้าย · ${match[1]} คะแนน`;
  match = original.match(/^Last player standing · (\d+) lives left$/);
  if (match) return `ผู้เล่นคนสุดท้ายที่เหลือ · เหลือ ${match[1]} ชีวิต`;
  match = original.match(/^(.+) wins!$/);
  if (match) return `${match[1]} ชนะ!`;
  match = original.match(/^You are out$/);
  if (match) return 'คุณออกจากเกมแล้ว';
  return original;
}
window.translateAppText = translateAppText;
const dynamicUiSelector = '.round-feedback,.copy-status,.join-status,.name-gate-status,.profile-status,.guess-status,.bomb-turn-status,.bomb-audio-status,.result-player-status,.winner-score,.winner-card .eyebrow,#winner-title,.continue-round,.vinyl-stage>p,.bomb-lives';
function localizeDynamicUiElement(element) {
  if (!element) return;
  const original = element.textContent;
  if (currentLanguage === 'TH') {
    if (original === element.dataset.appLanguageTranslated) return;
    const translated = translateAppText(original);
    if (translated !== original) {
      element.dataset.appLanguageOriginal = original;
      element.dataset.appLanguageTranslated = translated;
      element.textContent = translated;
    } else if (element.dataset.appLanguageTranslated) {
      delete element.dataset.appLanguageOriginal;
      delete element.dataset.appLanguageTranslated;
    }
  } else if (element.dataset.appLanguageTranslated) {
    if (original === element.dataset.appLanguageTranslated) element.textContent = element.dataset.appLanguageOriginal || original;
    delete element.dataset.appLanguageOriginal;
    delete element.dataset.appLanguageTranslated;
  }
}
function refreshDynamicUiLanguage() {
  document.querySelectorAll(dynamicUiSelector).forEach(localizeDynamicUiElement);
}
const dynamicUiLanguageObserver = new MutationObserver((records) => {
  const changed = new Set();
  for (const record of records) {
    const candidate = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
    const element = candidate?.matches?.(dynamicUiSelector) ? candidate : candidate?.closest?.(dynamicUiSelector);
    if (element) changed.add(element);
  }
  changed.forEach(localizeDynamicUiElement);
});
dynamicUiLanguageObserver.observe(document.body, { childList: true, characterData: true, subtree: true });

function applyLanguage(language) {
  currentLanguage = language === 'TH' ? 'TH' : 'EN';
  try { localStorage.setItem(languageStorageKey, currentLanguage); } catch {}
  languageButton.querySelector('span').textContent = currentLanguage;
  const copy = languageCopy[currentLanguage] || languageCopy.EN;
  const ui = localizedSiteCopy[currentLanguage];
  const setText = (selector, value) => { const element = document.querySelector(selector); if (element) element.textContent = value; };
  const setHtml = (selector, value) => { const element = document.querySelector(selector); if (element) element.innerHTML = value; };
  setText('.topbar-links a:first-child', copy.navModes); setText('.topbar-links a:last-child', copy.navHow); setText('.eyebrow', copy.warmup);
  setHtml('.hero h1', copy.heroTitle); setText('.hero-description', copy.heroDescription); setText('.js-create-room', copy.create); setText('.js-join-room', copy.join + ' →');
  setText('.section-heading .eyebrow', copy.pick); setText('.section-heading h2', copy.choose); setText('.how-label', `01 ${copy.zero}`); setHtml('.how-copy h2', copy.howTitle); setText('.how-copy p', copy.howText);
  document.querySelectorAll('.mode-card').forEach((card) => { const modeCopy = card.dataset.mode === 'Quickfire' ? copy.modes[0] : card.dataset.mode === 'Solo' ? copy.modes[1] : ['Song Bomb', `3 lives \u00b7 Last player standing`]; setTextFor(card, '.mode-name', modeCopy[0]); setTextFor(card, '.mode-detail', modeCopy[1]); });
  modeChoices.querySelectorAll('.mode-choice').forEach((choice) => { choice.textContent = getAppModeName(choice.dataset.mode); });
  document.querySelectorAll('.genre-option').forEach((choice, index) => {
    choice.textContent = index === 0 ? (language === 'TH' ? 'ทุกแนว' : 'Everything') : language === 'TH' && choice.dataset.genre === 'J-Pop' ? 'J-Pop' : (copy.genres[index - 1] || choice.textContent);
  });
  setText('.selected-mode-label', selectedMode ? getAppModeName(selectedMode) : (currentLanguage === 'TH' ? 'เลือกโหมดเกม' : 'Select a mode'));
  setText('.profile-panel .eyebrow', copy.profile); setText('.profile-panel label', copy.display); setText('.profile-save', copy.save);
  setText('.setup-header .eyebrow', selectedMode === 'Solo' ? (language === 'TH' ? '\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e40\u0e25\u0e48\u0e19\u0e04\u0e19\u0e40\u0e14\u0e35\u0e22\u0e27' : 'Solo game setup') : copy.setup); setHtml('.setup-header h2', copy.make); setText('.setup-fields .setup-field:nth-child(1)>span', copy.yourName); setText('.setup-fields .setup-field:nth-child(2)>span', copy.gameMode); setText('.setup-fields .setup-field:nth-child(2) small', copy.modeHint); setText('.setup-fields .player-setting-field>span', copy.max); setText('.setup-fields .player-setting-field small', copy.maxHint); setText('.setup-fields .genre-setting-field>span', copy.genre); setText('.setup-fields .genre-setting-field small', copy.genreHint);
  setText('.setup-fields .setup-field:nth-child(2) small', selectedMode ? getModeSummary() : copy.modeHint);
  const thaiSetup = currentLanguage === 'TH';
  setText('.time-setting-field>span', selectedMode === 'SongBomb' ? (thaiSetup ? '\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32\u0e15\u0e48\u0e2d\u0e40\u0e17\u0e34\u0e23\u0e4c\u0e19' : 'Turn length') : thaiSetup ? '\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32\u0e15\u0e48\u0e2d\u0e23\u0e2d\u0e1a' : 'Round length');
  setText('.time-setting-field small', selectedMode === 'SongBomb' ? 'How long each player has to answer' : thaiSetup ? '\u0e01\u0e33\u0e2b\u0e19\u0e14\u0e04\u0e07\u0e17\u0e35\u0e48\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e42\u0e2b\u0e21\u0e14 Classic' : 'Fixed for the Classic game');
  setText('.choice-count-field>span', thaiSetup ? '\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01' : 'Answer choices');
  setText('.choice-count-field small', thaiSetup ? '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49 4 \u0e16\u0e36\u0e07 8 \u0e40\u0e1e\u0e25\u0e07\u0e15\u0e48\u0e2d\u0e23\u0e2d\u0e1a' : 'Choose from 4 to 8 songs per round');
  setText('.rounds-setting-field>span', thaiSetup ? '\u0e08\u0e33\u0e19\u0e27\u0e19\u0e23\u0e2d\u0e1a' : 'Rounds');
  setText('.rounds-setting-field small', thaiSetup ? '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e08\u0e33\u0e19\u0e27\u0e19\u0e23\u0e2d\u0e1a\u0e17\u0e35\u0e48\u0e08\u0e30\u0e40\u0e25\u0e48\u0e19' : 'Choose how many rounds to play');
  setText('.difficulty-setting-field>span', thaiSetup ? '\u0e23\u0e30\u0e14\u0e31\u0e1a\u0e04\u0e27\u0e32\u0e21\u0e22\u0e32\u0e01\u0e02\u0e2d\u0e07\u0e40\u0e1e\u0e25\u0e07' : 'Song difficulty');
  setText('.difficulty-setting-field small', thaiSetup ? '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e23\u0e30\u0e14\u0e31\u0e1a\u0e04\u0e27\u0e32\u0e21\u0e19\u0e34\u0e22\u0e21\u0e02\u0e2d\u0e07\u0e40\u0e1e\u0e25\u0e07' : 'Choose how popular or obscure the songs can be');
  setText('.difficulty-options button.easy', thaiSetup ? '\u0e07\u0e48\u0e32\u0e22' : 'Easy'); setText('.difficulty-options button.normal', thaiSetup ? '\u0e1b\u0e01\u0e15\u0e34' : 'Medium'); setText('.difficulty-options button.hard', thaiSetup ? '\u0e22\u0e32\u0e01' : 'Hard'); setText('.difficulty-options button.extreme', thaiSetup ? '\u0e22\u0e32\u0e01\u0e21\u0e32\u0e01' : 'Extreme');
  document.querySelector('.difficulty-setting-field [role="group"]')?.setAttribute('aria-label', thaiSetup ? '\u0e23\u0e30\u0e14\u0e31\u0e1a\u0e04\u0e27\u0e32\u0e21\u0e22\u0e32\u0e01\u0e02\u0e2d\u0e07\u0e40\u0e1e\u0e25\u0e07' : 'Song difficulty');
  document.querySelectorAll('.time-setting-field .stepper-arrow').forEach((button, index) => button.setAttribute('aria-label', `${selectedMode === 'SongBomb' ? thaiSetup ? '\u0e1b\u0e23\u0e31\u0e1a\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32\u0e15\u0e48\u0e2d\u0e40\u0e17\u0e34\u0e23\u0e4c\u0e19' : 'Adjust turn length' : thaiSetup ? '\u0e1b\u0e23\u0e31\u0e1a\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32' : 'Adjust round length'}: ${index === 0 ? (thaiSetup ? '\u0e25\u0e14' : 'decrease') : (thaiSetup ? '\u0e40\u0e1e\u0e34\u0e48\u0e21' : 'increase')}`));
  document.querySelectorAll('.choice-count-field .stepper-arrow').forEach((button, index) => button.setAttribute('aria-label', `${thaiSetup ? '\u0e1b\u0e23\u0e31\u0e1a\u0e08\u0e33\u0e19\u0e27\u0e19\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01' : 'Adjust answer choices'}: ${index === 0 ? (thaiSetup ? '\u0e25\u0e14' : 'decrease') : (thaiSetup ? '\u0e40\u0e1e\u0e34\u0e48\u0e21' : 'increase')}`));
  document.querySelectorAll('.rounds-setting-field .stepper-arrow').forEach((button, index) => button.setAttribute('aria-label', `${thaiSetup ? '\u0e1b\u0e23\u0e31\u0e1a\u0e08\u0e33\u0e19\u0e27\u0e19\u0e23\u0e2d\u0e1a' : 'Adjust rounds'}: ${index === 0 ? (thaiSetup ? '\u0e25\u0e14' : 'decrease') : (thaiSetup ? '\u0e40\u0e1e\u0e34\u0e48\u0e21' : 'increase')}`));
  const durationCount = Number.parseInt(document.querySelector('.duration-stepper strong')?.textContent, 10) || 30;
  const choiceCount = Number.parseInt(document.querySelector('.choice-stepper strong')?.textContent, 10) || 4;
  const roundCount = Number.parseInt(document.querySelector('.rounds-stepper strong')?.textContent, 10) || 10;
  setText('.duration-stepper strong', `${durationCount} ${thaiSetup ? '\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35' : 'seconds'}`);
  setText('.choice-stepper strong', `${choiceCount} ${thaiSetup ? '\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01' : 'choices'}`);
  setText('.rounds-stepper strong', `${roundCount} ${thaiSetup ? '\u0e23\u0e2d\u0e1a' : 'rounds'}`);
  setText('.invite-panel .eyebrow', copy.invite); setHtml('.invite-panel h3', copy.sendCode); setText('.invite-panel p:not(.eyebrow):not(.copy-status)', copy.inviteHint); setHtml('.copy-button', language === 'TH' ? 'คัดลอกลิงก์ห้อง <span aria-hidden="true">↗</span>' : 'Copy room link <span aria-hidden="true">↗</span>'); setText('.setup-footer>span', copy.private); setText('.launch-button', selectedMode === 'Solo' ? (language === 'TH' ? '\u0e40\u0e23\u0e34\u0e48\u0e21\u0e40\u0e25\u0e48\u0e19' : 'Start solo play') : selectedMode === 'SongBomb' ? 'Start Song Bomb' : 'Start Classic');
  setText('.join-content .eyebrow', copy.joinRoom); setHtml('.join-content h2', copy.joinTitle); setText('.join-content>p:not(.eyebrow)', copy.joinText); setText('label[for="player-name"]', copy.yourName); setText('label[for="join-code"]', copy.roomCode); setText('.join-form .primary-button', copy.joinButton);
  setText('.joined-room-heading .eyebrow', copy.live); setHtml('.joined-room-heading h3', copy.crew); setText('.joined-room-heading .host-settings span:nth-child(1) small', copy.modeLabel); setText('.joined-room-heading .host-settings span:nth-child(2) small', copy.playersLabel); setText('.joined-room-heading .host-settings span:nth-child(3) small', copy.genreLabel); setText('.joined-room-heading .host-settings span:nth-child(4) small', copy.perSong);
  const playerValue = document.querySelector('.player-stepper strong');
  if (playerValue) playerValue.textContent = `${Number.parseInt(playerValue.textContent, 10) || 8} ${language === 'TH' ? 'ผู้เล่น' : 'players'}`;
  setText('.host-name-field small', language === 'TH' ? 'นี่คือชื่อที่เพื่อนจะเห็น' : 'This is how your crew will see you');
  setHtml('.joined-panel h3', copy.who); setText('.joined-panel .joined-subtitle', copy.roomHint); setText('.joined-panel .joined-player:first-child small', copy.host); setText('.joined-panel .joined-player:nth-child(2) small', copy.joined); setText('.joined-panel .joined-player:last-child strong', copy.waiting); setText('.joined-panel .joined-player:last-child small', copy.waitingHint); setText('.joined-room-heading .joined-subtitle', copy.roomHint); setText('.joined-room-list .joined-player:first-child small', copy.host); setText('.joined-room-list .joined-player:nth-child(2) small', copy.joined); setText('.joined-room-list .joined-player:nth-child(3) small', copy.joined); setText('.joined-room-list .joined-player:last-child small', copy.you);
  const game = currentLanguage === 'TH' ? {
    leave: '\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e2b\u0e49\u0e2d\u0e07', listen: '\u0e1f\u0e31\u0e07\u0e43\u0e2b\u0e49\u0e14\u0e35', nameTrack: '\u0e17\u0e32\u0e22\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07', seconds: '\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35\u0e17\u0e35\u0e48\u0e40\u0e2b\u0e25\u0e37\u0e2d', ready: '\u0e40\u0e1e\u0e25\u0e07\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e41\u0e25\u0e49\u0e27', pick: '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07', choices: '\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01', score: '\u0e04\u0e30\u0e41\u0e19\u0e19\u0e2a\u0e14', leaderboard: '\u0e15\u0e32\u0e23\u0e32\u0e07\u0e04\u0e30\u0e41\u0e19\u0e19', scoring: '\u0e27\u0e34\u0e18\u0e35\u0e04\u0e34\u0e14\u0e04\u0e30\u0e41\u0e19\u0e19', roundComplete: '\u0e08\u0e1a\u0e23\u0e2d\u0e1a\u0e41\u0e25\u0e49\u0e27', revealed: '\u0e40\u0e1e\u0e25\u0e07\u0e40\u0e09\u0e25\u0e22', next: '\u0e23\u0e2d\u0e1a\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e43\u0e19', continue: '\u0e40\u0e25\u0e48\u0e19\u0e15\u0e48\u0e2d', bomb: '\u0e40\u0e1e\u0e25\u0e07\u0e1a\u0e2d\u0e21\u0e1a\u0e4c', bombHint: '\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07\u0e2b\u0e23\u0e37\u0e2d\u0e28\u0e34\u0e25\u0e1b\u0e34\u0e19\u0e43\u0e2b\u0e49\u0e17\u0e31\u0e19\u0e01\u0e48\u0e2d\u0e19\u0e23\u0e30\u0e40\u0e1a\u0e34\u0e14'
  } : { leave: '← Leave room', listen: 'Listen close', nameTrack: 'Name that track.', seconds: 'SECONDS LEFT', ready: 'THE NEXT SONG IS READY', pick: 'Pick the song', choices: 'choices', score: 'Live scores', leaderboard: 'Leaderboard', scoring: 'How scoring works', roundComplete: 'Round complete', revealed: 'Song revealed', next: 'Next round in', continue: 'Continue', bomb: 'SONG BOMB', bombHint: 'Name the song or artist before the bomb goes off.' };
  document.querySelectorAll('.game-exit').forEach((button) => { button.textContent = game.leave; }); setText('.round-heading .eyebrow', game.listen); setHtml('.round-heading h1', game.nameTrack); setText('.round-clock small', game.seconds); setText('.answer-heading>strong', game.pick); setText('.game-leaderboard>.eyebrow', game.score); setText('.game-leaderboard h2', game.leaderboard); setText('.scoring-note>b', game.scoring); setText('.round-result-card>.eyebrow', game.roundComplete); setText('.bomb-topbar>span', game.bomb); setText('.bomb-mode-label', game.bomb); setText('.bomb-instruction', game.bombHint);
  document.title = ui.pageTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', ui.pageDescription);
  document.querySelector('.language-button')?.setAttribute('aria-label', ui.languageAria);
  document.querySelector('.avatar-button')?.setAttribute('aria-label', ui.profileAria);
  document.querySelector('.hero-art')?.setAttribute('aria-label', ui.artAria);
  setHtml('.art-caption>span:last-child', `${ui.playSomething}<br /><strong>${ui.iconic}</strong>`);
  setText('.record-label small', ui.stereo);
  document.querySelector('main.app-shell>nav')?.setAttribute('aria-label', currentLanguage === 'TH' ? 'เมนูหลัก' : 'Main navigation');
  document.querySelector('.footer-links')?.setAttribute('aria-label', currentLanguage === 'TH' ? 'เมนูท้ายหน้า' : 'Footer navigation');
  document.querySelector('.social-links')?.setAttribute('aria-label', currentLanguage === 'TH' ? 'ช่องทางโซเชียลของ SONORA' : 'SONORA social links');
  setText('.site-footer>p', ui.copyright);
  setText('.footer-home', ui.footerHome); setText('.footer-terms', ui.footerTerms); setText('.footer-about', ui.footerAbout);
  document.querySelectorAll('.info-back').forEach((button) => { button.textContent = ui.backHome; });
  setHtml('#terms-page h1', ui.termsTitle); setText('#terms-page .info-date', ui.termsDate);
  document.querySelectorAll('#terms-page .info-content h2').forEach((heading, index) => { if (ui.termsHeadings[index]) heading.textContent = ui.termsHeadings[index]; });
  const termsParagraphs = [...document.querySelectorAll('#terms-page .info-content>p')].filter((paragraph) => !paragraph.classList.contains('eyebrow') && !paragraph.classList.contains('info-date'));
  termsParagraphs.forEach((paragraph, index) => { if (ui.termsParagraphs[index]) paragraph.textContent = ui.termsParagraphs[index]; });
  setHtml('#about-page h1', ui.aboutTitle);
  const aboutParagraphs = [...document.querySelectorAll('.about-content>p')].filter((paragraph) => !paragraph.classList.contains('eyebrow'));
  aboutParagraphs.forEach((paragraph, index) => { if (ui.aboutParagraphs[index]) paragraph.textContent = ui.aboutParagraphs[index]; });
  document.querySelector('.join-back')?.replaceChildren(document.createTextNode(ui.joinBack));
  setText('.join-note span:last-child', ui.joinNote);
  document.querySelector('#player-name')?.setAttribute('placeholder', ui.namePlaceholder);
  document.querySelector('.host-name-input')?.setAttribute('placeholder', ui.namePlaceholder);
  document.querySelector('.name-gate-input')?.setAttribute('placeholder', ui.namePlaceholder);
  document.querySelector('#profile-name')?.setAttribute('placeholder', ui.profilePlaceholder);
  setText('.host-name-field small', ui.hostNameHint);
  setText('.name-gate-card .eyebrow', ui.nameGateEyebrow); setHtml('.name-gate-card h2', ui.nameGateTitle);
  setText('.name-gate-card>p:not(.eyebrow)', ui.nameGateDescription); setText('.name-gate-card span', ui.roomCode);
  setText('.name-gate-save', ui.continue);
  setText('.profile-panel .eyebrow', copy.profile); setText('.profile-panel label', copy.display);
  document.querySelector('.profile-save')?.setAttribute('aria-label', copy.save);
  document.querySelectorAll('.joined-room-panel .host-settings span small').forEach((label, index) => { if (ui.settings[index]) label.textContent = ui.settings[index]; });
  setText('.joined-room-heading .eyebrow', ui.joinedRoom); setHtml('.joined-room-heading h3', ui.joinedCrew);
  setText('.player-setting-field>span', ui.setupPlayer); setText('.player-setting-field small', ui.setupPlayerHint);
  setText('.time-setting-field small', selectedMode === 'SongBomb' ? (currentLanguage === 'TH' ? 'แต่ละคนมีเวลาตอบเท่าไร' : 'How long each player has to answer') : (currentLanguage === 'TH' ? 'กำหนดเวลาให้แต่ละรอบ' : 'Fixed for the selected game mode'));
  setText('.choice-count-field small', ui.setupChoicesHint); setText('.rounds-setting-field small', ui.setupRoundsHint);
  setText('.difficulty-setting-field small', ui.setupDifficultyHint);
  setText('.game-skip', ui.skip);
  gameView.querySelector('.player-controls input[type="range"]')?.setAttribute('aria-label', ui.volume);
  document.querySelector('.game-play')?.setAttribute('aria-label', ui.play);
  document.querySelector('.bomb-log')?.setAttribute('aria-label', ui.bombEvents);
  document.querySelector('.bomb-submit')?.setAttribute('aria-label', ui.bombSubmit);
  const bombInput = document.querySelector('#bomb-song-input');
  if (bombInput) { bombInput.placeholder = ui.bombPlaceholder; bombInput.setAttribute('aria-label', ui.bombPlaceholder); }
  setText('.bomb-skip', ui.bombSkip); setText('.bomb-submit', ui.bombSubmit);
  setText('.bomb-core small', ui.bombSeconds);
  setText('.scoring-note p', ui.scoringText);
  const continueButton = document.querySelector('.continue-round');
  if (continueButton) {
    const count = continueButton.textContent.match(/\((\d+\/\d+)\)/)?.[1];
    continueButton.textContent = count ? `${ui.continueRound} (${count})` : ui.continueRound;
  }
  setText('.winner-card .eyebrow', ui.winnerEyebrow);
  setText('#winner-title', ui.winnerTitle); setText('.winner-exit', ui.winnerBack);
  const roundLabel = gameView.querySelector('.game-topbar>span');
  if (roundLabel) {
    const number = roundLabel.querySelector('.game-round')?.textContent || '1';
    const total = Number(getRoomState().roundCount) || 10;
    roundLabel.innerHTML = `${ui.roundLabel} <strong class="game-round">${number}</strong> / ${total}`;
  }
  const resultTitle = document.querySelector('#round-result-title');
  if (resultTitle && ['Song revealed', ui.revealed].includes(resultTitle.textContent)) resultTitle.textContent = ui.revealed;
  const countdownLabel = document.querySelector('.result-countdown')?.firstChild;
  if (countdownLabel?.nodeType === Node.TEXT_NODE) countdownLabel.textContent = `${ui.nextRound} `;
  document.querySelector('.copy-code-button')?.setAttribute('aria-label', currentLanguage === 'TH' ? 'คัดลอกรหัสห้อง' : 'Copy room code');
  document.querySelector('.copy-code-button')?.setAttribute('title', currentLanguage === 'TH' ? 'คัดลอกรหัสห้อง' : 'Copy room code');
  document.querySelector('.copy-button')?.setAttribute('aria-label', ui.copyRoomLink);
  document.querySelector('.bomb-suggestions')?.setAttribute('aria-label', currentLanguage === 'TH' ? 'คำแนะนำเพลง' : 'Song suggestions');
  document.querySelector('.name-gate-code')?.setAttribute('aria-label', ui.roomCode);
  document.querySelectorAll('.catalog-loading-indicator small').forEach((label) => { label.textContent = ui.firstCatalogLoad; });
  const modeNames = { Quickfire: ui.modeClassic, SongBomb: ui.modeBomb, Solo: ui.modeSolo };
  modeChoices.querySelectorAll('.mode-choice').forEach((choice) => { choice.textContent = modeNames[choice.dataset.mode] || getAppModeName(choice.dataset.mode); });
  document.querySelectorAll('.mode-card').forEach((card) => {
    const mode = card.dataset.mode;
    const name = modeNames[mode] || card.querySelector('.mode-name')?.textContent;
    const detail = mode === 'Quickfire' ? (currentLanguage === 'TH' ? '10 เพลง · 30 วินาที' : '10 songs · 30 seconds')
      : mode === 'Solo' ? (currentLanguage === 'TH' ? 'เล่นเกมด้วยตัวเอง' : 'Play on your own')
        : (currentLanguage === 'TH' ? 'มี 3 ชีวิต · อยู่รอดเป็นคนสุดท้าย' : '3 lives · Last player standing');
    setTextFor(card, '.mode-name', name); setTextFor(card, '.mode-detail', detail);
  });
  setText('.selected-mode-label', selectedMode ? getAppModeName(selectedMode) : (currentLanguage === 'TH' ? 'เลือกโหมดเกม' : 'Select a mode'));
  setHtml('.launch-button', `${selectedMode === 'Solo' ? ui.launchSolo : selectedMode === 'SongBomb' ? ui.launchBomb : ui.launchClassic} <span aria-hidden="true">→</span>`);
  setHtml('.setup-footer>span', `<i class="status-dot"></i>${selectedMode === 'Solo' ? ui.soloBadge : ui.roomBadge}`);
  setHtml('.copy-button', `${ui.copyRoomLink} <span aria-hidden="true">↗</span>`);
  document.querySelectorAll('.game-skip').forEach((button) => { button.innerHTML = `${ui.skip} <span>→</span>`; });
  document.querySelectorAll('.difficulty-label').forEach((label) => {
    const level = label.closest('.difficulty-meter')?.className.match(/difficulty-(easy|medium|hard|extreme)/)?.[1] || 'medium';
    label.textContent = currentLanguage === 'TH' ? (ui.settingsDifficulty[['easy', 'medium', 'hard', 'extreme'].indexOf(level)]) : level[0].toUpperCase() + level.slice(1);
  });
  const footerStatus = document.querySelector('.setup-footer>span');
  if (footerStatus && !footerStatus.querySelector('.status-dot')) {
    const statusDot = document.createElement('i');
    statusDot.className = 'status-dot';
    footerStatus.prepend(statusDot);
  }
  document.documentElement.lang = currentLanguage === 'TH' ? 'th' : 'en';
  refreshDynamicUiLanguage();
}

function setTextFor(parent, selector, value) { const element = parent.querySelector(selector); if (element) element.textContent = value; }

window.applyAppLanguage = applyLanguage;
window.getAppLanguage = () => currentLanguage;
window.refreshSetupLanguage = () => {
  const thai = currentLanguage === 'TH';
  const setCount = (selector, suffix) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = `${Number.parseInt(element.textContent, 10) || 0} ${suffix}`;
  };
  setCount('.player-stepper strong', thai ? '\u0e1c\u0e39\u0e49\u0e40\u0e25\u0e48\u0e19' : 'players');
  setCount('.duration-stepper strong', thai ? '\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35' : 'seconds');
  setCount('.choice-stepper strong', thai ? '\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01' : 'choices');
  setCount('.rounds-stepper strong', thai ? '\u0e23\u0e2d\u0e1a' : 'rounds');
  updateModeSummary();
};
languageButton.querySelector('span').textContent = currentLanguage;
applyLanguage(currentLanguage);
const translatedGameLabels = ['.game-exit', '.round-heading .eyebrow', '.round-heading h1', '.round-clock small', '.answer-heading>strong', '.game-leaderboard>.eyebrow', '.game-leaderboard h2', '.scoring-note>b', '.round-result-card>.eyebrow', '.bomb-mode-label', '.bomb-instruction'];
const gameLanguageObserver = new MutationObserver(() => {
  if (!gameView.isConnected) return;
  const language = currentLanguage;
  const game = language === 'TH'
    ? { leave: '\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e2b\u0e49\u0e2d\u0e07', listen: '\u0e1f\u0e31\u0e07\u0e43\u0e2b\u0e49\u0e14\u0e35', nameTrack: '\u0e17\u0e32\u0e22\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07', seconds: '\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35\u0e17\u0e35\u0e48\u0e40\u0e2b\u0e25\u0e37\u0e2d', pick: '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07', score: '\u0e04\u0e30\u0e41\u0e19\u0e19\u0e2a\u0e14', leaderboard: '\u0e15\u0e32\u0e23\u0e32\u0e07\u0e04\u0e30\u0e41\u0e19\u0e19', scoring: '\u0e27\u0e34\u0e18\u0e35\u0e04\u0e34\u0e14\u0e04\u0e30\u0e41\u0e19\u0e19', roundComplete: '\u0e08\u0e1a\u0e23\u0e2d\u0e1a\u0e41\u0e25\u0e49\u0e27', bomb: '\u0e40\u0e1e\u0e25\u0e07\u0e1a\u0e2d\u0e21\u0e1a\u0e4c', bombHint: '\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e0a\u0e37\u0e48\u0e2d\u0e40\u0e1e\u0e25\u0e07\u0e2b\u0e23\u0e37\u0e2d\u0e28\u0e34\u0e25\u0e1b\u0e34\u0e19\u0e43\u0e2b\u0e49\u0e17\u0e31\u0e19\u0e01\u0e48\u0e2d\u0e19\u0e23\u0e30\u0e40\u0e1a\u0e34\u0e14' }
    : { leave: '← Leave room', listen: 'Listen close', nameTrack: 'Name that track.', seconds: 'SECONDS LEFT', pick: 'Pick the song', score: 'Live scores', leaderboard: 'Leaderboard', scoring: 'How scoring works', roundComplete: 'Round complete', bomb: 'SONG BOMB', bombHint: 'Name the song or artist before the bomb goes off.' };
  const values = [game.leave, game.listen, game.nameTrack, game.seconds, game.pick, game.score, game.leaderboard, game.scoring, game.roundComplete, game.bomb, game.bombHint];
  translatedGameLabels.forEach((selector, index) => { const element = gameView.querySelector(selector); if (element && element.textContent !== values[index]) element.textContent = values[index]; });
});
gameLanguageObserver.observe(gameView, { childList: true, subtree: true });
window.addEventListener('storage', (event) => {
  if (event.key === languageStorageKey && event.newValue) applyLanguage(event.newValue);
});
