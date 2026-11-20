// ====================================================
// 熱力学第一法則シミュレーター
//   教科書モデル（理想気体）／練習問題／粒子モデル
//   PC・スマホとも1画面に収め、スクロールせずに操作できる配置にする（components/Workspace.jsx）
// ====================================================
import { useMemo, useState } from 'react';
import Apparatus from './components/Apparatus.jsx';
import OperationBar, { CompactControls } from './components/OperationBar.jsx';
import Workspace from './components/Workspace.jsx';
import PVDiagram from './components/PVDiagram.jsx';
import SpeedDistribution from './components/SpeedDistribution.jsx';
import PracticePanel from './components/PracticePanel.jsx';
import ParticleView from './components/ParticleView.jsx';
import { StatePanel, LastStepPanel, TotalsPanel, LastStrip } from './components/Panels.jsx';
import { useIdealModel } from './hooks/useIdealModel.js';
import { computeProcess, familyOf, mergeSteps, resolveOperation, sameState } from './physics/model.js';
import { getProblems } from './physics/problems.js';

const MODES = [
  { id: 'textbook', label: '教科書モデル', short: '教科書', icon: '📘', desc: '理想気体（単原子分子）。装置を準備して操作すると、状態の変化と熱・仕事が計算されます。' },
  { id: 'practice', label: '練習問題', short: '練習', icon: '✏️', desc: 'PV図の白い点線の経路を、装置の準備と操作で再現しよう。' },
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

  const run = (processId) => setMessage(model.perform(processId));

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
  const T = model.current.P * model.current.V;

  const energyTab = {
    id: 'energy',
    label: 'エネルギー',
    content: (
      <>
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">直近の操作</h3>
          <LastStepPanel step={model.lastStep} segment={segments[segments.length - 1]} />
        </div>
        <div className="border-t border-slate-700/60 pt-3">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">はじめからの合計</h3>
          <TotalsPanel totals={model.totals} start={model.start} current={model.current} closed={closed} />
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          ΔU = Q + W（Q：気体が吸収した熱量、W：気体がされた仕事、W′ = −W：気体がした仕事）。
          基準状態 1.0×10⁵ Pa・1.0 L・300 K、1回の操作で PV 図の方眼 1 目盛り（0.1）ずつ変化します。
        </p>
      </>
    ),
  };
  const stateTab = {
    id: 'state',
    label: '状態・速度分布',
    content: (
      <>
        <StatePanel state={model.current} />
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">分子の速さの分布（マクスウェル分布）</h3>
          <SpeedDistribution T={T} />
        </div>
      </>
    ),
  };
  const practiceTab = {
    id: 'practice',
    label: '練習問題',
    content: <PracticePanel problems={PROBLEMS} problem={problem} onSelect={selectProblem} steps={model.steps} />,
  };

  const controlProps = {
    setup,
    onSetup: (s) => { setSetup(s); setMessage(null); },
    check,
    onOperate: (op, processId) => run(processId),
    showCaptions: mode === 'textbook',
    lineOps,
    onUndo: () => { model.undo(); setMessage(null); },
    canUndo: model.steps.length > 0,
    onReset: () => { model.reset(mode === 'practice' ? problem.start : undefined); setMessage(null); },
    message,
    status: <LastStrip step={model.lastStep} />,
  };

  return (
    <div className="h-[100dvh] lg:min-h-[640px] flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-[1920px] mx-auto px-2 lg:px-3 py-1.5 lg:py-2 flex items-center gap-x-4 gap-y-2">
          <h1 className="text-base lg:text-lg font-bold whitespace-nowrap truncate min-w-0">
            🌡️ <span className="hidden sm:inline">熱力学第一法則シミュレーター</span><span className="hidden min-[400px]:inline sm:hidden">熱力学</span>
            <span className="ml-2 text-sm font-normal text-slate-400 hidden md:inline">ΔU = Q + W</span>
          </h1>
          <p className="hidden lg:block flex-1 min-w-0 text-sm text-slate-400 truncate" title={modeInfo.desc}>
            {modeInfo.desc}
          </p>
          <nav className="flex gap-1 rounded-xl bg-slate-900 border border-slate-700 p-1 ml-auto lg:ml-0 shrink-0" aria-label="モード切り替え">
            {MODES.map((m) => (
              <button key={m.id} type="button" onClick={() => changeMode(m.id)}
                aria-current={mode === m.id ? 'page' : undefined}
                className={`rounded-lg px-2.5 lg:px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors
                  ${mode === m.id ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                <span className="mr-1">{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.short}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {mode === 'particle' ? (
        <ParticleView active={mode === 'particle'} />
      ) : (
        <Workspace
          key={mode}
          apparatusTitle="装置"
          initialView={mode === 'practice' ? 'graph' : null}
          apparatus={<Apparatus V={model.current.V} T={T} piston={setup.piston} env={setup.env} event={event} />}
          graph={(
            <PVDiagram key={mode} trace={trace} start={model.start} current={model.current} target={target}
              guidesDefault={mode === 'textbook'} />
          )}
          controls={<OperationBar {...controlProps} resetLabel={mode === 'practice' ? 'やり直す' : 'はじめから'} />}
          compactControls={<CompactControls {...controlProps} />}
          panels={mode === 'practice' ? [practiceTab, energyTab, stateTab] : [energyTab, stateTab]}
        />
      )}

    </div>
  );
}
