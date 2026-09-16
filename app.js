const $ = (sel, el = document) => el.querySelector(sel);
const ACC_KEY = "life.accounts.v3";
const SES_KEY = "life.session.v3";
const saveKey = (login) => "life.save.v3." + login;

const AREAS = [
  { id: "body", name: "Тело" },
  { id: "mind", name: "Разум" },
  { id: "work", name: "Дело" },
  { id: "social", name: "Люди" },
  { id: "rest", name: "Восстановление" },
];

const DIFFS = [
  { id: "easy", name: "Лёгкая", xp: 12, coin: 4, hp: 2 },
  { id: "normal", name: "Обычная", xp: 28, coin: 8, hp: 4 },
  { id: "hard", name: "Сложная", xp: 55, coin: 16, hp: 7 },
  { id: "epic", name: "Ключевая", xp: 110, coin: 32, hp: 12 },
];

const SHOP = [
  { id: "heal", name: "Восстановить здоровье", desc: "+25 HP", cost: 40, kind: "hp", val: 25 },
  { id: "full", name: "Полное восстановление", desc: "HP до 100", cost: 90, kind: "hpfull" },
  { id: "boost", name: "Фокус на день", desc: "×1.5 XP сегодня", cost: 50, kind: "boost" },
  { id: "shield", name: "Щит", desc: "Завтра без штрафа HP", cost: 60, kind: "shield" },
];

const BADGES = [
  { id: "first", name: "Старт", desc: "Первая выполненная цель" },
  { id: "streak3", name: "Ритм", desc: "3 дня подряд" },
  { id: "streak7", name: "Неделя", desc: "7 дней подряд" },
  { id: "streak30", name: "Месяц", desc: "30 дней подряд" },
  { id: "lvl5", name: "Уровень 5", desc: "Достиг 5 уровня" },
  { id: "lvl10", name: "Уровень 10", desc: "Достиг 10 уровня" },
  { id: "done20", name: "20 целей", desc: "Выполнил 20 целей" },
  { id: "done100", name: "100 целей", desc: "Выполнил 100 целей" },
  { id: "survive", name: "На грани", desc: "HP упало ниже 20 и ты выжил" },
];

const STARTERS = [
  { title: "Движение 20 минут", area: "body", diff: "easy", daily: true, due: "" },
  { title: "Главная задача дня", area: "work", diff: "normal", daily: true, due: "" },
  { title: "Отдых без экрана 30 мин", area: "rest", diff: "easy", daily: true, due: "" },
];

const NAV = [
  ["home", "Сегодня"],
  ["goals", "Цели"],
  ["notes", "Заметки"],
  ["chat", "Ассистент"],
  ["music", "Музыка"],
  ["stats", "Прогресс"],
  ["me", "Профиль"],
  ["set", "Ещё"],
];

let accounts = loadAccounts();
let session = loadSession();
let state = session ? loadState(session.login) : defaultState();
const TAB_ORDER = ["home", "goals", "notes", "chat", "music", "stats", "me", "set"];
let tab = "home";
let lastTab = "home";
let filter = "open";
let authMode = "login";
let pickDevice = guessDevice();
let toastT = 0;
let tracks = [];
let trackI = 0;
let chatDraft = "";
let goalQuery = "";
let timer = { total: 25 * 60, left: 25 * 60, run: false, mode: "focus" };
let timerIv = 0;
let calCursor = new Date();
let lastNotifyKey = "";

const MOODS = [
  { id: "low", name: "тяжело" },
  { id: "ok", name: "норма" },
  { id: "good", name: "ясно" },
  { id: "fire", name: "драйв" },
];

const TIMER_PRESETS = [
  { id: "15", name: "15", sec: 15 * 60 },
  { id: "25", name: "25", sec: 25 * 60 },
  { id: "45", name: "45", sec: 45 * 60 },
  { id: "5", name: "пауза 5", sec: 5 * 60 },
];

function xpNeed(lv) {
  return Math.round(70 * Math.pow(lv, 1.32));
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function shiftDate(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function esc(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function guessDevice() {
  if (tgApp()) return "phone";
  return window.matchMedia("(max-width: 800px)").matches ? "phone" : "pc";
}

function tgApp() {
  const w = window.Telegram && window.Telegram.WebApp;
  return w && w.initData ? w : null;
}

function tgUser() {
  const tg = tgApp();
  return tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
}

function tgLogin() {
  return "tg" + tgUser().id;
}

function enterTelegram() {
  const u = tgUser();
  if (!u) return false;
  const login = tgLogin();
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Я";
  if (!accounts[login]) {
    accounts[login] = { pass: "tg", name, created: today(), tg: true };
    saveAccounts();
  }
  session = { login, device: "phone", tg: true };
  saveSession();
  state = loadState(login);
  if (!state.user) createUser(name, login);
  else if (!state.user.name) state.user.name = name;
  if (u.photo_url && !state.user.avatar) state.user.avatar = u.photo_url;
  state.user.login = login;
  save();
  return true;
}

function bootTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return;
  document.documentElement.classList.add("tg");
  tg.ready();
  tg.expand();
  try {
    tg.disableVerticalSwipes();
  } catch {}
  try {
    tg.setHeaderColor("bg_color");
    tg.setBackgroundColor("bg_color");
    tg.setBottomBarColor("bg_color");
  } catch {}
  if (tg.SettingsButton) {
    tg.SettingsButton.show();
    tg.SettingsButton.onClick(() => {
      tab = "set";
      render();
    });
  }
  if (tgUser() && (!session || session.login !== tgLogin())) enterTelegram();
}

function haptic(type) {
  try {
    const h = tgApp() && tgApp().HapticFeedback;
    if (!h) return;
    if (type === "ok") h.notificationOccurred("success");
    else if (type === "bad") h.notificationOccurred("error");
    else h.impactOccurred("light");
  } catch {}
}

async function hashPass(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("life:" + s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACC_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveAccounts() {
  localStorage.setItem(ACC_KEY, JSON.stringify(accounts));
}
function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SES_KEY) || "null");
  } catch {
    return null;
  }
}
function saveSession() {
  if (session) localStorage.setItem(SES_KEY, JSON.stringify(session));
  else localStorage.removeItem(SES_KEY);
}

function emptyUser() {
  return {
    name: "",
    login: "",
    focus: "",
    note: "",
    avatar: "",
    level: 1,
    xp: 0,
    hp: 100,
    coins: 12,
    streak: 0,
    completed: 0,
    missed: 0,
    lastGoal: null,
    created: today(),
    boostUntil: null,
    shield: false,
    days: {},
  };
}

function defaultState() {
  return {
    user: null,
    goals: [],
    notes: [],
    chat: [
      {
        id: uid(),
        who: "bot",
        text: "Я локальный ассистент. Вижу твои цели, здоровье и серию. Пиши, что происходит — разберём по шагам.",
      },
    ],
    log: [],
    badges: {},
    moods: {},
    reviews: {},
    pin: null,
    settings: {
      theme: "dark",
      reduceMotion: false,
      dailyPenalty: true,
      sound: false,
      notify: false,
      remindReview: "21:00",
      remindOpen: "18:00",
      remindMorning: "10:00",
    },
    lastOpen: today(),
  };
}

function loadState(login) {
  try {
    const raw = localStorage.getItem(saveKey(login));
    if (!raw) return defaultState();
    const s = { ...defaultState(), ...JSON.parse(raw) };
    s.settings = { ...defaultState().settings, ...(s.settings || {}) };
    s.notes = s.notes || [];
    s.moods = s.moods || {};
    s.reviews = s.reviews || {};
    s.pin = s.pin || null;
    s.chat = s.chat && s.chat.length ? s.chat : defaultState().chat;
    (s.goals || []).forEach((g) => {
      g.photos = g.photos || [];
      g.journal = g.journal || [];
      g.steps = g.steps || [];
    });
    return s;
  } catch {
    return defaultState();
  }
}

