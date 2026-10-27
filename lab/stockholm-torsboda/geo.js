/* Vincenty's geodesics on GRS80; distances in metres, coordinates [lon, lat]. */
(function(root){
  'use strict';
  const A=6378137,F=1/298.257222101,B=A*(1-F),R=Math.PI/180;
  function inverse(p,q){
    const U1=Math.atan((1-F)*Math.tan(p[1]*R)),U2=Math.atan((1-F)*Math.tan(q[1]*R));
    const s1=Math.sin(U1),c1=Math.cos(U1),s2=Math.sin(U2),c2=Math.cos(U2),L=(q[0]-p[0])*R;
    let lam=L,sig,sinSig,cosSig,sinA,cos2A,cos2M;
    for(let i=0;i<30;i++){
      const sl=Math.sin(lam),cl=Math.cos(lam);
      sinSig=Math.hypot(c2*sl,c1*s2-s1*c2*cl);
      if(sinSig===0)return{distance:0,bearing:0};
      cosSig=s1*s2+c1*c2*cl;sig=Math.atan2(sinSig,cosSig);
      sinA=c1*c2*sl/sinSig;cos2A=1-sinA*sinA;
      cos2M=cos2A?cosSig-2*s1*s2/cos2A:0;
      const C=F/16*cos2A*(4+F*(4-3*cos2A));
      const next=L+(1-C)*F*sinA*(sig+C*sinSig*(cos2M+C*cosSig*(-1+2*cos2M*cos2M)));
      if(Math.abs(next-lam)<1e-12){lam=next;break;}lam=next;
    }
    const u2=cos2A*(A*A-B*B)/(B*B),aa=1+u2/16384*(4096+u2*(-768+u2*(320-175*u2))),bb=u2/1024*(256+u2*(-128+u2*(74-47*u2)));
    const delta=bb*sinSig*(cos2M+bb/4*(cosSig*(-1+2*cos2M*cos2M)-bb/6*cos2M*(-3+4*sinSig*sinSig)*(-3+4*cos2M*cos2M)));
    return{distance:B*aa*(sig-delta),bearing:Math.atan2(c2*Math.sin(lam),c1*s2-s1*c2*Math.cos(lam))/R};
  }
  function destination(p,bearing,distance){
    const alpha=bearing*R,U=Math.atan((1-F)*Math.tan(p[1]*R)),su=Math.sin(U),cu=Math.cos(U),sa=Math.sin(alpha),ca=Math.cos(alpha);
    const sig1=Math.atan2(Math.tan(U),ca),sinA=cu*sa,cos2A=1-sinA*sinA,u2=cos2A*(A*A-B*B)/(B*B);
    const aa=1+u2/16384*(4096+u2*(-768+u2*(320-175*u2))),bb=u2/1024*(256+u2*(-128+u2*(74-47*u2)));
    let sig=distance/(B*aa);
    for(let i=0;i<30;i++){
      const cm=Math.cos(2*sig1+sig),ss=Math.sin(sig),cs=Math.cos(sig);
      const delta=bb*ss*(cm+bb/4*(cs*(-1+2*cm*cm)-bb/6*cm*(-3+4*ss*ss)*(-3+4*cm*cm)));
      const next=distance/(B*aa)+delta;if(Math.abs(next-sig)<1e-12){sig=next;break;}sig=next;
    }
    const ss=Math.sin(sig),cs=Math.cos(sig),temp=su*ss-cu*cs*ca;
    const lat=Math.atan2(su*cs+cu*ss*ca,(1-F)*Math.hypot(sinA,temp));
    const lam=Math.atan2(ss*sa,cu*cs-su*ss*ca),C=F/16*cos2A*(4+F*(4-3*cos2A));
    const L=lam-(1-C)*F*sinA*(sig+C*ss*(Math.cos(2*sig1+sig)+C*cs*(-1+2*Math.cos(2*sig1+sig)**2)));
    return[p[0]+L/R,lat/R];
  }
  function circle(center,radius){const points=[];for(let a=0;a<=360;a+=2)points.push(destination(center,a,radius));return points;}
  function ringPosition(point,ring){
    const [x,y]=point;let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const [ax,ay]=ring[j],[bx,by]=ring[i];
      const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
      if(Math.abs(cross)<1e-12&&x>=Math.min(ax,bx)-1e-12&&x<=Math.max(ax,bx)+1e-12&&y>=Math.min(ay,by)-1e-12&&y<=Math.max(ay,by)+1e-12)return 2;
      if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside?1:0;
  }
  function contains(point,geometry){
    const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
    return polygons.some(rings=>{
      const outer=ringPosition(point,rings[0]);if(!outer)return false;if(outer===2)return true;
      for(let i=1;i<rings.length;i++){const hole=ringPosition(point,rings[i]);if(hole===2)return true;if(hole===1)return false;}
      return true;
    });
  }
  function bounds(geometry){
    const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
    let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
    for(const rings of polygons)for(const point of rings[0]){west=Math.min(west,point[0]);south=Math.min(south,point[1]);east=Math.max(east,point[0]);north=Math.max(north,point[1]);}
    return[[west,south],[east,north]];
  }
  const api={inverse,destination,circle,contains,bounds};root.StockholmGeo=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
