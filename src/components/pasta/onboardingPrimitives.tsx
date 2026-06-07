/**
 * 온보딩/코치마크 비주얼 프리미티브 — 의존성 없는 순수 표시 컴포넌트.
 * Engineer가 온보딩 흐름 구조(스텝 상태·위치·핸들러)를 깔면 여기에 끼운다.
 * 로직/상태 없음(전부 prop). 절제된 톤 + 건너뛰기 명확. Pasta 글래스·말랑 무드.
 */
import type { ReactNode } from 'react';

/** 스텝 점 — 현재 단계는 넓은 pill, 나머지는 점. */
export function StepDots({ total, current, className = '' }: { total: number; current: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-label={`${current + 1}/${total} 단계`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'w-4 bg-blue-500' : i < current ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-white/40'
          }`}
        />
      ))}
    </span>
  );
}

/**
 * 코치마크 말풍선 — 다크 글래스 버블. 제목 + "왜 필요한지" 1줄 + 스텝점 + [건너뛰기]/[다음].
 * 위치 지정은 호출부(앵커 래퍼)가 담당. arrow 방향은 prop.
 */
export function Coachmark({
  step, total, title, why, onSkip, onNext, onPrev, isLast, arrow = 'top', className = '',
}: {
  step: number; total: number; title: string; why: ReactNode;
  onSkip: () => void; onNext: () => void; onPrev?: () => void; isLast?: boolean;
  arrow?: 'top' | 'bottom' | 'left' | 'right'; className?: string;
}) {
  const arrowCls = {
    top: 'left-6 -top-1.5',
    bottom: 'left-6 -bottom-1.5',
    left: 'top-5 -left-1.5',
    right: 'top-5 -right-1.5',
  }[arrow];
  return (
    <div className={`pasta-pop relative w-72 rounded-2xl bg-slate-900/95 p-4 text-white shadow-xl backdrop-blur-md ${className}`} role="dialog" aria-label={title}>
      <span className={`absolute h-3 w-3 rotate-45 bg-slate-900/95 ${arrowCls}`} />
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/70">{why}</p>
      <div className="mt-3 flex items-center justify-between">
        <StepDots total={total} current={step} />
        <span className="flex items-center gap-2">
          <button onClick={onSkip} className="text-xs text-white/50 hover:text-white/80 transition-colors">건너뛰기</button>
          {onPrev && step > 0 && (
            <button onClick={onPrev} className="rounded-full px-2.5 py-1 text-xs font-semibold text-white/70 hover:bg-white/10">이전</button>
          )}
          <button onClick={onNext} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 hover:bg-white/90 transition-colors">
            {isLast ? '시작하기' : '다음'}
          </button>
        </span>
      </div>
    </div>
  );
}

/**
 * 빈 상태 안내 — 캠페인 0개일 때. 소프트 일러스트(마스코트) + 설명 + 예시 칩 + CTA.
 */
export function EmptyHint({
  title, desc, examples = [], ctaLabel, onCreate, className = '',
}: {
  title: string; desc: string; examples?: string[]; ctaLabel: string; onCreate: () => void; className?: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-8 text-center ${className}`}>
      <div className="pasta-float pasta-pop mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl shadow-lg shadow-slate-900/10">🍝</div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{desc}</p>
      {examples.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {examples.map((ex, i) => (
            <span key={i} className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-0.5 text-xs font-medium text-slate-500">{ex}</span>
          ))}
        </div>
      )}
      <button onClick={onCreate} className="pasta-springy mt-5 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 hover:shadow-md">
        {ctaLabel}
      </button>
    </div>
  );
}

/**
 * 주제 정의 ❌/✅ 예시 대비 — 좋은 정의 유도. 주제정의 입력칸 아래 등에 배치.
 */
export function TopicExample({ bad, good, className = '' }: { bad: string; good: string; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${className}`}>
      <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
        <p className="mb-0.5 text-[11px] font-bold text-red-500">❌ 너무 넓음</p>
        <p className="text-xs leading-relaxed text-slate-600">{bad}</p>
      </div>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
        <p className="mb-0.5 text-[11px] font-bold text-emerald-600">✅ 구체적 (소수정예)</p>
        <p className="text-xs leading-relaxed text-slate-600">{good}</p>
      </div>
    </div>
  );
}

/**
 * 빈 주제정의 경고 — "필터 없음, 너무 많이 들어옵니다". 절제된 앰버 인라인.
 */
export function EmptyTopicWarning({ className = '' }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      주제 정의 비어 있음 — 필터가 없어 관련 없는 기사까지 많이 들어옵니다.
    </p>
  );
}
