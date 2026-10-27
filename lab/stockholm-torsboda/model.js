/* Pure population / contiguous partition model, shared by Worker and tests. */
(function(root){
  'use strict';
  const Geo=root.StockholmGeo||(typeof require==='function'?require('./geo.js'):null);
  const collection=features=>({type:'FeatureCollection',features});
  function decodeCoordinates(array){for(let i=2;i<array.length;i++)array[i]+=array[i-2];return array;}
  // Convex power cells: |x-site|²-weight. Scan conversion avoids O(cells*sites).
  // Whole raster cells remain unchanged; weights approximate equal population.
  function compactPartition(selected,labels,population,width,count){
    if(count<2)return;
    const sites=Array.from({length:count},()=>({x:0,y:0,p:0,w:0}));
    let minR=Infinity,maxR=-1,minC=Infinity,maxC=-1,total=0;
    const inside=new Uint8Array(labels.length);
    for(const id of selected){
      inside[id]=1;const r=Math.floor(id/width),c=id%width,p=Math.max(0,population[id]),s=sites[labels[id]];
      s.x+=(c+.5)*p;s.y+=(r+.5)*p;s.p+=p;total+=p;
      minR=Math.min(minR,r);maxR=Math.max(maxR,r);minC=Math.min(minC,c);maxC=Math.max(maxC,c);
    }
    for(const s of sites){s.x/=s.p;s.y/=s.p;}
    const mean=total/count;let best=null,bestError=Infinity;
    for(let iteration=0;iteration<8;iteration++){
      const assigned=new Int32Array(labels.length).fill(-1);
      const sums=sites.map(()=>({p:0,x:0,y:0,n:0}));
      for(let i=0;i<count;i++){
        const a=sites[i];let polygon=[[minC,minR],[maxC+1,minR],[maxC+1,maxR+1],[minC,maxR+1]];
        for(let j=0;j<count&&polygon.length;j++){
          if(i===j)continue;const b=sites[j],nx=2*(b.x-a.x),ny=2*(b.y-a.y),offset=b.x*b.x+b.y*b.y-a.x*a.x-a.y*a.y+a.w-b.w;
          const clipped=[];
          for(let v=0;v<polygon.length;v++){
            const from=polygon[v],to=polygon[(v+1)%polygon.length],d1=nx*from[0]+ny*from[1]-offset,d2=nx*to[0]+ny*to[1]-offset;
            if(d1<=0)clipped.push(from);
            if((d1<=0)!==(d2<=0)){const t=d1/(d1-d2);clipped.push([from[0]+t*(to[0]-from[0]),from[1]+t*(to[1]-from[1])]);}
          }
          polygon=clipped;
        }
        if(!polygon.length)continue;
        const first=Math.max(minR,Math.ceil(Math.min(...polygon.map(p=>p[1]))-.5)),last=Math.min(maxR,Math.floor(Math.max(...polygon.map(p=>p[1]))-.5));
        for(let row=first;row<=last;row++){
          const y=row+.5;let left=Infinity,right=-Infinity;
          for(let v=0;v<polygon.length;v++){
            const a=polygon[v],b=polygon[(v+1)%polygon.length];
            if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)){const x=a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]);left=Math.min(left,x);right=Math.max(right,x);}
          }
          for(let col=Math.max(minC,Math.ceil(left-.5));col<=Math.min(maxC,Math.floor(right-.5));col++){
            const id=row*width+col;if(inside[id]&&assigned[id]<0)assigned[id]=i;
          }
        }
      }
      // Exact score fallback only for cells on floating-point polygon boundaries.
      for(const id of selected){
        const x=id%width+.5,y=Math.floor(id/width)+.5;
        if(assigned[id]<0){let score=Infinity;for(let i=0;i<count;i++){const s=sites[i],d=(x-s.x)**2+(y-s.y)**2-s.w;if(d<score){score=d;assigned[id]=i;}}}
        const s=sums[assigned[id]],p=Math.max(0,population[id]);s.p+=p;s.x+=x*p;s.y+=y*p;s.n++;
      }
      const error=sums.reduce((n,s)=>n+((s.p-mean)/mean)**2,0)/count;
      if(error<bestError){bestError=error;best=assigned;}
      for(let i=0;i<count;i++){
        const s=sites[i],sum=sums[i];
        if(sum.p){s.x+=.35*(sum.x/sum.p-s.x);s.y+=.35*(sum.y/sum.p-s.y);}
        s.w+=.55*sum.n*(mean-sum.p)/mean;
      }
      // Keep every site inside its own cell; prevents collapsed or needle-shaped areas.
      const caps=sites.map((a,i)=>{let nearest=Infinity;for(let j=0;j<count;j++)if(i!==j){const b=sites[j];nearest=Math.min(nearest,(a.x-b.x)**2+(a.y-b.y)**2);}return .4*nearest;});
      sites.forEach((s,i)=>{s.w=Math.max(-caps[i],Math.min(caps[i],s.w));});
    }
    for(const id of selected)labels[id]=best[id];
  }
  function connectFragments(selected,labels,population,width,height,count){
    // Rasterizing a diagonal edge can leave a tiny piece connected only at a corner.
    // Attach those pieces to an adjacent main area instead of making extra groups.
    const components=[],componentOf=new Int32Array(labels.length).fill(-1),main=new Int32Array(count).fill(-1);
    for(const seed of selected){
      if(componentOf[seed]>=0)continue;
      const index=components.length,label=labels[seed],ids=[seed];let total=0;componentOf[seed]=index;
      for(let head=0;head<ids.length;head++){
        const id=ids[head],r=Math.floor(id/width),c=id%width;total+=Math.max(0,population[id]);
        for(const next of [r>0?id-width:-1,r<height-1?id+width:-1,c>0?id-1:-1,c<width-1?id+1:-1])if(next>=0&&labels[next]===label&&componentOf[next]<0){componentOf[next]=index;ids.push(next);}
      }
      components.push({label,ids,population:total,neighbors:new Set(),owner:-1});
      const previous=components[main[label]];
      if(!previous||total>previous.population||(total===previous.population&&ids.length>previous.ids.length))main[label]=index;
    }
    for(const id of selected){const a=componentOf[id],r=Math.floor(id/width),c=id%width;
      for(const next of [r<height-1?id+width:-1,c<width-1?id+1:-1])if(next>=0&&componentOf[next]>=0&&componentOf[next]!==a){const b=componentOf[next];components[a].neighbors.add(b);components[b].neighbors.add(a);}
    }
    const queue=[];
    for(let label=0;label<count;label++)if(main[label]>=0){components[main[label]].owner=label;queue.push(main[label]);}
    for(let head=0;head<queue.length;head++){const component=components[queue[head]];for(const neighbor of component.neighbors)if(components[neighbor].owner<0){components[neighbor].owner=component.owner;queue.push(neighbor);}}
    for(const c of components)for(const id of c.ids)labels[id]=c.owner>=0?c.owner:c.label;
  }
  class PopulationModel{
    constructor(meta,population,centers,corners,municipality=null){
      this.meta=meta;this.population=population;this.centers=centers;this.corners=corners;this.distances=new Float64Array(population.length);this.lastCenter=null;
      this.municipality=municipality;this.municipalityMask=null;
      if(meta.coordinate_delta_encoded){decodeCoordinates(centers);decodeCoordinates(corners);}
    }
    point(index){return[this.centers[index*2]/this.meta.coordinate_scale,this.centers[index*2+1]/this.meta.coordinate_scale];}
    corner(row,col){const i=(row*(this.meta.width+1)+col)*2;return[this.corners[i]/this.meta.coordinate_scale,this.corners[i+1]/this.meta.coordinate_scale];}
    clampCenter(center){
      if(!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite))throw new Error('Ogiltig mittpunkt');
      const d=Geo.inverse(this.meta.center,center);
      return d.distance>this.meta.max_center_distance_m?Geo.destination(this.meta.center,d.bearing,this.meta.max_center_distance_m):center.slice();
    }
    setCenter(center){
      if(this.lastCenter&&center.every((x,i)=>Math.abs(x-this.lastCenter[i])<1e-10))return;
      const positive=[];
      for(let i=0;i<this.population.length;i++){
        const d=Geo.inverse(center,this.point(i)).distance;this.distances[i]=d;
        if(this.population[i]>0&&d<=this.meta.max_radius_m)positive.push(i);
      }
      positive.sort((a,b)=>this.distances[a]-this.distances[b]||a-b);
      this.positive=positive;this.prefix=new Float64Array(positive.length+1);
      for(let i=0;i<positive.length;i++)this.prefix[i+1]=this.prefix[i]+this.population[positive[i]];
      this.lastCenter=center.slice();
    }
    select(options){
      const started=performance.now(),municipal=options.area==='municipality',center=municipal?this.meta.center.slice():this.clampCenter(options.center);
      if(municipal&&!this.municipality)throw new Error('Kommungränsen kunde inte läsas');
      const centerLimited=!municipal&&center.some((x,i)=>Math.abs(x-options.center[i])>1e-8);
      this.setCenter(center);
      if(municipal&&!this.municipalityMask){
        this.municipalityMask=new Uint8Array(this.population.length);
        const [[west,south],[east,north]]=Geo.bounds(this.municipality.geometry);
        for(let i=0;i<this.population.length;i++){const point=this.point(i);if(point[0]>=west&&point[0]<=east&&point[1]>=south&&point[1]<=north&&Geo.contains(point,this.municipality.geometry))this.municipalityMask[i]=1;}
      }
      let radius=Math.max(250,Math.min(this.meta.max_radius_m,Number(options.radius)||this.meta.default_radius_m));
      let populationLimited=false;
      if(!municipal&&Number.isFinite(options.targetPopulation)){
        const target=Math.max(0,options.targetPopulation);let lo=0,hi=this.positive.length;
        while(lo<hi){const mid=(lo+hi)>>1;if(this.prefix[mid+1]<target)lo=mid+1;else hi=mid;}
        populationLimited=lo>=this.positive.length;
        radius=populationLimited?this.meta.max_radius_m:Math.max(250,this.distances[this.positive[lo]]+1e-6);
      }
      const limit=Math.max(1000,Math.floor(options.barLimit||60000));
      const barLimited=!municipal&&this.positive.length>limit&&radius>=this.distances[this.positive[limit]];
      if(barLimited)radius=Math.max(250,this.distances[this.positive[limit-1]]);
      const selected=[],stats={population:0,cells:0,populated:0,zero:0,nodata:0,max:0};
      const inside=municipal?this.municipalityMask:new Uint8Array(this.population.length);
      for(let i=0;i<this.population.length;i++)if(municipal?inside[i]:this.distances[i]<=radius){
        inside[i]=1;
        selected.push(i);stats.cells++;const p=this.population[i];
        if(p<0)stats.nodata++;else if(p===0)stats.zero++;else{stats.population+=p;stats.populated++;stats.max=Math.max(stats.max,p);}
      }
      const target=Math.max(1,Number(options.targetGroupPopulation)||4000);
      const requestedGroups=Math.max(1,Math.round(stats.population/target));
      const groupCap=800,k=Math.min(groupCap,requestedGroups,Math.max(1,stats.populated));
      const labels=new Int32Array(this.population.length).fill(-1),groups=[];
      const width=this.meta.width;
      const split=(ids,parts)=>{
        let total=0,minR=Infinity,maxR=-1,minC=Infinity,maxC=-1;
        for(const id of ids){total+=Math.max(0,this.population[id]);const row=Math.floor(id/width),col=id%width;minR=Math.min(minR,row);maxR=Math.max(maxR,row);minC=Math.min(minC,col);maxC=Math.max(maxC,col);}
        if(parts<2||total===0||ids.length===1){const id=groups.length;groups.push({id,population:total,cells:ids.length});for(const index of ids)labels[index]=id;return;}
        const leftParts=Math.floor(parts/2),wanted=total*leftParts/parts;let best=null;
        for(const axis of ['row','col']){
          const min=axis==='row'?minR:minC,max=axis==='row'?maxR:maxC;
          const histogram=new Float64Array(max-min+1);
          for(const id of ids){const pos=axis==='row'?Math.floor(id/width):id%width;histogram[pos-min]+=Math.max(0,this.population[id]);}
          let sum=0;
          for(let cut=min;cut<max;cut++){
            sum+=histogram[cut-min];if(sum===0||sum===total)continue;
            const err=Math.abs(sum-wanted)/total;
            const shapePenalty=.015*(axis==='row'?(maxC-minC+1)/(maxR-minR+1):(maxR-minR+1)/(maxC-minC+1));
            const score=err+shapePenalty;if(!best||score<best.score)best={axis,cut,score};
          }
        }
        if(!best){split(ids,1);return;}
        const left=[],right=[];
        for(const id of ids){const v=best.axis==='row'?Math.floor(id/width):id%width;(v<=best.cut?left:right).push(id);}
        split(left,leftParts);split(right,parts-leftParts);
      };
      if(selected.length)split(selected,k);
      compactPartition(selected,labels,this.population,width,groups.length);
      connectFragments(selected,labels,this.population,width,this.meta.height,groups.length);
      // Split any disconnected boundary fragments: every displayed group is 4-connected.
      const visited=new Uint8Array(labels.length),connected=[],queue=[];
      for(const seed of selected){
        if(visited[seed])continue;const original=labels[seed],ids=[];queue.length=0;queue.push(seed);visited[seed]=1;let head=0,total=0,weighted=0;
        while(head<queue.length){
          const id=queue[head++];ids.push(id);const p=Math.max(0,this.population[id]);total+=p;weighted+=p*this.distances[id];
          const row=Math.floor(id/width),col=id%width;
          for(const next of [row>0?id-width:-1,row<this.meta.height-1?id+width:-1,col>0?id-1:-1,col<width-1?id+1:-1])if(next>=0&&!visited[next]&&labels[next]===original){visited[next]=1;queue.push(next);}
        }
        const id=connected.length;connected.push({id,population:total,cells:ids.length,distance:total?weighted/total:this.distances[seed]});for(const index of ids)labels[index]=id;
      }
      const ordered=connected.filter(g=>g.population>0).sort((a,b)=>a.distance-b.distance||a.id-b.id);
      const ranks=new Int32Array(connected.length).fill(-1);let cumulative=0;
      const cellSize=this.meta.cell_size_m||100,areaFactor=(cellSize/100)**2;
      ordered.forEach((g,rank)=>{ranks[g.id]=rank;cumulative+=g.population;g.rank=rank;g.cumulativePopulation=cumulative;g.areaKm2=g.cells*cellSize*cellSize/1e6;g.deviation=g.population-target;});
      for(const id of selected)labels[id]=ranks[labels[id]];
      this.current={selected,labels,groups:ordered,center,radius:municipal?null:radius,stats};
      const bars=[];
      for(const id of selected)if(this.population[id]>0){
        const row=Math.floor(id/width),col=id%width;
        bars.push({type:'Feature',id,properties:{population:this.population[id],density:this.population[id]/areaFactor,cell_size_m:cellSize,rank:labels[id],grid_id:`E${this.meta.x0+col*cellSize}N${this.meta.y0-(row+1)*cellSize}`},geometry:{type:'Polygon',coordinates:[[this.corner(row,col),this.corner(row+1,col),this.corner(row+1,col+1),this.corner(row,col+1),this.corner(row,col)]]}});
      }
      const masks=[];
      // Merge unpopulated runs to avoid constructing hundreds of thousands of polygons.
      for(let row=0;row<this.meta.height;row++){
        let col=0;
        while(col<width){
          const id=row*width+col,p=this.population[id];
          if(!inside[id]||p>0||(municipal&&this.landMask&&!this.landMask[id])){col++;continue;}const start=col,status=p<0?-1:0;col++;
          while(col<width&&inside[row*width+col]&&(!municipal||!this.landMask||this.landMask[row*width+col])&&(this.population[row*width+col]<0?-1:this.population[row*width+col]===0?0:1)===status)col++;
          masks.push({type:'Feature',properties:{status},geometry:{type:'Polygon',coordinates:[[this.corner(row,start),this.corner(row+1,start),this.corner(row+1,col),this.corner(row,col),this.corner(row,start)]]}});
        }
      }
      const ring=municipal?null:Geo.circle(center,radius),bounds=municipal?Geo.bounds(this.municipality.geometry):[[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1]))],[Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))]];
      return{area:municipal?'municipality':'circle',center,radius:municipal?null:radius,bounds,stats,groups:ordered,targetGroupPopulation:target,limits:{center:centerLimited,population:populationLimited,bars:barLimited,groups:requestedGroups>groupCap},maxReachablePopulation:municipal?stats.population:this.prefix[this.prefix.length-1],bars:collection(bars),masks:collection(masks),boundary:municipal?collection([this.municipality]):collection([{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:ring}}]),computeMs:performance.now()-started};
    }
  }
  function supply(groups,watts,availableMW){
    if(!Number.isFinite(watts)||watts<=0)throw new Error('W/person måste vara större än noll');
    const totalPopulation=groups.length?groups[groups.length-1].cumulativePopulation:0;
    const demandMW=totalPopulation*watts/1e6,available=Math.max(0,Math.min(demandMW,Number(availableMW)||0));
    let lo=0,hi=groups.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(groups[mid].cumulativePopulation*watts/1e6<=available+1e-9)lo=mid+1;else hi=mid;}
    const litPopulation=lo?groups[lo-1].cumulativePopulation:0,usedMW=litPopulation*watts/1e6;
    return{litGroups:lo,darkGroups:groups.length-lo,litPopulation,darkPopulation:totalPopulation-litPopulation,litPercent:totalPopulation?litPopulation/totalPopulation*100:0,demandMW,availableMW:available,usedMW,unusedMW:Math.max(0,available-usedMW),missingMW:demandMW-usedMW};
  }
  const api={PopulationModel,supply,decodeCoordinates};root.StockholmModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
