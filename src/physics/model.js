// ====================================================
// 理想気体（単原子分子）モデル
//  - 状態は相対値 (V, P) で持つ。T = PV（基準状態で V = P = T = 1）
//  - 基準状態: P0 = 1.0×10^5 Pa, V0 = 1.0 L, T0 = 300 K
//  - エネルギーの単位: P0V0 = nRT0 = 100 J を 1 とする
//  - 符号: ΔU = Q + W
//      Q : 気体が吸収した熱量
//      W : 気体が外からされた仕事（W′ = −W は気体がした仕事）
// ====================================================

export const GAMMA = 5 / 3;
export const P0_PA = 1.0e5;
export const V0_L = 1.0;
export const T0_K = 300;
export const R_GAS = 8.31;
/** 相対値 1 あたりのエネルギー [J]（= P0V0 = nRT0） */
export const J_PER_UNIT = (P0_PA * V0_L * 1e-3);
/** 物質量 [mol] */
export const N_MOL = J_PER_UNIT / (R_GAS * T0_K);

export const V_MIN = 0.4;
export const V_MAX = 2.0;
export const P_MIN = 0.1;
export const P_MAX = 5.0;
/** 1回の操作での変化（PV図の方眼 0.1 刻みに乗るようにしている） */
export const STEP_V = 0.1;
export const STEP_P = 0.1;

const EPS = 1e-9;
const r9 = (x) => Math.round(x * 1e9) / 1e9;

export const temperature = (s) => s.P * s.V;
export const internalEnergy = (s) => 1.5 * s.P * s.V; // U = (3/2)nRT（相対値）

// ----------------------------------------------------
// 装置の設定
// ----------------------------------------------------
export const PISTON_MODES = [
  { id: 'fixed', label: 'ピストンを固定', short: '固定', icon: '🔒',
    desc: 'ストッパーで止めて、体積が変わらないようにする' },
  { id: 'hand', label: 'ピストンを手で動かす', short: '手で動かす', icon: '✋',
    desc: '手でゆっくり押し込んだり引き出したりする' },
  { id: 'free', label: 'ピストンを自由にする', short: '自由に動く', icon: '⚖️',
    desc: 'おもりをのせて自由に動けるようにする。外圧とつり合う位置で止まる' },
];

export const ENV_MODES = [
  { id: 'insulated', label: '断熱材で包む', short: '断熱材', icon: '🧱',
    desc: '熱は中のヒーター（冷却器）からしか出入りしない' },
  { id: 'bath', label: '恒温槽に入れる', short: '恒温槽', icon: '🛁',
    desc: '槽との間で熱が自由に出入りし、温度が一定に保たれる' },
];

export const OPERATIONS = {
  heat: { id: 'heat', label: '加熱する', icon: '🔥' },
  cool: { id: 'cool', label: '冷却する', icon: '❄️' },
  push: { id: 'push', label: 'ピストンを押し込む', icon: '⬇️' },
  pull: { id: 'pull', label: 'ピストンを引き出す', icon: '⬆️' },
};

// ----------------------------------------------------
// 過程の定義
// ----------------------------------------------------
export const FAMILIES = {
  isochoric: { name: '定積変化', color: '#f87171' },
  isobaric: { name: '定圧変化', color: '#34d399' },
  isothermal: { name: '等温変化', color: '#60a5fa' },
  adiabatic: { name: '断熱変化', color: '#c084fc' },
  line: { name: 'PV図上の直線', color: '#fbbf24' },
};

export const PROCESS = {
  ISOCHORIC_HEAT: 'isochoric_heat',
  ISOCHORIC_COOL: 'isochoric_cool',
  ISOBARIC_HEAT: 'isobaric_heat',
  ISOBARIC_COOL: 'isobaric_cool',
  ISOTHERMAL_EXPAND: 'isothermal_expand',
  ISOTHERMAL_COMPRESS: 'isothermal_compress',
  ADIABATIC_EXPAND: 'adiabatic_expand',
  ADIABATIC_COMPRESS: 'adiabatic_compress',
  LINE_UR: 'line_ur',
  LINE_DR: 'line_dr',
  LINE_UL: 'line_ul',
  LINE_DL: 'line_dl',
};

