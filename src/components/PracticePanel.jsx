// ====================================================
// PracticePanel: Practiceモード専用パネル
// 問題選択・出題・採点・操作ログ表示
// ====================================================

import React, { useState, useCallback, useMemo } from 'react';
import { getProblems, getRandomProblem, gradeOperationSequence, compressTokens } from '../utils/problems';
import { ACTION_LABELS } from '../utils/physics';

export default function PracticePanel({
    actionLog,
    currentGasState,
    onSelectProblem,
    currentProblem,
    onReset,
}) {
    const [gradeResult, setGradeResult] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const problems = getProblems();

    // --- 問題選択 ---
    const handleSelectProblem = useCallback((prob) => {
        setGradeResult(null);
        setShowAnswer(false);
        setShowHint(false);
        onSelectProblem(prob);
    }, [onSelectProblem]);

    // --- ランダム出題 ---
    const handleRandomProblem = useCallback(() => {
        const prob = getRandomProblem();
        setGradeResult(null);
        setShowAnswer(false);
        setShowHint(false);
        onSelectProblem(prob);
    }, [onSelectProblem]);

    // --- 採点 ---
    const handleGrade = useCallback(() => {
        if (!currentProblem) return;
        const answerFinalState = currentProblem.targetPath[currentProblem.targetPath.length - 1];
        const result = gradeOperationSequence(actionLog, currentProblem.answerTokens, currentGasState, answerFinalState);
        setGradeResult(result);
    }, [actionLog, currentProblem, currentGasState]);

    // --- リセット ---
    const handleReset = useCallback(() => {
        setGradeResult(null);
        setShowAnswer(false);
        setShowHint(false);
        onReset();
    }, [onReset]);

    // 圧縮されたログ（UI表示用）
    const compressedLog = useMemo(() => compressTokens(actionLog), [actionLog]);
    const compressedAnswer = useMemo(() => currentProblem ? compressTokens(currentProblem.answerTokens) : [], [currentProblem]);

    return (
        <div className="space-y-3">
            {/* --- 問題選択 --- */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                    📝 問題選択
                </div>

                {/* ランダム出題ボタン */}
                <button
                    onClick={handleRandomProblem}
                    className="w-full mb-2 px-3 py-2 rounded-lg text-xs font-medium
            bg-gradient-to-r from-purple-600/50 to-blue-600/50
            text-white border border-purple-400/30
            hover:from-purple-500/60 hover:to-blue-500/60
            active:scale-95 transition-all duration-200"
                >
                    🎲 ランダム出題
                </button>

                {/* 問題リスト */}
                <div className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
                    {problems.map(prob => (
                        <button
                            key={prob.id}
                            onClick={() => handleSelectProblem(prob)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-all duration-150
                ${currentProblem?.id === prob.id
                                    ? 'bg-blue-900/40 text-blue-300 border border-blue-500/40'
                                    : 'bg-surface-700/40 text-slate-400 border border-transparent hover:bg-surface-600/50 hover:text-slate-300'
                                }`}
                        >
                            <span className="font-medium">#{prob.id}</span> {prob.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- 選択中の問題情報 --- */}
            {currentProblem && (
                <div className="bg-surface-700/30 rounded-lg p-2.5 border border-slate-600/20">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-medium">
                        出題中
                    </div>
                    <div className="text-xs text-slate-300 font-medium">
                        #{currentProblem.id} {currentProblem.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5">
                        {!showHint ? (
                            <button
                                onClick={() => setShowHint(true)}
                                className="text-blue-400 hover:text-blue-300 hover:underline transition-colors flex items-center gap-1"
                            >
                                💡 ヒントを見る
                            </button>
                        ) : (
                            <div className="animate-in fade-in duration-300 text-slate-400">
                                {currentProblem.description}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- 操作ログ --- */}
            <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">
                    操作工程（全{compressedLog.length}工程 / クリック{actionLog.length}回）
                </div>
                <div className="max-h-24 overflow-y-auto bg-surface-800/50 rounded-md p-1.5 space-y-0.5 scrollbar-thin">
                    {compressedLog.length === 0 ? (
                        <div className="text-[10px] text-slate-600 text-center py-2">
                            操作を開始してください
                        </div>
                    ) : (
                        compressedLog.map((item, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-slate-600 font-mono w-5 text-right">{i + 1}.</span>
                                <span className="text-slate-400">
                                    {ACTION_LABELS[item.token] || item.token}
                                    <span className="text-slate-500 ml-1">×{item.count}</span>
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* --- 採点ボタン --- */}
            {currentProblem && (
                <div className="space-y-1.5">
                    <button
                        onClick={handleGrade}
                        className="w-full px-3 py-2.5 rounded-lg text-sm font-medium
              bg-gradient-to-r from-emerald-600/60 to-teal-600/60
              text-white border border-emerald-400/30
              hover:from-emerald-500/70 hover:to-teal-500/70
              active:scale-95 transition-all duration-200 shadow-lg shadow-emerald-900/20"
                    >
                        ✅ 採点する
                    </button>

                    <div className="flex gap-1.5">
                        <button
                            onClick={handleReset}
                            className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium
                bg-surface-700/60 text-slate-400 border border-slate-600
                hover:bg-surface-600/60 hover:text-slate-300
                transition-all duration-150"
                        >
                            🔄 やり直し
                        </button>
                        <button
                            onClick={() => setShowAnswer(!showAnswer)}
                            className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium
                bg-surface-700/60 text-slate-400 border border-slate-600
                hover:bg-surface-600/60 hover:text-slate-300
                transition-all duration-150"
                        >
                            {showAnswer ? '🙈 隠す' : '👁️ 正解表示'}
                        </button>
                    </div>
                </div>
            )}

            {/* --- 採点結果 --- */}
            {gradeResult && (
                <div className={`rounded-lg p-3 border ${gradeResult.correct
                    ? 'bg-emerald-900/30 border-emerald-500/30'
                    : 'bg-amber-900/20 border-amber-500/30'
                    }`}>
                    <div className={`text-sm font-medium ${gradeResult.correct ? 'text-emerald-300' : 'text-amber-300'
                        }`}>
                        {gradeResult.message}
                    </div>
                    {!gradeResult.correct && (
                        <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                            <div>工程列照合: {gradeResult.isSequenceMatch ? '✅ 一致' : '❌ 不一致'}</div>
                            <div>操作回数照合: {gradeResult.isCountMatch ? '✅ 一致' : '❌ 不一致'}</div>
                            <div>最終状態照合: {gradeResult.isStateMatch ? '✅ 一致' : '❌ 不一致'}</div>
                            <div className="pt-1 text-slate-600">
                                記録工程数: {gradeResult.detail.userCount} / 目標: {gradeResult.detail.answerCount}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- 正解表示 --- */}
            {showAnswer && currentProblem && (
                <div className="bg-surface-800/60 rounded-lg p-2.5 border border-slate-600/20">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-medium">
                        正解工程
                    </div>
                    <div className="space-y-0.5">
                        {compressedAnswer.map((item, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-slate-600 font-mono w-5 text-right">{i + 1}.</span>
                                <span className={`${i < compressedLog.length && compressedLog[i].token === item.token
                                    ? (compressedLog[i].count === item.count ? 'text-emerald-400' : 'text-amber-400')
                                    : i < compressedLog.length
                                        ? 'text-red-400'
                                        : 'text-slate-400'
                                    }`}>
                                    {ACTION_LABELS[item.token] || item.token}
                                    <span className="opacity-70 ml-1">×{item.count}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
