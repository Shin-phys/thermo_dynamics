// ====================================================
// PV図
//  - 軌跡（過程ごとに色分け、工程ごとに矢印）
//  - 直近の工程の下の面積 ＝ 仕事、閉じたサイクルの囲む面積 ＝ 正味の仕事
//  - 現在の点を通る等温線・断熱線（ガイド）
//  - 練習問題の目標経路（白い点線、頂点に A, B, C …）
//  - 粒子モデルの測定点
// ====================================================
import { useEffect, useState } from 'react';
import { useCanvas, drawArrow } from '../hooks/useCanvas.js';
import { FAMILIES, GAMMA, J_PER_UNIT, T0_K, sampleSegment, sameState } from '../physics/model.js';

const M = { l: 54, r: 16, t: 14, b: 46 };
const V_AXIS_MAX = 2.2;

function niceMax(p) {
  return Math.max(2.5, Math.ceil((p * 1.12) / 0.5) * 0.5);
}

function segPoints(seg) {
  const pts = sampleSegment(seg.from, seg.to, seg.family, 32);
  if (pts.length > 2) return pts;
  // 直線も点列にして、中点に矢印を置けるようにする
  return Array.from({ length: 33 }, (_, i) => ({
    V: seg.from.V + ((seg.to.V - seg.from.V) * i) / 32,
    P: seg.from.P + ((seg.to.P - seg.from.P) * i) / 32,
  }));
}

