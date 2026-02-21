// ====================================================
// App.jsx: メインアプリケーション
// 3モード（Textbook / Practice / Reality）を統合
// ====================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useIdealGasModel } from './hooks/useIdealGasModel';
import { useRealityGasModel } from './hooks/useRealityGasModel';
import { useAnimationLoop } from './hooks/useAnimationLoop';
import { ACTION_TOKENS, DELTA_V, DELTA_T } from './utils/physics';
import Chamber from './components/Chamber';
import PVDiagram from './components/PVDiagram';
import VelocityDistribution from './components/VelocityDistribution';
import ControlPanel from './components/ControlPanel';
import StateDisplay, { CurrentStateDisplay, RecentActionDisplay, CumulativeDisplay } from './components/StateDisplay';
import PracticePanel from './components/PracticePanel';

// --- モード定義 ---
const MODES = [
  { id: 'textbook', label: 'Textbook', icon: '📘', desc: '理想モデル' },
  { id: 'practice', label: 'Practice', icon: '✏️', desc: '練習問題' },
  { id: 'reality', label: 'Reality', icon: '🔬', desc: '現実モデル' },
];

export default function App() {
  // === グローバル状態 ===
  const [currentMode, setCurrentMode] = useState('textbook');
  const [boundary, setBoundary] = useState('fixed');       // 'fixed' | 'released_balance' | 'released_external'
  const [thermal, setThermal] = useState('free');           // デフォルトを自由にする

  // === 理想モデル（Textbook / Practice 共用） ===
  const idealModel = useIdealGasModel();

  // === Practice 専用 ===
  const [currentProblem, setCurrentProblem] = useState(null);

  // === Reality モデル ===
  const realityModel = useRealityGasModel();
  const realityRenderRef = useRef(null); // Reality描画データ

  // === Reality アニメーション ===
  const animCallback = useCallback((dt) => {
    if (currentMode !== 'reality') return;
    const renderData = realityModel.step(dt * 60); // 60fps相当にスケール
    if (renderData) {
      realityRenderRef.current = renderData;
    }
  }, [currentMode, realityModel]);

  const { start: startAnim, stop: stopAnim, isRunning } = useAnimationLoop(animCallback);

  // Realityモードのアニメーション制御
  useEffect(() => {
    if (currentMode === 'reality') {
      if (!realityModel.particlesRef.current) {
        realityModel.reset(200);
      }
      startAnim();
    } else {
      stopAnim();
    }
    return () => stopAnim();
  }, [currentMode, startAnim, stopAnim, realityModel]);

  // === 操作ハンドラ（Textbook / Practice 共通） ===
  const handleAction = useCallback((buttonType) => {
    if (buttonType === 'undo') {
      idealModel.undo();
      return;
    }
    if (buttonType === 'reset') {
      idealModel.reset();
      return;
    }

    const token = idealModel.resolveAction(buttonType, boundary, thermal);
    if (token) {
      idealModel.performAction(token);
    }
  }, [idealModel, boundary, thermal]);

  // === Reality 操作ハンドラ ===
  const handleRealityAction = useCallback((buttonType) => {
    if (buttonType === 'reset') {
      realityModel.reset(realityModel.particleCount);
      return;
    }
    if (buttonType === 'volumeUp') {
      realityModel.changeVolume(DELTA_V);
    } else if (buttonType === 'volumeDown') {
      realityModel.changeVolume(-DELTA_V);
    } else if (buttonType === 'tempUp') {
      realityModel.changeTemperature(DELTA_T);
    } else if (buttonType === 'tempDown') {
      realityModel.changeTemperature(-DELTA_T);
    }
  }, [realityModel]);

  // === Practice 問題選択 ===
  const handleSelectProblem = useCallback((prob) => {
    idealModel.reset();
    setCurrentProblem(prob);
  }, [idealModel]);

  const handlePracticeReset = useCallback(() => {
    idealModel.reset();
  }, [idealModel]);

  // === ボタン有効/無効判定 ===
  const availableActions = idealModel.getAvailableActions(boundary, thermal);

  // Reality用の簡易AvailableActions
  const realityAvailable = {
    volumeUp: realityModel.V_rel < 2.0,
    volumeDown: realityModel.V_rel > 0.4,
    tempUp: true,
    tempDown: true,
    isobaricExpand: false,
    isobaricCompress: false,
    compositeEnabled: false,
    canUndo: false,
  };

  // === モード切替 ===
  const handleModeChange = useCallback((modeId) => {
    setCurrentMode(modeId);
    if (modeId === 'textbook' || modeId === 'practice') {
      idealModel.reset();
      setCurrentProblem(null);
    }
  }, [idealModel]);

  // === レンダリング ===
  return (
    <div className="min-h-screen bg-surface-900 text-slate-200 font-sans">
      {/* === ヘッダー === */}
      <header className="border-b border-slate-700/50 bg-surface-800/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* タイトル */}
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              🌡️ 熱力学第一法則
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              気体分子運動 · PV線図 · 速度分布シミュレーター
            </span>
          </div>

          {/* モード切替タブ */}
          <div className="flex gap-1 bg-surface-700/50 rounded-lg p-1 border border-slate-600/30">
            {MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                  ${currentMode === mode.id
                    ? 'bg-blue-600/80 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-600/50'
                  }`}
              >
                <span className="mr-1">{mode.icon}</span>
                <span className="hidden sm:inline">{mode.label}</span>
                <span className="sm:hidden">{mode.icon}</span>
              </button>
            ))}
          </div>
        </div>

        {/* モード説明バー */}
        <div className="max-w-[1400px] mx-auto px-4 pb-1.5">
          <div className="text-[10px] text-slate-500">
            {currentMode === 'textbook' && '📘 Textbook: 教科書的な理想気体モデル。操作に対して状態が一意に決まります。'}
            {currentMode === 'practice' && '✏️ Practice: 問題のPV図を再現してください。操作列の一致で採点します。'}
            {currentMode === 'reality' && '🔬 Reality: 粒子衝突ベースの現実モデル。圧力は衝突の力積から推定（揺れあり）。'}
          </div>
        </div>
      </header>

      {/* === メインコンテンツ === */}
      <main className="max-w-[1400px] mx-auto px-4 py-4">

        {/* --- Textbook / Practice モード --- */}
        {(currentMode === 'textbook' || currentMode === 'practice') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* --- 左カラム: Chamber + 現在の状態 (col-span-3) --- */}
            <div className="lg:col-span-3 space-y-3">
              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                  チャンバー
                </div>
                <div className="flex justify-center">
                  <Chamber
                    V_rel={idealModel.gasState.V_rel}
                    T_rel={idealModel.gasState.T_rel}
                    mode="ideal"
                  />
                </div>
              </div>

              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <CurrentStateDisplay
                  gasState={idealModel.gasState}
                  mode={currentMode}
                />
              </div>
            </div>

            {/* --- 中央カラム: グラフ + 履歴 (col-span-4) --- */}
            <div className="lg:col-span-4 space-y-3">
              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="flex justify-center">
                  <PVDiagram
                    pvTrace={idealModel.pvTrace}
                    currentState={idealModel.gasState}
                    targetPath={currentMode === 'practice' && currentProblem ? currentProblem.targetPath : null}
                    showIsotherms={true}
                    title={currentMode === 'practice' ? 'PV 線図（Practice）' : 'PV 線図'}
                  />
                </div>
              </div>

              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="flex justify-center">
                  <VelocityDistribution
                    T_rel={idealModel.gasState.T_rel}
                    mode="ideal"
                    title="速度分布（Maxwell-Boltzmann 理論）"
                  />
                </div>
              </div>

              {/* グラフ直下に直近の操作と累積値 */}
              <div className="grid grid-cols-2 gap-2">
                <RecentActionDisplay lastResult={idealModel.lastResult} />
                <CumulativeDisplay cumulative={idealModel.cumulative} />
              </div>
            </div>

            {/* --- 右カラム: 操作パネル (practice時は狭く col-span-2) --- */}
            <div className={`${currentMode === 'practice' ? 'lg:col-span-2' : 'lg:col-span-5'} space-y-3`}>
              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                  操作パネル
                </div>
                <ControlPanel
                  boundary={boundary}
                  thermal={thermal}
                  onBoundaryChange={setBoundary}
                  onThermalChange={setThermal}
                  onAction={handleAction}
                  availableActions={availableActions}
                  mode={currentMode}
                />
              </div>
            </div>

            {/* --- 第4カラム: Practice専用情報枠 (col-span-3) --- */}
            {currentMode === 'practice' && (
              <div className="lg:col-span-3 space-y-3">
                <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                    練習モード
                  </div>
                  <PracticePanel
                    actionLog={idealModel.actionLog}
                    currentGasState={idealModel.gasState}
                    onSelectProblem={handleSelectProblem}
                    currentProblem={currentProblem}
                    onReset={handlePracticeReset}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Reality モード --- */}
        {currentMode === 'reality' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* 左カラム: Chamber + 状態値 */}
            <div className="lg:col-span-3 space-y-3">
              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  チャンバー（粒子シミュレーション）
                </div>
                <div className="flex justify-center">
                  <Chamber
                    V_rel={realityModel.V_rel}
                    T_rel={realityModel.T_rel_display / 100}
                    mode="reality"
                    realityParticles={realityRenderRef.current?.particles || null}
                    realityChamberHeight={realityRenderRef.current?.chamberHeight || 300}
                  />
                </div>
              </div>

              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  推定状態値
                </div>
                <div className="space-y-2">
                  <div className="bg-surface-700/50 rounded-lg p-2.5 border border-slate-600/30">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">推定圧力 P</div>
                    <div className="text-lg font-mono font-semibold text-red-400 mt-0.5">
                      {(realityModel.P_estimated * 1.0).toFixed(3)}
                      <span className="text-[10px] text-slate-500 ml-1">×10⁵ Pa</span>
                    </div>
                    <div className="text-[9px] text-amber-500/60 mt-0.5">⚠️ 衝突から推定（揺れあり）</div>
                  </div>
                  <div className="bg-surface-700/50 rounded-lg p-2.5 border border-slate-600/30">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">体積 V</div>
                    <div className="text-lg font-mono font-semibold text-blue-400 mt-0.5">
                      {realityModel.V_rel.toFixed(2)}
                      <span className="text-[10px] text-slate-500 ml-1">L</span>
                    </div>
                  </div>
                  <div className="bg-surface-700/50 rounded-lg p-2.5 border border-slate-600/30">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">推定温度 T</div>
                    <div className="text-lg font-mono font-semibold text-amber-400 mt-0.5">
                      {realityModel.T_rel_display.toFixed(0)}
                      <span className="text-[10px] text-slate-500 ml-1">K</span>
                    </div>
                  </div>
                  <div className="bg-surface-700/50 rounded-lg p-2.5 border border-slate-600/30">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">粒子数 N</div>
                    <div className="text-lg font-mono font-semibold text-emerald-400 mt-0.5">
                      {realityModel.particleCount}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 中央カラム: PV図 + 速度分布 */}
            <div className="lg:col-span-4 space-y-3">
              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="flex justify-center">
                  <PVDiagram
                    pvTrace={realityModel.pvTrace}
                    currentState={{ V_rel: realityModel.V_rel, P_rel: realityModel.P_estimated }}
                    showIsotherms={true}
                    title="PV 線図（衝突から推定・揺れあり）"
                  />
                </div>
              </div>

              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="flex justify-center">
                  <VelocityDistribution
                    T_rel={realityModel.T_rel_display / 100}
                    mode="reality"
                    realityHistogram={realityModel.speedHistogramRef.current}
                    title="速度分布（実測ヒストグラム）"
                  />
                </div>
              </div>
            </div>

            {/* 右カラム: Controls */}
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-surface-800/60 rounded-xl p-3 border border-slate-700/30 backdrop-blur-sm">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium">操作パネル</div>
                <div className="mb-3">
                  <div className="text-[10px] text-slate-500 mb-1.5 font-medium">粒子数 N</div>
                  <div className="flex gap-1.5">
                    {[100, 200, 300].map(n => (
                      <button
                        key={n}
                        onClick={() => realityModel.reset(n)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all
                          ${realityModel.particleCount === n
                            ? 'bg-emerald-600/60 text-white border-emerald-400/50'
                            : 'bg-surface-700/60 text-slate-400 border-slate-600 hover:bg-surface-600/60'
                          }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleRealityAction('volumeUp')}
                    disabled={!realityAvailable.volumeUp}
                    className="px-3 py-2 rounded-lg text-xs font-medium border transition-all
                      bg-blue-900/40 text-blue-300 border-blue-600/50
                      hover:bg-blue-800/50 active:scale-95
                      disabled:bg-slate-700/30 disabled:text-slate-600 disabled:border-slate-700"
                  >
                    📈 体積 +
                  </button>
                  <button
                    onClick={() => handleRealityAction('volumeDown')}
                    disabled={!realityAvailable.volumeDown}
                    className="px-3 py-2 rounded-lg text-xs font-medium border transition-all
                      bg-blue-900/40 text-blue-300 border-blue-600/50
                      hover:bg-blue-800/50 active:scale-95
                      disabled:bg-slate-700/30 disabled:text-slate-600 disabled:border-slate-700"
                  >
                    📉 体積 −
                  </button>
                  <button
                    onClick={() => handleRealityAction('tempUp')}
                    className="px-3 py-2 rounded-lg text-xs font-medium border transition-all
                      bg-red-900/30 text-red-300 border-red-600/40
                      hover:bg-red-800/40 active:scale-95"
                  >
                    🔥 温度 +
                  </button>
                  <button
                    onClick={() => handleRealityAction('tempDown')}
                    className="px-3 py-2 rounded-lg text-xs font-medium border transition-all
                      bg-blue-900/40 text-blue-300 border-blue-600/50
                      hover:bg-blue-800/50 active:scale-95"
                  >
                    ❄️ 温度 −
                  </button>
                </div>

                <button
                  onClick={() => handleRealityAction('reset')}
                  className="w-full mt-2 px-3 py-1.5 rounded-md text-xs font-medium
                    bg-red-900/30 text-red-300 border border-red-600/40
                    hover:bg-red-800/40 active:scale-95 transition-all"
                >
                  🔄 Reset
                </button>

                <div className="mt-4 p-2.5 bg-amber-900/10 rounded-lg border border-amber-600/20">
                  <div className="text-[10px] text-amber-400/80 font-medium mb-1">
                    ⚠️ Realityモードについて
                  </div>
                  <div className="text-[9px] text-slate-500 leading-relaxed">
                    このモードでは粒子の衝突から圧力を推定しています。
                    統計的なゆらぎがあるため、Textbookモードの理想値とは異なります。
                    粒子数を増やすとゆらぎが小さくなることを確認してください。
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* === フッター === */}
      <footer className="border-t border-slate-700/30 mt-8 py-3">
        <div className="max-w-[1400px] mx-auto px-4 text-center text-[10px] text-slate-600">
          熱力学第一法則シミュレーター — 高校物理教育向け
          <span className="mx-2">·</span>
          ΔU = Q + W（気体になされた仕事表記）
        </div>
      </footer>
    </div>
  );
}