const P = PROCESS;

/**
 * 各過程: family / 表示名 / 必要な装置設定と操作 / 解説
 */
export const PROCESS_INFO = {
  [P.ISOCHORIC_HEAT]: {
    family: 'isochoric', name: '定積変化（加熱）', setup: { piston: 'fixed', env: 'insulated' }, op: 'heat',
    note: '体積が変わらないので仕事は 0（W = 0）。吸収した熱がそのまま内部エネルギーの増加になる（ΔU = Q）。',
  },
  [P.ISOCHORIC_COOL]: {
    family: 'isochoric', name: '定積変化（冷却）', setup: { piston: 'fixed', env: 'insulated' }, op: 'cool',
    note: '体積が変わらないので仕事は 0（W = 0）。放出した熱の分だけ内部エネルギーが減る（ΔU = Q < 0）。',
  },
  [P.ISOBARIC_HEAT]: {
    family: 'isobaric', name: '定圧変化（加熱して膨張）', setup: { piston: 'free', env: 'insulated' }, op: 'heat',
    note: '吸収した熱の一部は内部エネルギーの増加に、残りは外への仕事に使われる（Q = ΔU + W′）。同じ温度上昇でも定積変化より多くの熱が必要。',
  },
  [P.ISOBARIC_COOL]: {
    family: 'isobaric', name: '定圧変化（冷却して収縮）', setup: { piston: 'free', env: 'insulated' }, op: 'cool',
    note: '外から仕事をされるが、それより多くの熱を放出するので内部エネルギーは減る。',
  },
  [P.ISOTHERMAL_EXPAND]: {
    family: 'isothermal', name: '等温変化（膨張）', setup: { piston: 'hand', env: 'bath' }, op: 'pull',
    note: '温度が一定なので ΔU = 0。恒温槽から吸収した熱がすべて外への仕事になる（Q = W′）。',
  },
  [P.ISOTHERMAL_COMPRESS]: {
    family: 'isothermal', name: '等温変化（圧縮）', setup: { piston: 'hand', env: 'bath' }, op: 'push',
    note: '温度が一定なので ΔU = 0。外からされた仕事と同じだけの熱を恒温槽へ放出する（Q = −W）。',
  },
  [P.ADIABATIC_EXPAND]: {
    family: 'adiabatic', name: '断熱変化（膨張）', setup: { piston: 'hand', env: 'insulated' }, op: 'pull',
    note: '熱の出入りがない（Q = 0）。外へ仕事をした分だけ内部エネルギーが減り、温度が下がる。',
  },
  [P.ADIABATIC_COMPRESS]: {
    family: 'adiabatic', name: '断熱変化（圧縮）', setup: { piston: 'hand', env: 'insulated' }, op: 'push',
    note: '熱の出入りがない（Q = 0）。外からされた仕事の分だけ内部エネルギーが増え、温度が上がる。加熱していないのに温度が上がる点に注目。',
  },
  [P.LINE_UR]: { family: 'line', name: 'PV図上の直線（右上へ）', arrow: '↗', op: 'line',
    note: 'PV図上の直線に沿った変化。熱と仕事が同時に出入りする。途中の温度変化にも注目しよう。' },
  [P.LINE_DR]: { family: 'line', name: 'PV図上の直線（右下へ）', arrow: '↘', op: 'line',
    note: 'PV図上の直線に沿った変化。膨張しながら圧力が下がる。温度は上がることも下がることもある。' },
  [P.LINE_UL]: { family: 'line', name: 'PV図上の直線（左上へ）', arrow: '↖', op: 'line',
    note: 'PV図上の直線に沿った変化。圧縮しながら圧力が上がる。' },
  [P.LINE_DL]: { family: 'line', name: 'PV図上の直線（左下へ）', arrow: '↙', op: 'line',
    note: 'PV図上の直線に沿った変化。圧縮しながら圧力が下がる。熱と仕事の両方が出入りする。' },
};

