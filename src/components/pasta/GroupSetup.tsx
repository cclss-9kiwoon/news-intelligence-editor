import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import type { GroupTargetType } from '../../types';

const TARGET_TYPES: { value: GroupTargetType; label: string }[] = [
  { value: 'media', label: '매체' },
  { value: 'blog', label: '개인 블로그' },
  { value: 'medium', label: 'Medium' },
  { value: 'other', label: '기타' },
];

export function GroupSetup({ onCreated, onCancel }: { onCreated: (groupId: string) => void; onCancel: () => void }) {
  const { addGroup } = useCampaigns();
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<GroupTargetType>('media');
  const [identity, setIdentity] = useState('');
  const [audience, setAudience] = useState('');
  const [toneBase, setToneBase] = useState('');

  const save = () => {
    if (!name.trim()) return;
    const g = addGroup(name.trim(), { targetType, identity, audience, toneBase });
    onCreated(g.id);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <p className="text-xs font-mono uppercase tracking-wide text-slate-400">새 배포 그룹</p>
      <h1 className="mt-1 mb-6 text-2xl font-bold text-slate-900">그룹 만들기</h1>

      <div className="max-w-lg space-y-5 rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">그룹 이름 (회사/매체) *</label>
          <input
            autoFocus
            className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            value={name}
            placeholder="예: allkpop"
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">배포 대상 유형</label>
          <div className="flex gap-1">
            {TARGET_TYPES.map(t => (
              <button key={t.value} onClick={() => setTargetType(t.value)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${targetType === t.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">플랫폼 성격</label>
          <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
            value={identity} placeholder="예: K-pop 전문 영문 매체" onChange={e => setIdentity(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">타겟 독자</label>
          <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
            value={audience} placeholder="예: 글로벌 K-pop 팬" onChange={e => setAudience(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">전반 톤·스타일</label>
          <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
            value={toneBase} placeholder="예: 팩트 중심, 중립적, 속보형" onChange={e => setToneBase(e.target.value)} />
        </div>
        <p className="text-xs text-slate-400">배포 맥락은 하위 모든 캠페인의 기본 컨텍스트로 상속됩니다.</p>

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!name.trim()}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">그룹 생성</button>
          <button onClick={onCancel} className="rounded-full px-5 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
        </div>
      </div>
    </div>
  );
}
