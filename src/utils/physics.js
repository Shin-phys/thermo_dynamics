// ====================================================
// 物理定数・計算ユーティリティ
// 理想気体モデルの中核ロジック
// ====================================================

// --- 比熱比（単原子理想気体） ---
export const GAMMA = 5 / 3;

// --- 標準状態（表示スケール） ---
export const P_STD = 1.0e5; // Pa
export const V_STD = 1.0;   // L
export const T_STD = 300;   // K

// --- ジャンプ幅（相対値） ---
export const DELTA_V = 0.10;
export const DELTA_T = 0.10;

// --- 体積の範囲（相対値） ---
export const V_MIN = 0.40;
export const V_MAX = 2.00;

// --- 温度の下限（相対値） ---
export const T_MIN = 0.10;

// --- 定数 C（PV = CT の C） ---
export const C_CONST = 1.0;

// --- 理想気体の圧力計算 ---
export function calcPressure(T_rel, V_rel) {
    return C_CONST * T_rel / V_rel;
}

// --- 内部エネルギー（相対値、単原子） ---
export function calcU(T_rel) {
    return (3 / 2) * T_rel;
}

// --- 内部エネルギー変化 ---
export function calcDeltaU(T_old, T_new) {
    return (3 / 2) * (T_new - T_old);
}

// --- 操作トークン定義 ---
export const ACTION_TOKENS = {
    HEAT_FIXED: 'heat_fixed',              // 定積加熱
    COOL_FIXED: 'cool_fixed',              // 定積冷却
    EXPAND_ISOTHERMAL: 'expand_iso',        // 等温膨張
    COMPRESS_ISOTHERMAL: 'compress_iso',    // 等温圧縮
    EXPAND_ADIABATIC: 'expand_adi',         // 断熱膨張
    COMPRESS_ADIABATIC: 'compress_adi',     // 断熱圧縮
    EXPAND_ISOBARIC: 'expand_isobar',       // 定圧膨張
    COMPRESS_ISOBARIC: 'compress_isobar',   // 定圧圧縮
    HEAT_ISOBARIC: 'heat_isobaric',         // 定圧加熱（温度から動かす）
    COOL_ISOBARIC: 'cool_isobaric',         // 定圧冷却（温度から動かす）
    EXPAND_HEAT: 'expand_heat',             // 膨張+加熱（複合）
    EXPAND_COOL: 'expand_cool',             // 膨張+冷却（複合）
    COMPRESS_HEAT: 'compress_heat',         // 圧縮+加熱（複合）
    COMPRESS_COOL: 'compress_cool',         // 圧縮+冷却（複合）
};

// --- 操作トークンの表示名 ---
export const ACTION_LABELS = {
    [ACTION_TOKENS.HEAT_FIXED]: '定積加熱',
    [ACTION_TOKENS.COOL_FIXED]: '定積冷却',
    [ACTION_TOKENS.EXPAND_ISOTHERMAL]: '等温膨張',
    [ACTION_TOKENS.COMPRESS_ISOTHERMAL]: '等温圧縮',
    [ACTION_TOKENS.EXPAND_ADIABATIC]: '断熱膨張',
    [ACTION_TOKENS.COMPRESS_ADIABATIC]: '断熱圧縮',
    [ACTION_TOKENS.EXPAND_ISOBARIC]: '定圧膨張',
    [ACTION_TOKENS.COMPRESS_ISOBARIC]: '定圧圧縮',
    [ACTION_TOKENS.HEAT_ISOBARIC]: '定圧加熱',
    [ACTION_TOKENS.COOL_ISOBARIC]: '定圧冷却',
    [ACTION_TOKENS.EXPAND_HEAT]: '右上',
    [ACTION_TOKENS.EXPAND_COOL]: '右下',
    [ACTION_TOKENS.COMPRESS_HEAT]: '左上',
    [ACTION_TOKENS.COMPRESS_COOL]: '左下',
};

// --- 初期状態（標準状態：相対値） ---
export function createInitialState() {
    return {
        V_rel: 1.0,
        T_rel: 1.0,
        P_rel: 1.0,
    };
}

