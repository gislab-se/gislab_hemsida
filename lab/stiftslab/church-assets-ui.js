import {placeTypes,relations,summarizeChurchAssets} from './church-assets-core.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>Number.isFinite(v)?v.toLocaleString('sv-SE',{maximumFractionDigits:1}):'Saknas';
const link=(url,title)=>`<a href="${/^(https?:\/\/|data\/)/.test(url||'')?esc(url):'#'}" target="_blank" rel="noopener">${esc(title)}</a>`;
const colors={church:'#855688',chapel:'#ad7ca9',cemetery:'#4d8065',property:'#b48635'};
const sourceName=p=>typeof p.source==='string'?p.source:p.source?.name||p.sourceId||'Källregister';
const sourceDate=p=>p.asOf||p.sourceUpdatedAt||p.source?.asOf||p.retrievedAt||p.source?.retrievedAt||'';
const getJSON=async path=>{const r=await fetch(path);if(!r.ok)throw Error('Kyrko- och fastighetsunderlaget kunde inte hämtas.');return r.json();};
export function createChurchAssets({map,context,redraw,download}){
  let places,placesMeta,properties,propertiesMeta,inventory,result,worker,version=0,loadToken=0,loadedStift,lastFeatures,pending=false,error='';
  let visibleTypes=new Set(),showProperties=false,showFootprints=false,placeLayer,propertyLayer,footprintLayer;
  let scope='auto',listType='church',query='',limit=60;
  const placeLayers=new Map(),propertyLayers=new Map();
  map.createPane('church-places');map.getPane('church-places').style.zIndex=460;
  map.createPane('church-properties');map.getPane('church-properties').style.zIndex=440;
  const ctx=()=>context();
  const features=()=>{const c=ctx();return scope==='auto'?(c.selected.size?c.state.features.filter(f=>c.selected.has(f.id)):c.state.features):c.state.features.filter(f=>f.properties.contractId===scope);};
  const active=()=>!!places&&ctx().diocese?.id==='07';
  function clearLayers(){for(const layer of [placeLayer,propertyLayer,footprintLayer])if(layer)map.removeLayer(layer);placeLayer=propertyLayer=footprintLayer=null;placeLayers.clear();propertyLayers.clear();}
  async function load(){
    const c=ctx(),token=++loadToken;loadedStift=c.diocese.id;worker?.terminate();worker=null;places=properties=inventory=result=null;lastFeatures=null;scope='auto';query='';error='';pending=c.diocese.id==='07';clearLayers();controlsEnabled(false);redraw();
    if(c.diocese.id!=='07')return;
    try{
      const data=await Promise.all(['church-places-lund.geojson','church-places-meta.json','church-properties-lund.geojson','church-properties-meta.json','church-property-inventory.json'].map(p=>getJSON('data/'+p)));
      if(token!==loadToken)return;[places,placesMeta,properties,propertiesMeta,inventory]=data;
      worker=new Worker(new URL('./church-assets-worker.js',import.meta.url),{type:'module'});const local=worker;
      worker.onmessage=({data})=>{if(worker!==local||data.version!==version)return;result=data.result||null;error=data.error||'';pending=false;redraw();};
      worker.onerror=()=>{if(worker!==local)return;pending=false;error='Kyrko- och fastighetsberäkningen kunde inte slutföras.';redraw();};
      lastFeatures=ctx().state.features;version++;worker.postMessage({version,features:lastFeatures,dataset:{base:c.base,places,properties}});
      controlsEnabled(true);renderLayers();redraw();
    }catch(e){if(token!==loadToken)return;pending=false;error=e.message;redraw();}
  }
  function changed(){const c=ctx();if(!c.state)return;if(loadedStift!==c.diocese.id){load();return;}if(!worker||lastFeatures===c.state.features)return;lastFeatures=c.state.features;result=null;pending=true;version++;worker.postMessage({version,features:lastFeatures});redraw();}
  function controlsEnabled(enabled){$('church-assets-controls').querySelectorAll('input').forEach(el=>el.disabled=!enabled);}
  function installControls(){
    $('church-assets-controls').innerHTML=`<strong>Kyrkor, begravningsplatser & mark</strong>${Object.entries(placeTypes).map(([type,label])=>`<label><input type="checkbox" data-church-type="${type}"><i class="asset-dot" style="background:${colors[type]}"></i>${label}</label>`).join('')}<label><input type="checkbox" id="church-footprints"> Visa registrerade byggnads-/platsytor</label><label><input type="checkbox" id="church-property-layer"><i class="asset-dot" style="background:${colors.property}"></i>Dokumenterade fastighetskopplingar</label><p>Öppet delunderlag för Lund. Platser kan tillhöra olika samfund. Platsytor och fastighetsgränser är separata lager.</p>`;
    $('church-assets-controls').querySelectorAll('[data-church-type]').forEach(el=>el.onchange=()=>{if(el.checked)visibleTypes.add(el.dataset.churchType);else visibleTypes.delete(el.dataset.churchType);renderLayers();});
    $('church-footprints').onchange=e=>{showFootprints=e.target.checked;renderLayers();};
    $('church-property-layer').onchange=e=>{showProperties=e.target.checked;renderLayers();};controlsEnabled(false);
    map.attributionControl.addAttribution('Kyrkomiljöer: RAÄ · Fastighetsgeometri: © Lantmäteriet');
  }
  function placePopup(f){
    const p=f.properties,type=p.category||p.type,id=result?.assignments[f.id??p.id],parish=ctx().state.features.find(g=>g.id===id)?.properties.name;
    const affiliation=typeof p.affiliation==='string'?p.affiliation:p.affiliation?.name;
    return `<div class="institution-popup"><span class="eyebrow">${esc(placeTypes[type]||type)}</span><h3>${esc(p.name)}</h3><p>${esc(parish||p.parishName||'Geografisk tilldelning saknas')}</p><p>Tillhörighet: ${esc(affiliation||'Ej verifierad')}<br>Ägare: ${esc(p.owner||'Ej verifierad')}</p><p>${link(p.sourceUrl,sourceName(p))}<br>${esc(sourceDate(p))}<br>${esc(p.coordinateMethod||'Källans representativa punkt')}</p><small>En kulturhistorisk registrering eller kyrkosymbol styrker varken aktuellt bruk eller ägande.</small></div>`;
  }
  function propertyPopup(f){
    const p=f.properties,ids=result?.assignments[f.id]||[],parishes=ctx().state.features.filter(g=>ids.includes(g.id)).map(g=>g.properties.name);
    return `<div class="institution-popup"><span class="eyebrow">FASTIGHETSGEOMETRI</span><h3>${esc(p.designation)}</h3><p>${format(p.areaM2/10000)} ha · ${p.sourceAreaCount} källområden<br>Geometri: ${esc(p.geometryDate?.slice(0,10)||'Okänd version')}</p>${p.evidence.map(e=>`<p><strong>${esc(e.organization)}</strong><br>${esc(relations[e.relation]||e.relation)} · ${esc(e.sourceDate||'Odaterad källa')}<br>${link(e.sourceUrl,e.name||'Kyrklig källuppgift')}${e.sourcePage?` · s. ${esc(e.sourcePage)}`:''}<br>${esc(e.evidenceNote||'')}</p>`).join('')}<p>${esc(parishes.join(' · ')||'Utanför stiftets kartområden')}</p><p>${link(p.sourceUrl,'Lantmäteriets geometrikälla')}</p><small>Hela tillgängliga skiften i kommunfilen. Ingen aktuell lagfart har kontrollerats. Kartgränser är inte juridiskt fastställda gränser.</small></div>`;
  }
  function renderLayers(){
    clearLayers();if(!active())return;
    const visible=places.features.filter(f=>visibleTypes.has(f.properties.category||f.properties.type));
    if(showFootprints)footprintLayer=L.geoJSON({type:'FeatureCollection',features:visible.filter(f=>f.geometry.type!=='Point')},{pane:'church-properties',pmIgnore:true,style:f=>({color:colors[f.properties.category||f.properties.type],weight:1.4,fillOpacity:.18}),onEachFeature:(f,l)=>l.bindPopup(()=>placePopup(f))}).addTo(map);
    placeLayer=L.layerGroup();
    for(const f of visible){const p=f.properties,point=p.representativePoint||(f.geometry.type==='Point'?f.geometry.coordinates:null);if(!point)continue;
      const layer=L.circleMarker([point[1],point[0]],{pane:'church-places',pmIgnore:true,radius:(p.category||p.type)==='cemetery'?5.5:4.5,color:'#fff',weight:1.2,fillColor:colors[p.category||p.type],fillOpacity:1}).bindTooltip(esc(p.name)).bindPopup(()=>placePopup(f));
      layer.addTo(placeLayer);placeLayers.set(f.id??p.id,layer);
    }placeLayer.addTo(map);
    if(showProperties)propertyLayer=L.geoJSON(properties,{pane:'church-properties',pmIgnore:true,style:{color:colors.property,weight:2,fillColor:'#d5b66d',fillOpacity:.22,dashArray:'6 3'},onEachFeature:(f,layer)=>{propertyLayers.set(f.id,layer);layer.bindTooltip(esc(f.properties.designation),{sticky:true});layer.bindPopup(()=>propertyPopup(f));}}).addTo(map);
  }
  function focusPlace(f){const type=f.properties.category||f.properties.type;visibleTypes.add(type);$('church-assets-controls').querySelector(`[data-church-type="${type}"]`).checked=true;renderLayers();const layer=placeLayers.get(f.id??f.properties.id);if(layer){map.setView(layer.getLatLng(),15);layer.openPopup();}}
  function focusProperty(f){showProperties=true;$('church-property-layer').checked=true;renderLayers();const layer=propertyLayers.get(f.id);if(layer){map.fitBounds(layer.getBounds(),{padding:[50,75],maxZoom:16});layer.openPopup();}}
  function render(container){
    if(!ctx().state)return;
    if(!active()){container.innerHTML=`<div class="analysis-heading"><span class="eyebrow">KYRKOR & FASTIGHETER</span><h2>Platser med sammanhang</h2><p>${pending?'Hämtar öppna källor…':error?esc(error):'Kyrkor, begravningsplatser och fastighetsunderlag finns tills vidare för Lunds stift.'}</p></div>`;return;}
    if(scope!=='auto'&&!ctx().state.contracts.some(c=>c.id===scope))scope='auto';
    const s=summarizeChurchAssets(features(),result),mapped=new Set(properties.features.flatMap(f=>f.properties.inventoryIds)),missing=inventory.properties.filter(r=>!mapped.has(r.id));
    container.innerHTML=`<div class="analysis-heading"><span class="eyebrow">ÖPPET DELUNDERLAG · LUND</span><h2>Kyrkor, gravplatser & mark</h2><p>Historiska och nutida platser från flera samfund. Plats, användning, förvaltning och ägande redovisas var för sig.</p></div>
      <label class="analysis-scope">Geografiskt urval<select id="asset-scope"><option value="auto">${ctx().selected.size?'Valda församlingar':'Hela stiftet'}</option>${ctx().state.contracts.map(c=>`<option value="${esc(c.id)}" ${scope===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="analysis-status" role="status">${pending?'Uppdaterar geografisk tilldelning…':error?esc(error):'Verksamhets- och ägarorganisation kan vara en annan än den geografiska församlingen.'}</div>
      <div class="analysis-metrics">${Object.entries(placeTypes).map(([key,label])=>`<div class="analysis-metric"><span>${label} i underlaget</span><strong>${pending?'…':s[key].length}</strong><small>En gång per registrerad plats</small></div>`).join('')}<div class="analysis-metric reference"><span>Fastigheter som berör urvalet</span><strong>${pending?'…':s.properties.length}</strong><small>Dokumenterat delurval</small></div></div>
      <p class="analysis-note">${places.features.length} platser i hela pilotunderlaget. RAÄ:s kulturregister kompletteras med OSM. Täckning, aktuellt bruk och samfundstillhörighet är inte fullständigt verifierade.</p>
      <div class="asset-list-tabs" role="group" aria-label="Välj platstyp">${[['church','Kyrkor'],['cemetery','Begravning'],['properties','Fastigheter']].map(([k,v])=>`<button class="${listType===k?'active':''}" data-asset-list="${k}">${v}</button>`).join('')}</div>
      <input id="asset-search" type="search" value="${esc(query)}" placeholder="Sök namn eller fastighetsbeteckning…" aria-label="Sök kyrkor och fastigheter"><div id="asset-results"></div>
      <details class="analysis-details"><summary>Fastigheter utan kartgeometri · ${missing.length}</summary><p>Dokumenterade beteckningar i hela pilotens förteckning. De har inte kunnat placeras säkert och ingår därför inte i urvalets fastighetsantal.</p>${missing.map(r=>`<div class="asset-unmapped"><strong>${esc(r.designation)}</strong><span>${esc(r.organization)} · ${esc(relations[r.relation]||r.relation)}</span><small>${link(r.sourceUrl,r.sourceDate||'Källa')}${r.sourcePage?` · s. ${esc(r.sourcePage)}`:''}</small></div>`).join('')||'<p>Alla beteckningar i förteckningen är kopplade.</p>'}</details>
      <details class="analysis-details"><summary>Källor, täckning & ägande</summary><div class="source-notes"><p><strong>Platsunderlag:</strong> ${link('data/church-places-meta.json','Källregister, antal och begränsningar')}. RAÄ:s registrering kan avse ursprungligt ändamål. OSM har ojämn täckning. Kyrkomiljöer klassas inte automatiskt som begravningsplatser. Bevarade platsytor är inte fastighetsgränser.</p><p><strong>Fastigheter:</strong> ${properties.features.length} registerfastigheter har geometri; ${inventory.properties.length} dokumenterade fastighetskopplingar finns i förteckningen. ${link('data/church-property-inventory.json','Kyrkliga dokument och belägg')} · ${link('data/church-properties-meta.json','Geometrimatchning och ej matchade poster')}.</p><p>Exakt fastighetsbeteckning matchas mot Lantmäteriets kommunuttag med metoden från Anderslöv-projektet. Samtliga tillgängliga skiften per registeridentitet behålls. Fastigheter kan beröra flera församlingar och räknas en gång i ett gemensamt urval. Kartans områdesindelning ändrar inte ägandet.</p><p>Ägd, förvaltad, hyrd och historisk koppling hålls isär och gäller vid källdatumet. Prästlönetillgångar visas med sin egen förvaltningskoppling. Ingen aktuell lagfart eller fullständig innehavsförteckning finns i detta underlag.</p><p>Nya kommunuttag kunde inte hämtas med befintlig Lantmäteriet-behörighet. Den bevarade Trelleborgsfilen används där den räcker. Övriga beteckningar behålls öppet som ej kartlagda.</p><p>För fullständighet behövs ett behörigt registeruttag med fullständig beteckning, kommun, juridisk organisation, ägd/förvaltad/hyrd, källdatum och källa. ${link('data/church-property-template.json','Mall för fortsatt inventering')}. Nedladdnings- och matchningsskript finns i projektet.</p></div></details>
      ${result?.unassignedPlaces?`<p class="analysis-warning">${result.unassignedPlaces} platser kunde inte tilldelas ett scenarioområde.</p>`:''}
      <button id="export-church-assets" class="button analysis-export">↓ Exportera platser & fastigheter · CSV</button>`;
    $('asset-scope').onchange=e=>{scope=e.target.value;limit=60;render(container);};
    container.querySelectorAll('[data-asset-list]').forEach(b=>b.onclick=()=>{listType=b.dataset.assetList;query='';limit=60;render(container);});
    $('asset-search').oninput=e=>{query=e.target.value;limit=60;renderResults();};
    $('export-church-assets').onclick=exportCSV;renderResults();
  }
  function renderResults(){
    const s=summarizeChurchAssets(features(),result),q=query.trim().toLocaleLowerCase('sv');
    const ids=new Set(listType==='church'?[...s.church,...s.chapel]:s[listType]);
    const records=(listType==='properties'?properties.features:places.features).filter(f=>ids.has(f.id??f.properties.id)&&((f.properties.name||'')+' '+(f.properties.designation||'')).toLocaleLowerCase('sv').includes(q)).sort((a,b)=>(a.properties.name||a.properties.designation).localeCompare(b.properties.name||b.properties.designation,'sv'));
    $('asset-results').innerHTML=`<div class="asset-list-count">${records.length} träffar${records.length>limit?` · visar ${limit}`:''}</div>${records.slice(0,limit).map((f,i)=>{const p=f.properties;return `<button class="asset-row" data-asset-index="${i}"><i class="asset-dot" style="background:${colors[listType==='properties'?'property':p.category||p.type]}"></i><span><strong>${esc(p.name||p.designation)}</strong><small>${listType==='properties'?`${p.sourceAreaCount} källområden · ${format(p.areaM2/10000)} ha`:`${esc(placeTypes[p.category||p.type])} · ${esc(sourceName(p))}`}</small></span><b aria-hidden="true">↗</b></button>`;}).join('')||'<p class="analysis-note">Inga matchande objekt i detta urval.</p>'}${records.length>limit?'<button id="more-assets" class="button small">Visa fler</button>':''}`;
    $('asset-results').querySelectorAll('[data-asset-index]').forEach(b=>b.onclick=()=>{const f=records[Number(b.dataset.assetIndex)];if(listType==='properties')focusProperty(f);else focusPlace(f);});
    if($('more-assets'))$('more-assets').onclick=()=>{limit+=100;renderResults();};
  }
  function exportCSV(){
    const cell=v=>{let s=String(v??'');if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const rows=[['Typ','ID','Namn eller beteckning','Organisation/tillhörighet','Relation','Källa','Källdatum','Geometri finns'],...places.features.map(f=>{const p=f.properties;return [p.category||p.type,f.id??p.id,p.name,typeof p.affiliation==='string'?p.affiliation:p.affiliation?.name,'Ägande ej verifierat',p.sourceUrl,sourceDate(p),'Ja'];}),...inventory.properties.map(p=>['Fastighetskoppling',p.id,p.designation,p.organization,relations[p.relation]||p.relation,p.sourceUrl,p.sourceDate,properties.features.some(f=>f.properties.inventoryIds.includes(p.id))?'Ja':'Nej'])];
    download('\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),'stiftslab-lund-kyrkor-fastigheter.csv','text/csv;charset=utf-8');
  }
  installControls();return {changed,render};
}
