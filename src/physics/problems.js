// ====================================================
// 練習問題
//  正解の操作列から目標経路を自動生成する。
//  「サイクル」と名のつく問題は、元の状態に必ず戻る（scripts/verify-problems.mjs で検証）。
// ====================================================

import { PROCESS, computeProcess, mergeSteps, sameState } from './model.js';

const X = PROCESS;
const rep = (id, n) => Array(n).fill(id);

export const PROBLEMS = [
  {
    id: 1,
    name: '定積 → 等温 → 定圧のサイクル',
    start: { V: 1.0, P: 1.0 },
    closed: true,
    tokens: [...rep(X.ISOCHORIC_HEAT, 3), ...rep(X.ISOTHERMAL_EXPAND, 3), ...rep(X.ISOBARIC_COOL, 3)],
  },
  {
    id: 2,
    name: '矩形サイクル（時計回り）',
    start: { V: 1.0, P: 1.0 },
    closed: true,
    tokens: [...rep(X.ISOCHORIC_HEAT, 5), ...rep(X.ISOBARIC_HEAT, 5), ...rep(X.ISOCHORIC_COOL, 5), ...rep(X.ISOBARIC_COOL, 5)],
  },
  {
    id: 3,
    name: '矩形サイクル（反時計回り）',
    start: { V: 1.0, P: 1.0 },
    closed: true,
    tokens: [...rep(X.ISOBARIC_HEAT, 5), ...rep(X.ISOCHORIC_HEAT, 5), ...rep(X.ISOBARIC_COOL, 5), ...rep(X.ISOCHORIC_COOL, 5)],
  },
  {
    id: 4,
    name: '直角三角形サイクル',
    start: { V: 1.0, P: 1.0 },
    closed: true,
    tokens: [...rep(X.ISOCHORIC_HEAT, 4), ...rep(X.LINE_DR, 4), ...rep(X.ISOBARIC_COOL, 4)],
  },
  {
    id: 5,
    name: '直角三角形サイクル（逆向き）',
    start: { V: 1.0, P: 1.0 },
    closed: true,
    tokens: [...rep(X.ISOBARIC_HEAT, 4), ...rep(X.ISOCHORIC_HEAT, 4), ...rep(X.LINE_DL, 4)],
  },
  {
    id: 6,
    name: 'カルノーサイクル',
    start: { V: 0.5, P: 2.0 },
    closed: true,
    tokens: [
      ...rep(X.ISOTHERMAL_EXPAND, 5), ...rep(X.ADIABATIC_EXPAND, 6),
      ...rep(X.ISOTHERMAL_COMPRESS, 8), ...rep(X.ADIABATIC_COMPRESS, 3),
    ],
  },
  {
    id: 7,
    name: '加熱 → 断熱膨張 → 定圧収縮（開いた経路）',
    start: { V: 1.0, P: 1.0 },
    closed: false,
    tokens: [...rep(X.ISOCHORIC_HEAT, 5), ...rep(X.ADIABATIC_EXPAND, 5), ...rep(X.ISOBARIC_COOL, 3)],
  },
  {
    id: 8,
    name: '断熱圧縮 → 定積冷却 → 等温膨張（開いた経路）',
    start: { V: 1.6, P: 0.625 },
    closed: false,
    tokens: [...rep(X.ADIABATIC_COMPRESS, 6), ...rep(X.ISOCHORIC_COOL, 4), ...rep(X.ISOTHERMAL_EXPAND, 6)],
  },
];

/** 操作列を実行して、各操作の結果を返す */
export function runTokens(start, tokens) {
  let s = start;
  const steps = [];
  for (const id of tokens) {
    const r = computeProcess(s, id);
    if (r.error) throw new Error(`問題データの誤り: ${id} at ${JSON.stringify(s)} (${r.error})`);
    steps.push({ processId: id, from: s, to: r.to, Q: r.Q, W: r.W, dU: r.dU });
    s = r.to;
  }
  return steps;
}

export function getProblems() {
  return PROBLEMS.map((p) => {
    const steps = runTokens(p.start, p.tokens);
    const segments = mergeSteps(steps);
    const end = steps.length ? steps[steps.length - 1].to : p.start;
    return { ...p, steps, segments, end, isClosedActual: sameState(end, p.start) };
  });
}

/**
 * 工程（同じ過程が続く区間）ごとに採点する
 */
export function gradeAttempt(userSteps, problem) {
  const user = mergeSteps(userSteps);
  const ans = problem.segments;
  const rows = ans.map((a, i) => {
    const u = user[i];
    if (!u) return { index: i, status: 'missing', answer: a };
    if (u.processId !== a.processId) return { index: i, status: 'wrong', answer: a, user: u };
    if (u.count !== a.count) {
      return { index: i, status: u.count < a.count ? 'short' : 'over', answer: a, user: u };
    }
    return { index: i, status: 'ok', answer: a, user: u };
  });
  const extra = Math.max(0, user.length - ans.length);
  const correct = rows.every((r) => r.status === 'ok') && extra === 0;
  return { correct, rows, extra };
}
