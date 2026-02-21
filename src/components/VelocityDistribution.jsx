// ====================================================
// VelocityDistribution: Maxwell-Boltzmann 速度分布ヒストグラム
// Textbook/Practice: 理論分布ベース
// Reality: 粒子の実測ヒストグラム
// ====================================================

import React, { useRef, useEffect, useCallback } from 'react';
import { maxwellBoltzmannDistribution } from '../utils/physics';

const CANVAS_WIDTH = 340;
const CANVAS_HEIGHT = 180;
const MARGIN = { top: 25, right: 15, bottom: 35, left: 40 };
const PLOT_W = CANVAS_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = CANVAS_HEIGHT - MARGIN.top - MARGIN.bottom;

export default function VelocityDistribution({
    T_rel = 1.0,
    mode = 'ideal', // 'ideal' | 'reality'
    realityHistogram = null,
    title = '速度分布',
}) {
    const canvasRef = useRef(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // --- 背景 ---
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // --- プロットエリア ---
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        ctx.fillRect(MARGIN.left, MARGIN.top, PLOT_W, PLOT_H);

        // --- データ取得 ---
        let bins, dv, vMax;

        if (mode === 'reality' && realityHistogram && realityHistogram.length > 0) {
            // Realityモード：実測ヒストグラム
            bins = realityHistogram;
            vMax = bins.length > 0 ? bins[bins.length - 1].vCenter * 1.5 : 5;
            dv = vMax / bins.length;

            // 正規化
            const maxVal = Math.max(...bins.map(b => b.value), 0.001);
            bins = bins.map(b => ({ ...b, value: b.value / maxVal }));
        } else {
            // 理想モード：理論分布
            const dist = maxwellBoltzmannDistribution(T_rel, 20, 5.0);
            bins = dist.bins;
            dv = dist.dv;
            vMax = dist.vMax;
        }

        if (!bins || bins.length === 0) return;

        // --- ヒストグラム描画 ---
        const barWidth = PLOT_W / bins.length;

        for (let i = 0; i < bins.length; i++) {
            const barH = bins[i].value * PLOT_H * 0.9;
            const x = MARGIN.left + i * barWidth;
            const y = MARGIN.top + PLOT_H - barH;

            // バーのグラデーション
            const grad = ctx.createLinearGradient(x, y, x, MARGIN.top + PLOT_H);
            if (mode === 'reality') {
                grad.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
                grad.addColorStop(1, 'rgba(16, 185, 129, 0.4)');
            } else {
                grad.addColorStop(0, 'rgba(59, 130, 246, 0.9)');
                grad.addColorStop(1, 'rgba(59, 130, 246, 0.4)');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(x + 1, y, barWidth - 2, barH);

            // バー枠
            ctx.strokeStyle = mode === 'reality'
                ? 'rgba(16, 185, 129, 0.6)'
                : 'rgba(59, 130, 246, 0.6)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 1, y, barWidth - 2, barH);
        }

        // --- 理想モードの場合、異なる温度の分布を薄く表示 ---
        if (mode === 'ideal') {
            const refTemps = [0.5, 1.5];
            const refColors = ['rgba(147, 197, 253, 0.2)', 'rgba(252, 165, 165, 0.2)'];

            for (let t = 0; t < refTemps.length; t++) {
                if (Math.abs(refTemps[t] - T_rel) < 0.05) continue;
                const refDist = maxwellBoltzmannDistribution(refTemps[t], 20, 5.0);
                ctx.strokeStyle = refColors[t];
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                ctx.beginPath();
                for (let i = 0; i < refDist.bins.length; i++) {
                    const x = MARGIN.left + (i + 0.5) * barWidth;
                    const y = MARGIN.top + PLOT_H - refDist.bins[i].value * PLOT_H * 0.9;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // --- 軸 ---
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        // X軸
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, MARGIN.top + PLOT_H);
        ctx.lineTo(MARGIN.left + PLOT_W, MARGIN.top + PLOT_H);
        ctx.stroke();
        // Y軸
        ctx.beginPath();
        ctx.moveTo(MARGIN.left, MARGIN.top);
        ctx.lineTo(MARGIN.left, MARGIN.top + PLOT_H);
        ctx.stroke();

        // --- 軸ラベル ---
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('速さ v', MARGIN.left + PLOT_W / 2, CANVAS_HEIGHT - 5);

        ctx.save();
        ctx.translate(12, MARGIN.top + PLOT_H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('f(v)', 0, 0);
        ctx.restore();

        // --- X軸目盛り ---
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
            const v = (vMax / tickCount) * i;
            const x = MARGIN.left + (i / tickCount) * PLOT_W;
            ctx.fillText(v.toFixed(1), x, MARGIN.top + PLOT_H + 13);
        }

        // --- タイトル ---
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, CANVAS_WIDTH / 2, 16);

        // --- 温度表示 ---
        ctx.fillStyle = '#f59e0b';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`T = ${T_rel.toFixed(2)} T₀`, CANVAS_WIDTH - MARGIN.right - 5, MARGIN.top + 15);
    }, [T_rel, mode, realityHistogram, title]);

    useEffect(() => {
        draw();
    }, [draw]);

    return (
        <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="rounded-lg"
            style={{ background: '#0f172a' }}
        />
    );
}