export const LINE_PROCESSES = [P.LINE_UL, P.LINE_UR, P.LINE_DL, P.LINE_DR];

export function familyOf(processId) {
  return PROCESS_INFO[processId]?.family ?? 'line';
}

/** 装置の設定を文章で返す（解答表示用） */
export function describeSetup(setup) {
  const p = PISTON_MODES.find((m) => m.id === setup.piston);
  const e = ENV_MODES.find((m) => m.id === setup.env);
  return `${p?.short ?? ''}・${e?.short ?? ''}`;
}

// ----------------------------------------------------
// 装置の設定 + 操作 → 過程
// ----------------------------------------------------
/**
 * @returns {{processId: string} | {reason: string}}
 */
export function resolveOperation(setup, op) {
  const { piston, env } = setup;
  if (op === 'heat' || op === 'cool') {
    if (env === 'bath') {
      return { reason: '恒温槽の中では気体の温度が槽と同じに保たれるので、ヒーター（冷却器）は使えません。' };
    }
    if (piston === 'hand') {
      return { reason: '手でピストンを持ったまま加熱すると、変化の仕方が決まりません。ピストンを「固定」か「自由」にしましょう。' };
    }
    if (piston === 'fixed') return { processId: op === 'heat' ? P.ISOCHORIC_HEAT : P.ISOCHORIC_COOL };
    return { processId: op === 'heat' ? P.ISOBARIC_HEAT : P.ISOBARIC_COOL };
  }
  if (op === 'push' || op === 'pull') {
    if (piston === 'fixed') return { reason: 'ピストンが固定されているので、押し込んだり引き出したりできません。' };
    if (piston === 'free') {
      return { reason: '自由なピストンは外圧とつり合う位置まで自分で動きます。手ではなく、加熱・冷却で動かしましょう。' };
    }
    if (env === 'bath') return { processId: op === 'push' ? P.ISOTHERMAL_COMPRESS : P.ISOTHERMAL_EXPAND };
    return { processId: op === 'push' ? P.ADIABATIC_COMPRESS : P.ADIABATIC_EXPAND };
  }
  return { reason: '不明な操作です。' };
}

// ----------------------------------------------------
// 過程の計算
// ----------------------------------------------------
function boundsError(V2, P2) {
  if (V2 > V_MAX + EPS) return `体積の上限（${V_MAX.toFixed(1)} L）です。`;
  if (V2 < V_MIN - EPS) return `体積の下限（${V_MIN.toFixed(1)} L）です。`;
  if (P2 > P_MAX + EPS) return `圧力の上限（${P_MAX.toFixed(1)}×10⁵ Pa）です。`;
  if (P2 < P_MIN - EPS) return 'これ以上は温度（圧力）を下げられません。';
  return null;
}

/**
 * 1回の操作による変化を計算する
 * @param {{V:number,P:number}} s
 * @returns {{to:{V:number,P:number}, Q:number, W:number, dU:number} | {error:string}}
 */
