const key = (x, y) => `${x},${y}`;
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function addRaceFacilities(track, random) {
  track.pit = new Set(); track.spikes = new Map(); track.oil = new Map();
  const edges = [...track.road].map(k => track.cells.get(k)).filter(p => Math.hypot(p.x-track.start.x,p.y-track.start.y)>15);
  const offset = Math.floor(random()*edges.length);
  search: for(let i=0;i<edges.length;i++) {
    const entry=edges[(i+offset)%edges.length];
    for(const [nx,ny] of directions) {
      if(track.road.has(key(entry.x+nx,entry.y+ny)))continue;
      for(const sign of [-1,1]) for(const depth of [2,3,4]) for(const length of [6,8,10]) {
        const dx=-ny*sign,dy=nx*sign,route=[entry];
        for(let n=1;n<=depth;n++)route.push({x:entry.x+nx*n,y:entry.y+ny*n});
        for(let n=1;n<=length;n++)route.push({x:entry.x+nx*depth+dx*n,y:entry.y+ny*depth+dy*n});
        for(let n=depth-1;n>=0;n--)route.push({x:entry.x+nx*n+dx*length,y:entry.y+ny*n+dy*length});
        const exit=track.cells.get(key(route.at(-1).x,route.at(-1).y));
        if(!exit||!track.road.has(key(exit.x,exit.y)))continue;
        let arc=exit.s-entry.s;if(arc<0)arc+=track.length;
        if(arc<4||arc>24)continue;
        const inside=route.slice(1,-1);
        if(inside.some(p=>p.x<2||p.y<2||p.x>=track.width-2||p.y>=track.height-2||track.road.has(key(p.x,p.y))||Math.hypot(p.x-track.start.x,p.y-track.start.y)<12))continue;
        if(inside.some((p,j)=>directions.some(([x,y])=>track.road.has(key(p.x+x,p.y+y))&&!(j===0&&p.x+x===entry.x&&p.y+y===entry.y)&&!(j===inside.length-1&&p.x+x===exit.x&&p.y+y===exit.y))))continue;
        route.forEach((p,j)=>{const k=key(p.x,p.y);track.holes.delete(k);track.ramps.delete(k);if(j===0||j===route.length-1)return;track.road.add(k);track.pit.add(k);Object.assign(track.cells.get(k),{s:(entry.s+arc*j/(route.length-1))%track.length,distance:0,roadRadius:.5,pit:true});});
        track.pitRoute=route.map(p=>({x:p.x,y:p.y}));
        track.serviceCell=key(inside[Math.floor(inside.length/2)].x,inside[Math.floor(inside.length/2)].y);
        break search;
      }
    }
  }
  const candidates=edges.filter(p=>p.distance>1.2&&directions.some(([x,y])=>!track.road.has(key(p.x+x,p.y+y)))&&!track.holes.has(key(p.x,p.y))&&!track.ramps.has(key(p.x,p.y))&&(!track.pitRoute||track.pitRoute.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>4)));
  const count=Math.max(1,Math.round(track.length/90));
  for(let i=0;i<count&&candidates.length;i++){
    const p=candidates.splice(Math.floor(random()*candidates.length),1)[0];
    if([...track.spikes.values()].some(q=>Math.hypot(q.x-p.x,q.y-p.y)<8))continue;
    const side=directions.find(([x,y])=>!track.road.has(key(p.x+x,p.y+y)))||[1,0];
    track.spikes.set(key(p.x,p.y),{x:p.x,y:p.y,nx:side[0],ny:side[1]});
  }
}

export function vehicleHealth(track) {
  const extra=Math.min(4,Math.floor((track.holes.size+(track.spikes?.size||0))/8));
  return {tires:6+extra,engine:6+extra,body:8+extra};
}

export function applyRoadEffects(track, car, move) {
  const max=car.maxHealth||vehicleHealth(track);
  car.maxHealth={...max};car.health={...(car.health||max)};
  car.oilTurns=Math.max(0,(car.oilTurns||0)-1);car.punctureTurns=Math.max(0,(car.punctureTurns||0)-1);
  let oiled=false,punctured=false;const notes=[];
  const damage=(part,n)=>{car.health[part]=Math.max(0,car.health[part]-n);};
  for(const hit of move.roadEffects||[]){
    if(hit.kind==='repair') {car.health={...max};car.oilTurns=0;car.punctureTurns=0;car.slowTurns=0;notes.push('Full repair');}
    if(hit.kind==='hole'){damage('tires',1);damage('body',1);notes.push('Pothole damage');}
    if(hit.kind==='oil'&&!oiled){car.oilTurns=3;oiled=true;notes.push('Oil spin · 3 turns');}
    if(hit.kind==='spikes'&&!punctured){damage('tires',2);car.punctureTurns=3;punctured=true;notes.push('Punctured tires · 3 turns');}
    if(Object.values(car.health).some(n=>n===0))break;
  }
  if(move.crash){
    car.slowTurns=3;
    const speed=Math.hypot(move.vx,move.vy),severity=Math.min(3,1+Math.floor(speed/3));
    damage('body',severity);damage('engine',Math.max(0,severity-1));damage('tires',1);
    const k=key(move.stop.x,move.stop.y);
    if(speed>=3&&!track.pit?.has(k)){
      track.oil ||= new Map();track.oil.set(k,{x:move.stop.x,y:move.stop.y});notes.push('Oil spilled');
    }
  }
  car.wrecked=Object.values(car.health).some(n=>n===0);
  if(car.wrecked){car.vx=0;car.vy=0;notes.push('Out of the race');}
  return notes;
}
