import './vendor/turf.js';
import * as core from './core.js';
self.onmessage=({data})=>{
  try{
    let result;
    if(data.action==='validate') result=core.validateScenario(data.value,data.base,data.diocese);
    else if(data.action==='merge') result=core.mergeParishes(data.state,data.ids,data.name,data.id);
    else if(data.action==='split') result=core.splitParish(data.state,data.id,data.mask,data.name,data.newId);
    else if(data.action==='transfer') result=core.transferArea(data.state,data.from,data.to,data.mask);
    else if(data.action==='contracts') result=data.state.contracts.map(c=>{
      const members=data.state.features.filter(f=>f.properties.contractId===c.id);
      if(!members.length)return null;
      const feature=members.length===1?members[0]:turf.union(core.collection(members));
      return {type:'Feature',id:c.id,properties:{id:c.id,name:c.name,stiftId:data.state.stiftId,parishCount:members.length,scenario:true},geometry:feature.geometry};
    }).filter(Boolean);
    else throw Error('Okänd geometrioperation.');
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
