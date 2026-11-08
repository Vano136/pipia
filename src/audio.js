export class SynthAudio{
  constructor(){this.ctx=null;this.master=null;this.engineOsc=null;this.engineGain=null;this.engineFilter=null;this.screechGain=null;this.screechFilter=null;this.prevThrottle=0;this.prevRPM=850;this.lastPop=0;this.enabled=true;}
  init(){
    if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.36;this.master.connect(this.ctx.destination);
    this.engineOsc=this.ctx.createOscillator();this.engineOsc.type='sawtooth';this.engineFilter=this.ctx.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=850;
    this.engineGain=this.ctx.createGain();this.engineGain.gain.value=0;
    this.engineOsc.connect(this.engineFilter);this.engineFilter.connect(this.engineGain);this.engineGain.connect(this.master);this.engineOsc.start();
    const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const noise=this.ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1800;filter.Q.value=.7;
    this.screechGain=this.ctx.createGain();this.screechGain.gain.value=0;noise.connect(filter);filter.connect(this.screechGain);this.screechGain.connect(this.master);noise.start();this.screechFilter=filter;
  }
  update(rpm,throttle,slip,engineOn=true,boosted=false){
    if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime;
    const safeRpm=Math.max(700,Math.min(10000,rpm));
    this.engineOsc.frequency.setTargetAtTime(35+safeRpm/60*(boosted?1.13:1),t,.055);
    this.engineFilter.frequency.setTargetAtTime(550+safeRpm*.23,t,.08);
    this.engineGain.gain.setTargetAtTime(engineOn ? .055+throttle*.07 : 0,t,.06);
    this.screechGain.gain.setTargetAtTime(Math.min(.12,Math.max(0,slip-.35)*.09),t,.08);
    this.screechFilter.frequency.setTargetAtTime(1200+Math.min(1,slip)*1700,t,.1);
    if(this.prevThrottle>.45&&throttle<.08&&boosted)this.bov();
    if((rpm>8700&&this.prevRPM<=8700)||(rpm<this.prevRPM-1700&&throttle>.25))this.pop();
    this.prevThrottle=throttle;this.prevRPM=rpm;
  }
  pop(){if(!this.ctx)return;const now=this.ctx.currentTime;if(now-this.lastPop<.16)return;this.lastPop=now;
    const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();osc.type='square';osc.frequency.setValueAtTime(125,now);osc.frequency.exponentialRampToValueAtTime(42,now+.12);filter.type='lowpass';filter.frequency.value=700;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.23,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.17);osc.connect(filter);filter.connect(gain);gain.connect(this.master);osc.start(now);osc.stop(now+.18);
  }
  bov(){if(!this.ctx)return;const now=this.ctx.currentTime;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();osc.type='sawtooth';osc.frequency.setValueAtTime(580,now);osc.frequency.exponentialRampToValueAtTime(110,now+.22);filter.type='lowpass';filter.frequency.value=1400;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.25);osc.connect(filter);filter.connect(gain);gain.connect(this.master);osc.start(now);osc.stop(now+.26);}
  horn(){if(!this.ctx)return;const now=this.ctx.currentTime;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='square';osc.frequency.value=370;gain.gain.value=.065;osc.connect(gain);gain.connect(this.master);osc.start(now);osc.stop(now+.32);}
  wash(){if(!this.ctx)return;const now=this.ctx.currentTime;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(420,now);osc.frequency.exponentialRampToValueAtTime(180,now+.45);gain.gain.setValueAtTime(.04,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.5);osc.connect(gain);gain.connect(this.master);osc.start(now);osc.stop(now+.52);}
  setVolume(value){if(this.master&&this.ctx)this.master.gain.setTargetAtTime(value,this.ctx.currentTime,.1);}
}
