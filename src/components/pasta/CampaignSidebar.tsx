import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';

type View = 'campaign' | 'group' | 'new-group' | 'template' | 'empty';

type Props = {
  view: View;
  selectedId: string | null;
  selectedGroupId: string | null;
  onSelectCampaign: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onAddGroup: () => void;
  onSelectTemplate: () => void;
};

export function CampaignSidebar({
  view, selectedId, selectedGroupId,
  onSelectCampaign, onSelectGroup, onAddGroup, onSelectTemplate,
}: Props) {
  const { groups, campaigns, addCampaign, duplicateCampaign, renameCampaign, renameGroup, duplicateGroup, deleteGroup, deleteCampaign } = useCampaigns();
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [campNameDraft, setCampNameDraft] = useState('');

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm">
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-xs">🍝</span>
          Pasta
        </h2>
      </div>

      {/* ── 배포 그룹 섹션 ── */}
      <p className="mt-1 px-1 text-[10px] font-mono uppercase tracking-wide text-slate-400">배포 그룹</p>

      {groups.map(group => {
        const groupCampaigns = campaigns.filter(c => c.groupId === group.id);
        const groupSelected = view === 'group' && selectedGroupId === group.id;
        return (
          <div key={group.id} className="mb-1">
            <div
              className={`flex items-center justify-between rounded-lg border px-2 py-1.5 cursor-pointer ${
                groupSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
              onClick={() => onSelectGroup(group.id)}
              onDoubleClick={() => { setEditingGroup(group.id); setGroupNameDraft(group.name); }}
            >
              {editingGroup === group.id ? (
                <input
                  autoFocus
                  className="w-full rounded border px-1.5 py-0.5 text-sm font-medium text-slate-700"
                  value={groupNameDraft}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setGroupNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && groupNameDraft.trim()) { renameGroup(group.id, groupNameDraft.trim()); setEditingGroup(null); }
                    else if (e.key === 'Escape') setEditingGroup(null);
                  }}
                  onBlur={() => { if (groupNameDraft.trim()) renameGroup(group.id, groupNameDraft.trim()); setEditingGroup(null); }}
                />
              ) : (
                <>
                  <span className="font-medium text-slate-700" title="더블클릭으로 이름 변경">📁 {group.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      title="그룹 복제 (캠페인 포함)"
                      aria-label={`그룹 복제: ${group.name}`}
                      onClick={(e) => { e.stopPropagation(); const ng = duplicateGroup(group.id); if (ng) onSelectGroup(ng.id); }}
                      className="text-slate-300 hover:text-indigo-500"
                    >📑</button>
                    <button
                      title="삭제"
                      aria-label={`그룹 삭제: ${group.name}`}
                      onClick={(e) => { e.stopPropagation(); if (confirm(`그룹 "${group.name}" 삭제? 캠페인도 함께 삭제됩니다.`)) deleteGroup(group.id); }}
                      className="text-slate-300 hover:text-red-500"
                    >🗑</button>
                  </span>
                </>
              )}
            </div>

            <div className="ml-3 mt-1 flex flex-col gap-0.5">
              {groupCampaigns.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer ${
                    view === 'campaign' && selectedId === c.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => onSelectCampaign(c.id)}
                  onDoubleClick={() => { setEditingCampaign(c.id); setCampNameDraft(c.name); }}
                >
                  {editingCampaign === c.id ? (
                    <input
                      autoFocus
                      className="w-full rounded border px-1.5 py-0.5 text-xs text-slate-700"
                      value={campNameDraft}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setCampNameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && campNameDraft.trim()) { renameCampaign(c.id, campNameDraft.trim()); setEditingCampaign(null); }
                        else if (e.key === 'Escape') setEditingCampaign(null);
                      }}
                      onBlur={() => { if (campNameDraft.trim()) renameCampaign(c.id, campNameDraft.trim()); setEditingCampaign(null); }}
                    />
                  ) : (
                    <>
                      <span className="truncate" title="더블클릭으로 이름 변경">📋 {c.name}</span>
                      <span className="ml-1 flex shrink-0 items-center gap-1">
                        <button
                          title="복제"
                          aria-label={`캠페인 복제: ${c.name}`}
                          onClick={(e) => { e.stopPropagation(); const copy = duplicateCampaign(c.id); if (copy) onSelectCampaign(copy.id); }}
                          className={view === 'campaign' && selectedId === c.id ? 'text-slate-300 hover:text-white' : 'text-slate-300 hover:text-indigo-500'}
                        >📑</button>
                        <button
                          title="삭제"
                          aria-label={`캠페인 삭제: ${c.name}`}
                          onClick={(e) => { e.stopPropagation(); if (confirm(`캠페인 "${c.name}" 삭제?`)) deleteCampaign(c.id); }}
                          className={view === 'campaign' && selectedId === c.id ? 'text-slate-300 hover:text-white' : 'text-slate-300 hover:text-red-500'}
                        >🗑</button>
                      </span>
                    </>
                  )}
                </div>
              ))}

              {groupCampaigns.length === 0 && addingTo !== group.id && (
                <p className="px-2 py-1 text-[11px] italic text-slate-300">캠페인 없음</p>
              )}

              {addingTo === group.id ? (
                <input
                  autoFocus
                  className="mt-1 rounded border px-2 py-1 text-xs"
                  value={newCampaignName}
                  placeholder="캠페인 이름"
                  onChange={e => setNewCampaignName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCampaignName.trim()) {
                      const c = addCampaign(group.id, newCampaignName.trim());
                      setNewCampaignName(''); setAddingTo(null); onSelectCampaign(c.id);
                    } else if (e.key === 'Escape') { setAddingTo(null); setNewCampaignName(''); }
                  }}
                  onBlur={() => { setAddingTo(null); setNewCampaignName(''); }}
                />
              ) : (
                <button onClick={() => setAddingTo(group.id)} className="mt-1 text-left text-xs text-indigo-600 hover:text-indigo-800">+ 캠페인 추가</button>
              )}
            </div>
          </div>
        );
      })}

      <button
        onClick={onAddGroup}
        className={`mt-1 rounded-lg border border-dashed px-2 py-1.5 text-left text-xs ${
          view === 'new-group' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
        }`}
      >+ 그룹 추가</button>

      {/* ── 작업공간 섹션 ── */}
      <p className="mt-4 px-1 text-[10px] font-mono uppercase tracking-wide text-slate-400">작업공간</p>
      <button
        onClick={onSelectTemplate}
        className={`rounded-lg px-2 py-1.5 text-left ${
          view === 'template' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >📄 템플릿</button>
    </div>
  );
}