function save() {
  if (!session) return;
  try {
    localStorage.setItem(saveKey(session.login), JSON.stringify(state));
  } catch {
    toast("Мало места. Убери лишние фото");
  }
}

function applyTheme() {
  const tg = tgApp();
  const theme = tg ? (tg.colorScheme === "light" ? "light" : "dark") : state.settings?.theme || "dark";
  const narrow = window.matchMedia("(max-width: 800px)").matches;
  const device = tg || narrow ? "phone" : session?.device || pickDevice;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.device = device;
  document.documentElement.dataset.reduce = state.settings?.reduceMotion ? "1" : "";
  const egg = document.documentElement.dataset.egg;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) {
    m.content =
      egg === "matrix" ? "#010300" : egg === "fallout" ? "#0b0903" : theme === "light" ? "#f7f7f7" : "#0a0a0a";
  }
  if (tg) {
    try {
      tg.setHeaderColor("bg_color");
      tg.setBackgroundColor("bg_color");
      tg.setBottomBarColor("bg_color");
    } catch {}
  }
}

function toast(msg) {
  clearTimeout(toastT);
  const old = $(".toast");
  if (old) old.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  toastT = setTimeout(() => t.remove(), 2200);
}

function addLog(text, extra) {
  state.log.unshift({ id: uid(), text, extra, at: new Date().toISOString() });
  state.log = state.log.slice(0, 80);
}

function gainXp(n) {
  const u = state.user;
  if (u.boostUntil === today()) n = Math.round(n * 1.5);
  u.xp += n;
  let up = 0;
  while (u.xp >= xpNeed(u.level)) {
    u.xp -= xpNeed(u.level);
    u.level += 1;
    u.hp = clamp(u.hp + 8, 0, 100);
    up += 1;
  }
  if (up) toast("Уровень " + u.level);
  badges();
}

function changeHp(n) {
  const u = state.user;
  const was = u.hp;
  u.hp = clamp(u.hp + n, 0, 100);
  if (u.hp < 20) badges();
  if (was > 0 && u.hp === 0) {
    addLog("Здоровье на нуле", "восстановись");
    toast("Здоровье на нуле");
  }
}

function badges() {
  const u = state.user;
  const got = (id) => {
    if (state.badges[id]) return;
    state.badges[id] = today();
    toast("Знак: " + BADGES.find((b) => b.id === id).name);
  };
  if (u.completed >= 1) got("first");
  if (u.streak >= 3) got("streak3");
  if (u.streak >= 7) got("streak7");
  if (u.streak >= 30) got("streak30");
  if (u.level >= 5) got("lvl5");
  if (u.level >= 10) got("lvl10");
  if (u.completed >= 20) got("done20");
  if (u.completed >= 100) got("done100");
  if (u.hp < 20 && u.hp > 0) got("survive");
}

function tickDay() {
  if (!state.user) return;
  const t = today();
  if (state.lastOpen === t) return;
  const y = shiftDate(-1);
  const u = state.user;
  if (state.lastOpen !== y) u.streak = 0;
  if (state.settings.dailyPenalty) {
    const missed = state.goals.filter((g) => g.daily && !g.done);
    const overdue = state.goals.filter((g) => !g.daily && !g.done && g.due && g.due < t);
    let dmg = missed.length * 6 + overdue.length * 8;
    if (dmg && u.shield) {
      u.shield = false;
      dmg = 0;
      addLog("Щит спас от штрафа");
    }
    if (dmg) {
      changeHp(-dmg);
      u.missed += missed.length + overdue.length;
      addLog("Пропущенные цели", "−" + dmg + " HP");
    }
  }
  state.goals.forEach((g) => {
    if (g.daily) {
      g.done = false;
      g.doneAt = null;
    }
  });
  if (u.boostUntil && u.boostUntil !== t) u.boostUntil = null;
  state.lastOpen = t;
  save();
}

function markDay() {
  state.user.days[today()] = "ok";
}

function complete(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g || g.done) return;
  const d = DIFFS.find((x) => x.id === g.diff);
  g.done = true;
  g.doneAt = today();
  const u = state.user;
  u.coins += d.coin;
  u.completed += 1;
  if (u.lastGoal !== today()) {
    u.streak = u.lastGoal === shiftDate(-1) ? u.streak + 1 : 1;
    u.lastGoal = today();
  }
  changeHp(d.hp);
  gainXp(d.xp);
  markDay();
  addLog(g.title, "+" + d.xp + " XP");
  save();
  haptic("ok");
  render();
  toast("+" + d.xp + " XP  +" + d.hp + " HP");
}

function undo(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g || !g.done) return;
  const d = DIFFS.find((x) => x.id === g.diff);
  g.done = false;
  g.doneAt = null;
  const u = state.user;
  u.coins = Math.max(0, u.coins - d.coin);
  u.completed = Math.max(0, u.completed - 1);
  u.xp = Math.max(0, u.xp - d.xp);
  changeHp(-d.hp);
  save();
  render();
}

function failGoal(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g || g.done) return;
  const dmg = g.diff === "epic" ? 16 : g.diff === "hard" ? 10 : 6;
  g.failed = true;
  if (g.daily) {
    g.done = true;
    g.doneAt = today();
  }
  state.user.missed += 1;
  changeHp(-dmg);
  addLog("Не выполнено: " + g.title, "−" + dmg + " HP");
  save();
  haptic("bad");
  render();
  toast("−" + dmg + " HP");
}

function removeGoal(id) {
  state.goals = state.goals.filter((g) => g.id !== id);
  save();
  render();
}

function addGoal(data) {
  state.goals.unshift({
    id: uid(),
    title: data.title.trim(),
    area: data.area,
    diff: data.diff,
    daily: !!data.daily,
    due: data.due || "",
    note: data.note || "",
    photos: data.photos || [],
    journal: [],
    steps: (data.steps || []).map((t) => ({ id: uid(), title: t, done: false })),
    done: false,
    failed: false,
    created: today(),
  });
  save();
}

function createUser(name, login) {
  state = defaultState();
  state.user = emptyUser();
  state.user.name = name.trim() || login;
  state.user.login = login;
  STARTERS.forEach(addGoal);
  state.lastOpen = today();
  save();
}

function fmtClock(sec) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function tickTimer() {
  if (!timer.run) return;
  timer.left -= 1;
  const el = $("#clock");
  if (el) el.textContent = fmtClock(timer.left);
  if (timer.left > 0) return;
  timer.run = false;
  clearInterval(timerIv);
  timer.left = timer.total;
  if (state.user) {
    gainXp(8);
    changeHp(2);
    addLog("Фокус-сессия", "+8 XP");
    save();
  }
  haptic("ok");
  toast("Сессия закрыта · +8 XP");
  if (tab === "home") render();
}

function startTimer() {
  if (timer.run) return;
  timer.run = true;
  clearInterval(timerIv);
  timerIv = setInterval(tickTimer, 1000);
  haptic();
  render();
}

function pauseTimer() {
  timer.run = false;
  clearInterval(timerIv);
  render();
}

function setTimer(sec) {
  timer.total = sec;
  timer.left = sec;
  timer.run = false;
  clearInterval(timerIv);
  render();
}

function setMood(id) {
  state.moods[today()] = id;
  save();
  haptic();
  render();
}

function pinGoal(id) {
  state.pin = state.pin === id ? null : id;
  save();
  render();
}

function toggleStep(gid, sid) {
  const g = state.goals.find((x) => x.id === gid);
  if (!g) return;
  const s = (g.steps || []).find((x) => x.id === sid);
  if (!s) return;
  s.done = !s.done;
  if (s.done) {
    gainXp(3);
    haptic("ok");
    toast("+3 XP за шаг");
  }
  save();
  render();
}

function saveReview() {
  const win = ($("#rWin") && $("#rWin").value.trim()) || "";
  const block = ($("#rBlock") && $("#rBlock").value.trim()) || "";
  const next = ($("#rNext") && $("#rNext").value.trim()) || "";
  if (!win && !block && !next) return toast("Напиши хоть одну строку");
  state.reviews[today()] = { win, block, next };
  gainXp(6);
  save();
  haptic("ok");
  toast("День разобран · +6 XP");
  render();
}

