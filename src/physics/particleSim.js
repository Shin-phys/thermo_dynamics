// ====================================================
// 粒子モデル（2次元の気体分子シミュレーション）
//  - 分子どうしの弾性衝突あり → 速さの分布がマクスウェル分布に近づく
//  - ピストンは実際に動き、動く壁との衝突で分子のエネルギーが変わる（＝仕事）
//  - ヒーター・恒温槽は「その温度の壁」として、衝突した分子を壁の温度で送り返す（＝熱）
//  - Q（壁から受けた熱）と W（ピストンからされた仕事）を分子1個ずつ集計する
//
// 単位: 長さ px、時間 フレーム(1/60 s)、分子の質量 1
// 2次元なので 1分子の平均運動エネルギー = kT（3次元の 3/2 kT ではない）
// ====================================================

export const SIM_W = 300;          // 容器の幅
export const H_PER_V = 250;        // 体積 1（相対）あたりの高さ
export const KE0 = 2.0;            // 基準温度 T0 での平均運動エネルギー（= kT0）
export const N_REF = 200;          // 圧力・エネルギーの基準にする分子数
export const RADIUS = 2.2;         // 分子の半径
export const V_MIN = 0.4;
export const V_MAX = 2.0;
export const STEP_V = 0.1;
/** 運動エネルギー 1 あたりの J（N_REF 個・T0 で U = 100 J になるよう換算） */
export const J_PER_KE = 100 / (N_REF * KE0);

const SUBSTEPS = 2;
const DT = 1 / SUBSTEPS;
const HAND_SPEED = 0.25;           // 手で動かすピストンの速さ [px/frame]（分子の速さよりゆっくり）
const FREE_GAIN = 1.5;             // 自由ピストン: 圧力差に比例した速さでつり合いへ向かう
const FREE_MAX_SPEED = 0.3;
const HEATER_FRAMES = 40;          // 加熱・冷却 1回の長さ
const HIST_BINS = 28;
export const HIST_UMAX = 3.5;      // ヒストグラムの横軸（T0 の最頻値 = 1）

