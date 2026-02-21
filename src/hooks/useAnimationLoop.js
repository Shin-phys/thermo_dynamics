// ====================================================
// useAnimationLoop: requestAnimationFrame ベースのアニメーションループ
// ====================================================

import { useRef, useCallback, useEffect } from 'react';

export function useAnimationLoop(callback) {
    const rafIdRef = useRef(null);
    const callbackRef = useRef(callback);
    const lastTimeRef = useRef(0);
    const runningRef = useRef(false);

    // コールバックを最新のものに保つ
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // メインループ
    const loop = useCallback((timestamp) => {
        if (!runningRef.current) return;

        const dt = lastTimeRef.current > 0
            ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.05) // 最大50ms
            : 1 / 60;
        lastTimeRef.current = timestamp;

        if (callbackRef.current) {
            callbackRef.current(dt, timestamp);
        }

        rafIdRef.current = requestAnimationFrame(loop);
    }, []);

    // --- 開始 ---
    const start = useCallback(() => {
        if (runningRef.current) return;
        runningRef.current = true;
        lastTimeRef.current = 0;
        rafIdRef.current = requestAnimationFrame(loop);
    }, [loop]);

    // --- 停止 ---
    const stop = useCallback(() => {
        runningRef.current = false;
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, []);

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    return { start, stop, isRunning: runningRef };
}