function buy(item) {
  const u = state.user;
  if (u.coins < item.cost) return toast("Не хватает очков");
  u.coins -= item.cost;
  if (item.kind === "hp") changeHp(item.val);
  if (item.kind === "hpfull") u.hp = 100;
  if (item.kind === "boost") u.boostUntil = today();
  if (item.kind === "shield") u.shield = true;
  addLog("Куплено: " + item.name);
  save();
  render();
  toast(item.name);
}

function dayCount() {
  const a = new Date(state.user.created + "T00:00:00");
  const b = new Date(today() + "T00:00:00");
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function initials() {
  const n = (state.user.name || "Я").trim();
  const p = n.split(/\s+/);
  return ((p[0][0] || "Я") + (p[1] ? p[1][0] : "")).toUpperCase();
}

function avatarHtml(cls = "avatar") {
  const a = state.user.avatar;
  if (a) return `<div class="${cls}" style="background-image:url('${a}')"></div>`;
  return `<div class="${cls}">${esc(initials())}</div>`;
}

function compressImage(file, max = 720, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("not image"));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function pickFile(accept, cb) {
  const i = document.createElement("input");
  i.type = "file";
  i.accept = accept;
  i.onchange = () => {
    if (i.files[0]) cb(i.files[0]);
  };
  i.click();
}

function assistantReply(text) {
  const t = text.toLowerCase();
  const u = state.user;
  const open = state.goals.filter((g) => !g.done);
  const daily = open.filter((g) => g.daily);
  const overdue = open.filter((g) => g.due && g.due < today());
  if (/здоров|hp|сил/.test(t)) {
    if (u.hp < 30) return "Здоровье " + u.hp + ". Закрой лёгкую цель или возьми восстановление в профиле. Не копи пропуски.";
    return "Здоровье " + u.hp + ". Норма. Держи ежедневные цели закрытыми до конца дня.";
  }
  if (/цел|квест|сдела|что/.test(t)) {
    if (!open.length) return "Открытых целей нет. Поставь одну конкретную на сегодня — с видимым результатом.";
    return (
      "Открыто " +
      open.length +
      ". Главные: " +
      open
        .slice(0, 3)
        .map((g) => g.title)
        .join("; ") +
      (overdue.length ? ". Просрочено: " + overdue.length : "")
    );
  }
  if (/план|сегодня|с чего/.test(t)) {
    const first = daily[0] || open[0];
    return first
      ? "Сначала: «" + first.title + "». Потом короткая запись, как сделал. Серия сейчас " + u.streak + "."
      : "Поставь одну цель на 25 минут. Название — глагол + результат.";
  }
  if (/мотивац|лень|не хоч/.test(t)) {
    return "Не жди настроение. Выбери цель на 10 минут и отметь. Импульс появляется после старта, не до.";
  }
  if (/таймер|фокус|помодор/.test(t)) return "На главной есть таймер 15/25/45. Закрытая сессия даёт опыт. Сначала главная цель, потом таймер.";
  if (/календар|месяц/.test(t)) return "Календарь в Прогрессе. Точка — день закрыт, бледный день — пропуск.";
  if (/напомин/.test(t)) return "Напоминания в Настройках. Включи пуш и поставь время утра, дня и вечернего разбора.";
  if (/настроен|как я/.test(t)) {
    const m = MOODS.find((x) => x.id === state.moods[today()]);
    return m ? "Сегодня ты отметил: " + m.name + ". Если тяжело — одна лёгкая цель и короткая сессия." : "Отметь настроение на главной. Это не оценка, а снимок дня.";
  }
  if (/музык/.test(t)) return "Открой вкладку Музыка и загрузи свои треки. Они остаются на этом устройстве.";
  if (/фото|ават/.test(t)) return "Аватар — в профиле. К цели фото и отчёт — через ··· у цели.";
  if (u.hp < 25) return "Сейчас важнее здоровье, чем новые цели. Закрой одну лёгкую или восстановись.";
  if (open.length > 8) return "Слишком много открытого. Оставь 3 на сегодня, остальное спрячь в срок.";
  return (
    "Уровень " +
    u.level +
    ", серия " +
    u.streak +
    ", HP " +
    u.hp +
    ". Открытых целей: " +
    open.length +
    ". Напиши «план» — соберу порядок на сегодня."
  );
}

function sendChat(text) {
  const msg = text.trim();
  if (!msg) return;
  state.chat.push({ id: uid(), who: "me", text: msg });
  state.chat.push({ id: uid(), who: "bot", text: assistantReply(msg) });
  state.chat = state.chat.slice(-60);
  save();
  render();
}

function svg(name) {
  const s = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 11 12 4l8 7v9H4z"/></svg>`,
    goals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>`,
    notes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4h10v16H7z"/><path d="M10 8h4M10 12h4M10 16h2"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 6h14v10H8l-3 3z"/></svg>`,
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/></svg>`,
    stats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 19V9m7 10V5m7 14v-6"/></svg>`,
    cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`,
    me: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3"/><path d="M5 19c1.4-3.2 3.8-4.5 7-4.5s5.6 1.3 7 4.5"/></svg>`,
    set: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 4v2m0 12v2M4 12h2m12 0h2"/></svg>`,
  };
  return s[name] || "";
}

function navMobile() {
  const items = [
    ["home", "Сегодня"],
    ["goals", "Цели"],
    ["stats", "Прогресс"],
    ["me", "Я"],
    ["set", "Ещё"],
  ];
  return `<nav class="nav">${items
    .map(([id, n]) => `<button class="${tab === id ? "active" : ""}" data-tab="${id}">${svg(id)}${n}</button>`)
    .join("")}</nav>`;
}

function sidePc() {
  return `<aside class="side">
    <div class="kicker brand">LIFE</div>
    ${NAV.map(
      ([id, n]) => `<button class="${tab === id ? "active" : ""}" data-tab="${id}">${svg(id)}${n}</button>`
    ).join("")}
    <div style="margin-top:auto" class="tiny">${esc(state.user.login)} · ${session.device === "pc" ? "ПК" : "телефон"}</div>
  </aside>`;
}

function shell(inner, fab) {
  return `<div class="shell">${sidePc()}
    ${inner}
    ${navMobile()}
    ${fab ? `<button class="fab" id="fab">+</button>` : ""}
  </div>`;
}

function bar(val, max, cls = "") {
  const pct = max ? clamp(Math.round((val / max) * 100), 0, 100) : 0;
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
}

function goalCard(g) {
  const d = DIFFS.find((x) => x.id === g.diff);
  const a = AREAS.find((x) => x.id === g.area);
  const overdue = !g.done && g.due && g.due < today();
  const ph = (g.photos || [])[0];
  return `<div class="goal card ${g.done ? "done" : ""} ${g.failed ? "fail" : ""}">
    <button class="check" data-toggle="${g.id}"></button>
    <div class="grow">
      <div class="between">
        <div class="title">${esc(g.title)}</div>
        <button class="icon-btn" data-more="${g.id}">···</button>
      </div>
      <div class="meta">
        <span class="chip">${a.name}</span>
        <span class="chip">+${d.xp} XP</span>
        ${g.daily ? `<span class="chip">каждый день</span>` : ""}
        ${g.due ? `<span class="chip">${overdue ? "срок прошёл" : "до " + g.due}</span>` : ""}
        ${(g.journal || []).length ? `<span class="chip">отчёт ${(g.journal || []).length}</span>` : ""}
        ${state.pin === g.id ? `<span class="chip">главная</span>` : ""}
      </div>
      ${
        (g.steps || []).length
          ? `<div class="steps">${g.steps
              .map(
                (s) =>
                  `<button class="step ${s.done ? "on" : ""}" data-step="${g.id}:${s.id}"><i class="mini"></i>${esc(s.title)}</button>`
              )
              .join("")}</div>`
          : ""
      }
    </div>
    ${ph ? `<img class="thumb" src="${ph}" alt="" />` : ""}
  </div>`;
}