function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class ParticleSim {
  constructor(N = N_REF) {
    this.reset(N);
  }

  reset(N = this.N) {
    this.N = N;
    this.H = 1.0 * H_PER_V;
    this.u = 0;
    this.piston = this.piston ?? 'fixed';
    this.env = this.env ?? 'insulated';
    this.Tbath = 1;
    this.heater = null;
    this.handTarget = null;
    this.frame = 0;
    this.impulseFrame = 0;

    // 格子状に並べ、全分子を同じ速さ（向きはばらばら）で出発させる
    const cols = Math.ceil(Math.sqrt((N * SIM_W) / this.H));
    const rows = Math.ceil(N / cols);
    const dx = SIM_W / cols;
    const dy = this.H / rows;
    const v0 = Math.sqrt(2 * KE0);
    this.particles = [];
    for (let i = 0; i < N; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const ang = Math.random() * Math.PI * 2;
      this.particles.push({
        x: (c + 0.5) * dx + (Math.random() - 0.5) * Math.max(0, dx - 2 * RADIUS) * 0.5,
        y: (r + 0.5) * dy + (Math.random() - 0.5) * Math.max(0, dy - 2 * RADIUS) * 0.5,
        vx: v0 * Math.cos(ang),
        vy: v0 * Math.sin(ang),
      });
    }
    this.Pmeas = (N * KE0) / (SIM_W * this.H);
    // 自由ピストンのときは、制御に使う圧力（kineticForce）とつり合う外圧にしておく
    this.Pext = this.kineticForce();
    this.resetRecord();
  }

  /** 熱・仕事の記録とPV軌跡をリセット */
  resetRecord() {
    this.U0 = this.energy();
    this.Q = 0;
    this.W = 0;
    this.trace = [];
  }

  energy() {
    let e = 0;
    for (const p of this.particles) e += 0.5 * (p.vx * p.vx + p.vy * p.vy);
    return e;
  }

  get V() { return this.H / H_PER_V; }
  /** 相対温度（T0 = 1） */
  get T() { return this.energy() / this.N / KE0; }
  /** 2次元理想気体の圧力（単位長さあたりの力）: P = N kT / A */
  idealForce() { return (this.N * (this.energy() / this.N)) / (SIM_W * this.H); }
  /**
   * 分子運動から見積もった圧力（分子の大きさの分だけ面積を差し引く）。
   * 衝突の力積から測る圧力の平均値にほぼ等しく、ゆらぎがないので自由ピストンの制御に使う。
   */
  kineticForce() {
    return this.energy() / (SIM_W * this.H - this.N * 2 * Math.PI * RADIUS * RADIUS);
  }
  /** 力 → 相対圧力（N_REF 個・T0・V0 で 1） */
  static toPrel(f) { return f / ((N_REF * KE0) / (SIM_W * H_PER_V)); }

  // ---------------- 装置の設定 ----------------
  setPiston(mode) {
    this.piston = mode;
    this.handTarget = null;
    this.u = 0;
    if (mode === 'free') this.Pext = this.kineticForce(); // いまの圧力とつり合う外圧（おもり）
  }

  setEnv(env) {
    this.env = env;
    this.heater = null;
    if (env === 'bath') this.Tbath = this.T; // いまの温度の恒温槽に入れる
  }

  // ---------------- 操作 ----------------
  heat() { this.pulse('heat', this.T * 2.0); }
  cool() { this.pulse('cool', this.T * 0.3); }
  pulse(kind, Tw) {
    if (this.heater && this.heater.kind === kind) this.heater.frames += HEATER_FRAMES;
    else this.heater = { kind, T: Tw, frames: HEATER_FRAMES };
  }

  pistonTarget() { return this.handTarget ?? this.H; }
  canPush() { return this.pistonTarget() - STEP_V * H_PER_V >= V_MIN * H_PER_V - 1e-6; }
  canPull() { return this.pistonTarget() + STEP_V * H_PER_V <= V_MAX * H_PER_V + 1e-6; }
  push() { if (this.canPush()) this.handTarget = this.pistonTarget() - STEP_V * H_PER_V; }
  pull() { if (this.canPull()) this.handTarget = this.pistonTarget() + STEP_V * H_PER_V; }

  // ---------------- 時間発展 ----------------
  step() {
    for (let s = 0; s < SUBSTEPS; s++) this.substep();
    this.frame += 1;
    const inst = this.impulseFrame / SIM_W; // 1フレームあたりの力積 / 長さ = 圧力
    this.impulseFrame = 0;
    this.Pmeas += (inst - this.Pmeas) / 90; // 表示用（ゆらぎを少しならす）
    if (this.heater) {
      this.heater.frames -= 1;
      if (this.heater.frames <= 0) this.heater = null;
    }
    if (this.frame % 12 === 0) {
      this.trace.push({ V: this.V, P: ParticleSim.toPrel(this.Pmeas) });
      if (this.trace.length > 900) this.trace.shift();
    }
  }

  emit(p, axis, sign, Trel) {
    // 熱壁: 壁の温度のマクスウェル分布（流束で重み付け）で送り返す
    const before = 0.5 * (p.vx * p.vx + p.vy * p.vy);
    const sigma = Math.sqrt(Trel * KE0);
    const vn = sigma * Math.sqrt(-2 * Math.log(1 - Math.random()));
    const vt = sigma * gauss();
    if (axis === 'x') { p.vx = sign * vn; p.vy = vt; } else { p.vy = sign * vn; p.vx = vt; }
    this.Q += 0.5 * (p.vx * p.vx + p.vy * p.vy) - before;
  }

  substep() {
    const dt = DT;
    // --- ピストン ---
    if (this.piston === 'hand' && this.handTarget !== null) {
      const d = this.handTarget - this.H;
      if (Math.abs(d) <= HAND_SPEED * dt) {
        this.H = this.handTarget;
        this.handTarget = null;
        this.u = 0;
      } else {
        this.u = Math.sign(d) * HAND_SPEED;
      }
    } else if (this.piston === 'free') {
      // 内外の圧力差に比例した速さで、つり合いの位置へゆっくり動く
      const v = (FREE_GAIN * (this.kineticForce() - this.Pext)) / this.Pext;
      this.u = Math.max(-FREE_MAX_SPEED, Math.min(FREE_MAX_SPEED, v));
    } else {
      this.u = 0;
    }
    this.H += this.u * dt;
    const hMin = 0.3 * H_PER_V;
    const hMax = 2.2 * H_PER_V;
    if (this.H < hMin) { this.H = hMin; this.u = Math.max(0, this.u); }
    if (this.H > hMax) { this.H = hMax; this.u = Math.min(0, this.u); }

    // --- 分子の移動と壁 ---
    const R = RADIUS;
    const xr = SIM_W - R;
    const top = this.H - R;
    const bath = this.env === 'bath';
    const bottomT = bath ? this.Tbath : (this.heater ? this.heater.T : null);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // 壁に向かって動いているときだけ反射・熱交換する
      if (p.x < R) {
        p.x = 2 * R - p.x;
        if (p.vx < 0) { if (bath) this.emit(p, 'x', 1, this.Tbath); else p.vx = -p.vx; }
      } else if (p.x > xr) {
        p.x = 2 * xr - p.x;
        if (p.vx > 0) { if (bath) this.emit(p, 'x', -1, this.Tbath); else p.vx = -p.vx; }
      }
      if (p.y < R) {
        p.y = 2 * R - p.y;
        if (p.vy < 0) { if (bottomT !== null) this.emit(p, 'y', 1, bottomT); else p.vy = -p.vy; }
      }
      if (p.y > top) {
        p.y = Math.max(R, 2 * top - p.y);
        if (p.vy > this.u) {
          const v2 = 2 * this.u - p.vy; // 動く壁での弾性反射（ピストンは十分重い）
          this.W += 0.5 * (v2 * v2 - p.vy * p.vy);
          this.impulseFrame += p.vy - v2;
          p.vy = v2;
        }
      }
    }
    this.collide();
  }

  collide() {
    const R = RADIUS;
    const D = 2 * R;
    const cell = D * 1.5;
    const cols = Math.ceil(SIM_W / cell) + 1;
    const rows = Math.ceil(this.H / cell) + 2;
    const n = cols * rows;
    if (!this.head || this.head.length < n) this.head = new Int32Array(n * 2);
    if (!this.next || this.next.length < this.N) this.next = new Int32Array(this.N);
    const head = this.head;
    const next = this.next;
    head.fill(-1, 0, n);
    const ps = this.particles;
    for (let i = 0; i < ps.length; i++) {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(ps[i].x / cell)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(ps[i].y / cell)));
      const k = cy * cols + cx;
      next[i] = head[k];
      head[k] = i;
    }
    const D2 = D * D;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(a.x / cell)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(a.y / cell)));
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= cols) continue;
          for (let j = head[yy * cols + xx]; j !== -1; j = next[j]) {
            if (j <= i) continue;
            const b = ps[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= D2 || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rel < 0) {
              a.vx -= rel * nx; a.vy -= rel * ny;
              b.vx += rel * nx; b.vy += rel * ny;
            }
            const push = (D - d) / 2;
            a.x += nx * push; a.y += ny * push;
            b.x -= nx * push; b.y -= ny * push;
          }
        }
      }
    }
  }

  histogram() {
    const du = HIST_UMAX / HIST_BINS;
    const bins = new Array(HIST_BINS).fill(0);
    const s = Math.sqrt(KE0);
    for (const p of this.particles) {
      const u = Math.sqrt(p.vx * p.vx + p.vy * p.vy) / s;
      const k = Math.floor(u / du);
      if (k >= 0 && k < HIST_BINS) bins[k] += 1;
    }
    return bins.map((c, i) => ({ u0: i * du, u1: (i + 1) * du, density: c / (this.N * du) }));
  }

  stats() {
    const E = this.energy();
    const T = E / this.N / KE0;
    const V = this.V;
    return {
      N: this.N,
      V,
      T,
      P: ParticleSim.toPrel(this.Pmeas),
      Ptheory: (this.N / N_REF) * (T / V),
      U: E * J_PER_KE,
      Q: this.Q * J_PER_KE,
      W: this.W * J_PER_KE,
      dU: (E - this.U0) * J_PER_KE,
      heater: this.heater ? this.heater.kind : null,
      Tbath: this.Tbath,
      piston: this.piston,
      env: this.env,
      moving: this.handTarget !== null,
      canPush: this.canPush(),
      canPull: this.canPull(),
      hist: this.histogram(),
      trace: this.trace.slice(),
    };
  }
}
