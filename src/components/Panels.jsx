// ====================================================
// 状態量・エネルギー収支の表示（理想モデル）
// ====================================================
import { FAMILIES, J_PER_UNIT, N_MOL, PROCESS_INFO, T0_K } from '../physics/model.js';

export function Card({ title, children, className = '', right = null }) {
  return (
    <section className={`rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-100">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const fmtJ = (x, digits = 1) => {
  const v = x * J_PER_UNIT;
  const r = Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(digits)}`;
};

function Stat({ label, value, unit, color }) {
  return (
    <div className="rounded-xl bg-slate-800/70 border border-slate-700/60 px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-xl font-semibold tabular-nums whitespace-nowrap ${color}`}>
        {value}<span className="text-xs text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

export function StatePanel({ state }) {
  const T = state.P * state.V;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="圧力 P" value={state.P.toFixed(2)} unit="×10⁵ Pa" color="text-rose-300" />
        <Stat label="体積 V" value={state.V.toFixed(2)} unit="L" color="text-sky-300" />
        <Stat label="温度 T" value={Math.round(T * T0_K)} unit="K" color="text-amber-300" />
        <Stat label="内部エネルギー" value={(1.5 * T * J_PER_UNIT).toFixed(1)} unit="J" color="text-emerald-300" />
      </div>
      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
        単原子分子の理想気体 {N_MOL.toFixed(4)} mol（PV = nRT、U = 3/2 nRT）
      </p>
    </div>
  );
}

/** Q, W, ΔU の符号付き棒グラフ */
function EnergyBars({ Q, W, dU }) {
  const items = [
    { k: 'Q', v: Q, label: '熱 Q', color: Q >= 0 ? '#fb923c' : '#38bdf8' },
    { k: 'W', v: W, label: '仕事 W', color: W >= 0 ? '#34d399' : '#c084fc' },
    { k: 'U', v: dU, label: 'ΔU', color: '#facc15' },
  ];
  const max = Math.max(0.05, ...items.map((i) => Math.abs(i.v)));
  const h = 46;
  return (
    <svg viewBox="0 0 240 120" className="w-full max-w-[260px]" role="img" aria-label="熱・仕事・内部エネルギー変化の棒グラフ">
      <line x1="10" x2="230" y1="60" y2="60" stroke="#64748b" strokeWidth="1" />
      {items.map((it, i) => {
        const x = 30 + i * 72;
        const bh = (Math.abs(it.v) / max) * h;
        const y = it.v >= 0 ? 60 - bh : 60;
        return (
          <g key={it.k}>
            <rect x={x} y={y} width="44" height={Math.max(bh, 0.5)} rx="3" fill={it.color} opacity="0.85" />
            <text x={x + 22} y={it.v >= 0 ? 76 : 50} textAnchor="middle" fontSize="12" fill="#cbd5e1">{it.label}</text>
            {i === 0 && <text x={x + 58} y="64" textAnchor="middle" fontSize="16" fill="#e2e8f0">+</text>}
            {i === 1 && <text x={x + 58} y="64" textAnchor="middle" fontSize="16" fill="#e2e8f0">=</text>}
          </g>
        );
      })}
      <text x="120" y="114" textAnchor="middle" fontSize="11" fill="#94a3b8">棒の高さ：上が＋、下が−</text>
    </svg>
  );
}

function Row({ label, sub, value, color = 'text-slate-100' }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-sm text-slate-300">{label}{sub && <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">{sub}</span>}</span>
      <span className={`font-mono text-sm tabular-nums whitespace-nowrap ${color}`}>{value} J</span>
    </div>
  );
}

export function LastStepPanel({ step, segment }) {
  if (!step) {
    return <p className="text-sm text-slate-400">装置を準備して操作すると、熱 Q・仕事 W・内部エネルギーの変化 ΔU が表示されます。</p>;
  }
  const info = PROCESS_INFO[step.processId];
  const fam = FAMILIES[info.family];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: fam.color }} />
        <span className="font-semibold text-slate-100">{info.name}</span>
      </div>
      <div className="space-y-1">
        <div>
          <Row label="気体が吸収した熱量" sub="Q" value={fmtJ(step.Q)} color={step.Q >= 0 ? 'text-orange-300' : 'text-sky-300'} />
          <Row label="気体がされた仕事" sub="W" value={fmtJ(step.W)} color="text-emerald-300" />
          <Row label="気体がした仕事" sub="W′ = −W" value={fmtJ(-step.W)} color="text-violet-300" />
          <Row label="内部エネルギーの変化" sub="ΔU" value={fmtJ(step.dU)} color="text-yellow-300" />
        </div>
        <EnergyBars Q={step.Q} W={step.W} dU={step.dU} />
      </div>
      <div className="font-mono text-xs text-slate-300 bg-slate-800/60 rounded-lg px-2 py-1.5">
        ΔU = Q + W ： {fmtJ(step.dU)} = {fmtJ(step.Q)} + ({fmtJ(step.W)}) 〔J〕
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{info.note}</p>
      {segment && segment.count > 1 && (
        <div className="text-xs text-slate-400 border-t border-slate-700/60 pt-2">
          この工程（同じ操作 {segment.count} 回）の合計：
          Q {fmtJ(segment.Q)} J、W′ {fmtJ(-segment.W)} J、ΔU {fmtJ(segment.dU)} J
        </div>
      )}
    </div>
  );
}

export function TotalsPanel({ totals, start, current, closed }) {
  const dU = 1.5 * (current.P * current.V - start.P * start.V);
  const netW = -totals.W; // 気体がした正味の仕事
  return (
    <div className="space-y-2">
      <Row label="熱量の合計" sub="ΣQ" value={fmtJ(totals.Q)} color="text-orange-300" />
      <Row label="された仕事の合計" sub="ΣW" value={fmtJ(totals.W)} color="text-emerald-300" />
      <Row label="内部エネルギーの変化" sub="U−U₀" value={fmtJ(dU)} color="text-yellow-300" />
      <div className="font-mono text-xs text-slate-400 bg-slate-800/60 rounded-lg px-2 py-1.5">
        U − U₀ = ΣQ + ΣW ： {fmtJ(dU)} = {fmtJ(totals.Q)} + ({fmtJ(totals.W)})
      </div>
      {closed && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-3 space-y-1">
          <div className="font-semibold text-amber-200">🔁 1サイクル完了（元の状態に戻った）</div>
          <div className="text-sm text-slate-200">内部エネルギーは元どおり：ΔU = 0</div>
          <Row label="正味の仕事" sub="ΣW′＝囲まれた面積" value={fmtJ(netW)} color="text-violet-300" />
          <Row label="吸収した熱" sub="Q>0 の合計" value={fmtJ(totals.Qin)} color="text-orange-300" />
          <Row label="放出した熱" sub="Q<0 の合計" value={fmtJ(totals.Qout)} color="text-sky-300" />
          {netW > 1e-6 ? (
            <div className="text-sm text-amber-100">
              熱効率 e = W′ / Q<sub>吸収</sub> = {(netW / totals.Qin).toFixed(3)}（{((netW / totals.Qin) * 100).toFixed(1)} %）
            </div>
          ) : (
            <div className="text-xs text-slate-300 leading-relaxed">
              反時計回りのサイクルでは、外から正味の仕事をされて熱を放出します（熱機関ではなく、冷凍機・ヒートポンプの向き）。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
