import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import type { ChannelType, FormalityLevel } from '../../types';

const CHANNEL_TYPES: { value: ChannelType; label: string }[] = [
  { value: 'news_media', label: '전문 보도 매체' },
  { value: 'vertical_curation', label: '버티컬/큐레이션' },
  { value: 'brand_corporate', label: '브랜드/기업' },
  { value: 'creator_newsletter', label: '개인/뉴스레터' },
];

const FORMALITY: { value: FormalityLevel; label: string; desc: string }[] = [
  { value: 'strict', label: '엄격', desc: '검수 기준 최대 — 위반 시 발행 차단' },
  { value: 'standard', label: '표준', desc: '균형' },
  { value: 'casual', label: '캐주얼', desc: '핵심 규칙만, 톤 자유' },
];

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors';

export function GroupSetup({ onCreated, onCancel }: { onCreated: (groupId: string) => void; onCancel: () => void }) {
  const { addGroup } = useCampaigns();
  const [name, setName] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('news_media');
  const [formalityLevel, setFormalityLevel] = useState<FormalityLevel>('standard');
  const [character, setCharacter] = useState('');
  const [audience, setAudience] = useState('');
  const [toneBase, setToneBase] = useState('');

  const save = () => {
    if (!name.trim()) return;
    const g = addGroup(name.trim(), { channelType, formalityLevel, character, audience, toneBase });
    onCreated(g.id);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <p className="text-xs font-mono uppercase tracking-wide text-slate-400">새 배포 그룹</p>
      <h1 className="mt-1 mb-6 text-2xl font-bold text-slate-900">그룹 만들기</h1>

      <div className="max-w-lg space-y-5 rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">그룹 이름 (회사/매체) *</label>
          <input autoFocus className={inputCls} value={name} placeholder="예: allkpop" onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">배포 채널 유형</label>
          <div className="grid grid-cols-2 gap-1">
            {CHANNEL_TYPES.map(t => (
              <button key={t.value} onClick={() => setChannelType(t.value)}
                className={`rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${channelType === t.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">전문성·격식 수준 <span className="text-xs text-slate-400">(④검수 엄격도 연동)</span></label>
          <div className="flex gap-1">
            {FORMALITY.map(f => (
              <button key={f.value} onClick={() => setFormalityLevel(f.value)} title={f.desc}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${formalityLevel === f.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">{FORMALITY.find(f => f.value === formalityLevel)?.desc}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">채널 성격</label>
          <input className={inputCls} value={character} placeholder="예: K-pop 전문 영문 매체" onChange={e => setCharacter(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">타겟 독자</label>
          <input className={inputCls} value={audience} placeholder="예: 글로벌 K-pop 팬" onChange={e => setAudience(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">전반 톤·스타일</label>
          <input className={inputCls} value={toneBase} placeholder="예: 팩트 중심, 중립적, 속보형" onChange={e => setToneBase(e.target.value)} />
        </div>
        <p className="text-xs text-slate-400">배포 맥락은 하위 모든 캠페인에 상속됩니다.</p>

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!name.trim()}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">그룹 생성</button>
          <button onClick={onCancel} className="rounded-full px-5 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
        </div>
      </div>
    </div>
  );
}
