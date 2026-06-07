import { useState } from 'react';
import { useArticles } from '../../state/ArticlesContext';
import type { Task } from '../../types';

/**
 * 태스크 소스 상세 패널 — CampaignWorkspace 좌측에서 사용.
 * 이 태스크가 어떤 원문(대표) 기사에서 왔고, 서브 출처가 무엇인지 보여준다.
 * 매체명·전체 제목·발행일·원문 링크·전문/스니펫 여부·전문 펼쳐보기·이미지 썸네일.
 */
export function TaskSourcePanel({ task }: { task: Task }) {
  const { articles } = useArticles();
  const [openId, setOpenId] = useState<string | null>(null);

  // 대표(원문) = 제목이 태스크 대표 제목과 일치하는 출처, 없으면 첫 번째
  const repId = task.sources.find(s => s.title === task.title)?.articleId ?? task.sources[0]?.articleId;

  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
        원문 출처 ({task.sources.length})
      </h4>
      <div className="space-y-1.5">
        {task.sources.map(s => {
          const a = articles.find(x => x.id === s.articleId);
          const isRep = s.articleId === repId;
          const open = openId === s.articleId;
          const snippet = a?.fullText || a?.description || '';
          const link = a?.link && a.link.startsWith('http') ? a.link : null;
          const imgs = a?.images ?? [];
          return (
            <div key={s.articleId} className="rounded-lg border border-slate-100 bg-white/70 px-2.5 py-2 text-xs">
              {/* 헤더: 대표/서브 + 매체 + 전문여부 */}
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${isRep ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                  {isRep ? '대표' : '서브'}
                </span>
                <span className="font-semibold text-slate-700">{s.source}</span>
                <span className={`ml-auto rounded px-1 text-[9px] ${s.hasFullText ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.hasFullText ? '전문' : '스니펫'}
                </span>
              </div>

              {/* 제목 (전체) */}
              <p className="mt-1 leading-snug text-slate-800">{s.title}</p>

              {/* 메타: 발행일 + 원문 링크 */}
              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                {a?.pubDate && <span>{a.pubDate}</span>}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">원문 보기 ↗</a>
                )}
                {snippet && (
                  <button onClick={() => setOpenId(open ? null : s.articleId)} className="text-slate-500 hover:underline">
                    {open ? '본문 접기' : '본문 펼치기'}
                  </button>
                )}
              </div>

              {/* 데이터 없음 (다른 세션 수집 등으로 현재 메모리에 원문 없음) */}
              {!a && (
                <p className="mt-1 text-[10px] text-slate-300">원문 데이터 없음 (현재 세션 미수집)</p>
              )}

              {/* 펼친 본문 */}
              {open && snippet && (
                <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                  {snippet.slice(0, 1500)}{snippet.length > 1500 ? '…' : ''}
                </p>
              )}

              {/* 이미지 썸네일 */}
              {imgs.length > 0 && (
                <div className="mt-1.5 flex gap-1 overflow-x-auto">
                  {imgs.slice(0, 6).map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt={img.alt || ''}
                      className="h-10 w-14 flex-none rounded object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {task.sources.length === 0 && <p className="text-xs text-slate-300">출처 없음</p>}
      </div>
    </div>
  );
}
