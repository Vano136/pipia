import { CARS, ENGINES, PARTS, STOCK_GEARS, TOP_SPEED_GEARS } from './config.js';
import { calculateStats } from './physics.js';

const $=(id)=>document.getElementById(id);
const money=(n)=>'$'+Math.round(n).toLocaleString('en-US');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function touchHold(element,start,move,end){
  if(!element)return;
  const owned=new Map();
  element.addEventListener('touchstart',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){if(!owned.has(t.identifier)){owned.set(t.identifier,true);start?.(t);}}
  },{passive:false});
  document.addEventListener('touchmove',e=>{
    for(const t of e.changedTouches)if(owned.has(t.identifier)){e.preventDefault();move?.(t);}
  },{passive:false});
  const finish=e=>{for(const t of e.changedTouches)if(owned.has(t.identifier)){owned.delete(t.identifier);end?.(t);}};
  document.addEventListener('touchend',finish,{passive:false});document.addEventListener('touchcancel',finish,{passive:false});
  let mouse=false;
  element.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||mouse)return;mouse=true;start?.(e);});
  document.addEventListener('pointermove',e=>{if(mouse)move?.(e);});
  document.addEventListener('pointerup',e=>{if(mouse){mouse=false;end?.(e);}});
}

function touchButton(element,callback){touchHold(element,callback,null,null);}

