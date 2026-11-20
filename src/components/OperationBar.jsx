// ====================================================
// 操作バー（装置の準備 → 操作）
//   ピストン（固定／手で動かす／自由） × 容器（断熱材／恒温槽）
//   操作：加熱する／冷却する／押し込む／引き出す
//   PC では画面下に横長に置き、図を見ながら操作できるようにする
// ====================================================
import { PISTON_MODES, ENV_MODES, OPERATIONS, FAMILIES, PROCESS_INFO, LINE_PROCESSES } from '../physics/model.js';

function Seg({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg border border-slate-600 overflow-hidden" role="group">
      {options.map((m, i) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            title={m.desc}
            aria-pressed={active}
            onClick={() => onChange(m.id)}
            className={`px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors ${i ? 'border-l border-slate-600' : ''}
              ${active ? 'bg-sky-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
          >
            <span className="mr-1">{m.icon}</span>{m.short}
          </button>
        );
      })}
    </div>
  );
}

const OP_STYLE = {
  heat: 'bg-orange-900/50 border-orange-500/60 text-orange-100 hover:bg-orange-800/60',
  cool: 'bg-sky-900/50 border-sky-500/60 text-sky-100 hover:bg-sky-800/60',
  push: 'bg-emerald-900/50 border-emerald-500/60 text-emerald-100 hover:bg-emerald-800/60',
  pull: 'bg-violet-900/50 border-violet-500/60 text-violet-100 hover:bg-violet-800/60',
};

const OP_SHORT = { heat: '加熱する', cool: '冷却する', push: '押し込む', pull: '引き出す' };

/**
 * @param {object} props
 * @param {{piston:string, env:string}} props.setup
 * @param {(op:string)=>({processId?:string, reason?:string})} props.check 操作の可否
 * @param {boolean} props.showCaptions ボタンに「→ ○○変化」を出すか
 * @param {React.ReactNode} props.status 2行目右側に出す表示（直近の結果など）
 * @param {React.ReactNode} props.extra 右端に置く追加の操作
 */
export default function OperationBar({
  setup, onSetup, check, onOperate, showCaptions = true,
  lineOps = null, onUndo = null, canUndo = false, onReset = null, resetLabel = 'はじめから',
  message = null, captionSuffix = '', status = null, extra = null,
}) {
  const pistonInfo = PISTON_MODES.find((m) => m.id === setup.piston);
  const envInfo = ENV_MODES.find((m) => m.id === setup.env);
  const results = Object.keys(OPERATIONS).map((op) => ({ op, ...check(op) }));
  const reasons = [...new Set(results.filter((r) => r.reason).map((r) => r.reason))];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap xl:flex-nowrap gap-x-4 gap-y-3 items-stretch">
        {/* ① 装置の準備 */}
        <section className="shrink-0 space-y-1.5" aria-label="装置の準備">
          <div className="text-xs font-semibold text-slate-400">① 装置を準備する</div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-slate-400">ピストン</span>
            <Seg options={PISTON_MODES} value={setup.piston} onChange={(v) => onSetup({ ...setup, piston: v })} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-xs text-slate-400">容器</span>
            <Seg options={ENV_MODES} value={setup.env} onChange={(v) => onSetup({ ...setup, env: v })} />
          </div>
        </section>

        {/* ② 操作 */}
        <section className="flex-1 min-w-[300px] flex flex-col" aria-label="操作">
          <div className="text-xs font-semibold text-slate-400 mb-1.5">② 操作する</div>
          <div className="grid grid-cols-2 gap-1.5 flex-1">
            {results.map(({ op, processId, reason }) => {
              const o = OPERATIONS[op];
              const disabled = !processId;
              const fam = processId ? PROCESS_INFO[processId].family : null;
              return (
                <button
                  key={op}
                  type="button"
                  disabled={disabled}
                  title={reason ?? o.label}
                  onClick={() => onOperate(op, processId)}
                  className={`rounded-xl border px-2 py-1.5 text-sm font-semibold leading-tight transition-colors
                    flex flex-wrap items-center justify-center gap-x-2
                    ${disabled ? 'bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed' : OP_STYLE[op]}`}
                >
                  <span className="whitespace-nowrap"><span className="mr-1">{o.icon}</span>{OP_SHORT[op]}</span>
                  {showCaptions && fam && (
                    <span className="text-xs font-normal whitespace-nowrap" style={{ color: FAMILIES[fam].color }}>
                      → {FAMILIES[fam].name}{captionSuffix}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 応用・やり直し */}
        {(lineOps || onUndo || onReset || extra) && (
          <section className="shrink-0 flex gap-3 items-end">
            {lineOps && (
              <div>
                <div className="text-xs text-slate-400 mb-1.5" title="加熱・冷却とピストンの動きを同時に調整して、PV図上を斜めに進ませる操作です（装置の設定とは無関係）。">
                  直線で動かす ⓘ
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {LINE_PROCESSES.map((id) => {
                    const r = lineOps.check(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!!r}
                        title={r ?? PROCESS_INFO[id].name}
                        aria-label={PROCESS_INFO[id].name}
                        onClick={() => lineOps.onRun(id)}
                        className="w-9 h-8 rounded-md border text-base leading-none transition-colors
                          bg-amber-900/30 border-amber-500/50 text-amber-100 hover:bg-amber-800/50
                          disabled:bg-slate-800/40 disabled:border-slate-700 disabled:text-slate-600 disabled:cursor-not-allowed"
                      >
                        {PROCESS_INFO[id].arrow}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {(onUndo || onReset) && (
              <div className="flex flex-col gap-1">
                {onUndo && (
                  <button type="button" onClick={onUndo} disabled={!canUndo}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 whitespace-nowrap
                      hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    ↩ 1つ戻す
                  </button>
                )}
                {onReset && (
                  <button type="button" onClick={onReset}
                    className="rounded-lg border border-rose-600/50 bg-rose-900/30 px-3 py-1.5 text-sm text-rose-100 whitespace-nowrap hover:bg-rose-800/40">
                    ⟲ {resetLabel}
                  </button>
                )}
              </div>
            )}
            {extra}
          </section>
        )}
      </div>

      {/* 2行目：説明・理由と、直近の結果 */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-slate-700/60 pt-2 min-h-[2.25rem]">
        <p className={`flex-1 min-w-[240px] text-xs leading-relaxed ${message ? 'text-amber-300' : 'text-slate-400'}`}>
          {message
            ?? (reasons.length ? reasons.join(' ／ ') : `${pistonInfo?.desc}。${envInfo?.desc}。`)}
        </p>
        {status}
      </div>
    </div>
  );
}
