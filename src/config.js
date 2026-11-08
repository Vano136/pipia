export const CARS = [
  { id:'civic', name:'Civic Hatch', short:'CIVIC HATCH', type:'FWD', hp:160, torque:210, mass:1250, price:0, color:'#e5e9e8', style:'hatch', redline:6800, maxSpeed:225 },
  { id:'e36', name:'Bavaria E36 Drift', short:'BAVARIA E36', type:'RWD', hp:286, torque:320, mass:1380, price:25000, color:'#c73342', style:'sedan', redline:7000, maxSpeed:255 },
  { id:'supra', name:'JDM Supra MK4', short:'JDM SUPRA MK4', type:'RWD', hp:330, torque:440, mass:1510, price:65000, color:'#f1c43a', style:'coupe', redline:7200, maxSpeed:280 },
  { id:'r34', name:'Skyline R34 GT-R', short:'SKYLINE R34', type:'AWD', hp:380, torque:470, mass:1560, price:95000, color:'#3f90d5', style:'coupe', redline:7400, maxSpeed:295 },
  { id:'m5', name:'Executive M5 F90 / CLS63', short:'EXECUTIVE M5', type:'AWD', hp:625, torque:750, mass:1850, price:150000, color:'#263746', style:'luxury', redline:7200, maxSpeed:315 },
  { id:'w16', name:'Hyper W16 Beast', short:'HYPER W16', type:'AWD', hp:925, torque:1200, mass:1950, price:350000, color:'#32a68a', style:'hyper', redline:8500, maxSpeed:420 }
];

export const ENGINES = [
  { id:'i4', name:'2.0L I4 Engine', hp:180, torque:240, price:5000, rpm:7000 },
  { id:'v6', name:'3.0L V6 Bi-Turbo', hp:420, torque:550, price:25000, rpm:7200 },
  { id:'v8', name:'4.0L V8 AMG', hp:610, torque:800, price:50000, rpm:7200 },
  { id:'v10', name:'5.2L V10 NA', hp:720, torque:680, price:90000, rpm:8500 },
  { id:'v12', name:'6.5L V12 Racing', hp:830, torque:900, price:130000, rpm:8800 },
  { id:'w16', name:'8.0L W16 Engine', hp:925, torque:1250, price:200000, rpm:9000 }
];

export const PARTS = [
  { id:'singleTurbo', name:'Single Turbo', hp:50, torque:80, price:12000, desc:'+50 HP · +80 Nm' },
  { id:'twinTurbo', name:'Twin Turbo', hp:130, torque:180, price:65000, desc:'+130 HP · +180 Nm' },
  { id:'tripleTurbo', name:'Triple Turbo', hp:280, torque:399, price:200000, desc:'+280 HP · +399 Nm' },
  { id:'sportExhaust', name:'Sport Exhaust', hp:35, torque:55, price:9000, desc:'+35 HP · backfire flames' },
  { id:'chip', name:'Chip Tuning', hp:85, torque:110, price:18000, desc:'+85 HP · 8,500 RPM' },
  { id:'intercooler', name:'Intercooler', hp:65, torque:90, price:22000, desc:'+65 HP · +90 Nm' },
  { id:'racingBrakes', name:'Racing Brakes', brake:0.6, price:14000, desc:'+60% brake force' },
  { id:'fastGearbox', name:'Fast Gearbox', shift:0.05, price:18000, desc:'0.05 sec shift delay' },
  { id:'sportTires', name:'Sport Slick Tires', grip:0.35, price:26000, desc:'+35% lateral grip' }
];

export const STOCK_GEARS = { final:3.42, gears:[3.30,2.10,1.45,1.10,0.88,0.72,0.60] };
export const TOP_SPEED_GEARS = { final:2.35, gears:[2.80,1.82,1.28,0.98,0.77,0.62,0.50] };

export const DEFAULT_BUILD = () => ({
  engine:null, parts:[], drive:null,
  gearbox:{ final:STOCK_GEARS.final, gears:[...STOCK_GEARS.gears] },
  suspension:{ frontHeight:0.34, rearHeight:0.34, frontStiffness:32, rearStiffness:32, frontCamber:-1, rearCamber:-1, offset:0, cogX:0, cogZ:0 },
  visual:{ body:'#e5e9e8', metallic:'#dbe9ef', roughness:0.32, rimStyle:'5-Spoke', rimColor:'#c8d5dc', rimSize:0.36, tint:'#182b3b', tintOpacity:0.72, smoke:'#e7f6ff', spoiler:'None', headlight:'#f7f4da' }
});

export const MISSIONS = [
  { id:1, title:'First Impressions', description:'Pull into the highlighted bay without touching the lines. Keep your speed under 8 km/h.', reward:2500, time:45, x:90, z:55, angle:0 },
  { id:2, title:'Parallel Perfection', description:'Reverse into the parallel bay. Smooth steering beats speed.', reward:3500, time:55, x:105, z:56, angle:Math.PI/2 },
  { id:3, title:'Tight Squeeze', description:'Park in the narrow marked space. Stay inside the green guides.', reward:4000, time:55, x:120, z:60, angle:Math.PI },
  { id:4, title:'Downtown Delivery', description:'Line up between the two white markers and stop precisely.', reward:4500, time:60, x:75, z:75, angle:0 },
  { id:5, title:'Reverse Challenge', description:'Back into the marked space with a clean final alignment.', reward:5500, time:65, x:135, z:74, angle:-Math.PI/2 },
  { id:6, title:'Precision Driver', description:'Park in the compact bay. You have 50 seconds.', reward:6000, time:50, x:80, z:92, angle:Math.PI },
  { id:7, title:'Night Shift', description:'Make a careful approach and settle inside the final parking box.', reward:7000, time:60, x:145, z:92, angle:0 },
  { id:8, title:'Arena Master', description:'Hit the clipping point, then park neatly in the finish box.', reward:8500, time:70, x:105, z:110, angle:Math.PI/2 },
  { id:9, title:'Pro License', description:'A narrow slot and a short timer. Precision is everything.', reward:10000, time:55, x:125, z:112, angle:Math.PI },
  { id:10, title:'City Champion', description:'Final exam. Park slowly, straight, and fully inside the illuminated bay.', reward:15000, time:75, x:155, z:112, angle:0 }
];
