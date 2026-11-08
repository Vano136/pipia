import { CARS, DEFAULT_BUILD } from './config.js';

const KEY = 'velocity-city-save-v1';

function freshSave(){
  const builds = {};
  for(const car of CARS) builds[car.id] = DEFAULT_BUILD();
  return { money:500000, owned:['civic'], selected:'civic', builds, completedMissions:[], totalDistance:0, totalDrift:0, fuel:82, settings:{tcs:true,abs:true,esp:true,drift:false,engine:true,drive:'FWD',manual:false}, stats:{earned:0,topSpeed:0} };
}

export function loadSave(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return freshSave();
    const parsed = JSON.parse(raw);
    const base = freshSave();
    const merged = {...base,...parsed, settings:{...base.settings,...parsed.settings}, stats:{...base.stats,...parsed.stats}, builds:{...base.builds,...parsed.builds}};
    for(const car of CARS){
      const current = merged.builds[car.id] || DEFAULT_BUILD();
      merged.builds[car.id] = {...DEFAULT_BUILD(),...current, gearbox:{...DEFAULT_BUILD().gearbox,...current.gearbox}, suspension:{...DEFAULT_BUILD().suspension,...current.suspension}, visual:{...DEFAULT_BUILD().visual,...current.visual}, parts:Array.isArray(current.parts)?current.parts:[]};
    }
    if(!CARS.some(c=>c.id===merged.selected)) merged.selected='civic';
    if(!merged.owned.includes('civic')) merged.owned.unshift('civic');
    return merged;
  }catch(error){
    console.warn('Save data could not be loaded; using a fresh profile.', error);
    return freshSave();
  }
}

let saveTimer;
export function persist(save){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{ localStorage.setItem(KEY, JSON.stringify(save)); }
    catch(error){ console.warn('Could not persist game progress.', error); }
  },120);
}

export function resetSave(){
  localStorage.removeItem(KEY);
  return freshSave();
}
