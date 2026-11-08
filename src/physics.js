import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { CARS, ENGINES, PARTS } from './config.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const V=(x=0,y=0,z=0)=>new CANNON.Vec3(x,y,z);

export function calculateStats(spec,build){
  const engine=ENGINES.find(e=>e.id===build.engine);
  let hp=engine?.hp??spec.hp, torque=engine?.torque??spec.torque, redline=engine?.rpm??spec.redline;
  for(const p of PARTS){if(build.parts.includes(p.id)){hp+=p.hp||0;torque+=p.torque||0;if(p.id==='chip')redline=8500;}}
  // The W16 / full-bolt-on tune intentionally reproduces the well-known 1695 HP / 2254 Nm target.
  if(build.engine==='w16'&&['singleTurbo','twinTurbo','tripleTurbo','sportExhaust','chip','intercooler'].every(id=>build.parts.includes(id))){hp=1695;torque=2254;redline=9000;}
  const brake=1+(build.parts.includes('racingBrakes')?.6:0);
  const grip=1+(build.parts.includes('sportTires')?.35:0);
  const shift=build.parts.includes('fastGearbox')?.05:.22;
  return {hp,torque,redline,brake,grip,shift,topSpeed:Math.max(120,Math.round(spec.maxSpeed*(hp/spec.hp)**.23*(build.gearbox.final/3.42)**-.18))};
}

