import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';

type Props = {
  selectedId: string | null;
  selectedGroupId: string | null;
  onSelectCampaign: (id: string) => void;
  onSelectGroup: (id: string) => void;
};

export function CampaignSidebar({ selectedId, selectedGroupId, onSelectCampaign, onSelectGroup }: Props) {
  const { groups, campaigns, addGroup, addCampaign, deleteGroup, deleteCampaign } = useCampaigns();
  const [newGroupName, setNewGroupName] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-xs">🍝</span>
          Pasta
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400">캠페인</span>
      </div>

      {groups.map(group => {
        const groupCampaigns = campaigns.filter(c => c.groupId === group.id);
        return (
          <div key={group.id} className="mb-2">
            <div
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                selectedGroupId === group.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-100'
              }`}
              onClick={() => onSelectGroup(group.id)}
            >
              <span className="font-semibold text-slate-700">🏢 {group.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`그룹 "${group.name}" 삭제? 캠페인도 함께 삭제됩니다.`)) deleteGroup(group.id); }}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >🗑</button>
            </div>

            <div className="ml-3 mt-1 flex flex-col gap-0.5">
              {groupCampaigns.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                    selectedId === c.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  onClick={() => onSelectCampaign(c.id)}
                >
                  <span className="truncate">📋 {c.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`캠페인 "${c.name}" 삭제?`)) deleteCampaign(c.id); }}
                    className={selectedId === c.id ? 'text-slate-400 hover:text-white' : 'text-slate-300 hover:text-red-500'}
                  >🗑</button>
                </div>
              ))}

              {addingTo === group.id ? (
                <div className="flex gap-1 mt-1">
                  <input
                    autoFocus
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                    value={newCampaignName}
                    placeholder="캠페인 이름"
                    onChange={e => setNewCampaignName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCampaignName.trim()) {
                        const c = addCampaign(group.id, newCampaignName.trim());
                        setNewCampaignName(''); setAddingTo(null); onSelectCampaign(c.id);
                      } else if (e.key === 'Escape') { setAddingTo(null); setNewCampaignName(''); }
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo(group.id)}
                  className="mt-1 text-left text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                >+ 캠페인 추가</button>
              )}
            </div>
          </div>
        );
      })}

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex gap-1">
          <input
            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
            value={newGroupName}
            placeholder="새 그룹(회사)"
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newGroupName.trim()) {
                const g = addGroup(newGroupName.trim());
                setNewGroupName(''); onSelectGroup(g.id);
              }
            }}
          />
          <button
            onClick={() => { if (newGroupName.trim()) { const g = addGroup(newGroupName.trim()); setNewGroupName(''); onSelectGroup(g.id); } }}
            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >+ 그룹</button>
        </div>
      </div>
    </div>
  );
}