function viewHome() {
  const u = state.user;
  const todayGoals = state.goals.filter((g) => g.daily || (!g.done && (!g.due || g.due >= today())));
  const open = todayGoals.filter((g) => !g.done && g.id !== state.pin);
  const doneN = state.goals.filter((g) => g.done && g.doneAt === today()).length;
  const need = xpNeed(u.level);
  return shell(
    `<div class="scroll">
      <div class="between">
        <div class="row">
          ${avatarHtml()}
          <div>
            <div class="kicker">День ${dayCount()}</div>
            <h1 style="margin-top:4px;font-size:24px">${esc(u.name)}</h1>
          </div>
        </div>
        <div class="tiny" style="text-align:right">серия ${u.streak}<br>ур. ${u.level}</div>
      </div>
      ${u.focus ? `<p class="muted" style="margin-top:10px;line-height:1.5">${esc(u.focus)}</p>` : ""}
      <div class="vital">
        <div class="cell"><div class="n">Здоровье</div><div class="v">${u.hp}</div>${bar(u.hp, 100, "hp")}</div>
        <div class="cell"><div class="n">Опыт</div><div class="v">${Math.round((u.xp / need) * 100)}%</div>${bar(u.xp, need)}</div>
        <div class="cell"><div class="n">Очки</div><div class="v">${u.coins}</div>${bar(Math.min(u.coins, 100), 100, "dim")}</div>
      </div>
      ${u.hp <= 25 ? `<div class="card tiny">Здоровье низкое. Закрой цели или восстановись в профиле.</div>` : ""}
      <h2>Как ты сейчас</h2>
      <div class="moods">${MOODS.map(
        (m) => `<button class="${state.moods[today()] === m.id ? "on" : ""}" data-mood="${m.id}">${m.name}</button>`
      ).join("")}</div>
      <div class="card timer">
        <div class="tiny">${timer.run ? "идёт фокус" : "фокус"}</div>
        <div class="clock ${timer.run ? "live" : ""}" id="clock">${fmtClock(timer.left)}</div>
        <div class="presets">${TIMER_PRESETS.map(
          (p) => `<button class="chip" data-preset="${p.sec}" style="background:none;cursor:pointer">${p.name}</button>`
        ).join("")}</div>
        <div class="row" style="justify-content:center">
          <button class="btn btn-main" id="timerGo" style="width:auto;min-width:140px">${timer.run ? "Пауза" : "Старт"}</button>
        </div>
      </div>
      ${
        state.pin && state.goals.find((g) => g.id === state.pin)
          ? `<h2>Главная сегодня</h2>${goalCard(state.goals.find((g) => g.id === state.pin))}`
          : `<div class="card tiny">Отметь одну цель как главную — через ···. С неё начинается день.</div>`
      }
      <div class="between"><h2 style="margin:0">Месяц</h2><button class="tiny" data-tab="stats" style="background:none;border:0;color:var(--muted)">прогресс</button></div>
      <div class="daygrid" style="margin-bottom:8px">
        ${["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => `<div class="cal-head">${d}</div>`).join("")}
        ${monthGrid(new Date())}
      </div>
      <div class="between"><h2 style="margin:0">Сегодня</h2><span class="tiny">${doneN} готово</span></div>
      <div class="gap"></div>
      ${open.length ? open.map(goalCard).join("") : `<div class="empty">На сегодня всё.</div>`}
      ${todayGoals.filter((g) => g.done).length ? `<h2>Сделано</h2>${todayGoals.filter((g) => g.done).map(goalCard).join("")}` : ""}
      <h2>Разбор дня</h2>
      ${
        state.reviews[today()]
          ? `<div class="card"><div class="tiny">записано</div><p style="margin-top:8px;line-height:1.5">${esc(state.reviews[today()].win)}</p>
            ${state.reviews[today()].block ? `<p class="muted" style="margin-top:6px">${esc(state.reviews[today()].block)}</p>` : ""}
            ${state.reviews[today()].next ? `<p class="tiny" style="margin-top:6px">завтра: ${esc(state.reviews[today()].next)}</p>` : ""}</div>`
          : `<div class="card">
            <label>Что получилось</label>
            <textarea id="rWin" placeholder="один факт"></textarea>
            <label>Что мешало</label>
            <textarea id="rBlock" placeholder="по желанию"></textarea>
            <label>Завтра первым делом</label>
            <input id="rNext" placeholder="одна конкретная вещь" />
            <button class="btn btn-main" id="saveReview" style="margin-top:12px">Закрыть день</button>
          </div>`
      }
    </div>`,
    true
  );
}

function viewGoals() {
  let list =
    filter === "all"
      ? state.goals
      : filter === "daily"
      ? state.goals.filter((g) => g.daily)
      : filter === "open"
      ? state.goals.filter((g) => !g.done)
      : filter === "due"
      ? state.goals.filter((g) => g.due && !g.done)
      : state.goals.filter((g) => g.done);
  const q = goalQuery.trim().toLowerCase();
  if (q) list = list.filter((g) => (g.title + " " + (g.note || "")).toLowerCase().includes(q));
  return shell(
    `<div class="scroll">
      <h1>Цели</h1>
      <p class="muted" style="margin:8px 0 14px;line-height:1.5">Срок, фото, шаги, отчёт. Пропуск снимает здоровье.</p>
      <input class="search" id="goalSearch" placeholder="найти цель" value="${esc(goalQuery)}" />
      <div class="tabs">
        ${[
          ["open", "Открытые"],
          ["daily", "Ежедневные"],
          ["due", "Со сроком"],
          ["done", "Готово"],
          ["all", "Все"],
        ]
          .map(([id, n]) => `<button class="${filter === id ? "on" : ""}" data-filter="${id}">${n}</button>`)
          .join("")}
      </div>
      ${list.length ? list.map(goalCard).join("") : `<div class="empty">Пока пусто</div>`}
    </div>`,
    true
  );
}

function viewNotes() {
  return shell(
    `<div class="scroll">
      <div class="between"><h1>Заметки</h1><button class="btn btn-ghost" id="newNote" style="width:auto;padding:8px 12px">Новая</button></div>
      <p class="muted" style="margin:8px 0 14px">Черновики, мысли, разбор дня. Отдельно от целей.</p>
      ${
        state.notes.length
          ? state.notes
              .map(
                (n) => `<div class="card note-item" data-note="${n.id}">
                  <h3>${esc(n.title || "Без названия")}</h3>
                  <div class="tiny">${esc((n.body || "").slice(0, 90))}${n.body && n.body.length > 90 ? "…" : ""}</div>
                </div>`
              )
              .join("")
          : `<div class="empty">Пусто. Запиши, что крутится в голове.</div>`
      }
    </div>`
  );
}

function viewChat() {
  return shell(
    `<div class="scroll chat-wrap">
      <h1>Ассистент</h1>
      <p class="tiny" style="margin:6px 0 12px">Локально. Без интернета. Смотрит твой прогресс на этом устройстве.</p>
      <div class="msgs" id="msgs">${state.chat
        .map((m) => `<div class="msg ${m.who}">${esc(m.text)}</div>`)
        .join("")}</div>
      <div class="composer">
        <input id="chatIn" placeholder="написать…" value="${esc(chatDraft)}" />
        <button class="btn btn-main" id="chatSend" style="width:auto">Ок</button>
      </div>
    </div>`
  );
}

