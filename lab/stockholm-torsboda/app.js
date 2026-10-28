/* MapLibre fill-extrusion: https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/ */
'use strict';
const el = id => document.getElementById(id);
const number = value => new Intl.NumberFormat('sv-SE').format(value);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let map, metadata, popup, ready = false, pinned = false;
const color = ['interpolate', ['linear'], ['get','population'], 1,'#165b79',50,'#27b6c1',200,'#b1df8a',500,'#ffc467',1000,'#ee7051'];

async function readJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Kunde inte läsa ${path} (${response.status})`);
  return response.json();
}

function showError(error) {
  console.error(error);
  el('status').hidden = false;
  el('status').classList.add('error');
  el('status').textContent = 'Kartan kunde inte starta. Ladda om sidan och kontrollera att WebGL är aktiverat i webbläsaren.';
}

function reset() {
  map.fitBounds(metadata.bounds, {padding:{top:innerWidth>760?60:155,bottom:100,left:innerWidth>760?370:20,right:innerWidth>760?60:20},pitch:55,bearing:-18,duration:reducedMotion?0:900});
}

function setView(is3D) {
  map.easeTo({pitch:is3D?55:0,duration:reducedMotion?0:600});
  el('three-d').classList.toggle('active',is3D);
  el('top-down').classList.toggle('active',!is3D);
  el('three-d').setAttribute('aria-pressed',String(is3D));
  el('top-down').setAttribute('aria-pressed',String(!is3D));
}

function showCell(event, pin) {
  if (!event.features?.length) return;
  const feature = event.features[0];
  const value = feature.properties.population;
  const missing = feature.layer.id === 'nodata';
  if (!pin && pinned) return;
  popup.remove();
  popup = new maplibregl.Popup({closeButton:pin,closeOnClick:pin,maxWidth:'250px'});
  popup.setLngLat(event.lngLat).setHTML(`<strong class="popup-number">${missing?'Data saknas':number(value)+' invånare'}</strong><span>100 × 100 meter · 2021</span><br><span class="popup-meta">${feature.properties.grid_id}${missing?'':'<br>Uppskattat invånarantal'}</span>`).addTo(map);
  pinned = pin;
  if(pin) popup.on('close',()=>{pinned=false;});
}

async function start() {
  if (typeof maplibregl === 'undefined') throw new Error('Kartbiblioteket kunde inte läsas');
  [metadata] = await Promise.all([readJSON('metadata.json')]);
  el('total').textContent = number(metadata.population_total);
  el('radius').textContent = (metadata.radius_m/1000).toLocaleString('sv-SE',{maximumFractionDigits:1})+' km';
  el('data-counts').textContent = `${number(metadata.cells_populated)} befolkade rutor, ${number(metadata.cells_zero)} rutor med noll invånare och ${number(metadata.cells_nodata)} rutor utan data. Högsta värdet: ${number(metadata.population_max)} invånare i en ruta.`;
  map = new maplibregl.Map({
    container:'map',center:metadata.center,zoom:10.8,pitch:55,bearing:-18,minZoom:8,maxZoom:18,maxPitch:75,
    style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#0a1522'}}]},
    attributionControl:true,canvasContextAttributes:{antialias:true}
  });
  window.stockholmMap = map;
  window.GISLabPrivacy?.bindMapLibre(map,{'raster-opacity':.85,'raster-saturation':-.8,'raster-brightness-max':.55});
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
  map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-right');
  map.addControl(new maplibregl.FullscreenControl(),'top-right');
  map.on('error',e=>{
    console.error(e.error);
    if(e.sourceId==='basemap') el('tile-warning').hidden=false;
    else if(!ready) showError(e.error);
  });
  const dataPromise = Promise.all([readJSON('population.geojson'),readJSON('nodata.geojson'),readJSON('boundary.geojson')]);
  await new Promise(resolve=>map.once('load',resolve));
  const [population,nodata,boundary] = await dataPromise;
  map.addSource('population',{type:'geojson',data:population,maxzoom:16,tolerance:0});
  map.addSource('nodata',{type:'geojson',data:nodata,maxzoom:16,tolerance:0});
  map.addSource('boundary',{type:'geojson',data:boundary});
  map.addLayer({id:'nodata',type:'fill',source:'nodata',paint:{'fill-color':'#949aaa','fill-opacity':.25}});
  map.addLayer({id:'zero',type:'fill',source:'population',filter:['==',['get','population'],0],paint:{'fill-color':'#37535a','fill-opacity':.35}});
  map.addLayer({id:'population-bars',type:'fill-extrusion',source:'population',filter:['>', ['get','population'],0],paint:{'fill-extrusion-color':color,'fill-extrusion-height':['*',['get','population'],1],'fill-extrusion-base':0,'fill-extrusion-opacity':.93,'fill-extrusion-vertical-gradient':true}});
  map.addLayer({id:'boundary',type:'line',source:'boundary',paint:{'line-color':'#82c7d2','line-width':1.5,'line-dasharray':[3,3],'line-opacity':.85}});
  map.setLight({anchor:'viewport',color:'#fff4dc',intensity:.45,position:[1.5,210,35]});
  for (const [position,cls,label] of [[metadata.center,'palace-marker','Kungliga slottet · cirkelns mittpunkt'],[metadata.farsta,'farsta-marker','Farsta centrum · radie cirka 9,4 km']]) {
    const marker=document.createElement('button');marker.className=cls;marker.setAttribute('aria-label',label);marker.title=label;
    new maplibregl.Marker({element:marker}).setLngLat(position).setPopup(new maplibregl.Popup().setText(label)).addTo(map);
  }
  popup = new maplibregl.Popup({closeButton:false,closeOnClick:false});
  for(const layer of ['population-bars','zero','nodata']) {
    map.on('mousemove',layer,e=>{map.getCanvas().style.cursor='pointer';showCell(e,false);});
    map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';if(!pinned)popup.remove();});
    map.on('click',layer,e=>showCell(e,true));
  }
  el('height').addEventListener('input',event=>{
    const scale=Number(event.target.value);
    el('height-value').value=scale.toLocaleString('sv-SE')+' m / invånare';
    map.setPaintProperty('population-bars','fill-extrusion-height',['*',['get','population'],scale]);
  });
  el('panel-toggle').addEventListener('click',()=>{
    const compact=document.querySelector('.panel').classList.toggle('panel-compact');
    el('panel-toggle').setAttribute('aria-expanded',String(!compact));
    el('panel-toggle').textContent=compact?'Visa inställningar':'Dölj inställningar';
  });
  el('three-d').addEventListener('click',()=>setView(true));
  el('top-down').addEventListener('click',()=>setView(false));
  el('reset').addEventListener('click',()=>{
    el('height').value='1';el('height').dispatchEvent(new Event('input'));
    popup.remove();pinned=false;setView(true);reset();
  });
  map.on('pitchend',()=>{
    const is3D=map.getPitch()>5;
    for(const [id,active] of [['three-d',is3D],['top-down',!is3D]]) {el(id).classList.toggle('active',active);el(id).setAttribute('aria-pressed',String(active));}
  });
  reset();
  await new Promise(resolve=>map.once('idle',resolve));
  ready=true;
  el('status').hidden=true;
  for(const id of ['height','three-d','top-down','reset'])el(id).disabled=false;
  window.stockholmReady=true;
}
start().catch(showError);
