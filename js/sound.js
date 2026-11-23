(function (global) {
  'use strict';

  const Sound = {
    ctx: null,
    muted: false,
    ensure() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    },
    tone(freq, dur = 0.14, type = 'triangle', gainVal = 0.12, delay = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    },
    playDeploy() { this.tone(220, 0.12, 'triangle', 0.14); this.tone(330, 0.16, 'sine', 0.1, 0.05); },
    playTactic() { this.tone(523.25, 0.12, 'sine', 0.1); this.tone(659.25, 0.16, 'sine', 0.1, 0.06); this.tone(783.99, 0.22, 'triangle', 0.09, 0.12); },
    playAttack() { this.tone(150, 0.11, 'sawtooth', 0.14); this.tone(95, 0.15, 'square', 0.1, 0.04); },
    playShield() { this.tone(440, 0.08, 'sine', 0.1); this.tone(880, 0.1, 'triangle', 0.07, 0.03); },
    playKill() { this.tone(261.6, 0.12, 'triangle', 0.13); this.tone(392, 0.16, 'triangle', 0.13, 0.07); this.tone(523.2, 0.24, 'sine', 0.12, 0.14); },
    playTurn() { this.tone(293.66, 0.14, 'sine', 0.1); this.tone(440, 0.2, 'triangle', 0.09, 0.08); },
    playError() { this.tone(180, 0.12, 'sawtooth', 0.08); },
    playVictory() {
      [261.6, 329.6, 392, 523.25, 659.25].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.12, i * 0.09));
    }
  };

  global.Sanguo = global.Sanguo || {};
  global.Sanguo.Sound = Sound;
})(window);