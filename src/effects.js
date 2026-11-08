import * as THREE from 'three';

const colorToThree=(v)=>new THREE.Color(v||'#ffffff');
export class ParticleEffects{
  constructor(scene){this.scene=scene;this.particles=[];this.skids=[];this.lastSkid=0;this.lastSmoke=0;this.lastFlame=0;this.washUntil=0;this.water=[];}
  emit(position,color,velocity,size=0.2,life=1,kind='smoke'){
    const geo=kind==='flame'?new THREE.ConeGeometry(size*.55,size*2,8):new THREE.SphereGeometry(size,8,6);
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:kind==='flame'?.88:.32,depthWrite:false});
    const mesh=new THREE.Mesh(geo,mat);mesh.position.copy(position);mesh.rotation.x=Math.PI;this.scene.add(mesh);
    this.particles.push({mesh,velocity:velocity.clone(),life,maxLife:life,kind,size});
  }
  update(dt,model,physics,build,now){
    if(!model||!physics)return;
    const slip=physics.slip,speed=physics.speed;const userSmoke=colorToThree(build.visual.smoke);
    if(slip>.52&&speed>5&&now-this.lastSmoke>.04){
      this.lastSmoke=now;
      const wheels=model.userData.wheels;
      for(let i=2;i<4;i++){
        const p=wheels[i].mesh.getWorldPosition(new THREE.Vector3());p.y=.16;
        this.emit(p,userSmoke,new THREE.Vector3((Math.random()-.5)*.8,.45+Math.random()*.35,(Math.random()-.5)*.8),.16+Math.random()*.14,.8+Math.random()*.6,'smoke');
      }
    }
    if(slip>.82&&speed>9&&now-this.lastSkid>.085){
      this.lastSkid=now;const wheels=model.userData.wheels;
      for(let i=2;i<4;i++){
        const p=wheels[i].mesh.getWorldPosition(new THREE.Vector3());p.y=.045;
        const mark=new THREE.Mesh(new THREE.PlaneGeometry(.18,1.1),new THREE.MeshBasicMaterial({color:'#101317',transparent:true,opacity:.26,depthWrite:false}));mark.rotation.x=-Math.PI/2;mark.rotation.z=model.rotation.y;mark.position.copy(p);this.scene.add(mark);this.skids.push({mesh:mark,life:18});
      }
    }
    if(build.parts.includes('sportExhaust')&&physics.rpm>physics.stats.redline*.9&&now-this.lastFlame>.12){
      this.lastFlame=now;for(const pipe of model.userData.exhausts){const p=pipe.getWorldPosition(new THREE.Vector3());p.z+=.25;this.emit(p,'#ff8a2d',new THREE.Vector3((Math.random()-.5)*.5,.1,-.5),.12,.22,'flame');}
    }
    if(now<this.washUntil&&Math.random()<.7){const p=model.position.clone().add(new THREE.Vector3((Math.random()-.5)*2,Math.random()*1.8,(Math.random()-.5)*4));this.emit(p,'#91eaff',new THREE.Vector3((Math.random()-.5)*.8,.8,(Math.random()-.5)*.8),.055,.5,'water');}
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y+=p.kind==='smoke'?.45:-.35;p.mesh.scale.multiplyScalar(p.kind==='smoke'?1+dt*.5:1-dt*.7);p.mesh.material.opacity=Math.max(0,p.life/p.maxLife*(p.kind==='flame'?.9:.38));if(p.life<=0){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.particles.splice(i,1);}}
    for(let i=this.skids.length-1;i>=0;i--){const s=this.skids[i];s.life-=dt;if(s.life<=0){this.scene.remove(s.mesh);s.mesh.geometry.dispose();s.mesh.material.dispose();this.skids.splice(i,1);}}
  }
  startWash(){this.washUntil=performance.now()/1000+3.2;}
  clearTransient(){this.particles.forEach(p=>this.scene.remove(p.mesh));this.particles.length=0;}
}
