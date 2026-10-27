(function(root){
  'use strict';
  const Geo=root.StockholmGeo||(typeof require==='function'?require('./geo.js'):null);
  function route(from,to){
    const reference=Geo.inverse(from,to),steps=Math.max(1,Math.ceil(reference.distance/5000)),coordinates=[from.slice()];
    for(let i=1;i<steps;i++)coordinates.push(Geo.destination(from,reference.bearing,reference.distance*i/steps));
    coordinates.push(to.slice());return {type:'LineString',coordinates};
  }
  function dash(phase){
    const dashLength=2,gap=6,period=dashLength+gap,p=((phase%period)+period)%period;
    return p<=gap?[0,p,dashLength,gap-p]:[p-gap,gap,period-p,0];
  }
  const api={route,dash};root.StockholmFlow=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
