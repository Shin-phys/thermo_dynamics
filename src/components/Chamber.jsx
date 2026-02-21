// ====================================================
// Chamber: 気体分子チャンバー表示コンポーネント
// Canvas API で粒子とピストンを描画
// ====================================================

import React, { useRef, useEffect, useCallback } from 'react';

// --- 描画定数 ---
const CANVAS_WIDTH = 220;
const CANVAS_HEIGHT = 320;
const CHAMBER_LEFT = 20;
const CHAMBER_RIGHT = 200;
const CHAMBER_BOTTOM = 300;
const CHAMBER_WIDTH = CHAMBER_RIGHT - CHAMBER_LEFT;
const MAX_PISTON_RANGE = 260; // ピストン移動範囲のピクセル高さ

// --- 粒子色テーブル（温度で変化） ---
function getParticleColor(T_rel) {
    // 低温:青→中温:白→高温:赤橙
    const t = Math.min(Math.max((T_rel - 0.5) / 1.5, 0), 1);
    const r = Math.round(100 + 155 * t);
    const g = Math.round(180 - 80 * t);
    const b = Math.round(255 - 200 * t);
    return `rgb(${r}, ${g}, ${b})`;
}

// --- 粒子のグロー色 ---
function getGlowColor(T_rel) {
    const t = Math.min(Math.max((T_rel - 0.5) / 1.5, 0), 1);
    const r = Math.round(100 + 155 * t);
    const g = Math.round(180 - 80 * t);
    const b = Math.round(255 - 200 * t);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
}

