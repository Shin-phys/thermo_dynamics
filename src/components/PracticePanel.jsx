// ====================================================
// 練習問題パネル: 問題選択・ヒント・答え・工程ごとの採点
// ====================================================
import { useMemo, useState } from 'react';
import { FAMILIES, OPERATIONS, PROCESS_INFO, describeSetup } from '../physics/model.js';
import { gradeAttempt } from '../physics/problems.js';

const letter = (i) => String.fromCharCode(65 + i);

const STATUS = {
  ok: { icon: '✅', text: '一致' },
  short: { icon: '🔸', text: '操作は合っています。回数が足りません' },
  over: { icon: '🔸', text: '操作は合っています。行き過ぎています（「1つ戻す」で戻れます）' },
  wrong: { icon: '❌', text: '操作（装置の準備）が違います' },
  missing: { icon: '⬜', text: 'まだ' },
};

function howTo(processId) {
  const info = PROCESS_INFO[processId];
  if (info.family === 'line') return `PV図の上をまっすぐ動かす ${info.arrow}`;
  return `${describeSetup(info.setup)} で「${OPERATIONS[info.op].label}」`;
}

export default function PracticePanel({ problems, problem, onSelect, steps }) {
  const [view, setView] = useState({ id: null, hint: false, answer: false, checked: false });
  // 問題が変わったら表示状態をリセット
  const v = view.id === problem?.id ? view : { id: problem?.id, hint: false, answer: false, checked: false };
  const set = (patch) => setView({ ...v, ...patch });

  const grade = useMemo(() => (problem ? gradeAttempt(steps, problem) : null), [steps, problem]);
  const segs = problem?.segments ?? [];
  const nVert = problem ? (problem.closed ? segs.length : segs.length + 1) : 0;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-slate-400">問題を選ぶ</span>
        <select
          value={problem?.id ?? ''}
          onChange={(e) => onSelect(problems.find((p) => p.id === Number(e.target.value)))}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-100"
        >
          {problems.map((p) => <option key={p.id} value={p.id}>#{p.id} {p.name}</option>)}
        </select>
      </label>

      {problem && (
        <>
          <p className="text-sm text-slate-200 leading-relaxed">
            PV図の白い点線の経路（{Array.from({ length: nVert }, (_, i) => letter(i)).join(' → ')}
            {problem.closed ? ' → A' : ''}）を、装置の準備と操作で再現しよう。
            スタートは点 A（緑の丸）です。
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => set({ checked: true })}
              className="rounded-lg bg-emerald-600/80 hover:bg-emerald-500 px-3 py-2 text-sm font-semibold text-white">
              ✔ 採点する
            </button>
            <button type="button" onClick={() => set({ hint: !v.hint })}
              className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm text-slate-200">
              💡 {v.hint ? 'ヒントを隠す' : 'ヒント'}
            </button>
            <button type="button" onClick={() => set({ answer: !v.answer })}
              className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm text-slate-200">
              👁 {v.answer ? '答えを隠す' : '答え'}
            </button>
          </div>

          {(v.checked || v.hint || v.answer) && (
            <ol className="space-y-1.5">
              {segs.map((s, i) => {
                const info = PROCESS_INFO[s.processId];
                const row = grade.rows[i];
                const to = problem.closed && i === segs.length - 1 ? 'A' : letter(i + 1);
                return (
                  <li key={i} className="rounded-lg bg-slate-800/60 border border-slate-700/60 px-2 py-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-300">{letter(i)}→{to}</span>
                      {v.hint && (
                        <span style={{ color: FAMILIES[info.family].color }}>{FAMILIES[info.family].name}</span>
                      )}
                      {v.checked && <span className="ml-auto">{STATUS[row.status].icon}</span>}
                    </div>
                    {v.answer && (
                      <div className="text-xs text-slate-300 mt-0.5">{howTo(s.processId)} × {s.count} 回</div>
                    )}
                    {v.checked && row.status !== 'ok' && row.status !== 'missing' && (
                      <div className="text-xs text-amber-200 mt-0.5">
                        {STATUS[row.status].text}
                        {(row.status === 'short' || row.status === 'over') && `（${row.user.count} / ${s.count} 回）`}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {v.checked && grade.extra > 0 && (
            <div className="text-sm text-amber-200">目標より工程が {grade.extra} つ多くなっています。</div>
          )}
          {v.checked && grade.correct && (
            <div className="rounded-xl border border-emerald-400/50 bg-emerald-900/30 p-3 text-emerald-100 font-semibold">
              🎉 正解！ すべての工程が一致しました。
              {problem.closed && ' 下のエネルギー収支でサイクル全体の熱と仕事も確かめよう。'}
            </div>
          )}
          {v.checked && !grade.correct && (
            <p className="text-xs text-slate-400">採点結果は操作に合わせて更新されます。</p>
          )}
        </>
      )}
    </div>
  );
}
