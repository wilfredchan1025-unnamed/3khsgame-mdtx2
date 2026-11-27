(function (global) {
  'use strict';

  const Sanguo = global.Sanguo = global.Sanguo || {};

  const MAX_PARTICLES = 120;
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let particles = [];
  let resizeBound = false;

  function isLightTheme() {
    return typeof document !== 'undefined' && document.body && document.body.classList.contains('theme-light');
  }

  function getPalette() {
    if (isLightTheme()) {
      return {
        fireCore: '#b91c1c',
        fireMid: '#d97706',
        fireEmber: '#7c2d12',
        inkCore: '#1e293b',
        inkMist: '#475569',
        gold: '#b45309',
        slash: '#991b1b',
        heavySlash: '#b45309'
      };
    }
    return {
      fireCore: '#fb923c',
      fireMid: '#f97316',
      fireEmber: '#fde047',
      inkCore: '#6366f1',
      inkMist: '#1e1b4b',
      gold: '#facc15',
      slash: '#f87171',
      heavySlash: '#fde047'
    };
  }

  function ensureCanvas() {
    if (typeof document === 'undefined' || !document.body) return null;
    if (!canvas || !document.body.contains(canvas)) {
      canvas = document.getElementById('vfx-layer');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'vfx-layer';
        canvas.className = 'vfx-canvas-layer';
        document.body.appendChild(canvas);
      }
      ctx = canvas.getContext('2d');
      syncCanvasSize();
      if (!resizeBound && typeof window !== 'undefined') {
        window.addEventListener('resize', syncCanvasSize, { passive: true });
        resizeBound = true;
      }
    }
    return ctx;
  }

  function syncCanvasSize() {
    if (!canvas || typeof window === 'undefined') return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getElCenter(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  function pushParticle(p) {
    if (particles.length >= MAX_PARTICLES) {
      particles.shift();
    }
    particles.push(p);
    startLoop();
  }

  function startLoop() {
    if (rafId !== null || typeof requestAnimationFrame === 'undefined') return;
    if (!ensureCanvas()) return;
    rafId = requestAnimationFrame(tick);
  }

  function tick() {
    rafId = null;
    if (!ctx || !canvas) {
      particles = [];
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    const alive = [];
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += 1;
      if (p.age >= p.life) continue;

      const t = p.age / p.life;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;

      const alpha = Math.max(0, (1 - t) * p.alpha);
      const radius = Math.max(0.6, p.size * (p.grow ? (1 + t * 1.4) : (1 - t * 0.55)));

      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.2, radius * 0.7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      alive.push(p);
    }

    particles = alive;
    if (particles.length > 0) {
      rafId = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  }

  function clear() {
    particles = [];
    if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function applyTempClass(el, className, durationMs) {
    if (!el || !el.classList) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => {
      if (el && el.classList) el.classList.remove(className);
    }, durationMs || 420);
  }

  function triggerDeploy(unitEl) {
    if (!unitEl) return;
    applyTempClass(unitEl, 'vfx-deploy-pop', 380);
    const c = getElCenter(unitEl);
    if (!c) return;
    const pal = getPalette();
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.3;
      const spd = 1.6 + Math.random() * 2.2;
      pushParticle({
        kind: 'ink',
        x: c.x,
        y: c.y + c.h * 0.18,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.5,
        drag: 0.9,
        gravity: -0.02,
        size: 3.5 + Math.random() * 3,
        alpha: 0.55,
        life: 24 + Math.floor(Math.random() * 10),
        age: 0,
        grow: true,
        color: i % 3 === 0 ? pal.gold : pal.inkMist
      });
    }
  }

  function playSlashSpark(targetEl, opts) {
    const c = getElCenter(targetEl);
    if (!c) return;
    const heavy = Boolean(opts && opts.heavy);
    const pal = getPalette();
    const count = heavy ? 18 : 11;
    applyTempClass(targetEl, 'vfx-hit-flash', 260);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (heavy ? 3.2 : 2.2) + Math.random() * 4.2;
      pushParticle({
        kind: 'spark',
        x: c.x + (Math.random() - 0.5) * 14,
        y: c.y + (Math.random() - 0.5) * 14,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.6,
        drag: 0.91,
        gravity: 0.14,
        size: heavy ? 3.6 : 2.5,
        alpha: 0.95,
        life: 18 + Math.floor(Math.random() * 12),
        age: 0,
        grow: false,
        color: i % 2 === 0 ? (heavy ? pal.heavySlash : pal.slash) : pal.gold
      });
    }
  }

  function playFireStream(casterEl, targetEls, opts) {
    const targets = (Array.isArray(targetEls) ? targetEls : [targetEls]).filter(Boolean);
    if (targets.length === 0) return;
    const staggerMs = (opts && typeof opts.staggerMs === 'number') ? opts.staggerMs : 80;
    const origin = getElCenter(casterEl);
    const pal = getPalette();

    targets.forEach((tEl, idx) => {
      setTimeout(() => {
        const dest = getElCenter(tEl);
        if (!dest) return;
        applyTempClass(tEl, 'vfx-burn-flash', 460);

        if (origin) {
          for (let i = 0; i < 8; i++) {
            const frac = i / 8;
            pushParticle({
              kind: 'fire',
              x: origin.x + (dest.x - origin.x) * frac + (Math.random() - 0.5) * 10,
              y: origin.y + (dest.y - origin.y) * frac + (Math.random() - 0.5) * 10,
              vx: (dest.x - origin.x) * 0.03 + (Math.random() - 0.5) * 1.4,
              vy: (dest.y - origin.y) * 0.03 - 0.6,
              drag: 0.94,
              gravity: -0.05,
              size: 4.5 + Math.random() * 3.5,
              alpha: 0.9,
              life: 20 + Math.floor(Math.random() * 10),
              age: 0,
              grow: false,
              color: i % 2 === 0 ? pal.fireCore : pal.fireEmber
            });
          }
        }

        for (let i = 0; i < 12; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 0.8 + Math.random() * 2.6;
          pushParticle({
            kind: 'fire',
            x: dest.x + (Math.random() - 0.5) * 24,
            y: dest.y + (Math.random() - 0.5) * 18,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 1.3,
            drag: 0.95,
            gravity: -0.08,
            size: 3.5 + Math.random() * 4,
            alpha: 0.85,
            life: 24 + Math.floor(Math.random() * 14),
            age: 0,
            grow: false,
            color: i % 3 === 0 ? pal.fireEmber : (i % 2 === 0 ? pal.fireCore : pal.fireMid)
          });
        }
      }, idx * staggerMs);
    });
  }

  function playInkSplash(targetEl, opts) {
    const c = getElCenter(targetEl);
    if (!c) return;
    const pal = getPalette();
    applyTempClass(targetEl, 'vfx-ink-flash', 420);
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.4 + Math.random() * 3.2;
      pushParticle({
        kind: 'ink',
        x: c.x,
        y: c.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: 0.91,
        gravity: 0.03,
        size: 5 + Math.random() * 6,
        alpha: 0.72,
        life: 26 + Math.floor(Math.random() * 14),
        age: 0,
        grow: true,
        color: i % 3 === 0 ? pal.inkCore : pal.inkMist
      });
    }
  }

  function triggerLuanwuPulse(enemyEls) {
    if (typeof document === 'undefined' || !document.body) return;
    applyTempClass(document.body, 'vfx-luanwu-vignette', 650);
    shakeBoard('heavy');
    (enemyEls || []).forEach(el => playInkSplash(el, { mode: 'luanwu' }));
    showCallout('賈詡・亂武！', { tone: 'ink' });
  }

  function triggerDefenseLine() {
    if (typeof document === 'undefined' || !document.body) return;
    applyTempClass(document.body, 'vfx-defense-pulse', 900);
    shakeBoard('normal');
    showCallout('背水一戰・國力防線！', { tone: 'crimson' });
  }

  function shakeBoard(intensity) {
    if (typeof document === 'undefined') return;
    const board = document.querySelector('.battle-ink-bg') || document.getElementById('app');
    if (!board) return;
    const cls = intensity === 'heavy' ? 'vfx-shake-heavy' : 'vfx-shake-normal';
    applyTempClass(board, cls, intensity === 'heavy' ? 220 : 150);
  }

  function showCallout(text, opts) {
    if (typeof document === 'undefined' || !document.body || !text) return;
    const tone = (opts && opts.tone) || 'gold';
    const el = document.createElement('div');
    el.className = `vfx-callout vfx-callout-${tone} font-serif-tc`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 1150);
  }

  Sanguo.VFX = {
    clear,
    triggerDeploy,
    playSlashSpark,
    playFireStream,
    playInkSplash,
    triggerLuanwuPulse,
    triggerDefenseLine,
    shakeBoard,
    showCallout
  };
})(typeof window !== 'undefined' ? window : globalThis);