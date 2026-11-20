// ====================================================
// 親要素に合わせ、高解像度（devicePixelRatio）で描く Canvas
//  - 通常：親の幅に合わせ、高さは heightOf(幅) で決める
//  - fit 指定 + 横幅 1024px 以上：親要素の箱（幅・高さ）に収まるように描く
// ====================================================
import { useCallback, useEffect, useRef, useState } from 'react';

/** メディアクエリが当てはまるか */
export function useMedia(query) {
  const [hit, setHit] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const f = () => setHit(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return hit;
}

/** PC 向け（幅 1024px 以上）かどうか */
export const useIsWide = () => useMedia('(min-width: 1024px)');

/**
 * 画面の使い方
 *  wide      : PC（幅 1024px 以上）… 装置・PV図・右パネルを並べる
 *  landscape : スマホ横向き（高さが低い）… 左に図、右に操作
 *  compact   : スマホ縦向き・タブレット縦向き … 上に図（タブ切り替え）、下に操作
 */
export function useLayoutMode() {
  const wide = useIsWide();
  const landscape = useMedia('(max-height: 520px) and (orientation: landscape)');
  if (wide && !landscape) return 'wide';
  return landscape ? 'landscape' : 'compact';
}

/**
 * @param {(w:number)=>number} heightOf 幅から高さを決める関数（通常時）
 * @param {number} maxW 最大幅 [CSS px]（通常時）
 * @param {null|{aspect?:number}} fit 親の箱（幅・高さ）に収めるか（aspect = 幅/高さ を保つ）
 */
export function useCanvas(heightOf, maxW = 720, fit = null) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const fitting = !!fit;
  const aspect = fit?.aspect ?? null;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let width = 0;
  let height = 0;
  if (box.w > 0) {
    if (fitting) {
      if (box.h < 20) {
        // まだ高さが決まっていない（描かない）
      } else if (aspect) {
        width = Math.floor(Math.min(box.w, box.h * aspect));
        height = Math.floor(width / aspect);
      } else {
        width = box.w;
        height = box.h;
      }
    } else {
      width = Math.max(220, Math.floor(Math.min(maxW, box.w)));
      height = Math.round(heightOf(width));
    }
  }

  /** 論理座標（CSS px）で描ける 2D コンテキストを返す */
  const getCtx = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !width || !height) return null;
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

  /** 親要素・canvas に付けるクラス（fit 時は canvas を親の中央に絶対配置） */
  const wrapClass = fitting ? 'relative flex-1 min-h-0 w-full' : 'w-full flex justify-center';
  const canvasClass = fitting ? 'absolute inset-0 m-auto' : '';

  return { wrapRef, canvasRef, width, height, getCtx, fitting, wrapClass, canvasClass };
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
