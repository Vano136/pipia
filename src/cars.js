import * as THREE from 'three';

const MAT = (color, roughness=.45, metalness=.15, extra={}) => new THREE.MeshPhysicalMaterial({color,roughness,metalness,clearcoat:.55,clearcoatRoughness:.22,...extra});
const box = (w,h,d,material,x=0,y=0,z=0, bevel=0) => {
  let geometry = new THREE.BoxGeometry(w,h,d);
  if(bevel){
    geometry = new THREE.BoxGeometry(w,h,d,2,1,2);
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
};
const cylinder = (r1,r2,h,material,x,y,z,segments=24) => { const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);m.position.set(x,y,z);m.castShadow=true;return m; };

function makePlate(text){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e9eeed';ctx.fillRect(0,0,512,112);ctx.fillStyle='#1b2b34';ctx.font='bold 68px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,59);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function createRim(style,color,size){
  const group=new THREE.Group();
  const metal=MAT(color,.24,.82);const dark=MAT('#131a20',.5,.2);
  group.add(cylinder(size*.67,size*.67,.11,dark,0,0,0,32));
  group.add(cylinder(size*.52,size*.52,.115,metal,0,0,0,32));
  group.add(cylinder(size*.19,size*.19,.13,dark,0,0,0,24));
  const count=style==='5-Spoke'?5:style==='BBS Mesh'?18:style==='Deep Dish'?8:style==='Turbine'?7:12;
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2;
    if(style==='BBS Mesh'){
      for(let j=0;j<2;j++){
        const aa=a+j*.08;
        const spoke=box(size*.055,size*.5,.055,metal,Math.sin(aa)*size*.28,Math.cos(aa)*size*.28,0);
        spoke.rotation.z=aa;group.add(spoke);
      }
    }else if(style==='Deep Dish'){
      const spoke=box(size*.11,size*.55,.07,metal,Math.sin(a)*size*.28,Math.cos(a)*size*.28,0);spoke.rotation.z=-a;group.add(spoke);
    }else if(style==='Turbine'){
      const spoke=box(size*.18,size*.52,.05,metal,Math.sin(a+.25)*size*.27,Math.cos(a+.25)*size*.27,0);spoke.rotation.z=-a-.25;group.add(spoke);
    }else{
      const spoke=box(size*.075,size*.53,.06,metal,Math.sin(a)*size*.28,Math.cos(a)*size*.28,0);spoke.rotation.z=-a;group.add(spoke);
    }
  }
  return group;
}

