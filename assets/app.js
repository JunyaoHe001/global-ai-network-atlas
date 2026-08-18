(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const years = Array.from({length: 10}, (_, i) => 2016 + i);
  const nodeFields = { region:0, documents:1, location_mentions:2, weighted_degree:3, degree:4, international_weight_share:5 };
  const state = {
    year: 2016, metric:'weighted_degree', scope:'all', linkLimit:250, nodeSize:'weighted_degree',
    fill:true, labels:false, selected:null, playing:false, playTimer:null,
    map:null, data:null, nodeMap:new Map(), view:[0,0,1200,600]
  };
  const $ = id => document.getElementById(id);
  const fmt = new Intl.NumberFormat('en-US');
  const pct = v => `${Math.round(v*100)}%`;

  const svg = $('mapSvg');
  const baseLayer = $('baseLayer');
  const regionLayer = $('regionLayer');
  const edgeLayer = $('edgeLayer');
  const nodeLayer = $('nodeLayer');
  const labelLayer = $('labelLayer');
  const tooltip = $('tooltip');
  const regionEls = new Map();
  const regionById = new Map();

  function el(tag, attrs={}) {
    const x = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k,v]) => x.setAttribute(k, v));
    return x;
  }
  function metricValue(n, key) { return key === 'uniform' ? 1 : Number(n[nodeFields[key]] || 0); }
  function metricLabel(key) {
    return ({weighted_degree:'Weighted co-occurrence degree',documents:'Unique AI-news documents',location_mentions:'Location mentions',degree:'Unique regional partners'})[key] || key;
  }
  function colorFor(v,max) {
    if (!max || v <= 0) return '#e9edf3';
    const t = Math.max(0, Math.min(1, Math.log1p(v) / Math.log1p(max)));
    const stops = [[232,238,246],[139,169,207],[49,95,159],[23,61,115]];
    const q = t*(stops.length-1), i=Math.min(stops.length-2,Math.floor(q)), f=q-i;
    const a=stops[i],b=stops[i+1];
    return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
  }
  function radiusFor(v,max) {
    if (!max) return 10;
    const t=Math.sqrt(Math.max(0,v)/max);
    return 1.2 + 4.6*t;
  }
  function edgeWidth(w,max) {
    if (!max) return 0.7;
    return 0.5 + 3.2*Math.sqrt(w/max);
  }

  let dataManifest = null;
  let allYears = new Map();

  async function loadPackedBytes(urls) {
    const files = Array.isArray(urls) ? urls : [urls];
    const chunks = await Promise.all(files.map(url => fetch(url).then(r => { if (!r.ok) throw new Error(`Failed to load ${url}`); return r.text(); })));
    const b64 = chunks.join('').trim();
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (!('DecompressionStream' in window)) throw new Error('This browser does not support gzip decompression.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function loadPackedJSON(urls) {
    const bytes = await loadPackedBytes(urls);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function readVarint(bytes, pos) {
    let n = 0, shift = 0, b;
    do { b = bytes[pos.i++]; n |= (b & 127) << shift; shift += 7; } while (b & 128);
    return n >>> 0;
  }

  function decodeAllYears(bytes) {
    if (String.fromCharCode(...bytes.slice(0,4)) !== 'AIR1') throw new Error('Invalid year-data bundle');
    const pos = {i:4};
    const count = readVarint(bytes,pos);
    const out = new Map();
    for (let k=0;k<count;k++) {
      const blockLen = readVarint(bytes,pos);
      const end = pos.i + blockLen;
      const year = 2016 + readVarint(bytes,pos);
      const nodeCount = readVarint(bytes,pos), edgeCount = readVarint(bytes,pos);
      const regions = readVarint(bytes,pos), links = readVarint(bytes,pos), cooccurrenceWeight = readVarint(bytes,pos), intlShare = readVarint(bytes,pos)/10000;
      const nodes=[]; let region=0;
      for(let i=0;i<nodeCount;i++){
        region += readVarint(bytes,pos);
        nodes.push([region,readVarint(bytes,pos),readVarint(bytes,pos),readVarint(bytes,pos),readVarint(bytes,pos),readVarint(bytes,pos)/10000]);
      }
      const edges=[]; let source=0,target=0;
      for(let i=0;i<edgeCount;i++){
        const sd=readVarint(bytes,pos);
        if(sd){source+=sd;target=0;}
        target+=readVarint(bytes,pos);
        edges.push([source,target,readVarint(bytes,pos),bytes[pos.i++]]);
      }
      if(pos.i!==end) throw new Error(`Corrupt year block ${year}`);
      edges.sort((a,b)=>b[2]-a[2]);
      out.set(year,{year,nodes,edges,summary:{y:year,regions,links,cooccurrence_weight:cooccurrenceWeight,international_weight_share:intlShare}});
    }
    return out;
  }

  async function loadBase() {
    const [meta,manifest] = await Promise.all([fetch('data/meta.json').then(r=>r.json()), fetch('data/manifest.json').then(r=>r.json())]);
    dataManifest = manifest;
    const [packed,yearBytes] = await Promise.all([loadPackedJSON(manifest.map), loadPackedBytes(manifest.years)]);
    allYears = decodeAllYears(yearBytes);
    const map = {
      viewBox: packed.v,
      base: '',
      regions: packed.r.map((r,i) => ({i, n:r[0], c:packed.c[r[1]], x:r[2], y:r[3], d:r[4]}))
    };
    state.map = map;
    state.view = map.viewBox.slice();
    map.regions.forEach(r => regionById.set(r.i,r));
    if (map.base) { const base = el('path',{d:map.base,class:'base-map','fill-rule':'evenodd'}); baseLayer.appendChild(base); }
    map.regions.forEach(r => {
      const p=el('path',{d:r.d,class:'region-shape zero','data-region':r.i,'fill-rule':'evenodd'});
      p.addEventListener('mousemove', ev => showRegionTooltip(ev,r.i));
      p.addEventListener('mouseleave', hideTooltip);
      p.addEventListener('click', ev => { ev.stopPropagation(); focusRegion(r.i); });
      regionLayer.appendChild(p); regionEls.set(r.i,p);
    });
    const dl=$('regionOptions');
    map.regions.slice().sort((a,b)=>a.n.localeCompare(b.n)).forEach(r=>{
      const o=document.createElement('option'); o.value=`${r.n}, ${r.c}`; dl.appendChild(o);
    });
    return meta;
  }

  async function loadYear(y) {
    state.year = y;
    state.data = allYears.get(y);
    if (!state.data) throw new Error(`Missing year ${y}`);
    state.nodeMap = new Map(state.data.nodes.map(n=>[n[0],n]));
    $('yearSlider').value=y; $('yearValue').textContent=y; $('toolbarYear').textContent=y;
    render();
  }

  function filteredEdges() {
    let arr=state.data.edges;
    if(state.scope==='international') arr=arr.filter(e=>e[3]===1);
    else if(state.scope==='domestic') arr=arr.filter(e=>e[3]===0);
    if(state.linkLimit!=='all') arr=arr.slice(0,Number(state.linkLimit));
    return arr;
  }

  function arcPaths(a,b) {
    const W=state.map.viewBox[2];
    let x1=a.x,y1=a.y,x2=b.x,y2=b.y;
    let dx=x2-x1;
    if(Math.abs(dx) <= W/2) return [arcOne(x1,y1,x2,y2)];
    if(dx>0) x2-=W; else x2+=W;
    const p1=arcOne(x1,y1,x2,y2);
    const shift=dx>0?W:-W;
    const p2=arcOne(x1+shift,y1,x2+shift,y2);
    return [p1,p2];
  }
  function arcOne(x1,y1,x2,y2) {
    const dx=x2-x1,dy=y2-y1,dist=Math.sqrt(dx*dx+dy*dy);
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    const nx=dist?(-dy/dist):0,ny=dist?(dx/dist):0;
    const bend=Math.min(44,dist*.13);
    const cx=mx+nx*bend,cy=my+ny*bend;
    return `M${x1},${y1}Q${cx},${cy} ${x2},${y2}`;
  }

  function render() {
    if(!state.data || !state.map) return;
    const vals=state.data.nodes.map(n=>metricValue(n,state.metric));
    const maxMetric=Math.max(1,...vals);
    const sizeVals=state.data.nodes.map(n=>metricValue(n,state.nodeSize));
    const maxSize=Math.max(1,...sizeVals);

    regionEls.forEach((p,id)=>{
      const n=state.nodeMap.get(id);
      const value=n?metricValue(n,state.metric):0;
      p.classList.toggle('zero',!n || value<=0);
      p.classList.toggle('focused',state.selected===id);
      p.style.fill=state.fill?colorFor(value,maxMetric):'var(--map-land)';
      p.style.opacity=state.selected!==null && state.selected!==id ? '.58':'1';
    });

    edgeLayer.replaceChildren();
    const edges=filteredEdges();
    const maxEdge=Math.max(1,...edges.map(e=>e[2]));
    const focus=state.selected;
    edges.forEach(e=>{
      const a=regionById.get(e[0]), b=regionById.get(e[1]); if(!a||!b)return;
      const focused=focus!==null && (e[0]===focus||e[1]===focus);
      const dim=focus!==null && !focused;
      arcPaths(a,b).forEach(d=>{
        const p=el('path',{d,class:`edge-path${focused?' focused':''}`});
        p.style.strokeWidth=edgeWidth(e[2],maxEdge);
        p.style.opacity=dim?'.035':String(.11+.32*Math.sqrt(e[2]/maxEdge));
        edgeLayer.appendChild(p);
      });
    });

    nodeLayer.replaceChildren();
    state.data.nodes.forEach(n=>{
      const r=regionById.get(n[0]); if(!r)return;
      const c=el('circle',{cx:r.x,cy:r.y,r:radiusFor(metricValue(n,state.nodeSize),maxSize),class:'node'});
      const isFocus=focus===n[0];
      const isNeighbour=focus!==null && state.data.edges.some(e=>(e[0]===focus&&e[1]===n[0])||(e[1]===focus&&e[0]===n[0]));
      if(isFocus)c.classList.add('focused');
      else if(focus!==null&&!isNeighbour)c.classList.add('dimmed');
      c.addEventListener('mousemove',ev=>showRegionTooltip(ev,n[0]));
      c.addEventListener('mouseleave',hideTooltip);
      c.addEventListener('click',ev=>{ev.stopPropagation();focusRegion(n[0]);});
      nodeLayer.appendChild(c);
    });

    labelLayer.replaceChildren();
    if(state.labels){
      const top=state.data.nodes.slice().sort((a,b)=>metricValue(b,state.nodeSize)-metricValue(a,state.nodeSize)).slice(0,15);
      top.forEach(n=>addLabel(n[0]));
    }
    if(focus!==null && !state.labels) addLabel(focus);

    const s=state.data.summary;
    $('statRegions').textContent=fmt.format(s.regions);
    $('statLinks').textContent=fmt.format(edges.length);
    $('statWeight').textContent=fmt.format(s.cooccurrence_weight);
    $('statIntl').textContent=pct(s.international_weight_share);
    $('legendTitle').textContent=metricLabel(state.metric);
    $('toolbarNote').textContent=`${state.linkLimit==='all'?'All':`Top ${fmt.format(state.linkLimit)}`} ${state.scope==='international'?'international ':state.scope==='domestic'?'within-country ':''}links`;
    updateSelected();
  }

  function addLabel(id){
    const r=regionById.get(id); if(!r)return;
    const t=el('text',{x:r.x+6,y:r.y-5,class:'node-label'}); t.textContent=r.n; labelLayer.appendChild(t);
  }

  function showRegionTooltip(ev,id){
    const r=regionById.get(id),n=state.nodeMap.get(id); if(!r)return;
    let html=`<strong>${escapeHtml(r.n)}</strong><br>${escapeHtml(r.c)}`;
    if(n){html+=`<br>Documents: ${fmt.format(n[1])}<br>Weighted degree: ${fmt.format(n[3])}<br>Partners: ${fmt.format(n[4])}`;}
    else html+='<br>Documents: 0<br>Weighted degree: 0<br>Partners: 0<br><span class="tooltip-note">No co-occurrence activity in this year</span>';
    tooltip.innerHTML=html; tooltip.hidden=false;
    const box=$('mapSvg').parentElement.getBoundingClientRect();
    tooltip.style.left=`${Math.min(box.width-280,ev.clientX-box.left+14)}px`;
    tooltip.style.top=`${Math.min(box.height-115,ev.clientY-box.top+14)}px`;
  }
  function hideTooltip(){tooltip.hidden=true;}
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}

  function focusRegion(id){
    if(!regionById.has(id)) return;
    state.selected=id;
    render();
  }
  function updateSelected(){
    const id=state.selected, card=$('selectedCard');
    if(id===null||!regionById.has(id)){card.hidden=true;return;}
    card.hidden=false;
    const r=regionById.get(id),n=state.nodeMap.get(id);
    const vals=n||[id,0,0,0,0,0];
    $('selectedName').textContent=`${r.n}, ${r.c}`;
    $('selDocs').textContent=fmt.format(vals[1]); $('selMentions').textContent=fmt.format(vals[2]);
    $('selWeighted').textContent=fmt.format(vals[3]); $('selDegree').textContent=fmt.format(vals[4]);
    const partners=state.data.edges.filter(e=>e[0]===id||e[1]===id).sort((a,b)=>b[2]-a[2]).slice(0,6);
    const list=$('partnerList'); list.replaceChildren();
    if(!partners.length){
      const li=document.createElement('li'); li.textContent='No co-occurrence links in this year'; list.appendChild(li);
      return;
    }
    partners.forEach(e=>{
      const pid=e[0]===id?e[1]:e[0],pr=regionById.get(pid); const li=document.createElement('li');
      li.textContent=`${pr.n}, ${pr.c} · ${fmt.format(e[2])}`; list.appendChild(li);
    });
  }

  function searchRegion(){
    const q=$('searchInput').value.trim().toLowerCase(); if(!q)return;
    const match=state.map.regions.find(r=>`${r.n}, ${r.c}`.toLowerCase()===q) || state.map.regions.find(r=>r.n.toLowerCase().includes(q)||r.c.toLowerCase()===q);
    if(!match)return;
    focusRegion(match.i);
    setView([match.x-90,match.y-58,180,116]);
  }

  function setView(v){
    const [x,y,w,h]=v; state.view=[x,y,w,h]; svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);
  }
  function fitWorld(){ setView(state.map.viewBox.slice()); }

  function bindControls(){
    $('yearSlider').addEventListener('input',e=>loadYear(Number(e.target.value)));
    $('prevYear').addEventListener('click',()=>loadYear(Math.max(2016,state.year-1)));
    $('nextYear').addEventListener('click',()=>loadYear(Math.min(2025,state.year+1)));
    $('playYear').addEventListener('click',togglePlay);
    $('metricSelect').addEventListener('change',e=>{state.metric=e.target.value;render();});
    $('scopeSelect').addEventListener('change',e=>{state.scope=e.target.value;render();});
    $('linkLimit').addEventListener('change',e=>{state.linkLimit=e.target.value==='all'?'all':Number(e.target.value);render();});
    $('nodeSize').addEventListener('change',e=>{state.nodeSize=e.target.value;render();});
    $('fillToggle').addEventListener('change',e=>{state.fill=e.target.checked;render();});
    $('labelToggle').addEventListener('change',e=>{state.labels=e.target.checked;render();});
    $('fitButton').addEventListener('click',fitWorld);
    $('clearButton').addEventListener('click',()=>{state.selected=null;render();});
    $('searchButton').addEventListener('click',searchRegion);
    $('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchRegion();});
    svg.addEventListener('click',()=>{state.selected=null;render();});
    bindPanZoom();
  }
  function togglePlay(){
    state.playing=!state.playing; $('playYear').textContent=state.playing?'❚❚':'▶';
    if(state.playing){
      state.playTimer=setInterval(()=>{const y=state.year>=2025?2016:state.year+1;loadYear(y);},1300);
    } else {clearInterval(state.playTimer);state.playTimer=null;}
  }
  function bindPanZoom(){
    let dragging=false,start=null,startView=null;
    svg.addEventListener('pointerdown',e=>{dragging=true;svg.setPointerCapture(e.pointerId);start=[e.clientX,e.clientY];startView=state.view.slice();svg.classList.add('dragging');});
    svg.addEventListener('pointermove',e=>{
      if(!dragging)return; const rect=svg.getBoundingClientRect();
      const dx=(e.clientX-start[0])/rect.width*startView[2],dy=(e.clientY-start[1])/rect.height*startView[3];
      setView([startView[0]-dx,startView[1]-dy,startView[2],startView[3]]);
    });
    svg.addEventListener('pointerup',()=>{dragging=false;svg.classList.remove('dragging');});
    svg.addEventListener('pointercancel',()=>{dragging=false;svg.classList.remove('dragging');});
    svg.addEventListener('wheel',e=>{
      e.preventDefault(); const rect=svg.getBoundingClientRect(); const [x,y,w,h]=state.view;
      const px=(e.clientX-rect.left)/rect.width,py=(e.clientY-rect.top)/rect.height;
      const factor=e.deltaY>0?1.18:.85; let nw=Math.max(80,Math.min(state.map.viewBox[2]*1.35,w*factor));
      let nh=nw*(rect.height/rect.width); if(nh>state.map.viewBox[3]*1.5){nh=state.map.viewBox[3]*1.5;nw=nh*(rect.width/rect.height);}
      const mx=x+px*w,my=y+py*h; setView([mx-px*nw,my-py*nh,nw,nh]);
    },{passive:false});
  }

  async function init(){
    try{
      await loadBase(); bindControls(); fitWorld(); await loadYear(2016);
    }catch(err){
      console.error(err); $('toolbarNote').textContent='Failed to load atlas data';
    }
  }
  init();
})();
