const key=(x,y)=>`${x},${y}`;

export function addMountains(track, random) {
  track.mountains=new Set();track.tunnels=[];track.tunnelCells=new Map();
  // One route gets a concealed middle; its approaches and other shortcuts stay open.
  const route=track.shortcuts.find(r=>r.cells.length>=6);
  if(route){
    const dx=route.to.x-route.from.x,dy=route.to.y-route.from.y,length2=dx*dx+dy*dy;
    const cells=route.cells.filter(k=>{const p=track.cells.get(k),t=((p.x-route.from.x)*dx+(p.y-route.from.y)*dy)/length2;return t>.3&&t<.7&&!track.pit?.has(k);});
    if(cells.length){
      const points=cells.map(k=>track.cells.get(k)).sort((a,b)=>(a.x-b.x)*dx+(a.y-b.y)*dy);
      const tunnel={id:'tunnel-0',cells,portals:[points[0],points.at(-1)].map(p=>({x:p.x,y:p.y})),angle:Math.atan2(dy,dx)};
      track.tunnels.push(tunnel);for(const k of cells)track.tunnelCells.set(k,tunnel.id);
      for(const p of points)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){
        const k=key(p.x+x,p.y+y);if(x*x+y*y>10||!track.cells.has(k))continue;
        if(!track.road.has(k)||cells.includes(k))track.mountains.add(k);
      }
    }
  }
  // Mountains also exist when shortcuts are disabled; they never replace a road.
  const candidates=[...track.cells.values()].filter(p=>!track.road.has(key(p.x,p.y))&&p.distance>track.radius+4&&p.x>5&&p.y>5&&p.x<track.width-6&&p.y<track.height-6);
  for(let i=0;i<4&&candidates.length;i++){
    const center=candidates[Math.floor(random()*candidates.length)],r=3+Math.floor(random()*3);
    for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
      const k=key(center.x+x,center.y+y);if(x*x+y*y>r*r||!track.cells.has(k)||track.road.has(k))continue;track.mountains.add(k);
    }
  }
  // Distance from the ridge edge makes a continuous slope, not repeated peak tiles.
  track.mountainHeights=new Map();const frontier=[];
  for(const k of track.mountains){const p=track.cells.get(k);if([[1,0],[-1,0],[0,1],[0,-1]].some(([x,y])=>!track.mountains.has(key(p.x+x,p.y+y)))){track.mountainHeights.set(k,0);frontier.push(k);}}
  for(let i=0;i<frontier.length;i++){const k=frontier[i],p=track.cells.get(k);for(const [x,y]of [[1,0],[-1,0],[0,1],[0,-1]]){const next=key(p.x+x,p.y+y);if(track.mountains.has(next)&&!track.mountainHeights.has(next)){track.mountainHeights.set(next,track.mountainHeights.get(k)+1);frontier.push(next);}}}
}

export function tunnelExposure(track,tunnel,cars) {
  let distance=Infinity;
  for(const car of cars)for(const k of tunnel.cells){const p=track.cells.get(k);distance=Math.min(distance,Math.hypot(car.x-p.x,car.y-p.y));}
  return Math.max(0,Math.min(1,(1.2-distance)*2));
}

function rock(ctx,p,cell,theme,track) {
  const x=p.x*cell,y=p.y*cell,n=((p.x*17+p.y*31)%7)/7,level=track.mountainHeights?.get(key(p.x,p.y))||0;
  const sand=theme.id==='sand',snow=theme.id==='sky',space=theme.id==='space';
  const palette=sand?['#635545','#817052','#a38d68','#c4b084','#decea4']:space?['#363744','#494a5b','#606174','#858597','#b0b1ba']:snow?['#607a7c','#809c9c','#a4bdb8','#cedcd0','#eff8ed']:['#3a4841','#536158','#748073','#9ba18b','#c9cbb3'];
  ctx.fillStyle=palette[Math.min(level,4)];ctx.fillRect(x,y,cell,cell);
  const up=track.mountainHeights?.get(key(p.x,p.y-1))??-1,left=track.mountainHeights?.get(key(p.x-1,p.y))??-1;
  if(up<level){ctx.fillStyle='#d8dec02b';ctx.fillRect(x,y,cell,4);}
  if(left<level){ctx.fillStyle='#d8dec024';ctx.fillRect(x,y,4,cell);}
  if((p.x+p.y)%3===0){ctx.fillStyle='#1c2b2b42';ctx.fillRect(x+5,y+10+n*9,18,3);ctx.fillRect(x+19,y+12+n*9,3,8);}
  if(level>=3&&(p.x*3+p.y)%4<2){ctx.fillStyle=snow?'#f6fff1':'#d9dac2';ctx.fillRect(x+3,y+2,cell-6,5);ctx.fillRect(x+8,y+7,cell-16,4);}
}

export function drawMountains(ctx,track,theme,cell) {
  for(const k of track.mountains||[])rock(ctx,track.cells.get(k),cell,theme,track);
  for(const tunnel of track.tunnels||[])for(const k of tunnel.cells){
    const p=track.cells.get(k),x=p.x*cell,y=p.y*cell;
    ctx.fillStyle='#222f34';ctx.fillRect(x,y,cell,cell);ctx.strokeStyle='#566568';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,cell,cell);
    ctx.fillStyle='#9d8d69';ctx.fillRect(x+5,y+cell-5,cell-10,2);
    if((p.x+p.y)%3===0){ctx.fillStyle='#ffd174';ctx.fillRect(x+3,y+3,4,4);ctx.fillStyle='#ffd17418';ctx.fillRect(x,y,cell,cell);}
  }
}

export function drawTunnelRoofs(ctx,track,theme,cell,cars=[]) {
  let revealed=0;
  for(const tunnel of track.tunnels||[]){
    const exposure=tunnelExposure(track,tunnel,cars);if(exposure>.5)revealed++;
    ctx.save();ctx.globalAlpha=1-exposure;
    for(const k of tunnel.cells)rock(ctx,track.cells.get(k),cell,theme,track);
    ctx.restore();
    for(const p of tunnel.portals){ctx.save();ctx.translate((p.x+.5)*cell,(p.y+.5)*cell);ctx.rotate(tunnel.angle);
      ctx.globalAlpha=1-exposure;ctx.fillStyle='#161f25';ctx.fillRect(-9,-12,18,24);ctx.globalAlpha=1;ctx.fillStyle='#989b8a';ctx.fillRect(-12,-15,24,4);ctx.fillRect(-12,-15,4,30);ctx.fillRect(8,-15,4,30);ctx.restore();}
  }
  return revealed;
}
