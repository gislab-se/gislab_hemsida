// Native raster cells are assigned once by their centre. No area-based membership allocation.
export const categories={school:'Skola',preschool:'Förskola',higher_education:'Högre utbildning',workplace:'Arbetsplats',nursing_home:'Äldreboende',hospital:'Sjukhus',healthcare:'Övrig vård',prison:'Anstalt',remand:'Häkte'};
export function parsePopulation(buffer){
  const view=new DataView(buffer),magic=new TextDecoder().decode(new Uint8Array(buffer,0,8));
  if(magic!=='STFPOP01')throw Error('Okänt befolkningsformat.');
  const width=view.getUint32(8,true),height=view.getUint32(12,true),count=view.getUint32(16,true),parishCount=view.getUint32(20,true);
  if(buffer.byteLength!==24+count*10)throw Error('Ofullständigt befolkningsunderlag.');
  return {width,height,count,parishCount,indices:new Uint32Array(buffer,24,count),values:new Float32Array(buffer,24+count*4,count),owners:new Uint16Array(buffer,24+count*8,count)};
}
function prepareRing(coords){
  const box=[Infinity,Infinity,-Infinity,-Infinity];
  for(const [x,y] of coords){box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}
  const n=Math.min(128,Math.max(8,Math.ceil(coords.length/16))),span=box[3]-box[1]||1,bands=Array.from({length:n},()=>[]);
  const band=y=>Math.max(0,Math.min(n-1,Math.floor((y-box[1])/span*n)));
  for(let i=1;i<coords.length;i++){const a=coords[i-1],b=coords[i];for(let k=band(Math.min(a[1],b[1]));k<=band(Math.max(a[1],b[1]));k++)bands[k].push([a,b]);}
  return {box,bands,band};
}
function inRing(x,y,ring){
  const b=ring.box;if(x<b[0]||y<b[1]||x>b[2]||y>b[3])return 0;
  let inside=false;
  for(const [[ax,ay],[bx,by]] of ring.bands[ring.band(y)]){
    const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
    if(Math.abs(cross)<1e-15&&x>=Math.min(ax,bx)&&x<=Math.max(ax,bx)&&y>=Math.min(ay,by)&&y<=Math.max(ay,by))return 2;
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside?1:0;
}
export function prepareGeometry(geometry){
  return (geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates).map(poly=>poly.map(prepareRing));
}
export function contains(prepared,x,y){
  for(const rings of prepared){const outer=inRing(x,y,rings[0]);if(!outer)continue;if(outer===2)return true;let hole=false;for(let i=1;i<rings.length;i++){const hit=inRing(x,y,rings[i]);if(hit===2)return true;if(hit){hole=true;break;}}if(!hole)return true;}
  return false;
}
export function strictSum(values){return values.every(v=>typeof v==='number'&&Number.isFinite(v))?values.reduce((a,b)=>a+b,0):null;}
export function wholeSources(feature,originals){
  const original=originals.get(feature.id);
  if(original&&JSON.stringify(original.geometry)===JSON.stringify(feature.geometry))return [feature.id];
  const ids=feature.properties.statisticsSourceIds;
  return Array.isArray(ids)&&ids.length&&new Set(ids).size===ids.length&&ids.every(id=>originals.has(id))?ids:null;
}
export function calculateAnalysis({features,base,membership,metadata,cells,institutions}){
  const originals=new Map(base.features.map(f=>[f.id,f])),results={},ownerMap=new Map(),changed=[];
  const availableCategories=new Set((institutions?.features||[]).map(f=>f.properties.category));
  for(const f of features){
    const sources=wholeSources(f,originals),records=sources?.map(id=>membership.parishes[id]);
    const population=records?strictSum(records.map(p=>p?.population)):null;
    const members=records?strictSum(records.map(p=>p?.members)):null;
    const membersReference=records?strictSum(records.map(p=>p?.membersReference?.count)):null;
    const sourceModel=sources?.map(id=>metadata?.parishes[id]?.worldpop);
    results[f.id]={population,members,membersReference,membershipShare:population>0&&members!==null?members/population:null,worldpop:metadata?(sources?strictSum(sourceModel):0):null,modelCells:0,areaKm2:f.properties.areaKm2,wholeSources:sources,institutions:Object.fromEntries(Object.keys(categories).map(k=>[k,availableCategories.has(k)?0:null])),institutionTotal:institutions?0:null};
    if(sources)for(const id of sources)ownerMap.set(id,f.id);else changed.push({id:f.id,geometry:prepareGeometry(f.geometry)});
  }
  changed.sort((a,b)=>a.id.localeCompare(b.id));
  let unassignedPopulation=0,unassignedCells=0,unassignedInstitutions=0;
  if(cells&&metadata&&changed.length){
    const gt=metadata.worldpop.geotransform,ids=metadata.worldpop.parishIds;
    const compensation={};
    for(let i=0;i<cells.count;i++){
      if(ownerMap.has(ids[cells.owners[i]-1]))continue;
      const pixel=cells.indices[i],x=gt[0]+(pixel%cells.width+.5)*gt[1],y=gt[3]+(Math.floor(pixel/cells.width)+.5)*gt[5];
      const target=changed.find(f=>contains(f.geometry,x,y));
      if(target){const r=results[target.id],v=cells.values[i]-(compensation[target.id]||0),sum=r.worldpop+v;compensation[target.id]=(sum-r.worldpop)-v;r.worldpop=sum;r.modelCells++;}
      else{unassignedPopulation+=cells.values[i];unassignedCells++;}
    }
    for(const f of changed)if(!results[f.id].modelCells)results[f.id].worldpop=null;
  }
  const assignments={};
  for(const point of institutions?.features||[]){
    const p=point.properties,xy=point.geometry.coordinates;
    let id=ownerMap.get(p.parishId);
    if(!id)id=changed.find(f=>contains(f.geometry,xy[0],xy[1]))?.id;
    if(id){const r=results[id];r.institutionTotal++;if(p.category in r.institutions)r.institutions[p.category]++;assignments[point.id??p.id]=id;}
    else unassignedInstitutions++;
  }
  return {parishes:results,assignments,unassignedPopulation,unassignedCells,unassignedInstitutions};
}
export function aggregate(features,result){
  const rows=features.map(f=>result?.parishes[f.id]);
  const sum=key=>strictSum(rows.map(r=>r?.[key]));
  return {population:sum('population'),members:sum('members'),membersReference:sum('membersReference'),worldpop:sum('worldpop'),institutionTotal:sum('institutionTotal'),areaKm2:sum('areaKm2'),institutions:Object.fromEntries(Object.keys(categories).map(k=>[k,strictSum(rows.map(r=>r?.institutionTotal===null?null:r?.institutions[k]))]))};
}