export function computeProcess(s, processId) {
  const { V, P: Pr } = s;
  const T = Pr * V;
  let V2 = V;
  let P2 = Pr;
  let W = 0;
  let dU;
  let Q;

  switch (processId) {
    case P.ISOCHORIC_HEAT:
    case P.ISOCHORIC_COOL:
      P2 = r9(Pr + (processId === P.ISOCHORIC_HEAT ? STEP_P : -STEP_P));
      break;
    case P.ISOBARIC_HEAT:
    case P.ISOBARIC_COOL:
      V2 = r9(V + (processId === P.ISOBARIC_HEAT ? STEP_V : -STEP_V));
      break;
    case P.ISOTHERMAL_EXPAND:
    case P.ISOTHERMAL_COMPRESS:
      V2 = r9(V + (processId === P.ISOTHERMAL_EXPAND ? STEP_V : -STEP_V));
      P2 = T / V2;
      break;
    case P.ADIABATIC_EXPAND:
    case P.ADIABATIC_COMPRESS:
      V2 = r9(V + (processId === P.ADIABATIC_EXPAND ? STEP_V : -STEP_V));
      P2 = Pr * Math.pow(V / V2, GAMMA);
      break;
    case P.LINE_UR: V2 = r9(V + STEP_V); P2 = r9(Pr + STEP_P); break;
    case P.LINE_DR: V2 = r9(V + STEP_V); P2 = r9(Pr - STEP_P); break;
    case P.LINE_UL: V2 = r9(V - STEP_V); P2 = r9(Pr + STEP_P); break;
    case P.LINE_DL: V2 = r9(V - STEP_V); P2 = r9(Pr - STEP_P); break;
    default:
      return { error: '不明な過程です。' };
  }

  const err = boundsError(V2, P2);
  if (err) return { error: err };

  const T2 = P2 * V2;
  const family = familyOf(processId);
  switch (family) {
    case 'isochoric':
      W = 0;
      dU = 1.5 * (T2 - T);
      Q = dU;
      break;
    case 'isobaric':
      W = -Pr * (V2 - V);
      dU = 1.5 * (T2 - T);
      Q = dU - W;
      break;
    case 'isothermal':
      dU = 0;
      W = T * Math.log(V / V2); // W = −∫P dV = −nRT ln(V2/V)
      Q = -W;
      break;
    case 'adiabatic':
      Q = 0;
      dU = 1.5 * (T2 - T);
      W = dU;
      break;
    default: // 直線（台形の面積）
      W = -((Pr + P2) / 2) * (V2 - V);
      dU = 1.5 * (T2 - T);
      Q = dU - W;
  }
  return { to: { V: V2, P: P2 }, Q, W, dU };
}

// ----------------------------------------------------
// PV図描画用：1区間を点列にする
// ----------------------------------------------------
export function sampleSegment(from, to, family, n = 24) {
  if (family === 'isothermal') {
    const T = from.P * from.V;
    return Array.from({ length: n + 1 }, (_, i) => {
      const V = from.V + (to.V - from.V) * (i / n);
      return { V, P: T / V };
    });
  }
  if (family === 'adiabatic') {
    const K = from.P * Math.pow(from.V, GAMMA);
    return Array.from({ length: n + 1 }, (_, i) => {
      const V = from.V + (to.V - from.V) * (i / n);
      return { V, P: K / Math.pow(V, GAMMA) };
    });
  }
  return [from, to];
}

/** 同じ過程が続く操作を1つの区間にまとめる */
export function mergeSteps(steps) {
  const segs = [];
  for (const st of steps) {
    const last = segs[segs.length - 1];
    if (last && last.processId === st.processId) {
      last.to = st.to;
      last.count += 1;
      last.Q += st.Q;
      last.W += st.W;
      last.dU += st.dU;
    } else {
      segs.push({ processId: st.processId, from: st.from, to: st.to, count: 1, Q: st.Q, W: st.W, dU: st.dU });
    }
  }
  return segs;
}

export function sameState(a, b, tol = 1e-6) {
  return Math.abs(a.V - b.V) < tol && Math.abs(a.P - b.P) < tol;
}

// ----------------------------------------------------
// マクスウェル分布（3次元）
//  速さは「T0 での最頻値を 1」とした相対値 u で表す
//  f(u) = 4/√π · a^{3/2} u² exp(−a u²),  a = 1/T（T は相対温度）
// ----------------------------------------------------
export function maxwell3D(u, T) {
  const a = 1 / T;
  return (4 / Math.sqrt(Math.PI)) * Math.pow(a, 1.5) * u * u * Math.exp(-a * u * u);
}

// 2次元（粒子モデル用）: f(u) = (u/s²) exp(−u²/2s²)、s² = T（相対）
export function maxwell2D(u, T) {
  return (u / T) * Math.exp((-u * u) / (2 * T));
}
