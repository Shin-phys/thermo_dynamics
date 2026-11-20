// 練習問題の検証: node scripts/verify-problems.mjs
//  - 全操作が範囲内で実行できること
//  - closed: true の問題が元の状態に戻ること
//  - 各操作で ΔU = Q + W が成り立ち、サイクル全体で ΔU = 0 になること
import { getProblems } from '../src/physics/problems.js';
import { J_PER_UNIT } from '../src/physics/model.js';

let ok = true;
for (const p of getProblems()) {
  const sumQ = p.steps.reduce((a, s) => a + s.Q, 0);
  const sumW = p.steps.reduce((a, s) => a + s.W, 0);
  const sumDU = p.steps.reduce((a, s) => a + s.dU, 0);
  const firstLawOk = p.steps.every((s) => Math.abs(s.dU - (s.Q + s.W)) < 1e-9);
  const closedOk = !p.closed || p.isClosedActual;
  const line = `#${p.id} ${p.name}\n   終点 V=${p.end.V.toFixed(4)} P=${p.end.P.toFixed(4)}`
    + `  閉じる=${p.isClosedActual}  ΣQ=${(sumQ * J_PER_UNIT).toFixed(2)}J ΣW=${(sumW * J_PER_UNIT).toFixed(2)}J ΣΔU=${(sumDU * J_PER_UNIT).toFixed(4)}J`;
  console.log(line);
  if (!closedOk) { ok = false; console.log('   ✗ サイクルが閉じていません'); }
  if (!firstLawOk) { ok = false; console.log('   ✗ ΔU = Q + W が成り立たない操作があります'); }
}
console.log(ok ? '\nすべての問題に問題なし' : '\n問題あり');
process.exit(ok ? 0 : 1);
