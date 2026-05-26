import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { loadJson, saveJson } from '../lib/storage';

type Props = {
  storageKey: string;
  defaultTopFraction?: number;
  minTopPx?: number;
  minBottomPx?: number;
  topCollapsed?: boolean;
  top: ReactNode;
  bottom: ReactNode;
};

type Persisted = { fraction: number };

export function VerticalSplitter({
  storageKey,
  defaultTopFraction = 0.62,
  minTopPx = 120,
  minBottomPx = 120,
  topCollapsed = false,
  top,
  bottom,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fraction, setFraction] = useState<number>(
    () => loadJson<Persisted>(storageKey, { fraction: defaultTopFraction }).fraction
  );
  const draggingRef = useRef(false);

  useEffect(() => { saveJson(storageKey, { fraction }); }, [storageKey, fraction]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (topCollapsed) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [topCollapsed]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const total = rect.height;
    if (total <= 0) return;
    let next = y / total;
    const minTop = minTopPx / total;
    const minBottom = minBottomPx / total;
    next = Math.max(minTop, Math.min(1 - minBottom, next));
    setFraction(next);
  }, [minTopPx, minBottomPx]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const onDoubleClick = useCallback(() => {
    setFraction(defaultTopFraction);
  }, [defaultTopFraction]);

  const topStyle = topCollapsed
    ? { flex: '0 0 auto' as const }
    : { flex: `${fraction} 1 0` };
  const bottomStyle = topCollapsed
    ? { flex: '1 1 0' as const }
    : { flex: `${1 - fraction} 1 0` };

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 overflow-hidden" style={topStyle}>{top}</div>

      {!topCollapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          className="group flex h-1.5 cursor-row-resize items-center justify-center bg-slate-200 hover:bg-indigo-400 active:bg-indigo-500 transition-colors"
          title="드래그로 높이 조절 · 더블클릭 리셋"
        >
          <div className="h-0.5 w-12 rounded-full bg-slate-400 group-hover:bg-white" />
        </div>
      )}

      <div className="min-h-0 overflow-hidden" style={bottomStyle}>{bottom}</div>
    </div>
  );
}