export default function PVDiagram({
  trace = [],            // [{from,to,family,W}]（同じ過程をまとめた工程）
  start = null,
  current = null,
  target = null,         // {segments:[{from,to,family}], closed}
  points = null,         // 粒子モデルの測定点 [{V,P}]
  isoScale = 1,          // 等温線の圧力倍率（粒子モデルで分子数に比例）
  showArea = true,
  title = 'PV図',
  guidesDefault = true,
}) {
  const [guides, setGuides] = useState(guidesDefault);
  const [zoom, setZoom] = useState(false);
  const { wrapRef, canvasRef, width, height, getCtx, fitting, wrapClass, canvasClass } = useCanvas(
    (w) => Math.min(460, Math.max(250, w * 0.7)), 760, {},
  );

  const closed = !!(start && current && trace.length >= 2 && sameState(start, current));

  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const W = width;
    const H = height;
    const pw = W - M.l - M.r;
    const ph = H - M.t - M.b;

    // 軸の範囲（通常は原点から。拡大表示では軌跡のまわりだけ）
    const box = { v0: Infinity, v1: -Infinity, p0: Infinity, p1: -Infinity };
    const consider = (s) => {
      if (!s) return;
      box.v0 = Math.min(box.v0, s.V); box.v1 = Math.max(box.v1, s.V);
      box.p0 = Math.min(box.p0, s.P); box.p1 = Math.max(box.p1, s.P);
    };
    trace.forEach((sg) => segPoints(sg).forEach(consider));
    target?.segments.forEach((sg) => segPoints(sg).forEach(consider));
    consider(current);
    consider(start);
    points?.forEach(consider);
    let vMin = 0; let vMax = V_AXIS_MAX; let pMin = 0; let pMax = niceMax(box.p1);
    if (zoom) {
      const padV = Math.max(0.1, (box.v1 - box.v0) * 0.15);
      const padP = Math.max(0.1, (box.p1 - box.p0) * 0.15);
      vMin = Math.max(0, Math.floor((box.v0 - padV) * 10) / 10);
      vMax = Math.ceil((box.v1 + padV) * 10) / 10;
      pMin = Math.max(0, Math.floor((box.p0 - padP) * 10) / 10);
      pMax = Math.ceil((box.p1 + padP) * 10) / 10;
    }

    const X = (V) => M.l + ((V - vMin) / (vMax - vMin)) * pw;
    const Y = (P) => M.t + ph - ((P - pMin) / (pMax - pMin)) * ph;
    const vSpan = vMax - vMin;
    const pSpan = pMax - pMin;
    const vTick = vSpan <= 0.8 ? 0.1 : 0.2;
    const pTick = pSpan <= 0.8 ? 0.1 : pSpan <= 1.6 ? 0.2 : pSpan > 6 ? 1 : 0.5;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1222';
    ctx.fillRect(0, 0, W, H);

    // --- グリッドと目盛り ---
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#94a3b8';
    // 方眼は 0.1 刻み（太線と数値は目盛り間隔ごと）
    for (let i = Math.ceil(vMin * 10 - 1e-9); i <= Math.floor(vMax * 10 + 1e-9); i++) {
      const v = i / 10;
      const major = Math.abs(v / vTick - Math.round(v / vTick)) < 1e-6;
      ctx.strokeStyle = major ? 'rgba(100,116,139,0.38)' : 'rgba(100,116,139,0.12)';
      ctx.beginPath(); ctx.moveTo(X(v), M.t); ctx.lineTo(X(v), M.t + ph); ctx.stroke();
      const labelEvery = vTick * (pw < 380 && vTick === 0.2 ? 2 : 1);
      if (Math.abs(v / labelEvery - Math.round(v / labelEvery)) < 1e-6) {
        ctx.textAlign = 'center'; ctx.fillText(v.toFixed(1), X(v), M.t + ph + 16);
      }
    }
    const pFine = pTick >= 0.5 ? 0.1 * (pTick >= 1 ? 2.5 : 1) : 0.1;
    for (let i = Math.ceil(pMin / pFine - 1e-9); i * pFine <= pMax + 1e-9; i++) {
      const p = i * pFine;
      const major = Math.abs(p / pTick - Math.round(p / pTick)) < 1e-6;
      ctx.strokeStyle = major ? 'rgba(100,116,139,0.38)' : 'rgba(100,116,139,0.10)';
      ctx.beginPath(); ctx.moveTo(M.l, Y(p)); ctx.lineTo(M.l + pw, Y(p)); ctx.stroke();
      if (major) { ctx.textAlign = 'right'; ctx.fillText(p.toFixed(pTick < 0.5 ? 2 : 1), M.l - 6, Y(p) + 4); }
    }
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, M.t + ph); ctx.lineTo(M.l + pw, M.t + ph); ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('体積 V〔L〕', M.l + pw / 2, H - 8);
    ctx.save();
    ctx.translate(15, M.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('圧力 P〔×10⁵ Pa〕', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(M.l, M.t, pw, ph);
    ctx.clip();

    // --- 背景の等温線 ---
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    for (const T of [0.5, 1, 1.5, 2, 3]) {
      ctx.strokeStyle = 'rgba(148,163,184,0.28)';
      ctx.beginPath();
      let started = false;
      let lastIn = null;
      for (let v = Math.max(0.15, vMin); v <= vMax; v += 0.005) {
        const p = (isoScale * T) / v;
        if (p > pMax * 1.05) continue;
        if (!started) { ctx.moveTo(X(v), Y(p)); started = true; } else ctx.lineTo(X(v), Y(p));
        lastIn = { v, p };
      }
      ctx.stroke();
      if (lastIn) {
        ctx.fillStyle = 'rgba(148,163,184,0.7)';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(T * T0_K)} K`, X(vMax) - 3, Y((isoScale * T) / vMax) - 4);
      }
    }
    ctx.setLineDash([]);

    // --- 現在の点を通る等温線・断熱線 ---
    if (guides && current && !points) {
      const T = current.P * current.V;
      const K = current.P * Math.pow(current.V, GAMMA);
      const curves = [
        { f: (v) => T / v, color: 'rgba(96,165,250,0.85)', label: '等温線' },
        { f: (v) => K / Math.pow(v, GAMMA), color: 'rgba(192,132,252,0.85)', label: '断熱線' },
      ];
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 1.5;
      for (const c of curves) {
        ctx.strokeStyle = c.color;
        ctx.beginPath();
        let started = false;
        for (let v = Math.max(0.2, vMin); v <= vMax; v += 0.005) {
          const p = c.f(v);
          if (p > pMax * 1.2) continue;
          if (!started) { ctx.moveTo(X(v), Y(p)); started = true; } else ctx.lineTo(X(v), Y(p));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // ラベル（現在の点の右側）
      const v1 = Math.min(vMax - 0.05, current.V + 0.2 * vSpan);
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = curves[0].color;
      ctx.fillText('等温線', X(v1) + 2, Y(curves[0].f(v1)) - 4);
      ctx.fillStyle = curves[1].color;
      ctx.fillText('断熱線', X(v1) + 2, Y(curves[1].f(v1)) + 14);
    }

    // --- 面積（仕事） ---
    if (showArea && closed) {
      const pts = trace.flatMap(segPoints);
      ctx.fillStyle = 'rgba(251,191,36,0.22)';
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.V), Y(p.P)) : ctx.moveTo(X(p.V), Y(p.P))));
      ctx.closePath();
      ctx.fill();
    } else if (showArea && trace.length && !zoom) {
      const last = trace[trace.length - 1];
      if (Math.abs(last.to.V - last.from.V) > 1e-9) {
        const pts = segPoints(last);
        const expand = last.to.V > last.from.V;
        ctx.fillStyle = expand ? 'rgba(192,132,252,0.22)' : 'rgba(52,211,153,0.22)';
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(X(p.V), Y(p.P)) : ctx.moveTo(X(p.V), Y(p.P))));
        ctx.lineTo(X(last.to.V), Y(0));
        ctx.lineTo(X(last.from.V), Y(0));
        ctx.closePath();
        ctx.fill();
        // 面積のラベル
        const midV = (last.from.V + last.to.V) / 2;
        const mid = pts[Math.floor(pts.length / 2)];
        const Wj = Math.abs(last.W * J_PER_UNIT);
        const text = expand ? `面積 = した仕事 W′ = ${Wj.toFixed(1)} J` : `面積 = された仕事 W = ${Wj.toFixed(1)} J`;
        ctx.font = 'bold 12px sans-serif';
        const tw = ctx.measureText(text).width;
        let tx = X(midV) - tw / 2;
        tx = Math.max(M.l + 4, Math.min(M.l + pw - tw - 4, tx));
        const ty = Math.min(Y(0) - 10, (Y(mid.P) + Y(0)) / 2 + 4);
        ctx.fillStyle = 'rgba(11,18,34,0.75)';
        ctx.fillRect(tx - 3, ty - 13, tw + 6, 18);
        ctx.fillStyle = expand ? '#e9d5ff' : '#a7f3d0';
        ctx.textAlign = 'left';
        ctx.fillText(text, tx, ty);
      }
    }

    // --- 練習問題の目標 ---
    if (target) {
      ctx.strokeStyle = 'rgba(241,245,249,0.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      for (const sg of target.segments) {
        const pts = segPoints(sg);
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(X(p.V), Y(p.P)) : ctx.moveTo(X(p.V), Y(p.P))));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const sg of target.segments) {
        const pts = segPoints(sg);
        const a = pts[Math.floor((pts.length - 1) / 2)];
        const b = pts[Math.floor((pts.length - 1) / 2) + 1];
        const ax = X(a.V); const ay = Y(a.P); const bx = X(b.V); const by = Y(b.P);
        const L = Math.hypot(bx - ax, by - ay) || 1;
        drawArrow(ctx, ax - ((bx - ax) / L) * 6, ay - ((by - ay) / L) * 6, ax + ((bx - ax) / L) * 8, ay + ((by - ay) / L) * 8, 'rgba(241,245,249,0.75)', 2, 10);
      }
      const verts = [target.segments[0].from, ...target.segments.map((s) => s.to)];
      ctx.font = 'bold 13px sans-serif';
      verts.forEach((v, i) => {
        if (target.closed && i === verts.length - 1) return;
        ctx.fillStyle = 'rgba(241,245,249,0.85)';
        ctx.beginPath(); ctx.arc(X(v.V), Y(v.P), 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'left';
        ctx.fillText(String.fromCharCode(65 + i), X(v.V) + 7, Y(v.P) - 7);
      });
    }

    // --- 軌跡 ---
    for (const sg of trace) {
      const color = FAMILIES[sg.family].color;
      const pts = segPoints(sg);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.V), Y(p.P)) : ctx.moveTo(X(p.V), Y(p.P))));
      ctx.stroke();
      const mi = Math.floor((pts.length - 1) / 2);
      const a = pts[mi]; const b = pts[mi + 1];
      const ax = X(a.V); const ay = Y(a.P); const bx = X(b.V); const by = Y(b.P);
      const L = Math.hypot(bx - ax, by - ay);
      if (L > 0.01) {
        drawArrow(ctx, ax - ((bx - ax) / L) * 6, ay - ((by - ay) / L) * 6, ax + ((bx - ax) / L) * 9, ay + ((by - ay) / L) * 9, color, 3, 11);
      }
    }
    for (const sg of trace) {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath(); ctx.arc(X(sg.to.V), Y(sg.to.P), 3, 0, Math.PI * 2); ctx.fill();
    }

    // --- 粒子モデルの測定点 ---
    if (points && points.length) {
      const n = points.length;
      points.forEach((p, i) => {
        ctx.fillStyle = `rgba(52,211,153,${0.15 + 0.75 * (i / n)})`;
        ctx.beginPath(); ctx.arc(X(p.V), Y(p.P), 2.2, 0, Math.PI * 2); ctx.fill();
      });
    }

    // --- 始点と現在の点 ---
    if (start && !points) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X(start.V), Y(start.P), 7, 0, Math.PI * 2); ctx.stroke();
    }
    if (current) {
      ctx.fillStyle = 'rgba(251,191,36,0.25)';
      ctx.beginPath(); ctx.arc(X(current.V), Y(current.P), 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(X(current.V), Y(current.P), 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // --- サイクルの面積ラベル（枠外にはみ出さないよう最後に） ---
    if (showArea && closed) {
      const pts = trace.flatMap(segPoints);
      const cxv = pts.reduce((a, p) => a + p.V, 0) / pts.length;
      const cyp = pts.reduce((a, p) => a + p.P, 0) / pts.length;
      const netW = -trace.reduce((a, s) => a + s.W, 0) * J_PER_UNIT;
      const text = `囲まれた面積 = 正味の仕事 ${netW >= 0 ? '' : '−'}${Math.abs(netW).toFixed(1)} J`;
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(text).width;
      const tx = Math.max(M.l + 4, Math.min(M.l + pw - tw - 4, X(cxv) - tw / 2));
      const ty = Y(cyp) + 4;
      ctx.fillStyle = 'rgba(11,18,34,0.8)';
      ctx.fillRect(tx - 3, ty - 13, tw + 6, 18);
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'left';
      ctx.fillText(text, tx, ty);
    }
  }, [width, height, getCtx, trace, start, current, target, points, isoScale, guides, showArea, closed, zoom]);

  const families = new Set(trace.map((s) => s.family));
  const help = points
    ? '点はピストンが受けた力積から測った圧力（新しい点ほど濃い）。点線は理想気体の等温線（分子数に比例してずれる）。'
    : '色つきの面積は直近の工程の仕事の大きさ（紫：気体が外へした仕事、緑：外からされた仕事）。元の状態に戻ると、サイクルが囲む面積（正味の仕事）を黄色で表示します。'
      + (zoom ? '拡大中は横軸が 0 から始まらないため、工程の下の面積は表示しません。' : '');

  return (
    <div className={fitting ? 'flex flex-col h-full min-h-0' : ''}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
        <h2 className="text-base font-bold text-slate-100 mr-auto">
          {title}
          <span className="ml-2 cursor-help text-sm font-normal text-slate-400" title={help}>ⓘ</span>
        </h2>
        {!points && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-slate-300">
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="accent-sky-500 w-4 h-4" />
            等温線・断熱線
          </label>
        )}
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-slate-300">
          <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} className="accent-sky-500 w-4 h-4" />
          拡大
        </label>
      </div>
      <div ref={wrapRef} className={wrapClass}>
        <canvas ref={canvasRef} className={`rounded-lg ${canvasClass}`} aria-label="PV図" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
        {!points && Object.entries(FAMILIES).map(([k, f]) => (
          <span key={k} className={`flex items-center gap-1 ${families.has(k) ? '' : 'opacity-50'}`}>
            <span className="inline-block w-4 h-1 rounded" style={{ background: f.color }} />{f.name}
          </span>
        ))}
        {target && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed border-slate-200" />目標の経路
          </span>
        )}
        {(points || !fitting) && <span className="text-slate-400 basis-full leading-relaxed">{help}</span>}
      </div>
    </div>
  );
}
