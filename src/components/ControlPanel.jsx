// ====================================================
// ControlPanel: 操作UIコンポーネント
// トグル（固定/解放、等温/断熱）＋離散ボタン
// ====================================================

import React from 'react';

export default function ControlPanel({
    boundary,       // 'fixed' | 'released_balance' | 'released_external'
    thermal,        // 'free' | 'isothermal' | 'adiabatic'
    onBoundaryChange,
    onThermalChange,
    onAction,       // (buttonType) => void
    availableActions,
    mode = 'textbook', // 'textbook' | 'practice' | 'reality'
}) {
    // --- トグルボタンスタイル ---
    const toggleBtn = (active, label, onClick, color = 'blue') => {
        const colors = {
            blue: active
                ? 'bg-blue-600/80 text-white border-blue-400 shadow-blue-500/30'
                : 'bg-surface-700/60 text-slate-400 border-slate-600 hover:bg-surface-600/60',
            purple: active
                ? 'bg-purple-600/80 text-white border-purple-400 shadow-purple-500/30'
                : 'bg-surface-700/60 text-slate-400 border-slate-600 hover:bg-surface-600/60',
        };

        return (
            <button
                onClick={onClick}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-200
          ${colors[color]} ${active ? 'shadow-lg' : ''}`}
            >
                {label}
            </button>
        );
    };

    // --- 操作ボタンスタイル ---
    const actionBtn = (label, onClick, disabled, variant = 'default') => {
        const variants = {
            default: disabled
                ? 'bg-slate-700/30 text-slate-600 border-slate-700 cursor-not-allowed'
                : 'bg-surface-700/80 text-slate-200 border-slate-500 hover:bg-surface-600 hover:border-blue-400 hover:text-white active:scale-95',
            accent: disabled
                ? 'bg-slate-700/30 text-slate-600 border-slate-700 cursor-not-allowed'
                : 'bg-blue-900/40 text-blue-300 border-blue-600/50 hover:bg-blue-800/50 hover:text-blue-200 active:scale-95',
            green: disabled
                ? 'bg-slate-700/30 text-slate-600 border-slate-700 cursor-not-allowed'
                : 'bg-emerald-900/40 text-emerald-300 border-emerald-600/50 hover:bg-emerald-800/50 hover:text-emerald-200 active:scale-95',
            warn: disabled
                ? 'bg-slate-700/30 text-slate-600 border-slate-700 cursor-not-allowed'
                : 'bg-amber-900/40 text-amber-300 border-amber-600/50 hover:bg-amber-800/50 hover:text-amber-200 active:scale-95',
            danger: disabled
                ? 'bg-slate-700/30 text-slate-600 border-slate-700 cursor-not-allowed'
                : 'bg-red-900/30 text-red-300 border-red-600/40 hover:bg-red-800/40 hover:text-red-200 active:scale-95',
        };

        return (
            <button
                onClick={disabled ? undefined : onClick}
                disabled={disabled}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150
          ${variants[variant]}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="space-y-3">
            {/* --- 境界条件トグル --- */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                    境界条件
                </div>
                <div className="flex flex-col gap-1.5">
                    {toggleBtn(boundary === 'fixed', '🔒 固定', () => onBoundaryChange('fixed'), 'blue')}
                    {toggleBtn(boundary === 'released_balance', '⚖️ 解放（つり合い）', () => onBoundaryChange('released_balance'), 'blue')}
                    {toggleBtn(boundary === 'released_external', '🔓 解放（外圧一定）', () => onBoundaryChange('released_external'), 'blue')}
                </div>
            </div>

            {/* --- 熱条件トグル --- */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                    熱条件
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {toggleBtn(thermal === 'free', '💨 自由', () => onThermalChange('free'), 'purple')}
                    {toggleBtn(thermal === 'isothermal', '🌡️ 等温', () => onThermalChange('isothermal'), 'purple')}
                    {toggleBtn(thermal === 'adiabatic', '🛡️ 断熱', () => onThermalChange('adiabatic'), 'purple')}
                </div>
            </div>

            {/* --- 基本操作 --- */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                    基本操作
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    {actionBtn('📈 体積 +', () => onAction('volumeUp'), !availableActions?.volumeUp, 'accent')}
                    {actionBtn('📉 体積 −', () => onAction('volumeDown'), !availableActions?.volumeDown, 'accent')}
                    {actionBtn('🔥 温度 +', () => onAction('tempUp'), !availableActions?.tempUp, 'danger')}
                    {actionBtn('❄️ 温度 −', () => onAction('tempDown'), !availableActions?.tempDown, 'accent')}
                </div>
            </div>



            {/* --- 複合操作 --- */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                    複合操作（斜辺用）
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    {actionBtn('↗️ 右上', () => onAction('expandHeat'), false, 'warn')}
                    {actionBtn('↘️ 右下', () => onAction('expandCool'), false, 'warn')}
                    {actionBtn('↖️ 左上', () => onAction('compressHeat'), false, 'warn')}
                    {actionBtn('↙️ 左下', () => onAction('compressCool'), false, 'warn')}
                </div>
            </div>

            {/* --- Undo --- */}
            <div className="flex gap-1.5">
                {actionBtn('↩️ Undo', () => onAction('undo'), !availableActions?.canUndo)}
                {actionBtn('🔄 Reset', () => onAction('reset'), false, 'danger')}
            </div>
        </div>
    );
}