export default function Chamber({
    V_rel,
    T_rel,
    mode = 'ideal', // 'ideal' | 'reality'
    realityParticles = null, // reality モード用の粒子配列
    realityChamberHeight = null,
}) {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const animFrameRef = useRef(null);

    // --- 理想モデル用粒子の初期化 ---
    useEffect(() => {
        if (mode === 'reality') return;

        const count = 20;
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (0.5 + Math.random()) * 2;
            particles.push({
                x: CHAMBER_LEFT + Math.random() * CHAMBER_WIDTH,
                y: 0, // 初期化後に設定
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 3 + Math.random() * 2,
            });
        }
        particlesRef.current = particles;
    }, [mode]);

    // --- 描画関数 ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // ピストン位置の計算
        const pistonRange = MAX_PISTON_RANGE;
        // V_rel=0 → ピストン最下、V_rel=2.0 → ピストン最上
        const normalizedV = (V_rel - 0.4) / (2.0 - 0.4);
        const pistonY = CHAMBER_BOTTOM - normalizedV * pistonRange;
        const chamberTopY = Math.max(pistonY, CHAMBER_BOTTOM - pistonRange);

        // キャンバスクリア
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // --- チャンバー背景（グラデーション） ---
        const bgGrad = ctx.createLinearGradient(0, chamberTopY, 0, CHAMBER_BOTTOM);
        bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
        bgGrad.addColorStop(1, 'rgba(30, 41, 59, 0.9)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(CHAMBER_LEFT, chamberTopY, CHAMBER_WIDTH, CHAMBER_BOTTOM - chamberTopY);

        // --- チャンバー壁（ネオングロー） ---
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 8;
        // 左壁
        ctx.beginPath();
        ctx.moveTo(CHAMBER_LEFT, chamberTopY);
        ctx.lineTo(CHAMBER_LEFT, CHAMBER_BOTTOM);
        ctx.stroke();
        // 右壁
        ctx.beginPath();
        ctx.moveTo(CHAMBER_RIGHT, chamberTopY);
        ctx.lineTo(CHAMBER_RIGHT, CHAMBER_BOTTOM);
        ctx.stroke();
        // 下壁
        ctx.beginPath();
        ctx.moveTo(CHAMBER_LEFT, CHAMBER_BOTTOM);
        ctx.lineTo(CHAMBER_RIGHT, CHAMBER_BOTTOM);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // --- ピストン（メタリック風グラデーション） ---
        const pistonH = 12;
        const pistonGrad = ctx.createLinearGradient(0, chamberTopY - pistonH, 0, chamberTopY);
        pistonGrad.addColorStop(0, '#94a3b8');
        pistonGrad.addColorStop(0.3, '#e2e8f0');
        pistonGrad.addColorStop(0.5, '#f8fafc');
        pistonGrad.addColorStop(0.7, '#e2e8f0');
        pistonGrad.addColorStop(1, '#64748b');
        ctx.fillStyle = pistonGrad;
        ctx.fillRect(CHAMBER_LEFT - 5, chamberTopY - pistonH, CHAMBER_WIDTH + 10, pistonH);

        // ピストンのハイライト
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(CHAMBER_LEFT - 5, chamberTopY - pistonH, CHAMBER_WIDTH + 10, pistonH);

        // ピストンハンドル
        ctx.fillStyle = '#475569';
        ctx.fillRect(CHAMBER_LEFT + CHAMBER_WIDTH / 2 - 4, chamberTopY - pistonH - 20, 8, 20);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(CHAMBER_LEFT + CHAMBER_WIDTH / 2 - 8, chamberTopY - pistonH - 24, 16, 6);

        // --- 粒子描画 ---
        const particleColor = getParticleColor(T_rel);
        const glowColor = getGlowColor(T_rel);

        if (mode === 'reality' && realityParticles) {
            // Realityモード：実際の粒子位置を描画
            const scale = (CHAMBER_BOTTOM - chamberTopY) / (realityChamberHeight || 300);
            for (const p of realityParticles) {
                const px = CHAMBER_LEFT + (p.x / 300) * CHAMBER_WIDTH;
                const py = CHAMBER_BOTTOM - p.y * scale;
                if (py >= chamberTopY && py <= CHAMBER_BOTTOM) {
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fillStyle = particleColor;
                    ctx.fill();

                    // グロー効果
                    ctx.beginPath();
                    ctx.arc(px, py, 6, 0, Math.PI * 2);
                    ctx.fillStyle = glowColor;
                    ctx.fill();
                }
            }
        } else {
            // 理想モード：見本粒子の更新と描画
            const speedScale = Math.sqrt(Math.max(T_rel, 0.1)) * 2;
            const chamberH = CHAMBER_BOTTOM - chamberTopY;

            for (const p of particlesRef.current) {
                // 位置更新
                p.x += p.vx * speedScale;
                p.y += p.vy * speedScale;

                // 壁反射
                if (p.x - p.radius < CHAMBER_LEFT) {
                    p.x = CHAMBER_LEFT + p.radius;
                    p.vx = Math.abs(p.vx);
                }
                if (p.x + p.radius > CHAMBER_RIGHT) {
                    p.x = CHAMBER_RIGHT - p.radius;
                    p.vx = -Math.abs(p.vx);
                }
                if (p.y + p.radius > CHAMBER_BOTTOM) {
                    p.y = CHAMBER_BOTTOM - p.radius;
                    p.vy = -Math.abs(p.vy);
                }
                if (p.y - p.radius < chamberTopY) {
                    p.y = chamberTopY + p.radius;
                    p.vy = Math.abs(p.vy);
                }

                // 粒子描画
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = particleColor;
                ctx.fill();

                // グロー
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
                ctx.fillStyle = glowColor;
                ctx.fill();
            }
        }

        // --- 温度ラベル ---
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`V = ${(V_rel).toFixed(2)} V₀`, CHAMBER_LEFT + CHAMBER_WIDTH / 2, CHAMBER_BOTTOM + 15);

        animFrameRef.current = requestAnimationFrame(draw);
    }, [V_rel, T_rel, mode, realityParticles, realityChamberHeight]);

    // --- アニメーション開始/停止 ---
    useEffect(() => {
        animFrameRef.current = requestAnimationFrame(draw);
        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [draw]);

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="rounded-lg"
                style={{ background: 'transparent' }}
            />
        </div>
    );
}
