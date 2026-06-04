import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';

export function GroupSetup({ onCreated, onCancel }: { onCreated: (groupId: string) => void; onCancel: () => void }) {
  const { addGroup } = useCampaigns();
  const [name, setName] = useState('');

  const save = () => {
    if (!name.trim()) return;
    const g = addGroup(name.trim());
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
            onKeyDown={e => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') onCancel(); }}
          />
          <p className="mt-1 text-xs text-slate-400">그룹은 캠페인(아티클 종류)을 담는 컨테이너입니다.</p>
        </div>

        <div className="flex gap-2 pt-1">
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
