// ====================================================
// Practice Mode 問題データ
// 正解操作列から目標PV軌跡を自動生成
// ====================================================

import { ACTION_TOKENS, applyAction, createInitialState } from './physics';

const AT = ACTION_TOKENS;

// --- 問題定義 ---
// 各問題は正解操作トークン列を持ち、目標パスはそこから自動生成する
const PROBLEM_DEFINITIONS = [
    {
        id: 1,
        name: '定番サイクル（等温）',
        description: '定番の三角形サイクル。定積加熱で圧力を上げ、等温膨張で体積を増やし、定圧圧縮で戻る。',
        answerTokens: [
            AT.HEAT_FIXED, AT.HEAT_FIXED, AT.HEAT_FIXED,
            AT.EXPAND_ISOTHERMAL, AT.EXPAND_ISOTHERMAL, AT.EXPAND_ISOTHERMAL,
            AT.COMPRESS_ISOBARIC, AT.COMPRESS_ISOBARIC, AT.COMPRESS_ISOBARIC,
        ],
    },
    {
        id: 2,
        name: '定番サイクル（断熱）',
        description: '等温膨張を断熱膨張に変えたバリエーション。断熱膨張では温度が下がる点に注意。',
        answerTokens: [
            AT.HEAT_FIXED, AT.HEAT_FIXED, AT.HEAT_FIXED,
            AT.EXPAND_ADIABATIC, AT.EXPAND_ADIABATIC, AT.EXPAND_ADIABATIC,
            AT.COMPRESS_ISOBARIC, AT.COMPRESS_ISOBARIC, AT.COMPRESS_ISOBARIC,
        ],
    },
    {
        id: 3,
        name: '三角形サイクル（斜辺あり）',
        description: '定積加熱 → 膨張+冷却（斜辺） → 元に戻す三角形。複合操作を使う。',
        answerTokens: [
            AT.HEAT_FIXED, AT.HEAT_FIXED, AT.HEAT_FIXED,
            AT.EXPAND_COOL, AT.EXPAND_COOL, AT.EXPAND_COOL,
            AT.COMPRESS_ISOTHERMAL, AT.COMPRESS_ISOTHERMAL, AT.COMPRESS_ISOTHERMAL,
        ],
    },
    {
        id: 4,
        name: '逆三角形サイクル',
        description: '等温膨張 → 定積加熱 → 圧縮+冷却（斜辺）で戻る逆三角形。',
        answerTokens: [
            AT.EXPAND_ISOTHERMAL, AT.EXPAND_ISOTHERMAL, AT.EXPAND_ISOTHERMAL,
            AT.HEAT_FIXED, AT.HEAT_FIXED, AT.HEAT_FIXED,
            AT.COMPRESS_COOL, AT.COMPRESS_COOL, AT.COMPRESS_COOL,
        ],
    },
    {
        id: 5,
        name: '矩形サイクル',
        description: '定積加熱 → 定圧膨張 → 定積冷却 → 定圧圧縮の矩形サイクル。',
        answerTokens: [
            AT.HEAT_FIXED, AT.HEAT_FIXED,
            AT.EXPAND_ISOBARIC, AT.EXPAND_ISOBARIC,
            AT.COOL_FIXED, AT.COOL_FIXED,
            AT.COMPRESS_ISOBARIC, AT.COMPRESS_ISOBARIC,
        ],
    },
    {
        id: 6,
        name: 'カルノー風サイクル',
        description: '等温膨張 → 断熱膨張 → 等温圧縮 → 断熱圧縮のカルノー風サイクル。',
        answerTokens: [
            AT.EXPAND_ISOTHERMAL, AT.EXPAND_ISOTHERMAL, AT.EXPAND_ISOTHERMAL,
            AT.EXPAND_ADIABATIC, AT.EXPAND_ADIABATIC, AT.EXPAND_ADIABATIC,
            AT.COMPRESS_ISOTHERMAL, AT.COMPRESS_ISOTHERMAL, AT.COMPRESS_ISOTHERMAL,
            AT.COMPRESS_ADIABATIC, AT.COMPRESS_ADIABATIC, AT.COMPRESS_ADIABATIC,
        ],
    },
    {
        id: 7,
        name: '逆向きサイクル',
        description: '定圧膨張 → 定積加熱 → 定圧圧縮 → 定積冷却の逆向きサイクル。',
        answerTokens: [
            AT.EXPAND_ISOBARIC, AT.EXPAND_ISOBARIC,
            AT.HEAT_FIXED, AT.HEAT_FIXED,
            AT.COMPRESS_ISOBARIC, AT.COMPRESS_ISOBARIC,
            AT.COOL_FIXED, AT.COOL_FIXED,
        ],
    },
];

