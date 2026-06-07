import { Component, type ReactNode } from 'react';

/**
 * 에러 바운더리 — 하위 트리 크래시가 전체 흰화면 되지 않게 격리.
 * 렌더/이펙트 예외를 잡아 폴백 UI 표시(새로고침 안내). 콘솔에 원본 에러 보존.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary] caught', this.props.label ?? '', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white text-center">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-lg font-bold text-slate-800">일시적인 오류가 발생했습니다</h2>
          <p className="max-w-sm text-sm text-slate-500">
            화면을 그리는 중 문제가 생겼어요. 데이터는 보존됩니다 — 새로고침하면 복구됩니다.
          </p>
          <pre className="max-w-md overflow-x-auto rounded bg-slate-50 px-3 py-2 text-[11px] text-slate-400">{this.state.error.message}</pre>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >다시 시도</button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >새로고침</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
