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
      <p className="text-xs text-gray-400">그룹 (회사/매체)</p>
      <input
        className="mt-1 mb-6 w-full max-w-lg border-b border-transparent text-2xl font-bold hover:border-gray-300 focus:border-blue-500 focus:outline-none"
        value={group.name}
        onChange={e => renameGroup(group.id, e.target.value)}
      />

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800">📡 연결된 채널</h3>
        <p className="mb-4 text-xs text-gray-400">발행 시 배포 대상 (Phase 3에서 배포 연결)</p>

        <div className="space-y-1">
          {group.channels.length === 0 && (
            <p className="text-sm text-gray-400">아직 채널 없음</p>
          )}
          {group.channels.map(ch => (
            <div key={ch.id} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
              <span>{CHANNEL_TYPES.find(t => t.value === ch.type)?.label} · {ch.handle}</span>
              <button onClick={() => removeChannel(group.id, ch.id)} className="text-gray-300 hover:text-red-500">🗑</button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <select className="rounded border px-2 py-2 text-sm" value={type} onChange={e => setType(e.target.value as ChannelType)}>
            {CHANNEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="@handle 또는 URL"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && handle.trim()) { addChannel(group.id, { type, handle: handle.trim() }); setHandle(''); } }}
          />
          <button
            onClick={() => { if (handle.trim()) { addChannel(group.id, { type, handle: handle.trim() }); setHandle(''); } }}
            className="rounded bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-800"
          >추가</button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800">📋 캠페인 ({groupCampaigns.length})</h3>
        <div className="mt-2 space-y-1">
          {groupCampaigns.map(c => (
            <div key={c.id} className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">{c.name}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
