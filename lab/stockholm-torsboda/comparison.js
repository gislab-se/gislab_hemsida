(function(root){
  'use strict';
  const referencePopulation=978770;
  const presets={low:Math.round(1000e6/referencePopulation),high:Math.round(1600e6/referencePopulation)};
  function balance(population,watts,torsbodaMW){
    const demandMW=population*watts/1e6;
    return {demandMW,availableMW:Math.max(0,demandMW-torsbodaMW),displacedMW:Math.min(demandMW,torsbodaMW),overflowMW:Math.max(0,torsbodaMW-demandMW)};
  }
  const site={position:[17.50256,62.52772],totalHectares:214,plannedHectares:140,source:'https://www.torsboda.com/nyheter/google-och-torsboda-industrial-park-forbereder-affar',positionSource:'https://www.openstreetmap.org/way/1168527084'};
  function metersPerPixel(latitude,zoom){return Math.cos(latitude*Math.PI/180)*40075016.68557849/(512*2**zoom);}
  function exhaustionMW(groups,watts){
    if(!groups.length)return 0;
    const total=groups[groups.length-1].cumulativePopulation;
    return Math.max(0,(total-groups[0].population)*watts/1e6+1e-6);
  }
  function playbackFrame(startMW,targetMW,elapsedMs,durationMs,emptyAtMW){
    const progress=Math.max(0,Math.min(1,elapsedMs/Math.max(1,durationMs)));
    const requested=startMW+(targetMW-startMW)*progress,mw=Math.min(requested,emptyAtMW);
    const reason=requested>=emptyAtMW?'empty':progress>=1?'target':null;
    return {mw,progress,reason};
  }
  function cycleFrame(targetMW,elapsedMs,durationMs,emptyAtMW){
    const duration=Math.max(1,durationMs),hold=Math.min(1000,duration*.2);
    const progress=Math.max(0,Math.min(1,(elapsedMs-hold)/(duration-2*hold)));
    const phase=elapsedMs>=duration?'complete':elapsedMs<hold?'starting':elapsedMs>=duration-hold?'waiting':'playing';
    const mw=Math.min(targetMW,Math.max(0,emptyAtMW))*progress;
    return {phase,mw,landProgress:mw/Math.max(1,targetMW),progress};
  }
  function defaultDuration(){return 60;}
  const api={referencePopulation,presets,balance,site,metersPerPixel,exhaustionMW,playbackFrame,cycleFrame,defaultDuration};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StockholmComparison=api;
})(typeof globalThis!=='undefined'?globalThis:this);
