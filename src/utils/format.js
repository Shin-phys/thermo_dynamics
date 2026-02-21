// ====================================================
// 表示フォーマットユーティリティ
// 圧力は ×10^5 Pa 表記を基本とする
// ====================================================

import { P_STD, V_STD, T_STD } from './physics';

// --- 圧力表示（×10^5 Pa） ---
export function formatPressure(P_rel) {
    const P_abs = P_rel * P_STD;
    const P_disp = P_abs / 1e5;
    return `${P_disp.toFixed(2)} ×10⁵ Pa`;
}

// --- 圧力（数値のみ） ---
export function formatPressureValue(P_rel) {
    const P_abs = P_rel * P_STD;
    const P_disp = P_abs / 1e5;
    return P_disp.toFixed(2);
}

// --- 体積表示（L） ---
export function formatVolume(V_rel) {
    const V_abs = V_rel * V_STD;
    return `${V_abs.toFixed(2)} L`;
}

// --- 体積（数値のみ） ---
export function formatVolumeValue(V_rel) {
    const V_abs = V_rel * V_STD;
    return V_abs.toFixed(2);
}

// --- 温度表示（K） ---
export function formatTemperature(T_rel) {
    const T_abs = T_rel * T_STD;
    return `${T_abs.toFixed(0)} K`;
}

// --- 温度（数値のみ） ---
export function formatTemperatureValue(T_rel) {
    const T_abs = T_rel * T_STD;
    return T_abs.toFixed(0);
}

// --- 相対値表示 ---
export function formatRelative(value) {
    return value.toFixed(3);
}

// --- 熱力学量表示（相対、小数点3桁） ---
export function formatThermo(value) {
    if (Math.abs(value) < 1e-10) return '0.000';
    return value >= 0 ? `+${value.toFixed(3)}` : value.toFixed(3);
}

// --- 数値の符号付き表示 ---
export function formatSigned(value, digits = 3) {
    if (Math.abs(value) < 1e-10) return '0.' + '0'.repeat(digits);
    const formatted = Math.abs(value).toFixed(digits);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
}
