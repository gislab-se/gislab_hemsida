import './vendor/turf.js';
import {calculateChurchAssets} from './church-assets-core.js';
let dataset;
self.onmessage=({data})=>{
  try{if(data.dataset)dataset=data.dataset;const result=calculateChurchAssets({...dataset,features:data.features});self.postMessage({version:data.version,result});}
  catch(e){self.postMessage({version:data.version,error:e.message});}
};