export function buildCarModel(spec,build){
  const root=new THREE.Group();root.name=spec.id;
  const bodyMat=MAT(build.visual.body,.32,Math.max(.08,1-build.visual.roughness),{clearcoat:1,clearcoatRoughness:.12});
  const trim=MAT('#111a21',.38,.38);const glass=MAT(build.visual.tint,.13,.2,{transparent:true,opacity:build.visual.tintOpacity,clearcoat:1});
  const chrome=MAT(build.visual.metallic,.2,.9);const rubber=MAT('#101417',.84,.02);const lamp=MAT(build.visual.headlight,.13,.25,{emissive:build.visual.headlight,emissiveIntensity:1.5});const tail=MAT('#9d1723',.2,.2,{emissive:'#ff182d',emissiveIntensity:.7});const indicatorMat=MAT('#ff8c24',.24,.1,{emissive:'#ff6a18',emissiveIntensity:0});const indicators=[];
  const width=spec.style==='hyper'?1.98:1.9;const length=spec.style==='hatch'?3.85:spec.style==='hyper'?4.55:4.35;const cabinScale=spec.style==='coupe'?.88:spec.style==='hyper'?.78:1;
  const main=box(width,.52,length,bodyMat,0,.59,0);root.add(main);
  const lower=box(width*.98,.19,length*.94,trim,0,.36,.01);root.add(lower);
  const hood=box(width*.92,.18,length*.34,bodyMat,0,.82,-length*.32);root.add(hood);
  const rear=box(width*.88,.17,length*.25,bodyMat,0,.8,length*.35);root.add(rear);
  const cabin=new THREE.Group();
  cabin.add(box(width*.82,.58,length*.43,bodyMat,0,1.08,-.02*cabinScale));
  cabin.add(box(width*.77,.48,length*.4,glass,0,1.12,-.02*cabinScale));
  cabin.add(box(width*.8,.1,length*.06,trim,0,1.36,-.02));
  root.add(cabin);
  // Procedural cockpit: dashboard, seats and a visible steering wheel for the interior camera.
  root.add(box(width*.72,.15,.42,trim,0,.93,-.23));
  for(const side of [-1,1]){
    const seat=box(.52,.5,.55,MAT('#17242b',.72,.08),side*.43,.83,.2);root.add(seat);
    const headrest=box(.38,.22,.18,trim,side*.43,1.16,.39);root.add(headrest);
  }
  const steeringWheel=new THREE.Mesh(new THREE.TorusGeometry(.22,.025,8,32),chrome);steeringWheel.position.set(-.42,1.03,-.28);steeringWheel.rotation.y=Math.PI/2;root.add(steeringWheel);
  root.add(box(.035,.38,.04,chrome,-.42,.82,-.28));
  // Split front/rear glass and side glass make the cabin read as a formed shell rather than a single block.
  cabin.add(box(width*.73,.32,.035,glass,0,1.14,-length*.235*cabinScale));
  cabin.add(box(width*.73,.3,.035,glass,0,1.13,length*.19*cabinScale));
  for(const side of [-1,1]){
    cabin.add(box(.035,.34,length*.26,trim,side*width*.405,1.12,-.02));
    cabin.add(box(.025,.26,length*.21,glass,side*width*.418,1.14,-.02));
    root.add(box(.08,.12,length*.56,trim,side*width*.49,.42,0));
    // Door handles and mirrors
    root.add(box(.06,.035,.15,chrome,side*width*.49,.76,-.02));
    const mirror=box(.15,.12,.22,bodyMat,side*width*.55,1.06,-length*.23);mirror.rotation.z=side*.18;root.add(mirror);
  }
  // Bumpers and splitters
  root.add(box(width*1.02,.18,.22,trim,0,.4,-length*.49));
  root.add(box(width*1.02,.16,.2,trim,0,.39,length*.49));
  root.add(box(width*.94,.045,.28,chrome,0,.34,-length*.52));
  // Lights and reflectors
  for(const side of [-1,1]){
    const head=box(.3,.14,.08,lamp,side*width*.34,.67,-length*.5-.015);root.add(head);
    const taillight=box(.34,.14,.08,tail,side*width*.33,.66,length*.5+.02);root.add(taillight);
    const fog=box(.14,.07,.06,lamp,side*width*.39,.48,-length*.51);root.add(fog);
    const frontIndicator=box(.11,.075,.07,indicatorMat.clone(),side*width*.47,.58,-length*.505);root.add(frontIndicator);indicators.push(frontIndicator);
    const rearIndicator=box(.12,.075,.07,indicatorMat.clone(),side*width*.46,.58,length*.505);root.add(rearIndicator);indicators.push(rearIndicator);
  }
  // Front grille and plate.
  root.add(box(width*.32,.17,.04,trim,0,.61,-length*.505));
  const plateMat=new THREE.MeshStandardMaterial({map:makePlate('VC 01'),roughness:.55});
  root.add(box(.52,.12,.025,plateMat,0,.47,-length*.515));
  // Wheel wells, four tires, rims, calipers and brakes.
  const wheels=[];const axleZ=length*.31;const wheelX=width*.51;
  for(const axle of [-1,1])for(const side of [1,-1]){
    const wheelGroup=new THREE.Group();wheelGroup.position.set(side*wheelX,.38,axle*axleZ);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.365,.365,.27,36,1,false),rubber);tire.rotation.z=Math.PI/2;tire.castShadow=true;wheelGroup.add(tire);
    const rim=createRim(build.visual.rimStyle,build.visual.rimColor,build.visual.rimSize);
    rim.position.x=side*.145;rim.rotation.z=Math.PI/2;rim.rotation.y=side<0?Math.PI:0;wheelGroup.add(rim);
    const caliper=box(.095,.2,.18,MAT('#c94235',.35,.45),side*.12,-.03,.17);wheelGroup.add(caliper);
    root.add(wheelGroup);wheels.push({mesh:wheelGroup,side,axle,baseX:side*wheelX,baseZ:axle*axleZ,tire,rim});
  }
  // Exhaust outlets.
  const exhausts=[];
  for(const side of [-1,1]){
    const pipe=cylinder(.075,.075,.22,chrome,side*.48,.39,length*.5+.1,16);pipe.rotation.x=Math.PI/2;root.add(pipe);exhausts.push(pipe);
  }
  // Spoiler assembly; rebuild visibility based on the current visual build.
  const spoiler=new THREE.Group();spoiler.position.set(0,1.05,length*.39);
  if(build.visual.spoiler==='Lip Spoiler')spoiler.add(box(width*.82,.08,.22,bodyMat,0,.04,0));
  if(build.visual.spoiler==='GT Wing'){
    spoiler.add(box(.08,.36,.08,chrome,-width*.34,-.13,0));spoiler.add(box(.08,.36,.08,chrome,width*.34,-.13,0));spoiler.add(box(width*1.08,.09,.38,trim,0,.08,0));
  }
  root.add(spoiler);
  // Side skirts, rocker details and a subtle roof feature.
  root.add(box(width*1.01,.07,length*.55,trim,0,.31,0));
  if(spec.style==='hyper'){
    root.add(box(.12,.2,length*.36,trim,0,.88,.02));
    for(let n=-1;n<=1;n++)root.add(box(.04,.12,.16,chrome,n*.16,.66,length*.47));
  }
  // Spotlights are real scene lights with restrained distance and intensity.
  const lights=[];
  for(const side of [-1,1]){
    const spot=new THREE.SpotLight(build.visual.headlight,8,48,Math.PI/8,.45,1.5);spot.position.set(side*.38,.66,-length*.52);spot.target.position.set(side*.45,.2,-18);root.add(spot);root.add(spot.target);lights.push(spot);
  }
  const brakeLight=new THREE.PointLight('#ff1d30',0,5,2);brakeLight.position.set(0,.72,length*.5);root.add(brakeLight);
  root.userData={bodyMat,glass,lights,brakeLight,exhausts,wheels,spec,spoiler,length,width,lamp,indicators,rimKey:`${build.visual.rimStyle}|${build.visual.rimColor}|${build.visual.rimSize}`,spoilerKey:build.visual.spoiler};
  return root;
}

