/**
 * Som ambiente gerado no próprio navegador: ruído suave + pad harmônico.
 * Não depende de arquivos externos e funciona offline.
 */
export function createAmbient() {
  let ctx = null;
  let master = null;
  let noiseSource = null;
  let oscillators = [];
  let running = false;
  let volume = 0.35;

  function buildNoise(context) {
    const seconds = 2;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  function start() {
    if (running) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = volume * 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();

    const noise = ctx.createBufferSource();
    noise.buffer = buildNoise(ctx);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.22;
    noise.connect(filter).connect(noiseGain).connect(master);
    noise.start();
    noiseSource = noise;

    const notes = [110, 164.81, 220];
    oscillators = notes.map((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 1 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.035 - index * 0.008;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + index * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      osc.connect(gain).connect(master);
      osc.start();
      return { osc, gain, lfo };
    });
    running = true;
  }

  function stop() {
    if (!running) return;
    try {
      noiseSource?.stop();
    } catch {
      /* já parado */
    }
    for (const { osc, lfo } of oscillators) {
      try {
        osc.stop();
        lfo.stop();
      } catch {
        /* já parado */
      }
    }
    noiseSource = null;
    oscillators = [];
    running = false;
  }

  function setVolume(value) {
    volume = Math.min(1, Math.max(0, Number(value) || 0));
    if (master && ctx) master.gain.setTargetAtTime(volume * 0.5, ctx.currentTime, 0.08);
  }

  function dispose() {
    stop();
    try {
      ctx?.close();
    } catch {
      /* ignore */
    }
    ctx = null;
    master = null;
  }

  return {
    start,
    stop,
    setVolume,
    dispose,
    isRunning: () => running,
  };
}
