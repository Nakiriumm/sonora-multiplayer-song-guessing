const modeCards = document.querySelectorAll('.mode-card');
const modal = document.querySelector('.modal-backdrop');
const selectedModeLabel = document.querySelector('.selected-mode-label');
const copyStatus = document.querySelector('.copy-status');
let selectedMode = 'Quickfire';
const availableModes = new Set(['Quickfire']);
const modeDisplayNames = { Quickfire: 'Classic' };

modeCards.forEach((card) => {
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

const joinPage = document.createElement('div');
joinPage.className = 'join-page';
joinPage.hidden = true;
joinPage.innerHTML = '<button class="join-back" type="button">← Back to home</button><div class="join-content"><p class="eyebrow">Join the room</p><h2>Find your<br /><em>music people.</em></h2><p>Enter your name and the room code shared by the host.</p><form class="join-form"><label for="player-name">Your name</label><input id="player-name" type="text" placeholder="e.g. Jamie" autocomplete="name" maxlength="20" /><label for="join-code">Room code</label><input id="join-code" type="text" placeholder="SONORA-XXXXXXX" autocomplete="off" maxlength="32" /><button class="primary-button" type="submit">Join room <span>→</span></button><small class="join-status" aria-live="polite"></small></form></div><div class="join-note"><span class="wordmark-mark">S</span><strong>SONORA</strong><span>Make some noise.</span></div>';
document.body.appendChild(joinPage);
const joinedRoomPanel = document.createElement('div');
joinedRoomPanel.className = 'joined-room-panel';
joinedRoomPanel.innerHTML = '<div class="joined-room-heading"><p class="eyebrow">Cloudflare room</p><h3>Your crew is <em>here.</em></h3><div class="host-settings"><span><small>Mode</small><strong>Classic</strong></span><span><small>Players</small><strong>8 max</strong></span><span><small>Genre</small><strong>Everything</strong></span><span><small>Per song</small><strong>30 sec</strong></span></div></div><div class="joined-room-list"></div>';
joinedRoomPanel.hidden = true;
joinPage.querySelector('.join-content').appendChild(joinedRoomPanel);

document.querySelector('.js-join-room').addEventListener('click', () => {
  joinPage.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('#player-name').focus();
});

joinPage.querySelector('.join-back').addEventListener('click', closeJoinPage);
document.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

// Round UI and synced room game state.
const gameView = document.createElement('section');
gameView.className = 'game-view'; gameView.hidden = true;
gameView.innerHTML = `<header class="game-topbar"><button class="game-exit" type="button">← Leave room</button><b>SONORA</b><span>ROUND <strong class="game-round">1</strong> / 10</span></header><div class="game-layout"><section class="round-play"><div class="round-heading"><div><p class="eyebrow">Listen close</p><h1>Name that <em>track.</em></h1></div><div class="round-clock"><strong>30</strong><small>SECONDS LEFT</small></div></div><div class="vinyl-stage"><div class="game-vinyl"><span>?</span></div><p>THE NEXT SONG IS READY</p></div><div class="track-progress"><div class="track-line"><i></i></div><div class="track-marks"><span class="active">0.1s</span><span>0.5s</span><span>2s</span><span>8s</span><span>15s</span></div></div><div class="player-controls"><label><span class="speaker-icon">◖))</span><input aria-label="Volume" type="range" min="0" max="100" value="65"></label><button class="game-play" type="button" aria-label="Play current section"><span class="play-icon" aria-hidden="true"></span></button><button class="game-skip" type="button">Skip <span>→</span></button></div><div class="answer-heading"><strong>Pick the song</strong><span class="guess-status">4 choices</span></div><div class="song-choices"></div><p class="round-feedback" aria-live="polite">Choose quickly for the highest score.</p></section><aside class="game-leaderboard"><p class="eyebrow">Live scores</p><h2>Leaderboard</h2><div class="score-list"></div><div class="scoring-note"><b>How scoring works</b><p>Correct at 0.1s earns the most. Wrong guesses, later clues, and slower answers reduce your points.</p></div></aside></div>`;
document.body.appendChild(gameView);
const roundResult = document.createElement('div');
roundResult.className = 'round-result-backdrop';
roundResult.hidden = true;
roundResult.innerHTML = '<section class="round-result-card" role="dialog" aria-modal="true" aria-labelledby="round-result-title"><div class="result-vinyl"><span>SONORA</span></div><p class="eyebrow">Round complete</p><h2 id="round-result-title">Song revealed</h2><p class="result-artist"></p><p class="result-countdown">Next round in <b>5</b>s</p><button class="continue-round" type="button">Continue (0/1)</button></section>';
gameView.appendChild(roundResult);
const winnerResult=document.createElement('div');
winnerResult.className='winner-backdrop';
winnerResult.hidden=true;
winnerResult.innerHTML='<section class="winner-card" role="dialog" aria-modal="true" aria-labelledby="winner-title"><div class="winner-crown" aria-hidden="true">♛</div><p class="eyebrow">GAME COMPLETE</p><h2 id="winner-title">The winner</h2><p class="winner-score"></p><button class="winner-exit" type="button">Back to room</button></section>';
gameView.appendChild(winnerResult);
gameView.querySelector('.round-heading h1').hidden = true;
gameView.querySelector('.speaker-icon').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10"></path></svg>';
// Keep the legacy elapsed-time readout node available for the scoring clock.
const elapsedClock = document.createElement('span');
elapsedClock.className = 'attempt-clock';
elapsedClock.hidden = true;
gameView.appendChild(elapsedClock);
const initialGameVolume = Number(localStorage.getItem('sonora-volume'));
const gameVolumeInput = gameView.querySelector('[aria-label="Volume"]');
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
  ['Dynamite','BTS'],['Butter','BTS'],['Boy With Luv','BTS'],['How You Like That','BLACKPINK'],
  ['Pink Venom','BLACKPINK'],['Kill This Love','BLACKPINK'],['Viva La Vida','Coldplay'],['Yellow','Coldplay'],
  ['Fix You','Coldplay'],['The Scientist','Coldplay'],['In the End','Linkin Park'],['Numb','Linkin Park'],
  ['What I’ve Done','Linkin Park'],['Lose Yourself','Eminem'],['Without Me','Eminem'],['Not Afraid','Eminem'],
  ['California Gurls','Katy Perry'],['Firework','Katy Perry'],['Roar','Katy Perry'],['Bad Romance','Lady Gaga'],
  ['Poker Face','Lady Gaga'],['Shallow','Lady Gaga'],['Sorry','Justin Bieber'],['Love Yourself','Justin Bieber'],
  ['Peaches','Justin Bieber'],['Hips Don’t Lie','Shakira'],['Whenever, Wherever','Shakira'],['Waka Waka','Shakira'],
  ['Dancing Queen','ABBA'],['Mamma Mia','ABBA'],['Gimme! Gimme! Gimme!','ABBA'],['Take On Me','a-ha'],
  ['The Final Countdown','Europe'],['Eye of the Tiger','Survivor'],['Africa','Toto'],['Rosanna','Toto'],
  ['September','Earth, Wind & Fire'],['I Will Survive','Gloria Gaynor'],['Girls Just Want to Have Fun','Cyndi Lauper'],['Like a Prayer','Madonna'],
  ['Vogue','Madonna'],['Crazy','Gnarls Barkley'],['Get Lucky','Daft Punk'],['One More Time','Daft Punk'],
].map(([title,artist])=>[title,artist,'']));
const songAssetCache = new Map();
function normalizeSongText(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function loadSongAsset(song){const key=`${song[0]}|${song[1]}`;if(songAssetCache.has(key))return songAssetCache.get(key);const request=(async()=>{try{const term=encodeURIComponent(`${song[0]} ${song[1]}`);const response=await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&country=US&limit=50`,{signal:AbortSignal.timeout(10000)});if(!response.ok)return null;const data=await response.json();const title=normalizeSongText(song[0]),artist=normalizeSongText(song[1]);return data.results.find(result=>normalizeSongText(result.trackName)===title&&normalizeSongText(result.artistName)===artist)||null;}catch{return null;}})();songAssetCache.set(key,request);return request;}
const genreArtistSeeds={
  'Pop anthems':['Taylor Swift','Dua Lipa','The Weeknd','Ariana Grande','Bruno Mars','Lady Gaga','Katy Perry','Rihanna','Beyonce','Ed Sheeran','Justin Bieber','Miley Cyrus','Adele','Harry Styles','Olivia Rodrigo','Sabrina Carpenter','Chappell Roan','Billie Eilish','Maroon 5','Kesha','P!nk','Shawn Mendes','Lizzo','Kylie Minogue'],
  'Indie & alternative':['Arctic Monkeys','Radiohead','The Strokes','The Killers','Coldplay','Imagine Dragons','Tame Impala','The 1975','Florence + The Machine','Lorde','Twenty One Pilots','Paramore','Nirvana','Oasis','The Cure','Muse','Foo Fighters','Green Day','Weezer','Vampire Weekend','Cage the Elephant','Lana Del Rey','The Cranberries','Blur'],
  'Hip-hop & R&B':['Drake','Kendrick Lamar','Eminem','SZA','The Weeknd','Beyonce','Rihanna','TLC','Usher','Alicia Keys','Outkast','Jay-Z','Missy Elliott','Tupac','Notorious B.I.G.','Lauryn Hill','Chris Brown','Doja Cat','Post Malone','Travis Scott','Childish Gambino','Mary J. Blige','Bruno Mars','TLC'],
  'Throwback classics':['The Beatles','Queen','Michael Jackson','ABBA','Whitney Houston','Elton John','Madonna','Prince','Stevie Wonder','Earth, Wind & Fire','Fleetwood Mac','David Bowie','The Rolling Stones','Bee Gees','Cyndi Lauper','Bon Jovi','a-ha','Toto','Journey','Gloria Gaynor','Eurythmics','Aretha Franklin','The Supremes','Elvis Presley'],
  'Thai songs':['Bodyslam','Palmy','Bird Thongchai McIntyre','Slot Machine','Getsunova','Lula','Da Endorphine','Lipta','Three Man Down','Tilly Birds','Only Monday','Ink Waruntorn','Polycat','Scrubb','Potato','Big Ass','Labanoon','Cocktail','Pang Nakarin','Klear','Joey Phuwasit','Jeff Satur','Nont Tanont','Bowkylion'],
  'J-Pop':['YOASOBI','Ado','Official HIGE DANdism','Mrs. GREEN APPLE','King Gnu','Kenshi Yonezu','LiSA','Aimyon','Hikaru Utada','AKB48','Perfume','Arashi','Snow Man','back number','Vaundy','Eve','Aimer','RADWIMPS','BUMP OF CHICKEN','Sakanaction','Yorushika','Sukima Switch','Nogizaka46','ONE OK ROCK']
};
const genreCatalogCache=new Map();
let activeCatalog=roundSongs;
const genreAliases={'เพลงป๊อป':'Pop anthems','อินดี้และอัลเทอร์เนทีฟ':'Indie & alternative','ฮิปฮอปและอาร์แอนด์บี':'Hip-hop & R&B','เพลงคลาสสิกย้อนยุค':'Throwback classics','เพลงไทย':'Thai songs','เจป๊อป':'J-Pop'};
async function loadGenreCatalog(genre){genre=genreAliases[genre]||genre;const artists=genreArtistSeeds[genre];if(!artists)return roundSongs;if(genreCatalogCache.has(genre))return genreCatalogCache.get(genre);const storageKey=`sonora-song-catalog-v1-${genre}`;try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(saved)&&saved.length>=100){for(const song of saved)songAssetCache.set(`${song[0]}|${song[1]}`,Promise.resolve({trackName:song[0],artistName:song[1],artworkUrl100:song[2],previewUrl:song[3]}));genreCatalogCache.set(genre,saved);return saved;}}catch{}const catalog=[];const seen=new Set();for(let offset=0;offset<artists.length&&catalog.length<100;offset+=8){const batch=artists.slice(offset,offset+8);const results=await Promise.all(batch.map(async artist=>{try{const country=genre==='Thai songs'?'TH':genre==='J-Pop'?'JP':'US';const response=await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=song&country=${country}&limit=50`,{signal:AbortSignal.timeout(10000)});if(!response.ok)return[];const data=await response.json();return data.results||[];}catch{return[];}}));for(const tracks of results){for(const track of tracks){if(!track.previewUrl||!track.trackName||!track.artistName)continue;const song=[track.trackName,track.artistName,track.artworkUrl100||'',track.previewUrl];const key=`${normalizeSongText(song[0])}|${normalizeSongText(song[1])}`;if(seen.has(key))continue;seen.add(key);songAssetCache.set(`${song[0]}|${song[1]}`,Promise.resolve(track));catalog.push(song);if(catalog.length===100)break;}if(catalog.length===100)break;}}genreCatalogCache.set(genre,catalog);if(catalog.length>=100){try{localStorage.setItem(storageKey,JSON.stringify(catalog));}catch{}}return catalog;}
function applySongArtwork(element,asset){if(!element||!asset?.artworkUrl100)return;const imageUrl=asset.artworkUrl100.replace(/^http:/,'https:');const image=new Image();image.onload=()=>{element.style.backgroundImage=`url("${imageUrl}")`;element.style.backgroundSize='cover';element.style.backgroundPosition='center';element.classList.add('cover-loaded');};image.src=imageUrl;}
const choiceArtworkObserver=new MutationObserver(()=>{const currentRound=roundNo;gameView.querySelectorAll('.song-choice').forEach(choice=>{const title=choice.querySelector('.song-title strong')?.textContent;const artist=choice.dataset.artist;const song=[...activeCatalog,...roundSongs].find(item=>item[0]===title&&(!artist||item[1]===artist));if(song)loadSongAsset(song).then(asset=>{if(currentRound===roundNo&&choice.isConnected)applySongArtwork(choice.querySelector('.cover-art'),asset);});});});
choiceArtworkObserver.observe(gameView.querySelector('.song-choices'),{childList:true});
const resultArtworkObserver=new MutationObserver(()=>{if(roundResult.hidden)return;const title=roundResult.querySelector('#round-result-title').textContent;const song=activeRoundSong||roundSongs.find(item=>item[0]===title);if(song)loadSongAsset(song).then(asset=>{if(!roundResult.hidden&&roundResult.querySelector('#round-result-title').textContent===title)applySongArtwork(roundResult.querySelector('.result-vinyl span'),asset);});});
resultArtworkObserver.observe(roundResult,{attributes:true,attributeFilter:['hidden']});
let roundNo=0,stageNo=0,roundLeft=30,elapsed=0,roundTick,attemptTick,breakTick,roundPlayers=[],gameAudio=null,audioUrlIndex=-1,progressFrame=0,activeRoundSong=null,playRequest=0;
const usedRoundSongs=new Set();
const unavailableSongs=new Set();
async function pickPlayableChoices(){const choices=[],candidates=activeCatalog.filter(song=>!usedRoundSongs.has(song)&&!unavailableSongs.has(`${song[0]}|${song[1]}`)).sort(()=>Math.random()-.5);for(const song of candidates){const asset=await loadSongAsset(song);if(!asset?.previewUrl){unavailableSongs.add(`${song[0]}|${song[1]}`);continue;}if(!song[3])song[3]=asset.previewUrl;choices.push(song);if(choices.length===4)break;}choices.forEach(song=>usedRoundSongs.add(song));return choices;}
async function launchGame(){usedRoundSongs.clear();const r=getRoomState();roundPlayers=r.players.filter(p=>p.name).map(p=>({name:p.name,score:0}));if(!roundPlayers.length)roundPlayers=[{name:'You',score:0}];roundNo=0;roundResult.hidden=true;winnerResult.hidden=true;document.querySelector('main').hidden=true;document.querySelector('.site-footer').hidden=true;gameView.hidden=false;document.body.style.overflow='auto';gameView.querySelector('.round-feedback').textContent='Preparing the song list…';activeCatalog=await loadGenreCatalog(r.genre||'Everything');if(activeCatalog.length<4)activeCatalog=roundSongs;nextRound();}
function scoreBoard(){gameView.querySelector('.score-list').innerHTML=[...roundPlayers].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="score-row"><span>0${i+1}</span><strong>${escapeRoomText(p.name)}</strong><b>${p.score}</b></div>`).join('');}
function continueKey(){return `sonora-continue-${roundNo}`;}
function continueNames(){try{return JSON.parse(localStorage.getItem(continueKey())||'[]');}catch{return [];}}
function updateContinueStatus(button){const ready=continueNames();button.textContent=`Continue (${ready.length}/${roundPlayers.length})`;if(ready.length>=roundPlayers.length){clearInterval(breakTick);nextRound();}}
window.addEventListener('storage',event=>{if(event.key===continueKey()){const button=roundResult.querySelector('.continue-round');if(button)updateContinueStatus(button);}});
async function nextRound(){clearInterval(roundTick);clearInterval(attemptTick);clearInterval(breakTick);playRequest++;pauseCurrentPlayback();roundResult.hidden=true;if(gameAudio){gameAudio.pause();gameAudio=null;}if(roundNo>=10){const winner=[...roundPlayers].sort((a,b)=>b.score-a.score)[0]||{name:'You',score:0};winnerResult.querySelector('#winner-title').textContent=`${winner.name} wins!`;winnerResult.querySelector('.winner-score').textContent=`Final score · ${winner.score} points`;winnerResult.hidden=false;sprayNoteConfetti({winner:true});return;}roundNo++;const loadingRound=roundNo;localStorage.removeItem(continueKey());stageNo=0;elapsed=0;roundLeft=30;gameView.querySelector('.round-feedback').textContent='Finding songs with playable previews…';const choices=await pickPlayableChoices();if(loadingRound!==roundNo)return;if(!choices.length){gameView.querySelector('.round-feedback').textContent='No playable preview songs are available. Check your connection and try again.';return;}const song=choices[0];activeRoundSong=song;gameView.dataset.answer=song[0];gameView.querySelector('.game-round').textContent=roundNo;gameView.querySelector('.round-clock strong').textContent=roundLeft;gameView.querySelector('.attempt-clock').textContent='';gameView.querySelector('.round-feedback').textContent='Choose quickly for the highest score.';gameView.querySelector('.track-line i').style.width='0';gameView.querySelector('.game-skip').disabled=false;gameView.querySelectorAll('.track-marks span').forEach((m,i)=>m.classList.toggle('active',i===0));gameView.querySelector('.song-choices').classList.remove('locked','wrong-locked');gameView.querySelector('.song-choices').innerHTML=choices.map((s,i)=>`<button class="song-choice" data-artist="${escapeRoomText(s[1])}" data-correct="${s===song}" type="button"><span class="cover-art cover-${(roundNo+i)%4}" aria-hidden="true">♪</span><span class="song-title"><strong>${escapeRoomText(s[0])}</strong></span><i>${String.fromCharCode(65+i)}</i></button>`).join('');scoreBoard();roundTick=setInterval(()=>{roundLeft--;gameView.querySelector('.round-clock strong').textContent=roundLeft;if(roundLeft<=0)endRound(`Time is up. It was ${song[0]}.`);},1000);attemptTick=setInterval(()=>{if(!gameView.querySelector('.song-choices').classList.contains('locked'))elapsed++;gameView.querySelector('.attempt-clock').textContent=`00:${String(elapsed).padStart(2,'0')}`;},1000);}
function endRound(message){clearInterval(roundTick);clearInterval(attemptTick);playRequest++;pauseCurrentPlayback();if(gameAudio){gameAudio.pause();gameAudio=null;}const feedback=gameView.querySelector('.round-feedback');let seconds=5;const song=activeRoundSong;roundResult.querySelector('.result-vinyl').style.setProperty('--result-cover',`var(--cover-${(roundNo-1)%4})`);roundResult.querySelector('.result-vinyl').className=`result-vinyl cover-${(roundNo-1)%4}`;roundResult.querySelector('#round-result-title').textContent=song[0];roundResult.querySelector('.result-artist').textContent=song[1];roundResult.querySelector('.continue-round').textContent=`Continue (0/${roundPlayers.length})`;roundResult.querySelector('.result-countdown b').textContent=seconds;roundResult.hidden=false;feedback.textContent=message;gameView.querySelectorAll('.song-choice').forEach(b=>b.disabled=true);const continueButton=roundResult.querySelector('.continue-round');continueButton.onclick=()=>{const room=getRoomState();const playerName=localStorage.getItem(profileNameKey)||room.players[0]?.name||roundPlayers[0].name;const ready=continueNames();if(!ready.includes(playerName)){ready.push(playerName);localStorage.setItem(continueKey(),JSON.stringify(ready));}updateContinueStatus(continueButton);};breakTick=setInterval(()=>{seconds--;const count=roundResult.querySelector('.result-countdown b');if(count)count.textContent=seconds;if(seconds<=0){clearInterval(breakTick);nextRound();}},1000);}
function setPlayButton(playing){const button=gameView.querySelector('.game-play');button.classList.toggle('is-playing',playing);button.setAttribute('aria-label',playing?'Pause current section':'Play current section');}
function pauseCurrentPlayback(){if(gameAudio)gameAudio.pause();cancelAnimationFrame(progressFrame);setPlayButton(false);}
async function playCurrentSection(restartFromBeginning=false){const requestedRound=roundNo,requestedStage=stageNo,request=++playRequest,song=activeRoundSong;if(!song)return;const boundaries=[0,.1,.5,2,8,15],points=[0,8,20,46,74,100],end=boundaries[requestedStage+1];let asset=null;if(!gameAudio||gameAudio.dataset.songKey!==`${song[0]}|${song[1]}`){asset=await loadSongAsset(song);if(request!==playRequest||requestedRound!==roundNo||requestedStage!==stageNo)return;if(!asset?.previewUrl){gameView.querySelector('.round-feedback').textContent=`No matching preview is available for ${song[0]}.`;return;}if(gameAudio)gameAudio.pause();gameAudio=new Audio(asset.previewUrl);gameAudio.dataset.trackId=String(asset.trackId);gameAudio.dataset.songKey=`${song[0]}|${song[1]}`;gameAudio.preload='auto';}const activeAudio=gameAudio;if(request!==playRequest||requestedRound!==roundNo||requestedStage!==stageNo)return;activeAudio.volume=Number(gameView.querySelector('[aria-label="Volume"]').value)/100;if(restartFromBeginning||activeAudio.currentTime>=end)activeAudio.currentTime=0;const updateProgress=()=>{const time=Math.max(0,Math.min(end,activeAudio.currentTime));let marker=0;while(marker<boundaries.length-2&&time>boundaries[marker+1])marker++;const fraction=Math.max(0,Math.min(1,(time-boundaries[marker])/(boundaries[marker+1]-boundaries[marker])));gameView.querySelector('.track-line i').style.width=`${points[marker]+fraction*(points[marker+1]-points[marker])}%`;};updateProgress();const animate=()=>{if(activeAudio!==gameAudio||activeAudio.paused||requestedRound!==roundNo||requestedStage!==stageNo)return;updateProgress();if(activeAudio.currentTime>=end){activeAudio.pause();activeAudio.currentTime=end;gameView.querySelector('.track-line i').style.width=`${points[requestedStage+1]}%`;setPlayButton(false);return;}progressFrame=requestAnimationFrame(animate);};try{await activeAudio.play();if(request!==playRequest)return;setPlayButton(true);cancelAnimationFrame(progressFrame);progressFrame=requestAnimationFrame(animate);}catch{setPlayButton(false);}}
gameView.querySelector('.game-play').addEventListener('click',()=>{if(gameAudio&&!gameAudio.paused){playRequest++;pauseCurrentPlayback();return;}void playCurrentSection();});
gameView.querySelector('[aria-label="Volume"]').addEventListener('input',event=>{event.currentTarget.style.setProperty('--volume-level',`${event.currentTarget.value}%`);if(gameAudio)gameAudio.volume=Number(event.currentTarget.value)/100;});
gameVolumeInput.addEventListener('input', event => {
  const value = event.currentTarget.value;
  localStorage.setItem('sonora-volume', value);
  document.documentElement.style.setProperty('--volume-level', `${value}%`);
  hoverTargetVolume = Number(value) / 100;
  if (!hoverPreviewAudio.paused) hoverPreviewAudio.volume = hoverTargetVolume;
  const homeVolumeInput = document.querySelector('.volume-slider');
  if (homeVolumeInput) homeVolumeInput.value = value;
});
gameView.querySelector('.game-skip').addEventListener('click',async()=>{if(stageNo>=4)return;playRequest++;pauseCurrentPlayback();stageNo++;gameView.querySelector('.track-line i').style.width='0%';gameView.querySelectorAll('.track-marks span').forEach((m,i)=>m.classList.toggle('active',i<=stageNo));gameView.querySelector('.round-feedback').textContent=`Skipped ahead to the ${['0.1','0.5','2','8','15'][stageNo]} second preview. Fewer points are available now.`;await playCurrentSection(true);if(stageNo===4)gameView.querySelector('.game-skip').disabled=true;});
function sprayNoteConfetti(options={}){const winner=Boolean(options.winner),burst=document.createElement('div');burst.className=`note-confetti-burst${winner?' winner-confetti':''}`;const count=winner?220:72,symbols=winner?['♫','♪','♬','✦','★','✧','◆','●']:['♫','♪','♬'];for(let i=0;i<count;i++){const note=document.createElement('span');note.textContent=symbols[i%symbols.length];note.style.left=`${Math.random()*100}%`;note.style.setProperty('--note-x',`${(Math.random()-.5)*(winner?420:260)}px`);note.style.setProperty('--note-r',`${(Math.random()-.5)*(winner?720:360)}deg`);note.style.setProperty('--note-delay',`${Math.random()*(winner?450:180)}ms`);note.style.setProperty('--confetti-size',`${18+Math.random()*(winner?28:18)}px`);burst.appendChild(note);}document.body.appendChild(burst);setTimeout(()=>burst.remove(),winner?3700:1450);}
function triggerWrongMark(){const button=gameView.querySelector('.game-play'),rect=button.getBoundingClientRect(),mark=document.createElement('div');mark.className='wrong-guess-mark';mark.style.setProperty('--cross-x',`${rect.left+rect.width/2}px`);mark.style.setProperty('--cross-y',`${rect.top+rect.height/2}px`);mark.setAttribute('aria-hidden','true');mark.innerHTML='<span></span><span></span>';document.body.appendChild(mark);setTimeout(()=>mark.remove(),950);}
gameView.querySelector('.song-choices').addEventListener('click',e=>{const b=e.target.closest('.song-choice');if(!b||b.disabled)return;if(b.dataset.correct==='true'){const pts=Math.max(5,[100,80,60,35,20][stageNo]-Math.min(25,Math.floor(elapsed/4)*5));roundPlayers[0].score+=pts;scoreBoard();b.classList.add('correct');gameView.querySelector('.song-choices').classList.add('locked');gameView.querySelectorAll('.song-choice').forEach(x=>x.disabled=true);gameView.querySelector('.guess-status').textContent='You got it · waiting for everyone';gameView.querySelector('.round-feedback').textContent=`Correct! +${pts} points. You’re locked in until the round ends.`;sprayNoteConfetti();if(roundPlayers.length===1)endRound('Correct answer!');}else{triggerWrongMark();roundPlayers[0].score=Math.max(0,roundPlayers[0].score-5);scoreBoard();gameView.querySelector('.song-choices').classList.add('wrong-locked');gameView.querySelectorAll('.song-choice').forEach(x=>{x.disabled=true;x.classList.add('blackout');});gameView.querySelector('.round-feedback').textContent='Wrong guess — 5 points deducted. Choices are locked until the next round.';}});
winnerResult.querySelector('.winner-exit').addEventListener('click',()=>gameView.querySelector('.game-exit').click());
gameView.querySelector('.game-exit').addEventListener('click',()=>{clearInterval(roundTick);clearInterval(attemptTick);clearInterval(breakTick);playRequest++;pauseCurrentPlayback();winnerResult.hidden=true;roundResult.hidden=true;gameView.hidden=true;document.querySelector('main').hidden=false;document.querySelector('.site-footer').hidden=false;window.scrollTo(0,0);});
document.querySelector('.launch-button').addEventListener('click',()=>{closeModal();launchGame();});

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

});

const joinedPanel = document.createElement('section');
joinedPanel.className = 'joined-panel';
joinedPanel.innerHTML = '<div><p class="eyebrow">The room</p><h3>Who is <em>in?</em></h3><p class="joined-subtitle">Invite players in on any device.</p></div><div class="joined-list"></div>';
document.querySelector('.setup-modal').appendChild(joinedPanel);

const roomStateKey = 'sonora-room-state';
const profileNameKey = 'sonora-profile-name';
const defaultRoomState = { hostName: '', maxPlayers: 8, mode: 'Quickfire', genre: '', time: '30 seconds', active: true, players: [{ name: '', role: 'Host' }] };

function getRoomState() {
  try {
    const room = JSON.parse(localStorage.getItem(roomStateKey)) || structuredClone(defaultRoomState);
    if (!availableModes.has(room.mode)) room.mode = 'Quickfire';
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
  const ready = Boolean(
    room.hostName?.trim()
    && room.mode
    && modeChoices.querySelector('.mode-choice.selected')
    && document.querySelector('.genre-option.selected')
    && Number.parseInt(document.querySelector('.player-stepper strong')?.textContent, 10)
    && room.maxPlayers
    && room.genre
  );
  launchButton.disabled = !ready;
  launchButton.setAttribute('aria-disabled', String(!ready));
  launchButton.title = ready ? 'Start the room' : 'Complete the room settings first';
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
hostNameInput.value = getRoomState().hostName || '';
hostNameInput.addEventListener('input', () => {
  const hostName = hostNameInput.value.trim();
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
['Quickfire'].forEach((mode) => {
  const choice = document.createElement('button');
  choice.type = 'button';
  choice.className = 'mode-choice';
  choice.dataset.mode = mode;
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

function updateModeSelection(showSetupSelection = false) {
  selectedModeLabel.textContent = modeDisplayNames[selectedMode] || 'Classic';
  modeChoices.querySelectorAll('.mode-choice').forEach((choice) => {
    choice.classList.toggle('selected', showSetupSelection && choice.dataset.mode === selectedMode);
  });
  modeCards.forEach((card) => card.classList.toggle('selected', card.dataset.mode === selectedMode));
}

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
      const response = await fetch(endpoint);
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
    choice.classList.toggle('selected', choice.textContent === room.genre);
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
  if (event.key !== roomStateKey || document.activeElement === hostNameInput) return;
  const hostName = getRoomState().hostName || '';
  hostNameInput.value = hostName;
  updateProfileDisplay(hostName);
});

const languageMenu = document.createElement('div');
languageMenu.className = 'language-menu';
languageMenu.hidden = true;
languageMenu.innerHTML = '<button type="button" data-language="EN">English</button><button type="button" data-language="TH">ไทย</button>';
userTools.appendChild(languageMenu);

avatarButton.addEventListener('click', () => {
  profileNameField.value = hostNameInput.value.trim() || localStorage.getItem(profileNameKey) || '';
  profilePanel.hidden = !profilePanel.hidden;
  languageMenu.hidden = true;
});

document.addEventListener('click', (event) => {
  if (!userTools.contains(event.target)) profilePanel.hidden = true;
});

languageButton.addEventListener('click', () => {
  languageMenu.hidden = !languageMenu.hidden;
  profilePanel.hidden = true;
  languageButton.setAttribute('aria-expanded', String(!languageMenu.hidden));
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
  if (typeof hostNameInput !== 'undefined') {
    hostNameInput.value = name;
    hostNameInput.dispatchEvent(new Event('input'));
  }
  profilePanel.hidden = true;
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
    create: '＋ Create a room', join: 'Join with a code', pick: 'Pick your poison', choose: 'Choose a mode',
    modes: [['Classic', '10 songs - 30 seconds']], genres: ['Pop anthems', 'Indie & alternative', 'Hip-hop & R&B', 'Throwback classics', 'Thai songs', 'J-Pop'],
    zero: 'ZERO FRICTION', howTitle: 'Built for the<br /><em>perfect chorus.</em>', howText: 'Make a room, send the code, and let the music do the talking. No accounts. No setup. Just your people and a playlist.',
    profile: 'Your profile', display: 'Display name', save: 'Save name', saved: 'Name saved', setup: 'Room setup', make: 'Make it <em>yours.</em>',
    gameMode: 'Game mode', modeHint: 'Set by the mode you picked', max: 'Max players', maxHint: 'Everyone gets a turn to guess', genre: 'Song genre', genreHint: 'Keep the playlist unpredictable', time: 'Time per song', timeHint: 'How long players have to lock in', invite: 'Invite your people', sendCode: 'Send them<br /><em>the code.</em>', inviteHint: 'Players can join from any device using the room code.', copy: 'Copy room code', private: 'Cloudflare room', start: 'Start the room', room: 'The room', who: 'Who is <em>in?</em>', roomHint: 'Share the code above and watch your crew appear here.', host: 'Room host', joined: 'Joined just now', waiting: 'Waiting for players', waitingHint: 'Send the invite code to your crew',
    joinRoom: 'Join the room', joinTitle: 'Find your<br /><em>music people.</em>', joinText: 'Enter your name and the room code shared by the host.', yourName: 'Your name', roomCode: 'Room code', joinButton: 'Join room', noName: 'Add your name so the room knows who joined.', badCode: 'That code does not match an active room.', joinedMessage: 'You joined the room. Waiting for the host to start...', live: 'Room live', crew: 'Your crew is <em>here.</em>', modeLabel: 'Mode', playersLabel: 'Players', genreLabel: 'Genre', perSong: 'Per song', you: 'You',
  },
  TH: {
    navModes: 'โหมดเกม', navHow: 'วิธีเล่น', warmup: 'ห้องกำลังเตรียมพร้อม',
    heroTitle: 'ฟังให้ดี<br /><em>รู้ให้ทัน</em><br />ทายชื่อเพลง', heroDescription: 'เกมทายเพลงแบบรวดเร็วและเป็นกันเอง สำหรับคนที่จำเพลงได้ตั้งแต่สามวินาทีแรก',
    create: '＋ สร้างห้อง', join: 'เข้าร่วมด้วยรหัส', guessed: 'ผู้เล่นทายเพลงแล้ววันนี้', pick: 'เลือกโหมดของคุณ', choose: 'เลือกโหมด',
    modes: [['Classic', '10 songs - 30 seconds']], genres: ['เพลงป๊อป', 'อินดี้และอัลเทอร์เนทีฟ', 'ฮิปฮอปและอาร์แอนด์บี', 'เพลงคลาสสิกย้อนยุค', 'เพลงไทย', 'เจป๊อป'],
    zero: 'เล่นได้ทันที', howTitle: 'สร้างมาเพื่อ<br /><em>ท่อนฮุกที่ใช่</em>', howText: 'สร้างห้อง ส่งรหัส แล้วให้เสียงเพลงเป็นคนพูด ไม่ต้องสมัคร ไม่ต้องตั้งค่า มีแค่เพื่อนและเพลย์ลิสต์ของคุณ',
    profile: 'โปรไฟล์ของคุณ', display: 'ชื่อที่แสดง', save: 'บันทึกชื่อ', saved: 'บันทึกชื่อแล้ว', setup: 'ตั้งค่าห้อง', make: 'จัดห้องในแบบ<br /><em>ของคุณ</em>',
    gameMode: 'โหมดเกม', modeHint: 'เลือกจากโหมดที่คุณต้องการ', max: 'ผู้เล่นสูงสุด', maxHint: 'ทุกคนจะได้มีโอกาสทาย', genre: 'แนวเพลง', genreHint: 'ทำให้เพลย์ลิสต์คาดเดาไม่ได้', time: 'เวลาต่อเพลง', timeHint: 'เวลาที่ใช้ล็อกคำตอบ', invite: 'ชวนเพื่อนของคุณ', sendCode: 'ส่งรหัส<br /><em>ให้เพื่อน</em>', inviteHint: 'เข้าร่วมได้จากทุกอุปกรณ์ ไม่ต้องสมัครบัญชี', copy: 'คัดลอกรหัสห้อง', private: 'ห้องส่วนตัว', start: 'เริ่มห้อง', room: 'ในห้องนี้', who: 'ใคร<em>เข้าร่วมแล้ว?</em>', roomHint: 'แชร์รหัสด้านบน แล้วดูเพื่อนของคุณเข้าร่วมที่นี่', host: 'เจ้าของห้อง', joined: 'เข้าร่วมเมื่อครู่', waiting: 'รอผู้เล่น', waitingHint: 'ส่งรหัสเชิญให้เพื่อนของคุณ',
    joinRoom: 'เข้าร่วมห้อง', joinTitle: 'พบแก๊ง<br /><em>คนรักเพลง</em>', joinText: 'ใส่ชื่อและรหัสเชิญที่เจ้าของห้องส่งให้คุณ', yourName: 'ชื่อของคุณ', roomCode: 'รหัสห้อง', joinButton: 'เข้าร่วมห้อง', noName: 'ใส่ชื่อของคุณเพื่อให้ห้องรู้ว่าใครเข้าร่วม', badCode: 'รหัสนี้ไม่ตรงกับห้องที่กำลังเปิดอยู่', joinedMessage: 'คุณเข้าร่วมห้องแล้ว กำลังรอเจ้าของห้องเริ่มเกม...', live: 'ห้องกำลังเปิด', crew: 'แก๊งของคุณ<br /><em>อยู่ที่นี่แล้ว</em>', modeLabel: 'โหมด', playersLabel: 'ผู้เล่น', genreLabel: 'แนวเพลง', perSong: 'ต่อเพลง', you: 'คุณ',
  },
};

function applyLanguage(language) {
  currentLanguage = language;
  const copy = languageCopy[language] || languageCopy.EN;
  const setText = (selector, value) => { const element = document.querySelector(selector); if (element) element.textContent = value; };
  const setHtml = (selector, value) => { const element = document.querySelector(selector); if (element) element.innerHTML = value; };
  setText('.topbar-links a:first-child', copy.navModes); setText('.topbar-links a:last-child', copy.navHow); setText('.eyebrow', copy.warmup);
  setHtml('.hero h1', copy.heroTitle); setText('.hero-description', copy.heroDescription); setText('.js-create-room', copy.create); setText('.js-join-room', copy.join + ' →');
  setText('.section-heading .eyebrow', copy.pick); setText('.section-heading h2', copy.choose); setText('.how-label', `01 ${copy.zero}`); setHtml('.how-copy h2', copy.howTitle); setText('.how-copy p', copy.howText);
  document.querySelectorAll('.mode-card').forEach((card, index) => { setTextFor(card, '.mode-name', copy.modes[index][0]); setTextFor(card, '.mode-detail', copy.modes[index][1]); });
  modeChoices.querySelectorAll('.mode-choice').forEach((choice) => { choice.textContent = modeDisplayNames.Quickfire; });
  document.querySelectorAll('.genre-option').forEach((choice, index) => { choice.textContent = copy.genres[index]; });
  setText('.selected-mode-label', modeDisplayNames[selectedMode] || 'Classic');
  setText('.profile-panel .eyebrow', copy.profile); setText('.profile-panel label', copy.display); setText('.profile-save', copy.save);
  setText('.setup-header .eyebrow', copy.setup); setHtml('.setup-header h2', copy.make); setText('.setup-fields .setup-field:nth-child(1)>span', copy.yourName); setText('.setup-fields .setup-field:nth-child(2)>span', copy.gameMode); setText('.setup-fields .setup-field:nth-child(2) small', copy.modeHint); setText('.setup-fields .player-setting-field>span', copy.max); setText('.setup-fields .player-setting-field small', copy.maxHint); setText('.setup-fields .genre-setting-field>span', copy.genre); setText('.setup-fields .genre-setting-field small', copy.genreHint);
  setText('.invite-panel .eyebrow', copy.invite); setHtml('.invite-panel h3', copy.sendCode); setText('.invite-panel p:not(.eyebrow):not(.copy-status)', copy.inviteHint); setText('.copy-button', copy.copy); setText('.setup-footer>span', copy.private); setText('.launch-button', copy.start);
  setText('.join-content .eyebrow', copy.joinRoom); setHtml('.join-content h2', copy.joinTitle); setText('.join-content>p:not(.eyebrow)', copy.joinText); setText('label[for="player-name"]', copy.yourName); setText('label[for="join-code"]', copy.roomCode); setText('.join-form .primary-button', copy.joinButton);
  setText('.joined-room-heading .eyebrow', copy.live); setHtml('.joined-room-heading h3', copy.crew); setText('.joined-room-heading .host-settings span:nth-child(1) small', copy.modeLabel); setText('.joined-room-heading .host-settings span:nth-child(2) small', copy.playersLabel); setText('.joined-room-heading .host-settings span:nth-child(3) small', copy.genreLabel); setText('.joined-room-heading .host-settings span:nth-child(4) small', copy.perSong);
  const playerValue = document.querySelector('.player-stepper strong');
  if (playerValue) playerValue.textContent = `${Number.parseInt(playerValue.textContent, 10) || 8} ${language === 'TH' ? 'ผู้เล่น' : 'players'}`;
  setText('.host-name-field small', language === 'TH' ? 'นี่คือชื่อที่เพื่อนจะเห็น' : 'This is how your crew will see you');
  setHtml('.joined-panel h3', copy.who); setText('.joined-panel .joined-subtitle', copy.roomHint); setText('.joined-panel .joined-player:first-child small', copy.host); setText('.joined-panel .joined-player:nth-child(2) small', copy.joined); setText('.joined-panel .joined-player:last-child strong', copy.waiting); setText('.joined-panel .joined-player:last-child small', copy.waitingHint); setText('.joined-room-heading .joined-subtitle', copy.roomHint); setText('.joined-room-list .joined-player:first-child small', copy.host); setText('.joined-room-list .joined-player:nth-child(2) small', copy.joined); setText('.joined-room-list .joined-player:nth-child(3) small', copy.joined); setText('.joined-room-list .joined-player:last-child small', copy.you);
  document.documentElement.lang = language === 'TH' ? 'th' : 'en';
}

function setTextFor(parent, selector, value) { const element = parent.querySelector(selector); if (element) element.textContent = value; }
