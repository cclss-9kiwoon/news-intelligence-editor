import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import type { ChannelType } from '../../types';

const CHANNEL_TYPES: { value: ChannelType; label: string }[] = [
  { value: 'x', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'web', label: 'Web/CMS' },
];

type DraftChannel = { type: ChannelType; handle: string };

export function GroupSetup({ onCreated, onCancel }: { onCreated: (groupId: string) => void; onCancel: () => void }) {
  const { addGroup } = useCampaigns();
  const [name, setName] = useState('');
  const [channels, setChannels] = useState<DraftChannel[]>([]);
  const [type, setType] = useState<ChannelType>('x');
  const [handle, setHandle] = useState('');

  const addCh = () => {
    if (!handle.trim()) return;
    setChannels(prev => [...prev, { type, handle: handle.trim() }]);
    setHandle('');
  };

  const save = () => {
    if (!name.trim()) return;
    const g = addGroup(name.trim(), channels);
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
          <label className="mb-1 block text-sm font-medium text-slate-600">연결 채널 (선택)</label>
          <div className="mb-2 space-y-1">
            {channels.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2 text-sm text-slate-700">
                <span>{CHANNEL_TYPES.find(t => t.value === c.type)?.label} · {c.handle}</span>
                <button onClick={() => setChannels(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500">🗑</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <select className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-sm" value={type} onChange={e => setType(e.target.value as ChannelType)}>
              {CHANNEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              className="flex-1 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              placeholder="@handle 또는 URL"
              value={handle}
              onChange={e => setHandle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCh(); }}
            />
            <button onClick={addCh} className="rounded-lg bg-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-300">추가</button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            disabled={!name.trim()}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >그룹 생성</button>
          <button onClick={onCancel} className="rounded-full px-5 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
        </div>
      </div>
    </div>
  );
}
