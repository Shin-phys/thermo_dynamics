// ====================================================
// 装置の設定と操作ボタン
//   ピストン（固定／手で動かす／自由） × 環境（断熱材／恒温槽）
//   操作：加熱する／冷却する／押し込む／引き出す
// ====================================================
import { PISTON_MODES, ENV_MODES, OPERATIONS, FAMILIES, PROCESS_INFO, LINE_PROCESSES } from '../physics/model.js';

function Choice({ active, onClick, icon, label, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-2 py-2 rounded-lg border text-sm leading-tight transition-colors text-left
        ${active
          ? 'bg-sky-600/80 border-sky-300 text-white shadow'
          : 'bg-slate-800/70 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
    >
      <span className="mr-1">{icon}</span>{label}
    </button>
  );
}

const OP_STYLE = {
  heat: 'bg-orange-900/50 border-orange-500/60 text-orange-100 hover:bg-orange-800/60',
  cool: 'bg-sky-900/50 border-sky-500/60 text-sky-100 hover:bg-sky-800/60',
  push: 'bg-emerald-900/50 border-emerald-500/60 text-emerald-100 hover:bg-emerald-800/60',
  pull: 'bg-violet-900/50 border-violet-500/60 text-violet-100 hover:bg-violet-800/60',
};

/**
 * @param {object} props
 * @param {{piston:string, env:string}} props.setup
 * @param {(op:string)=>({processId?:string, reason?:string})} props.check 操作の可否
 * @param {boolean} props.showCaptions ボタンの下に「→ ○○変化」を出すか
 */
export default function SetupPanel({
  setup, onSetup, check, onOperate, showCaptions = true,
  lineOps = null, onUndo = null, canUndo = false, onReset = null, resetLabel = 'はじめから',
  message = null, captionSuffix = '',
}) {
  const pistonInfo = PISTON_MODES.find((m) => m.id === setup.piston);
  const envInfo = ENV_MODES.find((m) => m.id === setup.env);

  const results = Object.keys(OPERATIONS).map((op) => ({ op, ...check(op) }));
  const reasons = [];
  for (const r of results) {
    if (r.reason && !reasons.includes(r.reason)) reasons.push(r.reason);
  }

  return (
    <div className="space-y-4">
      {/* 装置の設定 */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">① 装置を準備する</h3>
        <div className="text-xs text-slate-400 mb-1">ピストン</div>
        <div className="grid grid-cols-3 gap-1.5">
          {PISTON_MODES.map((m) => (
            <Choice key={m.id} active={setup.piston === m.id} icon={m.icon} label={m.short}
              title={m.desc} onClick={() => onSetup({ ...setup, piston: m.id })} />
          ))}
        </div>
        <div className="text-xs text-slate-400 mt-2 mb-1">容器のまわり</div>
        <div className="grid grid-cols-2 gap-1.5">
          {ENV_MODES.map((m) => (
            <Choice key={m.id} active={setup.env === m.id} icon={m.icon} label={m.short}
              title={m.desc} onClick={() => onSetup({ ...setup, env: m.id })} />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          {pistonInfo?.desc}。{envInfo?.desc}。
        </p>
      </div>

      {/* 操作 */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">② 操作する</h3>
        <div className="grid grid-cols-2 gap-2">
          {results.map(({ op, processId, reason }) => {
            const o = OPERATIONS[op];
            const disabled = !processId;
            const fam = processId ? PROCESS_INFO[processId].family : null;
            return (
              <button
                key={op}
                type="button"
                disabled={disabled}
                title={reason ?? ''}
                onClick={() => onOperate(op, processId)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors
                  ${disabled ? 'bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed' : OP_STYLE[op]}`}
              >
                <div><span className="mr-1">{o.icon}</span>{o.label}</div>
                {showCaptions && fam && (
                  <div className="text-xs font-normal mt-0.5" style={{ color: FAMILIES[fam].color }}>
                    → {FAMILIES[fam].name}{captionSuffix}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {reasons.length > 0 && (
          <ul className="mt-2 space-y-1">
            {reasons.map((r) => (
              <li key={r} className="text-xs text-slate-400 leading-relaxed">・{r}</li>
            ))}
          </ul>
        )}
        {message && (
          <div className="mt-2 text-sm text-amber-300 bg-amber-900/20 border border-amber-600/30 rounded-lg px-2 py-1.5">
            {message}
          </div>
        )}
      </div>

      {/* PV図上の直線（応用） */}
      {lineOps && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-1">PV図の上をまっすぐ動かす（応用）</h3>
          <p className="text-xs text-slate-400 mb-2 leading-relaxed">
            加熱・冷却とピストンの動きを同時に調整して、PV図上を斜めに進ませる操作です（装置の設定とは無関係）。
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {LINE_PROCESSES.map((id) => {
              const r = lineOps.check(id);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!!r}
                  title={r ?? PROCESS_INFO[id].name}
                  onClick={() => lineOps.onRun(id)}
                  className="rounded-lg border px-2 py-2 text-lg leading-none transition-colors
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
        <div className="flex gap-2">
          {onUndo && (
            <button type="button" onClick={onUndo} disabled={!canUndo}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200
                hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
              ↩ 1つ戻す
            </button>
          )}
          {onReset && (
            <button type="button" onClick={onReset}
              className="flex-1 rounded-lg border border-rose-600/50 bg-rose-900/30 px-3 py-2 text-sm text-rose-100 hover:bg-rose-800/40">
              ⟲ {resetLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