export class VehiclePhysics{
  constructor(){
    this.world=new CANNON.World({gravity:V(0,-9.82,0)});
    this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.allowSleep=true;
    this.world.defaultContactMaterial.friction=.65;this.world.defaultContactMaterial.restitution=.02;
    const ground=new CANNON.Body({mass:0,material:new CANNON.Material('asphalt')});
    ground.addShape(new CANNON.Plane());ground.quaternion.setFromEuler(-Math.PI/2,0,0);this.world.addBody(ground);this.ground=ground;
    this.vehicle=null;this.chassis=null;this.spec=null;this.build=null;this.stats=null;this.model=null;
    this.input={throttle:0,brake:0,steer:0,handbrake:false};this.speed=0;this.rpm=850;this.gear=0;this.engineRunning=true;this.odometer=0;this.lastSpeed=0;this.slip=0;this.lateralSpeed=0;this.shiftTimer=0;this.totalDrift=0;this.airborne=false;
    this.driveMode='RWD';this.manual=false;this.cameraForward=new CANNON.Vec3(0,0,-1);
  }
  addCollider(position,size){
    const body=new CANNON.Body({mass:0,position:V(position.x,position.y+size.y/2,position.z)});body.addShape(new CANNON.Box(V(size.x/2,size.y/2,size.z/2)));this.world.addBody(body);return body;
  }
  setVehicle(spec,build,model){
    if(this.vehicle)this.vehicle.removeFromWorld(this.world);
    this.spec=spec;this.build=build;this.model=model;this.stats=calculateStats(spec,build);this.gear=0;this.shiftTimer=0;
    const cogX=build.suspension.cogX*.18,cogZ=build.suspension.cogZ*.2;
    this.chassis=new CANNON.Body({mass:spec.mass,material:new CANNON.Material('car'),linearDamping:.015,angularDamping:.28,allowSleep:false});
    this.chassis.addShape(new CANNON.Box(V(.9,.28,2.04)),V(cogX,0,cogZ));
    this.chassis.position.set(0,.83,0);this.chassis.quaternion.setFromAxisAngle(V(0,1,0),0);
    this.chassis.updateMassProperties();
    this.vehicle=new CANNON.RaycastVehicle({chassisBody:this.chassis,indexRightAxis:0,indexUpAxis:1,indexForwardAxis:2});
    const sus=build.suspension;const wheelX=.91+sus.offset;const axleZ=1.28;
    const wheelPositions=[[-wheelX,-.12,axleZ],[wheelX,-.12,axleZ],[-wheelX,-.12,-axleZ],[wheelX,-.12,-axleZ]];
    wheelPositions.forEach(([x,y,z],i)=>this.vehicle.addWheel({
      chassisConnectionPointLocal:V(x,y,z),directionLocal:V(0,-1,0),axleLocal:V(-1,0,0),
      suspensionStiffness:i<2?sus.frontStiffness:sus.rearStiffness,
      suspensionRestLength:i<2?sus.frontHeight:sus.rearHeight,
      frictionSlip:this.stats.grip*4.6,dampingRelaxation:2.3,dampingCompression:4.4,
      maxSuspensionForce:spec.mass*9.82*3,rollInfluence:.015,radius:.36,isFrontWheel:i<2,customSlidingRotationalSpeed:-30,useCustomSlidingRotationalSpeed:true
    }));
    this.vehicle.addToWorld(this.world);this.driveMode=build.drive||spec.type;
    for(let i=0;i<4;i++){this.vehicle.setSteeringValue(0,i);this.vehicle.setBrake(0,i);}
    if(model){model.position.set(0,0,0);model.rotation.set(0,0,0);}
    this.speed=0;this.rpm=850;this.airborne=false;
  }
  updateTuning(build){
    if(!this.vehicle)return;
    this.build=build;this.stats=calculateStats(this.spec,build);
    const s=build.suspension;
    if(this.chassis?.shapeOffsets?.length){this.chassis.shapeOffsets[0].set(s.cogX*.18,0,s.cogZ*.2);this.chassis.updateMassProperties();this.chassis.updateAABB();}
    this.vehicle.wheelInfos.forEach((wheel,i)=>{
      const longitudinalBias=s.cogZ*.18;
      const camber=i<2?s.frontCamber:s.rearCamber;
      wheel.suspensionStiffness=(i<2?s.frontStiffness*(1-longitudinalBias):s.rearStiffness*(1+longitudinalBias));
      wheel.suspensionRestLength=i<2?s.frontHeight:s.rearHeight;
      wheel.frictionSlip=this.stats.grip*4.6*(1+Math.min(0.08,Math.abs(camber)*.004));
      wheel.chassisConnectionPointLocal.x=(i%2===0?-1:1)*(.91+s.offset);
    });
  }
  setInput(name,value){this.input[name]=value;}
  setGear(mode){
    if(mode==='P'){this.gear=-2;this.input.throttle=0;this.input.brake=1;return;}
    if(mode==='R'){this.gear=-1;this.input.brake=0;return;}
    if(mode==='N'){this.gear=-3;this.input.throttle=0;this.input.brake=0;return;}
    if(mode==='D'){this.gear=0;this.input.brake=0;return;}
  }
  shift(direction){if(this.gear<1)this.gear=1;else this.gear=clamp(this.gear+direction,1,7);this.shiftTimer=this.stats?.shift??.22;}
  reset(position={x:0,z:0,yaw:0}){
    if(!this.chassis)return;
    this.chassis.position.set(position.x??0,.83,position.z??0);this.chassis.quaternion.setFromAxisAngle(V(0,1,0),position.yaw??Math.PI);
    this.chassis.velocity.setZero();this.chassis.angularVelocity.setZero();this.chassis.force.setZero();this.chassis.torque.setZero();this.chassis.wakeUp();
    this.vehicle.wheelInfos.forEach((w,i)=>{w.rotation=0;w.deltaRotation=0;this.vehicle.setBrake(0,i);});this.speed=0;this.rpm=850;this.gear=0;
  }
  getForwardVector(){const v=V(0,0,1);this.chassis?.vectorToWorldFrame(v,v);return v;}
  update(dt,settings={}){
    if(!this.vehicle||!this.chassis)return null;
    dt=clamp(dt,0,.04);
    const cfg=settings;const input=this.input;const forward=this.getForwardVector();
    const signedForward=this.chassis.velocity.dot(forward);this.speed=Math.abs(signedForward);
    const lateral=new CANNON.Vec3();this.chassis.vectorToWorldFrame(V(1,0,0),lateral);this.lateralSpeed=this.chassis.velocity.dot(lateral);
    this.shiftTimer=Math.max(0,this.shiftTimer-dt);
    const ratios=this.build.gearbox;const gearIndex=this.gear>0?this.gear-1:0;const ratio=ratios.gears[gearIndex]||ratios.gears[0];
    const wheelRPM=this.speed/.36*60/(Math.PI*2);const calculatedRPM=850+wheelRPM*ratio*ratios.final;
    const throttle=(cfg.engine===false||!this.engineRunning)?0:input.throttle;
    const rawRPM=850+Math.min(1,throttle)*1800+wheelRPM*ratio*ratios.final;
    this.rpm=clamp(Math.max(throttle?rawRPM:850,calculatedRPM),850,this.stats.redline+250);
    if(!this.manual&&this.gear>=0&&this.gear!==-1&&this.gear!==-3){
      if(this.rpm>this.stats.redline*.86&&this.gear<7){this.gear++;this.shiftTimer=this.stats.shift;}
      else if(this.rpm<this.stats.redline*.36&&this.gear>1&&(this.speed>5||throttle>.25)){this.gear--;this.shiftTimer=this.stats.shift;}
    }
    if(this.gear===0)this.gear=1;
    if(this.gear===-1){this.gear=-1;} // Reverse remains selected until another range is chosen.
    let gearRatio=this.gear===-1?-2.9:(this.gear>0?ratios.gears[this.gear-1]:0);
    if(this.gear===-2||this.gear===-3)gearRatio=0;
    const rpmNorm=clamp(this.rpm/this.stats.redline,.08,1);
    const torqueCurve=.72+.38*Math.sin(rpmNorm*Math.PI*.82);
    let engineForce=throttle*this.stats.torque*torqueCurve*ratios.final*gearRatio*.78/.36;
    engineForce=clamp(engineForce,-19000,19000);
    const maxForce=clamp(this.stats.hp*15,2500,24000);
    engineForce=clamp(engineForce,-maxForce,maxForce);
    if(this.shiftTimer>0)engineForce*=.18;
    if(cfg.tcs&&this.slip>.5)engineForce*=clamp(1-(this.slip-.5)*.9,.25,1);
    if(!this.engineRunning)engineForce=0;
    const drive=this.driveMode||cfg.drive||this.spec.type;
    for(let i=0;i<4;i++){
      const driven=drive==='AWD'||(drive==='FWD'&&i<2)||(drive==='RWD'&&i>=2);
      this.vehicle.applyEngineForce(driven? -engineForce/(drive==='AWD'?4:2):0,i);
      const steerAngle=input.steer*(cfg.esp? .46: .56);
      this.vehicle.setSteeringValue(i<2?steerAngle:0,i);
      const baseBrake=input.brake*5000*this.stats.brake;
      const hand=input.handbrake&&i>=2?8500:0;
      this.vehicle.setBrake(baseBrake+hand,i);
      if(cfg.abs&&input.brake>.05&&this.speed>3&&Math.abs(this.lateralSpeed)>3)this.vehicle.setBrake(baseBrake*.78+hand,i);
    }
    // Aerodynamic drag and a small rolling-resistance term keep speed stable without a hard speed cap.
    const cogX=this.build.suspension.cogX,cogZ=this.build.suspension.cogZ;
    this.chassis.torque.x += cogZ*(throttle-input.brake)*this.spec.mass*.16;
    this.chassis.torque.z += -cogX*(throttle+input.brake)*this.spec.mass*.12;
    const dragScale=.35+(this.spec.mass/1950)*.08;
    const drag=this.chassis.velocity.lengthSquared()*dragScale;
    const dragForce=this.chassis.velocity.clone();dragForce.scale(-drag/Math.max(1,this.chassis.velocity.length()),dragForce);
    this.chassis.applyForce(dragForce,V(0,0,0));
    const roll=this.chassis.velocity.clone();roll.scale(-this.spec.mass*.018,roll);this.chassis.applyForce(roll,V(0,0,0));
    // Drift stability assist damps excessive yaw while retaining player steering control.
    if(cfg.esp&&!cfg.drift&&this.speed>8){this.chassis.angularVelocity.y*=Math.max(.82,1-dt*1.3);}
    const yawSlip=Math.abs(this.chassis.angularVelocity.y)*.36;
    this.slip=clamp((Math.abs(this.lateralSpeed)*.22+yawSlip*.7)/(Math.max(3,this.speed*.13)),0,2.5);
    if(cfg.drift)this.slip*=1.28;
    if(this.slip>.55&&this.speed>8)this.totalDrift+=this.slip*this.speed*dt*.045;
    this.odometer+=this.speed*dt/1000;
    this.lastSpeed=this.speed;
    this.world.step(1/60,dt,3);
    this.vehicle.updateWheelTransform(0);this.vehicle.updateWheelTransform(1);this.vehicle.updateWheelTransform(2);this.vehicle.updateWheelTransform(3);
    if(this.model){
      const p=this.chassis.position,q=this.chassis.quaternion;
      const rootQ=new THREE.Quaternion(q.x,q.y,q.z,q.w).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
      const invRoot=rootQ.clone().invert();
      this.model.position.set(p.x,p.y-.83,p.z);this.model.quaternion.copy(rootQ);
      const wheelMeshes=this.model.userData.wheels;
      for(let i=0;i<4;i++){
        const t=this.vehicle.wheelInfos[i].worldTransform;const w=wheelMeshes[i];
        const localPosition=new THREE.Vector3(t.position.x-p.x,t.position.y-(p.y-.83),t.position.z-p.z).applyQuaternion(invRoot);
        const worldWheelQ=new THREE.Quaternion(t.quaternion.x,t.quaternion.y,t.quaternion.z,t.quaternion.w);
        const localWheelQ=invRoot.clone().multiply(worldWheelQ);
        w.mesh.position.copy(localPosition);w.mesh.quaternion.copy(localWheelQ);
        // Preserve the wheel-camber visual tilt after applying the raycast orientation.
        w.mesh.rotateZ((i<2?this.build.suspension.frontCamber:this.build.suspension.rearCamber)*Math.PI/180);
      }
      this.model.userData.brakeLight.intensity=input.brake>.1?4:0;
    }
    this.airborne=this.vehicle.wheelInfos.filter(w=>w.isInContact).length<2;
    return {speed:this.speed*3.6,rpm:this.rpm,gear:this.gear,slip:this.slip,lateral:this.lateralSpeed,forward,signedForward};
  }
  destroy(){if(this.vehicle)this.vehicle.removeFromWorld(this.world);}
}