function viewMusic() {
  const cur = tracks[trackI];
  return shell(
    `<div class="scroll">
      <h1>Музыка</h1>
      <p class="muted" style="margin:8px 0 14px">Свои файлы. Играют здесь, никуда не уходят.</p>
      <div class="card player">
        <div class="tiny">${cur ? esc(cur.name) : "трек не выбран"}</div>
        <div class="playbar">
          <button id="prevT">‹</button>
          <button id="playT">${audioEl().paused ? "▶" : "❚❚"}</button>
          <button id="nextT">›</button>
          <input id="vol" type="range" min="0" max="1" step="0.01" value="${audioEl().volume}" style="flex:1" />
        </div>
      </div>
      <button class="btn btn-ghost" id="addTracks" style="margin-bottom:12px">Добавить треки</button>
      ${
        tracks.length
          ? tracks
              .map(
                (t, i) =>
                  `<div class="track ${i === trackI ? "on" : ""}" data-track="${i}"><span>${esc(t.name)}</span><span class="tiny">${i === trackI && !audioEl().paused ? "сейчас" : ""}</span></div>`
              )
              .join("")
          : `<div class="empty">mp3, m4a, wav — с телефона или компа</div>`
      }
    </div>`
  );
}

function weekMoods() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const id = shiftDate(-i);
    const d = new Date(id + "T00:00:00");
    const label = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()];
    const m = MOODS.find((x) => x.id === state.moods[id]);
    days.push(`<div class="day ${m ? "on" : ""}">${label}${m ? `<span class="tiny">${m.name.slice(0, 3)}</span>` : ""}</div>`);
  }
  return days.join("");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthGrid(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m + 1, 0).getDate();
  const created = state.user ? state.user.created : today();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(`<div class="cal-cell empty"></div>`);
  for (let d = 1; d <= daysIn; d++) {
    const id = y + "-" + pad2(m + 1) + "-" + pad2(d);
    const ok = state.user && state.user.days[id] === "ok";
    const mood = state.moods[id];
    const review = state.reviews[id];
    const isToday = id === today();
    const past = id < today() && id >= created;
    const miss = past && !ok;
    const cls = ["cal-cell", isToday ? "today" : "", ok ? "ok" : "", miss ? "miss" : ""].filter(Boolean).join(" ");
    cells.push(
      `<div class="${cls}" title="${id}">${d}<span class="dots">${ok ? '<i class="d"></i>' : ""}${mood ? '<i class="d mood"></i>' : ""}${review ? '<i class="d"></i>' : ""}</span></div>`
    );
  }
  return cells.join("");
}

function monthTitle(date) {
  const names = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  return names[date.getMonth()] + " " + date.getFullYear();
}

function nowHM() {
  const d = new Date();
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

function openGoalsCount() {
  return state.goals.filter((g) => !g.done).length;
}

function notify(title, body, key) {
  if (!state.settings?.notify) return;
  if (lastNotifyKey === key) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  lastNotifyKey = key;
  try {
    new Notification(title, { body, silent: false });
  } catch {}
}

function tickReminders() {
  if (!state.user || !state.settings?.notify) return;
  const t = today();
  const hm = nowHM();
  const s = state.settings;
  if (s.remindMorning && hm === s.remindMorning) {
    const pin = state.pin && state.goals.find((g) => g.id === state.pin && !g.done);
    notify("LIFE", pin ? "Главная сегодня: " + pin.title : "Отметь главную цель на день", t + "-morn");
  }
  if (s.remindOpen && hm === s.remindOpen && openGoalsCount()) {
    notify("LIFE", "Открытых целей: " + openGoalsCount(), t + "-open");
  }
  if (s.remindReview && hm === s.remindReview && !state.reviews[t]) {
    notify("LIFE", "Вечерний разбор ещё не записан", t + "-rev");
  }
}

async function enableNotify() {
  if (!("Notification" in window)) return toast("Уведомления тут не поддерживаются");
  const p = await Notification.requestPermission();
  state.settings.notify = p === "granted";
  save();
  if (state.settings.notify) {
    toast("Напоминания включены");
    notify("LIFE", "Ок. Напомню про цели и разбор дня.", "test");
  } else toast("Доступ не дан");
  render();
}

function weekDays() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const id = shiftDate(-i);
    const d = new Date(id + "T00:00:00");
    const label = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()];
    const ok = state.user.days[id] === "ok";
    days.push(`<div class="day ${ok ? "on" : ""}">${label}${ok ? '<span class="dot"></span>' : ""}</div>`);
  }
  return days.join("");
}

function areaStats() {
  return AREAS.map((a) => {
    const all = state.goals.filter((g) => g.area === a.id);
    const done = all.filter((g) => g.done).length;
    const pct = all.length ? Math.round((done / Math.max(all.length, 1)) * 100) : 0;
    return `<div class="progress-row"><div class="top"><span>${a.name}</span><span class="tiny">${done}/${all.length}</span></div>${bar(pct, 100)}</div>`;
  }).join("");
}

function viewStats() {
  const u = state.user;
  return shell(
    `<div class="scroll">
      <h1>Прогресс</h1>
      <div class="between" style="margin:8px 0 10px">
        <button class="btn btn-ghost" id="calPrev" style="width:auto;padding:8px 12px">‹</button>
        <div>${monthTitle(calCursor)}</div>
        <button class="btn btn-ghost" id="calNext" style="width:auto;padding:8px 12px">›</button>
      </div>
      <div class="daygrid">
        ${["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => `<div class="cal-head">${d}</div>`).join("")}
        ${monthGrid(calCursor)}
      </div>
      <p class="tiny" style="margin:8px 0 0">точка — день закрыт · бледная — пропуск</p>
      <h2>Неделя</h2>
      <div class="daygrid">${weekDays()}</div>
      <div class="vital" style="margin-top:16px">
        <div class="cell"><div class="n">Серия</div><div class="v">${u.streak}</div></div>
        <div class="cell"><div class="n">Готово</div><div class="v">${u.completed}</div></div>
        <div class="cell"><div class="n">Пропуски</div><div class="v">${u.missed}</div></div>
      </div>
      <h2>Настроение</h2>
      <div class="daygrid">${weekMoods()}</div>
      <h2>Направления</h2>
      <div class="card">${areaStats()}</div>
      <h2>Журнал</h2>
      ${
        state.log.length
          ? state.log
              .slice(0, 12)
              .map((l) => `<div class="log-item"><span>${esc(l.text)}</span><span class="tiny">${esc(l.extra || "")}</span></div>`)
              .join("")
          : `<div class="tiny">Появятся записи после целей</div>`
      }
    </div>`
  );
}

function viewMe() {
  const u = state.user;
  const need = xpNeed(u.level);
  return shell(
    `<div class="scroll">
      <div class="row" style="margin-bottom:18px">
        ${avatarHtml()}
        <div class="grow">
          <h1>${esc(u.name)}</h1>
          <div class="tiny">@${esc(u.login)} · уровень ${u.level} · день ${dayCount()}</div>
        </div>
      </div>
      <button class="btn btn-ghost" id="setAvatar" style="margin-bottom:16px">Сменить аватар</button>
      <div class="progress-row"><div class="top"><span>Опыт</span><span class="tiny">${u.xp} / ${need}</span></div>${bar(u.xp, need)}</div>
      <div class="progress-row"><div class="top"><span>Здоровье</span><span class="tiny">${u.hp} / 100</span></div>${bar(u.hp, 100, "hp")}</div>
      <h2>Профиль</h2>
      <div class="card">
        <label>Имя</label>
        <input id="pName" value="${esc(u.name)}" maxlength="24" />
        <label>Фокус сейчас</label>
        <input id="pFocus" value="${esc(u.focus)}" maxlength="80" placeholder="например: сон и спорт" />
        <label>Заметка</label>
        <textarea id="pNote" placeholder="зачем ты это ведёшь">${esc(u.note)}</textarea>
        <button class="btn btn-main" id="saveP" style="margin-top:14px">Сохранить</button>
      </div>
      <h2>Восстановление</h2>
      ${SHOP.map(
        (it) => `<div class="card shop ${u.coins < it.cost ? "off" : ""}">
          <div><div>${it.name}</div><div class="tiny">${it.desc} · ${it.cost} очков</div></div>
          <button class="btn btn-ghost" style="width:auto;padding:8px 12px" data-buy="${it.id}">Взять</button>
        </div>`
      ).join("")}
      <h2>Знаки</h2>
      ${BADGES.map((b) => {
        const got = !!state.badges[b.id];
        return `<div class="list-row" style="opacity:${got ? 1 : 0.35}"><div><div>${b.name}</div><div class="tiny">${b.desc}</div></div><div class="tiny">${got ? "есть" : ""}</div></div>`;
      }).join("")}
    </div>`
  );
}

