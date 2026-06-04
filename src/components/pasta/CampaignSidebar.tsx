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
    <div className="flex h-full flex-col gap-1 overflow-y-auto border-r border-gray-200 bg-gray-50 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold text-gray-700">🍝 Pasta</h2>
        <span className="text-xs text-gray-400">캠페인</span>
      </div>

      {groups.map(group => {
        const groupCampaigns = campaigns.filter(c => c.groupId === group.id);
        return (
          <div key={group.id} className="mb-2">
            <div
              className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer ${
                selectedGroupId === group.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
              onClick={() => onSelectGroup(group.id)}
            >
              <span className="font-medium text-gray-700">🏢 {group.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`그룹 "${group.name}" 삭제? 캠페인도 함께 삭제됩니다.`)) deleteGroup(group.id); }}
                className="text-gray-300 hover:text-red-500"
              >🗑</button>
            </div>

            <div className="ml-3 mt-1 flex flex-col gap-0.5">
              {groupCampaigns.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer ${
                    selectedId === c.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => onSelectCampaign(c.id)}
                >
                  <span className="truncate">📋 {c.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`캠페인 "${c.name}" 삭제?`)) deleteCampaign(c.id); }}
                    className={selectedId === c.id ? 'text-blue-200 hover:text-white' : 'text-gray-300 hover:text-red-500'}
                  >🗑</button>
                </div>
              ))}

              {addingTo === group.id ? (
                <div className="flex gap-1 mt-1">
                  <input
                    autoFocus
                    className="flex-1 rounded border px-2 py-1 text-xs"
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
                  className="mt-1 text-left text-xs text-blue-600 hover:text-blue-800"
                >+ 캠페인 추가</button>
              )}
            </div>
          </div>
        );
      })}

      <div className="mt-3 border-t border-gray-200 pt-3">
        <div className="flex gap-1">
          <input
            className="flex-1 rounded border px-2 py-1 text-xs"
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
            className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-800"
          >+ 그룹</button>
        </div>
      </div>
    </div>
  );
}
