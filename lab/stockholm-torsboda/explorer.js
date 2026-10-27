'use strict';
const el=id=>document.getElementById(id);
const format=(n,d=0)=>new Intl.NumberFormat('sv-SE',{maximumFractionDigits:d}).format(n);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const empty={type:'FeatureCollection',features:[]};
const populationColor=['interpolate',['linear'],['get','density'],1,'#165b79',50,'#27b6c1',200,'#b1df8a',500,'#ffc467',1000,'#ee7051'];
let map,worker,meta,marker,popup,selection,power,lastPopup;
let center=[18.0717,59.3267],requestedRadius=9416.2,revision=0,rpcId=0,pending=new Map(),busy=true,picking=false,pinned=false,timer;
let barLimit=innerWidth<=760||(navigator.deviceMemory&&navigator.deviceMemory<=4)?35000:80000;
let deviceLimited=barLimit<80000,performanceLimited=false;
let comparisonMode='torsboda',torsbodaMW=0,animationFrame=0,animationRunning=false;
let areaType='municipality',savedCircle=null;
let targetMW=2000,landProgress=0,loopTimer=0,loopCount=0,playbackStatus='ready',durationOverride=false,settingsHidden=true,lastLitGroups=-1;
const defaultDatacenterPosition=[18.123,59.325];
let cycle=null,presentationCameraActive=true,presentationResizeTimer,resumeWhenVisible=false;
let flowRouteKey='',flowDashStep=-1,flowRouteVisible=null;
const presentationCamera={center:[18.04,59.295],zoom:11.15,pitch:57,bearing:0};
let sitePosition=StockholmComparison.site.position.slice(),datacenterMarker,datacenterPosition=defaultDatacenterPosition.slice(),datacenterPlaced=false,pickingDatacenter=false,draggingDatacenter=false,sceneRevision=0,scene=null;
const animationTone=new AnimationTone();
const settingTabs=['area','power','playback','view'];
const currentHectares=()=>Math.max(0,(validNumber('hectares')||214)*landProgress);
window.stockholmReady=false;
const state=()=>{window.stockholmState={busy,revision,center:center.slice(),barLimit,selection:selection?{area:selection.area,cellSize:selection.cellSize,areaMeta:selection.areaMeta,stats:selection.stats,groups:selection.groups,radius:selection.radius,limits:selection.limits,computeMs:selection.computeMs,renderMs:selection.renderMs}:null,power,scene,sound:animationTone.snapshot(),comparison:{mode:comparisonMode,torsbodaMW,targetMW,hectares:scene?.hectares??currentHectares(),targetHectares:validNumber('hectares'),datacenterPosition:datacenterPosition.slice(),datacenterHeight:validNumber('datacenter-height'),settingsHidden,playbackStatus,loopCount,durationMs:(validNumber('duration')||60)*1000,loop:el('loop-playback').checked,watts:validNumber('watts'),animationRunning,overflowMW:selection?StockholmComparison.balance(selection.stats.population,validNumber('watts')||1022,torsbodaMW).overflowMW:0}};};
function status(text,error=false){el('status').textContent=text;el('status').hidden=!text;el('status').classList.toggle('error',error);}
function fail(error){console.error(error);busy=false;status(error.message||'Kartan kunde inte uppdateras. Ladda om sidan.',true);state();}
function rpc(type,options){const id=++rpcId;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,type,options});});}
function validNumber(id){const input=el(id);return input.checkValidity()&&Number.isFinite(input.valueAsNumber)?input.valueAsNumber:null;}
function groupTarget(){const size=validNumber('group-size'),watts=validNumber('watts');return size!==null&&watts!==null?(el('group-unit').value==='mw'?size*1e6/watts:size):null;}
function updateEquivalence(){const watts=validNumber('watts');if(watts)el('equivalence').textContent=`1 MW ≈ ${format(1e6/watts)} invånare vid ${format(watts)} W/person`;}
function fitArea(includeDatacenter=false){
  if(!selection)return;
  const desktop=innerWidth>760,rail=document.querySelector('.right-rail').getBoundingClientRect();
  const padding={top:desktop?65:settingsHidden?65:180,bottom:desktop?90:80,left:desktop?(settingsHidden?50:400):16,right:Math.min(innerWidth*.45,innerWidth-rail.left+25)};
  let bounds=selection.bounds;
  if(includeDatacenter===true){const object=StockholmGeo.bounds(DatacenterGeometry.square(datacenterPosition,validNumber('hectares')||214));bounds=[[Math.min(bounds[0][0],object[0][0]),Math.min(bounds[0][1],object[0][1])],[Math.max(bounds[1][0],object[1][0]),Math.max(bounds[1][1],object[1][1])]];}
  map.fitBounds(bounds,{padding,pitch:map.getPitch(),bearing:map.getBearing(),duration:reducedMotion?0:650});
}
function setSettingsHidden(hidden,focus=true){
  settingsHidden=hidden;document.body.classList.toggle('settings-hidden',hidden);el('settings-reopen').hidden=!hidden;
  if(!hidden){document.querySelector('.panel').classList.remove('panel-compact');el('panel-toggle').textContent='Stäng panelen';el('panel-toggle').setAttribute('aria-expanded','true');}
  else if(focus)el('settings-reopen').focus({preventScroll:true});
  updateEnergyFlow();state();
}
function setView(is3D){presentationCameraActive=false;map.easeTo({pitch:is3D?55:0,duration:reducedMotion?0:450});}
function moveDatacenter(position){datacenterPlaced=true;datacenterPosition=position.slice();updateSupply();}
function setDatacenterPicking(value){setPicking(false);pickingDatacenter=value;el('place-datacenter').setAttribute('aria-pressed',String(value));document.body.classList.toggle('datacenter-picking',value);status(value?'Klicka där datacentret ska placeras. Esc avbryter.':'');}
function setPicking(value){picking=value;el('pick-center').setAttribute('aria-pressed',String(value));el('pick-center').classList.toggle('active',value);el('pick-center').textContent=value?'Klicka på kartan…':'Välj på kartan';document.body.classList.toggle('map-picking',value);if(value)status('Klicka där mittpunkten ska ligga. Esc avbryter.');else if(!busy)status('');}
function selectTab(name){for(const tab of settingTabs){const chosen=tab===name;el('tab-'+tab).setAttribute('aria-selected',String(chosen));el('tab-'+tab).tabIndex=chosen?0:-1;el(tab+'-settings').hidden=!chosen;}}
function sourceReady(){return new Promise((resolve,reject)=>{
  const names=['population','masks','boundary'];
  const done=()=>names.every(name=>map.getSource(name)&&map.isSourceLoaded(name));
  const cleanup=()=>{map.off('sourcedata',check);clearTimeout(timeout);};
  const check=()=>{if(done()){cleanup();resolve();}};
  const timeout=setTimeout(()=>{cleanup();reject(new Error('Kartans uppdatering tog för lång tid. Prova en mindre radie.'));},30000);
  map.on('sourcedata',check);check();
});}
function notices(){
  if(!selection)return;const messages=[];
  if(selection.limits.center)messages.push('Mittpunkten flyttades till gränsen, 15 km från slottet.');
  if(selection.area==='circle'&&(selection.limits.bars||performanceLimited))messages.push(`Området begränsas till cirka ${format(barLimit)} staplar för responsiv navigering.`);
  if(selection.limits.population)messages.push('Det önskade invånarantalet ryms inte inom 25 km från denna mittpunkt. Största möjliga område visas.');
  if(selection.limits.groups)messages.push('Antalet grupper begränsas till cirka 800. Faktiska grupper blir därför större än målet.');
  el('limit-notice').hidden=!messages.length;el('limit-notice').textContent=messages.join(' ');
}
function updateUI(){
  const s=selection.stats,municipal=selection.area==='municipality',regional=Boolean(selection.areaMeta),administrative=selection.area!=='circle';
  el('total').textContent=format(s.population);el('radius').textContent=regional?String(selection.areaMeta.municipalities.length):municipal?'0180':format(selection.radius/1000,1)+' km';
  el('area-metric-label').textContent=regional?'kommuner':municipal?'kommunkod':'vald radie';
  el('area-description').textContent=regional?'Originalrutor: 100 × 100 m. Oförändrade befolkningsvärden.':municipal?'100-metersrutor inom Stockholms kommun.':'100-metersrutor. Flyttbart område.';
  el('circle-settings').hidden=administrative;el('municipality-help').hidden=!municipal;
  el('regional-help').hidden=!regional;el('regional-members').hidden=!regional;
  if(regional){
    const area=selection.areaMeta,county=selection.area==='county';
    el('regional-help').textContent=(county?'Hela Stockholms län – samtliga 26 kommuner.':'Stockholms stad och de 10 kommuner som delar kommungräns med staden, även över vatten.')+' Befolkning 2021 · kommungränser 2026. Varje stapel är en originalruta på 100 × 100 m med oförändrat invånarantal. Hela området ingår även på mobil. Samma W/person-antagande används i hela området. Saknade värden räknas inte som noll; rutsumman är en skattning.';
    el('regional-members-title').textContent=`Kommuner som ingår (${area.municipalities.length})`;
    el('regional-members-list').textContent=area.municipalities.map(m=>m.name).join(', ')+'.';
  }
  marker.getElement().hidden=administrative;marker.setDraggable(!administrative);
  map.setPaintProperty('boundary','line-dasharray',administrative?[1,0]:[3,3]);
  if(!administrative){el('radius-control').value=String(selection.radius/1000);el('radius-value').value=format(selection.radius/1000,1)+' km';}
  el('area-counts').textContent=regional?`${format(s.cells)} originalrutor (100 m) · ${format(s.populated)} originalstaplar · ${format(s.nodata)} rutor utan data`:`${format(s.cells)} rutor · ${format(s.populated)} staplar · ${format(s.nodata)} rutor utan data`;
  el('center-name').textContent=StockholmGeo.inverse(meta.center,center).distance<1?'Kungliga slottet':`${format(center[1],4)}° N, ${format(center[0],4)}° E`;
  el('population-target').max=String(Math.max(1,selection.maxReachablePopulation));
  el('group-summary').textContent=`${format(selection.groups.length)} grupper · mål ${format(selection.targetGroupPopulation)} invånare per grupp`;
  const populations=selection.groups.map(g=>g.population),watts=validNumber('watts')||1022;
  el('group-range').textContent=populations.length?`Faktisk storlek: ${format(Math.min(...populations))}–${format(Math.max(...populations))} invånare (${format(Math.min(...populations)*watts/1e6,2)}–${format(Math.max(...populations)*watts/1e6,2)} MW).`:'Inga befolkade rutor i området.';
  el('performance').textContent=administrative?`Senaste uppdatering: ${format(selection.renderMs/1000,1)} s. Hela området visas med ${format(s.populated)} staplar.`:`Senaste uppdatering: ${format(selection.renderMs/1000,1)} s. Gräns: ${format(barLimit)} staplar${deviceLimited?' på denna enhet':''}.`;
  updateEquivalence();notices();
  if(!durationOverride)el('duration').value=String(StockholmComparison.defaultDuration(s.population));
}
function updateSupply(){
  if(!selection)return;const watts=validNumber('watts');if(watts===null)return;
  const balance=StockholmComparison.balance(selection.stats.population,watts,torsbodaMW);
  const demand=balance.demandMW,available=comparisonMode==='torsboda'?balance.availableMW:demand*Number(el('supply-control').value)/1000;
  power=StockholmModel.supply(selection.groups,watts,available);
  const hectares=currentHectares(),finishMW=Math.min(targetMW,StockholmComparison.exhaustionMW(selection.groups,watts)),growth=Math.min(1,torsbodaMW/Math.max(.000001,finishMW)),landGrowth=Math.min(1,landProgress*targetMW/Math.max(.000001,finishMW));
  scene={revision:++sceneRevision,mw:torsbodaMW,hectares,targetHectares:validNumber('hectares')||214,height:(validNumber('datacenter-height')??100)*landGrowth**.7,growth,maxHeight:validNumber('datacenter-height')??100,position:datacenterPosition.slice(),litPopulation:power.litPopulation,darkPopulation:power.darkPopulation,availableMW:available};
  if(lastLitGroups!==power.litGroups){map.setPaintProperty('population-bars','fill-extrusion-color',['case',['<',['get','rank'],power.litGroups],populationColor,'#263440']);lastLitGroups=power.litGroups;}
  el('supply-value').value=format(power.availableMW,2)+' MW';el('supply-control').setAttribute('aria-valuetext',`${format(power.availableMW,2)} MW, ${format(power.litPercent,1)} procent av invånarna i tända rutor`);
  el('lit-people').textContent=format(power.litPopulation);el('stat-remaining-mw').textContent=format(available,1)+' MW';
  el('stat-remaining-label').textContent=selection.area==='municipality'?'Kvarvarande effekt i Stockholm (modell)':'Kvarvarande effekt i valt område (modell)';
  el('stat-torsboda-mw').textContent=format(torsbodaMW,1)+' MW';el('stat-hectares').textContent=format(scene.hectares,1)+' ha';
  document.querySelector('.simulation').dataset.sceneRevision=String(scene.revision);
  updatePlaybackLabels();
  updateDatacenterScene();
  if(lastPopup)renderPopup();state();
}
function updateEnergyFlow(){
  if(!map)return;
  const svg=el('energy-flow'),origin=map.project(center),object=map.project(datacenterPosition),point=map.project(sitePosition),rail=document.querySelector('.right-rail').getBoundingClientRect();
  const desktop=innerWidth>760,left=desktop&&!settingsHidden?400:28,right=Math.max(left+100,rail.left-35),top=desktop?65:190,bottom=innerHeight-85;
  const reference=StockholmGeo.inverse(map.getCenter().toArray(),sitePosition),angle=(reference.bearing-map.getBearing())*Math.PI/180;
  const visible=map.getBounds().contains(sitePosition)&&point.x>=left&&point.x<=right&&point.y>=top&&point.y<=bottom;
  let anchor=point;
  if(!visible){const cx=(left+right)/2,cy=(top+bottom)/2,dx=Math.sin(angle),dy=-Math.cos(angle),t=Math.min(Math.abs((right-left)/2/(dx||1e-9)),Math.abs((bottom-top)/2/(dy||1e-9)));anchor={x:cx+dx*t,y:cy+dy*t};}
  const indicator=el('torsboda-direction');indicator.hidden=visible&&animationRunning;indicator.style.left=anchor.x+'px';indicator.style.top=anchor.y+'px';
  el('direction-arrow').hidden=visible;el('direction-arrow').style.transform=`rotate(${reference.bearing-map.getBearing()}deg)`;
  const compass=['N','NO','O','SO','S','SV','V','NV'][Math.round((reference.bearing+360)%360/45)%8];
  el('direction-label').textContent=visible?'Torsboda · samma datacenter':`Torsboda · ${format(reference.distance/1000)} km ${compass}`;
  updateGeographicFlow();
  const endX=object.x,endY=object.y;
  svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  svg.toggleAttribute('hidden',comparisonMode!=='torsboda'||torsbodaMW===0||origin.x<0||origin.x>innerWidth||origin.y<0||origin.y>innerHeight);
  svg.querySelectorAll('path').forEach((path,i)=>{
    const x=origin.x+(i-1)*75,y=origin.y+Math.abs(i-1)*35;
    path.setAttribute('d',`M ${x} ${y} Q ${(x+endX)/2} ${Math.min(y,endY)-60-i*12} ${endX} ${endY}`);
  });
}
function updateGeographicFlow(){
  const source=map.getSource('torsboda-flow-route');if(!source)return;
  const key=datacenterPosition.join(',')+'>'+sitePosition.join(',');
  if(key!==flowRouteKey){
    source.setData({type:'Feature',properties:{from:'illustrerat datacenter',to:'Torsboda'},geometry:StockholmFlow.route(datacenterPosition,sitePosition)});flowRouteKey=key;
  }
  const visible=comparisonMode==='torsboda'&&torsbodaMW>0;
  if(visible!==flowRouteVisible){map.setLayoutProperty('torsboda-flow-track','visibility',visible?'visible':'none');map.setLayoutProperty('torsboda-flow-particles','visibility',visible?'visible':'none');flowRouteVisible=visible;}
  if(animationRunning&&playbackStatus==='playing'&&!reducedMotion){
    const step=Math.floor(performance.now()/50)%16;
    if(step!==flowDashStep){map.setPaintProperty('torsboda-flow-particles','line-dasharray',StockholmFlow.dash(step/2));flowDashStep=step;}
  }
}
function updateDatacenterScene(){
  const hectares=scene.hectares,properties={revision:scene.revision,mw:scene.mw,total_hectares:hectares,height:scene.height,heat:scene.growth};
  const objectFeatures=hectares>0?[{type:'Feature',properties:{...properties,kind:'datacenter',hectares},geometry:DatacenterGeometry.square(datacenterPosition,hectares)}]:[];
  const siteFeatures=hectares>0?[{type:'Feature',properties:{...properties,kind:'datacenter-copy',hectares},geometry:DatacenterGeometry.square(sitePosition,hectares)}]:[];
  map.getSource('datacenter-object').setData({type:'FeatureCollection',features:objectFeatures});map.getSource('torsboda-site').setData({type:'FeatureCollection',features:siteFeatures});
  const rims=hectares>0?[datacenterPosition,sitePosition].map((position,index)=>({type:'Feature',properties:{...properties,kind:index?'torsboda-rim':'datacenter-rim',hectares,base:Math.max(0,scene.height-.8),height:scene.height+.5},geometry:DatacenterGeometry.rim(position,hectares)})):[];
  map.getSource('datacenter-rims').setData({type:'FeatureCollection',features:rims});
  if(datacenterMarker){datacenterMarker.setLngLat(datacenterPosition);const element=datacenterMarker.getElement();element.style.setProperty('--heat',String(torsbodaMW/2000));element.querySelector('span').textContent=hectares>0?`Datacenter · ${format(hectares,1)} ha`:'Dra datacentret';}
  el('energy-flow').style.opacity=String(.2+.65*torsbodaMW/2000);el('torsboda-control').value=String(torsbodaMW);el('torsboda-value').value=format(torsbodaMW,1)+' MW';
  el('land-progress').value=String(landProgress*1000);el('land-value').value=format(hectares,1)+' ha';
  for(const button of document.querySelectorAll('.scenario-buttons button'))button.setAttribute('aria-pressed',String(Number(button.dataset.mw)===targetMW));
  updateEnergyFlow();
}
function updateActivationPrompt(){
  el('activate-presentation').hidden=!animationRunning||!el('sound-enabled').checked||animationTone.snapshot().contextState==='running';
}
function synchronizeAudio(){
  const sound=animationTone.sync(el('sound-enabled').checked,animationRunning&&!document.hidden,Number(el('sound-volume').value)/100,scene?.growth||0,.12);
  el('volume-value').value=el('sound-volume').value+' %';el('sound-status').textContent=sound.contextState!=='running'&&el('sound-enabled').checked?'100 Hz · aktiveras med ett klick':sound.targetGain>0?'100 Hz · crescendo följer datacentret':'100 Hz · tyst';
  window.stockholmSound=sound;updateActivationPrompt();
}
function unlockAudio(){
  if(el('sound-enabled').checked)animationTone.unlock().then(()=>{synchronizeAudio();state();}).catch(error=>{el('sound-status').textContent=error.message;updateActivationPrompt();});
}
function togglePresentationFullscreen(){
  const request=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();
  if(request)request.catch(()=>{el('presentation-help').textContent='Helskärm kunde inte aktiveras här. Använd webbläsarens helskärmsläge.';});
}
function activatePresentation(){unlockAudio();if(!document.fullscreenElement)togglePresentationFullscreen();}
function presentationView(duration=0){
  presentationCameraActive=true;
  if(selection?.area!=='municipality'){map.jumpTo({pitch:presentationCamera.pitch,bearing:presentationCamera.bearing});fitArea(true);return;}
  const scale=Math.min(innerWidth/1600,innerHeight/1000);
  map.easeTo({...presentationCamera,center:presentationCamera.center.slice(),zoom:presentationCamera.zoom+Math.log2(scale),padding:0,duration:reducedMotion?0:duration});
}
function updatePlaybackLabels(){
  if(datacenterMarker){datacenterMarker.getElement().hidden=animationRunning;datacenterMarker.setDraggable(!animationRunning);}
  document.body.classList.toggle('animation-playing',animationRunning&&playbackStatus==='playing');
  synchronizeAudio();
  const labels={starting:`Allt tänt · varv ${loopCount}`,ready:'Redo att spela',playing:`Spelar · varv ${loopCount}`,waiting:`Varv ${loopCount} klart · startar om`,paused:'Pausad',stopped:'Stoppad',complete:'Valt scenario är färdigt',empty:'Hela det valda området är släckt'};
  const text=labels[playbackStatus]||labels.ready;
  if(el('animation-status').textContent!==text)el('animation-status').textContent=text;
  el('scenario-play').textContent=animationRunning?'Pausa':reducedMotion?'Visa nästa steg':'Spela släckningen';el('scenario-play').setAttribute('aria-pressed',String(animationRunning));
  updateEnergyFlow();
}
function pauseScenario(reason='paused',preserveCycle=false){
  resumeWhenVisible=false;
  if(animationRunning&&cycle)cycle.elapsed=performance.now()-cycle.started;
  if(!preserveCycle)cycle=null;
  cancelAnimationFrame(animationFrame);clearTimeout(loopTimer);animationFrame=0;loopTimer=0;animationRunning=false;playbackStatus=reason;updatePlaybackLabels();state();
}
function suspendForVisibility(){const resume=animationRunning||resumeWhenVisible;pauseScenario('paused',true);resumeWhenVisible=resume;}
function setTorsboda(mw,progress){torsbodaMW=Math.max(0,Math.min(2000,mw));if(progress!==undefined)landProgress=Math.max(0,Math.min(1,progress));updateSupply();}
function setComparisonMode(mode){
  pauseScenario();comparisonMode=mode;
  for(const [id,active] of [['mode-torsboda',mode==='torsboda'],['mode-free',mode==='free']])el(id).setAttribute('aria-pressed',String(active));
  el('torsboda-controls').hidden=mode!=='torsboda';el('free-controls').hidden=mode!=='free';updateSupply();
}
function playScenario(automatic=false){
  if(busy)return;if(animationRunning){pauseScenario('paused',true);return;}
  unlockAudio();
  targetMW=validNumber('target-mw');if(targetMW===null||validNumber('duration')===null||validNumber('hectares')===null)return;
  if(comparisonMode!=='torsboda')setComparisonMode('torsboda');
  if(!selection.stats.population){pauseScenario('empty');return;}
  if(reducedMotion){
    if(automatic){pauseScenario('ready');return;}
    if(torsbodaMW>=targetMW||power.litPopulation===0)setTorsboda(0,0);
    const next=Math.min(targetMW,[650,1000,2000].find(mw=>mw>torsbodaMW)??targetMW),emptyAt=StockholmComparison.exhaustionMW(selection.groups,validNumber('watts'));
    setTorsboda(Math.min(next,emptyAt),Math.min(next,emptyAt)/targetMW);pauseScenario(power.litPopulation===0?'empty':'complete');return;
  }
  popup.remove();lastPopup=null;pinned=false;setDatacenterPicking(false);
  setSettingsHidden(true,!automatic);animationRunning=true;
  if(!cycle)loopCount=0;
  beginCycle(Boolean(cycle));
}
function beginCycle(resume=false){
  if(!animationRunning)return;
  if(!resume){
    loopCount++;cycle={duration:(validNumber('duration')||60)*1000,targetMW,emptyAt:StockholmComparison.exhaustionMW(selection.groups,validNumber('watts')),elapsed:0};
    playbackStatus='starting';setTorsboda(0,0);
  }
  cycle.started=performance.now()-cycle.elapsed;
  let previous=-Infinity;
  function frame(now){
    if(!animationRunning)return;if(document.hidden){suspendForVisibility();return;}
    const step=StockholmComparison.cycleFrame(cycle.targetMW,now-cycle.started,cycle.duration,cycle.emptyAt);
    if(step.phase==='complete'){
      if(el('loop-playback').checked){beginCycle();return;}
      setTorsboda(step.mw,step.landProgress);pauseScenario('complete');return;
    }
    if(now-previous>=50||playbackStatus!==step.phase){playbackStatus=step.phase;setTorsboda(step.mw,step.landProgress);previous=now;}
    animationFrame=requestAnimationFrame(frame);
  }
  animationFrame=requestAnimationFrame(frame);updatePlaybackLabels();state();
}
function renderPopup(){
  if(!lastPopup)return;const {feature,lngLat}=lastPopup,p=feature.properties;
  let html;
  if(feature.layer.id==='population-bars'){
    const group=selection.groups[p.rank],lit=p.rank<power.litGroups;
    html=`<strong class="popup-number">${format(p.population)} invånare</strong><span>${selection.cellSize} × ${selection.cellSize} meter · 2021${selection.cellSize>100?' · summerade 100-metersrutor':''}</span><br><span class="popup-meta">${p.grid_id}</span>`;
    if(group)html+=`<span class="popup-group">Grupp ${Number(p.rank)+1} · <span class="popup-state">${lit?'Tänd':'Släckt'}</span><br>${format(group.population)} invånare · ${format(group.population*validNumber('watts')/1e6,2)} MW<br>${format(group.areaKm2,2)} km² · ${format(group.distance/1000,1)} km från mittpunkten<br>Avvikelse från gruppmål: ${group.deviation>=0?'+':''}${format(group.deviation)} invånare</span>`;
  }else html=`<strong class="popup-number">${p.status<0?'Data saknas':'0 invånare'}</strong><span>${selection.cellSize}-metersrutor · 2021</span>`;
  popup.setLngLat(lngLat).setHTML(html);
  if(!popup.isOpen())popup.addTo(map);
}
function showCell(event,pin){if(animationRunning||picking||pickingDatacenter||draggingDatacenter||busy||!event.features?.length||(!pin&&pinned))return;if(map.queryRenderedFeatures(event.point,{layers:['datacenter-body']}).length)return;lastPopup={feature:event.features[0],lngLat:event.lngLat};pinned=pin;renderPopup();}
async function requestSelection(extra={}){
  const target=groupTarget();if(target===null)return;
  pauseScenario();
  const current=++revision;busy=true;window.stockholmReady=false;state();status('Beräknar område och grupper…');el('supply-control').disabled=true;
  const began=performance.now();
  try{
    const message=await rpc('select',{center,radius:requestedRadius,area:areaType,targetGroupPopulation:target,barLimit,...extra});if(current!==revision)return;
    const result=message.result;center=result.center;marker.setLngLat(center);popup.remove();lastPopup=null;pinned=false;
    if(!datacenterPlaced)datacenterPosition=defaultDatacenterPosition.slice();
    // Drop large geometry references once MapLibre owns the new sources.
    map.getSource('population').setData(result.bars);map.getSource('masks').setData(result.masks);map.getSource('boundary').setData(result.boundary);
    await sourceReady();if(current!==revision)return;
    selection={...result,bars:undefined,masks:undefined,boundary:undefined,renderMs:performance.now()-began};
    // A slow geometry refresh lowers the next selection's geometry budget.
    if(selection.area==='circle'&&selection.renderMs>6000&&selection.stats.populated>20000){
      const next=Math.max(20000,Math.min(barLimit,Math.floor(selection.stats.populated*4000/selection.renderMs)));
      if(next<barLimit){barLimit=next;performanceLimited=true;if(selection.stats.populated>barLimit){requestSelection({...extra,fit:extra.fit});return;}}
    }
    if(selection.area==='circle')requestedRadius=selection.radius;updateUI();updateSupply();
    if(extra.fit||!window.stockholmFirstReady){if(selection.area==='municipality')presentationView();else{map.jumpTo({pitch:presentationCamera.pitch,bearing:presentationCamera.bearing});fitArea();}}
    busy=false;window.stockholmFirstReady=true;window.stockholmReady=true;el('supply-control').disabled=false;
    for(const node of document.querySelectorAll('input,select,button'))node.disabled=false;
    status(picking?'Klicka där mittpunkten ska ligga. Esc avbryter.':'');state();
  }catch(error){if(current===revision)fail(error);}
}
function schedule(extra={}){clearTimeout(timer);timer=setTimeout(()=>requestSelection(extra),220);}
async function restore(){
  pauseScenario('ready');torsbodaMW=0;landProgress=0;loopCount=0;targetMW=2000;durationOverride=false;datacenterPlaced=false;el('datacenter-height').value='100';el('sound-volume').value='100';el('sound-enabled').checked=true;setDatacenterPicking(false);el('target-mw').value='2000';el('hectares').value='214';el('hectares-preset').value='214';el('loop-playback').checked=true;
  areaType='municipality';savedCircle=null;el('area-type').value='municipality';
  setPicking(false);center=meta.center.slice();requestedRadius=meta.default_radius_m;
  el('watts').value=String(StockholmComparison.presets.low);el('assumption-preset').value=String(StockholmComparison.presets.low);el('group-unit').value='people';configureGroupInput(4000);el('supply-control').value='1000';el('height').value='1';el('height-value').value='1×';el('population-target').value='1000000';setComparisonMode('torsboda');
  map.setPaintProperty('population-bars','fill-extrusion-height',['*',['get','density'],1]);selectTab('area');setSettingsHidden(true);await requestSelection({fit:true});if(window.stockholmReady)playScenario(true);
}
function configureGroupInput(value){const input=el('group-size'),mw=el('group-unit').value==='mw';input.min=mw?'0.1':'100';input.max=mw?'100':'1000000';input.step=mw?'0.1':'1';input.value=String(value??(mw?1:4000));}
async function start(){
  if(typeof maplibregl==='undefined')throw new Error('Kartbiblioteket kunde inte läsas. Ladda om sidan.');
  worker=new Worker('population-worker.js');worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.type==='error'?p.reject(new Error(data.message)):p.resolve(data);};
  worker.onerror=()=>{for(const p of pending.values())p.reject(new Error('Befolkningsberäkningen kunde inte starta. Prova att ladda om sidan.'));pending.clear();};
  const initialized=rpc('init');
  map=new maplibregl.Map({container:'map',center,zoom:11.15,pitch:57,bearing:-22.5,minZoom:5,maxZoom:18,maxPitch:75,attributionControl:true,canvasContextAttributes:{antialias:true},style:{version:8,sources:{basemap:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#0a1522'}},{id:'basemap',type:'raster',source:'basemap',paint:{'raster-opacity':.72,'raster-saturation':-.9,'raster-brightness-max':.42}}]}});
  window.stockholmMap=map;map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-left');map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
  map.on('error',event=>{if(event.sourceId==='basemap'||event.error?.message?.includes('tile.openstreetmap.org'))el('tile-warning').hidden=false;else console.error(event.error);});
  const styled=new Promise(resolve=>map.once('style.load',resolve));
  const [init]=await Promise.all([initialized,styled]);meta=init.meta;
  for(const name of ['population','masks','boundary'])map.addSource(name,{type:'geojson',data:empty,maxzoom:16,tolerance:0});
  map.addLayer({id:'cell-mask',type:'fill',source:'masks',paint:{'fill-color':['case',['<',['get','status'],0],'#949aaa','#37535a'],'fill-opacity':.16}});
  map.addLayer({id:'population-bars',type:'fill-extrusion',source:'population',paint:{'fill-extrusion-color':populationColor,'fill-extrusion-color-transition':{duration:0},'fill-extrusion-height':['*',['get','density'],1],'fill-extrusion-base':0,'fill-extrusion-opacity':.96,'fill-extrusion-vertical-gradient':true}});
  map.addLayer({id:'boundary',type:'line',source:'boundary',paint:{'line-color':'#82c7d2','line-width':1.5,'line-dasharray':[3,3],'line-opacity':.85}});map.setLight({anchor:'viewport',color:'#fff4dc',intensity:.45,position:[1.5,210,35]});
  map.addSource('torsboda-flow-route',{type:'geojson',data:empty,tolerance:0,maxzoom:16});
  map.addLayer({id:'torsboda-flow-track',type:'line',source:'torsboda-flow-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffc078','line-width':1,'line-opacity':.12}});
  map.addLayer({id:'torsboda-flow-particles',type:'line',source:'torsboda-flow-route',paint:{'line-color':'#ffc078','line-width':1.5,'line-opacity':.8,'line-dasharray':StockholmFlow.dash(0),'line-dasharray-transition':{duration:0}}});
  for(const [prefix,source] of [['torsboda','torsboda-site'],['datacenter','datacenter-object']]){
    map.addSource(source,{type:'geojson',data:empty,tolerance:0});
    map.addLayer({id:prefix+'-glow',type:'line',source,paint:{'line-color':'#e8b75b','line-opacity':['*',['get','heat'],.8],'line-width':['interpolate',['linear'],['get','heat'],0,4,1,24],'line-blur':10,'line-opacity-transition':{duration:0}}});
    map.addLayer({id:prefix+'-body',type:'fill-extrusion',source,paint:{'fill-extrusion-color':'#08090d','fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true,'fill-extrusion-height-transition':{duration:0}}});
    map.addLayer({id:prefix+'-outline',type:'line',source,paint:{'line-color':'#e5bd71','line-width':1.2,'line-opacity':['interpolate',['linear'],['get','heat'],0,.2,1,.9]}});
  }
  map.addSource('datacenter-rims',{type:'geojson',data:empty,tolerance:0});
  map.addLayer({id:'datacenter-gold-rims',type:'fill-extrusion',source:'datacenter-rims',paint:{'fill-extrusion-color':['interpolate',['linear'],['get','heat'],0,'#715733',1,'#ffdf8b'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','base'],'fill-extrusion-opacity':.95,'fill-extrusion-height-transition':{duration:0},'fill-extrusion-base-transition':{duration:0},'fill-extrusion-color-transition':{duration:0}}});
  const objectButton=document.createElement('button');objectButton.className='datacenter-marker';objectButton.setAttribute('aria-label','Flytta det schematiska datacentret. Dra markören eller använd piltangenterna.');objectButton.innerHTML='<i></i><span>Dra datacentret</span>';
  datacenterMarker=new maplibregl.Marker({element:objectButton,draggable:true}).setLngLat(datacenterPosition).addTo(map);
  datacenterMarker.on('dragstart',()=>{draggingDatacenter=true;setDatacenterPicking(false);});datacenterMarker.on('drag',()=>moveDatacenter(datacenterMarker.getLngLat().toArray()));datacenterMarker.on('dragend',()=>{draggingDatacenter=false;moveDatacenter(datacenterMarker.getLngLat().toArray());});
  objectButton.addEventListener('keydown',event=>{const bearing={ArrowUp:0,ArrowRight:90,ArrowDown:180,ArrowLeft:270}[event.key];if(bearing===undefined)return;event.preventDefault();moveDatacenter(StockholmGeo.destination(datacenterPosition,bearing,event.shiftKey?1000:100));});
  const markerButton=document.createElement('button');markerButton.className='palace-marker';markerButton.setAttribute('aria-label','Flyttbar mittpunkt. Dra markören eller använd Välj på kartan.');markerButton.title='Dra för att flytta mittpunkten';
  marker=new maplibregl.Marker({element:markerButton,draggable:true}).setLngLat(center).addTo(map);
  marker.on('dragend',()=>{setPicking(false);center=marker.getLngLat().toArray();requestSelection();});
  popup=new maplibregl.Popup({closeButton:true,closeOnClick:false,maxWidth:'285px'});popup.on('close',()=>{pinned=false;lastPopup=null;});
  for(const layer of ['population-bars','cell-mask']){map.on('mousemove',layer,event=>{if(!picking)map.getCanvas().style.cursor='pointer';showCell(event,false);});map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';if(!pinned){popup.remove();lastPopup=null;}});map.on('click',layer,event=>showCell(event,true));}
  map.on('click',event=>{if(pickingDatacenter){setDatacenterPicking(false);moveDatacenter(event.lngLat.toArray());}else if(picking){setPicking(false);center=event.lngLat.toArray();requestSelection({fit:true});}});
  document.addEventListener('keydown',event=>{if(!event.repeat&&!event.target.closest('input,select,textarea,button,summary,a')){if(event.code==='Space'){event.preventDefault();playScenario();}else if(event.key.toLowerCase()==='m'){el('sound-enabled').checked=!el('sound-enabled').checked;unlockAudio();synchronizeAudio();state();}else if(event.key.toLowerCase()==='r')presentationView();else if(event.key.toLowerCase()==='f')togglePresentationFullscreen();}if(event.key==='Escape'){setPicking(false);setDatacenterPicking(false);if(animationRunning)pauseScenario('paused',true);}if(event.key==='Enter'&&pickingDatacenter&&event.target===map.getCanvas()){setDatacenterPicking(false);moveDatacenter(map.getCenter().toArray());}else if(event.key==='Enter'&&picking&&event.target===map.getCanvas()){setPicking(false);center=map.getCenter().toArray();requestSelection({fit:true});}});
  el('radius-control').addEventListener('input',event=>{requestedRadius=Number(event.target.value)*1000;el('radius-value').value=format(requestedRadius/1000,1)+' km';schedule({fit:true});});
  el('area-type').addEventListener('change',()=>{
    clearTimeout(timer);setPicking(false);
    const next=el('area-type').value;
    if(areaType==='circle'&&next!=='circle')savedCircle={center:center.slice(),radius:requestedRadius};
    if(next!=='circle')center=meta.center.slice();
    else if(savedCircle){center=savedCircle.center.slice();requestedRadius=savedCircle.radius;}
    areaType=next;requestSelection({fit:true});
  });
  el('population-form').addEventListener('submit',event=>{event.preventDefault();const target=validNumber('population-target');if(target!==null)requestSelection({targetPopulation:target,fit:true});});
  el('pick-center').addEventListener('click',()=>{const next=!picking;setDatacenterPicking(false);setPicking(next);if(picking&&innerWidth<=760){document.querySelector('.panel').classList.add('panel-compact');el('panel-toggle').textContent='Visa inställningar';el('panel-toggle').setAttribute('aria-expanded','false');}});
  el('palace').addEventListener('click',()=>{setPicking(false);center=meta.center.slice();requestSelection({fit:true});});el('fit-area').addEventListener('click',fitArea);
  for(const id of ['watts','group-size'])el(id).addEventListener('input',()=>{pauseScenario();if(id==='watts')el('assumption-preset').value=['1022','1635'].includes(el('watts').value)?el('watts').value:'custom';updateEquivalence();schedule();});
  el('assumption-preset').addEventListener('change',()=>{pauseScenario();if(el('assumption-preset').value==='custom'){el('watts').focus();return;}el('watts').value=el('assumption-preset').value;updateEquivalence();schedule();});
  el('group-unit').addEventListener('change',()=>{const previous=selection?.targetGroupPopulation||4000;configureGroupInput(el('group-unit').value==='mw'?Math.max(.1,Math.round(previous*(validNumber('watts')||1022)/1e5)/10):Math.round(previous));schedule();});
  el('supply-control').addEventListener('input',updateSupply);el('all-on').addEventListener('click',()=>{pauseScenario('ready');torsbodaMW=0;landProgress=0;loopCount=0;el('supply-control').value='1000';updateSupply();});
  el('mode-torsboda').addEventListener('click',()=>setComparisonMode('torsboda'));el('mode-free').addEventListener('click',()=>setComparisonMode('free'));
  el('torsboda-control').addEventListener('input',event=>{pauseScenario();setTorsboda(Number(event.target.value));});
  for(const button of document.querySelectorAll('.scenario-buttons button'))button.addEventListener('click',()=>{pauseScenario('ready');targetMW=Number(button.dataset.mw);el('target-mw').value=String(targetMW);setTorsboda(targetMW,1);});
  el('target-mw').addEventListener('input',()=>{pauseScenario();const value=validNumber('target-mw');if(value!==null)targetMW=value;updateSupply();});
  el('duration').addEventListener('input',()=>{pauseScenario();durationOverride=true;updateSupply();});
  el('loop-playback').addEventListener('change',state);
  el('hectares-preset').addEventListener('change',()=>{pauseScenario();if(el('hectares-preset').value==='custom'){el('hectares').focus();return;}el('hectares').value=el('hectares-preset').value;updateSupply();});
  el('hectares').addEventListener('input',()=>{pauseScenario();el('hectares-preset').value=['214','140'].includes(el('hectares').value)?el('hectares').value:'custom';updateSupply();});
  el('land-progress').addEventListener('input',event=>{pauseScenario();landProgress=Number(event.target.value)/1000;updateSupply();});
  el('scenario-play').addEventListener('click',()=>playScenario());el('scenario-stop').addEventListener('click',()=>pauseScenario('stopped'));if(reducedMotion)el('scenario-play').textContent='Visa nästa steg';
  el('datacenter-height').addEventListener('input',()=>updateSupply());
  el('activate-presentation').addEventListener('click',activatePresentation);
  el('presentation-fullscreen').addEventListener('click',togglePresentationFullscreen);
  el('presentation-view').addEventListener('click',()=>presentationView(reducedMotion?0:500));
  el('presentation-mute').addEventListener('click',()=>{el('sound-enabled').checked=!el('sound-enabled').checked;unlockAudio();synchronizeAudio();state();});
  document.addEventListener('fullscreenchange',()=>{el('presentation-fullscreen').textContent=document.fullscreenElement?'Lämna helskärm':'Helskärm';if(presentationCameraActive)presentationView();});
  const manualCamera=()=>{presentationCameraActive=false;clearTimeout(presentationResizeTimer);};
  for(const name of ['dragstart','rotatestart','pitchstart','zoomstart'])map.on(name,event=>{if(event.originalEvent)manualCamera();});
  map.on('movestart',event=>{if(event.originalEvent)manualCamera();});
  el('place-datacenter').addEventListener('click',()=>setDatacenterPicking(!pickingDatacenter));
  el('reset-datacenter').addEventListener('click',()=>{datacenterPlaced=false;datacenterPosition=defaultDatacenterPosition.slice();updateSupply();});
  el('show-datacenter').addEventListener('click',()=>{presentationCameraActive=false;map.flyTo({center:datacenterPosition,zoom:13,pitch:45,duration:reducedMotion?0:800});});
  el('show-torsboda').addEventListener('click',()=>{presentationCameraActive=false;const bounds=StockholmGeo.bounds(DatacenterGeometry.square(sitePosition,validNumber('hectares')||214));map.fitBounds(bounds,{padding:{left:innerWidth>760&&!settingsHidden?400:24,right:innerWidth>760?360:180,top:70,bottom:80},pitch:35,bearing:0,duration:reducedMotion?0:1000});});
  el('sound-enabled').addEventListener('change',()=>{unlockAudio();synchronizeAudio();state();});el('sound-volume').addEventListener('input',()=>{synchronizeAudio();state();});
  window.addEventListener('pagehide',()=>animationTone.close());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendForVisibility();else if(resumeWhenVisible&&!animationRunning){resumeWhenVisible=false;playScenario(true);}});
  map.on('move',updateEnergyFlow);map.on('moveend',state);window.addEventListener('resize',()=>{updateEnergyFlow();if(presentationCameraActive){clearTimeout(presentationResizeTimer);presentationResizeTimer=setTimeout(()=>presentationView(),100);}});
  el('height').addEventListener('input',event=>{const scale=Number(event.target.value);el('height-value').value=format(scale,1)+'×';map.setPaintProperty('population-bars','fill-extrusion-height',['*',['get','density'],scale]);});
  el('three-d').addEventListener('click',()=>setView(true));el('top-down').addEventListener('click',()=>setView(false));el('reset').addEventListener('click',restore);
  map.on('pitchend',()=>{const threeD=map.getPitch()>5;for(const [id,active] of [['three-d',threeD],['top-down',!threeD]]){el(id).classList.toggle('active',active);el(id).setAttribute('aria-pressed',String(active));}});
  el('settings-reopen').addEventListener('click',()=>setSettingsHidden(false));
  el('panel-toggle').addEventListener('click',()=>{if(document.querySelector('.panel').classList.contains('panel-compact'))setSettingsHidden(false);else setSettingsHidden(true);});
  if(innerWidth>760){document.querySelector('.panel').classList.remove('panel-compact');el('panel-toggle').textContent='Stäng panelen';el('panel-toggle').setAttribute('aria-expanded','true');}
  for(const tab of settingTabs){el('tab-'+tab).addEventListener('click',()=>selectTab(tab));el('tab-'+tab).addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=settingTabs[(settingTabs.indexOf(tab)+(event.key==='ArrowRight'?1:settingTabs.length-1))%settingTabs.length];selectTab(next);el('tab-'+next).focus();});}
  setSettingsHidden(true,false);await requestSelection({fit:true});
  playbackStatus='ready';updatePlaybackLabels();state();if(window.stockholmReady)playScenario(true);
}
start().catch(fail);
