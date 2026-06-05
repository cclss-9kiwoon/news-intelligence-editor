/**
 * 재사용 (?) 도움말 툴팁.
 * 라벨 옆 인라인 배치. hover + focus(키보드/터치) 모두 노출 — JS state 불필요.
 * Pasta 전역 (그룹 설정 / 캠페인 4단계 설정) 에서 공용 사용.
 *
 * 사용:
 *   <label>소스 검증 강도 <HelpTip text="교차검증=2개 이상 매체 확인 시에만 통과" /></label>
 */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative ml-1 inline-flex align-middle">
      <button
        type="button"
        aria-label={`도움말: ${text}`}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 transition-colors group-hover/tip:bg-indigo-100 group-hover/tip:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:bg-indigo-100 focus-visible:text-indigo-600"
      >?</button>
      {/* 말풍선 — hover 또는 focus 시 노출 */}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100"
      >
        {text}
        {/* 아래쪽 화살표 */}
        <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-slate-900" />
      </span>
    </span>
  );
}
