// ====================================================
// 装置図: シリンダー・ピストン・断熱材／恒温槽・ヒーター・分子
//  - 理想モデル: V, T を受け取り、見本の分子を動かす。操作直後は Q と W の矢印を表示
//  - 粒子モデル: sim（ParticleSim）を毎フレーム直接読んで描く
// ====================================================
import { useEffect, useRef } from 'react';
import { useCanvas, drawArrow, tempColor } from '../hooks/useCanvas.js';
import { J_PER_UNIT, T0_K, familyOf, PROCESS_INFO } from '../physics/model.js';
import { SIM_W, H_PER_V, KE0, ParticleSim } from '../physics/particleSim.js';

const LW = 300;
const LH = 420;
const X0 = 80;
const X1 = 220;
const YB = 350;
const PX_PER_V = 270 / 2.2;
const PISTON_T = 12;
const ANNOT_MS = 2200;

function makeDecorParticles(n) {
  return Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    return {
      x: X0 + 8 + Math.random() * (X1 - X0 - 16),
      y: YB - 10 - Math.random() * 100,
      dx: Math.cos(a),
      dy: Math.sin(a),
      s: 0.6 + Math.random() * 0.8,
    };
  });
}

function fmtJ(x) {
  const v = x * J_PER_UNIT;
  const r = Math.abs(v) < 0.05 ? 0 : v;
  return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(1)} J`;
}

export default function Apparatus({ V = 1, T = 1, piston, env, event = null, sim = null }) {
  const { wrapRef, canvasRef, width, getCtx, wrapClass, canvasClass } = useCanvas(
    (w) => (w * LH) / LW, 340, { aspect: LW / LH },
  );
  const propsRef = useRef({});
  const eventRef = useRef(null);
  const particlesRef = useRef(null);
  const dispVRef = useRef(V);

  useEffect(() => {
    propsRef.current = { V, T, piston, env, sim };
  });

  useEffect(() => {
    if (event) eventRef.current = { ...event, t0: performance.now() };
    else eventRef.current = null;
  }, [event]);

  useEffect(() => {
    if (!width) return undefined;
    if (!particlesRef.current) particlesRef.current = makeDecorParticles(26);
    let raf = 0;
    let last = performance.now();

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ctx = getCtx();
      if (!ctx) { raf = requestAnimationFrame(frame); return; }
      const pr = propsRef.current;
      const s = pr.sim;
      const pistonMode = s ? s.piston : pr.piston;
      const envMode = s ? s.env : pr.env;
      const Tnow = s ? s.T : pr.T;

      // 体積（理想モデルはなめらかに追従させる）
      let Vd;
      if (s) {
        Vd = s.V;
      } else {
        dispVRef.current += (pr.V - dispVRef.current) * (1 - Math.exp(-dt / 0.12));
        Vd = dispVRef.current;
      }
      const yTop = YB - Vd * PX_PER_V;

      // 操作直後の注釈
      const ev = eventRef.current;
      const evAge = ev ? now - ev.t0 : Infinity;
      const evOn = !s && ev && evAge < ANNOT_MS;
      let heater = null;
      if (s) heater = s.heater;
      else if (evOn && evAge < 900) {
        const op = PROCESS_INFO[ev.processId]?.op;
        const fam = familyOf(ev.processId);
        if ((fam === 'isochoric' || fam === 'isobaric') && op) heater = op;
      }

      ctx.save();
      const k = width / LW;
      ctx.scale(k, k);
      ctx.clearRect(0, 0, LW, LH);

      // --- 恒温槽 ---
      if (envMode === 'bath') {
        const g = ctx.createLinearGradient(0, 150, 0, 395);
        g.addColorStop(0, 'rgba(56, 189, 248, 0.30)');
        g.addColorStop(1, 'rgba(37, 99, 235, 0.40)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(24, 150);
        for (let x = 24; x <= 276; x += 6) ctx.lineTo(x, 150 + Math.sin(x / 9 + now / 400) * 2);
        ctx.lineTo(276, 395);
        ctx.lineTo(24, 395);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 197, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(22, 140, 256, 257);
        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        const tb = s ? s.Tbath : Tnow;
        ctx.fillText(`恒温槽 ${Math.round(tb * T0_K)} K`, 30, 388);
      }

      // --- 気体部分 ---
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(X0, yTop, X1 - X0, YB - yTop);
      ctx.fillStyle = tempColor(Tnow, 0.10);
      ctx.fillRect(X0, yTop, X1 - X0, YB - yTop);

      // --- 容器の壁 ---
      if (envMode === 'insulated') {
        ctx.fillStyle = '#8a6d45';
        ctx.fillRect(X0 - 14, 60, 14, YB - 60 + 14);
        ctx.fillRect(X1, 60, 14, YB - 60 + 14);
        ctx.fillRect(X0 - 14, YB, X1 - X0 + 28, 14);
        ctx.save();
        ctx.beginPath();
        ctx.rect(X0 - 14, 60, 14, YB - 46);
        ctx.rect(X1, 60, 14, YB - 46);
        ctx.rect(X0 - 14, YB, X1 - X0 + 28, 14);
        ctx.clip();
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.35)';
        ctx.lineWidth = 1.5;
        for (let i = -40; i < 420; i += 7) {
          ctx.beginPath();
          ctx.moveTo(X0 - 20, i);
          ctx.lineTo(X1 + 20, i + 40);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#fde68a';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('断熱材', X0 - 18, YB - 4);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(X0 - 4, 60, 4, YB - 56);
        ctx.fillRect(X1, 60, 4, YB - 56);
        ctx.fillRect(X0 - 4, YB, X1 - X0 + 8, 4);
      }

      // --- ヒーター（冷却器） ---
      if (envMode === 'insulated') {
        const col = heater === 'heat' ? '#fb923c' : heater === 'cool' ? '#38bdf8' : '#64748b';
        ctx.save();
        if (heater) { ctx.shadowColor = col; ctx.shadowBlur = 14; }
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const yy = YB - 7;
        for (let i = 0; i <= 12; i++) {
          const x = X0 + 10 + ((X1 - X0 - 20) * i) / 12;
          const y = yy + (i % 2 === 0 ? -4 : 4);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ヒーター（冷却器）', (X0 + X1) / 2, YB + 28);
      }

      // --- 分子 ---
      ctx.save();
      ctx.beginPath();
      ctx.rect(X0, yTop, X1 - X0, YB - yTop);
      ctx.clip();
      if (s) {
        const sx = (X1 - X0) / SIM_W;
        const sy = PX_PER_V / H_PER_V;
        for (const p of s.particles) {
          const ke = 0.5 * (p.vx * p.vx + p.vy * p.vy);
          ctx.fillStyle = tempColor(ke / KE0, 0.95);
          ctx.beginPath();
          ctx.arc(X0 + p.x * sx, YB - p.y * sy, 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const speed = 55 * Math.sqrt(Math.max(Tnow, 0.05));
        const r = 3.5;
        ctx.fillStyle = tempColor(Tnow, 0.95);
        for (const p of particlesRef.current) {
          p.x += p.dx * p.s * speed * dt;
          p.y += p.dy * p.s * speed * dt;
          if (p.x < X0 + r) { p.x = X0 + r; p.dx = Math.abs(p.dx); }
          if (p.x > X1 - r) { p.x = X1 - r; p.dx = -Math.abs(p.dx); }
          if (p.y > YB - r) { p.y = YB - r; p.dy = -Math.abs(p.dy); }
          if (p.y < yTop + r) { p.y = yTop + r; p.dy = Math.abs(p.dy); }
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // --- ピストン ---
      const pg = ctx.createLinearGradient(0, yTop - PISTON_T, 0, yTop);
      pg.addColorStop(0, '#cbd5e1');
      pg.addColorStop(0.5, '#f1f5f9');
      pg.addColorStop(1, '#64748b');
      ctx.fillStyle = pg;
      ctx.fillRect(X0, yTop - PISTON_T, X1 - X0, PISTON_T);
      const cx = (X0 + X1) / 2;

      if (pistonMode === 'fixed') {
        ctx.fillStyle = '#ef4444';
        for (const x of [X0, X1 - 8]) {
          ctx.fillRect(x, yTop - PISTON_T - 7, 8, 7);
          ctx.fillRect(x, yTop, 8, 6);
        }
        ctx.fillStyle = '#fca5a5';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒 ストッパーで固定', cx, yTop - PISTON_T - 12);
      } else if (pistonMode === 'hand') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx - 3, 34, 6, yTop - PISTON_T - 34);
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✋', cx, 34);
        const moving = s ? s.handTarget !== null : evOn && evAge < 900 && ['push', 'pull'].includes(PROCESS_INFO[ev.processId]?.op);
        if (moving) {
          const down = s ? s.handTarget < s.H : PROCESS_INFO[ev.processId].op === 'push';
          const ax = cx - 34;
          if (down) drawArrow(ctx, ax, yTop - 60, ax, yTop - 22, '#e2e8f0', 3, 9);
          else drawArrow(ctx, ax, yTop - 22, ax, yTop - 60, '#e2e8f0', 3, 9);
        }
      } else {
        // おもり：自由にした時点の気体の圧力とつり合う重さ（外圧が大きいほど高く描く）
        const Pext = s ? ParticleSim.toPrel(s.Pext) : pr.T / pr.V;
        const wh = Math.max(14, Math.min(44, 10 + 10 * Pext));
        const wy = yTop - PISTON_T - wh;
        ctx.fillStyle = '#475569';
        ctx.fillRect(cx - 36, wy, 72, wh);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 36, wy, 72, wh);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('おもり', cx, wy + wh / 2);
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px sans-serif';
        ctx.fillText(`外圧 ${Pext.toFixed(2)}×10⁵ Pa（一定）`, cx, wy - 6);
      }

      // --- 状態の文字 ---
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`V = ${Vd.toFixed(2)} L`, 8, 18);
      ctx.fillStyle = tempColor(Tnow, 1);
      ctx.fillText(`T = ${Math.round(Tnow * T0_K)} K`, 8, 36);
      const Pnow = s ? ParticleSim.toPrel(s.Pmeas) : (pr.T / pr.V);
      ctx.fillStyle = '#fda4af';
      ctx.fillText(`P = ${Pnow.toFixed(2)}×10⁵ Pa`, 8, 54);

      // --- Q・W の矢印（理想モデル、操作直後） ---
      if (evOn) {
        const alpha = evAge < ANNOT_MS - 400 ? 1 : (ANNOT_MS - evAge) / 400;
        ctx.globalAlpha = Math.max(0, alpha);
        const Q = ev.Q * J_PER_UNIT;
        if (Math.abs(Q) > 0.05) {
          const col = Q > 0 ? '#fb923c' : '#38bdf8';
          ctx.fillStyle = col;
          ctx.font = 'bold 13px sans-serif';
          if (envMode === 'bath') {
            const y = YB - 40;
            if (Q > 0) drawArrow(ctx, 30, y, X0 - 8, y, col, 4, 12);
            else drawArrow(ctx, X0 - 8, y, 30, y, col, 4, 12);
            ctx.textAlign = 'left';
            ctx.fillText(`Q ${fmtJ(ev.Q)}`, 26, y - 10);
          } else {
            const x = X0 + 18;
            if (Q > 0) drawArrow(ctx, x, LH - 4, x, YB + 16, col, 4, 12);
            else drawArrow(ctx, x, YB + 16, x, LH - 4, col, 4, 12);
            ctx.textAlign = 'left';
            ctx.fillText(`Q ${fmtJ(ev.Q)}`, x + 12, LH - 10);
          }
        }
        const W = ev.W * J_PER_UNIT;
        if (Math.abs(W) > 0.05) {
          const col = W > 0 ? '#34d399' : '#c084fc';
          const x = X1 + 26;
          if (W > 0) drawArrow(ctx, x, yTop - 58, x, yTop - 6, col, 4, 12);
          else drawArrow(ctx, x, yTop - 6, x, yTop - 58, col, 4, 12);
          ctx.fillStyle = col;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(W > 0 ? 'された仕事' : 'した仕事', X1 + 18, yTop - 76);
          ctx.fillText(W > 0 ? `W ${fmtJ(ev.W)}` : `W′ ${fmtJ(-ev.W)}`, X1 + 18, yTop - 62);
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, getCtx]);

  return (
    <div ref={wrapRef} className={wrapClass}>
      <canvas ref={canvasRef} className={canvasClass} aria-label="シリンダーとピストンの装置図" />
    </div>
  );
}
