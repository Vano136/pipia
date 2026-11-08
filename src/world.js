import * as THREE from 'three';
import { MISSIONS } from './config.js';

const mat=(color,roughness=.8,metalness=.05,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
const addBox=(group,w,h,d,material,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y+h/2,z);m.castShadow=h>2;m.receiveShadow=true;group.add(m);return m;};
const plane=(group,w,d,material,x,y,z)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m;};

function makeSignTexture(lines,accent='#8af6df'){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#091923';c.fillRect(0,0,640,256);c.fillStyle=accent;c.fillRect(0,0,8,256);c.fillStyle='#d8f8f4';c.font='800 42px Arial';c.textAlign='left';
  lines.forEach((line,i)=>c.fillText(line,34,76+i*56));
  c.fillStyle='#6f929f';c.font='18px Arial';c.fillText('VELOCITY CITY  /  CITY 01',34,226);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function makeRoadTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');
  c.fillStyle='#30383c';c.fillRect(0,0,512,512);
  // Asphalt micro-grain, deterministic to avoid external textures.
  for(let i=0;i<7000;i++){const x=(i*73)%512,y=(i*139)%512;c.fillStyle=i%3===0?'rgba(255,255,255,.025)':'rgba(0,0,0,.05)';c.fillRect(x,y,1+(i%2),1);}
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1,1);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function addRoadLine(group,x,z,w,d,color='#e9e9d9',opacity=1){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity}));m.rotation.x=-Math.PI/2;m.position.set(x,.035,z);group.add(m);}
function buildBuilding(group,x,z,w,d,h,index){
  const colors=['#354b57','#40535f','#273b49','#51616a','#384e5b'];const base=mat(colors[index%colors.length],.48,.45);const glass=mat(index%2?'#83aeb7':'#52808d',.25,.7,{emissive:'#07151b',emissiveIntensity:.2});const roof=mat('#182c36',.4,.5);
  addBox(group,w,h,d,base,x,h*.0,z);
  addBox(group,w*.96,.28,d*.96,roof,x,h,z);
  const rows=Math.max(2,Math.floor(h/3));const cols=Math.max(2,Math.floor(w/2.7));
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const wx=x-w/2+.85+c*(w-1.7)/Math.max(1,cols-1);const wz=z-d/2-.012;
    const wy=1.1+r*(h-2)/Math.max(1,rows-1);
    const win=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.35,w/cols*.65),1.05),glass);win.position.set(wx,wy,wz);group.add(win);
    const win2=win.clone();win2.rotation.y=Math.PI;win2.position.z=z+d/2+.012;group.add(win2);
  }
  // Vertical lit corner details.
  for(const side of [-1,1]){
    const strip= new THREE.Mesh(new THREE.BoxGeometry(.07,h*.82,.08),mat('#6dd2d0',.3,.5,{emissive:'#1e8179',emissiveIntensity:.45}));strip.position.set(x+side*(w/2-.16),h*.51,z);group.add(strip);
  }
  return {x,z,w,d,h};
}
function addTree(group,x,z,scale=1){
  const trunk=mat('#594637',.9);const leaf=mat('#2f7767',.86,.02);const wood=new THREE.Mesh(new THREE.CylinderGeometry(.12*scale,.17*scale,1.7*scale,8),trunk);wood.position.set(x,.85*scale,z);group.add(wood);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05*scale,1),leaf);crown.position.set(x,2.1*scale,z);crown.castShadow=true;group.add(crown);
  const crown2=new THREE.Mesh(new THREE.IcosahedronGeometry(.68*scale,1),leaf);crown2.position.set(x+.55*scale,2.15*scale,z+.22*scale);group.add(crown2);
}
function addLamp(group,x,z){
  const dark=mat('#1e2b33',.5,.65);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,5.5,8),dark);pole.position.set(x,2.75,z);group.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.9,.055,.055),dark);arm.position.set(x+.38,5.35,z);group.add(arm);
  const light=new THREE.PointLight('#ffe4b3',.45,17,2);light.position.set(x+.75,5.18,z);group.add(light);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),mat('#fff1cc',.3,.1,{emissive:'#ffdb9d',emissiveIntensity:1.2}));bulb.position.copy(light.position);group.add(bulb);
}
function addContainer(group,x,z,color){
  const base=mat(color,.72,.25);addBox(group,2.5,2.65,8,base,x,0,z);
  const rib=mat('#101c24',.7,.35);
  for(let i=0;i<15;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.035,2.5,.06),rib);bar.position.set(x-1.18+i*.17,1.33,z-4.02);group.add(bar);const b2=bar.clone();b2.position.z=z+4.02;group.add(b2);}
}
function addParkingBox(group,mission){
  const boxGroup=new THREE.Group();boxGroup.position.set(mission.x,.08,mission.z);boxGroup.rotation.y=mission.angle;const green=mat('#67ffd2',.25,.15,{emissive:'#23d9a4',emissiveIntensity:.45,transparent:true,opacity:.78});
  const edge=new THREE.Mesh(new THREE.BoxGeometry(3.5,.045,6.3),green);boxGroup.add(edge);
  const wire=new THREE.EdgesGeometry(new THREE.BoxGeometry(3.5,.06,6.3));const lines=new THREE.LineSegments(wire,new THREE.LineBasicMaterial({color:'#8bffe0'}));lines.position.y=.04;boxGroup.add(lines);
  const target=new THREE.Mesh(new THREE.RingGeometry(1.05,1.15,32),new THREE.MeshBasicMaterial({color:'#70ffca',side:THREE.DoubleSide}));target.rotation.x=-Math.PI/2;target.position.y=.07;boxGroup.add(target);
  const glow=new THREE.PointLight('#42ffc2',.7,9,2);glow.position.set(0,1.2,0);boxGroup.add(glow);
  group.add(boxGroup);return boxGroup;
}

