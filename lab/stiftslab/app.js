import * as core from './core.js';
import * as storage from './storage.js';
import {createAnalysis} from './analysis-ui.js';
import {createChurchAssets} from './church-assets-ui.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette=['#7e9b7e','#d0b27b','#829dba','#b98f9b','#93b8ad','#a8ad75','#b99e84','#a49abb','#83b7c3','#c39478','#a9be8f','#c6b6a5','#b7a253','#7eaaa1'];
let manifest,diocese,base,state,stiftData,officialContracts;
let tab='parishes', selected=new Set(), undo=[],redo=[],loadVersion=0,saveTimer,toastTimer;
let originalMap=null,originalLayer=null,originalBoundary=null,originalStift=null,originalTiles=null,originalRenderedId=null;
let geometryLayer,contractLayer,stiftLayer, topology, drawAction=null,comparing=false;
let mapLayers=new Map(), originalMapLayers=new Map(), mutationBusy=false;
let hoveredId=null, originalHoveredId=null;
let analysisView='population';
let backgroundAllowed=false;
$('layer-base').checked=false;
const map=L.map('map',{zoomControl:false,preferCanvas:true,attributionControl:true}).setView([55.95,13.55],8);
L.control.zoom({position:'bottomright'}).addTo(map);
L.control.scale({position:'bottomleft',imperial:false}).addTo(map);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,opacity:.56,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'});
map.attributionControl.addAttribution('Gränser: Svenska kyrkan · Indelning: SCB');
map.createPane('contracts');Object.assign(map.getPane('contracts').style,{zIndex:420,pointerEvents:'none'});
map.createPane('diocese');Object.assign(map.getPane('diocese').style,{zIndex:430,pointerEvents:'none'});
map.pm.setLang('sv');
const analysis=createAnalysis({map,context:()=>({state,base,diocese,selected}),redraw:()=>{updateLayers();if(tab==='analysis')renderList();},download});
const churchAssets=createChurchAssets({map,context:()=>({state,base,diocese,selected}),redraw:()=>{if(tab==='analysis')renderList();},download});

