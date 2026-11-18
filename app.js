import { Chess } from './vendor/chess.js';
import * as X from './engine/xiangqi.js';
import * as G from './engine/gomoku.js';
import { NAMES as NAMES_ALL, HINTS as HINTS_ALL, TIERS, PUBLIC_OVERRIDES, PUBLIC_HINTS } from './tiers.js';
import { PUBLIC, WS_DEFAULT } from './config.js';
import { t, lang, setLang, fmtNum, applyStatic } from './i18n.js';
const tierName = (i) => NAMES_ALL[lang][i];

const $ = (id) => document.getElementById(id);
const svg = $('board');
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent = svg, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ================= 工作站连接 =================
const ws = { url: store.get('wsUrl', WS_DEFAULT), online: false, rtt: null, info: null };
$('ws-url').value = ws.url;
$('ws-url').addEventListener('change', (e) => {
  ws.url = e.target.value.trim().replace(/\/$/, '');
  store.set('wsUrl', ws.url);
  checkWs();
});
async function fetchJson(url, body, timeout) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }
      : { signal: ctl.signal });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
async function checkWs() {
  const t0 = performance.now();
  try {
    ws.info = await fetchJson(ws.url + '/api/health', null, 3000);
    ws.rtt = Math.round(performance.now() - t0);
    ws.online = true;
  } catch { ws.online = false; }
  ws.checked = true;
  renderWs();
}
function renderWs() {
  $('ws-dot').className = 'dot ' + (ws.online ? 'on' : 'off');
  $('ws-info').innerHTML = ws.online
    ? t('ws.online', { cpus: ws.info.cpus, threads: ws.info.threads, rtt: ws.rtt }) + '<br>' +
      t('ws.engines', { sf: t(ws.info.stockfish ? 'ws.ok' : 'ws.missing'), pf: t(ws.info.pikafish ? 'ws.ok' : 'ws.missing'), load: ws.info.load.toFixed(1) })
    : !ws.checked ? t('ws.checking') : t('ws.offline');
}
if (!PUBLIC) { checkWs(); setInterval(checkWs, 15000); }

// ================= 笔记本 AI 线程 =================
let worker = null, jobId = 0;
function localThink(game, state, opts) {
  if (!worker) worker = new Worker('ai-worker.js', { type: 'module' });
  const id = ++jobId;
  return new Promise((resolve, reject) => {
    const on = ({ data }) => {
      if (data.id !== id) return;
      worker.removeEventListener('message', on);
      data.ok ? resolve(data) : reject(new Error(data.error));
    };
    worker.addEventListener('message', on);
    worker.postMessage({ id, game, state, opts });
  });
}
function resetWorker() {
  if (worker) { worker.terminate(); worker = null; }
  if (sfw) { sfw.terminate(); sfw = null; sfReady = null; }
}

