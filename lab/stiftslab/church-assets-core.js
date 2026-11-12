import {contains,prepareGeometry,wholeSources} from './analysis-core.js';
export const placeTypes={church:'Kyrkor',chapel:'Kapell',cemetery:'Begravningsplatser'};
export const relations={owned:'Ägd enligt källa',managed:'Förvaltad enligt källa',leased:'Hyrd enligt källa',historical:'Historisk uppgift','association-unverified':'Koppling behöver verifieras'};
export function calculateChurchAssets({features,base,places,properties}){
  const originalMap=new Map(base.features.map(f=>[f.id,f])),originalToCurrent=new Map(),changed=[];
  for(const f of features){const ids=wholeSources(f,originalMap);if(ids)for(const id of ids)originalToCurrent.set(id,f.id);else changed.push({id:f.id,geometry:prepareGeometry(f.geometry)});}
  changed.sort((a,b)=>a.id.localeCompare(b.id));
  const assignments={},parishes=Object.fromEntries(features.map(f=>[f.id,{church:[],chapel:[],cemetery:[],properties:[]}])) ;
  let unassignedPlaces=0;
  for(const f of places.features){
    const p=f.properties,point=p.representativePoint||(f.geometry.type==='Point'?f.geometry.coordinates:null);
    let id=originalToCurrent.get(p.parishId);
    if(!id&&point)id=changed.find(g=>contains(g.geometry,point[0],point[1]))?.id;
    if(id){assignments[f.id??p.id]=id;const type=p.category||p.type;if(parishes[id][type])parishes[id][type].push(f.id??p.id);}
    else unassignedPlaces++;
  }
  const t=globalThis.turf;
  const boxes=features.map(f=>({f,bbox:t.bbox(f)}));
  for(const property of properties.features){
    const b=t.bbox(property),hits=[];
    for(const {f,bbox:a} of boxes){
      if(a[0]>b[2]||a[2]<b[0]||a[1]>b[3]||a[3]<b[1])continue;
      if(t.booleanIntersects(f,property)){hits.push(f.id);parishes[f.id].properties.push(property.id);}
    }
    assignments[property.id]=hits;
  }
  return {assignments,parishes,unassignedPlaces};
}
export function summarizeChurchAssets(features,result){
  const out={};
  for(const key of [...Object.keys(placeTypes),'properties'])out[key]=[...new Set(features.flatMap(f=>result?.parishes[f.id]?.[key]||[]))];
  return out;
}