// ====================================================
// 理想モデルの操作更新則
// 符号規約: ΔU = Q + W
//   W (Win): 外部が気体にした仕事 (圧縮で正、膨張で負)
//   Q (Qin): 吸収熱 (放熱は負)
// ====================================================
export function applyAction(state, action) {
    const { V_rel, T_rel, P_rel } = state;
    let V_new, T_new, P_new, deltaU, Win, Qin;

    switch (action) {
        // --- A) 定積加熱 ---
        case ACTION_TOKENS.HEAT_FIXED:
            V_new = V_rel;
            T_new = T_rel + DELTA_T;
            P_new = calcPressure(T_new, V_new);
            deltaU = calcDeltaU(T_rel, T_new);
            Win = 0;
            Qin = deltaU; // ΔU = Q + W, W=0 → Q = ΔU
            break;

        // --- A) 定積冷却 ---
        case ACTION_TOKENS.COOL_FIXED:
            T_new = Math.max(T_MIN, T_rel - DELTA_T);
            V_new = V_rel;
            P_new = calcPressure(T_new, V_new);
            deltaU = calcDeltaU(T_rel, T_new);
            Win = 0;
            Qin = deltaU;
            break;

        // --- B) 等温膨張 ---
        case ACTION_TOKENS.EXPAND_ISOTHERMAL:
            T_new = T_rel;
            V_new = Math.min(V_MAX, V_rel + DELTA_V);
            P_new = calcPressure(T_new, V_new);
            deltaU = 0;
            // Win = +T * ln(V/V') : 膨張時 V'>V なので ln(V/V')<0 → Win<0（気体が仕事をした）
            Win = T_rel * Math.log(V_rel / V_new);
            Qin = -Win; // ΔU=0 → Q = -W
            break;

        // --- B) 等温圧縮 ---
        case ACTION_TOKENS.COMPRESS_ISOTHERMAL:
            T_new = T_rel;
            V_new = Math.max(V_MIN, V_rel - DELTA_V);
            P_new = calcPressure(T_new, V_new);
            deltaU = 0;
            Win = T_rel * Math.log(V_rel / V_new); // 圧縮時 V'<V → ln>0 → Win>0
            Qin = -Win;
            break;

        // --- C) 断熱膨張 ---
        case ACTION_TOKENS.EXPAND_ADIABATIC:
            V_new = Math.min(V_MAX, V_rel + DELTA_V);
            T_new = T_rel * Math.pow(V_rel / V_new, GAMMA - 1);
            P_new = calcPressure(T_new, V_new);
            Qin = 0;
            deltaU = calcDeltaU(T_rel, T_new);
            Win = deltaU; // ΔU = Q + W, Q=0 → W = ΔU
            break;

        // --- C) 断熱圧縮 ---
        case ACTION_TOKENS.COMPRESS_ADIABATIC:
            V_new = Math.max(V_MIN, V_rel - DELTA_V);
            T_new = T_rel * Math.pow(V_rel / V_new, GAMMA - 1);
            P_new = calcPressure(T_new, V_new);
            Qin = 0;
            deltaU = calcDeltaU(T_rel, T_new);
            Win = deltaU;
            break;

        // --- D) 定圧膨張 ---
        case ACTION_TOKENS.EXPAND_ISOBARIC:
            P_new = P_rel;
            V_new = Math.min(V_MAX, V_rel + DELTA_V);
            T_new = P_new * V_new / C_CONST;
            deltaU = calcDeltaU(T_rel, T_new);
            Win = -P_new * (V_new - V_rel); // 膨張：V'>V → Win<0
            Qin = deltaU - Win;
            break;

        // --- D) 定圧圧縮 ---
        case ACTION_TOKENS.COMPRESS_ISOBARIC:
            P_new = P_rel;
            V_new = Math.max(V_MIN, V_rel - DELTA_V);
            T_new = P_new * V_new / C_CONST;
            deltaU = calcDeltaU(T_rel, T_new);
            Win = -P_new * (V_new - V_rel); // 圧縮：V'<V → Win>0
            Qin = deltaU - Win;
            break;

        // --- D') 定圧加熱（温度操作から） ---
        case ACTION_TOKENS.HEAT_ISOBARIC:
            P_new = P_rel;
            T_new = T_rel + DELTA_T;
            V_new = C_CONST * T_new / P_new;
            if (V_new > V_MAX) {
                V_new = V_MAX;
                T_new = P_new * V_new / C_CONST;
            }
            deltaU = calcDeltaU(T_rel, T_new);
            Win = -P_new * (V_new - V_rel);
            Qin = deltaU - Win;
            break;

        // --- D') 定圧冷却（温度操作から） ---
        case ACTION_TOKENS.COOL_ISOBARIC:
            P_new = P_rel;
            T_new = Math.max(T_MIN, T_rel - DELTA_T);
            V_new = C_CONST * T_new / P_new;
            if (V_new < V_MIN) {
                V_new = V_MIN;
                T_new = P_new * V_new / C_CONST;
            }
            deltaU = calcDeltaU(T_rel, T_new);
            Win = -P_new * (V_new - V_rel);
            Qin = deltaU - Win;
            break;

        // --- E) 複合操作：右上（膨張+加熱） ---
        case ACTION_TOKENS.EXPAND_HEAT:
            V_new = Math.min(V_MAX, V_rel + DELTA_V);
            P_new = P_rel + 0.1;
            T_new = P_new * V_new / C_CONST;
            deltaU = calcDeltaU(T_rel, T_new);
            // 複合操作の仕事：台形近似
            Win = -((P_rel + P_new) / 2) * (V_new - V_rel);
            Qin = deltaU - Win;
            break;

        // --- E) 複合操作：右下（膨張+冷却） ---
        case ACTION_TOKENS.EXPAND_COOL:
            V_new = Math.min(V_MAX, V_rel + DELTA_V);
            P_new = Math.max(0.1, P_rel - 0.1);
            T_new = P_new * V_new / C_CONST;
            deltaU = calcDeltaU(T_rel, T_new);
            Win = -((P_rel + P_new) / 2) * (V_new - V_rel);
            Qin = deltaU - Win;
            break;

        // --- E) 複合操作：左上（圧縮+加熱） ---
        case ACTION_TOKENS.COMPRESS_HEAT:
            V_new = Math.max(V_MIN, V_rel - DELTA_V);
            P_new = P_rel + 0.1;
            T_new = P_new * V_new / C_CONST;
            deltaU = calcDeltaU(T_rel, T_new);
            Win = -((P_rel + P_new) / 2) * (V_new - V_rel);
            Qin = deltaU - Win;
            break;

        // --- E) 複合操作：左下（圧縮+冷却） ---
        case ACTION_TOKENS.COMPRESS_COOL:
            V_new = Math.max(V_MIN, V_rel - DELTA_V);
            P_new = Math.max(0.1, P_rel - 0.1);
            T_new = P_new * V_new / C_CONST;
            deltaU = calcDeltaU(T_rel, T_new);
            Win = -((P_rel + P_new) / 2) * (V_new - V_rel);
            Qin = deltaU - Win;
            break;

        default:
            return { ...state, deltaU: 0, Win: 0, Qin: 0 };
    }

    return {
        V_rel: V_new,
        T_rel: T_new,
        P_rel: P_new,
        deltaU,
        Win,
        Qin,
    };
}