function viewSet() {
  const s = state.settings;
  return shell(
    `<div class="scroll">
      <h1>Настройки</h1>
      <div class="list-row"><div>Светлая тема</div><button class="toggle ${s.theme === "light" ? "on" : ""}" data-set="theme"><i></i></button></div>
      <div class="list-row"><div><div>Штраф за пропуск</div><div class="tiny">утром снимается HP за вчера</div></div><button class="toggle ${s.dailyPenalty ? "on" : ""}" data-set="dailyPenalty"><i></i></button></div>
      <div class="list-row"><div>Меньше движения</div><button class="toggle ${s.reduceMotion ? "on" : ""}" data-set="reduceMotion"><i></i></button></div>
      <div class="list-row"><div>Звук интерфейса</div><button class="toggle ${(window.LIFE_FX ? LIFE_FX.isSound() : s.sound) ? "on" : ""}" data-set="sound"><i></i></button></div>
      <h2>Напоминания</h2>
      <div class="list-row">
        <div>
          <div>Пуш-уведомления</div>
          <div class="tiny">браузер спросит разрешение</div>
        </div>
        <button class="toggle ${s.notify ? "on" : ""}" id="togNotify"><i></i></button>
      </div>
      <label>Утро · главная цель</label>
      <input id="tMorning" type="time" value="${esc(s.remindMorning || "10:00")}" />
      <label>День · открытые цели</label>
      <input id="tOpen" type="time" value="${esc(s.remindOpen || "18:00")}" />
      <label>Вечер · разбор дня</label>
      <input id="tReview" type="time" value="${esc(s.remindReview || "21:00")}" />
      <button class="btn btn-ghost" id="saveRemind" style="margin-top:12px">Сохранить время</button>
      <h2>Устройство</h2>
      <div class="device-pick">
        <button class="${session.device === "phone" ? "on" : ""}" data-dev="phone">Телефон<span class="sub">узкий экран</span></button>
        <button class="${session.device === "pc" ? "on" : ""}" data-dev="pc">Компьютер<span class="sub">боковое меню</span></button>
      </div>
      <h2>Аккаунт</h2>
      <div class="tiny" style="margin-bottom:10px">@${esc(session.login)}${session.tg ? " · Telegram" : ""}</div>
      ${tgApp() ? `<button class="btn btn-ghost" id="tgClose" style="margin-bottom:8px">Закрыть в Telegram</button>` : ""}
      ${session.tg ? "" : `<button class="btn btn-ghost" id="logout" style="margin-bottom:8px">Выйти</button>`}
      <h2>Данные</h2>
      <button class="btn btn-ghost" id="export" style="margin-bottom:8px">Экспорт</button>
      <button class="btn btn-ghost" id="imp" style="margin-bottom:8px">Импорт</button>
      <input type="file" id="file" accept="application/json" hidden />
      <button class="btn btn-warn" id="reset">Сбросить прогресс</button>
      <p class="tiny" style="margin-top:18px;line-height:1.5">Логин и данные только на этом устройстве. Это не облако.</p>
    </div>`
  );
}

function viewGate() {
  const inTg = !!tgApp();
  return `
    <div class="gate">
      <div class="kicker">LIFE</div>
      <h1>${inTg ? "Открыто в Telegram." : "Сначала устройство, потом вход."}</h1>
      <p class="muted" style="line-height:1.5;margin-bottom:8px">${
        inTg
          ? "Можно войти аккаунтом Telegram — без пароля. Либо своим логином, как в браузере."
          : "Телефон — нижнее меню. ПК — колонка слева. Можно сменить позже."
      }</p>
      ${
        inTg
          ? `<button class="btn btn-main" id="tgEnter" style="margin-bottom:16px">Войти через Telegram</button>`
          : `<div class="device-pick">
        <button class="${pickDevice === "phone" ? "on" : ""}" data-pick="phone">Телефон<span class="sub">с телефона</span></button>
        <button class="${pickDevice === "pc" ? "on" : ""}" data-pick="pc">Компьютер<span class="sub">с компа</span></button>
      </div>`
      }
      <div class="auth-tabs">
        <button class="${authMode === "login" ? "on" : ""}" data-auth="login">Вход</button>
        <button class="${authMode === "reg" ? "on" : ""}" data-auth="reg">Регистрация</button>
      </div>
      ${
        authMode === "reg"
          ? `<label>Имя</label><input id="gName" maxlength="24" placeholder="как к тебе обращаться" />`
          : ""
      }
      <label>Логин</label>
      <input id="gLogin" maxlength="24" placeholder="латиница или цифры" />
      <label>Пароль</label>
      <input id="gPass" type="password" maxlength="64" placeholder="минимум 4 символа" />
      <button class="btn btn-main" id="goAuth" style="margin-top:18px">${authMode === "reg" ? "Создать" : "Войти"}</button>
      <p class="tiny" style="margin-top:14px">Пароль хранится здесь в виде хеша. Сервера нет.</p>
    </div>
  `;
}

function modalNew() {
  return `<div class="modal-bg" id="modal"><div class="modal">
    <div class="grab"></div>
    <h1 style="font-size:22px">Новая цель</h1>
    <label>Что сделать</label>
    <input id="qTitle" placeholder="конкретно и измеримо" />
    <label>Направление</label>
    <select id="qArea">${AREAS.map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}</select>
    <label>Вес</label>
    <select id="qDiff">${DIFFS.map((d) => `<option value="${d.id}">${d.name} · +${d.xp} XP · +${d.hp} HP</option>`).join("")}</select>
    <label>Прогноз срока</label>
    <input id="qDue" type="date" />
    <label>Как поймёшь, что готово</label>
    <textarea id="qNote" placeholder="критерий готовности"></textarea>
    <label>Шаги (каждый с новой строки)</label>
    <textarea id="qSteps" placeholder="найти зал&#10;размяться&#10;сделать подход"></textarea>
    <label class="row" style="margin-top:12px"><input type="checkbox" id="qDaily" style="width:auto" /> каждый день</label>
    <div class="row" style="margin-top:16px">
      <button class="btn btn-ghost" id="cancel">Отмена</button>
      <button class="btn btn-main" id="saveQ">Добавить</button>
    </div>
  </div></div>`;
}

function modalMore(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g) return "";
  const photos = g.photos || [];
  const journal = g.journal || [];
  return `<div class="modal-bg" id="modal"><div class="modal">
    <div class="grab"></div>
    <h1 style="font-size:20px">${esc(g.title)}</h1>
    ${g.note ? `<p class="muted" style="margin:10px 0;line-height:1.5">${esc(g.note)}</p>` : ""}
    <p class="tiny" style="margin-bottom:12px">${g.due ? "срок " + g.due : "без срока"}</p>
    ${photos.length ? `<div class="photos">${photos.map((p) => `<img src="${p}" alt="" />`).join("")}</div>` : ""}
    <button class="btn btn-ghost" id="addPhoto" style="margin:10px 0">Прикрепить фото</button>
    <h2>Как выполнял</h2>
    ${
      journal.length
        ? journal
            .map((j) => `<div class="log-item"><span>${esc(j.text)}</span><span class="tiny">${esc(j.at.slice(0, 10))}</span></div>`)
            .join("")
        : `<div class="tiny">Пока нет отчёта</div>`
    }
    <label>Новая запись</label>
    <textarea id="jText" placeholder="что сделал, сколько заняло, что мешало"></textarea>
    <button class="btn btn-main" id="saveJ" style="margin-top:10px">Сохранить отчёт</button>
    <button class="btn btn-ghost" id="pinGoal" style="margin-top:8px">${state.pin === g.id ? "Убрать из главных" : "Сделать главной на сегодня"}</button>
    <label>Добавить шаг</label>
    <div class="row">
      <input id="newStep" placeholder="маленькое действие" />
      <button class="btn btn-ghost" id="addStep" style="width:auto">+</button>
    </div>
    ${g.done ? "" : `<button class="btn btn-ghost" data-fail="${g.id}" style="margin-top:8px">Не выполнил — снять HP</button>`}
    <button class="btn btn-warn" data-del="${g.id}" style="margin-top:8px">Удалить цель</button>
    <button class="btn btn-ghost" id="cancel" style="margin-top:8px">Закрыть</button>
  </div></div>`;
}

