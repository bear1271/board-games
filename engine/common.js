// 引擎公用部分：置换表、停止信号、弱化选着。

export const STOP = { stop: true };

// 置换表：每项 4 个 int32 [校验, 着法, 分数, 深度|标志<<8]。
// 可以建在 SharedArrayBuffer 上，让多个线程共用（Lazy SMP）。
// 校验字段 = h2 ^ 着法 ^ 分数 ^ meta，读到被别的线程写了一半的项时校验不过，当作没有。
export class TT {
  constructor(bits = 20, buffer = null) {
    this.mask = (1 << bits) - 1;
    this.a = new Int32Array(buffer || new ArrayBuffer(16 << bits));
    this.move = -1; this.score = 0; this.depth = 0; this.flag = 0;
  }
  static bytes(bits) { return 16 << bits; }
  probe(h1, h2) {
    const i = (h1 & this.mask) << 2, a = this.a;
    const lock = a[i], move = a[i + 1], score = a[i + 2], meta = a[i + 3];
    if ((lock ^ move ^ score ^ meta) !== (h2 | 0) || meta === 0) return false;
    this.move = move; this.score = score; this.depth = meta & 255; this.flag = meta >> 8;
    return true;
  }
  store(h1, h2, depth, flag, score, move) {
    const i = (h1 & this.mask) << 2, a = this.a;
    const meta = (Math.max(1, depth) & 255) | (flag << 8);
    score |= 0;
    a[i + 1] = move; a[i + 2] = score; a[i + 3] = meta;
    a[i] = (h2 ^ move ^ score ^ meta) | 0;
  }
  clear() { this.a.fill(0); }
}

// 两套 Zobrist 随机数（h1 定位，h2 校验）
export function zobrist(n, seed) {
  let x = seed >>> 0 || 1;
  const t = new Int32Array(n);
  for (let i = 0; i < n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; t[i] = x | 0; }
  return t;
}

function gauss(rand) {
  let u = 0;
  while (!u) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// 弱化：给每个根着法的分数加高斯噪声，再按温度做 softmax 抽样。
// scored: [[分数, 着法], ...]，分数需是“精确值”（根节点全窗口搜索得到）。
// clamp 把杀棋分压到有限范围，让低档也大概率不放过一步杀，但不是绝对。
export function weakPick(scored, { noise = 0, temperature = 0, clamp = 3000, rand = Math.random } = {}) {
  if (!scored.length) return null;
  const vals = scored.map(([s, m]) => [Math.max(-clamp, Math.min(clamp, s)) + (noise ? noise * gauss(rand) : 0), m]);
  const max = Math.max(...vals.map((v) => v[0]));
  if (!temperature) return vals.find((v) => v[0] === max)[1];
  const w = vals.map(([s, m]) => [Math.exp((s - max) / temperature), m]);
  let r = rand() * w.reduce((a, b) => a + b[0], 0);
  for (const [x, m] of w) if ((r -= x) <= 0) return m;
  return w[0][1];
}
