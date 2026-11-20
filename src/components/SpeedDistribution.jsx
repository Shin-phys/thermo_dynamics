// ====================================================
// 分子の速さの分布
//  - 理想モデル: 3次元マクスウェル分布（面積＝分子数が一定になるよう正規化）
//  - 粒子モデル: 実際の分子の速さのヒストグラム ＋ 2次元マクスウェル分布（理論）
//  横軸は「300 K での最頻値を 1」とした相対的な速さ
// ====================================================
import { useEffect } from 'react';
import { useCanvas, tempColor } from '../hooks/useCanvas.js';
import { maxwell3D, maxwell2D, T0_K } from '../physics/model.js';
import { HIST_UMAX } from '../physics/particleSim.js';

const M = { l: 44, r: 12, t: 12, b: 40 };

export default function SpeedDistribution({ T = 1, hist = null }) {
  const particle = !!hist;
  const uMax = particle ? HIST_UMAX : 3.2;
  const yMax = particle ? 1.0 : 1.3;
  const { wrapRef, canvasRef, width, height, getCtx } = useCanvas(
    (w) => Math.min(300, Math.max(180, w * 0.5)), 760,
  );

  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const W = width;
    const H = height;
    const pw = W - M.l - M.r;
    const ph = H - M.t - M.b;
    const X = (u) => M.l + (u / uMax) * pw;
    const Y = (f) => M.t + ph - (Math.min(f, yMax * 1.02) / yMax) * ph;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1222';
    ctx.fillRect(0, 0, W, H);

    // 目盛り
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    for (let u = 0; u <= uMax + 1e-9; u += 0.5) {
      ctx.strokeStyle = 'rgba(100,116,139,0.18)';
      ctx.beginPath(); ctx.moveTo(X(u), M.t); ctx.lineTo(X(u), M.t + ph); ctx.stroke();
      if (Math.abs(u - Math.round(u)) < 1e-9) ctx.fillText(u.toFixed(0), X(u), M.t + ph + 15);
    }
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, M.t + ph); ctx.lineTo(M.l + pw, M.t + ph); ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText('分子の速さ（300 K での最頻値 = 1）', M.l + pw / 2, H - 6);
    ctx.save();
    ctx.translate(14, M.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('分子の割合', 0, 0);
    ctx.restore();

    const f = particle ? maxwell2D : maxwell3D;

    if (particle) {
      // ヒストグラム
      for (const b of hist) {
        const x0 = X(b.u0) + 1;
        const x1 = X(b.u1) - 1;
        const y = Y(b.density);
        ctx.fillStyle = 'rgba(52,211,153,0.55)';
        ctx.fillRect(x0, y, x1 - x0, M.t + ph - y);
        if (b.density > yMax) {
          ctx.fillStyle = '#a7f3d0';
          ctx.textAlign = 'center';
          ctx.fillText('▲', (x0 + x1) / 2, M.t + 10);
        }
      }
    } else {
      // 基準温度（300 K）の分布
      ctx.strokeStyle = 'rgba(203,213,225,0.6)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const u = (uMax * i) / 200;
        if (i) ctx.lineTo(X(u), Y(f(u, 1))); else ctx.moveTo(X(u), Y(f(u, 1)));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // 現在の温度の分布（塗りつぶし）
      ctx.fillStyle = tempColor(T, 0.35);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      for (let i = 0; i <= 200; i++) { const u = (uMax * i) / 200; ctx.lineTo(X(u), Y(f(u, T))); }
      ctx.lineTo(X(uMax), Y(0));
      ctx.closePath();
      ctx.fill();
    }

    // 現在の温度の理論曲線
    ctx.strokeStyle = particle ? '#fbbf24' : tempColor(T, 1);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const u = (uMax * i) / 200;
      if (i) ctx.lineTo(X(u), Y(f(u, T))); else ctx.moveTo(X(u), Y(f(u, T)));
    }
    ctx.stroke();

    // 最頻値
    const up = Math.sqrt(T);
    if (up < uMax) {
      ctx.strokeStyle = 'rgba(226,232,240,0.5)';
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(up), Y(f(up, T))); ctx.lineTo(X(up), M.t + ph); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 凡例
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`T = ${Math.round(T * T0_K)} K`, M.l + pw - 4, M.t + 14);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(particle ? '黄線：理論（2次元のマクスウェル分布）' : '点線：300 K', M.l + pw - 4, M.t + 30);
  }, [width, height, getCtx, T, hist, particle, uMax, yMax]);

  return (
    <div>
      <div ref={wrapRef} className="w-full">
        <canvas ref={canvasRef} className="rounded-lg" aria-label="分子の速さの分布" />
      </div>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
        {particle
          ? '最初は全分子が同じ速さで出発します。分子どうしの衝突をくり返すと、分布が理論曲線に近づいていきます。'
          : '温度が上がると、分布は速いほうへ移り、山は低く広がります（面積＝分子の数は一定）。'}
      </p>
    </div>
  );
}
