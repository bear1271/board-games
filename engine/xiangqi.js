// 象棋规则与 AI（浏览器和 Node 通用）。
// 棋盘 10 行 x 9 列，下标 sq = r*9 + c，第 0 行是黑方底线，第 9 行是红方底线。
// 棋子编码：红方为正，黑方为负。1 帅 2 仕 3 相 4 马 5 车 6 炮 7 兵。

import { TT, STOP, zobrist, weakPick } from './common.js';
export const K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;
export const RED = 1, BLACK = -1;
const MATE = 100000;

const START =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR';
const FEN_CHAR = { k: K, a: A, b: B, n: N, r: R, c: C, p: P, h: N, e: B };

export function initialState() { return fromFen(START + ' w'); }

export function fromFen(fen) {
  const [rows, turn] = fen.trim().split(/\s+/);
  const board = new Int8Array(90);
  rows.split('/').forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { c += +ch; continue; }
      const t = FEN_CHAR[ch.toLowerCase()];
      board[r * 9 + c] = ch === ch.toUpperCase() ? t : -t;
      c++;
    }
  });
  return { board, side: turn === 'b' ? BLACK : RED, history: [] };
}

export function toFen(s) {
  const L = ' kabnrcp';
  let out = '';
  for (let r = 0; r < 10; r++) {
    let e = 0;
    for (let c = 0; c < 9; c++) {
      const p = s.board[r * 9 + c];
      if (!p) { e++; continue; }
      if (e) { out += e; e = 0; }
      const ch = L[Math.abs(p)];
      out += p > 0 ? ch.toUpperCase() : ch;
    }
    if (e) out += e;
    if (r < 9) out += '/';
  }
  return out + (s.side === RED ? ' w' : ' b');
}

const inBoard = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
const inPalace = (r, c, side) =>
  c >= 3 && c <= 5 && (side === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2);
const ownHalf = (r, side) => (side === RED ? r >= 5 : r <= 4);

// 伪合法着法（不检查自己是否被将军）。move = from*90 + to
export function pseudoMoves(board, side, capturesOnly = false) {
  const out = [];
  const add = (f, t) => {
    const q = board[t];
    if (q * side > 0) return;
    if (capturesOnly && !q) return;
    out.push(f * 90 + t);
  };
  for (let f = 0; f < 90; f++) {
    const p = board[f];
    if (p * side <= 0) continue;
    const t = Math.abs(p), r = (f / 9) | 0, c = f % 9;
    switch (t) {
      case K:
        for (const [dr, dc] of ORTHO) {
          const nr = r + dr, nc = c + dc;
          if (inPalace(nr, nc, side)) add(f, nr * 9 + nc);
        }
        break;
      case A:
        for (const [dr, dc] of DIAG) {
          const nr = r + dr, nc = c + dc;
          if (inPalace(nr, nc, side)) add(f, nr * 9 + nc);
        }
        break;
      case B:
        for (const [dr, dc] of DIAG) {
          const nr = r + 2 * dr, nc = c + 2 * dc;
          if (!inBoard(nr, nc) || !ownHalf(nr, side)) continue;
          if (board[(r + dr) * 9 + c + dc]) continue; // 塞象眼
          add(f, nr * 9 + nc);
        }
        break;
      case N:
        for (const [dr, dc, lr, lc] of HORSE) {
          const nr = r + dr, nc = c + dc;
          if (!inBoard(nr, nc)) continue;
          if (board[(r + lr) * 9 + c + lc]) continue; // 蹩马腿
          add(f, nr * 9 + nc);
        }
        break;
      case R:
        for (const [dr, dc] of ORTHO) {
          let nr = r + dr, nc = c + dc;
          while (inBoard(nr, nc)) {
            const q = board[nr * 9 + nc];
            if (!q) { if (!capturesOnly) out.push(f * 90 + nr * 9 + nc); }
            else { if (q * side < 0) out.push(f * 90 + nr * 9 + nc); break; }
            nr += dr; nc += dc;
          }
        }
        break;
      case C:
        for (const [dr, dc] of ORTHO) {
          let nr = r + dr, nc = c + dc, jumped = false;
          while (inBoard(nr, nc)) {
            const q = board[nr * 9 + nc];
            if (!jumped) {
              if (!q) { if (!capturesOnly) out.push(f * 90 + nr * 9 + nc); }
              else jumped = true;
            } else if (q) {
              if (q * side < 0) out.push(f * 90 + nr * 9 + nc);
              break;
            }
            nr += dr; nc += dc;
          }
        }
        break;
      case P: {
        const fwd = side === RED ? -1 : 1;
        if (inBoard(r + fwd, c)) add(f, (r + fwd) * 9 + c);
        if (!ownHalf(r, side)) {
          if (c > 0) add(f, r * 9 + c - 1);
          if (c < 8) add(f, r * 9 + c + 1);
        }
        break;
      }
    }
  }
  return out;
}

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
// [dr, dc, 马腿 dr, 马腿 dc]
const HORSE = [
  [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0],
  [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1],
];