function section(title,right='') {return `<div class="tune-section"><div class="tune-title"><b>${title}</b><small>${right}</small></div>`;}
function rangeItem(label,key,value,min,max,step='0.01',suffix=''){
  return `<div class="tune-item"><label>${label}<b>${Number(value).toFixed(step==='1'?0:2)}${suffix}</b></label><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

export class GameUI{
  constructor(save,callbacks){
    this.save=save;this.callbacks=callbacks;this.tab='engine';this.focusCarId=save.selected;this.signals={left:false,right:false,hazard:false};this.steering=0;this.controls={throttle:0,brake:0,handbrake:false};this.cameraMode=0;this.manual=false;this.missionOpenId=null;
    this.el={hud:$('hud'),garage:$('garage-overlay'),cash:$('cash-value'),garageCash:$('garage-cash'),quick:$('quick-drawer'),steer:$('steering-wheel'),gas:$('gas-pedal'),brake:$('brake-pedal'),hand:$('handbrake-button'),dashSpeed:$('speed-value'),rpm:$('rpm-value'),gear:$('gear-value'),fps:$('fps-value')};
    this.bindStatic();this.bindVehicleControls();this.renderGarage();
  }
  bindStatic(){
    $('garage-button').addEventListener('click',()=>this.openGarage());$('close-garage').addEventListener('click',()=>this.closeGarage());
    $('phone-button').addEventListener('click',()=>this.el.quick.classList.toggle('hidden'));
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).classList.add('hidden')));
    document.querySelectorAll('.tuning-tabs button').forEach(b=>b.addEventListener('click',()=>{this.tab=b.dataset.tab;this.renderTuning();document.querySelectorAll('.tuning-tabs button').forEach(x=>x.classList.toggle('active',x===b));}));
    $('camera-button').addEventListener('click',()=>{this.cameraMode=(this.cameraMode+1)%4;const labels=['CHASE CAM','COCKPIT','HOOD CAM','WHEEL CAM'];$('camera-button').querySelector('small').textContent=labels[this.cameraMode];this.callbacks.onCameraMode?.(this.cameraMode);});
    $('engine-toggle').addEventListener('click',()=>{this.save.settings.engine=!this.save.settings.engine;$('engine-toggle').textContent=this.save.settings.engine?'RUNNING':'STOPPED';$('engine-toggle').classList.toggle('active',this.save.settings.engine);this.callbacks.onSettings?.(this.save.settings);});
    document.querySelectorAll('[data-setting]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.setting;this.save.settings[k]=!this.save.settings[k];b.classList.toggle('active',this.save.settings[k]);this.callbacks.onSettings?.(this.save.settings);}));
    document.querySelectorAll('[data-drive]').forEach(b=>b.addEventListener('click',()=>{this.save.settings.drive=b.dataset.drive;this.save.builds[this.focusCarId].drive=b.dataset.drive;document.querySelectorAll('[data-drive]').forEach(x=>x.classList.toggle('active',x===b));this.callbacks.onBuildChange?.(this.focusCarId);this.callbacks.onSettings?.(this.save.settings);}));
    $('respawn-button').addEventListener('click',()=>this.callbacks.onRespawn?.());
    $('walk-button').addEventListener('click',()=>this.callbacks.onWalkToggle?.());
    touchButton($('headlight-button'),()=>{this.headlights=!this.headlights;$('headlight-button').classList.toggle('active',this.headlights);this.callbacks.onHeadlights?.(this.headlights);});
    touchButton($('horn-button'),()=>this.callbacks.onHorn?.());
    document.querySelectorAll('[data-signal]').forEach(b=>touchButton(b,()=>{const k=b.dataset.signal;if(k==='hazard'){this.signals.hazard=!this.signals.hazard;this.signals.left=this.signals.right=this.signals.hazard;}else{this.signals[k]=!this.signals[k];this.signals.hazard=false;}this.updateSignalButtons();this.callbacks.onSignals?.(this.signals);}));
    $('close-missions').addEventListener('click',()=>this.closeMission());$('start-mission').addEventListener('click',()=>{this.closeMission();this.callbacks.onMissionStart?.(this.missionOpenId);});
    $('spawn-selected').addEventListener('click',()=>{const car=this.getFocusCar();if(!this.save.owned.includes(car.id)){this.buyCar(car.id);return;}this.save.selected=car.id;this.callbacks.onSpawnCar?.(car.id);this.closeGarage();});
  }
  bindVehicleControls(){
    const wheel=this.el.steer;
    let angleStart=0,lastAngle=0;
    const wheelStart=t=>{const r=wheel.getBoundingClientRect();const a=Math.atan2(t.clientY-(r.top+r.height/2),t.clientX-(r.left+r.width/2));angleStart=a;lastAngle=a;};
    const wheelMove=t=>{const r=wheel.getBoundingClientRect();const a=Math.atan2(t.clientY-(r.top+r.height/2),t.clientX-(r.left+r.width/2));let d=a-angleStart;while(d>Math.PI)d-=Math.PI*2;while(d< -Math.PI)d+=Math.PI*2;this.steering=clamp(d/1.08,-1,1);wheel.style.transform=`rotate(${this.steering*150}deg)`;this.callbacks.onInput?.('steer',this.steering);lastAngle=a;};
    const wheelEnd=()=>{this.steering=0;wheel.style.transform='rotate(0deg)';this.callbacks.onInput?.('steer',0);};
    touchHold(wheel,wheelStart,wheelMove,wheelEnd);
    const bindPedal=(el,name)=>touchHold(el,t=>{const r=el.getBoundingClientRect();const val=clamp((t.clientY-r.top)/r.height,.2,1);this.controls[name]=val;this.callbacks.onInput?.(name,val);el.classList.add('pressed');},t=>{const r=el.getBoundingClientRect();const val=clamp((t.clientY-r.top)/r.height,.15,1);this.controls[name]=val;this.callbacks.onInput?.(name,val);},()=>{this.controls[name]=0;this.callbacks.onInput?.(name,0);el.classList.remove('pressed');});
    bindPedal(this.el.gas,'throttle');bindPedal(this.el.brake,'brake');
    touchHold(this.el.hand,()=>{this.controls.handbrake=true;this.callbacks.onInput?.('handbrake',true);this.el.hand.classList.add('active');},null,()=>{this.controls.handbrake=false;this.callbacks.onInput?.('handbrake',false);this.el.hand.classList.remove('active');});
    document.querySelectorAll('[data-gear]').forEach(b=>touchButton(b,()=>{const g=b.dataset.gear;this.manual=false;this.save.settings.manual=false;document.querySelectorAll('[data-gear]').forEach(x=>x.classList.toggle('selected',x===b));document.querySelectorAll('[data-gear]').forEach(x=>x.style.opacity=x===b?'1':'.72');this.callbacks.onGear?.(g);this.callbacks.onSettings?.(this.save.settings);}));
    touchButton($('manual-up'),()=>{this.manual=true;this.save.settings.manual=true;this.callbacks.onManualShift?.(1);});touchButton($('manual-down'),()=>{this.manual=true;this.save.settings.manual=true;this.callbacks.onManualShift?.(-1);});
    // Camera orbit only starts on the world canvas; each finger keeps its own identifier.
    const canvas=$('game-canvas');const cameraTouches=new Map();
    canvas.addEventListener('touchstart',e=>{for(const t of e.changedTouches)cameraTouches.set(t.identifier,{x:t.clientX,y:t.clientY});},{passive:true});
    canvas.addEventListener('touchmove',e=>{for(const t of e.changedTouches){const prev=cameraTouches.get(t.identifier);if(prev){this.callbacks.onCameraOrbit?.((t.clientX-prev.x)*.008,(t.clientY-prev.y)*.006);cameraTouches.set(t.identifier,{x:t.clientX,y:t.clientY});}}},{passive:true});
    const end=e=>{for(const t of e.changedTouches)cameraTouches.delete(t.identifier);};canvas.addEventListener('touchend',end);canvas.addEventListener('touchcancel',end);
    let mouse=null;canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;mouse={x:e.clientX,y:e.clientY};});window.addEventListener('pointermove',e=>{if(mouse){this.callbacks.onCameraOrbit?.((e.clientX-mouse.x)*.008,(e.clientY-mouse.y)*.006);mouse={x:e.clientX,y:e.clientY};}});window.addEventListener('pointerup',()=>mouse=null);
    // Walk-mode virtual joystick.
    const stick=$('walk-stick');touchHold(stick,t=>{const r=stick.getBoundingClientRect();this.walkOrigin={x:r.left+r.width/2,y:r.top+r.height/2};this.walkMove(t);},t=>this.walkMove(t),()=>{this.callbacks.onWalkInput?.(0,0);$('walk-stick').firstElementChild.style.transform='translate(0,0)';});
    $('enter-car-button').addEventListener('click',()=>this.callbacks.onWalkToggle?.(false));
  }
  walkMove(t){if(!this.walkOrigin)return;const dx=t.clientX-this.walkOrigin.x,dy=t.clientY-this.walkOrigin.y;const x=clamp(dx/38,-1,1),y=clamp(dy/38,-1,1);$('walk-stick').firstElementChild.style.transform=`translate(${x*25}px,${y*25}px)`;this.callbacks.onWalkInput?.(x,y);}
  updateSignalButtons(){document.querySelectorAll('[data-signal]').forEach(b=>{const k=b.dataset.signal;b.classList.toggle('active',!!this.signals[k]);});}
  openGarage(){this.el.garage.classList.remove('hidden');this.renderGarage();this.callbacks.onPause?.(true);}
  closeGarage(){this.el.garage.classList.add('hidden');this.callbacks.onPause?.(false);}
  openHUD(){this.el.hud.classList.remove('hidden');}
  showWalkMode(active){$('left-controls').classList.toggle('hidden',active);$('right-controls').classList.toggle('hidden',active);$('dashboard').classList.toggle('hidden',active);$('walk-controls').classList.toggle('hidden',!active);$('walk-button').textContent=active?'ENTER CAR':'EXIT CAR · WALK MODE';}
  getFocusCar(){return CARS.find(c=>c.id===this.focusCarId)||CARS[0];}
  getBuild(){return this.save.builds[this.focusCarId];}
  buyCar(id){const car=CARS.find(c=>c.id===id);if(!car||this.save.owned.includes(id))return;if(this.save.money<car.price){this.showReward('NOT ENOUGH CASH');return;}this.save.money-=car.price;this.save.owned.push(id);this.focusCarId=id;this.callbacks.onSaveChange?.();this.renderGarage();this.showReward(`${car.name.toUpperCase()} PURCHASED`);}
  renderGarage(){
    this.el.cash.textContent=money(this.save.money);this.el.garageCash.textContent=money(this.save.money);$('car-count').textContent=`${String(this.save.owned.length).padStart(2,'0')} / 06 OWNED`;
    $('car-list').innerHTML=CARS.map(c=>{const owned=this.save.owned.includes(c.id);return `<button class="car-row ${this.focusCarId===c.id?'active':''}" data-car="${c.id}"><span><b>${c.short}</b><small>${c.type} · ${c.hp} HP · ${c.mass} KG</small></span><em>${owned?'OWNED':money(c.price)}</em></button>`;}).join('');
    document.querySelectorAll('[data-car]').forEach(b=>b.addEventListener('click',()=>{this.focusCarId=b.dataset.car;this.renderGarage();}));
    const car=this.getFocusCar(),build=this.getBuild(),stats=calculateStats(car,build),owned=this.save.owned.includes(car.id);
    $('selected-car-name').textContent=car.short;$('selected-hp').textContent=stats.hp.toLocaleString();$('selected-nm').textContent=stats.torque.toLocaleString();$('selected-weight').textContent=car.mass.toLocaleString();
    $('spawn-selected').textContent=owned?'DRIVE THIS CAR ↗':`BUY VEHICLE · ${money(car.price)}`;
    this.renderTuning();
    document.querySelectorAll('[data-drive]').forEach(x=>x.classList.toggle('active',x.dataset.drive===(build.drive||car.type)));
    document.querySelectorAll('[data-setting]').forEach(x=>x.classList.toggle('active',!!this.save.settings[x.dataset.setting]));
  }
  changed(){this.callbacks.onBuildChange?.(this.focusCarId);this.callbacks.onSaveChange?.();const build=this.getBuild(),car=this.getFocusCar(),stats=calculateStats(car,build);$('selected-hp').textContent=stats.hp.toLocaleString();$('selected-nm').textContent=stats.torque.toLocaleString();this.el.cash.textContent=money(this.save.money);this.el.garageCash.textContent=money(this.save.money);}
  renderTuning(){
    const c=this.getFocusCar(),b=this.getBuild(),stats=calculateStats(c,b),root=$('tuning-content');
    if(this.tab==='engine'){
      root.innerHTML=section('LIVE POWERTRAIN OUTPUT',`${stats.hp.toLocaleString()} HP / ${stats.torque.toLocaleString()} NM`)+`<div class="tune-grid"><div class="tune-item"><label>HORSEPOWER<b>${stats.hp.toLocaleString()} HP</b></label><div class="bar-track"><i style="width:${clamp(stats.hp/1800*100,0,100)}%"></i></div></div><div class="tune-item"><label>TORQUE<b>${stats.torque.toLocaleString()} NM</b></label><div class="bar-track"><i style="width:${clamp(stats.torque/2400*100,0,100)}%"></i></div></div><div class="tune-item"><label>REDLINE<b>${stats.redline.toLocaleString()} RPM</b></label><div class="bar-track"><i style="width:${stats.redline/9500*100}%"></i></div></div><div class="tune-item"><label>EST. TOP SPEED<b>${stats.topSpeed} KM/H</b></label><div class="bar-track"><i style="width:${stats.topSpeed/450*100}%"></i></div></div></div></div>`+
      section('ENGINE SWAPS','CHOOSE A POWER UNIT')+`<div class="upgrade-list">${ENGINES.map(e=>{const active=b.engine===e.id;return `<div class="upgrade-item"><span><b>${e.name}</b><small>${e.hp} HP · ${e.torque} NM · ${money(e.price)}</small></span><button class="buy-button" data-engine="${e.id}" ${active?'disabled':''}>${active?'INSTALLED':'INSTALL'}</button></div>`;}).join('')}</div></div>`+
      section('BOLT-ON UPGRADES','STACKABLE PARTS')+`<div class="upgrade-list">${PARTS.map(p=>{const active=b.parts.includes(p.id);return `<div class="upgrade-item"><span><b>${p.name}</b><small>${p.desc} · ${money(p.price)}</small></span><button class="buy-button" data-part="${p.id}" ${active?'disabled':''}>${active?'OWNED':'BUY'}</button></div>`;}).join('')}</div></div>`;
      root.querySelectorAll('[data-engine]').forEach(button=>button.addEventListener('click',()=>{const e=ENGINES.find(x=>x.id===button.dataset.engine);if(this.save.money<e.price){this.showReward('NOT ENOUGH CASH');return;}this.save.money-=e.price;b.engine=e.id;this.changed();this.renderTuning();}));
      root.querySelectorAll('[data-part]').forEach(button=>button.addEventListener('click',()=>{const p=PARTS.find(x=>x.id===button.dataset.part);if(this.save.money<p.price){this.showReward('NOT ENOUGH CASH');return;}this.save.money-=p.price;b.parts.push(p.id);this.changed();this.renderTuning();}));
    }else if(this.tab==='gearbox'){
      const gearNames=['1ST GEAR','2ND GEAR','3RD GEAR','4TH GEAR','5TH GEAR','6TH GEAR','7TH GEAR'];
      root.innerHTML=section('TRANSMISSION RATIOS','LIVE PHYSICS')+`<div class="tune-grid">${rangeItem('FINAL DRIVE','final',b.gearbox.final,1.5,5,.01,' : 1')}${gearNames.map((n,i)=>rangeItem(n,`gear-${i}`,b.gearbox.gears[i],[2,1.4,1,.8,.65,.5,.4][i],[4.5,3,2.2,1.7,1.35,1.1,.9][i],.01,' : 1')).join('')}</div><div class="tune-actions"><button id="reset-gears">RESET TO STOCK</button><button id="top-speed-gears">TOP SPEED SETUP</button></div></div>`;
      root.querySelectorAll('[data-range]').forEach(inp=>inp.addEventListener('input',()=>{const key=inp.dataset.range;if(key==='final')b.gearbox.final=Number(inp.value);else b.gearbox.gears[Number(key.split('-')[1])]=Number(inp.value);inp.previousElementSibling.querySelector('b').textContent=Number(inp.value).toFixed(2)+' : 1';this.changed();}));
      $('reset-gears').addEventListener('click',()=>{b.gearbox={final:STOCK_GEARS.final,gears:[...STOCK_GEARS.gears]};this.changed();this.renderTuning();});
      $('top-speed-gears').addEventListener('click',()=>{b.gearbox={final:TOP_SPEED_GEARS.final,gears:[...TOP_SPEED_GEARS.gears]};this.changed();this.renderTuning();});
    }else if(this.tab==='suspension'){
      root.innerHTML=section('SUSPENSION SETUP','SPRINGS / CAMBER / SPACERS')+`<div class="tune-grid">${rangeItem('FRONT RIDE HEIGHT','frontHeight',b.suspension.frontHeight,.18,.58,.01,' M')}${rangeItem('REAR RIDE HEIGHT','rearHeight',b.suspension.rearHeight,.18,.58,.01,' M')}${rangeItem('FRONT STIFFNESS','frontStiffness',b.suspension.frontStiffness,18,70,1,' KN')}${rangeItem('REAR STIFFNESS','rearStiffness',b.suspension.rearStiffness,18,70,1,' KN')}${rangeItem('FRONT CAMBER','frontCamber',b.suspension.frontCamber,-15,0,.1,'°')}${rangeItem('REAR CAMBER','rearCamber',b.suspension.rearCamber,-15,0,.1,'°')}${rangeItem('WHEEL OFFSET','offset',b.suspension.offset,-.08,.14,.005,' M')}</div></div>`+
      section('CENTER OF GRAVITY','DRAG THE RED POINT')+`<div class="cog-wrap"><div class="cog-box" id="cog-box"><span class="cog-label">FRONT ← / → REAR</span><div class="cog-car"></div><div class="cog-dot" id="cog-dot"></div></div><div class="tune-item"><label>COG LATERAL<b id="cog-x-value">${b.suspension.cogX.toFixed(2)}</b></label><label>COG LONGITUDINAL<b id="cog-z-value">${b.suspension.cogZ.toFixed(2)}</b></label><button id="reset-cog" class="buy-button">RESET COG</button></div></div></div>`;
      root.querySelectorAll('[data-range]').forEach(inp=>inp.addEventListener('input',()=>{const k=inp.dataset.range;b.suspension[k]=Number(inp.value);inp.previousElementSibling.querySelector('b').textContent=Number(inp.value).toFixed(2)+(k.toLowerCase().includes('camber')?'°':k.includes('Height')?' M':'');this.changed();}));
      const boxEl=$('cog-box'),dot=$('cog-dot');const setCog=(x,y)=>{const r=boxEl.getBoundingClientRect();const nx=clamp((x-r.left)/r.width,0,1),ny=clamp((y-r.top)/r.height,0,1);b.suspension.cogX=(nx-.5)*2;b.suspension.cogZ=(.5-ny)*2;dot.style.left=`${nx*100}%`;dot.style.top=`${ny*100}%`;$('cog-x-value').textContent=b.suspension.cogX.toFixed(2);$('cog-z-value').textContent=b.suspension.cogZ.toFixed(2);this.changed();};
      const initX=(b.suspension.cogX+1)/2,initY=(1-b.suspension.cogZ)/2;dot.style.left=`${initX*100}%`;dot.style.top=`${initY*100}%`;
      let dragging=false;boxEl.addEventListener('pointerdown',e=>{dragging=true;setCog(e.clientX,e.clientY);});window.addEventListener('pointermove',e=>{if(dragging)setCog(e.clientX,e.clientY);});window.addEventListener('pointerup',()=>dragging=false);
      $('reset-cog').addEventListener('click',()=>{b.suspension.cogX=0;b.suspension.cogZ=0;this.changed();this.renderTuning();});
    }else{
      root.innerHTML=section('THREE-CHANNEL PAINT','BODY / METALLIC / FINISH')+`<div class="tune-grid"><div class="tune-item"><label>MAIN BODY COLOR</label><input type="color" data-visual="body" value="${b.visual.body}"></div><div class="tune-item"><label>SPECULAR / METALLIC COLOR</label><input type="color" data-visual="metallic" value="${b.visual.metallic}"></div>${rangeItem('REFLECTION / ROUGHNESS','roughness',b.visual.roughness,.02,1,.01)}<div class="tune-item"><label>WINDOW TINT COLOR</label><input type="color" data-visual="tint" value="${b.visual.tint}"></div>${rangeItem('WINDOW OPACITY','tintOpacity',b.visual.tintOpacity,.05,.95,.01)}</div><div class="color-swatches">${['#e7edf0','#ed3c45','#2279bf','#efc83d','#111820','#41c5a2','#824cc2','#f27b35'].map(color=>`<button class="swatch" data-swatch="${color}" style="background:${color}"></button>`).join('')}</div></div>`+
      section('RIMS & STANCE','PROCEDURAL WHEELS')+`<div class="rim-options">${['5-Spoke','BBS Mesh','Deep Dish','Turbine','Multi-Spoke'].map(n=>`<button class="rim-option ${b.visual.rimStyle===n?'active':''}" data-rim="${n}">${n}</button>`).join('')}</div><div class="tune-grid" style="margin-top:9px"><div class="tune-item"><label>RIM COLOR</label><input type="color" data-visual="rimColor" value="${b.visual.rimColor}"></div>${rangeItem('RIM SIZE','rimSize',b.visual.rimSize,.28,.43,.005,' M')}<div class="tune-item"><label>SMOKE COLOR</label><input type="color" data-visual="smoke" value="${b.visual.smoke}"></div><div class="tune-item"><label>HEADLIGHT COLOR</label><input type="color" data-visual="headlight" value="${b.visual.headlight}"></div></div></div>`+
      section('EXTERIOR DETAILS','AERO / LIGHTING')+`<div class="tune-grid"><div class="tune-item"><label>SPOILER</label><select data-visual="spoiler"><option ${b.visual.spoiler==='None'?'selected':''}>None</option><option ${b.visual.spoiler==='Lip Spoiler'?'selected':''}>Lip Spoiler</option><option ${b.visual.spoiler==='GT Wing'?'selected':''}>GT Wing</option></select></div><div class="tune-item"><label>HEADLIGHT PRESETS</label><select id="headlight-preset"><option value="#f7f4da">Warm White</option><option value="#a5d9ff">Ice Blue</option><option value="#eaff30">Neon Yellow</option><option value="#bd7aff">Purple</option></select></div></div></div>`;
      root.querySelectorAll('[data-visual]').forEach(inp=>{const event=inp.type==='range'?'input':'change';inp.addEventListener(event,()=>{b.visual[inp.dataset.visual]=inp.type==='range'?Number(inp.value):inp.value;this.changed();if(inp.type==='range')inp.previousElementSibling.querySelector('b').textContent=Number(inp.value).toFixed(2);});});
      root.querySelectorAll('[data-swatch]').forEach(btn=>btn.addEventListener('click',()=>{b.visual.body=btn.dataset.swatch;this.changed();this.renderTuning();}));
      root.querySelectorAll('[data-rim]').forEach(btn=>btn.addEventListener('click',()=>{b.visual.rimStyle=btn.dataset.rim;this.changed();this.renderTuning();}));
      $('headlight-preset').value=b.visual.headlight;$('headlight-preset').addEventListener('change',e=>{b.visual.headlight=e.target.value;this.changed();});
    }
  }
  updateTelemetry(data,save,zone='DOWNTOWN'){
    this.save=save;this.el.cash.textContent=money(save.money);$('zone-name').textContent=zone;$('zone-sub').textContent='CITY 01  /  FREE ROAM';
    if(!data)return;const speed=Math.max(0,Math.round(data.speed));this.el.dashSpeed.textContent=String(speed).padStart(3,'0');this.el.rpm.textContent=(Math.round(data.rpm/100)/10).toFixed(1);this.el.gear.textContent=data.gear===-1?'R':data.gear===-2?'P':data.gear===-3?'N':String(Math.max(1,data.gear));$('tach-progress').style.strokeDashoffset=String(276-276*clamp(data.rpm/9000,0,1));$('tach-needle').style.transform=`rotate(${-135+270*clamp(data.rpm/9000,0,1)}deg)`;$('tach-needle').style.transformOrigin='110px 102px';$('fuel-bar').style.width=`${save.fuel}%`;$('fuel-text').textContent=`${Math.round(save.fuel)}%`;$('temp-bar').style.width=`${clamp((data.temp||82)/130*100,0,100)}%`;$('temp-text').textContent=`${Math.round(data.temp||82)}°C`;$('odo-value').textContent=(save.totalDistance||0).toFixed(1);
  }
  setFPS(fps){this.el.fps.textContent=Math.round(fps);}
  showMission(mission){this.missionOpenId=mission.id;$('mission-title').textContent=mission.title;$('mission-description').textContent=mission.description;$('mission-reward').textContent=money(mission.reward);$('mission-time').textContent=`${mission.time} SEC`;$('mission-overlay').classList.remove('hidden');this.callbacks.onPause?.(true);}
  closeMission(){$('mission-overlay').classList.add('hidden');this.callbacks.onPause?.(false);}
  showInteraction(text){const el=$('interaction-hint');el.textContent=text;el.classList.remove('hidden');}
  hideInteraction(){$('interaction-hint').classList.add('hidden');}
  showToast(text){const el=$('mission-toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.add('hidden'),2100);}
  showReward(text){const el=$('reward-toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(this.rewardTimer);this.rewardTimer=setTimeout(()=>el.classList.add('hidden'),2300);}
  setMissionProgress(text){this.showToast(text);}
}
