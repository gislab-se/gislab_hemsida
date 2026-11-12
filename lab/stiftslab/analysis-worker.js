import {parsePopulation,calculateAnalysis} from './analysis-core.js';
let dataset,queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
  try{
    if(data.action==='init'){
      dataset=data.dataset;
      if(dataset.metadata){const r=await fetch(dataset.metadata.worldpop.file);if(!r.ok)throw Error('WorldPop kunde inte hämtas.');dataset.cells=parsePopulation(await r.arrayBuffer());}
    }
    const baseline=data.action==='init'?calculateAnalysis({...dataset,features:dataset.base.features}):undefined;
    const result=calculateAnalysis({...dataset,features:data.features});
    self.postMessage({version:data.version,result,baseline});
  }catch(e){self.postMessage({version:data.version,error:e.message});}
});};
