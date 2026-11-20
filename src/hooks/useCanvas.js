// ====================================================
// 親要素の幅に合わせ、高解像度（devicePixelRatio）で描く Canvas
// ====================================================
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {(w:number)=>number} heightOf 幅から高さを決める関数
 * @param {number} maxW 最大幅 [CSS px]
 */
export function useCanvas(heightOf, maxW = 720) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = (w) => setWidth(Math.max(220, Math.floor(Math.min(maxW, w))));
    update(el.clientWidth);
    const ro = new ResizeObserver((entries) => update(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxW]);

  const height = width ? Math.round(heightOf(width)) : 0;

  /** 論理座標（CSS px）で描ける 2D コンテキストを返す */
  const getCtx = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !width) return null;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
    }
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }, [width, height]);

  return { wrapRef, canvasRef, width, height, getCtx };
}

/** Canvas 用の矢印 */
export function drawArrow(ctx, x1, y1, x2, y2, color, width = 3, head = 10) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(ang) * head * 0.6, y2 - Math.sin(ang) * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
  ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 温度（相対）→ 粒子の色（低温: 青 → 高温: 赤） */
export function tempColor(T, alpha = 1) {
  const t = Math.min(Math.max((T - 0.4) / 1.8, 0), 1);
  const r = Math.round(90 + 165 * t);
  const g = Math.round(170 - 60 * t + 40 * Math.sin(Math.PI * t));
  const b = Math.round(255 - 205 * t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
