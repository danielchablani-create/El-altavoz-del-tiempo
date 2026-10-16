'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const storage=(()=>{try{return window.localStorage;}catch{return {getItem:()=>null,setItem(){throw Error('Sin almacenamiento');}};}})();
let albums=VinylModel.readAlbums(storage),game=VinylModel.readGame(storage),activeScreen='homeScreen';
let importTarget=null,pendingSongs=[],lastRows=null,fileSequence=0;
let draftCover=null,originalCover=null,coverBusy=false,coverSequence=0,coverOnly=false;
let yt=null,ytReady=false,loadedVideoId=null,videoPlaying=false,needleDown=false,needleDrag=null,suppressClickUntil=0;
let cameraTimer=null,volumeDrag=null;
let soundVolume=100;
try{const savedVolume=storage.getItem("altavozVolumeV1");if(savedVolume!==null&&Number.isFinite(Number(savedVolume)))soundVolume=Math.min(100,Math.max(0,Math.round(Number(savedVolume))));}catch{}
let awardCategory=null,playerDraft=[],toastTimer=null,mediaFrame=0,storageWarning=false;
const screenHashes={homeScreen:'inicio',libraryScreen:'biblioteca',createScreen:'crear-vinilo',gameScreen:'gramofono',answerScreen:'solucion'};
const jacketColors=[['#b45e42','#f9dfaf'],['#d0a552','#183d31'],['#3d6051','#eee0bb'],['#e7dcbb','#3a4434'],['#a57e69','#f6e7be'],['#526573','#f0dbb5']];
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function saveSession(){
 if(!game)return;
 try{storage.setItem(VinylModel.GAME_KEY,JSON.stringify(game));$('#resumeGame').classList.toggle('hidden',!!game.completed);}
 catch{if(!storageWarning){toast('Esta partida no se pudo guardar en el navegador.');storageWarning=true;}}
}
function navigate(screen,{historyMode='push',scroll=true}={}){
 if(!screenHashes[screen])screen='homeScreen';
 if((screen==='gameScreen'||screen==='answerScreen')&&!VinylModel.currentSong(game))screen='libraryScreen';
 if(screen==='answerScreen'&&!game?.revealed)screen='gameScreen';
 if(!['gameScreen','answerScreen'].includes(screen))pausePlayback();
 activeScreen=screen;
 $$('.screen').forEach(el=>{const on=el.id===screen;el.hidden=!on;el.classList.toggle('active',on);});
 if(screen==='libraryScreen')renderLibrary();
 if(historyMode!=='none')window.history[historyMode==='replace'?'replaceState':'pushState']({screen},'', '#'+screenHashes[screen]);
 if(scroll)window.scrollTo({top:0,behavior:'instant'});
 updateMedia();
 const heading=$('#'+screen+' h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
}
window.addEventListener('popstate',e=>navigate(e.state?.screen||'homeScreen',{historyMode:'none'}));
$$('[data-go]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.go)));
$('#enterLibrary').onclick=()=>navigate('libraryScreen');
$('#gameBack').onclick=()=>navigate('libraryScreen');
$('#answerBack').onclick=()=>navigate('gameScreen');
$('#resumeGame').classList.toggle('hidden',!VinylModel.currentSong(game)||game?.completed);
$('#resumeGame').onclick=()=>{if(!game)return;renderGame();renderAnswer();navigate(game.revealed?'answerScreen':'gameScreen');prepareSong();};

let browsedAlbumId=albums[0]?.id||null,crateDrag=null,crateSelecting=false;
function currentCrateAlbum(){return albums.find(a=>a.id===browsedAlbumId)||albums[0]||null;}
let chosenRounds=10;
function validateRoundChoice(){
 const raw=$('#roundsInput').value.trim(),value=Number(raw);
 const valid=raw!==''&&Number.isInteger(value)&&value>=1&&value<=100;
 $('#roundsError').classList.toggle('hidden',valid);
 $('#roundsError').textContent=valid?'':'Elige un número entero entre 1 y 100.';
 $('#roundsInput').setAttribute('aria-invalid',String(!valid));
 if(valid)chosenRounds=value;
 $$('[data-rounds]').forEach(button=>{const on=valid&&Number(button.dataset.rounds)===value;button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));});
 return valid;
}
$$('[data-rounds]').forEach(button=>button.onclick=()=>{$('#roundsInput').value=button.dataset.rounds;validateRoundChoice();});
$('#roundsInput').addEventListener('input',validateRoundChoice);
function renderLibrary(){
 if(crateDrag){crateDrag=null;}crateSelecting=false;
 $('#crateStage').classList.remove('extracting');
 $('#deleteLibrary').disabled=!albums.length;
 $('#albumCount').textContent=albums.length+' '+(albums.length===1?'vinilo':'vinilos');
 $('#libraryTools').classList.toggle('hidden',!albums.length);
 $('#crateSelection').classList.toggle('hidden',!albums.length);
 $('#crateEmpty').classList.toggle('hidden',!!albums.length);
 const cards=$('#crateCards');cards.replaceChildren();
 const album=currentCrateAlbum();browsedAlbumId=album?.id||null;
 const index=albums.findIndex(a=>a.id===browsedAlbumId);
 if(album){
  // Solo dibujamos hasta cuatro fundas reales, sin duplicar ni inventar colecciones.
  const count=Math.min(4,albums.length);
  for(let depth=count-1;depth>=0;depth--){
   const cardAlbum=albums[(index+depth)%albums.length],colors=jacketColors[(index+depth)%jacketColors.length];
   const card=document.createElement(depth===0?'button':'div');card.className='crate-sleeve cover-style-'+((index+depth)%4);card.style.setProperty('--depth',depth);card.style.setProperty('--cover-color',colors[0]);card.style.setProperty('--cover-ink',colors[1]);
   const art=document.createElement('div');art.className='crate-cover-art';art.setAttribute('aria-hidden','true');
   const title=document.createElement('span');title.className='crate-cover-title';title.textContent=cardAlbum.name;
   const count=document.createElement('span');count.className='crate-cover-count';count.textContent=cardAlbum.songs.length+' canciones';
   if(cardAlbum.cover){const image=document.createElement('img');image.className='crate-cover-photo';image.src=cardAlbum.cover;image.alt='';image.draggable=false;card.classList.add('has-cover');card.append(image);}
   card.append(title,count,art);
   if(depth===0){
    card.id='frontSleeve';card.type='button';card.setAttribute('aria-label','Escuchar '+cardAlbum.name+'. Arrastra hacia arriba o pulsa Intro.');
    card.addEventListener('pointerdown',beginCrateDrag);card.addEventListener('pointermove',moveCrateDrag);card.addEventListener('pointerup',endCrateDrag);
    card.addEventListener('pointercancel',cancelCrateDrag);card.addEventListener('lostpointercapture',()=>{if(crateDrag)cancelCrateDrag();});
    card.onclick=event=>{if(event.detail===0)extractAlbum();};
    card.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();browseCrate(event.key==='ArrowRight'?1:-1,true);}});
   }else card.setAttribute('aria-hidden','true');
   cards.append(card);
  }
  $('#crateAlbumName').textContent=album.name;$('#crateAlbumPosition').textContent=(index+1)+' de '+albums.length+' · '+album.songs.length+' canciones';
 }
 $('#previousAlbum').disabled=albums.length<2;$('#followingAlbum').disabled=albums.length<2;
 const select=$('#exportSelect');select.replaceChildren();
 albums.forEach(album=>{const option=document.createElement('option');option.value=album.id;option.textContent=album.name;select.append(option);});
 if(browsedAlbumId)select.value=browsedAlbumId;
}
function browseCrate(direction,focus=false){
 if(crateSelecting||albums.length<2)return;
 const index=albums.findIndex(a=>a.id===browsedAlbumId);
 browsedAlbumId=albums[(index+direction+albums.length)%albums.length].id;renderLibrary();
 const card=$('#frontSleeve');card?.classList.add(direction>0?'flipping-forward':'flipping-back');
 if(focus)card?.focus({preventScroll:true});
}
function extractAlbum(){
 const album=currentCrateAlbum();if(!album||crateSelecting)return;
 if(!validateRoundChoice()){$('#roundsInput').focus();return;}
 crateSelecting=true;$('#crateStage').classList.add('extracting');
 const selectedId=album.id;
 setTimeout(()=>{if(activeScreen==='libraryScreen'&&crateSelecting){crateSelecting=false;startAlbum(selectedId);}else crateSelecting=false;},320);
}
function beginCrateDrag(event){
 if(event.button!==0||crateSelecting||crateDrag)return;
 crateDrag={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0};event.currentTarget.setPointerCapture(event.pointerId);
 event.currentTarget.classList.add('dragging');
}
function moveCrateDrag(event){
 if(!crateDrag||crateDrag.id!==event.pointerId)return;
 const d=crateDrag;d.dx=event.clientX-d.x;d.dy=event.clientY-d.y;
 const lift=Math.abs(d.dy)>Math.abs(d.dx)&&d.dy<0?Math.max(-180,d.dy):0;
 event.currentTarget.style.setProperty('--lift',lift+'px');
 event.currentTarget.style.setProperty('--browse-tilt',Math.max(-16,Math.min(16,d.dx*.09))+'deg');
}
function endCrateDrag(event){
 const d=crateDrag;if(!d||d.id!==event.pointerId)return;
 crateDrag=null;event.currentTarget.releasePointerCapture(event.pointerId);resetCrateCard(event.currentTarget);
 if(d.dy<-65&&Math.abs(d.dy)>Math.abs(d.dx)*1.15)extractAlbum();
 else if(Math.abs(d.dx)>40&&Math.abs(d.dx)>Math.abs(d.dy))browseCrate(d.dx<0?1:-1);
}
function resetCrateCard(card){if(!card)return;card.classList.remove('dragging');card.style.removeProperty('--lift');card.style.removeProperty('--browse-tilt');}
function cancelCrateDrag(){crateDrag=null;resetCrateCard($('#frontSleeve'));}
$('#previousAlbum').onclick=()=>browseCrate(-1);$('#followingAlbum').onclick=()=>browseCrate(1);$('#listenAlbum').onclick=extractAlbum;
$('#deleteLibrary').onclick=()=>{
 if(!albums.length)return;
 $('#deleteLibraryCount').textContent='Vas a eliminar '+albums.length+' '+(albums.length===1?'vinilo.':'vinilos.');
 $('#deleteLibraryError').textContent='';$('#deleteLibraryDialog').showModal();
};
$('#confirmDeleteLibrary').onclick=()=>{
 try{VinylModel.clearLibrary(storage);}
 catch{$('#deleteLibraryError').textContent='No se pudo borrar la biblioteca. El navegador ha bloqueado el acceso al almacenamiento. Inténtalo de nuevo.';return;}
 pausePlayback();if(ytReady&&typeof yt.stopVideo==='function')yt.stopVideo();
 albums=[];game=null;loadedVideoId=null;browsedAlbumId=null;crateDrag=null;crateSelecting=false;
 ++fileSequence;++coverSequence;coverBusy=false;draftCover=null;originalCover=null;coverOnly=false;importTarget=null;pendingSongs=[];lastRows=null;
 clearTimeout(cameraTimer);$('#gramophone').classList.remove('aerial-view','changing-view');
 $('#albumName').value='';$('#coverFile').value='';$('#csvFile').value='';$('#previewBody').replaceChildren();$('#previewWrap').classList.add('hidden');$('#saveAlbum').disabled=true;updateCover();
 for(const id of ['chosenName','recordName','answerSong','answerArtist','answerYear'])$('#'+id).textContent='';
 $('#resultsScores').replaceChildren();$('#resumeGame').classList.add('hidden');
 $('#deleteLibraryDialog').close();navigate('libraryScreen');toast('Biblioteca borrada. Puedes crear tu primer vinilo.');
};
function openCreator(target=null,{editCover=false}={}){
 ++fileSequence;importTarget=target;pendingSongs=[];lastRows=null;
 const album=albums.find(a=>a.id===target);
 ++coverSequence;coverBusy=false;coverOnly=!!(editCover&&album);draftCover=VinylModel.cleanCover(album?.cover);originalCover=draftCover;$('#coverFile').value='';
 $('#coverStatus').textContent='Opcional: JPG, PNG o WebP, hasta 8 MB. Se ajustará al centro de una portada cuadrada y se guardará solo en este navegador.';
 $('#createScreen').classList.toggle('cover-only',coverOnly);
 $('#albumName').value=album?.name||'';$('#albumName').readOnly=!!album;
 $('#createTitle').textContent=coverOnly?'Personalizar portada':album?'Añadir canciones':'Crear vinilo';
 $('#appendNote').textContent=coverOnly?'Puedes cambiar la portada sin tocar las canciones.':album?'Las nuevas canciones se guardarán en este mismo vinilo.':'';
 $('#appendNote').classList.toggle('hidden',!album);
 $('#csvFile').value='';$('#uploadName').textContent='Seleccionar archivo CSV';
 $('#importStatus').textContent='Elige tu CSV para revisar las canciones antes de guardar.';
 $('#previewWrap').classList.add('hidden');$('#previewBody').replaceChildren();$('#previewNote').textContent='';
 $('#saveAlbum').disabled=true;$('#saveAlbum').textContent=coverOnly?'GUARDAR PORTADA':album?'GUARDAR CAMBIOS':'GUARDAR VINILO';
 updateCover();navigate('createScreen');
}
$('#createAlbum').onclick=()=>openCreator();
$('#extendAlbum').onclick=()=>openCreator($('#exportSelect').value);
$('#editCover').onclick=()=>openCreator($('#exportSelect').value,{editCover:true});
function refreshSaveButton(){
 $('#saveAlbum').disabled=coverBusy||!(pendingSongs.length||(importTarget&&draftCover!==originalCover));
}
function updateCover(){
 $('#coverName').textContent=$('#albumName').value.trim()||'TU PRÓXIMO RECUERDO';
 const image=$('#coverImage');image.classList.toggle('hidden',!draftCover);$('#coverPreview').classList.toggle('has-cover',!!draftCover);
 if(draftCover)image.src=draftCover;else image.removeAttribute('src');
 $('#removeCover').classList.toggle('hidden',!draftCover);refreshSaveButton();
}
async function loadCover(file){
 const sequence=++coverSequence;if(!file)return;coverBusy=true;refreshSaveButton();$('#coverStatus').textContent='Preparando la portada…';
 let url;
 try{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Elige una imagen JPG, PNG o WebP.');
  if(file.size>8*1024*1024)throw Error('La imagen supera los 8 MB. Elige una más pequeña.');
  url=URL.createObjectURL(file);const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('No se pudo leer la imagen. Prueba con otra.'));image.src=url;});
  if(sequence!==coverSequence)return;
  if(!image.naturalWidth||!image.naturalHeight)throw Error('La imagen está vacía.');
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const context=canvas.getContext('2d');if(!context)throw Error('No se pudo preparar la portada en este navegador.');
  const size=Math.min(image.naturalWidth,image.naturalHeight);
  context.fillStyle='#f5f0df';context.fillRect(0,0,512,512);
  context.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,512,512);
  let data=canvas.toDataURL('image/webp',.82);
  if(data.length>400000)data=canvas.toDataURL('image/jpeg',.78);
  const cover=VinylModel.cleanCover(data);if(!cover)throw Error('La imagen ocupa demasiado. Prueba con otra más sencilla.');
  draftCover=cover;$('#coverStatus').textContent='Portada lista. Pulsa Guardar para conservarla.';
 }catch(error){if(sequence===coverSequence)$('#coverStatus').textContent=error.message||'No se pudo cargar la portada.';}
 finally{if(url)URL.revokeObjectURL(url);if(sequence===coverSequence){coverBusy=false;updateCover();}}
}
$('#coverFile').addEventListener('change',event=>loadCover(event.target.files[0]));
$('#removeCover').onclick=()=>{++coverSequence;coverBusy=false;draftCover=null;$('#coverFile').value='';$('#coverStatus').textContent='Se usará la portada ilustrada al guardar.';updateCover();};
$('#albumName').addEventListener('input',updateCover);
function inspectRows(rows){
 const existing=albums.find(a=>a.id===importTarget)?.songs||[],results=SongCatalog.inspect(rows,existing);
 pendingSongs=results.filter(r=>r.status==='valid').map(r=>r.song);
 const invalid=results.filter(r=>r.status==='invalid').length,duplicates=results.filter(r=>r.status==='duplicate').length;
 $('#importStatus').textContent=results.length?`${pendingSongs.length} canciones listas para guardar · ${duplicates} repetidas · ${invalid} con errores.`:'El CSV tiene cabeceras, pero ninguna canción.';
 refreshSaveButton();
 const body=$('#previewBody');body.replaceChildren();
 results.slice(0,100).forEach(result=>{const tr=document.createElement('tr');tr.className='row-'+result.status;
  [result.row,String(result.raw.title||'Sin título')+' · '+String(result.raw.artist||'Sin artista'),result.raw.year??'',result.message].forEach(value=>{const td=document.createElement('td');td.textContent=String(value);tr.append(td);});body.append(tr);
 });
 $('#previewWrap').classList.toggle('hidden',!results.length);
 $('#previewNote').textContent=results.length>100?'Se muestran las primeras 100 filas. Se guardarán todas las canciones válidas de la hoja.':'Solo se guardarán las filas válidas. Los vídeos repetidos dentro de este vinilo se omiten.';
}
async function readFile(file){
 const sequence=++fileSequence;pendingSongs=[];lastRows=null;$('#saveAlbum').disabled=true;$('#previewWrap').classList.add('hidden');$('#previewNote').textContent='';
 if(!file)return;
 $('#importStatus').textContent='Leyendo '+file.name+'…';$('#uploadName').textContent=file.name;
 try{
  if(!/\.csv$/i.test(file.name))throw Error('Solo se admite CSV. Guarda tu hoja como CSV y vuelve a cargarla.');
  if(file.size>5*1024*1024)throw Error('El archivo supera los 5 MB. Divide la colección en varios CSV.');
  const buffer=await file.arrayBuffer();if(sequence!==fileSequence)return;
  let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(buffer);
  lastRows=SongCatalog.parseCSV(text);
  if(!$('#albumName').value.trim()){$('#albumName').value=file.name.replace(/\.csv$/i,'').replace(/[_-]+/g,' ').slice(0,70);updateCover();}
  inspectRows(lastRows);
 }catch(error){if(sequence!==fileSequence)return;lastRows=null;pendingSongs=[];refreshSaveButton();$('#importStatus').textContent=error.message||'No se pudo leer el CSV. Usa la plantilla.';}
}
$('#csvFile').addEventListener('change',e=>readFile(e.target.files[0]));
$('#saveAlbum').onclick=()=>{
 if(coverBusy||(!pendingSongs.length&&(!importTarget||draftCover===originalCover)))return;
 try{
  const id='vinyl-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
  const result=VinylModel.addSongs(albums,importTarget,$('#albumName').value,pendingSongs,id,draftCover);
  storage.setItem(VinylModel.ALBUMS_KEY,JSON.stringify(result.albums));
  albums=result.albums;browsedAlbumId=result.album.id;pendingSongs=[];lastRows=null;++fileSequence;$('#saveAlbum').disabled=true;
  navigate('libraryScreen');toast('Vinilo guardado: '+result.album.name);
 }catch(error){$(coverOnly?'#coverStatus':'#importStatus').textContent=error.message?.includes('nombre')?error.message:'No se pudo guardar. Revisa el nombre y el espacio disponible en tu navegador. Puedes probar con una portada más sencilla.';if(!$('#albumName').value.trim())$('#albumName').focus();}
};
$('#exportAlbum').onclick=()=>{
 const album=albums.find(a=>a.id===$('#exportSelect').value);if(!album)return;
 const url=URL.createObjectURL(new Blob([SongCatalog.toCSV(album.songs)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=(album.name.replace(/[^\wÀ-ÿ -]/g,'').trim()||'vinilo')+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
};

function startAlbum(id){
 if(!validateRoundChoice()){$('#roundsInput').focus();return;}
 const album=albums.find(a=>a.id===id);if(!album?.songs.length){toast('Este vinilo no tiene canciones.');return;}
 pausePlayback();game=VinylModel.newGame(album,game?.players,chosenRounds);VinylModel.nextSong(game);loadedVideoId=null;
 saveSession();renderGame();navigate('gameScreen');prepareSong();
}
function renderGame(){
 if(!game)return;
 clearTimeout(cameraTimer);$('#gramophone').classList.remove('aerial-view','changing-view');$('#chosenName').textContent=game.albumName;$('#recordName').textContent=game.albumName;$('#roundNumber').textContent=game.round;$('#roundTotal').textContent='/ '+game.totalRounds;
 $('#playbackStatus').textContent='Coloca la aguja para escuchar.';$('#needleInstructions').textContent='↖ Desplaza la aguja hasta el disco para escuchar.';
}
function renderAnswer(){
 const song=VinylModel.currentSong(game);if(!song)return;
 $('#answerSong').textContent=song.title;$('#answerArtist').textContent=song.artist;$('#answerYear').textContent=song.year;$('#answerRound').textContent=game.round;$('#answerRoundTotal').textContent='/ '+game.totalRounds;
 $('#nextSong').textContent=game.round>=game.totalRounds?'VER RESULTADO FINAL →':'SIGUIENTE CANCIÓN →';
 $$('[data-award]').forEach(button=>button.classList.toggle('awarded',!!game.awards[button.dataset.award]));
}
$('#nextSong').onclick=()=>{if(!game)return;if(game.round>=game.totalRounds){showResults();return;}pausePlayback();VinylModel.nextSong(game);loadedVideoId=null;saveSession();renderGame();navigate('gameScreen');prepareSong();};
$('#revealAnswer').onclick=()=>{
 if(!VinylModel.currentSong(game))return;
 game.revealed=true;saveSession();renderAnswer();navigate('answerScreen');
 $('#videoStatus').textContent='Ahora sí: imagen y sonido.';requestPlayback();
};

function enterAerialView(){
 const scene=$('#gramophone');
 if(scene.classList.contains('aerial-view'))return;
 scene.classList.add('aerial-view','changing-view');
 $('#needleInstructions').textContent='Vista aérea: retira la aguja para pausar o tócala para reanudar.';
 clearTimeout(cameraTimer);cameraTimer=setTimeout(()=>scene.classList.remove('changing-view'),850);
}
function needleGeometry(){
 return $('#gramophone').classList.contains('aerial-view')
  ? {pivotX:.886,pivotY:.331,engaged:24,rest:-12,threshold:10}
  : {pivotX:.8,pivotY:.5744,engaged:62,rest:-32,threshold:25};
}
function setNeedle(down){
 needleDown=down;const needle=$('#needle');needle.style.removeProperty('--needle-angle');needle.classList.toggle('engaged',down);
 syncAudioButtons(down);
 needle.setAttribute('aria-pressed',String(down));needle.setAttribute('aria-label',down?'Retirar la aguja para pausar':'Colocar la aguja sobre el disco para escuchar');
}
function setPlaybackStatus(text){$(activeScreen==='answerScreen'?'#videoStatus':'#playbackStatus').textContent=text;}
function pausePlayback(){
 setNeedle(false);videoPlaying=false;$('#gameScreen').classList.remove('is-playing');
 if(ytReady)yt.pauseVideo();
}
function prepareSong(){
 const song=VinylModel.currentSong(game);if(!song||!ytReady||loadedVideoId===song.videoId)return;
 yt.cueVideoById({videoId:song.videoId,startSeconds:song.start||0});loadedVideoId=song.videoId;
}
function requestPlayback(){
 const song=VinylModel.currentSong(game);if(!song)return;
 if(!ytReady){setNeedle(false);setPlaybackStatus('El reproductor está cargando. Vuelve a colocar la aguja en unos segundos.');if(activeScreen==='answerScreen')$('#retryVideo').classList.remove('hidden');return;}
 if(activeScreen==='gameScreen')setNeedle(true);
 setPlaybackStatus('Buscando el primer recuerdo…');$('#retryVideo').classList.add('hidden');
 applySoundVolume();
 if(loadedVideoId!==song.videoId){loadedVideoId=song.videoId;yt.loadVideoById({videoId:song.videoId,startSeconds:song.start||0});}
 else yt.playVideo();
}
function syncAudioButtons(playing=needleDown){
 $$('[data-toggle-audio]').forEach(button=>{
  const label=playing?'Pausar y retirar la aguja':'Reproducir y colocar la aguja';
  button.setAttribute('aria-pressed',String(playing));button.setAttribute('aria-label',label);button.title=label;
  if(button.id!=='hardwarePlay')button.textContent=playing?'Pausar':'Reproducir';
 });
}
function applySoundVolume(){
 if(!ytReady)return;
 yt.setVolume(soundVolume);
 if(soundVolume===0)yt.mute();else yt.unMute();
}
function setSoundVolume(value,{save=false}={}){
 const number=Number(value);if(!Number.isFinite(number))return;
 soundVolume=Math.min(100,Math.max(0,Math.round(number)));
 const knob=$('#volumeKnob');knob.style.setProperty('--volume-angle',(-135+soundVolume*2.7)+'deg');
 knob.setAttribute('aria-valuenow',String(soundVolume));knob.setAttribute('aria-valuetext',soundVolume+' por ciento');
 $('#volumeRange').value=String(soundVolume);$('#volumeValue').textContent=soundVolume+' %';
 applySoundVolume();
 if(save)try{storage.setItem('altavozVolumeV1',String(soundVolume));}catch{}
}
function seekSong(offset){
 if(!ytReady||!VinylModel.currentSong(game)){toast('Espera a que el reproductor esté listo.');return;}
 const current=Number(yt.getCurrentTime())||0,duration=Number(yt.getDuration())||0;
 const target=Math.max(0,Math.min(duration>0?Math.max(0,duration-.1):Infinity,current+offset));
 const playing=videoPlaying;
 yt.seekTo(target,true);
 if(!playing){yt.pauseVideo();setNeedle(false);}
 toast((offset<0?'Retroceder':'Avanzar')+' 10 segundos');
}
$$('[data-seek]').forEach(button=>button.onclick=()=>seekSong(Number(button.dataset.seek)));
$$('[data-toggle-audio]').forEach(button=>button.onclick=toggleNeedle);
$('#volumeRange').addEventListener('input',event=>setSoundVolume(event.target.value));
$('#volumeRange').addEventListener('change',()=>setSoundVolume(soundVolume,{save:true}));
const knob=$('#volumeKnob');
knob.addEventListener('pointerdown',event=>{
 if(event.button!==0||volumeDrag)return;
 volumeDrag={id:event.pointerId,x:event.clientX,y:event.clientY,start:soundVolume};knob.setPointerCapture(event.pointerId);knob.classList.add('adjusting');
});
knob.addEventListener('pointermove',event=>{
 const d=volumeDrag;if(!d||d.id!==event.pointerId)return;
 setSoundVolume(d.start+(d.y-event.clientY)*.7+(event.clientX-d.x)*.35);
});
function endVolumeDrag(event){
 if(!volumeDrag||event.pointerId!==volumeDrag.id)return;
 volumeDrag=null;knob.classList.remove('adjusting');if(knob.hasPointerCapture?.(event.pointerId))knob.releasePointerCapture(event.pointerId);setSoundVolume(soundVolume,{save:true});
}
knob.addEventListener('pointerup',endVolumeDrag);knob.addEventListener('pointercancel',endVolumeDrag);knob.addEventListener('lostpointercapture',event=>{if(volumeDrag)endVolumeDrag(event);});
knob.addEventListener('keydown',event=>{
 const changes={ArrowUp:5,ArrowRight:5,ArrowDown:-5,ArrowLeft:-5,PageUp:10,PageDown:-10};
 if(event.key==='Home'||event.key==='End'||Object.hasOwn(changes,event.key)){
  event.preventDefault();setSoundVolume(event.key==='Home'?0:event.key==='End'?100:soundVolume+changes[event.key],{save:true});
 }
});
function toggleNeedle(){
 if(needleDown){pausePlayback();$('#playbackStatus').textContent='En pausa. Coloca la aguja para seguir escuchando.';}
 else requestPlayback();
}
const needle=$('#needle');
needle.addEventListener('pointerdown',event=>{
 if(event.button!==0||needleDrag||$('#gramophone').classList.contains('changing-view'))return;
 const rect=$('#gramophone').getBoundingClientRect(),pose=needleGeometry();
 needleDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,angle:needleDown?pose.engaged:pose.rest,threshold:pose.threshold,pivotX:rect.left+rect.width*pose.pivotX,pivotY:rect.top+rect.height*pose.pivotY};
 needle.setPointerCapture(event.pointerId);
});
needle.addEventListener('pointermove',event=>{
 const drag=needleDrag;if(!drag||drag.id!==event.pointerId)return;
 if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7)drag.moved=true;
 if(!drag.moved)return;
 drag.angle=Math.max(-40,Math.min(75,Math.atan2(drag.pivotX-event.clientX,event.clientY-drag.pivotY)*180/Math.PI));
 needle.classList.add('dragging');needle.style.setProperty('--needle-angle',drag.angle+'deg');
});
needle.addEventListener('pointerup',event=>{
 const drag=needleDrag;if(!drag||drag.id!==event.pointerId)return;
 needleDrag=null;needle.classList.remove('dragging');needle.releasePointerCapture(event.pointerId);
 if(!drag.moved)return;
 suppressClickUntil=Date.now()+500;
 if(drag.angle>drag.threshold)requestPlayback();else{pausePlayback();$('#playbackStatus').textContent='Aguja en reposo. ¿Seguimos viajando?';}
});
function cancelDrag(){needleDrag=null;needle.classList.remove('dragging');setNeedle(needleDown);}
needle.addEventListener('pointercancel',cancelDrag);needle.addEventListener('lostpointercapture',()=>{if(needleDrag)cancelDrag();});
needle.onclick=event=>{if(event.detail!==0&&Date.now()<suppressClickUntil)return;toggleNeedle();};
// La portada usa el mismo instrumento; esta aguja es únicamente decorativa.
const homeNeedle=needle.cloneNode(true);homeNeedle.removeAttribute('id');homeNeedle.removeAttribute('aria-describedby');homeNeedle.setAttribute('aria-hidden','true');homeNeedle.tabIndex=-1;homeNeedle.disabled=true;homeNeedle.classList.add('engaged');$('.home-hero').append(homeNeedle);

function updateMedia(){
 const host=$('#mediaHost'),reveal=activeScreen==='answerScreen'&&game?.revealed;
 host.classList.toggle('concealed',!reveal);host.setAttribute('aria-hidden',String(!reveal));
 if(ytReady)yt.getIframe().setAttribute('tabindex',reveal?'0':'-1');
 if(!reveal)return;
 const rect=$('#tvWindow').getBoundingClientRect();
 // Coordenadas del documento: el vídeo y la TV se desplazan juntos de forma nativa.
 const scrollX=window.scrollX||window.pageXOffset||0,scrollY=window.scrollY||window.pageYOffset||0;
 Object.assign(host.style,{left:(rect.left+scrollX)+'px',top:(rect.top+scrollY)+'px',width:rect.width+'px',height:rect.height+'px'});
}
function scheduleMedia(){if(mediaFrame)return;mediaFrame=requestAnimationFrame(()=>{mediaFrame=0;updateMedia();});}
window.addEventListener('resize',scheduleMedia);
if(window.visualViewport){window.visualViewport.addEventListener('resize',scheduleMedia);}
if(document.fonts?.ready)document.fonts.ready.then(scheduleMedia);
if(typeof ResizeObserver!=='undefined'){const mediaResize=new ResizeObserver(scheduleMedia);mediaResize.observe($('#answerScreen'));mediaResize.observe($('#tvWindow'));}
window.onYouTubeIframeAPIReady=()=>{
 yt=new YT.Player('youtubePlayer',{width:'480',height:'320',host:'https://www.youtube-nocookie.com',playerVars:{playsinline:1,controls:1,rel:0,fs:0,origin:window.location.origin},events:{
  onReady(){
   ytReady=true;applySoundVolume();yt.getIframe().setAttribute('allow','autoplay; encrypted-media; picture-in-picture');yt.getIframe().setAttribute('title','Vídeo de la canción');
   prepareSong();updateMedia();
   if(activeScreen==='gameScreen')$('#playbackStatus').textContent='Coloca la aguja para escuchar.';
   if(activeScreen==='answerScreen'){$('#videoStatus').textContent='El vídeo está listo. Toca Activar sonido y vídeo.';$('#retryVideo').classList.remove('hidden');}
  },
  onStateChange(event){
   videoPlaying=event.data===YT.PlayerState.PLAYING;
   $('#gameScreen').classList.toggle('is-playing',videoPlaying);
   if(videoPlaying){
    if(!['gameScreen','answerScreen'].includes(activeScreen)){pausePlayback();return;}
    enterAerialView();setNeedle(true);$('#retryVideo').classList.add('hidden');
    $('#playbackStatus').textContent='¡Escucha! ¿Canción, artista o año?';$('#videoStatus').textContent='Ahora sí: imagen y sonido.';
   }else if(event.data===YT.PlayerState.PAUSED){setNeedle(false);
   }else if(event.data===YT.PlayerState.ENDED){setNeedle(false);setPlaybackStatus('La canción ha terminado. ¿Habíais acertado?');}
  },
  onAutoplayBlocked(){setNeedle(false);videoPlaying=false;$('#gameScreen').classList.remove('is-playing');setPlaybackStatus(activeScreen==='answerScreen'?'Toca Activar sonido y vídeo para continuar.':'El navegador pide otro toque. Toca la aguja para escuchar.');if(activeScreen==='answerScreen')$('#retryVideo').classList.remove('hidden');},
  onError(event){
   setNeedle(false);videoPlaying=false;$('#gameScreen').classList.remove('is-playing');
   const message=event.data===153?'YouTube no pudo verificar el sitio. Abre la app desde tu dirección HTTPS.':'Este vídeo no está disponible o no permite reproducción aquí.';
   setPlaybackStatus(message+(activeScreen==='gameScreen'?' Pulsa ? y pasa a la siguiente canción.':' Puedes pasar a la siguiente canción.'));$('#retryVideo').classList.remove('hidden');
  }
 }});
};
$('#retryVideo').onclick=requestPlayback;
const youtubeScript=document.createElement('script');youtubeScript.src='https://www.youtube.com/iframe_api';youtubeScript.async=true;youtubeScript.onerror=()=>setPlaybackStatus('No se pudo conectar con YouTube. Revisa la conexión y recarga la página.');document.head.append(youtubeScript);
setTimeout(()=>{if(!ytReady&&activeScreen==='gameScreen')$('#playbackStatus').textContent='YouTube tarda en cargar. Revisa la conexión o recarga la página.';},18000);

function showPlayers(){
 if(!game)return;playerDraft=game.players.map(p=>({...p,scores:{...p.scores}}));renderPlayers();$('#playerMessage').textContent='';$('#playersDialog').showModal();
}
function renderPlayers(){
 const rows=$('#playerRows');rows.replaceChildren();
 playerDraft.forEach((player,index)=>{
  const row=document.createElement('div');row.className='player-row';
  const input=document.createElement('input');input.value=player.name;input.maxLength=18;input.setAttribute('aria-label','Nombre del jugador '+(index+1));input.oninput=()=>playerDraft[index].name=input.value;
  const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Eliminar jugador '+(index+1));remove.disabled=playerDraft.length<=2;remove.onclick=()=>{playerDraft.splice(index,1);renderPlayers();};
  const score=document.createElement('p');score.textContent=`♫ Canción ${player.scores.song}/${game.totalRounds} · ♬ Artista ${player.scores.artist}/${game.totalRounds} · ◷ Año ${player.scores.year}/${game.totalRounds}`;
  row.append(input,remove,score);rows.append(row);
 });$('#addPlayer').disabled=playerDraft.length>=6;
}
$('#openPlayers').onclick=showPlayers;$('#playersLink').onclick=showPlayers;
$('#addPlayer').onclick=()=>{if(playerDraft.length>=6)return;playerDraft.push({id:'p-'+Date.now(),name:'Jugador '+(playerDraft.length+1),scores:{song:0,artist:0,year:0}});renderPlayers();};
$('#savePlayers').onclick=()=>{
 if(playerDraft.some(p=>!p.name.trim())){$('#playerMessage').textContent='Escribe un nombre para cada jugador.';return;}
 game.players=playerDraft.map(p=>({...p,name:p.name.trim()}));saveSession();$('#playersDialog').close();toast('Nombres guardados.');
};
$$('[data-award]').forEach(button=>button.onclick=()=>{
 if(!game?.revealed)return;awardCategory=button.dataset.award;
 if(game.awards[awardCategory]){toast('Esa ficha ya está asignada en esta ronda.');return;}
 $('#awardHeading').textContent='¿Quién acertó '+({song:'la canción',artist:'el artista',year:'el año'}[awardCategory])+'?';
 const box=$('#awardPlayers');box.replaceChildren();
 game.players.forEach(player=>{const option=document.createElement('button');option.className='award-player';option.textContent=player.name;option.onclick=()=>{
  if(game.awards[awardCategory])return;player.scores[awardCategory]=Math.min(game.totalRounds,player.scores[awardCategory]+1);game.awards[awardCategory]=player.id;saveSession();renderAnswer();$('#awardDialog').close();toast(player.name+' suma un acierto.');
 };box.append(option);});$('#awardDialog').showModal();
});
function showResults(){
 if(!game)return;pausePlayback();game.completed=true;saveSession();
 $('#resultsSummary').textContent=game.albumName+' · '+game.totalRounds+' '+(game.totalRounds===1?'ronda escuchada.':'rondas escuchadas.');
 const box=$('#resultsScores');box.replaceChildren();
 const total=player=>player.scores.song+player.scores.artist+player.scores.year;
 [...game.players].sort((a,b)=>total(b)-total(a)).forEach(player=>{const row=document.createElement('div');row.className='result-player';const name=document.createElement('strong');name.textContent=player.name;const score=document.createElement('span');score.textContent=total(player)+' aciertos';const detail=document.createElement('small');detail.textContent='Canción '+player.scores.song+' · Artista '+player.scores.artist+' · Año '+player.scores.year;row.append(name,score,detail);box.append(row);});
 $('#resultsDialog').showModal();
}
$('#resultsLibrary').onclick=()=>{$('#resultsDialog').close();navigate('libraryScreen');};
$('#playAgain').onclick=()=>{
 $('#resultsDialog').close();const album=albums.find(a=>a.id===game?.albumId);
 if(!album){navigate('libraryScreen');return;}
 chosenRounds=game.totalRounds;$('#roundsInput').value=String(chosenRounds);validateRoundChoice();startAlbum(album.id);
};
setSoundVolume(soundVolume);syncAudioButtons(false);
renderLibrary();window.history.replaceState({screen:'homeScreen'},'', '#inicio');updateMedia();
