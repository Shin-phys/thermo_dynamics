// ====================================================
// 粒子モデル（2次元の分子シミュレーション）の画面
// ====================================================
import { useState } from 'react';
import Apparatus from './Apparatus.jsx';
import SetupPanel from './SetupPanel.jsx';
import PVDiagram from './PVDiagram.jsx';
import SpeedDistribution from './SpeedDistribution.jsx';
import { Card } from './Panels.jsx';
import { useParticleSim } from '../hooks/useParticleSim.js';
import { resolveOperation, T0_K } from '../physics/model.js';
import { N_REF } from '../physics/particleSim.js';

const fmt = (v, d = 1) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${Math.abs(v).toFixed(d)}`;

function Row({ label, sub, value, color = 'text-slate-100', unit = 'J' }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-sm text-slate-300">{label}{sub && <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">{sub}</span>}</span>
      <span className={`font-mono text-sm tabular-nums whitespace-nowrap ${color}`}>{value} {unit}</span>
    </div>
  );
}

export default function ParticleView({ active }) {
  const { sim, stats, refresh } = useParticleSim(active);
  const [message, setMessage] = useState(null);
  const setup = { piston: stats.piston, env: stats.env };

  const check = (op) => {
    const r = resolveOperation(setup, op);
    if (!r.processId) return r;
    if (op === 'push' && !stats.canPush) return { reason: `体積の下限（0.4 L）です。` };
    if (op === 'pull' && !stats.canPull) return { reason: `体積の上限（2.0 L）です。` };
    return r;
  };

  const onSetup = (s) => {
    if (s.piston !== setup.piston) sim.setPiston(s.piston);
    if (s.env !== setup.env) sim.setEnv(s.env);
    setMessage(null);
    refresh();
  };

  const onOperate = (op) => {
    sim[op]();
    setMessage(null);
    refresh();
  };

  const chk = stats.dU - (stats.Q + stats.W);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-start">
      <div className="xl:col-span-4 space-y-4">
        <Card title="装置（分子 1 個 1 個を計算）">
          <Apparatus sim={sim} />
        </Card>
        <Card title="装置の準備と操作">
          <SetupPanel
            setup={setup}
            onSetup={onSetup}
            check={check}
            onOperate={onOperate}
            captionSuffix="に近い変化"
            message={message}
          />
          <div className="mt-4 border-t border-slate-700/60 pt-3 space-y-2">
            <div className="text-xs text-slate-400">分子の数 N（選ぶと最初からやり直し：全分子が同じ速さで出発）</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[100, 200, 400].map((n) => (
                <button key={n} type="button" onClick={() => { sim.reset(n); refresh(); }}
                  className={`rounded-lg border px-2 py-1.5 text-sm ${stats.N === n
                    ? 'bg-emerald-600/70 border-emerald-300 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                  {n} 個
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { sim.reset(stats.N); refresh(); }}
              className="w-full rounded-lg border border-rose-600/50 bg-rose-900/30 px-3 py-2 text-sm text-rose-100 hover:bg-rose-800/40">
              ⟲ 最初から
            </button>
          </div>
        </Card>
      </div>

      <div className="xl:col-span-5 space-y-4">
        <Card title="PV図（衝突から測った圧力）">
          <PVDiagram points={stats.trace} current={{ V: stats.V, P: stats.P }} isoScale={stats.N / N_REF} showArea={false} />
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            点はピストンが受けた力積から測った圧力です（新しい点ほど濃い）。点線は理想気体の等温線（分子数に比例してずれます）。
          </p>
        </Card>
        <Card title="分子の速さの分布（実測）">
          <SpeedDistribution T={stats.T} hist={stats.hist} />
        </Card>
      </div>

      <div className="md:col-span-2 xl:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 items-start">
        <Card title="測った状態量">
          <div className="space-y-1">
            <Row label="圧力（衝突から測定）" value={stats.P.toFixed(2)} unit="×10⁵ Pa" color="text-rose-300" />
            <Row label="理想気体なら" sub="P ∝ NT/V" value={stats.Ptheory.toFixed(2)} unit="×10⁵ Pa" color="text-rose-200/70" />
            <Row label="体積" value={stats.V.toFixed(2)} unit="L" color="text-sky-300" />
            <Row label="温度（平均運動エネルギーから）" value={Math.round(stats.T * T0_K)} unit="K" color="text-amber-300" />
            <Row label="分子の数" value={stats.N} unit="個" />
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            測った圧力が理想気体の値より少し大きいのは、分子に大きさがあって動ける面積が狭いため（実在気体の性質）です。
          </p>
        </Card>
        <Card title="エネルギーの収支（分子ごとに集計）"
          right={<button type="button" onClick={() => { sim.resetRecord(); refresh(); }}
            className="text-xs rounded-md border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-700">記録をリセット</button>}>
          <Row label="壁から受け取った熱" sub="Q" value={fmt(stats.Q)} color="text-orange-300" />
          <Row label="ピストンからされた仕事" sub="W" value={fmt(stats.W)} color="text-emerald-300" />
          <Row label="内部エネルギーの変化" sub="ΔU" value={fmt(stats.dU)} color="text-yellow-300" />
          <div className="mt-1 font-mono text-xs text-slate-400 bg-slate-800/60 rounded-lg px-2 py-1.5">
            ΔU − (Q + W) = {Math.abs(chk) < 1e-6 ? '0.0' : chk.toExponential(1)} J
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            分子が熱い（冷たい）壁にぶつかるとエネルギーが増減し（熱 Q）、動くピストンにぶつかると速さが変わります（仕事 W）。
            分子どうしの衝突ではエネルギーの合計は変わらないので、ΔU = Q + W がいつも成り立ちます。
          </p>
        </Card>
        <Card title="観察してみよう">
          <ul className="text-sm text-slate-300 space-y-1.5 leading-relaxed list-disc pl-4">
            <li>はじめは全分子が同じ速さ。分布はどう変わっていく？</li>
            <li>断熱材のままピストンを押し込むと、加熱していないのに温度が上がる。</li>
            <li>恒温槽ではピストンを動かしても温度はほぼ一定。代わりに熱が出入りする。</li>
            <li>分子の数を 2 倍にすると、圧力はどうなる？</li>
            <li>恒温槽の中でも温度は少しゆらぐ。分子の数が少ないほどゆらぎは大きい。</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            この粒子モデルは 2 次元なので、1 分子の平均運動エネルギーは kT（3 次元の単原子分子の 3/2 kT とは異なります）。
            エネルギーは「分子 200 個・300 K で U = 100 J」となるように換算しています。
          </p>
        </Card>
      </div>
    </div>
  );
}
