/**
 * 칸반 보드 비주얼 프리미티브 — 의존성 없는 순수 표시 컴포넌트.
 * Engineer가 골든타임 값/리듬 수치를 KanbanBoard에 노출하면 끼워 쓴다.
 * 로직 없음(계산값을 prop으로 받음). 기존 Pasta 글래스/말랑 무드 유지.
 */

// 남은 시간 포맷: ms → "4h 12m" / "12m" / "곧 만료"
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '만료';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '곧 만료';
}

export type GoldenTimeState = 'ok' | 'warning' | 'expired';

/**
 * ① 골든타임 막대 — Task.goldenTime 계약에 맞춤.
 * percent(0~100) + state('ok'|'warning'|'expired') + remainingMs(라벨용).
 * 색: ok=초록 / warning=앰버 / expired=빨강. warning·expired는 펄스 경고.
 */
export function GoldenTimeBar({ remainingMs, percent, state, className = '' }: {
  remainingMs: number; percent: number; state: GoldenTimeState; className?: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const urgent = state !== 'ok';
  const fill = state === 'ok' ? 'bg-emerald-500' : state === 'warning' ? 'bg-amber-500' : 'bg-red-500';
  const text = state === 'ok' ? 'text-emerald-600' : state === 'warning' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-400">골든타임</span>
        <span className={`font-semibold ${text} ${urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}>
          {state === 'expired' ? '만료' : formatRemaining(remainingMs)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${fill} ${urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 리듬 게이지 칩 — "이번 시간 2/3 처리" 류. 글래스 칩 + 미니 진행 게이지.
 * value/max 받아 채움. 라벨은 자유.
 */
export function GaugeChip({ label, value, max, className = '' }: {
  label: string; value: number; max: number; className?: string;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const full = ratio >= 1;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-3 py-1 text-xs text-slate-600 backdrop-blur-md ${className}`}>
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-slate-200/80">
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${full ? 'bg-emerald-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
      <span className="font-mono text-[11px] text-slate-500">{value}/{max}</span>
    </span>
  );
}

/**
 * 정보 칩 — 리듬바 보조 수치(① 대기 7건, 수집 84건, 다음 승급 18분 등).
 * 글래스 톤 통일.
 */
export function InfoChip({ children, tone = 'neutral', className = '' }: {
  children: React.ReactNode; tone?: 'neutral' | 'blue' | 'amber'; className?: string;
}) {
  const toneCls = tone === 'blue'
    ? 'border-blue-200/70 bg-blue-50/70 text-blue-700'
    : tone === 'amber'
      ? 'border-amber-200/80 bg-amber-50/80 text-amber-700'
      : 'border-white/60 bg-white/55 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs backdrop-blur-md ${toneCls} ${className}`}>
      {children}
    </span>
  );
}