export function updateCarVisual(model,build){
  if(!model?.userData?.bodyMat)return;
  const d=model.userData;
  d.bodyMat.color.set(build.visual.body);d.bodyMat.roughness=build.visual.roughness;d.bodyMat.metalness=Math.max(.08,1-build.visual.roughness);if(d.bodyMat.specularColor)d.bodyMat.specularColor.set(build.visual.metallic);d.lamp.color.set(build.visual.headlight);d.lamp.emissive.set(build.visual.headlight);
  d.glass.color.set(build.visual.tint);d.glass.opacity=build.visual.tintOpacity;
  const nextSpoilerKey=build.visual.spoiler;
  if(d.spoilerKey!==nextSpoilerKey){
    if(d.spoiler){
      d.spoiler.traverse(node=>{if(node.isMesh){node.geometry?.dispose();if(node.material&&node.material!==d.bodyMat){if(Array.isArray(node.material))node.material.forEach(m=>m.dispose());else node.material.dispose();}}});
      d.spoiler.parent?.remove(d.spoiler);
    }
    const spoiler=new THREE.Group();spoiler.position.set(0,1.05,d.length*.39);
    if(nextSpoilerKey==='Lip Spoiler')spoiler.add(box(d.width*.82,.08,.22,d.bodyMat,0,.04,0));
    if(nextSpoilerKey==='GT Wing'){
      const wingMetal=MAT('#c4d0d5',.25,.85),wingTrim=MAT('#111a21',.35,.4);
      spoiler.add(box(.08,.36,.08,wingMetal,-d.width*.34,-.13,0));spoiler.add(box(.08,.36,.08,wingMetal,d.width*.34,-.13,0));spoiler.add(box(d.width*1.08,.09,.38,wingTrim,0,.08,0));
    }
    model.add(spoiler);d.spoiler=spoiler;d.spoilerKey=nextSpoilerKey;
  }
  const nextRimKey=`${build.visual.rimStyle}|${build.visual.rimColor}|${build.visual.rimSize}`;
  if(d.rimKey!==nextRimKey){
    for(const wheel of d.wheels){
      wheel.rim.clear();
      wheel.rim.add(createRim(build.visual.rimStyle,build.visual.rimColor,build.visual.rimSize));
    }
    d.rimKey=nextRimKey;
  }
  for(const light of d.lights){light.color.set(build.visual.headlight);light.intensity=8;}
  for(const wheel of d.wheels){
    wheel.mesh.position.x=wheel.baseX+wheel.side*build.suspension.offset;
    wheel.mesh.rotation.z=(wheel.axle<0?build.suspension.frontCamber:build.suspension.rearCamber)*Math.PI/180;
  }
}