function modalNote(note) {
  const n = note || { id: "", title: "", body: "" };
  return `<div class="modal-bg" id="modal"><div class="modal">
    <div class="grab"></div>
    <h1 style="font-size:20px">${n.id ? "Заметка" : "Новая заметка"}</h1>
    <label>Заголовок</label>
    <input id="nTitle" value="${esc(n.title)}" />
    <label>Текст</label>
    <textarea id="nBody" style="min-height:140px">${esc(n.body)}</textarea>
    <div class="row" style="margin-top:14px">
      <button class="btn btn-ghost" id="cancel">Закрыть</button>
      <button class="btn btn-main" id="saveN">Сохранить</button>
    </div>
    ${n.id ? `<button class="btn btn-warn" id="delN" style="margin-top:8px">Удалить</button>` : ""}
  </div></div>`;
}

function closeModal() {
  const m = $("#modal");
  if (m) m.remove();
}

function openNew() {
  document.body.insertAdjacentHTML("beforeend", modalNew());
  $("#cancel").onclick = closeModal;
  $("#modal").onclick = (e) => {
    if (e.target.id === "modal") closeModal();
  };
  $("#saveQ").onclick = () => {
    const title = $("#qTitle").value.trim();
    if (!title) return toast("Напиши цель");
    addGoal({
      title,
      area: $("#qArea").value,
      diff: $("#qDiff").value,
      due: $("#qDue").value,
      note: $("#qNote").value.trim(),
      steps: ($("#qSteps").value || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8),
      daily: $("#qDaily").checked,
    });
    closeModal();
    tab = "goals";
    render();
    toast("Цель добавлена");
  };
}

function openMore(id) {
  document.body.insertAdjacentHTML("beforeend", modalMore(id));
  const g = () => state.goals.find((x) => x.id === id);
  $("#cancel").onclick = closeModal;
  $("#modal").onclick = (e) => {
    if (e.target.id === "modal") closeModal();
  };
  $("#addPhoto").onclick = () => {
    pickFile("image/*", async (file) => {
      try {
        const data = await compressImage(file, 900, 0.7);
        const goal = g();
        goal.photos = (goal.photos || []).concat(data).slice(0, 4);
        save();
        closeModal();
        openMore(id);
        toast("Фото добавлено");
      } catch {
        toast("Не вышло прочитать фото");
      }
    });
  };
  $("#pinGoal").onclick = () => {
    pinGoal(id);
    closeModal();
    tab = "home";
    render();
  };
  $("#addStep").onclick = () => {
    const title = $("#newStep").value.trim();
    if (!title) return toast("Напиши шаг");
    const goal = g();
    goal.steps = goal.steps || [];
    if (goal.steps.length >= 8) return toast("Максимум 8 шагов");
    goal.steps.push({ id: uid(), title, done: false });
    save();
    closeModal();
    openMore(id);
  };
  $("#saveJ").onclick = () => {
    const text = $("#jText").value.trim();
    if (!text) return toast("Напиши, как сделал");
    const goal = g();
    goal.journal = goal.journal || [];
    goal.journal.unshift({ id: uid(), text, at: new Date().toISOString() });
    save();
    closeModal();
    openMore(id);
    toast("Отчёт записан");
  };
  const fail = $("[data-fail]");
  if (fail)
    fail.onclick = () => {
      failGoal(id);
      closeModal();
    };
  $("[data-del]").onclick = () => {
    removeGoal(id);
    closeModal();
  };
}

function openNote(id) {
  const note = id ? state.notes.find((n) => n.id === id) : { id: "", title: "", body: "" };
  document.body.insertAdjacentHTML("beforeend", modalNote(note));
  $("#cancel").onclick = closeModal;
  $("#modal").onclick = (e) => {
    if (e.target.id === "modal") closeModal();
  };
  $("#saveN").onclick = () => {
    const title = $("#nTitle").value.trim();
    const body = $("#nBody").value.trim();
    if (!title && !body) return toast("Пусто");
    if (note.id) {
      note.title = title;
      note.body = body;
    } else {
      state.notes.unshift({ id: uid(), title, body, at: today() });
    }
    save();
    closeModal();
    render();
  };
  const del = $("#delN");
  if (del)
    del.onclick = () => {
      state.notes = state.notes.filter((n) => n.id !== note.id);
      save();
      closeModal();
      render();
    };
}

function audioEl() {
  return document.getElementById("audio");
}

function playTrack(i) {
  if (!tracks[i]) return;
  trackI = i;
  const a = audioEl();
  a.src = tracks[i].url;
  a.play().catch(() => {});
  if (tab === "music") render();
}

function bindMusic() {
  const add = $("#addTracks");
  if (add)
    add.onclick = () => {
      const i = document.createElement("input");
      i.type = "file";
      i.accept = "audio/*";
      i.multiple = true;
      i.onchange = () => {
        [...i.files].forEach((f) => tracks.push({ name: f.name, url: URL.createObjectURL(f) }));
        if (tracks.length && audioEl().paused) playTrack(tracks.length - [...i.files].length);
        render();
      };
      i.click();
    };
  const play = $("#playT");
  if (play)
    play.onclick = () => {
      const a = audioEl();
      if (!tracks.length) return toast("Сначала добавь трек");
      if (!a.src) playTrack(trackI);
      else if (a.paused) a.play();
      else a.pause();
      render();
    };
  const next = $("#nextT");
  const prev = $("#prevT");
  if (next)
    next.onclick = () => {
      if (tracks.length) playTrack((trackI + 1) % tracks.length);
    };
  if (prev)
    prev.onclick = () => {
      if (tracks.length) playTrack((trackI - 1 + tracks.length) % tracks.length);
    };
  const vol = $("#vol");
  if (vol) vol.oninput = () => (audioEl().volume = Number(vol.value));
  document.querySelectorAll("[data-track]").forEach((el) => {
    el.onclick = () => playTrack(Number(el.dataset.track));
  });
}

