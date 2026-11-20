// ====================================================
// 熱力学第一法則シミュレーター
//   教科書モデル（理想気体）／練習問題／粒子モデル
// ====================================================
import { useMemo, useState } from 'react';
import Apparatus from './components/Apparatus.jsx';
import SetupPanel from './components/SetupPanel.jsx';
import PVDiagram from './components/PVDiagram.jsx';
import SpeedDistribution from './components/SpeedDistribution.jsx';
import PracticePanel from './components/PracticePanel.jsx';
import ParticleView from './components/ParticleView.jsx';
import { Card, StatePanel, LastStepPanel, TotalsPanel } from './components/Panels.jsx';
import { useIdealModel } from './hooks/useIdealModel.js';
import { computeProcess, familyOf, mergeSteps, resolveOperation, sameState } from './physics/model.js';
import { getProblems } from './physics/problems.js';

const MODES = [
  { id: 'textbook', label: '教科書モデル', short: '教科書', icon: '📘', desc: '理想気体（単原子分子）。装置を準備して操作すると、状態の変化と熱・仕事が計算されます。' },
  { id: 'practice', label: '練習問題', short: '練習', icon: '✏️', desc: 'PV図の点線の経路を、装置の準備と操作で再現しよう。' },
  { id: 'particle', label: '粒子モデル', short: '粒子', icon: '🔬', desc: '分子 1 個 1 個の運動と衝突を計算する 2 次元のモデル。圧力・温度・熱・仕事を分子の動きから測ります。' },
];

const PROBLEMS = getProblems();
const toTrace = (segs) => segs.map((s) => ({ ...s, family: familyOf(s.processId) }));

export default function App() {
  const [mode, setMode] = useState('textbook');
  const [setup, setSetup] = useState({ piston: 'fixed', env: 'insulated' });
  const [message, setMessage] = useState(null);
  const [problem, setProblem] = useState(PROBLEMS[0]);
  const model = useIdealModel();

  const segments = useMemo(() => mergeSteps(model.steps), [model.steps]);
  const trace = useMemo(() => toTrace(segments), [segments]);
  const target = useMemo(
    () => (mode === 'practice' && problem
      ? { segments: toTrace(problem.segments), closed: problem.closed }
      : null),
    [mode, problem],
  );
  const closed = model.steps.length >= 2 && sameState(model.start, model.current);
  const event = useMemo(
    () => (model.lastStep ? { key: model.steps.length, ...model.lastStep } : null),
    [model.lastStep, model.steps.length],
  );

  const changeMode = (id) => {
    setMode(id);
    setMessage(null);
    if (id === 'practice') model.reset(problem.start);
    if (id === 'textbook') model.reset();
  };

  const check = (op) => {
    const r = resolveOperation(setup, op);
    if (!r.processId) return r;
    const c = computeProcess(model.current, r.processId);
    return c.error ? { reason: c.error } : r;
  };

  const run = (processId) => {
    const err = model.perform(processId);
    setMessage(err);
  };

  const lineOps = {
    check: (id) => computeProcess(model.current, id).error ?? null,
    onRun: run,
  };

  const selectProblem = (p) => {
    setProblem(p);
    model.reset(p.start);
    setMessage(null);
  };

  const modeInfo = MODES.find((m) => m.id === mode);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-lg sm:text-xl font-bold">
            🌡️ 熱力学第一法則シミュレーター
            <span className="ml-2 text-sm font-normal text-slate-400 whitespace-nowrap">ΔU = Q + W</span>
          </h1>
          <nav className="flex gap-1 rounded-xl bg-slate-900 border border-slate-700 p-1" aria-label="モード切り替え">
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => changeMode(m.id)}
                aria-current={mode === m.id ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
                  ${mode === m.id ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <span className="mr-1">{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.short}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="max-w-[1440px] mx-auto px-4 pb-2 text-sm text-slate-400">{modeInfo.desc}</div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 py-4">
        {mode === 'particle' ? (
          <ParticleView active={mode === 'particle'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-start">
            {/* 装置と操作 */}
            <div className="xl:col-span-4 space-y-4">
              <Card title="装置">
                <Apparatus V={model.current.V} T={model.current.P * model.current.V}
                  piston={setup.piston} env={setup.env} event={event} />
              </Card>
              <Card title="装置の準備と操作">
                <SetupPanel
                  setup={setup}
                  onSetup={(s) => { setSetup(s); setMessage(null); }}
                  check={check}
                  onOperate={(op, processId) => run(processId)}
                  showCaptions={mode === 'textbook'}
                  lineOps={lineOps}
                  onUndo={() => { model.undo(); setMessage(null); }}
                  canUndo={model.steps.length > 0}
                  onReset={() => { model.reset(mode === 'practice' ? problem.start : undefined); setMessage(null); }}
                  resetLabel={mode === 'practice' ? 'この問題をやり直す' : 'はじめから'}
                  message={message}
                />
              </Card>
            </div>

            {/* グラフ */}
            <div className="xl:col-span-5 space-y-4">
              <Card title="PV図">
                <PVDiagram key={mode} trace={trace} start={model.start} current={model.current} target={target}
                  guidesDefault={mode === 'textbook'} />
              </Card>
              <Card title="分子の速さの分布（マクスウェル分布）">
                <SpeedDistribution T={model.current.P * model.current.V} />
              </Card>
            </div>

            {/* 練習・状態・エネルギー */}
            <div className="md:col-span-2 xl:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 items-start">
              {mode === 'practice' && (
                <Card title="練習問題">
                  <PracticePanel problems={PROBLEMS} problem={problem} onSelect={selectProblem} steps={model.steps} />
                </Card>
              )}
              <Card title="気体の状態">
                <StatePanel state={model.current} />
              </Card>
              <Card title="直近の操作">
                <LastStepPanel step={model.lastStep} segment={segments[segments.length - 1]} />
              </Card>
              <Card title="はじめからの合計">
                <TotalsPanel totals={model.totals} start={model.start} current={model.current} closed={closed} />
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 mt-6 py-4 text-center text-xs text-slate-500 leading-relaxed px-4">
        熱力学第一法則シミュレーター（高校物理）｜ ΔU = Q + W（Q：気体が吸収した熱量、W：気体がされた仕事、W′ = −W：気体がした仕事）
        <br />
        基準状態 1.0×10⁵ Pa・1.0 L・300 K、1回の操作で PV 図の方眼 1 目盛り（0.1）ずつ変化します。
      </footer>
    </div>
  );
}
