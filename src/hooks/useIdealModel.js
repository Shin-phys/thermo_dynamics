// ====================================================
// 理想気体モデルの状態管理（教科書モデル・練習問題で共用）
// ====================================================
import { useCallback, useMemo, useState } from 'react';
import { computeProcess } from '../physics/model.js';

const DEFAULT_START = { V: 1.0, P: 1.0 };

export function useIdealModel() {
  const [model, setModel] = useState({ start: DEFAULT_START, steps: [] });

  const current = model.steps.length ? model.steps[model.steps.length - 1].to : model.start;

  /** 過程を1回実行する。実行できなければ理由の文字列を返す */
  const perform = useCallback((processId) => {
    const s = model.steps.length ? model.steps[model.steps.length - 1].to : model.start;
    const r = computeProcess(s, processId);
    if (r.error) return r.error;
    setModel((m) => ({
      ...m,
      steps: [...m.steps, { processId, from: s, to: r.to, Q: r.Q, W: r.W, dU: r.dU }],
    }));
    return null;
  }, [model]);

  const undo = useCallback(() => {
    setModel((m) => ({ ...m, steps: m.steps.slice(0, -1) }));
  }, []);

  const reset = useCallback((start = DEFAULT_START) => {
    setModel({ start, steps: [] });
  }, []);

  const totals = useMemo(() => {
    let Q = 0; let W = 0; let Qin = 0; let Qout = 0;
    for (const st of model.steps) {
      Q += st.Q; W += st.W;
      if (st.Q > 0) Qin += st.Q; else Qout += st.Q;
    }
    return { Q, W, Qin, Qout };
  }, [model.steps]);

  return {
    start: model.start,
    steps: model.steps,
    current,
    lastStep: model.steps[model.steps.length - 1] ?? null,
    totals,
    perform,
    undo,
    reset,
  };
}
