// Web Audio API Synth Sound Generator for Buy/Sell Alerts
export function playAlertSound(type: 'BUY' | 'SELL') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'BUY') {
      // Elegant positive rising electronic chime
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3); // C6
      
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Add high-frequency harmony ping
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.12); // E6
      gain2.gain.setValueAtTime(0.001, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.12, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } else {
      // Descriptive low cautious cautionary alert warning tone
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      
      // Warm low frequency lowpass filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, now);
      
      osc1.connect(filter);
      filter.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(392.00, now); // G4
      osc1.frequency.setValueAtTime(329.63, now + 0.12); // E4
      osc1.frequency.setValueAtTime(261.63, now + 0.24); // C4
      
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Descending warning chime sequence slightly overlapping
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      const filter2 = ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.frequency.setValueAtTime(700, now + 0.18);
      
      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(329.63, now + 0.18); // E4
      osc2.frequency.setValueAtTime(261.63, now + 0.3); // C4
      osc2.frequency.setValueAtTime(196.00, now + 0.42); // G3
      
      gain2.gain.setValueAtTime(0.001, now + 0.18);
      gain2.gain.linearRampToValueAtTime(0.15, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      
      osc2.start(now + 0.18);
      osc2.stop(now + 0.55);
    }
  } catch (err) {
    console.warn("AudioContext failed output:", err);
  }
}
