// 1画面レイアウトの格子上の置き場所（幅 1024px 以上）。
// 1024px 未満では DOM の順（装置 → 操作 → グラフ → 右パネル）に縦に並ぶ。
export const AREA = {
  apparatus: 'lg:col-start-1 lg:row-start-1 min-h-0 flex flex-col',
  graph: 'lg:col-start-2 lg:row-start-1 min-h-0 flex flex-col',
  controls: 'lg:col-start-1 lg:col-span-2 lg:row-start-2',
  side: 'lg:col-start-3 lg:row-start-1 lg:row-span-2 min-h-0 flex flex-col',
};
