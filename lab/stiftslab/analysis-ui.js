import {categories,aggregate,parsePopulation} from './analysis-core.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>typeof value==='number'&&Number.isFinite(value)?Math.round(value).toLocaleString('sv-SE'):'Saknas';
const safeLink=url=>/^(https?:\/\/|data\/)/.test(url||'')?esc(url):'#';
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`Underlaget kunde inte hämtas (${r.status}).`);return r.json();};
const shades=['#e0ead4','#b9d2ac','#80ad8b','#47836c','#245747'];
const ramp=(v,breaks)=>v===null||v===undefined?'#d7d9d6':shades[breaks.filter(b=>v>=b).length];
const categoryColors={school:'#416e9d',preschool:'#83a9ce',higher_education:'#314b82',workplace:'#7660a7',nursing_home:'#b38243',hospital:'#b95159',healthcare:'#d68e92',prison:'#645d6c',remand:'#8a6777'};

export function createAnalysis({map,context,redraw,download}){
  let membership,metadata,institutions,institutionMeta,result,baseline,worker,version=0,loadedStift=null,error='',pending=false;
  let scope='auto',fill='contract',enabledCategories=new Set(Object.keys(categories)),institutionLayer,scbLayer,worldpopLayer;
  let pointVisible=false,scbVisible=false,worldpopVisible=false,layerVersion=0,loadingToken=0;
  let lastFeatures=null,cache=new Map();
  const ctx=()=>context();
  map.createPane('underlay');Object.assign(map.getPane('underlay').style,{zIndex:390,pointerEvents:'none'});
  map.createPane('institutions');map.getPane('institutions').style.zIndex=450;
  map.attributionControl.addAttribution('Befolkning: SCB · <a href="https://doi.org/10.5258/SOTON/WP00839" target="_blank" rel="noopener">WorldPop</a> · Institutioner: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>');
  const sourceLink=(url,label)=>`<a href="${safeLink(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  const currentFeatures=()=>{
    const c=ctx();if(!c.state)return [];
    if(scope==='auto')return c.selected.size?c.state.features.filter(f=>c.selected.has(f.id)):c.state.features;
    return c.state.features.filter(f=>f.properties.contractId===scope);
  };
  const scopeLabel=()=>scope==='auto'?(ctx().selected.size?`${ctx().selected.size} valda församlingar`:'Hela stiftets kartområden'):ctx().state.contracts.find(c=>c.id===scope)?.name;
  const originalFeatures=()=>{
    const c=ctx();if(scope!=='auto')return c.base.features.filter(f=>f.properties.contractId===scope);
    if(!c.selected.size)return c.base.features;
    const ids=new Set(currentFeatures().flatMap(f=>f.properties.sourceIds));return c.base.features.filter(f=>ids.has(f.id));
  };
  function sync(){redraw();}
  async function load(){
    const c=ctx(),token=++loadingToken;loadedStift=c.diocese.id;worker?.terminate();worker=null;
    lastFeatures=null;result=null;baseline=null;metadata=null;institutions=null;institutionMeta=null;error='';pending=true;scope='auto';cache=new Map();
    layerVersion++;for(const layer of [institutionLayer,scbLayer,worldpopLayer])if(layer)map.removeLayer(layer);
    institutionLayer=scbLayer=worldpopLayer=null;
    setLayerAvailability(false);sync();
    try{
      membership=membership||await json('data/membership.json');
      const pilot=c.diocese.id==='07'?await Promise.all([json('data/population/metadata.json'),json('data/institutions-lund.geojson'),json('data/institutions-meta.json')]):[null,null,null];
      if(token!==loadingToken)return;
      [metadata,institutions,institutionMeta]=pilot;
      worker=new Worker(new URL('./analysis-worker.js',import.meta.url),{type:'module'});
      const localWorker=worker;
      worker.onmessage=({data})=>{
        if(worker!==localWorker)return;
        if(data.baseline)baseline=data.baseline;
        if(data.version!==version)return;
        pending=false;error=data.error||'';result=data.result||null;
        if(result)cache.set(lastFeatures,result);
        sync();if(pointVisible)renderInstitutions();
      };
      worker.onerror=()=>{if(worker!==localWorker)return;pending=false;error='Statistikberäkningen misslyckades. Ladda om sidan för att försöka igen.';sync();};
      lastFeatures=ctx().state.features;version++;
      worker.postMessage({action:'init',version,features:ctx().state.features,dataset:{base:c.base,membership,metadata,institutions}});
      setLayerAvailability(c.diocese.id==='07');sync();updateOverlays();
    }catch(e){if(token!==loadingToken)return;pending=false;error=e.message;sync();}
  }
  function changed(){
    const c=ctx();if(!c.state)return;
    if(loadedStift!==c.diocese.id){load();return;}
    if(lastFeatures===c.state.features||!worker)return;
    lastFeatures=c.state.features;version++;error='';
    if(cache.has(lastFeatures)){result=cache.get(lastFeatures);pending=false;sync();return;}
    result=null;pending=true;sync();worker.postMessage({action:'calculate',version,features:c.state.features});
  }
  function rowFor(feature,original=false){return (original?baseline:result)?.parishes[feature.id];}
  function featureColor(feature,original=false){
    const r=rowFor(feature,original);
    if(fill==='density')return ramp(r?.population!=null&&r.areaKm2>0?r.population/r.areaKm2:null,[20,100,500,2000]);
    if(fill==='worldpop')return ramp(r?.worldpop!=null&&r.areaKm2>0?r.worldpop/r.areaKm2:null,[20,100,500,2000]);
    if(fill==='members')return ramp(r?.membersReference,[1000,3000,7000,15000]);
    return null;
  }
  function tooltip(feature,original=false){
    const r=rowFor(feature,original);if(!r)return '';
    return `<div class="tooltip-statistics"><span>Folkmängd · SCB 2025 <b>${num(r.population)}</b></span><span>WorldPop · modell 2026 <b>${r.worldpop===null?'Saknas':'≈ '+num(r.worldpop)}</b></span><span>Medlemmar · referens 2025 <b>${num(r.membersReference)}</b></span></div>`;
  }
  function metric(label,value,note,kind=''){return `<div class="analysis-metric ${kind}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;}
  function render(container){
    if(!ctx().state)return;
    if(scope!=='auto'&&!ctx().state.contracts.some(c=>c.id===scope))scope='auto';
    const a=aggregate(currentFeatures(),result),before=aggregate(originalFeatures(),baseline),c=ctx();
    const diff=a.worldpop!==null&&before.worldpop!==null?a.worldpop-before.worldpop:null;
    const gap=a.population>0&&a.worldpop!==null?100*(a.worldpop/a.population-1):null;
    container.innerHTML=`<div class="analysis-heading"><span class="eyebrow">UNDERLAG FÖR INDELNING</span><h2>Människor & platser</h2><p>Välj i kartan eller jämför ett kontrakt.</p></div>
      <label class="analysis-scope">Visa underlag för<select id="analysis-scope"><option value="auto">${c.selected.size?'Valda församlingar':'Hela stiftet'}</option>${c.state.contracts.map(k=>`<option value="${esc(k.id)}" ${scope===k.id?'selected':''}>${esc(k.name)}</option>`).join('')}</select></label>
      <div class="analysis-status" role="status">${pending?'Beräknar underlaget…':error?esc(error):esc(scopeLabel())}</div>
      <div class="analysis-metrics">${metric('Folkmängd · SCB',num(a.population),'31 dec 2025 · indelning 2026')}${metric('Befolkning · WorldPop',a.worldpop===null?'Saknas':'≈ '+num(a.worldpop),'Modell för 2026 · cellcentrum','model')}${metric('Medlemmar · referens',num(a.membersReference),'2025 · tidigare indelning','reference')}${metric('Registrerade verksamheter',num(a.institutionTotal),'Punkter i underlaget · ej personer')}</div>
      ${a.population===null&&!pending?'<p class="analysis-note">SCB-tal saknas för den ändrade geografin. De fördelas inte efter yta. WorldPop kan ge ett separat modellunderlag.</p>':''}
      ${metadata?`<div class="comparison-strip"><span>WorldPop jämfört med SCB</span><strong>${gap===null?'Ej jämförbart':`${gap>=0?'+':''}${gap.toLocaleString('sv-SE',{maximumFractionDigits:1})} %`}</strong></div><p class="analysis-note">Skillnaden visar två olika underlag och referenstidpunkter. Den är inte en befolkningsprognos eller ett mått på SCB:s fel.</p>`:'<p class="analysis-note">Detaljerade befolkningsrutor och verksamheter finns i första versionen för Lunds stift.</p>'}
      <details class="analysis-details"><summary>Jämför med originalindelningen</summary><p>${scope==='auto'&&c.selected.size?'Originalet avser hela ursprungsförsamlingarna bakom valet. Efter en delning är ytorna olika.':'Samma kontrakts-ID jämförs före och efter dina ändringar. Ett nytt kontrakt börjar med 0.'}</p><table><thead><tr><th>Underlag</th><th>Original</th><th>Scenario</th></tr></thead><tbody><tr><th>SCB</th><td>${num(before.population)}</td><td>${num(a.population)}</td></tr><tr><th>WorldPop ≈</th><td>${num(before.worldpop)}</td><td>${num(a.worldpop)}</td></tr><tr><th>Medlemmar, ref.</th><td>${num(before.membersReference)}</td><td>${num(a.membersReference)}</td></tr><tr><th>Verksamheter</th><td>${num(before.institutionTotal)}</td><td>${num(a.institutionTotal)}</td></tr></tbody></table>${diff!==null?`<p>WorldPop-förändring: <strong>${diff>=0?'+':''}${num(diff)}</strong> modellerade personer.</p>`:''}</details>
      <div class="analysis-section"><h3>Arbete, studier & institutioner</h3><p>Arbete och studier representerar den andra platsen. Vård, omsorg och kriminalvård redovisas separat.</p><div class="category-counts">${Object.entries(categories).map(([key,label])=>`<div><span><i style="background:${categoryColors[key]}"></i>${label}</span><b>${a.institutionTotal===null?'–':num(a.institutions[key])}</b></div>`).join('')}</div><p class="analysis-note">Antal i det insamlade underlaget, inte en fullständig inventering. Skolenheter kan dela byggnad. Kapacitet, elever, anställda och boende läggs inte till folkmängden.</p></div>
      <details class="analysis-details"><summary>Källor, metod & luckor</summary><div class="source-notes"><p><strong>SCB:</strong> folkmängd 2025-12-31 kopplad med LKF till indelning 2026-01-01. Sekretesskyddade uppgifter kan avvika vid summering. Personer utan fastighetskoppling ingår inte. ${sourceLink('https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/kyrkliga-indelningar/','Kyrkliga indelningar')} · CC0.</p><p><strong>Medlemsreferens:</strong> ${sourceLink('https://www.newsworthy.se/artikel/406403','Newsworthy, med Svenska kyrkan angiven som källa')}. Medlemsantal 2025 i 2025 års indelning. Matchade namn och känd sammanslagning i Karlskrona. Geografisk jämförbarhet är inte fullt verifierad. Medlemsandel och trend beräknas därför inte; verifierat primäruttag saknas. Ingen medlemsuppgift fördelas efter yta eller WorldPop.</p>${metadata?`<p><strong>WorldPop:</strong> ${sourceLink(metadata.worldpop.doi,metadata.worldpop.title)} · ${esc(metadata.worldpop.license)}. Originalrastret från handelskammarprojektet har verifierats med SHA-256. Native 3 bågsekunder, ungefär 52 × 93 m vid Lund. Ursprungliga cellvärden behålls; varje cells hela värde tilldelas området med cellens centrum. Vid exakt gränsträff väljs ett enda område deterministiskt.</p><p>NoData är inte noll. Kartlagret visar positiva celler; summeringen avser kända modellvärden. Ett nytt område utan positiva celler visas som Saknas. Gränsceller och modellens placering av befolkningen ger osäkerhet. ${sourceLink('data/population/metadata.json','Rastermetadata och osäkerhet per ursprungsförsamling')}.</p><p><strong>SCB-rutor:</strong> hela originalrutor om 1 km. Folkmängd och åldrar avser 2025-12-31. Gränsöverskridande rutor beskärs inte och summeras inte som exakta församlingsvärden. Åldersgrupper kan avvika från totalen på grund av sekretesskydd.</p>`:''}<p><strong>Verksamheter:</strong> Skolverkets skolenheter och Kriminalvårdens publicerade platser, kompletterade med OpenStreetMap. Varje punkt visar sin källa och koordinatmetod. Vård, omsorg, högre utbildning och arbetsplatser är ofullständiga. Arbetsplatsernas storlek och institutionernas kapacitet är inte verifierade. ${sourceLink('data/institutions-meta.json','Inventering och källdatum')}.</p><p>Geografiskt placerade punkter följer dina scenarioområden. Verksamheter i samma område kan ha olika upptagningsområden. Sammanlagda hela församlingar kan summeras; delade områden saknar jämförbara medlems- och SCB-tal. Importerade ändrade polygoner behandlas konservativt som saknade statistikområden.</p></div></details>
      ${result?.unassignedCells||result?.unassignedInstitutions?`<p class="analysis-warning">Kontroll behövs: ${num(result.unassignedCells)} modellceller och ${num(result.unassignedInstitutions)} verksamheter kunde inte placeras i scenariot.</p>`:''}
      <button id="export-analysis" class="button analysis-export" ${!result||pending?'disabled':''}>↓ Exportera underlag · CSV</button>`;
    $('analysis-scope').onchange=e=>{scope=e.target.value;render(container);};
    $('export-analysis').onclick=exportCSV;
  }
  function exportCSV(){
    const c=ctx();if(!result)return;
    const cell=v=>{let s=String(v??'');if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const rows=[['ID','Namn','Kontrakt','SCB folkmängd 2025-12-31, indelning 2026','WorldPop modell 2026, cellcentrum, kända värden','Medlemsreferens 2025, indelning 2025, Newsworthy, jämförbarhet ej verifierad','Verksamheter i underlaget',...Object.values(categories)],...c.state.features.map(f=>{const r=result.parishes[f.id];return [f.id,f.properties.name,c.state.contracts.find(k=>k.id===f.properties.contractId)?.name,r.population,r.worldpop,r.membersReference,r.institutionTotal,...Object.keys(categories).map(k=>r.institutionTotal===null?null:r.institutions[k])];})];
    download('\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),`stiftslab-${c.diocese.id}-underlag.csv`,'text/csv;charset=utf-8');
  }
  function installControls(){
    const panel=$('analysis-layer-controls');
    panel.innerHTML=`<label class="fill-label" for="statistic-fill">Färglägg församlingsytor</label><select id="statistic-fill"><option value="contract">Kontrakt</option><option value="density">Folkmängd / km² · SCB</option><option value="worldpop">Modellbefolkning / km² · WorldPop</option><option value="members">Medlemsantal · referens 2025</option></select><div id="statistic-legend" hidden></div><div class="underlay-controls"><label><input id="layer-worldpop" type="checkbox"> WorldPop · originalceller</label><label><input id="layer-scb-grid" type="checkbox"> SCB · 1 km-rutor</label><label><input id="layer-institutions" type="checkbox"> Verksamheter & institutioner</label></div><div id="institution-categories" hidden>${Object.entries(categories).map(([k,v])=>`<label><input type="checkbox" data-category="${k}" checked><i style="background:${categoryColors[k]}"></i>${v}</label>`).join('')}</div><p id="analysis-layer-note">Detaljlagren finns för Lunds stift och visas på scenariokartan.</p><div id="overlay-status" role="status"></div>`;
    $('statistic-fill').onchange=e=>{fill=e.target.value;const legend=$('statistic-legend');legend.hidden=fill==='contract';legend.innerHTML=fill==='members'?'Referens 2025 · antal medlemmar<br>0 · 1 000 · 3 000 · 7 000 · 15 000+':`${fill==='worldpop'?'WorldPop, modell':'SCB, folkmängd'} per km² total polygonarea<br>0 · 20 · 100 · 500 · 2 000+`;legend.innerHTML+=`<div class="ramp">${shades.map(c=>`<i style="background:${c}"></i>`).join('')}</div><small>Grå = saknat / ej jämförbart värde</small>`;$('legend').hidden=fill!=='contract';redraw();};
    $('layer-worldpop').onchange=e=>{worldpopVisible=e.target.checked;updateOverlays();};
    $('layer-scb-grid').onchange=e=>{scbVisible=e.target.checked;updateOverlays();};
    $('layer-institutions').onchange=e=>{pointVisible=e.target.checked;$('institution-categories').hidden=!pointVisible;updateOverlays();};
    panel.querySelectorAll('[data-category]').forEach(el=>el.onchange=()=>{if(el.checked)enabledCategories.add(el.dataset.category);else enabledCategories.delete(el.dataset.category);renderInstitutions();});
  }
  function setLayerAvailability(enabled){for(const id of ['layer-worldpop','layer-scb-grid','layer-institutions'])$(id).disabled=!enabled;}
  function renderInstitutions(){
    if(institutionLayer)map.removeLayer(institutionLayer);institutionLayer=null;
    if(!pointVisible||!institutions)return;
    institutionLayer=L.geoJSON(institutions,{pane:'institutions',pmIgnore:true,filter:f=>enabledCategories.has(f.properties.category),pointToLayer:(f,ll)=>L.circleMarker(ll,{pane:'institutions',pmIgnore:true,radius:5,color:'#fff',weight:1,fillColor:categoryColors[f.properties.category]||'#777',fillOpacity:.95}),onEachFeature:(f,layer)=>{
      const p=f.properties;layer.bindTooltip(esc(p.name),{direction:'top'});
      layer.bindPopup(()=>{const assigned=result?.assignments[f.id??p.id],name=ctx().state.features.find(f=>f.id===assigned)?.properties.name;
        return `<div class="institution-popup"><span class="eyebrow">${esc(categories[p.category]||p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(name||'Placering beräknas')}</p><p>${p.confidence==='official'?'Officiell källa':'Kompletterande kartuppgift'} · ${sourceLink(p.sourceUrl,p.source||'Källa')}</p><p>${esc(p.asOf||p.retrievedAt||'')}<br>Koordinat: ${esc(p.coordinateMethod||'Källans läge')}</p><small>Kapacitet: ${p.capacity==null?'saknas':esc(p.capacity)}. ${p.unitType==='skolenhet'?'Skolenhet, kan dela byggnad med andra enheter.':''}</small></div>`;});
    }}).addTo(map);
  }
  async function updateOverlays(){
    const token=++layerVersion;
    for(const [layer,visible] of [[institutionLayer,pointVisible],[scbLayer,scbVisible],[worldpopLayer,worldpopVisible]])if(layer&&!visible)map.removeLayer(layer);
    if(!metadata)return;
    try{
      $('overlay-status').textContent='';
      if(pointVisible)renderInstitutions();
      if(scbVisible){
        if(!scbLayer){$('overlay-status').textContent='Hämtar SCB-rutor…';const data=await json(metadata.scbGrid.file);if(token!==layerVersion)return;
          scbLayer=L.geoJSON(data,{pmIgnore:true,style:f=>({color:'#596f89',weight:.6,fillColor:ramp(f.properties.population,[20,100,500,2000]),fillOpacity:.5}),onEachFeature:(f,layer)=>layer.bindTooltip(()=>`<strong>SCB-ruta · ${esc(f.properties.id)}</strong><br>${num(f.properties.population)} invånare · 2025-12-31<br>0–19 år: ${num(f.properties.age0to19)} · 65+ år: ${num(f.properties.age65plus)}<br>Hela 1 km-rutan, även utanför församlingsgränsen.`,{sticky:true})});
        }scbLayer.addTo(map);
      }
      if(worldpopVisible){
        if(!worldpopLayer){$('overlay-status').textContent='Hämtar WorldPop-celler…';const r=await fetch(metadata.worldpop.file);if(!r.ok)throw Error('WorldPop-cellerna kunde inte laddas.');const cells=parsePopulation(await r.arrayBuffer());if(token!==layerVersion)return;worldpopLayer=makeRasterLayer(cells,metadata.worldpop);}
        worldpopLayer.addTo(map);
      }
      $('overlay-status').textContent=worldpopVisible?'WorldPop: zooma till nivå 10 för originalceller. Ljus → mörk: <1, 1–5, 5–20, 20–50, 50+ personer/cell. SCB-rutor använder 0, 20, 100, 500, 2 000+ personer/ruta.':scbVisible?'SCB: 0, 20, 100, 500, 2 000+ personer per hel 1 km-ruta.':'';
    }catch(e){if(token===layerVersion)$('overlay-status').textContent=e.message;}
  }
  function makeRasterLayer(cells,meta){
    return new (L.Layer.extend({
      onAdd(){this.canvas=L.DomUtil.create('canvas','population-canvas');map.getPane('underlay').appendChild(this.canvas);this.schedule();},
      onRemove(){cancelAnimationFrame(this.frame);this.canvas.remove();},
      getEvents(){return {moveend:this.schedule,zoomend:this.schedule,resize:this.schedule};},
      schedule(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.draw());},
      draw(){
        if(!this._map)return;const size=map.getSize(),dpr=Math.min(devicePixelRatio||1,2),canvas=this.canvas;
        canvas.width=size.x*dpr;canvas.height=size.y*dpr;canvas.style.width=size.x+'px';canvas.style.height=size.y+'px';L.DomUtil.setPosition(canvas,map.containerPointToLayerPoint([0,0]));
        if(map.getZoom()<10)return;const context=canvas.getContext('2d');context.scale(dpr,dpr);context.globalAlpha=.85;
        const b=map.getBounds(),gt=meta.geotransform,scale=size.x/(b.getEast()-b.getWest()),w=Math.max(.4,gt[1]*scale),rowY=new Map();
        for(let i=0;i<cells.count;i++){
          const pixel=cells.indices[i],row=Math.floor(pixel/cells.width),col=pixel%cells.width,x=gt[0]+col*gt[1],y=gt[3]+row*gt[5];
          if(x>b.getEast()||x+gt[1]<b.getWest()||y<b.getSouth()||y+gt[5]>b.getNorth())continue;
          let yy=rowY.get(row);if(!yy){yy=[map.latLngToContainerPoint([y,x]).y,map.latLngToContainerPoint([y+gt[5],x]).y];rowY.set(row,yy);}
          context.fillStyle=ramp(cells.values[i],[1,5,20,50]);context.fillRect((x-b.getWest())*scale,yy[0],w,Math.max(.4,yy[1]-yy[0]));
        }
      }
    }))();
  }
  installControls();
  return {changed,render,tooltip,featureColor};
}
