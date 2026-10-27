'use strict';
importScripts('geo.js','model.js');
let model,cityLandBoundary,cityLandView;
const areas=new Map();
async function json(path){const response=await fetch(path);if(!response.ok)throw new Error(`Kunde inte läsa ${path}`);return response.json();}
async function areaModel(id){
  if(!areas.has(id))areas.set(id,(async()=>{
    const prefix=`areas/${id}/`,meta=await json(prefix+'metadata.json');
    const [population,centers,corners,mask,outline,boundary,land,view]=await Promise.all([compressed(prefix+'population.i16.gz',Int16Array),compressed(prefix+'centers.i32.gz',Int32Array),compressed(prefix+'corners.i32.gz',Int32Array),compressed(prefix+'mask.u8.gz',Uint8Array),json(prefix+'outline.geojson'),json(prefix+'land-boundary.geojson'),compressed(prefix+'land.u8.gz',Uint8Array),json(prefix+'land-view.json')]);
    if(population.length!==meta.width*meta.height||mask.length!==population.length||centers.length!==population.length*2||corners.length!==(meta.width+1)*(meta.height+1)*2)throw new Error('Områdesunderlaget har fel storlek');
    if(land.length!==population.length)throw new Error('Landmasken har fel storlek');
    const regional=new StockholmModel.PopulationModel(meta,population,centers,corners,outline);regional.municipalityMask=mask;regional.landMask=land;
    return {model:regional,meta,boundary,view};
  })().catch(error=>{areas.delete(id);throw error;}));
  return areas.get(id);
}
async function compressed(path,Type){
  const response=await fetch(path);if(!response.ok)throw new Error(`Kunde inte läsa ${path}`);
  if(typeof DecompressionStream==='undefined')throw new Error('Webbläsaren behöver stöd för komprimerade kartdata. Prova en aktuell Chrome, Edge, Firefox eller Safari.');
  const bytes=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return new Type(bytes);
}
self.onmessage=async({data})=>{
  const {id,type,options}=data;
  try{
    if(type==='init'){
      const response=await fetch('region/metadata.json');if(!response.ok)throw new Error('Kunde inte läsa kartunderlaget');const meta=await response.json();
      const [population,centers,corners,municipality]=await Promise.all([compressed('region/population.i16.gz',Int16Array),compressed('region/centers.i32.gz',Int32Array),compressed('region/corners.i32.gz',Int32Array),fetch('stockholm-municipality.geojson').then(response=>{if(!response.ok)throw new Error('Kommungränsen kunde inte läsas');return response.json();})]);
      if(population.length!==meta.width*meta.height||centers.length!==population.length*2||corners.length!==(meta.width+1)*(meta.height+1)*2)throw new Error('Kartunderlaget har fel storlek');
      const [land,boundary,view]=await Promise.all([compressed('region/land.u8.gz',Uint8Array),json('region/land-boundary.geojson'),json('region/land-view.json')]);
      if(land.length!==population.length)throw new Error('Landmasken har fel storlek');
      model=new StockholmModel.PopulationModel(meta,population,centers,corners,municipality);model.landMask=land;cityLandBoundary=boundary;cityLandView=view;self.postMessage({id,type:'initialized',meta});
    }else if(type==='select'){
      if(!model)throw new Error('Kartunderlaget är inte klart');
      let result;
      if(['neighbors','county'].includes(options.area)){
        const area=await areaModel(options.area);
        result=area.model.select({...options,area:'municipality'});
        if(result.stats.population!==area.meta.source_stats.population)throw new Error('Områdets befolkning stämmer inte med originalrutornas summa');
        result.area=options.area;result.areaMeta=area.meta;result.boundary=area.boundary;result.bounds=area.view.bounds;result.cellSize=100;
      }else{result=model.select(options);result.cellSize=100;if(options.area==='municipality'){result.boundary=cityLandBoundary;result.bounds=cityLandView.bounds;}}
      self.postMessage({id,type:'selection',result});
    }
  }catch(error){self.postMessage({id,type:'error',message:error.message});}
};
