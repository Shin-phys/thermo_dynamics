// ====================================================
// StateDisplay: 状態値表示コンポーネント（分割版）
// ====================================================

import React from 'react';
import {
    formatPressureValue,
    formatVolumeValue,
    formatTemperatureValue,
    formatRelative, formatThermo,
} from '../utils/format';

// --- 共通のカードコンポーネント ---
const stateCard = (label, value, unit, relValue, color) => (
    <div className={`bg-surface-700/50 rounded-lg p-2.5 border border-slate-600/30`}>
        <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
            <span className="text-[9px] text-slate-600 font-mono">{relValue}</span>
        </div>
        <div className={`text-lg font-mono font-semibold mt-0.5 ${color}`}>
            {value}
            <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
        </div>
    </div>
);

const thermoCard = (label, value, color) => (
    <div className="flex items-center justify-between py-1 px-2 rounded bg-surface-800/50">
        <span className="text-[10px] text-slate-400 font-medium">{label}</span>
        <span className={`text-xs font-mono font-semibold ${color}`}>
            {formatThermo(value)}
        </span>
    </div>
);

// ==========================================
// 現在の状態量 (CurrentStateDisplay)
// ==========================================
export function CurrentStateDisplay({ gasState, mode = 'textbook' }) {
    const { V_rel, T_rel, P_rel } = gasState;
    return (
        <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                現在の状態
            </div>
            <div className="space-y-1.5">
                {stateCard(
                    '圧力 P',
                    formatPressureValue(P_rel),
                    '×10⁵ Pa',
                    `${formatRelative(P_rel)} P₀`,
                    'text-red-400'
                )}
                {stateCard(
                    '体積 V',
                    formatVolumeValue(V_rel),
                    'L',
                    `${formatRelative(V_rel)} V₀`,
                    'text-blue-400'
                )}
                {stateCard(
                    '温度 T',
                    formatTemperatureValue(T_rel),
                    'K',
                    `${formatRelative(T_rel)} T₀`,
                    'text-amber-400'
                )}
            </div>
        </div>
    );
}

// ==========================================
// 直近の操作結果 (RecentActionDisplay)
// ==========================================
export function RecentActionDisplay({ lastResult }) {
    return (
        <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm h-full flex flex-col justify-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                直近の操作
            </div>
            <div className="space-y-1">
                {thermoCard('ΔU', lastResult.deltaU,
                    lastResult.deltaU > 0 ? 'text-red-400' : lastResult.deltaU < 0 ? 'text-blue-400' : 'text-slate-500'
                )}
                {thermoCard('Qin', lastResult.Qin,
                    lastResult.Qin > 0 ? 'text-orange-400' : lastResult.Qin < 0 ? 'text-cyan-400' : 'text-slate-500'
                )}
                {thermoCard('Win', lastResult.Win,
                    lastResult.Win > 0 ? 'text-emerald-400' : lastResult.Win < 0 ? 'text-purple-400' : 'text-slate-500'
                )}
            </div>
        </div>
    );
}

// ==========================================
// 累積値 (CumulativeDisplay)
// ==========================================
export function CumulativeDisplay({ cumulative }) {
    return (
        <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm h-full flex flex-col justify-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                累積値
            </div>
            <div className="space-y-1">
                {thermoCard('U − U₀', cumulative.totalDeltaU,
                    cumulative.totalDeltaU > 0 ? 'text-red-400' :
                        cumulative.totalDeltaU < 0 ? 'text-blue-400' : 'text-slate-500'
                )}
                {thermoCard('ΣQ', cumulative.sumQ,
                    cumulative.sumQ > 0 ? 'text-orange-400' :
                        cumulative.sumQ < 0 ? 'text-cyan-400' : 'text-slate-500'
                )}
                {thermoCard('ΣW', cumulative.sumW,
                    cumulative.sumW > 0 ? 'text-emerald-400' :
                        cumulative.sumW < 0 ? 'text-purple-400' : 'text-slate-500'
                )}
            </div>
            {/* 検算表示 */}
            <div className="mt-2 px-2 py-1 bg-slate-800/30 rounded text-[9px] text-slate-500 font-mono">
                ΔU = ΣQ + ΣW = {formatThermo(cumulative.sumQ + cumulative.sumW)}
            </div>
        </div>
    );
}

// 後方互換性用（今までの一括表示）
export default function StateDisplay(props) {
    return (
        <div className="space-y-3">
            <CurrentStateDisplay {...props} />
            <RecentActionDisplay lastResult={props.lastResult} />
            <div>
                <CumulativeDisplay cumulative={props.cumulative} />
            </div>
        </div>
    );
}