// ================= 浏览器里的 Stockfish（WASM 精简版） =================
// 公开版和工作站不可用时，国际象棋的高档用它。每次新局/悔棋会重建，避免旧搜索的结果串进来。
let sfw = null, sfReady = null;
function sfEngine() {
  if (!sfw) {
    sfw = new Worker('vendor/stockfish/stockfish-19-lite-single.js');
    sfReady = new Promise((resolve, reject) => {
      const on = (e) => { if (e.data === 'uciok') { sfw.removeEventListener('message', on); resolve(sfw); } };
      sfw.addEventListener('message', on);
      sfw.addEventListener('error', (e) => reject(new Error(e.message || 'stockfish load failed')));
      setTimeout(() => reject(new Error('stockfish load timeout')), 20000);
      sfw.postMessage('uci');
    });
  }
  return sfReady;
}
async function browserStockfish(fen, { timeMs, elo, skill }) {
  const w = await sfEngine();
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('stockfish timeout')), timeMs + 10000);
    let last = {};
    const on = (e) => {
      const line = String(e.data);
      if (line.startsWith('info') && line.includes(' pv ')) {
        const g = (k) => { const m = line.match(new RegExp(` ${k} (\\S+)`)); return m && m[1]; };
        last = { depth: +g('depth'), nodes: +g('nodes'), score: line.match(/score (cp|mate) (-?\d+)/)?.slice(1), pv: line.split(' pv ')[1].split(' ').slice(0, 8) };
      } else if (line.startsWith('bestmove')) {
        w.removeEventListener('message', on);
        resolve({ move: line.split(' ')[1], ...last, engine: 'Stockfish 19 lite (WASM)', threads: 1, ms: Math.round(performance.now() - t0) });
      }
    };
    w.addEventListener('message', on);
    for (const c of elo
      ? ['setoption name UCI_LimitStrength value true', `setoption name UCI_Elo value ${elo}`]
      : ['setoption name UCI_LimitStrength value false', `setoption name Skill Level value ${skill ?? 20}`]) w.postMessage(c);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime ${timeMs}`);
  });
}

// ================= 分工策略 =================
// 每档难度的默认位置和参数见 tiers.js。“自动分工”再根据局面和工作站状态调整。
function decide(key, level, forced) {
  const tier = TIERS[key][level];
  const { fallback, ...p } = tier;
  // 文字在显示时才生成，切换语言后记录也会跟着变
  const name = { toString: () => tierName(level) }, loc = { toString: () => t(PUBLIC ? 'loc.browser' : 'loc.laptop') };
  // 国际象棋的工作站档离开工作站时，用浏览器里的 Stockfish，参数不变；其他游戏用本地引擎和 fallback 参数
  const sfChess = key === 'chess' && tier.where === 'ws';
  const local = sfChess ? { ...p, where: 'sf' } : { ...p, ...(fallback || {}), where: 'laptop', smp: false, engine: undefined, elo: undefined };
  const pref = $('where').value;
  if (forced) return { ...p, where: 'laptop', timeMs: 50, smp: false, engine: undefined, reason: () => t('why.forced', { what: t(forced), loc }) };
  if (PUBLIC) {
    if (sfChess) return { ...p, where: 'sf', reason: () => t('why.sfBrowser', { tier: name }) };
    if (tier.where === 'ws') return { ...local, ...PUBLIC_OVERRIDES[key][level], reason: () => t('why.browserDeep', { tier: name }) };
    return { ...p, reason: () => t('why.browser', { tier: name }) };
  }
  if (pref === 'laptop') {
    return { ...local, reason: () => t(sfChess ? 'why.sfManual' : tier.where === 'ws' ? 'why.manualLaptopSub' : 'why.manualLaptop', { tier: name, loc }) };
  }
  if (pref === 'ws') {
    if (!ws.online) return { ...local, reason: () => t('why.wsDown', { loc }) };
    if (tier.where === 'laptop' && key === 'chess') return { ...p, reason: () => t('why.chessLocalOnly', { tier: name, loc }) };
    return { ...p, where: 'ws', reason: () => t('why.manualWs') };
  }
  if (tier.where === 'ws' && !ws.online) return { ...local, reason: () => t(sfChess ? 'why.sfFallback' : 'why.wsOffline', { tier: name }) };
  if (tier.where === 'ws') {
    const n = ws.info.threads;
    const what = { toString: () => (key === 'chess' ? 'Stockfish' : p.engine ? 'Pikafish' : t('why.threads', { n })) };
    return { ...p, reason: () => t('why.toWs', { tier: name, what }) };
  }
  return { ...p, reason: () => t('why.local', { tier: name }) };
}

// 记录里存的是函数，切换语言时可以重新生成文字
let logItems = [];
function log(fn) {
  logItems.unshift(fn);
  logItems = logItems.slice(0, 30);
  renderLog();
}
function renderLog() {
  $('log').replaceChildren(...logItems.map((fn) => { const li = document.createElement('li'); li.textContent = fn(); return li; }));
}

// ================= 国际象棋 =================
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const chess = {
  key: 'chess', sides: ['w', 'b'], sideName: { get w() { return t('side.white'); }, get b() { return t('side.black'); } },
  reset() { this.g = new Chess(); this.sel = null; this.last = null; },
  turn() { return this.g.turn(); },
  over() {
    const g = this.g;
    if (g.isCheckmate()) return t('over.mate', { side: this.sideName[g.turn() === 'w' ? 'b' : 'w'] });
    if (g.isStalemate()) return t('over.stalemate');
    if (g.isThreefoldRepetition()) return t('over.threefold');
    if (g.isInsufficientMaterial()) return t('over.material');
    if (g.isDraw()) return t('over.fifty');
    return null;
  },
  forced() { return this.g.moves().length === 1 ? 'forced.one' : null; },
  winner() { return this.g.isCheckmate() ? (this.g.turn() === 'w' ? 'b' : 'w') : 0; },
  aiState() { return { fen: this.g.fen() }; },
  undo() { this.g.undo(); this.sel = null; this.last = null; },
  plies() { return this.g.history().length; },
  applyAi(r) {
    const m = this.g.move({ from: r.move.slice(0, 2), to: r.move.slice(2, 4), promotion: r.move[4] || 'q' });
    this.last = [m.from, m.to];
    return m.san;
  },
  moveList() { return this.g.history(); },
  render(flip) {
    const S = 70, O = 20;
    svg.setAttribute('viewBox', `0 0 ${8 * S + 2 * O} ${8 * S + 2 * O}`);
    const files = 'abcdefgh';
    const pos = (sq) => {
      let c = files.indexOf(sq[0]), r = 8 - +sq[1];
      if (flip) { c = 7 - c; r = 7 - r; }
      return [O + c * S, O + r * S];
    };
    const legal = this.sel ? this.g.moves({ square: this.sel, verbose: true }).map((m) => m.to) : [];
    const board = this.g.board();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const sq = files[c] + (8 - r);
      const [x, y] = pos(sq);
      el('rect', { x, y, width: S, height: S, fill: (r + c) % 2 ? 'var(--sq-dark)' : 'var(--sq-light)' });
      if (this.last?.includes(sq)) el('rect', { x, y, width: S, height: S, fill: 'var(--hl)' });
      if (sq === this.sel) el('rect', { x, y, width: S, height: S, fill: 'var(--sel)' });
      const p = board[r][c];
      if (p?.type === 'k' && p.color === this.g.turn() && this.g.inCheck())
        el('circle', { cx: x + S / 2, cy: y + S / 2, r: S * 0.45, fill: 'rgba(220,40,40,.55)' });
      if (p) {
        el('text', {
          x: x + S / 2, y: y + S * 0.78, 'text-anchor': 'middle', 'font-size': S * 0.82,
          'font-family': 'Segoe UI Symbol, DejaVu Sans, sans-serif',
          fill: p.color === 'w' ? '#fff' : '#1a1a1a', stroke: p.color === 'w' ? '#222' : '#000',
          'stroke-width': 1.4, 'paint-order': 'stroke',
        }, svg, GLYPH[p.type] + '︎');
      }
      if (legal.includes(sq))
        el('circle', { cx: x + S / 2, cy: y + S / 2, r: p ? S * 0.45 : S * 0.14, fill: p ? 'none' : 'rgba(0,0,0,.25)', stroke: p ? 'rgba(0,0,0,.35)' : 'none', 'stroke-width': 5 });
      const hit = el('rect', { x, y, width: S, height: S, fill: 'transparent', class: 'click' });
      hit.addEventListener('click', () => this.click(sq));
    }
    for (let i = 0; i < 8; i++) {
      const [x] = pos(files[i] + '1'), [, y] = pos('a' + (8 - i));
      el('text', { x: x + S / 2, y: 8 * S + O + 15, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)' }, svg, files[i]);
      el('text', { x: 8, y: y + S / 2 + 4, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)' }, svg, 8 - i);
    }
  },
  click(sq) {
    if (!humanToMove()) return;
    const p = this.g.get(sq);
    if (this.sel) {
      const mv = this.g.moves({ square: this.sel, verbose: true }).find((m) => m.to === sq);
      if (mv) {
        let promotion;
        if (mv.promotion) promotion = (prompt(t('promote'), 'q') || 'q').toLowerCase()[0];
        if (!'qrbn'.includes(promotion || 'q')) promotion = 'q';
        const m = this.g.move({ from: this.sel, to: sq, promotion });
        this.last = [m.from, m.to]; this.sel = null;
        return afterMove();
      }
    }
    this.sel = p && p.color === this.g.turn() ? sq : null;
    draw();
  },
};

// ================= 象棋 =================
const XQ_NAME = { 1: ['帅', '将'], 2: ['仕', '士'], 3: ['相', '象'], 4: ['马', '馬'], 5: ['车', '車'], 6: ['炮', '砲'], 7: ['兵', '卒'] };
const xiangqi = {
  key: 'xiangqi', sides: [X.RED, X.BLACK], sideName: { get [X.RED]() { return t('side.red'); }, get [X.BLACK]() { return t('side.black'); } },
  reset() { this.s = X.initialState(); this.stack = []; this.list = []; this.sel = null; this.last = null; },
  turn() { return this.s.side; },
  over() {
    if (X.legalMoves(this.s).length === 0)
      return t(X.inCheck(this.s.board, this.s.side) ? 'over.xqMate' : 'over.xqStuck', { side: this.sideName[-this.s.side] });
    if (this.list.length >= 300) return t('over.xqLong');
    const fen = X.toFen(this.s);
    if (this.s.history.filter((f) => f === fen).length >= 2) return t('over.xqRepeat');
    return null;
  },
  winner() { return X.legalMoves(this.s).length === 0 ? -this.s.side : 0; },
  forced() {
    const n = X.legalMoves(this.s).length;
    return n === 1 ? 'forced.one' : null;
  },
  aiState() { return { fen: X.toFen(this.s), history: this.s.history.slice(-40) }; },
  plies() { return this.list.length; },
  push(m) {
    this.stack.push({ s: this.s, last: this.last });
    this.list.push(X.moveToIccs(m));
    this.s = X.applyMove(this.s, m);
    this.last = [(m / 90) | 0, m % 90];
  },
  undo() { const p = this.stack.pop(); if (p) { this.s = p.s; this.last = p.last; this.list.pop(); } this.sel = null; },
  applyAi(r) {
    const m = typeof r.move === 'string' ? X.iccsToMove(r.move) : r.move;
    if (!X.legalMoves(this.s).includes(m)) throw new Error(t('err.illegal', { m: r.move }));
    this.push(m);
    return X.moveToIccs(m);
  },
  moveList() { return this.list; },
  render(flip) {
    const S = 64, O = 44;
    const W = 8 * S + 2 * O, H = 9 * S + 2 * O;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const xy = (i) => {
      let r = (i / 9) | 0, c = i % 9;
      if (flip) { r = 9 - r; c = 8 - c; }
      return [O + c * S, O + r * S];
    };
    el('rect', { x: 4, y: 4, width: W - 8, height: H - 8, rx: 10, fill: 'var(--wood)' });
    const L = { stroke: 'var(--wood-line)', 'stroke-width': 1.5 };
    for (let r = 0; r < 10; r++) el('line', { x1: O, y1: O + r * S, x2: O + 8 * S, y2: O + r * S, ...L });
    for (let c = 0; c < 9; c++) {
      if (c === 0 || c === 8) el('line', { x1: O + c * S, y1: O, x2: O + c * S, y2: O + 9 * S, ...L });
      else {
        el('line', { x1: O + c * S, y1: O, x2: O + c * S, y2: O + 4 * S, ...L });
        el('line', { x1: O + c * S, y1: O + 5 * S, x2: O + c * S, y2: O + 9 * S, ...L });
      }
    }
    for (const r0 of [0, 7]) {
      el('line', { x1: O + 3 * S, y1: O + r0 * S, x2: O + 5 * S, y2: O + (r0 + 2) * S, ...L });
      el('line', { x1: O + 5 * S, y1: O + r0 * S, x2: O + 3 * S, y2: O + (r0 + 2) * S, ...L });
    }
    el('rect', { x: O - 6, y: O - 6, width: 8 * S + 12, height: 9 * S + 12, fill: 'none', stroke: 'var(--wood-line)', 'stroke-width': 3 });
    const ry = O + 4.5 * S + 10;
    el('text', { x: O + 2 * S, y: ry, 'text-anchor': 'middle', 'font-size': 30, fill: 'var(--wood-line)', 'font-family': 'KaiTi, STKaiti, serif' }, svg, t('river.l'));
    el('text', { x: O + 6 * S, y: ry, 'text-anchor': 'middle', 'font-size': 30, fill: 'var(--wood-line)', 'font-family': 'KaiTi, STKaiti, serif' }, svg, t('river.r'));

    const legal = this.sel != null ? X.legalMoves(this.s).filter((m) => ((m / 90) | 0) === this.sel).map((m) => m % 90) : [];
    const checked = X.inCheck(this.s.board, this.s.side);
    for (let i = 0; i < 90; i++) {
      const [x, y] = xy(i), p = this.s.board[i];
      if (this.last?.includes(i))
        el('rect', { x: x - S * 0.42, y: y - S * 0.42, width: S * 0.84, height: S * 0.84, fill: 'none', stroke: '#2f6fd0', 'stroke-width': 2.5, 'stroke-dasharray': '6 4' });
      if (p) {
        const red = p > 0, t = Math.abs(p);
        const ring = i === this.sel ? '#2f6fd0' : (t === X.K && checked && p * this.s.side > 0 ? '#e02020' : (red ? '#b3261e' : '#222'));
        el('circle', { cx: x, cy: y, r: S * 0.44, fill: '#f8ecd0', stroke: ring, 'stroke-width': i === this.sel || ring === '#e02020' ? 4 : 2.5 });
        el('circle', { cx: x, cy: y, r: S * 0.36, fill: 'none', stroke: red ? '#b3261e' : '#222', 'stroke-width': 1 });
        el('text', { x, y: y + S * 0.15, 'text-anchor': 'middle', 'font-size': S * 0.44, 'font-weight': 700, fill: red ? '#b3261e' : '#222', 'font-family': 'KaiTi, STKaiti, serif' }, svg, XQ_NAME[t][red ? 0 : 1]);
      }
      if (legal.includes(i)) el('circle', { cx: x, cy: y, r: p ? S * 0.47 : 8, fill: p ? 'none' : 'rgba(47,111,208,.6)', stroke: p ? '#2f6fd0' : 'none', 'stroke-width': 3 });
      const hit = el('circle', { cx: x, cy: y, r: S / 2, fill: 'transparent', class: 'click' });
      hit.addEventListener('click', () => this.click(i));
    }
  },
  click(i) {
    if (!humanToMove()) return;
    if (this.sel != null) {
      const m = X.legalMoves(this.s).find((m) => ((m / 90) | 0) === this.sel && m % 90 === i);
      if (m != null) { this.sel = null; this.push(m); return afterMove(); }
    }
    this.sel = this.s.board[i] * this.s.side > 0 ? i : null;
    draw();
  },
};

// ================= 五子棋 =================
const N = G.SIZE;
const gomoku = {
  key: 'gomoku', sides: [G.BLACK, G.WHITE], sideName: { get [G.BLACK]() { return t('side.black'); }, get [G.WHITE]() { return t('side.white'); } },
  reset() { this.s = G.initialState(); this.stack = []; },
  turn() { return this.s.side; },
  over() {
    const last = this.s.moves.at(-1);
    if (last != null && G.isFive(this.s.board, last)) return t('over.five', { side: this.sideName[-this.s.side] });
    if (this.s.moves.length === N * N) return t('over.full');
    return null;
  },
  forced() {
    if (this.s.moves.length === 0) return 'forced.center';
    const b = Int8Array.from(this.s.board);
    let block = 0;
    for (let i = 0; i < N * N; i++) {
      if (b[i]) continue;
      b[i] = this.s.side; const win = G.isFive(b, i);
      b[i] = -this.s.side; const lose = G.isFive(b, i);
      b[i] = 0;
      if (win) return 'forced.win';
      if (lose) block++;
    }
    return block === 1 ? 'forced.block' : null;
  },
  aiState() { return { board: Array.from(this.s.board), side: this.s.side, moves: this.s.moves }; },
  winner() { const l = this.s.moves.at(-1); return l != null && G.isFive(this.s.board, l) ? -this.s.side : 0; },
  plies() { return this.s.moves.length; },
  undo() { const p = this.stack.pop(); if (p) this.s = p; },
  push(i) { this.stack.push(this.s); this.s = G.applyMove(this.s, i); },
  label(i) { return 'ABCDEFGHJKLMNOP'[i % N] + (N - ((i / N) | 0)); },
  applyAi(r) { this.push(r.move); return this.label(r.move); },
  moveList() { return this.s.moves.map((i) => this.label(i)); },
  render() {
    const S = 40, O = 36, W = (N - 1) * S + 2 * O;
    svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
    el('rect', { x: 4, y: 4, width: W - 8, height: W - 8, rx: 10, fill: 'var(--wood)' });
    for (let k = 0; k < N; k++) {
      el('line', { x1: O, y1: O + k * S, x2: O + (N - 1) * S, y2: O + k * S, stroke: 'var(--wood-line)', 'stroke-width': 1.2 });
      el('line', { x1: O + k * S, y1: O, x2: O + k * S, y2: O + (N - 1) * S, stroke: 'var(--wood-line)', 'stroke-width': 1.2 });
      el('text', { x: O + k * S, y: O - 16, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--wood-line)' }, svg, 'ABCDEFGHJKLMNOP'[k]);
      el('text', { x: O - 20, y: O + k * S + 4, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--wood-line)' }, svg, N - k);
    }
    for (const [a, b] of [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]])
      el('circle', { cx: O + a * S, cy: O + b * S, r: 4, fill: 'var(--wood-line)' });
    const last = this.s.moves.at(-1);
    const line = last != null ? G.winLine(this.s.board, last) : null;
    this.s.moves.forEach((i, n) => {
      const x = O + (i % N) * S, y = O + ((i / N) | 0) * S, black = this.s.board[i] === G.BLACK;
      el('circle', { cx: x, cy: y, r: S * 0.44, fill: black ? '#1d1d1d' : '#f7f7f2', stroke: black ? '#000' : '#999', 'stroke-width': 1 });
      if (i === last && !line) el('circle', { cx: x, cy: y, r: 5, fill: '#e0452b' });
      if (line?.includes(i)) el('circle', { cx: x, cy: y, r: S * 0.2, fill: '#e0452b' });
    });
    for (let i = 0; i < N * N; i++) {
      if (this.s.board[i]) continue;
      const hit = el('rect', { x: O + (i % N) * S - S / 2, y: O + ((i / N) | 0) * S - S / 2, width: S, height: S, fill: 'transparent', class: 'click' });
      hit.addEventListener('click', () => this.click(i));
    }
  },
  click(i) {
    if (!humanToMove() || this.s.board[i]) return;
    this.push(i);
    afterMove();
  },
};

// ================= 流程控制 =================
const GAMES = { chess, xiangqi, gomoku };
let cur = GAMES[store.get('game', 'chess')] || chess;
let flip = false, thinking = false, token = 0;

function aiSides() {
  const m = $('mode').value;
  if (m === 'pvp') return [];
  if (m === 'ava') return cur.sides;
  return m === 'first' ? [cur.sides[1]] : [cur.sides[0]];
}
const humanToMove = () => !thinking && !cur.over() && !aiSides().includes(cur.turn());

function draw() {
  svg.replaceChildren();
  cur.render(flip);
  const over = cur.over();
  const st = $('status');
  st.className = 'status' + (thinking ? ' thinking' : '');
  st.textContent = over || t(thinking ? 'status.thinking' : 'status.turn', { side: cur.sideName[cur.turn()] });
  const list = cur.moveList();
  $('moves').innerHTML = list.length
    ? list.map((m, i) => (i % 2 === 0 ? `<span>${i / 2 + 1}. ${m}` : ` ${m}</span>`)).join('') + (list.length % 2 ? '</span>' : '')
    : `<span class="muted">${t('moves.none')}</span>`;
  $('moves').scrollTop = 1e9;
}

function afterMove() {
  draw();
  maybeAdjust();
  if (!cur.over() && aiSides().includes(cur.turn())) setTimeout(think, $('mode').value === 'ava' ? 400 : 30);
}

function fmtScore(r) {
  if (Array.isArray(r.score)) {
    const [kind, v] = r.score;
    return kind === 'mate' ? { text: t(+v > 0 ? 'score.mateIn' : 'score.matedIn', { n: Math.abs(v) }), frac: +v > 0 ? 1 : 0 } : { text: (v / 100).toFixed(2), frac: 1 / (1 + Math.exp(-v / 250)) };
  }
  const v = r.score ?? 0;
  if (cur.key === 'gomoku') {
    if (v >= 2.5e8) return { text: t('score.win'), frac: 1 };
    if (v <= -2.5e8) return { text: t('score.loss'), frac: 0 };
    return { text: (v / 1000).toFixed(1), frac: 1 / (1 + Math.exp(-v / 8000)) };
  }
  if (Math.abs(v) > 90000) return { text: t(v > 0 ? 'score.xqWin' : 'score.xqLoss'), frac: v > 0 ? 1 : 0 };
  return { text: (v / 100).toFixed(2), frac: 1 / (1 + Math.exp(-v / 300)) };
}
const fmtN = fmtNum;

async function think() {
  if (thinking || cur.over()) return;
  const game = cur, my = ++token;
  thinking = true; draw();
  const level = +$('level').value;
  const plan = decide(game.key, level, game.forced());
  const state = game.aiState();
  const { where: _w, reason: _r, fallback: _f, ...opts } = plan;
  const t0 = performance.now();
  let r, where = plan.where, note = plan.reason;
  try {
    if (where === 'ws') {
      try {
        r = await fetchJson(`${ws.url}/api/${game.key}/move`, { ...state, ...opts }, plan.timeMs + 15000);
      } catch (e) {
        where = game.key === 'chess' ? 'sf' : 'laptop';
        const base = note, err = e.message;
        note = () => base() + t('why.wsError', { err, loc: where === 'sf' ? 'Stockfish (WASM)' : t('loc.laptop') });
        if (where === 'laptop') Object.assign(opts, TIERS[game.key][level].fallback || {}, { smp: false, engine: undefined, elo: undefined });
        ws.online = false; checkWs();
      }
    }
    if (where === 'sf') {
      try {
        r = await browserStockfish(state.fen, opts);
      } catch (e) {
        // WASM 加载失败（很旧的浏览器）或超时：退回本地小引擎
        if (sfw) { sfw.terminate(); sfw = null; sfReady = null; }
        where = 'laptop';
        Object.assign(opts, TIERS.chess[level].fallback || {});
      }
    }
    if (where === 'laptop') {
      r = await localThink(game.key, state, opts);
    }
  } catch (e) {
    if (my === token) { thinking = false; $('status').textContent = t('err.ai', { err: e.message }); }
    return;
  }
  if (my !== token || game !== cur) return; // 期间开了新局或换了游戏
  const total = Math.round(performance.now() - t0);
  thinking = false;
  const san = game.applyAi(r);
  const n = game.plies();
  const locKey = where === 'ws' ? 'loc.ws' : PUBLIC ? 'loc.browser' : 'loc.laptop';
  log(() => t('log.move', { n, m: san, loc: t(locKey), why: note() }));
  const sc0 = r;
  thinkView = () => {
    const sc = fmtScore(sc0);
    const eng = ['local', 'chessLocal', 'smp', 'single'].includes(r.engine) ? t('engine.' + r.engine) : r.engine;
    const net = where === 'ws' && r.ms != null ? t('think.net', { ms: Math.max(0, total - r.ms) }) : '';
    return `<span class="where ${where}">${t(locKey)}</span><b>${san}</b> · ${eng}<br>` +
      `${t('think.depth', { d: r.depth ?? '-' })}${r.maxDepth && r.maxDepth !== r.depth ? t('think.deepest', { d: r.maxDepth }) : ''} · ` +
      `${t('think.nodes', { n: fmtN(r.nodes) })} · ${t('think.threads', { n: r.threads || 1 })}<br>` +
      `${t('think.time', { ms: r.ms ?? total, total })}${net}<br>` +
      t('think.eval', { v: sc.text }) +
      (r.why ? '<br>' + t('think.reason', { v: t('reason.' + r.why) }) : '') +
      (r.weakened ? `<br><span class="weak">${t('think.weak')}</span>` : '') +
      (r.pv ? '<br>' + t('think.pv', { v: r.pv.join(' ') }) : '');
  };
  $('think').classList.remove('muted');
  $('think').innerHTML = thinkView();
  const sc = fmtScore(r);
  // 评估条：白/红/黑方占比
  const moverIsFirst = game.turn() !== game.sides[0];
  $('evalbar').firstElementChild.style.width = `${100 * (moverIsFirst ? sc.frac : 1 - sc.frac)}%`;
  afterMove();
}

// 自动调整难度：人对 AI 时，赢了升一档，输了降一档
let adjusted = false;
function maybeAdjust() {
  if (adjusted || !$('auto-level').checked || !cur.over()) return;
  const m = $('mode').value;
  if (m !== 'first' && m !== 'second') return;
  adjusted = true;
  const w = cur.winner();
  if (!w) return;
  const human = m === 'first' ? cur.sides[0] : cur.sides[1];
  const lv = +$('level').value, next = Math.max(0, Math.min(6, lv + (w === human ? 1 : -1)));
  if (next === lv) return;
  setLevel(next);
  const won = w === human;
  log(() => t(won ? 'adjust.won' : 'adjust.lost', { tier: tierName(next) }));
}

function fillLevels() {
  $('level').innerHTML = NAMES_ALL[lang].map((n, i) => `<option value="${i}">${i + 1} · ${n}</option>`).join('');
  setLevel(+store.get('level-' + cur.key, 2));
}
function setLevel(i) {
  $('level').value = i;
  store.set('level-' + cur.key, i);
  $('level-hint').textContent = (PUBLIC && PUBLIC_HINTS[lang][cur.key]?.[i]) || HINTS_ALL[lang][cur.key][i];
}

let thinkView = () => t('think.none');
function newGame() {
  adjusted = false;
  token++; thinking = false; resetWorker();
  cur.reset();
  flip = $('mode').value === 'second';
  thinkView = () => t('think.none'); $('think').innerHTML = thinkView(); $('think').classList.add('muted');
  $('evalbar').firstElementChild.style.width = '50%';
  afterMove();
}

$('btn-new').onclick = newGame;
$('btn-flip').onclick = () => { flip = !flip; draw(); };
$('btn-undo').onclick = () => {
  token++; thinking = false; resetWorker();
  cur.undo();
  // 对 AI 时一次退两步，退回到自己走
  if (aiSides().includes(cur.turn()) && aiSides().length < 2) cur.undo();
  draw();
};
for (const id of ['mode', 'where']) {
  $(id).value = store.get(id, $(id).value);
  $(id).addEventListener('change', () => {
    store.set(id, $(id).value);
    if (id === 'mode') newGame(); else afterMove();
  });
}
$('level').addEventListener('change', () => { setLevel(+$('level').value); afterMove(); });
$('auto-level').checked = store.get('autoLevel', '1') === '1';
$('auto-level').addEventListener('change', () => store.set('autoLevel', $('auto-level').checked ? '1' : '0'));
for (const b of document.querySelectorAll('#tabs button')) {
  b.classList.toggle('active', b.dataset.game === cur.key);
  b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
    cur = GAMES[b.dataset.game];
    store.set('game', cur.key);
    fillLevels();
    newGame();
  };
}
$('btn-lang').onclick = () => {
  setLang(lang === 'zh' ? 'en' : 'zh');
  applyStatic(); applyPublic();
  fillLevels();
  renderWs();
  renderLog();
  $('think').innerHTML = thinkView();
  draw();
};
function applyPublic() {
  if (!PUBLIC) return;
  $('ws-card').hidden = true;
  $('where-row').hidden = true;
  $('home-link').hidden = false;
  $('log-title').textContent = t('card.logPublic');
}
applyStatic(); applyPublic();
for (const g of Object.values(GAMES)) g.reset();
fillLevels();
newGame();
