import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import { HelpTip } from './HelpTip';
import type { ChannelType, FormalityLevel } from '../../types';

const CHANNEL_TYPES: { value: ChannelType; label: string; icon: string; desc: string }[] = [
  { value: 'news_media', label: '전문 보도 매체', icon: '📰', desc: '뉴스룸 · 속보 중심' },
  { value: 'vertical_curation', label: '버티컬/큐레이션', icon: '🎯', desc: '특정 주제 심화' },
  { value: 'brand_corporate', label: '브랜드/기업', icon: '🏢', desc: '공식 채널 톤' },
  { value: 'creator_newsletter', label: '개인/뉴스레터', icon: '✍️', desc: '크리에이터 보이스' },
];

const FORMALITY: { value: FormalityLevel; label: string; desc: string; active: string; dot: string }[] = [
  { value: 'strict',   label: '엄격',   desc: '검수 기준 최대 — 위반 시 발행 차단', active: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 'standard', label: '표준',   desc: '균형', active: 'border-indigo-500 bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  { value: 'casual',   label: '캐주얼', desc: '핵심 규칙만, 톤 자유', active: 'border-slate-400 bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
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
          <label className="mb-1.5 block text-sm font-medium text-slate-600">배포 채널 유형<HelpTip text="이 채널이 어떤 곳인지에 따라 주제 선정·작성 톤·검수 기준이 자동으로 달라집니다. 전문 보도 매체일수록 팩트·검수가 엄격, 개인 채널일수록 자유롭습니다." /></label>
          <div className="grid grid-cols-2 gap-2">
            {CHANNEL_TYPES.map(t => (
              <button key={t.value} onClick={() => setChannelType(t.value)}
                className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all ${channelType === t.value ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'}`}>
                <span className="text-base leading-none">{t.icon}</span>
                <span className="text-sm font-semibold">{t.label}</span>
                <span className={`text-[10px] ${channelType === t.value ? 'text-white/60' : 'text-slate-400'}`}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">전문성·격식 수준 <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">④검수 엄격도 연동</span><HelpTip text="검수 엄격도를 결정합니다. 엄격 = 모든 검수 항목 위반 시 발행 차단 / 표준 = 위반 시 주의 표시 / 캐주얼 = 핵심만 검사, 톤 자유." /></label>
          <div className="flex gap-1.5">
            {FORMALITY.map(f => (
              <button key={f.value} onClick={() => setFormalityLevel(f.value)} title={f.desc}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${formalityLevel === f.value ? f.active : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${formalityLevel === f.value ? f.dot : 'bg-slate-300'}`} />
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">{FORMALITY.find(f => f.value === formalityLevel)?.desc}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">채널 성격<HelpTip text="이 채널이 무엇을 다루는 곳인지. 주제 선정·글 방향에 반영됩니다. (예: K-pop 전문 영문 매체)" /></label>
          <input className={inputCls} value={character} placeholder="예: K-pop 전문 영문 매체" onChange={e => setCharacter(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">타겟 독자<HelpTip text="누가 읽는지. 주제 선정·톤·난이도에 반영됩니다. (예: 글로벌 K-pop 팬)" /></label>
          <input className={inputCls} value={audience} placeholder="예: 글로벌 K-pop 팬" onChange={e => setAudience(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">전반 톤·스타일<HelpTip text="모든 기사의 문체 기본값입니다. (예: 팩트 중심, 중립적)" /></label>
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