function findKing(board, side) {
  for (let i = 0; i < 90; i++) if (board[i] === K * side) return i;
  return -1;
}

// side 方的帅/将是否被攻击（含将帅对面）
export function inCheck(board, side) {
  const k = findKing(board, side);
  if (k < 0) return true;
  const r = (k / 9) | 0, c = k % 9, e = -side;
  // 车、炮、对面将
  for (const [dr, dc] of ORTHO) {
    let nr = r + dr, nc = c + dc, screens = 0;
    while (inBoard(nr, nc)) {
      const q = board[nr * 9 + nc];
      if (q) {
        if (screens === 0) {
          if (q === R * e || (q === K * e && dc === 0)) return true;
        } else if (screens === 1) {
          if (q === C * e) return true;
          break;
        }
        screens++;
      }
      nr += dr; nc += dc;
    }
  }
  // 马：马腿在帅的斜角上
  for (const [dr, dc] of HORSE) {
    const hr = r + dr, hc = c + dc;
    if (!inBoard(hr, hc) || board[hr * 9 + hc] !== N * e) continue;
    const lr = r + Math.sign(dr), lc = c + Math.sign(dc);
    if (!board[lr * 9 + lc]) return true;
  }
  // 兵
  const fwd = side === RED ? -1 : 1; // 敌兵从这个方向来
  if (inBoard(r + fwd, c) && board[(r + fwd) * 9 + c] === P * e) return true;
  if (c > 0 && board[k - 1] === P * e) return true;
  if (c < 8 && board[k + 1] === P * e) return true;
  return false;
}

export function legalMoves(s) {
  const res = [];
  for (const m of pseudoMoves(s.board, s.side)) {
    const f = (m / 90) | 0, t = m % 90, cap = s.board[t];
    s.board[t] = s.board[f]; s.board[f] = 0;
    if (!inCheck(s.board, s.side)) res.push(m);
    s.board[f] = s.board[t]; s.board[t] = cap;
  }
  return res;
}

export function applyMove(s, m) {
  const board = Int8Array.from(s.board);
  const f = (m / 90) | 0, t = m % 90;
  board[t] = board[f]; board[f] = 0;
  return { board, side: -s.side, history: [...s.history, toFen(s)] };
}

// 'win' / 'loss'（从当前行棋方视角）或 null。困毙在象棋里同样判负。
export function gameResult(s) {
  if (legalMoves(s).length === 0) return 'loss';
  return null;
}

// ---------------- 评估 ----------------
const VALUE = [0, 0, 120, 120, 400, 900, 450, 100];

