import * as THREE from 'three';
import { CARS, DEFAULT_BUILD, MISSIONS } from './config.js';
import { loadSave, persist } from './storage.js';
import { buildCarModel, updateCarVisual } from './cars.js';
import { VehiclePhysics } from './physics.js';
import { createWorld, updateMinimap } from './world.js';
import { SynthAudio } from './audio.js';
import { ParticleEffects } from './effects.js';
import { GameUI } from './ui.js';

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrapAngle=a=>{while(a>Math.PI)a-=Math.PI*2;while(a< -Math.PI)a+=Math.PI*2;return a;};

const save=loadSave();
let paused=false,walking=false,headlightsOn=false,health=100,engineTemp=82,driftBank=0,activeMission=null,interactionAction=null,zoneName='DOWNTOWN',signalState={left:false,right:false,hazard:false};
let walkPos=new THREE.Vector3(),walkVelocity={x:0,y:0};let cameraYaw=0,cameraPitch=.18,activeModel=null,activeSpec=null,activeBuild=null,telemetry=null;

const scene=new THREE.Scene();scene.background=new THREE.Color('#9bb7bc');scene.fog=new THREE.Fog('#9bb7bc',120,390);
const camera=new THREE.PerspectiveCamera(62,window.innerWidth/window.innerHeight,.1,900);camera.position.set(0,5,10);
const renderer=new THREE.WebGLRenderer({canvas:$('game-canvas'),antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));renderer.setSize(window.innerWidth,window.innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const hemi=new THREE.HemisphereLight('#d4f4ff','#243b3d',1.8);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d3',2.25);sun.position.set(-95,145,70);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-220;sun.shadow.camera.right=220;sun.shadow.camera.top=220;sun.shadow.camera.bottom=-220;sun.shadow.bias=-.00025;scene.add(sun);
const fill=new THREE.DirectionalLight('#69c8d3',.55);fill.position.set(90,50,-90);scene.add(fill);
const worldData=createWorld(scene);

const physics=new VehiclePhysics();
for(const c of worldData.staticColliders)physics.addCollider(c.position,c.size);
const effects=new ParticleEffects(scene);const audio=new SynthAudio();
window.addEventListener('pointerdown',()=>audio.init(),{once:true});window.addEventListener('touchstart',()=>audio.init(),{once:true,passive:true});

// Place full procedural vehicle geometry in the showroom; the city does not load any model files.
for(let i=0;i<worldData.showroomCars.length;i++){
  const slot=worldData.showroomCars[i];
  const spec=CARS[i],build=DEFAULT_BUILD();build.visual.body=spec.color;build.visual.metallic='#c7d4dc';build.visual.rimStyle=['5-Spoke','BBS Mesh','Deep Dish','Turbine','Multi-Spoke','5-Spoke'][i];
  const display=buildCarModel(spec,build);display.position.set(slot.slot.x,0,slot.slot.z);display.scale.setScalar(.78);display.rotation.y=Math.PI;scene.add(display);slot.group=display;
}

function createActiveCar(carId,teleport=true){
  const spec=CARS.find(c=>c.id===carId)||CARS[0];const build=save.builds[spec.id]||DEFAULT_BUILD();
  if(activeModel)scene.remove(activeModel);
  activeSpec=spec;activeBuild=build;activeModel=buildCarModel(spec,build);scene.add(activeModel);
  physics.setVehicle(spec,build,activeModel);physics.driveMode=build.drive||spec.type;
  physics.engineRunning=save.settings.engine!==false;physics.manual=!!save.settings.manual;
  if(teleport)physics.reset({x:0,z:0,yaw:0});
  save.selected=spec.id;save.settings.drive=physics.driveMode;walkPos.copy(activeModel.position);
  persist(save);updateGarageActiveData();
}
function updateGarageActiveData(){if(!activeSpec)return;}
createActiveCar(save.selected,false);
physics.chassis.position.set(0,.83,0);physics.chassis.quaternion.setFromAxisAngle(new (physics.chassis.position.constructor)(0,1,0),0);

const ui=new GameUI(save,{
  onPause:value=>{paused=value;},
  onInput:(name,value)=>physics.setInput(name,value),
  onGear:mode=>{physics.setGear(mode);physics.manual=false;save.settings.manual=false;},
  onManualShift:direction=>{physics.manual=true;save.settings.manual=true;physics.shift(direction);},
  onSettings:settings=>{physics.engineRunning=settings.engine;physics.manual=!!settings.manual;persist(save);},
  onBuildChange:id=>{if(id===activeSpec.id){activeBuild=save.builds[id];physics.driveMode=activeBuild.drive||activeSpec.type;save.settings.drive=physics.driveMode;physics.updateTuning(activeBuild);updateCarVisual(activeModel,activeBuild);}},
  onSaveChange:()=>persist(save),
  onSpawnCar:id=>createActiveCar(id,true),
  onCameraMode:mode=>{cameraYaw=0;cameraPitch=.18;},
  onCameraOrbit:(dx,dy)=>{cameraYaw=clamp(cameraYaw+dx,-Math.PI,Math.PI);cameraPitch=clamp(cameraPitch+dy,-.18,.7);},
  onRespawn:()=>{physics.reset({x:0,z:0,yaw:0});health=100;ui.showToast('VEHICLE RESPAWNED');},
  onWalkToggle:force=>toggleWalk(force),
  onWalkInput:(x,y)=>{walkVelocity.x=x;walkVelocity.y=y;},
  onHeadlights:value=>{headlightsOn=value;if(activeModel)activeModel.userData.lights.forEach(l=>l.intensity=value?15:0);},
  onHorn:()=>audio.horn(),
  onSignals:signals=>{signalState={...signals};},
  onMissionStart:id=>startMission(id)
});
ui.openHUD();

function toggleWalk(force){
  walking=typeof force==='boolean'?force:!walking;
  if(walking){
    physics.setInput('throttle',0);physics.setInput('brake',1);physics.setInput('handbrake',true);
    walkPos.copy(activeModel.position).add(new THREE.Vector3(-1.7,0,.3));ui.showWalkMode(true);ui.showToast('WALK MODE · EXPLORE THE CITY');
  }else{walking=false;ui.showWalkMode(false);physics.setInput('brake',0);physics.setInput('handbrake',false);ui.showToast('BACK IN THE DRIVER SEAT');}
}

// Add subtle floating atmosphere without image or model downloads.
const cloudMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.11,depthWrite:false});
for(let i=0;i<22;i++){const cloud=new THREE.Mesh(new THREE.SphereGeometry(7+(i%4)*2,12,8),cloudMaterial);cloud.scale.set(2.3,.22,1);cloud.position.set((i*47)%390-195,65+(i%5)*8,(i*71)%380-190);scene.add(cloud);}

