import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import type { Group } from '../../types';

export function GroupPanel({ group, onOpenCampaign }: { group: Group; onOpenCampaign: (id: string) => void }) {
  const { renameGroup, campaigns, addCampaign } = useCampaigns();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const groupCampaigns = campaigns.filter(c => c.groupId === group.id);

  const createCampaign = () => {
    if (!newName.trim()) return;
    const c = addCampaign(group.id, newName.trim());
    setNewName(''); setAdding(false);
    onOpenCampaign(c.id);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <p className="text-xs font-mono uppercase tracking-wide text-slate-400">배포 그룹</p>
      <div className="mb-6 flex items-center justify-between">
        <input
          className="w-full max-w-lg border-b border-transparent bg-transparent text-2xl font-bold text-slate-900 hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          value={group.name}
          onChange={e => renameGroup(group.id, e.target.value)}
        />
        {adding ? (
          <input
            autoFocus
            className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm"
            value={newName}
            placeholder="캠페인 이름"
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createCampaign(); else if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            onBlur={() => { setAdding(false); setNewName(''); }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >✨ 새 캠페인</button>
        )}
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <h3 className="font-bold text-slate-800">📋 캠페인 ({groupCampaigns.length})</h3>
        {groupCampaigns.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
            <p className="text-3xl">✨</p>
            <p className="text-sm text-slate-500">예약된 캠페인이 없어요</p>
            <button
              onClick={() => setAdding(true)}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >새 캠페인 시작</button>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            {groupCampaigns.map(c => (
              <button
                key={c.id}
                onClick={() => onOpenCampaign(c.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2 text-left text-sm text-slate-700 hover:bg-white"
              >
                <span>📋 {c.name}</span>
                <span className="text-xs text-slate-400">설정 →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