export function createWorld(scene){
  const staticColliders=[],missionMarkers=[],showroomCars=[],speedTraps=[];
  const grass=mat('#1c3435',1,0);const sidewalk=mat('#59676b',.9,.08);const road=mat('#30383c',.96,.03);const concrete=mat('#737c80',.95,.02);const white=mat('#e8e9df',.8);const yellow=mat('#e9c45b',.8);const neon=mat('#5cf5d2',.35,.2,{emissive:'#28a889',emissiveIntensity:.45});
  const asphaltTexture=makeRoadTexture();road.map=asphaltTexture;road.needsUpdate=true;
  plane(scene,700,700,grass,0,-.08,0);
  // City grid: a cohesive network of roads, pavements and painted lane separators.
  for(let n=-2;n<=2;n++){
    const p=n*42;
    plane(scene,13,210,road,p,.005,0);plane(scene,210,13,road,0,.006,p);
    plane(scene,2.4,210,sidewalk,p-8,.015,0);plane(scene,2.4,210,sidewalk,p+8,.015,0);
    plane(scene,210,2.4,sidewalk,0,.015,p-8);plane(scene,210,2.4,sidewalk,0,.015,p+8);
    for(let z=-95;z<100;z+=12){addRoadLine(scene,p-.08,z,.12,5.2,'#dedbd0',.72);}
    for(let x=-95;x<100;x+=12){addRoadLine(scene,x,p-.08,5.2,.12,'#dedbd0',.72);}
    for(let k=-1;k<=1;k+=2){for(let t=-2;t<=2;t++){const wx=p+k*3.5+t*.74;addRoadLine(scene,wx,p-7.1,.48,2.2,'#eeeeea',.85);}}
  }
  // Rectangular autobahn ring with four lanes, shoulders, dash marks and crash barriers.
  const highwaySegments=[{x:0,z:-160,w:360,d:26},{x:0,z:160,w:360,d:26},{x:-160,z:0,w:26,d:320,rot:true},{x:160,z:0,w:26,d:320,rot:true}];
  for(const s of highwaySegments){plane(scene,s.w,s.d,road,s.x,.018,s.z);plane(scene,s.w+3,s.d+3,sidewalk,s.x,-.005,s.z);
    if(!s.rot){for(let x=s.x-s.w/2+6;x<s.x+s.w/2;x+=11){addRoadLine(scene,x,s.z,5,.16,'#f5f1da');}for(const offset of [-8,8])addRoadLine(scene,s.x,s.z+offset,s.w,.11,'#e7dfbc');}
    else{for(let z=s.z-s.d/2+6;z<s.z+s.d/2;z+=11)addRoadLine(scene,s.x,z,.16,5,'#f5f1da');for(const offset of [-8,8])addRoadLine(scene,s.x+offset,s.z,.11,s.d,'#e7dfbc');}
    const barrierMat=mat('#8d999e',.6,.55);
    if(!s.rot){for(const side of [-1,1]){const b=addBox(scene,s.w,.7,.24,barrierMat,s.x,.0,s.z+side*13.2);staticColliders.push({position:{x:s.x,y:0,z:s.z+side*13.2},size:{x:s.w,y:.7,z:.24}});}}
    else{for(const side of [-1,1]){addBox(scene,.24,.7,s.d,barrierMat,s.x+side*13.2,0,s.z);staticColliders.push({position:{x:s.x+side*13.2,y:0,z:s.z},size:{x:.24,y:.7,z:s.d}});}}
  }
  // Four feeder roads join the downtown grid directly to the outer highway ring.
  plane(scene,13,55,road,0,.02,-126);plane(scene,13,55,road,0,.02,126);
  plane(scene,55,13,road,-126,.02,0);plane(scene,55,13,road,126,.02,0);
  for(let z=-148;z<=-104;z+=10)addRoadLine(scene,0,z,.14,4.5,'#e7e3d6');
  for(let z=104;z<=148;z+=10)addRoadLine(scene,0,z,.14,4.5,'#e7e3d6');
  for(let x=-148;x<=-104;x+=10)addRoadLine(scene,x,0,4.5,.14,'#e7e3d6');
  for(let x=104;x<=148;x+=10)addRoadLine(scene,x,0,4.5,.14,'#e7e3d6');
  // City-block centre lines use short amber dashes to distinguish two-way traffic.
  for(let n=-2;n<=2;n++)for(let t=-96;t<100;t+=16){addRoadLine(scene,n*42,t,.16,5.5,'#e4c76b',.84);addRoadLine(scene,t,n*42,5.5,.16,'#e4c76b',.84);}
  // City blocks are seeded by a fixed layout for reliable map geometry.
  const buildingRects=[];let buildingIndex=0;
  const blockPoints=[];
  for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){
    if(Math.abs(x)<=1&&Math.abs(z)<=1)continue;
    blockPoints.push({x:x*42,z:z*42});
  }
  for(const p of blockPoints){
    const bx=p.x+(p.x<0?-11:11),bz=p.z+(p.z<0?-11:11);const w=13+(buildingIndex%3)*2,d=14+(buildingIndex%4)*1.4,h=12+(buildingIndex%5)*5;
    const b=buildBuilding(scene,bx,bz,w,d,h,buildingIndex++);buildingRects.push(b);staticColliders.push({position:{x:bx,y:0,z:bz},size:{x:w,y:h,z:d}});
    if(buildingIndex%2===0){addTree(scene,p.x+(p.x<0?11:-11),p.z+(p.z<0?10:-10),.75);}
  }
  // Street furniture along key downtown avenues.
  for(let t=-3;t<=3;t++){const p=t*42;addLamp(scene,p+10,-32);addLamp(scene,-32,p+10);addTree(scene,p+12,12,.78);}
  // Crosswalks around the central intersection.
  for(let k=-1;k<=1;k+=2){for(let i=0;i<9;i++){addRoadLine(scene,k*7.2+i*1.7,-7.5,1.05,3.2,'#f0f1ed',.9);addRoadLine(scene,-7.5,k*7.2+i*1.7,3.2,1.05,'#f0f1ed',.9);}}
  // Drift plaza and clipping-point arena.
  plane(scene,112,104,concrete,110,.025,85);
  const arenaLine=mat('#3c555b',.6,.1);const ring=new THREE.Mesh(new THREE.TorusGeometry(36,.15,8,96),arenaLine);ring.rotation.x=Math.PI/2;ring.position.set(110,.09,85);scene.add(ring);
  const clipPositions=[{x:78,z:53},{x:142,z:53},{x:78,z:117},{x:142,z:117}];
  clipPositions.forEach(p=>{const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,.06,32),neon);pad.position.set(p.x,.07,p.z);scene.add(pad);const ring2=new THREE.Mesh(new THREE.TorusGeometry(1.65,.08,8,32),new THREE.MeshBasicMaterial({color:'#67ffe0'}));ring2.rotation.x=Math.PI/2;ring2.position.set(p.x,.12,p.z);scene.add(ring2);});
  addContainer(scene,61,72,'#2c7281');addContainer(scene,158,72,'#a65c36');addContainer(scene,61,101,'#667d45');addContainer(scene,158,101,'#3f557f');
  for(let x=75;x<150;x+=12){const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,1.05,16),mat('#b45b32',.75,.1));barrel.position.set(x,.53,130);scene.add(barrel);}
  // Parking bays and their glowing 3D guides.
  MISSIONS.forEach(m=>missionMarkers.push({data:m,mesh:addParkingBox(scene,m),active:false}));
  // Gas station with canopy, fuel islands and service pads.
  plane(scene,50,38,concrete,-50,.02,-103);
  addBox(scene,26,.55,15,mat('#d7e0df',.55,.22),-50,5,-103);addBox(scene,26,.18,15,mat('#1d6f75',.35,.2,{emissive:'#12383b',emissiveIntensity:.2}),-50,4.67,-103);
  for(const x of [-59,-50,-41]){addBox(scene,.25,4,.25,mat('#c2cccd',.4,.6),x,.0,-103);const pump=addBox(scene,1.1,1.7,.8,mat('#e3e8e6',.3,.2),x,.0,-103);addBox(scene,.62,.07,.035,neon,x,.95,-103.42);}
  const triggerPad=(name,x,z,color)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.3,.07,36),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.48}));mesh.position.set(x,.09,z);scene.add(mesh);const ringM=new THREE.Mesh(new THREE.TorusGeometry(3.45,.1,8,36),new THREE.MeshBasicMaterial({color}));ringM.rotation.x=Math.PI/2;ringM.position.set(x,.13,z);scene.add(ringM);return {name,x,z,radius:4.5,mesh};};
  const serviceZones=[triggerPad('REFUEL',-50,-112,'#63e4b4'),triggerPad('SERVICE BAY',-31,-112,'#6abaff'),triggerPad('CAR WASH',-12,-112,'#6ee4ed')];
  // Service workshop building and doors.
  addBox(scene,27,7,13,mat('#425762',.55,.35),-29,0,-139);addBox(scene,7,.05,.15,mat('#86d6cf',.25,.5,{emissive:'#228c88',emissiveIntensity:.45}),-29,5,-132.4);
  // Glass dealership building, marked display bays and stat boards.
  plane(scene,46,39,concrete,-105,.025,34);addBox(scene,29,8,20,mat('#253f4b',.3,.55),-105,0,29);
  const showroomGlass=mat('#8cc9cd',.15,.75,{transparent:true,opacity:.2});addBox(scene,28,6.6,.12,showroomGlass,-105,0,18.8);addBox(scene,.12,6.6,19,showroomGlass,-119.5,0,29);addBox(scene,.12,6.6,19,showroomGlass,-90.5,0,29);
  const showroomSlots=[{x:-119,z:47},{x:-105,z:47},{x:-91,z:47},{x:-119,z:23},{x:-105,z:23},{x:-91,z:23}];
  showroomSlots.forEach((p,i)=>{
    // Detailed vehicle geometry is assembled in main.js from the same procedural car builder used by the garage.
    showroomCars.push({slot:p,index:i});
    const board=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.8),new THREE.MeshBasicMaterial({map:makeSignTexture([['CIVIC HATCH','BAVARIA E36','JDM SUPRA','SKYLINE R34','EXECUTIVE M5','HYPER W16'][i],`${[160,286,330,380,625,925][i]} HP  /  ${[210,320,440,470,750,1200][i]} NM`]),side:THREE.DoubleSide}));board.position.set(p.x,4.3,p.z-2.2);scene.add(board);
  });
  // Overpass and stunt ramp: elevated concrete deck with support piers and striped ends.
  plane(scene,92,16,concrete,112,.03,-120);addBox(scene,92,.65,16,mat('#69777c',.85,.08),112,2.6,-120);
  for(let x=72;x<=152;x+=16)addBox(scene,1.4,5,1.4,mat('#52636b',.85,.1),x,0,-120);
  const rampGeo=new THREE.BufferGeometry();const verts=new Float32Array([70,.1,-132,86,2.6,-132,86,2.6,-108,70,.1,-108,70,.1,-132,86,2.6,-132,86,2.6,-108,70,.1,-108]);rampGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));rampGeo.setIndex([0,2,1,0,3,2]);rampGeo.computeVertexNormals();scene.add(new THREE.Mesh(rampGeo,mat('#69777c',.85,.05)));
  // Toll gates and overhead gantries.
  for(const p of [{x:-160,z:-160},{x:160,z:160}]){addBox(scene,1,6,1,mat('#7b898f',.5,.65),p.x-15,0,p.z);addBox(scene,1,6,1,mat('#7b898f',.5,.65),p.x+15,0,p.z);addBox(scene,32,.7,1.1,mat('#1c3944',.3,.55),p.x-0,6,p.z);}
  // Speed trap camera tripwires positioned around the highway loop.
  for(const p of [{x:0,z:-160,axis:'x'},{x:160,z:0,axis:'z'},{x:0,z:160,axis:'x'},{x:-160,z:0,axis:'z'}]){
    const post1=addBox(scene,.2,4,.2,mat('#3f535d',.45,.5),p.axis==='x'?-8:p.x,0,p.axis==='x'?p.z:p.z-8);
    addBox(scene,1.1,.55,.8,mat('#172832',.25,.55),p.axis==='x'?-8:p.x,3.4,p.axis==='x'?p.z:p.z-8);
    const flash=new THREE.PointLight('#ffffff',0,18,2);flash.position.copy(post1.position).add(new THREE.Vector3(0,3.5,0));scene.add(flash);
    speedTraps.push({x:p.x,z:p.z,axis:p.axis,flash,cooldown:0});
  }
  // Road signs and street-side detail.
  for(const [x,z,label] of [[-18,-150,'CITY CENTRE  →'],[180,25,'DRIFT ARENA  ↑'],[-180,25,'GAS / SERVICE  ←']]){
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(8,2.2),new THREE.MeshBasicMaterial({map:makeSignTexture([label,'SPEED LIMIT 120'], '#80f2d5'),side:THREE.DoubleSide}));sign.position.set(x,7,z);scene.add(sign);addBox(scene,.18,7,.18,mat('#50616c'),x,0,z);
  }
  const triggerZones=[...serviceZones,{name:'SHOWROOM',x:-105,z:34,radius:12},{name:'DRIFT ARENA',x:110,z:85,radius:54}];
  const mapBounds={min:-190,max:190};
  return {staticColliders,missionMarkers,showroomCars,speedTraps,triggerZones,buildingRects,mapBounds,serviceZones};
}

