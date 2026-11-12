/* Scenario operations are independent of the UI. Original data is never mutated. */
export const clone = value => structuredClone(value);
export const collection = features => ({type:'FeatureCollection', features});
const geo = () => globalThis.turf;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
export function createScenario(base, diocese, name='Mitt första scenario') {
  return {schema:1, dataVersion:'2026-01-01', stiftId:diocese.id, name,
    contracts:clone(diocese.contracts), features:clone(base.features), log:[]};
}
function commit(state, features, text, contracts=state.contracts) {
  return {...state, features, contracts, log:[...state.log, {text, at:new Date().toISOString()}]};
}
export function moveParishes(state, ids, contractId) {
  assert(state.contracts.some(c=>c.id===contractId), 'Välj ett giltigt kontrakt.');
  assert(ids.length && ids.every(id=>state.features.some(f=>f.id===id)), 'Välj minst en församling.');
  const changed=state.features.filter(f=>ids.includes(f.id)&&f.properties.contractId!==contractId);
  assert(changed.length, 'De valda församlingarna tillhör redan kontraktet.');
  const features=state.features.map(f=>ids.includes(f.id)?{...f, properties:{...f.properties,contractId}}:f);
  return commit(state,features,`${changed.length} församlingar flyttades till ${state.contracts.find(c=>c.id===contractId).name}.`);
}
export function addContract(state, name, id) {
  name=name.trim();
  assert(name && name.length<=120, 'Ange ett kontraktsnamn med högst 120 tecken.');
  assert(!state.contracts.some(c=>c.name.toLocaleLowerCase('sv')===name.toLocaleLowerCase('sv')), 'Namnet används redan.');
  return commit(state,state.features,`Kontraktet ${name} skapades.`,[...state.contracts,{id,name,custom:true}]);
}
export function mergeContracts(state, from, to) {
  assert(from!==to,'Välj två olika kontrakt.');
  assert(state.contracts.some(c=>c.id===from)&&state.contracts.some(c=>c.id===to),'Kontraktet saknas.');
  const features=state.features.map(f=>f.properties.contractId===from?{...f,properties:{...f.properties,contractId:to}}:f);
  return commit(state,features,`${state.contracts.find(c=>c.id===from).name} slogs samman med ${state.contracts.find(c=>c.id===to).name}.`,state.contracts.filter(c=>c.id!==from));
}
export function renameContract(state,id,name) {
  name=name.trim();
  assert(name&&name.length<=120,'Ange ett namn med högst 120 tecken.');
  assert(state.contracts.some(c=>c.id===id),'Kontraktet saknas.');
  assert(!state.contracts.some(c=>c.id!==id&&c.name===name),'Namnet används redan.');
  return commit(state,state.features,`Kontraktet fick namnet ${name}.`,state.contracts.map(c=>c.id===id?{...c,name}:c));
}
function withGeometry(f, result, extra={}) {
  assert(result && ['Polygon','MultiPolygon'].includes(result.geometry.type),'Området saknar giltig yta.');
  return {...f, geometry:result.geometry, properties:{...f.properties,statisticsSourceIds:null,...extra,geometryChanged:true,areaKm2:geo().area(result)/1e6}};
}
function requireEditable(features){
  const invalid=features.find(f=>f.properties.geometryIssue);
  assert(!invalid,`${invalid?.properties.name??'Församlingen'} har ett geometri-fel i källan. Kontraktstillhörigheten kan ändras, men gränsredigering kräver att källgeometrin först rättas.`);
}
export function mergeParishes(state,ids,name,id) {
  assert(ids.length>=2,'Välj minst två församlingar.');
  assert(name.trim()&&name.trim().length<=120,'Ange ett namn med högst 120 tecken.');
  const selected=state.features.filter(f=>ids.includes(f.id));
  assert(selected.length===ids.length,'Någon församling saknas.');
  requireEditable(selected);
  assert(new Set(selected.map(f=>f.properties.contractId)).size===1,'Flytta först församlingarna till samma kontrakt.');
  const result=geo().union(collection(selected));
  const whole=f=>f.properties.statisticsSourceIds??(!f.properties.geometryChanged?[f.id]:null);
  const statisticsSourceIds=selected.every(f=>whole(f))?[...new Set(selected.flatMap(whole))]:null;
  const merged=withGeometry(selected[0],result,{id,name:name.trim(),sourceIds:[...new Set(selected.flatMap(f=>f.properties.sourceIds))],statisticsSourceIds,pastoratId:null,pastoratName:null});
  merged.id=id;
  return commit(state,[...state.features.filter(f=>!ids.includes(f.id)),merged],`${selected.length} församlingar slogs samman till ${name.trim()}.`);
}
export function splitParish(state,id,mask,name,newId) {
  const source=state.features.find(f=>f.id===id);
  assert(source,'Välj en församling att dela.');
  requireEditable([source]);
  assert(name.trim()&&name.trim().length<=120,'Ange ett namn med högst 120 tecken.');
  const cut=geo().intersect(collection([source,mask]));
  const remainder=geo().difference(collection([source,mask]));
  assert(cut&&remainder&&geo().area(cut)>1&&geo().area(remainder)>1,'Rita ett område som delar församlingen i två delar, båda större än 1 m².');
  const part=withGeometry(source,cut,{id:newId,name:name.trim(),pastoratId:null,pastoratName:null});
  part.id=newId;
  const features=state.features.map(f=>f.id===id?withGeometry(f,remainder):f);
  return commit(state,[...features,part],`${source.properties.name} delades. Nytt område: ${name.trim()}.`);
}
export function transferArea(state,from,to,mask) {
  assert(from!==to,'Välj två olika församlingar.');
  const source=state.features.find(f=>f.id===from), target=state.features.find(f=>f.id===to);
  assert(source&&target,'Välj två församlingar.');
  requireEditable([source,target]);
  const cut=geo().intersect(collection([source,mask]));
  const remainder=geo().difference(collection([source,mask]));
  assert(cut&&geo().area(cut)>1,'Det ritade området träffar inte den första församlingen.');
  assert(remainder&&geo().area(remainder)>1,'Hela församlingen kan inte flyttas på detta sätt. Använd Slå samman.');
  const expanded=geo().union(collection([target,cut]));
  const features=state.features.map(f=>f.id===from?withGeometry(f,remainder):f.id===to?withGeometry(f,expanded):f);
  return commit(state,features,`Ett område flyttades från ${source.properties.name} till ${target.properties.name}.`);
}
export function changes(state,base) {
  const originals=new Map(base.features.map(f=>[f.id,f]));
  const current=new Set(state.features.map(f=>f.id));
  const result=[];
  for(const f of state.features) {
    const old=originals.get(f.id);
    const reasons=[];
    if(!old) reasons.push('Nytt område');
    else {
      if(old.properties.contractId!==f.properties.contractId) reasons.push('Bytt kontrakt');
      if(f.properties.geometryChanged) reasons.push('Ändrad gräns');
    }
    if(reasons.length) result.push({id:f.id,name:f.properties.name,reasons,from:old?.properties.contractId,to:f.properties.contractId});
  }
  for(const f of base.features) if(!current.has(f.id)) result.push({id:f.id,name:f.properties.name,reasons:['Sammanslagen'],from:f.properties.contractId,to:null});
  return result;
}
export function validateScenario(value,base,diocese) {
  assert(value?.schema===1&&value.dataVersion==='2026-01-01','Filen måste vara ett Stiftslab-scenario för 2026-01-01.');
  assert(value.stiftId===diocese.id,'Byt först till det stift som scenariot gäller.');
  assert(typeof value.name==='string'&&value.name.length<=120,'Scenariot saknar ett giltigt namn.');
  assert(Array.isArray(value.contracts)&&value.contracts.length<=500&&value.contracts.length>0,'Ogiltig kontraktslista.');
  assert(value.contracts.every(c=>typeof c.id==='string'&&typeof c.name==='string'&&c.name.length<=120),'Ogiltigt kontrakt.');
  const contracts=new Set(value.contracts.map(c=>c.id));
  assert(contracts.size===value.contracts.length,'Dubbla kontrakts-ID.');
  assert(Array.isArray(value.features)&&value.features.length>0&&value.features.length<=3000,'Ogiltig församlingslista.');
  const ids=new Set(), sourceIds=new Set(base.features.map(f=>f.id));
  const originals=new Map(base.features.map(f=>[f.id,f]));
  const unchanged=new Set();
  let positions=0;
  const walk=arr=>{
    assert(Array.isArray(arr),'Ogiltiga koordinater.');
    if(typeof arr[0]==='number') {
      assert(arr.length===2&&arr.every(Number.isFinite)&&Math.abs(arr[0])<=180&&Math.abs(arr[1])<=90,'Ogiltiga koordinater.');
      positions++; assert(positions<=3000000,'Filen har för många koordinater.');
    } else arr.forEach(walk);
  };
  for(const f of value.features) {
    assert(f.type==='Feature'&&typeof f.id==='string'&&!ids.has(f.id),'Ogiltigt eller dubbelt församlings-ID.'); ids.add(f.id);
    const p=f.properties;
    assert(p&&p.id===f.id&&typeof p.name==='string'&&p.name.length<=120&&p.stiftId===diocese.id&&contracts.has(p.contractId),'Ogiltig församling eller kontraktstillhörighet.');
    assert(Array.isArray(p.sourceIds)&&p.sourceIds.length&&p.sourceIds.every(id=>sourceIds.has(id)),'Okänd ursprungsförsamling.');
    assert(['Polygon','MultiPolygon'].includes(f.geometry?.type),'Enbart polygoner kan importeras.');
    walk(f.geometry.coordinates);
    if(originals.has(f.id)&&JSON.stringify(f.geometry)===JSON.stringify(originals.get(f.id).geometry)) unchanged.add(f.id);
    else assert(geo().booleanValid(f),'Ogiltig ändrad polygon i scenariot.');
  }
  // Imported geometries must partition the same territory as the original.
  // Area equality alone is insufficient: check union, added/removed area and overlaps.
  // Only changed geometries need overlay operations. Comparing entire dioceses
  // would unnecessarily union hundreds of thousands of unchanged vertices.
  const before=base.features.filter(f=>!unchanged.has(f.id));
  const after=value.features.filter(f=>!unchanged.has(f.id));
  if(!before.length&&!after.length) return cleanImported(value,unchanged);
  assert(before.length&&after.length,'Scenariot innehåller glapp eller områden utanför stiftets ursprungliga församlingar.');
  const union=fs=>fs.length===1?fs[0]:geo().union(collection(fs));
  const originalUnion=union(before), currentUnion=union(after);
  const added=geo().difference(collection([currentUnion,originalUnion]));
  const removed=geo().difference(collection([originalUnion,currentUnion]));
  const area=f=>f?geo().area(f):0;
  const tolerance=Math.max(5,area(originalUnion)*1e-8);
  assert(area(added)<tolerance&&area(removed)<tolerance,'Scenariot innehåller glapp eller områden utanför stiftets ursprungliga församlingar.');
  const originalOverlap=before.reduce((n,f)=>n+area(f),0)-area(originalUnion);
  const currentOverlap=after.reduce((n,f)=>n+area(f),0)-area(currentUnion);
  assert(currentOverlap-originalOverlap<tolerance,'Scenariot innehåller överlappande församlingsområden.');
  return cleanImported(value,unchanged);
}
function cleanImported(value,unchanged){const clean=clone(value);clean.features=clean.features.map(f=>({...f,properties:{...f.properties,geometryChanged:!unchanged.has(f.id),statisticsSourceIds:unchanged.has(f.id)?[f.id]:null}}));return {...clean,log:Array.isArray(value.log)?value.log.filter(x=>typeof x.text==='string'&&typeof x.at==='string').slice(-500):[]};}
