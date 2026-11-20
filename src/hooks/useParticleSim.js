// ====================================================
// 粒子モデルの実行ループ（表示用の統計は 10 回/秒で React に渡す）
// ====================================================
import { useCallback, useEffect, useState } from 'react';
import { ParticleSim, N_REF } from '../physics/particleSim.js';

const FRAME_MS = 1000 / 60;

export function useParticleSim(active) {
  const [sim] = useState(() => new ParticleSim(N_REF));
  const [stats, setStats] = useState(() => sim.stats());

  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let n = 0;
    const loop = (now) => {
      acc += Math.min(100, now - last);
      last = now;
      let k = 0;
      while (acc >= FRAME_MS && k < 4) {
        sim.step();
        acc -= FRAME_MS;
        k += 1;
      }
      if (k === 4) acc = 0;
      n += 1;
      if (n % 6 === 0) setStats(sim.stats());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, sim]);

  const refresh = useCallback(() => setStats(sim.stats()), [sim]);
  return { sim, stats, refresh };
}