function showInteraction(text,action){const hint=$('interaction-hint');hint.textContent=text;hint.classList.remove('hidden');hint.style.cursor='pointer';hint.onclick=()=>{if(action)action();};interactionAction=action;}
function hideInteraction(){ui.hideInteraction();interactionAction=null;}
function startMission(id){
  const mission=MISSIONS.find(m=>m.id===id);if(!mission)return;
  if(save.completedMissions.includes(id)){ui.showToast('CHALLENGE ALREADY COMPLETED');return;}
  if(walking){ui.showToast('ENTER YOUR VEHICLE FIRST');return;}
  activeMission={...mission,remaining:mission.time,started:true};ui.showToast('PARKING CHALLENGE STARTED');
}
function finishMission(success){if(!activeMission)return;const m=activeMission;
  if(success){save.money+=m.reward;save.stats.earned+=m.reward;save.completedMissions.push(m.id);ui.showReward(`PARKING COMPLETE · +${money(m.reward)}`);}
  else ui.showReward('TIME EXPIRED · TRY AGAIN');
  activeMission=null;persist(save);
}
function money(v){return '$'+Math.round(v).toLocaleString('en-US');}
function doService(zone){
  if(zone.name==='REFUEL'){save.fuel=100;ui.showReward('FUEL TANK FILLED · 100%');}
  if(zone.name==='SERVICE BAY'){health=100;engineTemp=82;ui.showReward('VEHICLE REPAIRED · 100%');}
  if(zone.name==='CAR WASH'){effects.startWash();audio.wash();ui.showReward('DETAILING COMPLETE');}
  persist(save);
}

