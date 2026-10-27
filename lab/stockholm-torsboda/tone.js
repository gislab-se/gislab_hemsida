(function(root){
  'use strict';
  class AnimationTone{
    constructor(){this.context=null;this.oscillator=null;this.gain=null;this.targetGain=0;this.appliedGain=null;this.frequency=100;this.enabled=true;this.intensity=0;this.volume=1;}
    async unlock(){
      if(!this.context||this.context.state==='closed'){
        const Context=root.AudioContext||root.webkitAudioContext;if(!Context)throw new Error('Den här webbläsaren saknar ljudstöd.');
        this.context=new Context();this.appliedGain=null;this.oscillator=this.context.createOscillator();this.gain=this.context.createGain();
        this.oscillator.type='sine';this.oscillator.frequency.value=100;this.oscillator.frequency.setValueAtTime(100,this.context.currentTime);this.gain.gain.value=0;this.gain.gain.setValueAtTime(0,this.context.currentTime);
        this.oscillator.connect(this.gain);this.gain.connect(this.context.destination);this.oscillator.start();
      }
      await this.context.resume();
    }
    sync(enabled,playing,volume,intensity=0,release=.12){
      this.enabled=enabled;this.intensity=Math.max(0,Math.min(1,intensity));this.volume=Math.max(0,Math.min(1,volume));const target=enabled&&playing?this.volume*.15*(.5+.5*this.intensity**1.6):0;
      if(this.gain&&this.appliedGain!==target){
        const now=this.context.currentTime,parameter=this.gain.gain;
        parameter.cancelScheduledValues(now);
        parameter.setTargetAtTime(target,now,target===0?release/12:.1);
        if(target===0)parameter.setValueAtTime(0,now+release);
        this.appliedGain=target;
      }
      this.targetGain=target;
      return this.snapshot();
    }
    snapshot(){return {frequency:this.oscillator?.frequency.value||100,type:this.oscillator?.type||'sine',enabled:this.enabled,intensity:this.intensity,volume:this.volume,targetGain:this.targetGain,contextState:this.context?.state||'not-started',gain:this.gain?.gain.value||0};}
    close(){this.targetGain=0;if(this.context)this.context.close().catch(()=>{});}
  }
  root.AnimationTone=AnimationTone;if(typeof module==='object'&&module.exports)module.exports=AnimationTone;
})(typeof globalThis!=='undefined'?globalThis:this);
