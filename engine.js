/* Modelo independiente de la interfaz. No contiene canciones de ejemplo. */
(function(global){
 const ALBUMS_KEY='altavozVinylAlbumsV2',GAME_KEY='altavozSessionV3';
 function cleanCover(value){
  return typeof value==='string'&&value.length<=600000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:null;
 }
 function cleanSongs(raw){
  const result=[],seen=new Set();
  if(!Array.isArray(raw))return result;
  for(const input of raw){try{const song=SongCatalog.song(input);if(!seen.has(song.videoId)){result.push(song);seen.add(song.videoId);}}catch{}}
  return result;
 }
 function readAlbums(storage){
  try{
   const saved=storage.getItem(ALBUMS_KEY);
   if(saved===null){const songs=cleanSongs(JSON.parse(storage.getItem('altavozCustomSongsV1')||'[]'));return songs.length?[{id:'legacy-imports',name:'Mis canciones',songs}]:[];}
   const data=JSON.parse(saved),seen=new Set();
   if(!Array.isArray(data))return [];
   return data.flatMap(a=>{
    if(!a||typeof a.id!=='string'||seen.has(a.id))return [];
    const name=String(a.name||'').trim().slice(0,70),songs=cleanSongs(a.songs);
    if(!name||!songs.length)return [];seen.add(a.id);return [{id:a.id,name,songs,cover:cleanCover(a.cover)}];
   });
  }catch{return [];}
 }
 function clearLibrary(storage){
  const keys=[ALBUMS_KEY,GAME_KEY,'altavozCustomSongsV1','hitRushGameV1'];
  const previous=keys.map(key=>[key,storage.getItem(key)]);
  try{
   // Mantener una lista vacía evita recuperar el catálogo de versiones antiguas.
   storage.setItem(ALBUMS_KEY,'[]');
   for(const key of keys.slice(1))storage.removeItem(key);
  }catch(error){
   for(const [key,value] of previous){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{}}
   throw error;
  }
 }
 function readGame(storage){
  try{
   const g=JSON.parse(storage.getItem(GAME_KEY)||'null');
   if(!g||!Array.isArray(g.songs)||!g.albumName||!g.albumId)return null;
   const songs=cleanSongs(g.songs);if(!songs.length)return null;
   const ids=new Set(songs.map(s=>s.videoId));
   const totalRounds=normalizeRounds(g.totalRounds||Math.max(10,Number(g.round)||1));
   const players=Array.isArray(g.players)?g.players.slice(0,6).map((p,i)=>({id:String(p.id||i),name:String(p.name||'Jugador '+(i+1)).slice(0,18),scores:Object.fromEntries(['song','artist','year'].map(k=>[k,Math.min(totalRounds,Math.max(0,Number(p.scores?.[k])||0))]))})):defaultPlayers();
   return {...g,totalRounds,completed:!!g.completed,songs,used:Array.isArray(g.used)?g.used.filter(id=>ids.has(id)):[],round:Math.min(totalRounds,Math.max(1,Math.floor(Number(g.round)||1))),currentVideoId:ids.has(g.currentVideoId)?g.currentVideoId:null,players:players.length>=2?players:defaultPlayers(),awards:{song:null,artist:null,year:null,...g.awards},revealed:!!g.revealed};
  }catch{return null;}
 }
 function normalizeRounds(value){return Math.min(100,Math.max(1,Math.floor(Number(value)||10)));}
 function defaultPlayers(){return [1,2].map(n=>({id:'p'+n,name:'Jugador '+n,scores:{song:0,artist:0,year:0}}));}
 function newGame(album,players,totalRounds=10){return {totalRounds:normalizeRounds(totalRounds),completed:false,albumId:album.id,albumName:album.name,songs:cleanSongs(album.songs),used:[],round:0,currentVideoId:null,revealed:false,awards:{song:null,artist:null,year:null},players:(players?.length>=2?players:defaultPlayers()).map(p=>({...p,scores:{song:0,artist:0,year:0}}))};}
 function nextSong(game,random=Math.random){
  if(game.completed || game.round>=normalizeRounds(game.totalRounds))return null;
  let available=game.songs.filter(s=>!game.used.includes(s.videoId));
  if(!available.length){game.used=[];available=[...game.songs];if(available.length>1)available=available.filter(s=>s.videoId!==game.currentVideoId);}
  if(!available.length)return null;
  const song=available[Math.min(available.length-1,Math.floor(random()*available.length))];
  game.currentVideoId=song.videoId;game.used.push(song.videoId);game.round++;game.revealed=false;game.awards={song:null,artist:null,year:null};return song;
 }
 function currentSong(game){return game?.songs.find(s=>s.videoId===game.currentVideoId)||null;}
 function addSongs(albums,target,name,songs,id,cover=undefined){
  const existing=target?albums.find(a=>a.id===target):null;
  if(target&&!existing)throw Error('Ese vinilo ya no existe. Vuelve a la biblioteca.');
  const title=(existing?.name||String(name||'').trim()).slice(0,70);
  if(!title)throw Error('Ponle un nombre al vinilo antes de guardarlo.');
  const combined=cleanSongs([...(existing?.songs||[]),...songs]);
  const nextCover=cover===undefined?cleanCover(existing?.cover):cleanCover(cover);
  if(!combined.length)throw Error('Añade canciones para crear el vinilo.');
  if(combined.length===(existing?.songs.length||0)&&nextCover===cleanCover(existing?.cover))throw Error('No hay canciones nuevas ni cambios de portada para guardar.');
  const album={id:existing?.id||id,name:title,songs:combined,cover:nextCover};
  return {album,albums:existing?albums.map(a=>a.id===album.id?album:a):[...albums,album]};
 }
 global.VinylModel={ALBUMS_KEY,GAME_KEY,cleanSongs,readAlbums,readGame,defaultPlayers,newGame,nextSong,currentSong,addSongs,normalizeRounds,cleanCover,clearLibrary};
})(globalThis);
