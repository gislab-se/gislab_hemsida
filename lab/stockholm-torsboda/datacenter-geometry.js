(function(root){
  'use strict';
  const Geo=root.StockholmGeo||(typeof require==='function'?require('./geo.js'):null);
  function ringArea(ring){let sum=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)sum+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];return Math.abs(sum)/2;}
  function area(polygons){return polygons.reduce((sum,rings)=>sum+ringArea(rings[0])-rings.slice(1).reduce((n,r)=>n+ringArea(r),0),0);}
  function geographic(polygons,origin){return {type:'MultiPolygon',coordinates:polygons.map(rings=>rings.map(ring=>ring.map(([x,y])=>Geo.destination(origin,Math.atan2(x,y)*180/Math.PI,Math.hypot(x,y)))))};}
  function square(position,hectares){const half=Math.sqrt(Math.max(0,hectares)*10000)/2;return geographic([[[[-half,-half],[half,-half],[half,half],[-half,half],[-half,-half]]]],position);}
  function rim(position,hectares){const side=Math.sqrt(Math.max(0,hectares)*10000),inset=Math.min(2.5,side*.04),outer=square(position,hectares),inner=square(position,Math.max(0,side-2*inset)**2/10000);return {type:'Polygon',coordinates:[outer.coordinates[0][0],inner.coordinates[0][0].slice().reverse()]};}
  const api={area,square,rim,geographic};root.DatacenterGeometry=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