let lastTime=performance.now(),fpsFrames=0,fpsTimer=0,fpsValue=60,minimapTimer=0,signalTimer=0,signalPhase=true,missionTimer=0,saveTimer=0,prevDrift=0;
const clock=new THREE.Clock();
function updateCamera(dt){
  if(walking){
    const len=Math.hypot(walkVelocity.x,walkVelocity.y);if(len>.04){const dir=new THREE.Vector3(walkVelocity.x,0,-walkVelocity.y).normalize();dir.applyAxisAngle(new THREE.Vector3(0,1,0),cameraYaw);walkPos.addScaledVector(dir,dt*5.5*Math.min(1,len));}
    camera.position.lerp(new THREE.Vector3(walkPos.x,walkPos.y+1.55,walkPos.z),1-Math.pow(.001,dt));const look=walkPos.clone().add(new THREE.Vector3(Math.sin(cameraYaw),0,-Math.cos(cameraYaw)).multiplyScalar(8));camera.lookAt(look.x,walkPos.y+1.2,look.z);return;
  }
  const carPos=activeModel.position.clone();const forward=physics.getForwardVector();const f=new THREE.Vector3(forward.x,forward.y,forward.z).normalize();
  const yawRot=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),cameraYaw);f.applyQuaternion(yawRot);
  const mode=ui.cameraMode;
  let targetPos,lookAt;
  if(mode===1){
    targetPos=carPos.clone().add(new THREE.Vector3(0,1.28,0)).addScaledVector(new THREE.Vector3(forward.x,forward.y,forward.z),.42);
    lookAt=carPos.clone().addScaledVector(f,24).add(new THREE.Vector3(0,1.08,0));
  }else if(mode===2){
    targetPos=carPos.clone().addScaledVector(f,1.65).add(new THREE.Vector3(0,1.18,0));lookAt=carPos.clone().addScaledVector(f,25).add(new THREE.Vector3(0,.65,0));
  }else if(mode===3){
    const right=new THREE.Vector3(1,0,0).applyQuaternion(activeModel.quaternion);targetPos=carPos.clone().addScaledVector(right,-1.2).addScaledVector(f,1.25).add(new THREE.Vector3(0,.65,0));lookAt=carPos.clone().addScaledVector(f,9).add(new THREE.Vector3(0,.5,0));
  }else{
    targetPos=carPos.clone().addScaledVector(f,-7.8+cameraPitch*2.0).add(new THREE.Vector3(0,2.65+cameraPitch*4,0));lookAt=carPos.clone().add(new THREE.Vector3(0,.85,0)).addScaledVector(f,2.4);
  }
  camera.position.lerp(targetPos,1-Math.pow(.001,dt));camera.lookAt(lookAt);
}
function detectZones(dt){
  const p=walking?walkPos:activeModel.position;let nearest=null,nearDist=Infinity;
  for(const zone of worldData.triggerZones){const d=Math.hypot(zone.x-p.x,zone.z-p.z);if(d<zone.radius&&d<nearDist){nearest=zone;nearDist=d;}}
  for(const marker of worldData.missionMarkers){
    if(save.completedMissions.includes(marker.data.id))continue;
    const d=Math.hypot(marker.data.x-p.x,marker.data.z-p.z);
    if(d<7.5&&!activeMission&&!walking){showInteraction(`PARKING MISSION ${String(marker.data.id).padStart(2,'0')} · TAP TO VIEW`,()=>ui.showMission(marker.data));return 'PARKING PLAZA';}
  }
  if(nearest){
    if(nearest.name==='SHOWROOM'){showInteraction('DEALERSHIP · TAP TO OPEN GARAGE',()=>ui.openGarage());return 'SHOWROOM';}
    if(nearest.name==='DRIFT ARENA'){showInteraction('DRIFT ZONE · EARN CASH WITH CONTROLLED SLIDES',()=>ui.showToast('DRIFT POINTS CONVERT TO CASH'));return 'DRIFT PLAZA';}
    showInteraction(`${nearest.name} · TAP TO USE`,()=>doService(nearest));return 'SERVICE STATION';
  }
  hideInteraction();
  if(p.z<-100&&Math.abs(p.x)<75)return 'HIGHWAY';
  if(Math.abs(p.x)>120||Math.abs(p.z)>120)return 'AUTOBAHN';
  if(Math.abs(p.x)>40&&Math.abs(p.z)>40)return 'CITY STREETS';
  return 'DOWNTOWN';
}
function updateSpeedTraps(dt){
  if(walking)return;
  for(const trap of worldData.speedTraps){trap.cooldown=Math.max(0,trap.cooldown-dt);const speed=telemetry?.speed||0;const near=trap.axis==='x'?Math.abs(activeModel.position.z-trap.z)<2.7&&Math.abs(activeModel.position.x-trap.x)<22:Math.abs(activeModel.position.x-trap.x)<2.7&&Math.abs(activeModel.position.z-trap.z)<22;
    if(near&&speed>=200&&trap.cooldown===0){const reward=Math.round(clamp((speed-190)*100,1000,10000)/100)*100;save.money+=reward;save.stats.earned+=reward;trap.cooldown=14;trap.flash.intensity=12;ui.showReward(`SPEED CAMERA · ${Math.round(speed)} KM/H · +${money(reward)}`);persist(save);}
    trap.flash.intensity=Math.max(0,trap.flash.intensity-dt*22);
  }
}
function updateMission(dt){
  if(!activeMission||walking)return;
  activeMission.remaining-=dt;const m=activeMission;missionTimer+=dt;
  const dx=activeModel.position.x-m.x,dz=activeModel.position.z-m.z;const dist=Math.hypot(dx,dz);const speed=telemetry?.speed||0;
  const rawDiff=Math.abs(wrapAngle(activeModel.rotation.y-m.angle));const diff=Math.min(rawDiff,Math.abs(Math.PI-rawDiff));
  $('mission-toast').textContent=`${m.title.toUpperCase()} · ${Math.max(0,Math.ceil(m.remaining))}s · ${Math.round(dist*10)/10}m`;$('mission-toast').classList.remove('hidden');
  if(dist<2.3&&speed<8&&diff<.65){finishMission(true);return;}
  if(m.remaining<=0)finishMission(false);
}
function updateDrift(dt){
  if(walking||!telemetry)return;
  const inArena=Math.hypot(activeModel.position.x-110,activeModel.position.z-85)<53;
  if(inArena&&telemetry.speed>18&&telemetry.slip>.68){const points=telemetry.slip*telemetry.speed*dt*3.5;driftBank+=points;save.totalDrift+=points;}
  if(driftBank>=100){const chunks=Math.floor(driftBank/100);const reward=chunks*500;driftBank-=chunks*100;save.money+=reward;save.stats.earned+=reward;ui.showReward(`DRIFT BONUS · +${money(reward)}`);persist(save);}
}
function updateVehicleTelemetry(dt){
  if(!telemetry)return;
  const throttle=physics.input.throttle;
  if(!walking){save.fuel=Math.max(0,save.fuel-throttle*dt*.012);engineTemp=clamp(engineTemp+(throttle>.7?dt*1.7:-dt*.36),72,132);if(engineTemp>118)health=Math.max(0,health-dt*.25);}
  save.stats.topSpeed=Math.max(save.stats.topSpeed,telemetry.speed);
  save.totalDistance=(save.totalDistance||0)+physics.speed*dt/1000;
  ui.updateTelemetry({...telemetry,temp:engineTemp},save,zoneName);
  audio.update(telemetry.rpm,walking?0:throttle,walking?0:telemetry.slip,save.settings.engine,activeBuild.parts.some(p=>['singleTurbo','twinTurbo','tripleTurbo'].includes(p)));
  if(save.fuel<1){physics.setInput('throttle',0);ui.showToast('OUT OF FUEL · VISIT A GAS STATION');}
}
function render(){
  const now=performance.now();let dt=Math.min(.04,(now-lastTime)/1000);lastTime=now;
  if(!paused){
    if(!walking){telemetry=physics.update(dt,{...save.settings,drive:physics.driveMode,engine:save.settings.engine});effects.update(dt,activeModel,physics,activeBuild,now/1000);}
    else{physics.setInput('throttle',0);physics.setInput('brake',1);}
    zoneName=detectZones(dt);updateSpeedTraps(dt);updateMission(dt);updateDrift(dt);updateVehicleTelemetry(dt);
    signalTimer+=dt;if(signalTimer>.42){signalTimer=0;signalPhase=!signalPhase;}
    if(activeModel){activeModel.userData.lights.forEach(l=>l.intensity=headlightsOn?15:0);const activeLeft=signalState.left||signalState.hazard,activeRight=signalState.right||signalState.hazard;activeModel.userData.indicators.forEach((mesh,i)=>{const isLeft=i===2||i===3,isOn=(isLeft?activeLeft:activeRight)&&signalPhase;mesh.material.emissiveIntensity=isOn?2.5:0;});}
    saveTimer+=dt;if(saveTimer>8){saveTimer=0;persist(save);}
  }
  updateCamera(dt);renderer.render(scene,camera);
  fpsFrames++;fpsTimer+=dt;if(fpsTimer>=.5){fpsValue=fpsFrames/fpsTimer;ui.setFPS(fpsValue);fpsFrames=0;fpsTimer=0;}
  minimapTimer+=dt;if(minimapTimer>.13){minimapTimer=0;const p=walking?walkPos:activeModel.position;updateMinimap($('minimap'),p,walking?cameraYaw:activeModel.rotation.y,worldData);}
  requestAnimationFrame(render);
}

