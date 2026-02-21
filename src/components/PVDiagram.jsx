// ====================================================
// PVDiagram: PV線図コンポーネント
// Canvas API でPV図を描画（等温線・断熱線の参考曲線あり）
// ====================================================

import React, { useRef, useEffect, useCallback } from 'react';
import { calcPressure, V_MIN, V_MAX, getProcessType } from '../utils/physics';

const CANVAS_WIDTH = 340;
const CANVAS_HEIGHT = 280;
const MARGIN = { top: 25, right: 15, bottom: 40, left: 45 };
const PLOT_W = CANVAS_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = CANVAS_HEIGHT - MARGIN.top - MARGIN.bottom;

// --- 過程ごとの軌跡色 ---
const PROCESS_COLORS = {
    isochoric: '#ef4444',  // 定積: 赤
    isothermal: '#3b82f6', // 等温: 青
    adiabatic: '#8b5cf6',  // 断熱: 紫
    isobaric: '#10b981',   // 定圧: 緑
    composite: '#f59e0b',  // 複合: 黄
};

export default function PVDiagram({
    pvTrace = [],
    currentState = null,
    targetPath = null,   // Practice用：背景パス
    showIsotherms = true,
    title = 'PV 線図',
}) {
    const canvasRef = useRef(null);
    const [zoomLevel, setZoomLevel] = React.useState(1.0);
    const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const handleZoomIn = () => setZoomLevel(z => Math.min(z + 0.5, 3.0));
    const handleZoomOut = () => setZoomLevel(z => Math.max(z - 0.5, 1.0));

    // ドラッグイベントハンドラ
    const handleMouseDown = (e) => {
        isDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setPanOffset(prev => ({
            x: prev.x + dx,
            y: prev.y + dy
        }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const draw = useCallback(() => {
        const vMax = 0.3 + 1.9 / zoomLevel;
        const pMax = 4.0 / zoomLevel;
        const vMin = 0.3;
        const pMin = 0;

        const baseToPixelX = (V_rel) => {
            return MARGIN.left + ((V_rel - vMin) / (vMax - vMin)) * PLOT_W;
        };
        const baseToPixelY = (P_rel) => {
            return MARGIN.top + PLOT_H - ((P_rel - pMin) / (pMax - pMin)) * PLOT_H;
        };

        // パンを適用した座標変換
        const toPixelX = (V_rel) => baseToPixelX(V_rel) + panOffset.x;
        const toPixelY = (P_rel) => baseToPixelY(P_rel) + panOffset.y;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // --- 背景 ---
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // --- プロットエリア背景 ---
        ctx.save(); // クリップ用のsave
        ctx.beginPath();
        ctx.rect(MARGIN.left, MARGIN.top, PLOT_W, PLOT_H);
        ctx.clip(); // これ以降の描画をプロット枠内に制限

        const areaGrad = ctx.createLinearGradient(MARGIN.left, MARGIN.top, MARGIN.left, MARGIN.top + PLOT_H);
        areaGrad.addColorStop(0, 'rgba(30, 41, 59, 0.8)');
        areaGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
        ctx.fillStyle = areaGrad;
        // 背景はクリップ領域全体を塗るためにパンオフセットを無効化して塗る
        ctx.fillRect(MARGIN.left, MARGIN.top, PLOT_W, PLOT_H);

        // --- グリッド ---
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
        ctx.lineWidth = 0.5;

        // 縦グリッド
        for (let v = 0.4; v <= 2.0; v += 0.2) {
            const x = toPixelX(v);
            ctx.beginPath();
            ctx.moveTo(x, MARGIN.top);
            ctx.lineTo(x, MARGIN.top + PLOT_H);
            ctx.stroke();
        }

        // 横グリッド
        for (let p = -1.0; p <= 6.0; p += 0.5) { // パンに対応して範囲広め
            const y = toPixelY(p);
            ctx.beginPath();
            ctx.moveTo(MARGIN.left, y);
            ctx.lineTo(MARGIN.left + PLOT_W, y);
            ctx.stroke();
        }

        // --- 等温線（参考、薄く表示） ---
        if (showIsotherms) {
            const isotherms = [0.5, 1.0, 1.5, 2.0];
            for (const T of isotherms) {
                ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                let started = false;
                for (let v = vMin; v <= vMax; v += 0.02) {
                    const p = calcPressure(T, v);
                    if (p < pMin || p > pMax) continue;
                    const x = toPixelX(v);
                    const y = toPixelY(p);
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                ctx.setLineDash([]);

                // 等温線ラベル
                const labelV = vMax - 0.05;
                const labelP = calcPressure(T, labelV);
                if (labelP > pMin && labelP < pMax) {
                    ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
                    ctx.font = '9px "Noto Sans JP", sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(`T=${T.toFixed(1)}`, toPixelX(labelV) - 2, toPixelY(labelP) - 4);
                }
            }
        }

        // --- 目標パス（Practice用） ---
        if (targetPath && targetPath.length > 1) {
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.35)';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(toPixelX(targetPath[0].V_rel), toPixelY(targetPath[0].P_rel));
            for (let i = 1; i < targetPath.length; i++) {
                ctx.lineTo(toPixelX(targetPath[i].V_rel), toPixelY(targetPath[i].P_rel));
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // 目標パスのノード
            for (let i = 0; i < targetPath.length; i++) {
                ctx.beginPath();
                ctx.arc(toPixelX(targetPath[i].V_rel), toPixelY(targetPath[i].P_rel), 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(248, 113, 113, 0.3)';
                ctx.fill();
            }
        }

        // --- PV軌跡描画 ---
        if (pvTrace.length > 1) {
            for (let i = 1; i < pvTrace.length; i++) {
                const prev = pvTrace[i - 1];
                const curr = pvTrace[i];
                const processType = getProcessType(curr.action);
                const color = PROCESS_COLORS[processType] || '#94a3b8';

                // 等温過程は曲線で描画
                if (processType === 'isothermal') {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2.5;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    const T = curr.T_rel || prev.T_rel;
                    const vStart = prev.V_rel;
                    const vEnd = curr.V_rel;
                    const steps = 30;
                    for (let s = 0; s <= steps; s++) {
                        const v = vStart + (vEnd - vStart) * (s / steps);
                        const p = calcPressure(T, v);
                        const x = toPixelX(v);
                        const y = toPixelY(p);
                        if (s === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
                // 断熱過程も曲線で描画
                else if (processType === 'adiabatic') {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2.5;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    const vStart = prev.V_rel;
                    const vEnd = curr.V_rel;
                    const Tstart = prev.T_rel;
                    const gamma = 5 / 3;
                    const steps = 30;
                    for (let s = 0; s <= steps; s++) {
                        const v = vStart + (vEnd - vStart) * (s / steps);
                        const t = Tstart * Math.pow(vStart / v, gamma - 1);
                        const p = calcPressure(t, v);
                        const x = toPixelX(v);
                        const y = toPixelY(p);
                        if (s === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
                // その他は直線
                else {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2.5;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    ctx.moveTo(toPixelX(prev.V_rel), toPixelY(prev.P_rel));
                    ctx.lineTo(toPixelX(curr.V_rel), toPixelY(curr.P_rel));
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }

            // --- 軌跡ノード（小円） ---
            for (let i = 0; i < pvTrace.length; i++) {
                const pt = pvTrace[i];
                const isFirst = i === 0;
                const isLast = i === pvTrace.length - 1;

                ctx.beginPath();
                ctx.arc(toPixelX(pt.V_rel), toPixelY(pt.P_rel), isFirst || isLast ? 5 : 3, 0, Math.PI * 2);

                if (isFirst) {
                    ctx.fillStyle = '#10b981';
                } else if (isLast) {
                    ctx.fillStyle = '#f59e0b';
                    ctx.shadowColor = '#f59e0b';
                    ctx.shadowBlur = 10;
                } else {
                    ctx.fillStyle = '#94a3b8';
                }
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // --- 現在位置マーカー ---
        if (currentState) {
            const cx = toPixelX(currentState.V_rel);
            const cy = toPixelY(currentState.P_rel);

            // パルスグロー
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore(); // クリップ解除

        // --- 軸・軸ラベル・目盛り（クリップ外なので固定表示される）---

        // 軸の背景を黒塗りしてパンではみ出た部分を隠す（左・下）
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, MARGIN.left, CANVAS_HEIGHT);
        ctx.fillRect(0, MARGIN.top + PLOT_H, CANVAS_WIDTH, MARGIN.bottom);
        ctx.fillRect(MARGIN.left + PLOT_W, 0, MARGIN.right, CANVAS_HEIGHT);
        ctx.fillRect(0, 0, CANVAS_WIDTH, MARGIN.top);

        // --- 軸ラベル ---
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px "Noto Sans JP", sans-serif';

        // X軸ラベル
        ctx.textAlign = 'center';
        ctx.fillText('V (V₀)', MARGIN.left + PLOT_W / 2, CANVAS_HEIGHT - 5);

        // Y軸ラベル
        ctx.save();
        ctx.translate(14, MARGIN.top + PLOT_H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('P (P₀)', 0, 0);
        ctx.restore();

        // --- 軸目盛り ---
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "JetBrains Mono", monospace';

        // X軸目盛り
        ctx.textAlign = 'center';
        for (let v = 0.4; v <= 2.0; v += 0.4) {
            ctx.fillText(v.toFixed(1), toPixelX(v), MARGIN.top + PLOT_H + 15);
        }

        // Y軸目盛り
        ctx.textAlign = 'right';
        for (let p = 0.5; p <= 3.5; p += 0.5) {
            ctx.fillText(p.toFixed(1), MARGIN.left - 8, toPixelY(p) + 4);
        }

        // --- タイトル ---
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 13px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, CANVAS_WIDTH / 2, 16);

        // --- 凡例 ---
        const legendItems = [
            { label: '定積', color: PROCESS_COLORS.isochoric },
            { label: '等温', color: PROCESS_COLORS.isothermal },
            { label: '断熱', color: PROCESS_COLORS.adiabatic },
            { label: '定圧', color: PROCESS_COLORS.isobaric },
            { label: '複合', color: PROCESS_COLORS.composite },
        ];
        const legendStartX = MARGIN.left + 5;
        const legendY = MARGIN.top + 12;
        ctx.font = '9px "Noto Sans JP", sans-serif';
        let lx = legendStartX;
        for (const item of legendItems) {
            ctx.fillStyle = item.color;
            ctx.fillRect(lx, legendY - 6, 12, 3);
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, lx + 14, legendY);
            lx += 46;
        }
    }, [pvTrace, currentState, targetPath, showIsotherms, title, zoomLevel, panOffset]);

    useEffect(() => {
        draw();
    }, [draw]);

    return (
        <div className="relative inline-block">
            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="rounded-lg cursor-grab active:cursor-grabbing"
                style={{ background: '#0f172a' }}
            />
            {/* ズームコントロール */}
            <div className="absolute top-3 right-3 flex flex-col gap-1 bg-surface-800/80 backdrop-blur-sm p-1 rounded-md border border-slate-600/30">
                <button
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 3.0}
                    className="w-6 h-6 flex items-center justify-center text-slate-300 bg-surface-700/60 hover:bg-surface-600 rounded text-xs disabled:opacity-30 transition-colors"
                >
                    ＋
                </button>
                <div className="text-[9px] text-center font-mono text-slate-400">x{zoomLevel.toFixed(1)}</div>
                <button
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 1.0}
                    className="w-6 h-6 flex items-center justify-center text-slate-300 bg-surface-700/60 hover:bg-surface-600 rounded text-xs disabled:opacity-30 transition-colors"
                >
                    ー
                </button>
            </div>
        </div>
    );
}