// ====================================================
// Maxwell-Boltzmann 速度分布（理論値）
// f(v) = 4π n (m/2πkT)^(3/2) v^2 exp(-mv^2/2kT)
// 相対系で簡略化：a = 1/(2*T_rel), f(v) ∝ v^2 * exp(-a*v^2)
// ====================================================
export function maxwellBoltzmannDistribution(T_rel, numBins = 20, vMax = 5.0) {
    const bins = [];
    const dv = vMax / numBins;
    const a = 1 / (2 * T_rel);

    let maxVal = 0;
    for (let i = 0; i < numBins; i++) {
        const v = (i + 0.5) * dv;
        const f = v * v * Math.exp(-a * v * v);
        bins.push({ vCenter: v, value: f });
        if (f > maxVal) maxVal = f;
    }

    // 正規化（最大値を1にする）
    if (maxVal > 0) {
        for (const bin of bins) {
            bin.value /= maxVal;
        }
    }

    return { bins, dv, vMax };
}

// --- 操作トークンから過程の種類ラベルを返す（PV描画用） ---
export function getProcessType(action) {
    switch (action) {
        case ACTION_TOKENS.HEAT_FIXED:
        case ACTION_TOKENS.COOL_FIXED:
            return 'isochoric';     // 定積
        case ACTION_TOKENS.EXPAND_ISOTHERMAL:
        case ACTION_TOKENS.COMPRESS_ISOTHERMAL:
            return 'isothermal';    // 等温
        case ACTION_TOKENS.EXPAND_ADIABATIC:
        case ACTION_TOKENS.COMPRESS_ADIABATIC:
            return 'adiabatic';     // 断熱
        case ACTION_TOKENS.EXPAND_ISOBARIC:
        case ACTION_TOKENS.COMPRESS_ISOBARIC:
        case ACTION_TOKENS.HEAT_ISOBARIC:
        case ACTION_TOKENS.COOL_ISOBARIC:
            return 'isobaric';      // 定圧
        default:
            return 'composite';     // 複合
    }
}
