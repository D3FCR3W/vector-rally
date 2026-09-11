import { crashPose, interpolateHeading } from './replay.js';

export function humanAnchor(cars, activeId, previousId) {
  return cars.find(c => c.id === activeId && c.control === 'human' && !c.wrecked)
    || cars.find(c => c.id === previousId && c.control === 'human' && !c.wrecked)
    || cars.find(c => c.control === 'human' && !c.wrecked)
    || cars.find(c => c.control === 'human');
}

export function cameraDrivers(cars, anchorId, mode = 'human', selected = []) {
  const anchor = cars.find(c => c.id === anchorId);
  if (mode === 'all' || (!anchor && mode !== 'selected')) return cars;
  if (mode === 'selected') return cars.filter(c => selected.includes(c.id));
  if (mode !== 'nearby') return anchor ? [anchor] : [];
  const ordered = cars.filter(c => !c.wrecked || c.id === anchorId).sort((a,b) => b.progress-a.progress || a.id-b.id);
  const i = ordered.findIndex(c => c.id === anchorId);
  return ordered.slice(Math.max(0,i-1), i+2);
}

export function livePose(car, motion, time) {
  if (!motion) return car;
  const t = Math.max(0,Math.min(1,(time-motion.start)/motion.duration)), easing=1-(1-t)**2;
  const pose = motion.move.crash ? crashPose(motion.from,car,motion.move.contact,t)
    : {x:motion.from.x+(car.x-motion.from.x)*easing,y:motion.from.y+(car.y-motion.from.y)*easing};
  return {...car,...pose,renderLift:motion.move.jumps?Math.sin(Math.PI*t)*18:0,
    renderHeading:motion.move.spin ? motion.from.heading+motion.move.spin*t : interpolateHeading(motion.from.heading,car.heading,t)};
}

// Critically damped camera: continuous velocity, no overshoot for a fixed target.
// The exact spring solution keeps the response consistent at different refresh rates.
export function stepCamera(camera, target, velocity, dt) {
  if(dt<=0)return ['x','y','zoom'].some(key=>camera[key]!==target[key]||velocity[key]);
  const omega=14, seconds=Math.max(0,Math.min(.05,dt)), decay=Math.exp(-omega*seconds);
  let moving=false;
  for(const key of ['x','y','zoom']){
    const offset=camera[key]-target[key], speed=velocity[key]||0, impulse=speed+omega*offset;
    const next=target[key]+(offset+impulse*seconds)*decay;
    const nextSpeed=(speed-omega*impulse*seconds)*decay;
    const epsilon=key==='zoom'?.0001:.01;
    if(Math.abs(next-target[key])<epsilon&&Math.abs(nextSpeed)<epsilon){camera[key]=target[key];velocity[key]=0;}
    else{camera[key]=next;velocity[key]=nextSpeed;moving=true;}
  }
  return moving;
}

// Fit the group and the human's reachable squares into the area above the HUD.
export function groupCamera(cars, width, height, anchor, maxZoom=1.5) {
  if (!cars.length) return null;
  const points=cars.map(c=>({x:(c.x+.5)*32,y:(c.y+.5)*32}));
  if(anchor)for(const dx of [-1,1])for(const dy of [-1,1])points.push({x:(anchor.x+anchor.vx+dx+.5)*32,y:(anchor.y+anchor.vy+dy+.5)*32});
  const left=22,right=width-22,top=height<600?105:155,bottom=Math.max(top+90,height-(width<600?365:235));
  const minX=Math.min(...points.map(p=>p.x))-38,maxX=Math.max(...points.map(p=>p.x))+38;
  const minY=Math.min(...points.map(p=>p.y))-48,maxY=Math.max(...points.map(p=>p.y))+38;
  const zoom=Math.min(maxZoom,(right-left)/(maxX-minX),(bottom-top)/(maxY-minY));
  return {zoom,x:(minX+maxX)/2-((left+right)/2-width/2)/zoom,y:(minY+maxY)/2-((top+bottom)/2-height/2)/zoom,following:true};
}