export function updateMinimap(canvas,carPosition,carYaw,worldData){
  const ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#091821';ctx.fillRect(0,0,w,h);
  const scale=w/400;const px=x=>w/2+x*scale;const pz=z=>h/2+z*scale;
  ctx.strokeStyle='#52636b';ctx.lineWidth=13*scale;ctx.lineCap='butt';
  for(let p=-84;p<=84;p+=42){ctx.beginPath();ctx.moveTo(px(p),pz(-100));ctx.lineTo(px(p),pz(100));ctx.stroke();ctx.beginPath();ctx.moveTo(px(-100),pz(p));ctx.lineTo(px(100),pz(p));ctx.stroke();}
  ctx.strokeStyle='#79898d';ctx.lineWidth=24*scale;ctx.strokeRect(px(-160),pz(-160),320*scale,320*scale);
  ctx.strokeStyle='#182a32';ctx.lineWidth=18*scale;ctx.strokeRect(px(-160),pz(-160),320*scale,320*scale);
  ctx.fillStyle='#52666d';worldData.buildingRects.forEach(b=>ctx.fillRect(px(b.x-b.w/2),pz(b.z-b.d/2),b.w*scale,b.d*scale));
  ctx.fillStyle='#7e8e91';ctx.fillRect(px(110-56),pz(85-52),112*scale,104*scale);
  ctx.fillStyle='#264b51';ctx.fillRect(px(-74),pz(-122),49*scale,38*scale);
  ctx.fillStyle='#53dcbf';ctx.beginPath();ctx.arc(px(-50),pz(-112),4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#8ce7d5';worldData.missionMarkers.forEach(m=>{ctx.fillRect(px(m.data.x)-2,pz(m.data.z)-2,4,4);});
  const x=px(carPosition.x),y=pz(carPosition.z);ctx.save();ctx.translate(x,y);ctx.rotate(carYaw);ctx.fillStyle='#ffffff';ctx.shadowColor='#59f6d2';ctx.shadowBlur=9;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,7);ctx.lineTo(0,4);ctx.lineTo(-5,7);ctx.closePath();ctx.fill();ctx.restore();
}