// 位置分（红方视角，行 0 在上）。黑方用镜像。
function pst(t, r, c) {
  const cd = 4 - Math.abs(c - 4); // 越靠中路越大
  switch (t) {
    case P:
      if (r >= 5) return r === 6 && (c === 4 || c === 2 || c === 6) ? 5 : 0;
      return 70 + (4 - r) * 8 + cd * 8 - (r === 0 ? 40 : 0);
    case N: return cd * 6 + (r < 5 ? 15 : 0) - (r === 9 ? 15 : 0);
    case R: return cd * 2 + (r < 5 ? 10 : 0) + (r === 9 ? -10 : 0);
    case C: return (c === 4 ? 15 : 0) + (r === 7 ? 5 : 0) + (r < 3 ? 8 : 0);
    default: return 0;
  }
}
// 预先算好：PV[(piece+7)*90 + sq] = 红方视角的子力 + 位置分
const PV = new Int16Array(15 * 90);
for (let t = 1; t <= 7; t++) for (let i = 0; i < 90; i++) {
  const r = (i / 9) | 0, c = i % 9;
  PV[(t + 7) * 90 + i] = VALUE[t] + pst(t, r, c);
  PV[(-t + 7) * 90 + i] = -(VALUE[t] + pst(t, 9 - r, c));
}

export function evaluate(board, side) {
  let s = 0;
  for (let i = 0; i < 90; i++) { const p = board[i]; if (p) s += PV[(p + 7) * 90 + i]; }
  return s * side;
}

// ---------------- 搜索 ----------------
// 负极大值 alpha-beta + 主变例搜索（PVS）+ 空着裁剪 + 后期着法减层（LMR）
// + 静态吃子搜索 + 将军延伸 + 置换表 + 杀手着法。
// 多线程时各线程共用一个置换表（Lazy SMP），由 helper 编号错开搜索顺序。

const Z1 = zobrist(90 * 15, 0x9e3779b9), Z2 = zobrist(90 * 15, 0x85ebca6b);
const Z1S = 0x5bd1e995 | 0, Z2S = 0x27d4eb2f | 0;
function hashOf(board, side) {
  let h1 = side === RED ? 0 : Z1S, h2 = side === RED ? 0 : Z2S;
  for (let i = 0; i < 90; i++) if (board[i]) { h1 ^= Z1[i * 15 + board[i] + 7]; h2 ^= Z2[i * 15 + board[i] + 7]; }
  return [h1, h2];
}
const hasPieces = (board, side) => {
  for (let i = 0; i < 90; i++) { const t = board[i] * side; if (t === R || t === N || t === C) return true; }
  return false;
};

export class Searcher {
  constructor({ tt = null, stop = null, helper = 0 } = {}) {
    this.tt = tt || new TT(20);
    this.stop = stop; // Int32Array(1)，非 0 表示停止
    this.helper = helper;
    this.killers = new Int32Array(256).fill(-1);
    this.path = new Int32Array(1024);
    this.pathLen = 0;
    this.nodes = 0;
  }

  checkTime() {
    if (Date.now() > this.deadline || (this.stop && this.stop[0])) throw STOP;
  }