// Keyboard support is intentionally secondary; all driving controls remain multi-touch ready.
const keys=new Set();window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  keys.add(e.code);audio.init();if(e.code==='KeyG')ui.openGarage();if(e.code==='KeyR')physics.reset({x:0,z:0,yaw:0});if(e.code==='KeyE'&&interactionAction)interactionAction();if(e.code==='KeyF')toggleWalk();if(e.code==='KeyC'){$('camera-button').click();}
  if(e.code==='Space')physics.setInput('handbrake',true);
  if(e.code==='KeyM'){physics.manual=!physics.manual;save.settings.manual=physics.manual;}
  if(e.code==='BracketRight')physics.shift(1);if(e.code==='BracketLeft')physics.shift(-1);
});window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')physics.setInput('handbrake',false);});
function keyboardInput(){
  if(walking){walkVelocity.x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);walkVelocity.y=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);return;}
  const throttle=(keys.has('KeyW')||keys.has('ArrowUp'))?1:0,brake=(keys.has('KeyS')||keys.has('ArrowDown'))?1:0,steer=(keys.has('KeyA')||keys.has('ArrowLeft')?-1:0)+(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
  if(throttle)physics.setInput('throttle',Math.max(physics.input.throttle,throttle));else if(!ui.controls.throttle)physics.setInput('throttle',0);
  if(brake)physics.setInput('brake',Math.max(physics.input.brake,brake));else if(!ui.controls.brake)physics.setInput('brake',0);
  if(steer)physics.setInput('steer',clamp(steer,-1,1));else if(Math.abs(ui.steering)<.05)physics.setInput('steer',0);
}
const baseUpdate=render;
// A small recurring input poll keeps keyboard and multi-touch input independent.
setInterval(keyboardInput,25);

window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));});
window.addEventListener('beforeunload',()=>persist(save));

// Start the world after its procedural assets have been assembled.
$('loading-screen').style.opacity='0';setTimeout(()=>$('loading-screen').remove(),650);
requestAnimationFrame(render);
