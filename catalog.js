/* Importación local. SheetJS Community Edition 0.20.3 lee los libros Excel. */
(function(global){
  const MAX_ROWS=3000;
  const normalize=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_-]+/g,'');
  const aliases={titulo:'title',cancion:'title',title:'title',artista:'artist',artist:'artist',ano:'year',year:'year',youtube:'videoId',enlace:'videoId',url:'videoId',videoid:'videoId',inicio:'start',start:'start',segundoinicio:'start',bpm:'bpm'};
  function videoId(value){
    const text=String(value??'').trim();
    if(/^[\w-]{11}$/.test(text)) return text;
    try{
      const u=new URL(/^https?:\/\//i.test(text)?text:'https://'+text);
      if(!['https:','http:'].includes(u.protocol)) return null;
      const host=u.hostname.toLowerCase();
      let id;
      if(['youtu.be','www.youtu.be'].includes(host)) id=u.pathname.split('/')[1];
      else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
        const parts=u.pathname.split('/');
        id=u.searchParams.get('v') || (['embed','shorts','live'].includes(parts[1])?parts[2]:null);
      }
      return /^[\w-]{11}$/.test(id||'')?id:null;
    }catch{ return null; }
  }
  function seconds(value){
    const text=String(value??'').trim();
    if(!text) return 0;
    if(/^\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(',','.'));
    if(/^\d+:\d{1,2}(?::\d{1,2})?$/.test(text)){
      const parts=text.split(':').map(Number);
      if(parts.slice(1).some(p=>p>=60)) return NaN;
      return parts.reduce((a,n)=>a*60+n,0);
    }
    return NaN;
  }
  function song(raw){
    const title=String(raw.title??'').trim(),artist=String(raw.artist??'').trim();
    if(!title || !artist) throw Error('Falta el título o el artista');
    if(title.length>180 || artist.length>180) throw Error('Título o artista demasiado largo (máximo 180 caracteres)');
    const year=Number(raw.year);
    if(!Number.isInteger(year) || year<1800 || year>new Date().getFullYear()+1) throw Error('Año no válido');
    const id=videoId(raw.videoId);
    if(!id) throw Error('Enlace o ID de YouTube no válido');
    const start=seconds(raw.start);
    if(!Number.isFinite(start) || start<0 || start>86400) throw Error('Inicio no válido: usa segundos o minutos:segundos');
    const bpm=String(raw.bpm??'').trim()===''?120:Number(raw.bpm);
    if(!Number.isFinite(bpm) || bpm<20 || bpm>300) throw Error('BPM no válido (20–300), o déjalo vacío');
    return {title,artist,year,videoId:id,start,bpm};
  }
  function parseCSV(text){
    text=text.replace(/^\uFEFF/,'');
    const firstLine=text.split(/\r?\n/)[0];
    let delimiter=',';
    if(/^sep=[;,\t]$/i.test(firstLine.trim())){
      delimiter=firstLine.trim().slice(-1);text=text.slice(firstLine.length).replace(/^\r?\n/,'');
    }else{
      // Cuenta separadores solo fuera de las comillas de la cabecera.
      const counts={',':0,';':0,'\t':0};let quoted=false;
      for(const c of firstLine){if(c==='"')quoted=!quoted;else if(!quoted&&c in counts)counts[c]++;}
      delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    }
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){
        if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
      }else if(!quoted && c===delimiter){row.push(cell);cell='';}
      else if(!quoted && (c==='\n'||c==='\r')){
        row.push(cell);rows.push(row);cell='';row=[];if(c==='\r'&&text[i+1]==='\n')i++;
      }else cell+=c;
      if(rows.length>MAX_ROWS+10)throw Error('La hoja admite hasta 3.000 canciones por importación');
    }
    if(quoted)throw Error('El CSV contiene comillas sin cerrar');
    if(cell.length||row.length){row.push(cell);rows.push(row);}
    return rows;
  }
  function inspect(rows,existing=[]){
    const first=rows.findIndex(r=>r.some(c=>String(c??'').trim()));
    if(first<0)throw Error('La hoja está vacía');
    const headers=rows[first].map(normalize).map(h=>aliases[h]||null);
    const required=['title','artist','year','videoId'];
    if(required.some(h=>!headers.includes(h)))throw Error('Faltan columnas: Título, Artista, Año y YouTube. Usa la plantilla.');
    if(headers.filter(Boolean).some((h,i,a)=>a.indexOf(h)!==i))throw Error('Hay columnas repetidas. Deja una sola columna de cada tipo.');
    const records=rows.slice(first+1).map((cells,i)=>({cells,row:first+i+2})).filter(r=>r.cells.some(c=>String(c??'').trim()));
    if(records.length>MAX_ROWS)throw Error('La hoja admite hasta 3.000 canciones por importación');
    const used=new Set(existing.map(s=>s.videoId));
    return records.map(({cells,row})=>{
      const raw={};headers.forEach((key,i)=>{if(key)raw[key]=cells[i]??'';});
      try{
        const clean=song(raw);
        if(used.has(clean.videoId))return {row,raw,song:clean,status:'duplicate',message:'Ya está en la colección o en esta hoja'};
        used.add(clean.videoId);
        return {row,raw,song:clean,status:'valid',message:'Lista para añadir'};
      }catch(e){return {row,raw,status:'invalid',message:e.message};}
    });
  }
  function toCSV(songs){
    const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    return '\uFEFF'+[['Título','Artista','Año','YouTube','Inicio','BPM'],...songs.map(s=>[s.title,s.artist,s.year,'https://www.youtube.com/watch?v='+s.videoId,s.start,s.bpm])].map(r=>r.map(cell).join(';')).join('\r\n');
  }
  global.SongCatalog={song,videoId,seconds,parseCSV,inspect,toCSV,MAX_ROWS};
})(globalThis);
