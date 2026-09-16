(() => {
  const SOUND_KEY = "life.sound.v1";
  const canvas = document.getElementById("fx");
  const btn = document.getElementById("snd");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let soundOn = localStorage.getItem(SOUND_KEY) === "1";
  let reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let stars = [];
  let raf = 0;
  let audioCtx = null;
  let master = null;
  let ambientNodes = [];
  let hiss = null;

  function syncFlags() {
    reduce =
      document.documentElement.dataset.reduce === "1" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.dataset.sound = soundOn ? "1" : "0";
    if (btn) btn.classList.toggle("off", !soundOn);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(90, (w * h) / 18000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.25 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
    }));
  }

  function draw(t) {
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    ctx.clearRect(0, 0, w, h);
    if (reduce) return;

    const mx = (mouse.x - 0.5) * 40;
    const my = (mouse.y - 0.5) * 40;
    const egg = document.documentElement.dataset.egg;
    const light = document.documentElement.dataset.theme === "light" && !egg;
    ctx.strokeStyle = egg === "matrix"
      ? "rgba(57,255,20,.16)"
      : egg === "fallout"
      ? "rgba(255,176,0,.16)"
      : light
      ? "rgba(0,0,0,.08)"
      : "rgba(255,255,255,.09)";
    ctx.fillStyle = egg === "matrix"
      ? "rgba(57,255,20,.85)"
      : egg === "fallout"
      ? "rgba(255,176,0,.85)"
      : light
      ? "rgba(0,0,0,.55)"
      : "rgba(255,255,255,.7)";

    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      a.x += a.vx + (mouse.x - 0.5) * 0.18 * a.z;
      a.y += a.vy + (mouse.y - 0.5) * 0.18 * a.z;
      if (a.x < -20) a.x = w + 20;
      if (a.x > w + 20) a.x = -20;
      if (a.y < -20) a.y = h + 20;
      if (a.y > h + 20) a.y = -20;
    }

    ctx.lineWidth = 0.6;
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      const ax = a.x + mx * a.z;
      const ay = a.y + my * a.z;
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        const bx = b.x + mx * b.z;
        const by = b.y + my * b.z;
        const dx = ax - bx;
        const dy = ay - by;
        const d2 = dx * dx + dy * dy;
        if (d2 < 11000) {
          ctx.globalAlpha = (1 - d2 / 11000) * 0.35;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
    for (const a of stars) {
      const ax = a.x + mx * a.z;
      const ay = a.y + my * a.z;
      const r = 0.6 + a.z * 1.4;
      const pulse = 0.55 + Math.sin(t * 0.002 + a.x) * 0.25;
      ctx.globalAlpha = 0.35 + a.z * 0.5 * pulse;
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function noiseBuffer(ctxA, seconds) {
    const len = ctxA.sampleRate * seconds;
    const buf = ctxA.createBuffer(1, len, ctxA.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    master = audioCtx.createGain();
    master.gain.value = 0;
    master.connect(audioCtx.destination);

    const rumble = audioCtx.createOscillator();
    rumble.type = "sine";
    rumble.frequency.value = 42;
    const rumbleG = audioCtx.createGain();
    rumbleG.gain.value = 0.035;
    rumble.connect(rumbleG);
    rumbleG.connect(master);

    const pad = audioCtx.createOscillator();
    pad.type = "triangle";
    pad.frequency.value = 110;
    const padF = audioCtx.createBiquadFilter();
    padF.type = "lowpass";
    padF.frequency.value = 420;
    const padG = audioCtx.createGain();
    padG.gain.value = 0.018;
    pad.connect(padF);
    padF.connect(padG);
    padG.connect(master);

    const fifth = audioCtx.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 164.8;
    const fifthG = audioCtx.createGain();
    fifthG.gain.value = 0.012;
    fifth.connect(fifthG);
    fifthG.connect(master);

    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = audioCtx.createGain();
    lfoG.gain.value = 18;
    lfo.connect(lfoG);
    lfoG.connect(pad.frequency);

    hiss = audioCtx.createBufferSource();
    hiss.buffer = noiseBuffer(audioCtx, 2);
    hiss.loop = true;
    const hissF = audioCtx.createBiquadFilter();
    hissF.type = "highpass";
    hissF.frequency.value = 900;
    const hissG = audioCtx.createGain();
    hissG.gain.value = 0.012;
    hiss.connect(hissF);
    hissF.connect(hissG);
    hissG.connect(master);

    rumble.start();
    pad.start();
    fifth.start();
    lfo.start();
    hiss.start();
    ambientNodes = [rumble, pad, fifth, lfo, hiss];
    return audioCtx;
  }

  function setSound(on, persist = true) {
    soundOn = !!on;
    if (persist) localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0");
    syncFlags();
    if (!soundOn) {
      if (master && audioCtx) master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
      return;
    }
    const ctxA = ensureAudio();
    if (!ctxA) return;
    ctxA.resume();
    master.gain.setTargetAtTime(0.9, ctxA.currentTime, 0.2);
  }

  function clickSound() {
    if (!soundOn) return;
    const ctxA = ensureAudio();
    if (!ctxA) return;
    ctxA.resume();
    const t = ctxA.currentTime;
    const osc = ctxA.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(190 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.04);
    const g = ctxA.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    const n = ctxA.createBufferSource();
    n.buffer = noiseBuffer(ctxA, 0.08);
    const ng = ctxA.createGain();
    ng.gain.setValueAtTime(0.03, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    const nf = ctxA.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 1800;
    osc.connect(g);
    g.connect(master);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(master);
    osc.start(t);
    n.start(t);
    osc.stop(t + 0.08);
    n.stop(t + 0.08);
  }

  function setEgg(id) {
    const next = id || "";
    const cur = document.documentElement.dataset.egg || "";
    if (next === cur) {
      delete document.documentElement.dataset.egg;
    } else if (next) {
      document.documentElement.dataset.egg = next;
    } else {
      delete document.documentElement.dataset.egg;
    }
    const egg = document.documentElement.dataset.egg;
    if (typeof toast === "function") {
      toast(egg === "matrix" ? "WAKE UP, NEO" : egg === "fallout" ? "WAR NEVER CHANGES" : "SIGNAL LOST");
    }
    clickSound();
  }

  window.LIFE_FX = {
    setSound,
    isSound: () => soundOn,
    click: clickSound,
    setEgg,
  };

  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kbuf = [];
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
    kbuf = kbuf.concat(e.key).slice(-konami.length);
    if (kbuf.join() === konami.join()) setEgg("matrix");
    if (!e.shiftKey) return;
    if (e.code === "KeyM") {
      e.preventDefault();
      setEgg("matrix");
    }
    if (e.code === "KeyF") {
      e.preventDefault();
      setEgg("fallout");
    }
    if (e.code === "KeyX" || e.code === "Escape") {
      e.preventDefault();
      setEgg("");
    }
  });

  window.addEventListener("pointermove", (e) => {
    mouse.tx = e.clientX / Math.max(1, w);
    mouse.ty = e.clientY / Math.max(1, h);
  }, { passive: true });

  document.addEventListener(
    "pointerover",
    (e) => {
      const t = e.target.closest("button, .card, .toggle, a, .check, .step, .pick");
      if (!t) return;
      clickSound();
    },
    { passive: true }
  );

  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      setSound(!soundOn);
      clickSound();
    };
  }

  window.addEventListener("resize", resize);
  syncFlags();
  resize();
  raf = requestAnimationFrame(loop);
})();