  order(board, moves, ttMove, ply) {
    const k0 = this.killers[ply * 2], k1 = this.killers[ply * 2 + 1];
    const sc = new Float64Array(moves.length);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i], v = board[m % 90];
      sc[i] = m === ttMove ? 1e7
        : v ? 1e6 + VALUE[Math.abs(v)] * 10 - VALUE[Math.abs(board[(m / 90) | 0])]
        : m === k0 || m === k1 ? 5e5 : 0;
      // helper 线程给安静着法一点随机扰动，搜索路径和主线程不同
      if (this.helper && !v) sc[i] += ((m * 2654435761 + this.helper * 40503) >>> 24);
    }
    const idx = moves.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
    return idx.map((i) => moves[i]);
  }

  quiesce(board, side, alpha, beta, ply) {
    if ((++this.nodes & 2047) === 0) this.checkTime();
    const stand = evaluate(board, side);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 60) return stand;
    for (const m of this.order(board, pseudoMoves(board, side, true), -1, 127)) {
      const f = (m / 90) | 0, t = m % 90, p = board[f], cap = board[t];
      if (Math.abs(cap) === K) return MATE - ply;
      board[t] = p; board[f] = 0;
      if (inCheck(board, side)) { board[f] = p; board[t] = cap; continue; }
      const sc = -this.quiesce(board, -side, -beta, -alpha, ply + 1);
      board[f] = p; board[t] = cap;
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  negamax(board, side, depth, alpha, beta, ply, h1, h2, allowNull) {
    if ((++this.nodes & 2047) === 0) this.checkTime();
    for (let i = this.pathLen - 2; i >= 0; i -= 2) if (this.path[i] === h1) return 0; // 重复局面
    const checked = inCheck(board, side);
    if (checked) depth++;
    if (depth <= 0) return this.quiesce(board, side, alpha, beta, ply);
    if (ply > 120) return evaluate(board, side);

    const tt = this.tt;
    let ttMove = -1;
    if (tt.probe(h1, h2)) {
      ttMove = tt.move;
      if (tt.depth >= depth && ply > 0) {
        const v = tt.score;
        if (tt.flag === 0) return v;
        if (tt.flag === 1 && v >= beta) return v;
        if (tt.flag === 2 && v <= alpha) return v;
      }
    }
    // 空着裁剪：让对方连走两步还不如我，就不用细算了
    if (allowNull && !checked && depth >= 3 && beta < MATE - 500 && hasPieces(board, side)) {
      this.path[this.pathLen++] = h1;
      const sc = -this.negamax(board, -side, depth - 3, -beta, -beta + 1, ply + 1, h1 ^ Z1S, h2 ^ Z2S, false);
      this.pathLen--;
      if (sc >= beta) return beta;
    }

    const a0 = alpha;
    let best = -MATE, bestMove = -1, legal = 0;
    this.path[this.pathLen++] = h1;
    for (const m of this.order(board, pseudoMoves(board, side), ttMove, ply)) {
      const f = (m / 90) | 0, t = m % 90, p = board[f], cap = board[t];
      board[t] = p; board[f] = 0;
      if (inCheck(board, side)) { board[f] = p; board[t] = cap; continue; }
      legal++;
      let n1 = h1 ^ Z1[f * 15 + p + 7] ^ Z1[t * 15 + p + 7] ^ Z1S;
      let n2 = h2 ^ Z2[f * 15 + p + 7] ^ Z2[t * 15 + p + 7] ^ Z2S;
      if (cap) { n1 ^= Z1[t * 15 + cap + 7]; n2 ^= Z2[t * 15 + cap + 7]; }
      let sc;
      if (legal === 1) {
        sc = -this.negamax(board, -side, depth - 1, -beta, -alpha, ply + 1, n1, n2, true);
      } else {
        const r = !cap && !checked && depth >= 3 && legal > 4 ? 1 : 0;
        sc = -this.negamax(board, -side, depth - 1 - r, -alpha - 1, -alpha, ply + 1, n1, n2, true);
        if (sc > alpha && sc < beta) sc = -this.negamax(board, -side, depth - 1, -beta, -alpha, ply + 1, n1, n2, true);
      }
      board[f] = p; board[t] = cap;
      if (sc > best) { best = sc; bestMove = m; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        if (!cap && this.killers[ply * 2] !== m) {
          this.killers[ply * 2 + 1] = this.killers[ply * 2];
          this.killers[ply * 2] = m;
        }
        break;
      }
    }
    this.pathLen--;
    if (!legal) return -MATE + ply; // 被将死或困毙
    tt.store(h1, h2, depth, best <= a0 ? 2 : best >= beta ? 1 : 0, best, bestMove);
    return best;
  }

  // exactRoot：根节点每个着法都用全窗口搜，得到可比较的精确分（弱化选着需要）
  searchRoot(s, { timeMs = 1000, maxDepth = 64, exactRoot = false, onDepth } = {}) {
    this.deadline = Date.now() + timeMs;
    this.nodes = 0;
    const t0 = Date.now();
    const board = Int8Array.from(s.board);
    this.pathLen = 0;
    for (const f of s.history.slice(-200)) { const x = fromFen(f); this.path[this.pathLen++] = hashOf(x.board, x.side)[0]; }
    const base = this.pathLen;
    const [h1, h2] = hashOf(board, s.side);
    let rootMoves = legalMoves(s);
    if (!rootMoves.length) return { move: null, score: -MATE, depth: 0, nodes: 0, ms: 0 };
    if (this.helper) rootMoves = rootMoves.slice(this.helper % rootMoves.length).concat(rootMoves.slice(0, this.helper % rootMoves.length));
    let result = { move: rootMoves[0], score: 0, depth: 0, scored: rootMoves.map((m) => [0, m]) };
    const startDepth = this.helper ? 1 + (this.helper & 1) : 1;
    for (let d = startDepth; d <= maxDepth; d++) {
      let best = -MATE - 1, bestMove = rootMoves[0];
      const scored = [];
      try {
        for (const m of rootMoves) {
          const f = (m / 90) | 0, t = m % 90, p = board[f], cap = board[t];
          board[t] = p; board[f] = 0;
          let n1 = h1 ^ Z1[f * 15 + p + 7] ^ Z1[t * 15 + p + 7] ^ Z1S;
          let n2 = h2 ^ Z2[f * 15 + p + 7] ^ Z2[t * 15 + p + 7] ^ Z2S;
          if (cap) { n1 ^= Z1[t * 15 + cap + 7]; n2 ^= Z2[t * 15 + cap + 7]; }
          this.pathLen = base; this.path[this.pathLen++] = h1;
          let sc;
          if (exactRoot || !scored.length) {
            sc = -this.negamax(board, -s.side, d - 1, -MATE - 1, exactRoot ? MATE + 1 : -best, 1, n1, n2, true);
          } else {
            sc = -this.negamax(board, -s.side, d - 1, -best - 1, -best, 1, n1, n2, true);
            if (sc > best) sc = -this.negamax(board, -s.side, d - 1, -MATE - 1, -best, 1, n1, n2, true);
          }
          board[f] = p; board[t] = cap;
          scored.push([sc, m]);
          if (sc > best) { best = sc; bestMove = m; }
        }
      } catch (e) {
        if (e !== STOP) throw e;
        // 这一层没搜完：如果已经搜完的着法里有比上一层更好的，就用它
        if (scored.length && best > result.score && !exactRoot) result = { ...result, move: bestMove, score: best };
        break;
      }
      rootMoves = scored.slice().sort((a, b) => b[0] - a[0]).map((x) => x[1]);
      result = { move: bestMove, score: best, depth: d, scored };
      onDepth && onDepth({ depth: d, score: best, move: bestMove, nodes: this.nodes, ms: Date.now() - t0 });
      if (Math.abs(best) > MATE - 200) break;
    }
    result.nodes = this.nodes;
    result.ms = Date.now() - t0;
    return result;
  }
}

// opts: timeMs, maxDepth, noise, temperature（弱化用，单位：分，100 = 一个兵）
export function bestMove(s, opts = {}) {
  const weak = opts.noise || opts.temperature;
  const r = new Searcher(opts).searchRoot(s, { ...opts, exactRoot: weak });
  if (weak && r.depth > 0) {
    const m = weakPick(r.scored, { noise: opts.noise, temperature: opts.temperature, clamp: opts.clamp, rand: opts.rand });
    if (m !== r.move) r.weakened = true;
    r.score = r.scored.find((x) => x[1] === m)[0];
    r.move = m;
  }
  delete r.scored;
  return r;
}

export function iccsToMove(s) {
  const sq = (f, r) => (9 - +r) * 9 + 'abcdefghi'.indexOf(f);
  return sq(s[0], s[1]) * 90 + sq(s[2], s[3]);
}

// 着法转文字，例如 "h2e2"（列 a-i，行 0-9 从红方底线算起）
export function moveToIccs(m) {
  const f = (m / 90) | 0, t = m % 90;
  const sq = (i) => 'abcdefghi'[i % 9] + (9 - ((i / 9) | 0));
  return sq(f) + sq(t);
}
