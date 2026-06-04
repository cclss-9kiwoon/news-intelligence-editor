import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import type { Group, ChannelType } from '../../types';

const CHANNEL_TYPES: { value: ChannelType; label: string }[] = [
  { value: 'x', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'web', label: 'Web/CMS' },
];

export function GroupPanel({ group }: { group: Group }) {
  const { renameGroup, addChannel, removeChannel, campaigns } = useCampaigns();
  const [type, setType] = useState<ChannelType>('x');
  const [handle, setHandle] = useState('');

  const groupCampaigns = campaigns.filter(c => c.groupId === group.id);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <p className="text-xs font-mono uppercase tracking-wide text-slate-400">그룹 (회사/매체)</p>
      <input
        className="mt-1 mb-6 w-full max-w-lg border-b border-transparent bg-transparent text-2xl font-bold text-slate-900 hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
        value={group.name}
        onChange={e => renameGroup(group.id, e.target.value)}
      />

      <div className="mb-5 rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <h3 className="font-bold text-slate-800">📡 연결된 채널</h3>
        <p className="mb-4 text-xs text-slate-400">발행 시 배포 대상 (Phase 3에서 배포 연결)</p>

        <div className="space-y-1">
          {group.channels.length === 0 && (
            <p className="text-sm text-slate-400">아직 채널 없음</p>
          )}
          {group.channels.map(ch => (
            <div key={ch.id} className="flex items-center justify-between rounded-lg bg-white/60 border border-slate-100 px-3 py-2 text-sm text-slate-700">
              <span>{CHANNEL_TYPES.find(t => t.value === ch.type)?.label} · {ch.handle}</span>
              <button onClick={() => removeChannel(group.id, ch.id)} className="text-slate-300 hover:text-red-500 transition-colors">🗑</button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <select className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors" value={type} onChange={e => setType(e.target.value as ChannelType)}>
            {CHANNEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            className="flex-1 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
            placeholder="@handle 또는 URL"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && handle.trim()) { addChannel(group.id, { type, handle: handle.trim() }); setHandle(''); } }}
          />
          <button
            onClick={() => { if (handle.trim()) { addChannel(group.id, { type, handle: handle.trim() }); setHandle(''); } }}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >추가</button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <h3 className="font-bold text-slate-800">📋 캠페인 ({groupCampaigns.length})</h3>
        <div className="mt-2 space-y-1">
          {groupCampaigns.map(c => (
            <div key={c.id} className="rounded-lg bg-white/60 border border-slate-100 px-3 py-2 text-sm text-slate-700">{c.name}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
