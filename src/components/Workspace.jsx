// ====================================================
// 画面の配置（PC・スマホ縦・スマホ横で切り替える）
//   PC       : 左に装置、中央に PV図、下に操作バー、右にタブのパネル
//   スマホ縦 : 上にタブ（装置／PV図／…）、下に操作バーを固定
//   スマホ横 : 左にタブで切り替える図、右に操作
//   タブレット縦（幅 640px 以上）では「装置とPV図」を左右に並べて表示する
// ====================================================
import { useState } from 'react';
import { Card, Tabs } from './Panels.jsx';
import { useLayoutMode, useMedia } from '../hooks/useCanvas.js';

/**
 * @param {object} props
 * @param {string} props.apparatusTitle
 * @param {React.ReactNode} props.apparatus 装置図
 * @param {React.ReactNode} props.graph PV図
 * @param {React.ReactNode} props.controls PC 用の操作バー
 * @param {React.ReactNode} props.compactControls スマホ用の操作バー
 * @param {{id:string,label:string,content:React.ReactNode}[]} props.panels 右パネル（スマホではタブ）
 * @param {{title:string, content:React.ReactNode}|null} props.pinned PC で右パネルの上に常に出すもの
 * @param {string|null} props.initialView スマホで最初に開く表示（'graph' など）
 */
export default function Workspace({
  apparatusTitle, apparatus, graph, controls, compactControls, panels, pinned = null, initialView = null,
}) {
  const layout = useLayoutMode();
  const roomy = useMedia('(min-width: 640px)');
  const [view, setView] = useState(initialView);

  if (layout === 'wide') {
    return (
      <main className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-3 grid gap-3
        grid-cols-[minmax(240px,23fr)_minmax(0,50fr)_minmax(300px,27fr)] grid-rows-[minmax(0,1fr)_auto]">
        <Card title={apparatusTitle} className="col-start-1 row-start-1 min-h-0 flex flex-col">{apparatus}</Card>
        <Card className="col-start-2 row-start-1 min-h-0 flex flex-col">{graph}</Card>
        <Card className="col-start-1 col-span-2 row-start-2">{controls}</Card>
        <Card className="col-start-3 row-start-1 row-span-2 min-h-0 flex flex-col">
          {pinned && (
            <div className="mb-3">
              <h2 className="text-base font-bold text-slate-100 mb-2">{pinned.title}</h2>
              {pinned.content}
            </div>
          )}
          <div className="flex-1 min-h-0"><Tabs tabs={panels} /></div>
        </Card>
      </main>
    );
  }

  // ---- スマホ・タブレット ----
  const both = roomy; // 幅に余裕があれば装置と PV図を並べる
  const figViews = both
    ? [{ id: 'fig', label: '装置とPV図' }]
    : [{ id: 'apparatus', label: '装置' }, { id: 'graph', label: 'PV図' }];
  const extra = pinned ? [{ id: 'pinned', label: pinned.title, content: pinned.content }] : [];
  const allPanels = [...extra, ...panels];
  const views = [...figViews, ...allPanels.map((p) => ({ id: p.id, label: p.label }))];
  const cur = views.some((v) => v.id === view) ? view : views[0].id;

  let content;
  if (cur === 'fig') {
    content = (
      <div className="h-full flex gap-2">
        <div className="basis-[38%] min-w-0 min-h-0 flex flex-col rounded-xl border border-slate-700/60 bg-slate-900/70 p-2">{apparatus}</div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col rounded-xl border border-slate-700/60 bg-slate-900/70 p-2">{graph}</div>
      </div>
    );
  } else if (cur === 'apparatus') {
    content = <div className="h-full flex flex-col rounded-xl border border-slate-700/60 bg-slate-900/70 p-2">{apparatus}</div>;
  } else if (cur === 'graph') {
    content = <div className="h-full flex flex-col rounded-xl border border-slate-700/60 bg-slate-900/70 p-2">{graph}</div>;
  } else {
    const p = allPanels.find((x) => x.id === cur);
    content = (
      <div className="h-full overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/70 p-3 space-y-4">
        {p.content}
      </div>
    );
  }

  const landscape = layout === 'landscape';
  return (
    <main className={`flex-1 min-h-0 w-full flex ${landscape ? 'flex-row' : 'flex-col'}`}>
      <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-2 p-2">
        <div className="flex gap-1 overflow-x-auto shrink-0" role="tablist" aria-label="表示の切り替え">
          {views.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === cur} onClick={() => setView(v.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm whitespace-nowrap border
                ${v.id === cur ? 'bg-sky-600 border-sky-400 text-white font-semibold' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">{content}</div>
      </div>
      <div className={landscape
        ? 'w-[min(360px,45vw)] shrink-0 overflow-y-auto border-l border-slate-800'
        : 'shrink-0 border-t border-slate-800'}>
        {compactControls}
      </div>
    </main>
  );
}