const contractName=id=>state?.contracts.find(c=>c.id===id)?.name||diocese?.contracts.find(c=>c.id===id)?.name||id;
function color(id){
  const ids=[...new Set([...diocese.contracts.map(c=>c.id),...state.contracts.map(c=>c.id)])].sort();
  return palette[Math.max(0,ids.indexOf(id))%palette.length];
}
const sorted=features=>[...features].sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'sv'));
const options=(contracts,placeholder='')=>(placeholder?`<option value="">${esc(placeholder)}</option>`:'')+[...contracts].sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
const uid=prefix=>`${prefix}:${crypto.randomUUID()}`;
function toast(message,error=false){$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,error?9000:4500);}
function showDialog(title,html){$('dialog-title').textContent=title;$('dialog-body').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();}
const closeDialog=()=>$('dialog').close();
$('dialog-close').onclick=closeDialog;
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
function askName(title,label,initial,submit,description=''){
  showDialog(title,`<form id="name-form"><p class="dialog-copy">${esc(description)}</p><label class="dialog-field">${esc(label)}<input id="name-value" class="dialog-input" maxlength="120" required value="${esc(initial)}"></label><p id="form-error" class="dialog-error" role="alert"></p><div class="dialog-actions"><button class="button" type="button" id="form-cancel">Avbryt</button><button class="button primary" type="submit">Fortsätt</button></div></form>`);
  $('form-cancel').onclick=closeDialog;
  $('name-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{await submit($('name-value').value.trim());closeDialog();}catch(err){$('form-error').textContent=err.message;}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  $('name-value').focus();$('name-value').select();
}
async function getJSON(url){const response=await fetch(url);if(!response.ok)throw Error(`Kunde inte hämta kartdata (${response.status}).`);return response.json();}
function setLoading(visible,text='Vi ritar upp stiftet'){$('loading').hidden=!visible;$('loading').querySelector('h2').textContent=text;}
async function saveDraft(snapshot=state){
  if(!snapshot)return;
  try{await storage.put({id:`draft-${snapshot.stiftId}`,stiftId:snapshot.stiftId,kind:'draft',updated:new Date().toISOString(),state:snapshot});if(snapshot.stiftId===state.stiftId)$('save-status').textContent='Sparat på enheten';}
  catch{if(snapshot.stiftId===state.stiftId)$('save-status').textContent='Kunde inte autospara';toast('Lagringen på enheten är full eller blockerad. Exportera scenariot som JSON för att behålla det.',true);}
}
function scheduleSave(){clearTimeout(saveTimer);$('save-status').textContent='Sparar…';const snapshot=state;saveTimer=setTimeout(()=>saveDraft(snapshot),250);}
async function loadDiocese(id){
  const version=++loadVersion;
  cancelDraw(); clearTimeout(saveTimer); if(state)await saveDraft(state);
  setLoading(true);$('diocese').disabled=true;
  try{
    const next=manifest.dioceses.find(d=>d.id===id);
    const data=await getJSON(next.file);
    let draft;
    try{draft=await storage.get(`draft-${id}`);}catch{toast('Automatiskt sparande är inte tillgängligt. Använd export för att behålla scenarier.',true);}
    if(version!==loadVersion)return;
    diocese=next;base=data;state=draft?.state?.dataVersion===manifest.version?draft.state:core.createScenario(base,diocese);
    selected.clear();undo=[];redo=[];tab='parishes';$('search').value='';$('contract-filter').value='';
    $('diocese').value=id;$('scenario-name').value=state.name;$('map-title').textContent=diocese.name;
    $('map-subtitle').textContent=`${diocese.count} geografiska församlingar · ${diocese.contracts.length} kontrakt`;
    document.title=`Stiftslab · ${diocese.name}`;
    refresh();renderGeometry();fit();
    if(comparing)renderOriginal();
    $('save-status').textContent=draft?'Sparat på enheten':'Lokalt scenario';
    setLoading(false);
  }catch(err){$('loading').innerHTML=`<div class="loading-card"><h2>Kartan kunde inte laddas</h2><p>${esc(err.message)}</p><button id="retry" class="button primary">Försök igen</button></div>`;$('retry').onclick=()=>location.reload();}
  finally{$('diocese').disabled=false;}
}
function parishStyle(f,original=false){
  const chosen=!original&&selected.has(f.id),hovered=(original?originalHoveredId:hoveredId)===f.id;
  const filter=original?'':$('contract-filter').value,dim=filter&&f.properties.contractId!==filter;
  const opacity=Number($('parish-opacity').value)/100;
  return {fillColor:analysis.featureColor(f,original)||color(f.properties.contractId),fillOpacity:opacity*(dim&&!chosen&&!hovered?.25:1),color:chosen?'#244c40':hovered?'#467549':'#6c8065',weight:chosen?2.8:hovered?2.3:($('layer-parishes').checked?.65:0),opacity:chosen||hovered?1:dim?.18:.6};
}
function parishTooltip(f,original=false){
  const p=f.properties,contract=original?diocese.contracts.find(c=>c.id===p.contractId)?.name:contractName(p.contractId);
  const area=Number(p.areaKm2),lkf=/^\d{6}$/.test(f.id)?`LKF ${esc(f.id)}`:'Scenarioområde';
  return `<div class="parish-tooltip-content"><span class="tooltip-context">${original?'Original · 2026-01-01':esc(diocese.name)}</span><strong>${esc(p.name)}</strong><span class="tooltip-contract"><i class="color-dot" style="background:${color(p.contractId)}"></i>${esc(contract||p.contractId)}</span><div class="tooltip-facts"><span>${lkf}</span>${Number.isFinite(area)?`<span>${area.toLocaleString('sv-SE',{maximumFractionDigits:1})} km²</span>`:''}</div>${analysis.tooltip(f,original)}${p.geometryIssue?'<span class="tooltip-note">Källgeometrin behöver kontrolleras.</span>':''}</div>`;
}
function setHovered(id,original=false,showTooltip=false){
  const layers=original?originalMapLayers:mapLayers,previous=original?originalHoveredId:hoveredId;
  if(original)originalHoveredId=id;else hoveredId=id;
  if(previous&&previous!==id){const old=layers.get(previous);if(old){old.setStyle(parishStyle(old.feature,original));old.closeTooltip();}}
  const layer=layers.get(id);
  if(layer){layer.setStyle(parishStyle(layer.feature,original));layer.bringToFront();if(showTooltip)layer.openTooltip(layer.getBounds().getCenter());}
}
function bindParishHover(f,layer,original=false){
  layer.bindTooltip(()=>parishTooltip(f,original),{sticky:true,direction:'auto',className:'parish-tooltip',opacity:1});
  layer.on('mouseover',()=>{if(drawAction){layer.closeTooltip();return;}setHovered(f.id,original);});
  layer.on('mouseout',()=>{if((original?originalHoveredId:hoveredId)===f.id)setHovered(null,original);});
}
function renderGeometry(){
  if(geometryLayer)map.removeLayer(geometryLayer);if(contractLayer)map.removeLayer(contractLayer);if(stiftLayer)map.removeLayer(stiftLayer);
  mapLayers=new Map();hoveredId=null;
  geometryLayer=L.geoJSON(core.collection(state.features),{style:parishStyle,pmIgnore:true,onEachFeature:(f,layer)=>{
    mapLayers.set(f.id,layer);
    bindParishHover(f,layer);
    layer.on('click',e=>{if(drawAction)return;const multi=$('multi-select').checked||e.originalEvent.shiftKey;selectFeature(f.id,multi);});
  }}).addTo(map);
  topology=topojson.topology({parishes:core.collection(state.features)});
  contractLayer=L.geoJSON(topojson.mesh(topology,topology.objects.parishes,(a,b)=>a===b||a.properties.contractId!==b.properties.contractId),{pane:'contracts',interactive:false,pmIgnore:true,style:{color:'#566b4e',weight:1.8,opacity:.85,fill:false}});
  stiftLayer=L.geoJSON(core.collection(stiftData.features.filter(f=>f.id===diocese.id)),{pane:'diocese',interactive:false,pmIgnore:true,style:{color:'#254f42',weight:2.4,opacity:.8,fill:false,dashArray:'6 4'}});
  updateLayers();styleSelection();
  analysis.changed();
  churchAssets.changed();
}
function updateLayers(){
  if(geometryLayer)geometryLayer.setStyle(parishStyle);
  for(const [layer,visible] of [[contractLayer,$('layer-contracts').checked],[stiftLayer,$('layer-diocese').checked],[tiles,backgroundAllowed&&$('layer-base').checked]])if(layer){if(visible&&!map.hasLayer(layer))layer.addTo(map);else if(!visible&&map.hasLayer(layer))map.removeLayer(layer);}
  if(originalMap){
    originalLayer?.setStyle(f=>parishStyle(f,true));
    for(const [layer,visible] of [[originalBoundary,$('layer-contracts').checked],[originalStift,$('layer-diocese').checked],[originalTiles,backgroundAllowed&&$('layer-base').checked]])if(layer){if(visible&&!originalMap.hasLayer(layer))layer.addTo(originalMap);else if(!visible&&originalMap.hasLayer(layer))originalMap.removeLayer(layer);}
  }
}
function styleSelection(){geometryLayer?.setStyle(parishStyle);for(const id of selected)mapLayers.get(id)?.bringToFront();}
function fit(){if(geometryLayer)map.fitBounds(geometryLayer.getBounds(),{paddingTopLeft:[35,125],paddingBottomRight:[35,70],animate:false});}
function selectFeature(id,multi=false){if(!multi){if(selected.size===1&&selected.has(id))selected.clear();else selected=new Set([id]);}else if(selected.has(id))selected.delete(id);else selected.add(id);styleSelection();renderList();renderSelection();}
function focusFeature(id){const layer=mapLayers.get(id);if(layer)map.fitBounds(layer.getBounds(),{padding:[70,90],maxZoom:13});}
function visibleFeatures(){const query=$('search').value.trim().toLocaleLowerCase('sv'),filter=$('contract-filter').value;return sorted(state.features.filter(f=>(!filter||f.properties.contractId===filter)&&(!query||f.properties.name.toLocaleLowerCase('sv').includes(query)||f.id.includes(query))));}
function refresh(){
  const previousFilter=$('contract-filter').value,previousTarget=$('move-target').value;
  $('contract-filter').innerHTML=options(state.contracts,'Alla kontrakt');if(state.contracts.some(c=>c.id===previousFilter))$('contract-filter').value=previousFilter;
  $('move-target').innerHTML=options(state.contracts,'Välj kontrakt att flytta till');if(state.contracts.some(c=>c.id===previousTarget))$('move-target').value=previousTarget;
  $('parish-count').textContent=state.features.length;$('change-count').textContent=core.changes(state,base).length;
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
  renderList();renderSelection();renderLegend();
}
function renderList(){
  document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
  $('list-controls').hidden=tab!=='parishes';$('select-visible').hidden=tab!=='parishes';
  const list=$('list');
  if(tab==='analysis'){
    $('list-label').textContent=analysisView==='population'?'Befolkning · medlemsreferens · verksamheter':'Kyrkor · begravningsplatser · fastigheter';
    list.innerHTML=`<div class="analysis-view-tabs"><button data-analysis-view="population" class="${analysisView==='population'?'active':''}">Människor & verksamheter</button><button data-analysis-view="church" class="${analysisView==='church'?'active':''}">Kyrkor & fastigheter</button></div><div id="analysis-panel"></div>`;
    list.querySelectorAll('[data-analysis-view]').forEach(b=>b.onclick=()=>{analysisView=b.dataset.analysisView;renderList();});
    if(analysisView==='church')churchAssets.render($('analysis-panel'));else analysis.render($('analysis-panel'));
  }else if(tab==='parishes'){
    const features=visibleFeatures();$('list-label').textContent=`${features.length} församlingar`;
    list.innerHTML=features.map(f=>`<div class="entity-row ${selected.has(f.id)?'selected':''}" data-id="${esc(f.id)}"><input type="checkbox" aria-label="Välj ${esc(f.properties.name)}" ${selected.has(f.id)?'checked':''}><span class="entity-text"><span class="entity-name">${esc(f.properties.name.replace(/ församling$/,''))}</span><span class="entity-meta"><i class="color-dot" style="background:${color(f.properties.contractId)}"></i>${esc(contractName(f.properties.contractId).replace(/ kontrakt$/,''))}</span></span><button class="zoom-button" aria-label="Zooma till ${esc(f.properties.name)}" title="Zooma till">↗</button></div>`).join('')||'<div class="empty-list"><strong>Inga träffar</strong>Prova ett annat namn eller välj Alla kontrakt.</div>';
    list.querySelectorAll('.entity-row').forEach(row=>{
      row.onclick=e=>{if(e.target.closest('button')){focusFeature(row.dataset.id);return;}selectFeature(row.dataset.id,true);};
      row.querySelector('input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();selectFeature(row.dataset.id,true);}};
      row.onmouseenter=()=>{if(!drawAction)setHovered(row.dataset.id,false,true);};
      row.onmouseleave=()=>{if(hoveredId===row.dataset.id)setHovered(null);};
      row.onfocusin=()=>{if(!drawAction)setHovered(row.dataset.id,false,true);};
      row.onfocusout=e=>{if(!row.contains(e.relatedTarget)&&hoveredId===row.dataset.id)setHovered(null);};
    });
  }else if(tab==='contracts'){
    $('list-label').textContent=`${state.contracts.length} kontrakt`;
    list.innerHTML=`<button class="button small" id="manage-contracts" style="width:100%;margin:5px 0 10px">＋ Skapa eller ändra kontrakt</button>`+[...state.contracts].sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(c=>`<button class="entity-row contract-row" data-contract="${esc(c.id)}" style="width:100%;text-align:left;background:transparent"><span class="contract-swatch" style="background:${color(c.id)}55"></span><span class="entity-text"><span class="entity-name">${esc(c.name.replace(/ kontrakt$/,''))}</span><span class="entity-meta">${c.custom?'Scenariokontrakt':esc(c.id)}</span></span><span class="entity-number">${state.features.filter(f=>f.properties.contractId===c.id).length}</span></button>`).join('');
    $('manage-contracts').onclick=manageContracts;
    list.querySelectorAll('[data-contract]').forEach(button=>button.onclick=()=>filterContract(button.dataset.contract));
  }else{
    const changes=core.changes(state,base);$('list-label').textContent=`${changes.length} berörda församlingar`;
    list.innerHTML=changes.map(c=>`<div class="change-row"><strong>${esc(c.name)}</strong><p>${esc(c.reasons.join(' · '))}</p>${c.from&&c.to&&c.from!==c.to?`<p>${esc(contractName(c.from))}<br>→ ${esc(contractName(c.to))}</p>`:''}</div>`).join('')||'<div class="empty-list"><strong>Ett oskrivet kapitel</strong>Här syns skillnader mot originalindelningen när du gör din första ändring.</div>';
    if(state.log.length)list.innerHTML+=`<div class="change-row"><strong>Händelser i scenariot</strong>${state.log.slice(-20).reverse().map(e=>`<p>${esc(e.text)}</p>`).join('')}</div>`;
  }
}
function renderSelection(){
  const chosen=[...selected].map(id=>state.features.find(f=>f.id===id)).filter(Boolean),n=chosen.length;
  $('selection-title').textContent=n?`${n} ${n===1?'församling vald':'församlingar valda'}`:'Inga församlingar valda';
  $('selection-description').textContent=n===1?`${chosen[0].properties.name} · ${chosen[0].properties.id.startsWith('scenario:')?'Nytt område':'LKF '+chosen[0].id} · ${Number(chosen[0].properties.areaKm2).toLocaleString('sv-SE',{maximumFractionDigits:1})} km²`:n?chosen.map(f=>f.properties.name.replace(/ församling$/,'')).join(' · '):'Klicka i kartan eller välj i listan.';
  $('clear-selection').disabled=!n;$('move-target').disabled=!n;$('move').disabled=!n||!$('move-target').value;
  $('merge').disabled=n<2;$('split').disabled=n!==1;$('transfer').disabled=n!==2;
  $('map-help').hidden=n>0;
  if(n===1){$('move-target').title=`Nuvarande kontrakt: ${contractName(chosen[0].properties.contractId)}`;}else $('move-target').title='Välj kontrakt';
}
function renderLegend(){
  $('legend-count').textContent=state.contracts.length;
  $('legend-items').innerHTML=[...state.contracts].sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(c=>`<button data-contract="${esc(c.id)}" class="${$('contract-filter').value===c.id?'active':''}"><span class="color-dot" style="background:${color(c.id)}"></span>${esc(c.name.replace(/ kontrakt$/,''))}</button>`).join('');
  $('legend-items').querySelectorAll('button').forEach(b=>b.onclick=()=>filterContract($('contract-filter').value===b.dataset.contract?'':b.dataset.contract));
}
function filterContract(id){$('contract-filter').value=id;tab='parishes';renderList();renderLegend();styleSelection();}
function apply(next){
  undo.push(state);if(undo.length>25)undo.shift();redo=[];state=next;
  selected=new Set([...selected].filter(id=>state.features.some(f=>f.id===id)));
  refresh();renderGeometry();scheduleSave();
}
function mutate(fn){try{apply(fn());toast('Scenariot är uppdaterat.');}catch(e){toast(e.message,true);}}
async function busy(fn,label='Bearbetar gränserna'){
  if(mutationBusy)throw Error('Vänta tills den pågående beräkningen är klar.');mutationBusy=true;document.querySelector('.sidebar').inert=true;document.querySelector('.app-header').inert=true;setLoading(true,label);await new Promise(resolve=>setTimeout(resolve,30));
  try{return await fn();}finally{mutationBusy=false;document.querySelector('.sidebar').inert=false;document.querySelector('.app-header').inert=false;setLoading(false);}
}
function geometryTask(data){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./geometry-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{worker.terminate();if(data.error)reject(Error(data.error));else resolve(data.result);};
    worker.onerror=()=>{worker.terminate();reject(Error('Geometriberäkningen kunde inte slutföras. Ditt tidigare scenario finns kvar.'));};
    worker.postMessage(data);
  });
}
function renderOriginal(){
  if(!originalMap){
    originalMap=L.map('original-map',{zoomControl:false,preferCanvas:true}).setView(map.getCenter(),map.getZoom());
    originalTiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,opacity:.56,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
    const sync=(from,to)=>{if(!comparing)return;const a=from.getCenter(),b=to.getCenter();if(from.getZoom()!==to.getZoom()||Math.abs(a.lat-b.lat)>1e-7||Math.abs(a.lng-b.lng)>1e-7)to.setView(a,from.getZoom(),{animate:false});};
    map.on('moveend',()=>sync(map,originalMap));originalMap.on('moveend',()=>sync(originalMap,map));
  }
  originalMap.invalidateSize();map.invalidateSize();
  if(originalRenderedId!==diocese.id){
    for(const layer of [originalLayer,originalBoundary,originalStift])if(layer)originalMap.removeLayer(layer);
    originalMapLayers=new Map();originalHoveredId=null;
    originalLayer=L.geoJSON(base,{pmIgnore:true,style:f=>parishStyle(f,true),onEachFeature:(f,layer)=>{originalMapLayers.set(f.id,layer);bindParishHover(f,layer,true);}}).addTo(originalMap);
    originalBoundary=L.geoJSON(core.collection(officialContracts.features.filter(f=>f.properties.stiftId===diocese.id)),{interactive:false,pmIgnore:true,style:{color:'#566b4e',weight:1.8,opacity:.85,fill:false}}).addTo(originalMap);
    originalStift=L.geoJSON(core.collection(stiftData.features.filter(f=>f.id===diocese.id)),{interactive:false,pmIgnore:true,style:{color:'#254f42',weight:2.4,opacity:.8,fill:false,dashArray:'6 4'}}).addTo(originalMap);
    originalRenderedId=diocese.id;
  }
  updateLayers();originalMap.setView(map.getCenter(),map.getZoom(),{animate:false});
}
function toggleCompare(){comparing=!comparing;$('compare').setAttribute('aria-pressed',String(comparing));$('maps').classList.toggle('comparing',comparing);if(comparing)renderOriginal();map.invalidateSize();fit();}
function cancelDraw(){map.pm.disableDraw();drawAction=null;$('draw-banner').hidden=true;}
function startDraw(action,instruction){setHovered(null);setHovered(null,true);drawAction=action;$('draw-instruction').textContent=instruction;$('draw-banner').hidden=false;map.pm.enableDraw('Polygon',{allowSelfIntersection:false,snappable:true,snapDistance:15,pathOptions:{color:'#244c40',fillColor:'#c9dfac',fillOpacity:.4},templineStyle:{color:'#244c40'},hintlineStyle:{color:'#244c40',dashArray:'5 5'}});}
map.on('pm:create',async event=>{
  if(!drawAction)return;const action=drawAction,mask=event.layer.toGeoJSON();map.removeLayer(event.layer);cancelDraw();
  await busy(async()=>{try{apply(await geometryTask({...action,action:action.type,state,mask,newId:uid('scenario')}));toast('Gränserna är uppdaterade.');}catch(e){toast(e.message,true);}});
});
function manageContracts(){
  showDialog('Arbeta med kontrakt',`<p class="dialog-copy">Skapa ett nytt kontrakt och flytta valda församlingar till det för att dela en befintlig indelning.</p><button id="new-contract" class="button primary">＋ Nytt kontrakt</button><h3>Byt namn</h3><form id="rename-contract"><label class="dialog-field">Kontrakt<select id="rename-id">${options(state.contracts)}</select></label><label class="dialog-field">Nytt namn<input id="rename-value" class="dialog-input" maxlength="120" required></label><button class="button" type="submit">Spara namn</button></form><h3>Slå samman kontrakt</h3><form id="merge-contracts"><label class="dialog-field">Flytta alla församlingar från<select id="contract-from">${options(state.contracts)}</select></label><label class="dialog-field">Till kontrakt<select id="contract-to">${options(state.contracts)}</select></label><p class="dialog-copy">Det första kontraktet tas bort ur scenariot. Ändringen kan ångras.</p><button class="button" type="submit">Slå samman kontrakten</button></form><p id="contract-error" class="dialog-error" role="alert"></p>`);
  $('new-contract').onclick=()=>askName('Skapa nytt kontrakt','Kontraktets namn','',name=>{const id=uid('contract');apply(core.addContract(state,name,id));$('move-target').value=id;renderSelection();toast('Kontraktet är skapat. Välj församlingar och flytta dem dit.');});
  $('rename-contract').onsubmit=e=>{e.preventDefault();try{apply(core.renameContract(state,$('rename-id').value,$('rename-value').value));closeDialog();toast('Kontraktsnamnet är ändrat.');}catch(err){$('contract-error').textContent=err.message;}};
  $('merge-contracts').onsubmit=e=>{e.preventDefault();try{apply(core.mergeContracts(state,$('contract-from').value,$('contract-to').value));closeDialog();toast('Kontrakten är sammanslagna.');}catch(err){$('contract-error').textContent=err.message;}};
}
function download(value,name,type){const data=typeof value==='string'?value:JSON.stringify(value);const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const fileStem=()=>`stiftslab-${diocese.id}-${state.name.replace(/[^a-zåäö0-9_-]+/gi,'-').slice(0,60)}`;
function exportScenario(){download({...state,exportedAt:new Date().toISOString(),sources:manifest.sources},`${fileStem()}.json`,'application/json');toast('Scenariot har exporterats.');}
function exportGeoJSON(){
  const names=new Map(state.contracts.map(c=>[c.id,c.name]));
  download({type:'FeatureCollection',name:state.name,dataVersion:state.dataVersion,scenario:true,sources:manifest.sources,features:state.features.map(f=>({...f,properties:{...f.properties,contractName:names.get(f.properties.contractId),stiftName:diocese.name}}))},`${fileStem()}-forsamlingar.geojson`,'application/geo+json');
}
async function exportContracts(){
  closeDialog();
  await busy(async()=>{try{
    const features=await geometryTask({action:'contracts',state});
    download({type:'FeatureCollection',name:state.name,dataVersion:state.dataVersion,scenario:true,sources:manifest.sources,features},`${fileStem()}-kontrakt.geojson`,'application/geo+json');
  }catch(e){toast(`Exporten misslyckades: ${e.message}`,true);}},'Skapar kontraktsområden');
}
function exportChanges(){
  const cell=value=>{let v=String(value??'');if(/^[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
  const rows=[['LKF / scenario-ID','Namn','Ändring','Ursprungligt kontrakt','Scenariokontrakt'],...core.changes(state,base).map(c=>[c.id,c.name,c.reasons.join(', '),c.from?contractName(c.from):'',c.to?contractName(c.to):''])];
  download('\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),`${fileStem()}-andringar.csv`,'text/csv;charset=utf-8');
}
async function saveNamed(name){
  const snapshot={...state,name};
  await storage.put({id:uid('saved'),kind:'saved',stiftId:diocese.id,updated:new Date().toISOString(),state:snapshot});
  state=snapshot;$('scenario-name').value=name;await saveDraft();toast('En kopia av scenariot är sparad på den här enheten.');
}
function saveDialog(){askName('Spara en scenariokopia','Namn',state.name,saveNamed,'Kopian sparas i den här webbläsaren. Exportera JSON om du vill flytta den till en annan enhet eller dela den.');}
async function importScenario(file){
  if(!file)return;
  if(file.size>60*1024*1024){toast('Filen får vara högst 60 MB.',true);return;}
  try{
    const value=JSON.parse(await file.text());
    if(value.stiftId!==diocese.id){toast('Byt först till stiftet som scenariot gäller och importera igen.',true);return;}
    closeDialog();await busy(async()=>{const valid=await geometryTask({action:'validate',value,base,diocese});apply(valid);$('scenario-name').value=valid.name;toast('Scenariot är importerat och dess geografiska täckning är kontrollerad.');},'Kontrollerar det importerade scenariot');
  }catch(e){toast(`Kunde inte importera: ${e.message}`,true);}
}
async function scenarioMenu(){
  let saved=[];try{saved=(await storage.all()).filter(r=>r.kind==='saved'&&r.stiftId===diocese.id).sort((a,b)=>b.updated.localeCompare(a.updated));}catch{}
  showDialog('Scenarier & export',`<p class="dialog-copy">Arbetet autosparas i webbläsaren. Sparade kopior och exporter låter dig jämföra flera förslag.</p><div class="menu-grid"><button id="menu-save" class="button">＋ Spara scenariokopia</button><button id="menu-new" class="button">Nytt från original</button><button id="export-scenario" class="button">↓ Scenario · JSON</button><button id="import-scenario" class="button">↑ Importera scenario</button><button id="export-geo" class="button">↓ Församlingar · GeoJSON</button><button id="export-contracts" class="button">↓ Kontrakt · GeoJSON</button><button id="export-csv" class="button">↓ Ändringslista · CSV</button><button id="menu-contracts" class="button">Hantera kontrakt</button></div><input type="file" accept=".json,application/json" id="import-file" hidden><h3>Sparade scenarier · ${esc(diocese.name)}</h3><div id="saved-list">${saved.map((r,i)=>`<div class="saved-row"><span class="saved-text"><strong>${esc(r.state.name)}</strong><small>${new Date(r.updated).toLocaleString('sv-SE')}</small></span><button class="button small" data-load="${i}">Öppna</button><button class="button small" data-remove="${i}" aria-label="Ta bort ${esc(r.state.name)}">×</button></div>`).join('')||'<p class="dialog-copy">Du har inga sparade kopior ännu.</p>'}</div>`);
  $('menu-save').onclick=saveDialog;
  $('menu-new').onclick=()=>askName('Nytt scenario','Namn på scenariot','Nytt scenario',async name=>{if(!name)throw Error('Ange ett namn.');await saveNamed(state.name);apply(core.createScenario(base,diocese,name));$('scenario-name').value=name;toast('Ett nytt scenario har skapats. Ditt tidigare arbete finns bland sparade kopior.');});
  $('export-scenario').onclick=exportScenario;$('export-geo').onclick=exportGeoJSON;$('export-contracts').onclick=exportContracts;$('export-csv').onclick=exportChanges;$('menu-contracts').onclick=manageContracts;
  $('import-scenario').onclick=()=>$('import-file').click();$('import-file').onchange=e=>importScenario(e.target.files[0]);
  $('saved-list').querySelectorAll('[data-load]').forEach(b=>b.onclick=async()=>{try{await saveNamed(state.name);const next=core.clone(saved[Number(b.dataset.load)].state);apply(next);$('scenario-name').value=next.name;closeDialog();toast('Scenariot är öppnat. Det tidigare arbetet har sparats som en kopia.');}catch(e){toast(e.message,true);}});
  $('saved-list').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const record=saved[Number(b.dataset.remove)];showDialog('Ta bort sparad kopia',`<p class="dialog-copy">Ta bort den sparade kopian <strong>${esc(record.state.name)}</strong>? Det öppna arbetsutkastet påverkas inte.</p><div class="dialog-actions"><button id="delete-cancel" class="button">Avbryt</button><button id="delete-confirm" class="button primary">Ta bort kopian</button></div>`);$('delete-cancel').onclick=scenarioMenu;$('delete-confirm').onclick=async()=>{await storage.remove(record.id);await scenarioMenu();};});
}
function sourcesDialog(){
  showDialog('Data med tydligt ursprung',`<div class="source-stat-grid"><div><strong>${manifest.dioceses.length}</strong>stift</div><div><strong>${diocese.count}</strong>områden i ${esc(diocese.name.replace(' stift',''))}</div><div><strong>${diocese.contracts.length}</strong>ursprungliga kontrakt</div></div><div class="dialog-copy"><p>Originalindelning <strong>1 januari 2026</strong>. Hämtad ${esc(manifest.retrieved)}. Dina scenarier är planeringsförslag och ändrar aldrig källfilerna.</p><h3>Geografiska gränser</h3><p><a href="https://api.svenskakyrkan.se/doc/forsamlingskarta/forsamlingskarta_doc.aspx" target="_blank" rel="noopener">Svenska kyrkans officiella kartlager</a>: församlingar, kontrakt och stift. Omprojicerat från SWEREF 99 TM till WGS 84; koordinater avrundade till nio decimaler. Ingen kartografisk förenkling.</p><h3>Organisationstillhörighet</h3><p><a href="https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/kyrkliga-indelningar/" target="_blank" rel="noopener">SCB:s kyrkliga indelning 2026</a>. Församlingsområdena kopplas till kontrakt och stift via LKF- och SKP-koder. SCB:s statistiska distrikt används inte som församlingsgränser.</p><h3>Församlingar utan geografiskt område</h3><p>${diocese.withoutGeometry.length?`${diocese.registeredCount} församlingar finns i registret, varav ${diocese.count} har geografiska områden. Följande visas därför inte som polygoner: ${diocese.withoutGeometry.map(p=>`${esc(p.pastoratName)} (${esc(p.id)})`).join(', ')}.`:'Alla stiftets registrerade församlingar har en polygon i kartunderlaget.'} För landet som helhet finns ${manifest.totalRegistered} registrerade församlingar och ${manifest.totalParishes} kartområden.</p><h3>Så fungerar gränsändringar</h3><p>Delning klipper ut ett område ur den valda församlingen. Flytta område tar samma yta från en församling och lägger till den i en annan. Metoden bevarar den totala täckningen och skapar inte nya glapp eller överlappningar. Ursprungliga kartfel kan finnas kvar. Öar och andra åtskilda delområden är tillåtna.</p><h3>Användningsvillkor</h3><p>SCB anger CC0 för sina öppna data. Svenska kyrkans API-portal anger CC BY 4.0 för de flesta resurser, men ett kartlagerspecifikt licensbesked kunde inte verifieras. Källan och årgången följer med exporter. Kontrollera kartlagrens villkor före vidarepublicering.</p><h3>Lagring & bakgrundskarta</h3><p>Scenarier sparas på din enhet i den här webbläsaren. De synkroniseras inte mellan enheter. Exportera JSON för säkerhetskopia. Bakgrundskartan kommer från <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> och kräver internet.</p></div>`);
}

$('diocese').onchange=e=>loadDiocese(e.target.value);
$('search').oninput=renderList;$('contract-filter').onchange=()=>{renderList();renderLegend();styleSelection();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderList();});
$('select-visible').onclick=()=>{visibleFeatures().forEach(f=>selected.add(f.id));styleSelection();renderList();renderSelection();};
$('clear-selection').onclick=()=>{selected.clear();styleSelection();renderList();renderSelection();};
$('move-target').onchange=renderSelection;$('move').onclick=()=>mutate(()=>core.moveParishes(state,[...selected],$('move-target').value));
$('merge').onclick=()=>askName('Slå samman församlingar','Namn på det sammanslagna området','',async name=>busy(async()=>{apply(await geometryTask({action:'merge',state,ids:[...selected],name,id:uid('scenario')}));toast('Församlingarna är sammanslagna.');}),'De valda församlingarna måste tillhöra samma kontrakt. Den nya församlingen finns bara i scenariot.');
$('split').onclick=()=>{const id=[...selected][0];askName('Dela en församling','Namn på den nya delen','',name=>{if(!name)throw Error('Ange ett namn.');startDraw({type:'split',id,name},'Rita den del som ska bli en ny församling. Klicka på första punkten för att avsluta.');},'Efter namngivningen ritar du ett område i kartan. Endast delen inom den valda församlingen klipps ut.');};
$('transfer').onclick=()=>{
  const ids=[...selected],from=state.features.find(f=>f.id===ids[0]),to=state.features.find(f=>f.id===ids[1]);
  showDialog('Flytta ett område',`<p class="dialog-copy">Rita en yta som ska flyttas mellan de två valda församlingarna. Endast den del som ligger inom givarförsamlingen flyttas.</p><label class="dialog-field">Från<select id="transfer-from"><option value="${esc(from.id)}">${esc(from.properties.name)}</option><option value="${esc(to.id)}">${esc(to.properties.name)}</option></select></label><p class="dialog-note">Mottagare blir den andra valda församlingen. Den gemensamma yttergränsen bevaras.</p><div class="dialog-actions"><button class="button primary" id="transfer-start">Rita området →</button></div>`);
  $('transfer-start').onclick=()=>{const fromId=$('transfer-from').value,toId=ids.find(id=>id!==fromId);closeDialog();startDraw({type:'transfer',from:fromId,to:toId},'Rita ytan som ska flyttas. Klicka på första punkten för att avsluta.');};
};
$('cancel-draw').onclick=cancelDraw;
$('compare').onclick=toggleCompare;$('fit').onclick=fit;$('save').onclick=saveDialog;$('menu').onclick=scenarioMenu;
$('sources').onclick=()=>{sourcesDialog();const issues=diocese.geometryIssues||[];$('dialog-body').insertAdjacentHTML('beforeend',`<div class="dialog-copy"><h3>Kontrollerad geometrikvalitet</h3><p>${issues.length?issues.map(f=>`${esc(f.name)} (${esc(f.id)}): självskärning i originalets geometri. Kontraktstillhörighet kan ändras, men gränsredigering är spärrad tills källfelet rättats.`).join(' '):'Inga ogiltiga församlingspolygoner hittades i detta stift vid GEOS-kontrollen.'}</p><p>${manifest.precisionRepairs?.length||0} numeriska fel efter omprojicering har reparerats för landet som helhet, med försumbar ytändring under 1e-12 kvadratgrader per område. Originalets källfel har bevarats och redovisas separat.</p></div>`);};
$('layers-button').onclick=()=>{const open=$('layer-panel').hidden;$('layer-panel').hidden=!open;$('layers-button').setAttribute('aria-expanded',String(open));};
for(const id of ['layer-parishes','layer-contracts','layer-diocese'])$(id).onchange=updateLayers;
$('layer-base').onchange=()=>{const requested=$('layer-base').checked;$('layer-base').checked=backgroundAllowed;$('map-background-choice-proxy').value=requested?'osm':'none';$('map-background-choice-proxy').dispatchEvent(new Event('change'));};
window.GISLabPrivacy?.bindLeafletChoices(map,$('map-background-choice-proxy'),background=>{backgroundAllowed=background==='osm';$('layer-base').checked=backgroundAllowed;updateLayers();});
$('parish-opacity').oninput=()=>{const value=$('parish-opacity').value;$('parish-opacity-value').value=`${value} %`;$('parish-opacity').setAttribute('aria-valuetext',`${value} procent`);updateLayers();};
$('undo').onclick=()=>{if(!undo.length)return;cancelDraw();redo.push(state);state=undo.pop();selected.clear();$('scenario-name').value=state.name;refresh();renderGeometry();scheduleSave();toast('Ändringen är ångrad.');};
$('redo').onclick=()=>{if(!redo.length)return;cancelDraw();undo.push(state);state=redo.pop();selected.clear();$('scenario-name').value=state.name;refresh();renderGeometry();scheduleSave();};
$('scenario-name').onchange=()=>{state={...state,name:$('scenario-name').value.trim()||'Namnlöst scenario'};$('scenario-name').value=state.name;scheduleSave();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawAction)cancelDraw();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state){clearTimeout(saveTimer);saveDraft(state);}});
window.addEventListener('pagehide',()=>{if(state)saveDraft(state);});

try{
  [manifest,stiftData,officialContracts]=await Promise.all([getJSON('data/manifest.json'),getJSON('data/stift.geojson'),getJSON('data/kontrakt.geojson')]);
  $('diocese').innerHTML=[...manifest.dioceses].sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  await loadDiocese('07');
}catch(err){setLoading(true,'Kartan kunde inte startas');$('loading').querySelector('p').textContent=`${err.message} Ladda om sidan för att försöka igen.`;}
