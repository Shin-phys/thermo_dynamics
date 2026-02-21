// ====================================================
// useIdealGasModel: 理想気体モデルフック（Textbook / Practice 共通）
// 状態量を明示的に管理し、操作に対して一意に遷移する
// ====================================================

import { useState, useCallback, useRef } from 'react';
import {
    createInitialState,
    applyAction,
    ACTION_TOKENS,
    V_MIN, V_MAX, T_MIN,
} from '../utils/physics';

// --- 最大履歴数 ---
const MAX_HISTORY = 200;

export function useIdealGasModel() {
    // 現在の状態（相対値）
    const [gasState, setGasState] = useState(createInitialState());

    // 直近の操作結果（ΔU, Win, Qin）
    const [lastResult, setLastResult] = useState({ deltaU: 0, Win: 0, Qin: 0 });

    // 累積値
    const [cumulative, setCumulative] = useState({ sumQ: 0, sumW: 0, totalDeltaU: 0 });

    // PV軌跡（各操作点を記録）
    const [pvTrace, setPvTrace] = useState([{
        V_rel: 1.0, P_rel: 1.0, T_rel: 1.0, action: null,
    }]);

    // 操作ログ（トークン列）
    const [actionLog, setActionLog] = useState([]);

    // Undo用履歴
    const historyRef = useRef([]);

    // --- 操作適用 ---
    const performAction = useCallback((actionToken) => {
        const prevState = gasState;
        const result = applyAction(prevState, actionToken);

        // 状態が変わらない場合はスキップ（V範囲外など）
        if (
            result.V_rel === prevState.V_rel &&
            result.T_rel === prevState.T_rel &&
            result.P_rel === prevState.P_rel
        ) {
            return;
        }

        // 履歴に現在の状態を保存
        historyRef.current = [
            ...historyRef.current.slice(-MAX_HISTORY),
            { gasState: prevState, lastResult: { deltaU: 0, Win: 0, Qin: 0 } },
        ];

        // 状態の更新
        setGasState({
            V_rel: result.V_rel,
            T_rel: result.T_rel,
            P_rel: result.P_rel,
        });

        // 直近の結果を更新
        setLastResult({
            deltaU: result.deltaU,
            Win: result.Win,
            Qin: result.Qin,
        });

        // 累積値を更新
        setCumulative((prev) => ({
            sumQ: prev.sumQ + result.Qin,
            sumW: prev.sumW + result.Win,
            totalDeltaU: prev.totalDeltaU + result.deltaU,
        }));

        // PV軌跡に追加
        setPvTrace((prev) => [
            ...prev,
            { V_rel: result.V_rel, P_rel: result.P_rel, T_rel: result.T_rel, action: actionToken },
        ]);

        // 操作ログに追加
        setActionLog((prev) => [...prev, actionToken]);
    }, [gasState]);

    // --- Undo ---
    const undo = useCallback(() => {
        if (historyRef.current.length === 0) return;

        const lastEntry = historyRef.current[historyRef.current.length - 1];
        historyRef.current = historyRef.current.slice(0, -1);

        setGasState(lastEntry.gasState);
        setLastResult({ deltaU: 0, Win: 0, Qin: 0 });

        // 累積値を再計算
        setPvTrace(prev => prev.slice(0, -1));
        setActionLog(prev => prev.slice(0, -1));

        // 累積値を操作ログから再計算
        const newLog = actionLog.slice(0, -1);
        let state = createInitialState();
        let sumQ = 0, sumW = 0, totalDU = 0;
        for (const token of newLog) {
            const res = applyAction(state, token);
            sumQ += res.Qin;
            sumW += res.Win;
            totalDU += res.deltaU;
            state = { V_rel: res.V_rel, T_rel: res.T_rel, P_rel: res.P_rel };
        }
        setCumulative({ sumQ, sumW, totalDeltaU: totalDU });
    }, [actionLog]);

    // --- リセット ---
    const reset = useCallback(() => {
        const initial = createInitialState();
        setGasState(initial);
        setLastResult({ deltaU: 0, Win: 0, Qin: 0 });
        setCumulative({ sumQ: 0, sumW: 0, totalDeltaU: 0 });
        setPvTrace([{ V_rel: 1.0, P_rel: 1.0, T_rel: 1.0, action: null }]);
        setActionLog([]);
        historyRef.current = [];
    }, []);

    // --- ボタン有効/無効判定 ---
    const getAvailableActions = useCallback((boundary, thermal) => {
        const isFixed = boundary === 'fixed';
        const isIsothermal = thermal === 'isothermal';
        const isAdiabatic = thermal === 'adiabatic';

        return {
            // 体積操作: 固定時は無効
            volumeUp: !isFixed && gasState.V_rel < V_MAX,
            volumeDown: !isFixed && gasState.V_rel > V_MIN,

            // 温度操作: 等温・断熱時は無効（自由のときのみ可能）
            tempUp: !isIsothermal && !isAdiabatic,
            tempDown: !isIsothermal && !isAdiabatic && gasState.T_rel > T_MIN,

            // 定圧操作（UIからは削除されるがAPIとして残す）
            isobaricExpand: gasState.V_rel < V_MAX,
            isobaricCompress: gasState.V_rel > V_MIN,

            // 複合操作
            compositeEnabled: true,

            // Undo
            canUndo: historyRef.current.length > 0,
        };
    }, [gasState]);

    // --- 操作トークン解決（トグル状態に基づく） ---
    const resolveAction = useCallback((buttonType, boundary, thermal) => {
        switch (buttonType) {
            case 'volumeUp':
                if (thermal === 'isothermal') return ACTION_TOKENS.EXPAND_ISOTHERMAL;
                if (thermal === 'adiabatic') return ACTION_TOKENS.EXPAND_ADIABATIC;
                return ACTION_TOKENS.EXPAND_ISOBARIC; // 自由の時は定圧膨張として扱う
            case 'volumeDown':
                if (thermal === 'isothermal') return ACTION_TOKENS.COMPRESS_ISOTHERMAL;
                if (thermal === 'adiabatic') return ACTION_TOKENS.COMPRESS_ADIABATIC;
                return ACTION_TOKENS.COMPRESS_ISOBARIC; // 自由の時は定圧圧縮として扱う
            case 'tempUp':
                if (boundary === 'fixed') return ACTION_TOKENS.HEAT_FIXED;
                return ACTION_TOKENS.HEAT_ISOBARIC; // 解放時は定圧加熱
            case 'tempDown':
                if (boundary === 'fixed') return ACTION_TOKENS.COOL_FIXED;
                return ACTION_TOKENS.COOL_ISOBARIC; // 解放時は定圧冷却
            case 'expandHeat':
                return ACTION_TOKENS.EXPAND_HEAT;
            case 'expandCool':
                return ACTION_TOKENS.EXPAND_COOL;
            case 'compressHeat':
                return ACTION_TOKENS.COMPRESS_HEAT;
            case 'compressCool':
                return ACTION_TOKENS.COMPRESS_COOL;
            default:
                return null;
        }
    }, []);

    return {
        gasState,
        lastResult,
        cumulative,
        pvTrace,
        actionLog,
        performAction,
        undo,
        reset,
        getAvailableActions,
        resolveAction,
    };
}