// --- 操作列から目標PV軌跡を生成 ---
export function generateTargetPath(answerTokens) {
    let state = createInitialState();
    const path = [{ V_rel: state.V_rel, P_rel: state.P_rel, T_rel: state.T_rel }];

    for (const token of answerTokens) {
        const result = applyAction(state, token);
        state = { V_rel: result.V_rel, T_rel: result.T_rel, P_rel: result.P_rel };
        path.push({ ...state, action: token });
    }

    return path;
}

// --- 問題リストを取得（targetPath付き） ---
export function getProblems() {
    return PROBLEM_DEFINITIONS.map(prob => ({
        ...prob,
        targetPath: generateTargetPath(prob.answerTokens),
    }));
}

// --- ランダム問題選択 ---
export function getRandomProblem() {
    const problems = getProblems();
    const idx = Math.floor(Math.random() * problems.length);
    return problems[idx];
}

// --- 同値操作の正規化（意味が同じ操作を統一） ---
export function normalizeToken(token) {
    if (token === ACTION_TOKENS.HEAT_ISOBARIC) return ACTION_TOKENS.EXPAND_ISOBARIC;
    if (token === ACTION_TOKENS.COOL_ISOBARIC) return ACTION_TOKENS.COMPRESS_ISOBARIC;
    return token;
}

// --- 自動採点用：連続する操作や同値操作を1つのトークンに圧縮 ---
export function compressTokens(tokens) {
    if (!tokens || tokens.length === 0) return [];

    const normalized = tokens.map(normalizeToken);
    const compressed = [{ token: normalized[0], count: 1 }];

    for (let i = 1; i < normalized.length; i++) {
        const last = compressed[compressed.length - 1];
        if (normalized[i] === last.token) {
            last.count++;
        } else {
            compressed.push({ token: normalized[i], count: 1 });
        }
    }
    return compressed;
}

// --- 最終状態の一致判定（許容誤差） ---
export function checkStateMatch(userState, answerState) {
    if (!userState || !answerState) return false;
    const tol = 0.05; // 5% または絶対値の許容誤差
    return (
        Math.abs(userState.V_rel - answerState.V_rel) < tol &&
        Math.abs(userState.T_rel - answerState.T_rel) < tol &&
        Math.abs(userState.P_rel - answerState.P_rel) < tol
    );
}

// --- 採点A: 操作列一致 ＋ 最終状態一致 ---
export function gradeOperationSequence(userTokens, answerTokens, userFinalState, answerFinalState) {
    const compressedUser = compressTokens(userTokens);
    const compressedAnswer = compressTokens(answerTokens);

    // 1. セグメントの完全一致と回数の一致
    let matchCount = 0;
    let isCountMatch = true;
    const minLength = Math.min(compressedUser.length, compressedAnswer.length);
    for (let i = 0; i < minLength; i++) {
        if (compressedUser[i].token === compressedAnswer[i].token) {
            matchCount++;
            if (compressedUser[i].count !== compressedAnswer[i].count) {
                isCountMatch = false;
            }
        } else {
            isCountMatch = false;
        }
    }

    // 構成工程数が同じで、かつ前から全て一致しているか
    const isSequenceMatch = (compressedUser.length === compressedAnswer.length) && (matchCount === compressedAnswer.length);
    if (!isSequenceMatch) isCountMatch = false;

    // 2. 最終状態の一致
    const isStateMatch = checkStateMatch(userFinalState, answerFinalState);

    // 両方満たしてはじめて正解
    const correct = isSequenceMatch && isStateMatch && isCountMatch;

    return {
        correct,
        score: matchCount / compressedAnswer.length, // 参考スコア
        isSequenceMatch,
        isCountMatch,
        isStateMatch,
        message: correct
            ? '🎉 完全正解！工程も回数も最終状態も一致しました。'
            : (!isSequenceMatch
                ? `工程列が異なります（一致数: ${matchCount}/${compressedAnswer.length}）。`
                : (!isCountMatch
                    ? '工程列は合っていますが、各工程の操作回数が目標と異なります。'
                    : '工程・回数は合っていますが、最終状態が目標と異なります。')),
        detail: { userCount: compressedUser.length, answerCount: compressedAnswer.length },
    };
}