function bind() {
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => {
      const next = b.dataset.tab;
      if (next === tab) return;
      const a = TAB_ORDER.indexOf(tab);
      const c = TAB_ORDER.indexOf(next);
      const dir = a >= 0 && c >= 0 && c > a ? "right" : "left";
      lastTab = tab;
      tab = next;
      render(dir);
    };
  });
  document.querySelectorAll("[data-filter]").forEach((b) => {
    b.onclick = () => {
      filter = b.dataset.filter;
      render();
    };
  });
  document.querySelectorAll("[data-toggle]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.toggle;
      const g = state.goals.find((x) => x.id === id);
      if (g.done) undo(id);
      else complete(id);
    };
  });
  document.querySelectorAll("[data-more]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      openMore(b.dataset.more);
    };
  });
  document.querySelectorAll("[data-buy]").forEach((b) => {
    b.onclick = () => buy(SHOP.find((x) => x.id === b.dataset.buy));
  });
  document.querySelectorAll("[data-note]").forEach((b) => {
    b.onclick = () => openNote(b.dataset.note);
  });
  document.querySelectorAll("[data-mood]").forEach((b) => {
    b.onclick = () => setMood(b.dataset.mood);
  });
  document.querySelectorAll("[data-preset]").forEach((b) => {
    b.onclick = () => setTimer(Number(b.dataset.preset));
  });
  document.querySelectorAll("[data-step]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const [gid, sid] = b.dataset.step.split(":");
      toggleStep(gid, sid);
    };
  });
  const timerGo = $("#timerGo");
  if (timerGo)
    timerGo.onclick = () => {
      if (timer.run) pauseTimer();
      else startTimer();
    };
  const saveRev = $("#saveReview");
  if (saveRev) saveRev.onclick = saveReview;
  const gs = $("#goalSearch");
  if (gs)
    gs.oninput = () => {
      goalQuery = gs.value;
    };
  if (gs)
    gs.onkeydown = (e) => {
      if (e.key === "Enter") {
        goalQuery = gs.value;
        render();
      }
    };
  const fab = $("#fab");
  if (fab) fab.onclick = openNew;
  const newNote = $("#newNote");
  if (newNote) newNote.onclick = () => openNote("");

  const chatSend = $("#chatSend");
  const chatIn = $("#chatIn");
  if (chatSend && chatIn) {
    const go = () => {
      const v = chatIn.value;
      chatDraft = "";
      sendChat(v);
    };
    chatSend.onclick = go;
    chatIn.onkeydown = (e) => {
      if (e.key === "Enter") go();
    };
    chatIn.oninput = () => (chatDraft = chatIn.value);
    const box = $(".scroll");
    if (box) box.scrollTop = box.scrollHeight;
  }

  bindMusic();

  const calPrev = $("#calPrev");
  const calNext = $("#calNext");
  if (calPrev)
    calPrev.onclick = () => {
      calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
      render();
    };
  if (calNext)
    calNext.onclick = () => {
      calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
      render();
    };
  const togNotify = $("#togNotify");
  if (togNotify)
    togNotify.onclick = () => {
      if (state.settings.notify) {
        state.settings.notify = false;
        save();
        render();
      } else enableNotify();
    };
  const saveRemind = $("#saveRemind");
  if (saveRemind)
    saveRemind.onclick = () => {
      state.settings.remindMorning = $("#tMorning").value || "10:00";
      state.settings.remindOpen = $("#tOpen").value || "18:00";
      state.settings.remindReview = $("#tReview").value || "21:00";
      save();
      toast("Время напоминаний сохранено");
    };

  const saveP = $("#saveP");
  if (saveP)
    saveP.onclick = () => {
      state.user.name = $("#pName").value.trim() || state.user.name;
      state.user.focus = $("#pFocus").value.trim();
      state.user.note = $("#pNote").value.trim();
      save();
      toast("Профиль сохранён");
      render();
    };
  const setAvatar = $("#setAvatar");
  if (setAvatar)
    setAvatar.onclick = () => {
      pickFile("image/*", async (file) => {
        try {
          state.user.avatar = await compressImage(file, 360, 0.78);
          save();
          render();
          toast("Аватар обновлён");
        } catch {
          toast("Не вышло");
        }
      });
    };

  document.querySelectorAll("[data-set]").forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.set;
      if (k === "theme") state.settings.theme = state.settings.theme === "light" ? "dark" : "light";
      else state.settings[k] = !state.settings[k];
      if (k === "sound" && window.LIFE_FX) LIFE_FX.setSound(!!state.settings.sound);
      save();
      applyTheme();
      render();
    };
  });
  document.querySelectorAll("[data-dev]").forEach((b) => {
    b.onclick = () => {
      session.device = b.dataset.dev;
      saveSession();
      applyTheme();
      render();
    };
  });

  const logout = $("#logout");
  if (logout)
    logout.onclick = () => {
      session = null;
      saveSession();
      state = defaultState();
      tab = "home";
      render();
    };
  const tgClose = $("#tgClose");
  if (tgClose) tgClose.onclick = () => tgApp() && tgApp().close();

  const reset = $("#reset");
  if (reset)
    reset.onclick = () => {
      if (!confirm("Стереть прогресс этого аккаунта?")) return;
      const login = session.login;
      const name = state.user.name;
      createUser(name, login);
      render();
    };

  const exp = $("#export");
  if (exp)
    exp.onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "life-backup.json";
      a.click();
    };
  const imp = $("#imp");
  const file = $("#file");
  if (imp && file) {
    imp.onclick = () => file.click();
    file.onchange = () => {
      const f = file.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          state = { ...defaultState(), ...JSON.parse(r.result) };
          save();
          applyTheme();
          render();
          toast("Импортировано");
        } catch {
          toast("Файл не подошёл");
        }
      };
      r.readAsText(f);
    };
  }
}

function bindGate() {
  document.querySelectorAll("[data-pick]").forEach((b) => {
    b.onclick = () => {
      pickDevice = b.dataset.pick;
      render();
    };
  });
  document.querySelectorAll("[data-auth]").forEach((b) => {
    b.onclick = () => {
      authMode = b.dataset.auth;
      render();
    };
  });
  const tgEnter = $("#tgEnter");
  if (tgEnter)
    tgEnter.onclick = () => {
      if (enterTelegram()) {
        haptic("ok");
        render();
      } else toast("Telegram не отдал профиль");
    };
  $("#goAuth").onclick = async () => {
    const login = ($("#gLogin").value || "").trim().toLowerCase();
    const pass = $("#gPass").value || "";
    if (!/^[a-z0-9_.-]{3,24}$/.test(login)) return toast("Логин: 3–24, латиница/цифры");
    if (pass.length < 4) return toast("Пароль короче 4");
    const h = await hashPass(pass);
    if (authMode === "reg") {
      if (accounts[login]) return toast("Такой логин уже есть");
      const name = ($("#gName").value || "").trim() || login;
      accounts[login] = { pass: h, name, created: today() };
      saveAccounts();
      session = { login, device: pickDevice };
      saveSession();
      createUser(name, login);
      render();
      toast("Аккаунт создан");
      return;
    }
    const acc = accounts[login];
    if (!acc || acc.pass !== h) return toast("Неверный логин или пароль");
    session = { login, device: pickDevice };
    saveSession();
    state = loadState(login);
    if (!state.user) createUser(acc.name, login);
    render();
  };
}

function flashCut() {
  if (state.settings?.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const old = $(".cut");
  if (old) old.remove();
  const f = document.createElement("div");
  f.className = "cut";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 400);
}

function render(dir) {
  applyTheme();
  const app = $("#app");
  if (!session) {
    app.removeAttribute("data-dir");
    app.innerHTML = viewGate();
    bindGate();
    return;
  }
  if (!state.user) state = loadState(session.login);
  tickDay();
  const views = {
    home: viewHome,
    goals: viewGoals,
    notes: viewNotes,
    chat: viewChat,
    music: viewMusic,
    stats: viewStats,
    me: viewMe,
    set: viewSet,
  };
  if (dir) {
    app.dataset.dir = dir;
    flashCut();
    haptic();
  } else {
    app.removeAttribute("data-dir");
  }
  app.innerHTML = (views[tab] || viewHome)();
  bind();
}

const audio = document.getElementById("audio");
if (audio) {
  audio.addEventListener("ended", () => {
    if (tracks.length) playTrack((trackI + 1) % tracks.length);
  });
}

function runBoot() {
  const el = document.getElementById("boot");
  if (!el) return;
  const skip = () => {
    el.classList.add("off");
    setTimeout(() => el.remove(), 720);
  };
  const btn = document.getElementById("bootSkip");
  if (btn) btn.onclick = skip;
  el.addEventListener("click", (e) => {
    if (e.target === btn) return;
    skip();
  });
  const reduce =
    (state.settings && state.settings.reduceMotion) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    document.documentElement.dataset.reduce = "1";
    skip();
    return;
  }
  setTimeout(skip, 2400);
}

bootTelegram();
runBoot();
if ("serviceWorker" in navigator && !tgApp()) navigator.serviceWorker.register("./sw.js").catch(() => {});
setInterval(tickReminders, 30000);
render();
