// ====================================================
// useRealityGasModel: 現実（粒子衝突ベース）モデル
// 粒子の運動と壁衝突から圧力を推定するモード
// ====================================================

import { useRef, useCallback, useState } from 'react';
import { calcPressure, C_CONST, GAMMA, V_MIN, V_MAX, DELTA_V, DELTA_T, T_MIN } from '../utils/physics';

// --- 定数 ---
const PARTICLE_MASS = 1.0;         // 粒子質量（相対）
const CHAMBER_WIDTH = 300;         // チャンバー幅（px）
const CHAMBER_BASE_HEIGHT = 300;   // チャンバー基準高さ（px）
const PRESSURE_SMOOTHING = 0.92;   // 圧力平滑化係数

// --- 粒子の初期化 ---
function createParticles(count, chamberHeight, T_rel) {
    const speed = Math.sqrt(T_rel) * 3; // 速さスケール
    const particles = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = (0.3 + Math.random() * 1.4) * speed;
        particles.push({
            x: Math.random() * CHAMBER_WIDTH,
            y: Math.random() * chamberHeight,
            vx: Math.cos(angle) * v,
            vy: Math.sin(angle) * v,
        });
    }
    return particles;
}

export function useRealityGasModel() {
    // 状態
    const [particleCount, setParticleCount] = useState(200);
    const [V_rel, setV_rel] = useState(1.0);
    const [T_rel_display, setT_rel_display] = useState(1000);
    const [P_estimated, setP_estimated] = useState(1.0);

    // 高頻度の状態はrefで管理
    const particlesRef = useRef(null);
    const impulseRef = useRef(0);
    const pressureRef = useRef(1.0);
    const frameCountRef = useRef(0);
    const V_relRef = useRef(1.0);
    const pistonVelocityRef = useRef(0);

    // PV軌跡
    const [pvTrace, setPvTrace] = useState([{ V_rel: 1.0, P_rel: 1.0 }]);

    // 速度ヒストグラムデータ
    const speedHistogramRef = useRef([]);

    // --- チャンバー高さ（V_relに比例） ---
    const getChamberHeight = useCallback((v) => {
        return v * CHAMBER_BASE_HEIGHT;
    }, []);

    // --- 粒子初期化 ---
    const initParticles = useCallback((count, v_rel) => {
        const h = getChamberHeight(v_rel);
        particlesRef.current = createParticles(count, h, 1.0);
        impulseRef.current = 0;
        pressureRef.current = 1.0;
        frameCountRef.current = 0;
        V_relRef.current = v_rel;
    }, [getChamberHeight]);

    // --- 物理ステップ（毎フレーム呼ぶ） ---
    const step = useCallback((dt) => {
        if (!particlesRef.current) return null;

        const particles = particlesRef.current;
        const chamberH = getChamberHeight(V_relRef.current);
        const pistonY = chamberH; // ピストンはチャンバー上端
        let impulseThisFrame = 0;

        // 各粒子を更新
        for (const p of particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // 左壁反射
            if (p.x < 0) {
                p.x = -p.x;
                p.vx = Math.abs(p.vx);
            }
            // 右壁反射
            if (p.x > CHAMBER_WIDTH) {
                p.x = 2 * CHAMBER_WIDTH - p.x;
                p.vx = -Math.abs(p.vx);
            }
            // 下壁反射
            if (p.y < 0) {
                p.y = -p.y;
                p.vy = Math.abs(p.vy);
            }
            // ピストン壁反射（上端）
            if (p.y > pistonY) {
                p.y = 2 * pistonY - p.y;
                // ピストン速度を考慮した反射
                const vPiston = pistonVelocityRef.current;
                const oldVy = p.vy;
                p.vy = 2 * vPiston - Math.abs(p.vy);
                if (p.vy > 0) p.vy = -p.vy; // 確実に下向き

                // 力積の記録（ピストン壁のみ）
                const deltaV = Math.abs(oldVy - p.vy);
                impulseThisFrame += PARTICLE_MASS * deltaV;
            }
        }

        // 圧力推定（移動平均）
        const rawPressure = impulseThisFrame / (dt * CHAMBER_WIDTH);
        pressureRef.current = PRESSURE_SMOOTHING * pressureRef.current +
            (1 - PRESSURE_SMOOTHING) * rawPressure;

        frameCountRef.current++;

        // 10フレームごとにReact状態を更新（間引き）
        if (frameCountRef.current % 10 === 0) {
            const normalizedP = pressureRef.current / (particles.length * 0.005);
            setP_estimated(normalizedP);

            // PV軌跡に追加（30フレームごと）
            if (frameCountRef.current % 30 === 0) {
                setPvTrace(prev => {
                    const newTrace = [...prev, { V_rel: V_relRef.current, P_rel: normalizedP }];
                    // 最大500点
                    if (newTrace.length > 500) return newTrace.slice(-500);
                    return newTrace;
                });
            }

            // 速度ヒストグラム計算
            const speeds = particles.map(p => Math.sqrt(p.vx * p.vx + p.vy * p.vy));
            const maxSpeed = Math.max(...speeds, 1);
            const numBins = 15;
            const binWidth = maxSpeed / numBins;
            const bins = new Array(numBins).fill(0);
            for (const s of speeds) {
                const idx = Math.min(Math.floor(s / binWidth), numBins - 1);
                bins[idx]++;
            }
            speedHistogramRef.current = bins.map((count, i) => ({
                vCenter: (i + 0.5) * binWidth,
                value: count / particles.length,
            }));
        }

        // 描画用データを返す
        return {
            particles: particles.map(p => ({ x: p.x, y: p.y })),
            chamberHeight: chamberH,
            pressure: pressureRef.current,
        };
    }, [getChamberHeight]);

    // --- 体積変更 ---
    const changeVolume = useCallback((delta) => {
        const newV = Math.max(V_MIN, Math.min(V_MAX, V_relRef.current + delta));
        pistonVelocityRef.current = delta > 0 ? 2 : -2; // ピストン速度
        V_relRef.current = newV;
        setV_rel(newV);

        // ピストン速度をフェードアウト
        setTimeout(() => { pistonVelocityRef.current = 0; }, 200);
    }, []);

    // --- 温度変更（粒子速度をスケーリング） ---
    const changeTemperature = useCallback((delta) => {
        if (!particlesRef.current) return;
        const deltaDisplay = delta * 1000; // 0.1 -> 100

        // 現在の運動エネルギーから現在温度を推定
        const particles = particlesRef.current;
        let totalKE = 0;
        for (const p of particles) {
            totalKE += 0.5 * (p.vx * p.vx + p.vy * p.vy);
        }
        const avgKE = totalKE / particles.length;
        const currentT = avgKE / 1.5; // KE ∝ T

        // delta * 30倍等の内部スケーリング（元のロジック維持）
        const newT = Math.max(0.1, currentT + delta * 3);
        const scaleFactor = Math.sqrt(newT / currentT);

        for (const p of particles) {
            p.vx *= scaleFactor;
            p.vy *= scaleFactor;
        }

        setT_rel_display(prev => Math.max(100, prev + deltaDisplay));
    }, []);

    // --- リセット ---
    const reset = useCallback((count) => {
        const n = count || particleCount;
        setParticleCount(n);
        setV_rel(1.0);
        setT_rel_display(1000);
        setP_estimated(1.0);
        V_relRef.current = 1.0;
        pistonVelocityRef.current = 0;
        initParticles(n, 1.0);
        setPvTrace([{ V_rel: 1.0, P_rel: 1.0 }]);
        speedHistogramRef.current = [];
    }, [particleCount, initParticles]);

    return {
        particleCount,
        V_rel,
        T_rel_display,
        P_estimated,
        pvTrace,
        speedHistogramRef,
        particlesRef,
        step,
        changeVolume,
        changeTemperature,
        reset,
        initParticles,
        getChamberHeight,
        CHAMBER_WIDTH,
        CHAMBER_BASE_HEIGHT,
    };
}
