import { useState, useEffect } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import { CampaignSidebar } from './CampaignSidebar';
import { CampaignSettingsPanel } from './CampaignSettingsPanel';
import { GroupPanel } from './GroupPanel';
import { GroupSetup } from './GroupSetup';

type View = 'campaign' | 'group' | 'new-group' | 'template' | 'empty';

const GRADIENT = 'radial-gradient(ellipse 80% 80% at top left, #C5E3F6 0%, transparent 55%), radial-gradient(ellipse at bottom center, #FBE2BC 0%, transparent 55%), radial-gradient(ellipse at right, #F0D5F7 0%, transparent 55%), #FCF4E8';

export function PastaShell({ onOpenCampaign, forceSettingsId, onConsumeForceSettings }: {
  onOpenCampaign: (campaignId: string) => void;
  forceSettingsId?: string | null;
  onConsumeForceSettings?: () => void;
}) {
  const { groups, campaigns } = useCampaigns();
  const [view, setView] = useState<View>(groups.length === 0 ? 'empty' : 'campaign');
  const [selCampaign, setSelCampaign] = useState<string | null>(campaigns[0]?.id ?? null);
  const [selGroup, setSelGroup] = useState<string | null>(null);

  // 그룹 0개면 항상 empty 뷰로
  useEffect(() => {
    if (groups.length === 0 && view !== 'new-group') setView('empty');
  }, [groups.length, view]);

  // 칸반 ⚙설정에서 진입: 해당 캠페인 설정 화면 강제 표시 (configured여도)
  useEffect(() => {
    if (forceSettingsId) {
      setSelCampaign(forceSettingsId);
      setView('campaign');
      onConsumeForceSettings?.();
    }
  }, [forceSettingsId, onConsumeForceSettings]);

  // 설정 완료(configured) 캠페인 선택 시 칸반 직행, 아니면 설정 화면
  const selectCampaign = (id: string) => {
    const c = campaigns.find(x => x.id === id);
    if (c?.configured) { onOpenCampaign(id); return; }
    setSelCampaign(id);
    setView('campaign');
  };

  // 첫 캠페인 자동 선택
  useEffect(() => {
    if (view === 'campaign' && selCampaign === null && campaigns.length > 0) {
      setSelCampaign(campaigns[0].id);
    }
  }, [campaigns, selCampaign, view]);

  const campaign = campaigns.find(c => c.id === selCampaign) ?? null;
  const group = groups.find(g => g.id === selGroup) ?? null;

  return (
    <div className="grid h-screen grid-cols-[260px_1fr] bg-white">
      <CampaignSidebar
        view={view}
        selectedId={selCampaign}
        selectedGroupId={selGroup}
        onSelectCampaign={selectCampaign}
        onSelectGroup={(id) => { setSelGroup(id); setView('group'); }}
        onAddGroup={() => setView('new-group')}
        onSelectTemplate={() => setView('template')}
      />
      <div className="min-h-0 overflow-hidden" style={{ background: GRADIENT }}>
        {view === 'new-group' ? (
          <GroupSetup
            onCreated={(groupId) => { setSelGroup(groupId); setView('group'); }}
            onCancel={() => setView(groups.length === 0 ? 'empty' : 'campaign')}
          />
        ) : view === 'empty' ? (
          <EmptyState onCreate={() => setView('new-group')} />
        ) : view === 'template' ? (
          <TemplatePlaceholder />
        ) : view === 'group' && group ? (
          <GroupPanel group={group} onOpenCampaign={selectCampaign} />
        ) : campaign ? (
          <CampaignSettingsPanel campaign={campaign} onOpen={() => onOpenCampaign(campaign.id)} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            캠페인을 선택하거나 새로 만드세요
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="pasta-float pasta-pop mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-3xl shadow-lg shadow-slate-900/10">🍝</div>
      <h2 className="text-xl font-bold text-slate-800">첫 배포 그룹을 만들어 시작하세요</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        그룹(회사/매체)을 만들고 캠페인을 추가하면, 기사 수집부터 초안 작성까지 자동으로 흐릅니다.
      </p>
      <button
        onClick={onCreate}
        className="pasta-springy mt-6 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 hover:shadow-md"
      >+ 배포 그룹 만들기</button>
    </div>
  );
}

function TemplatePlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
      <div className="pasta-float mb-3 text-4xl">📄</div>
      <h2 className="text-lg font-bold text-slate-600">템플릿</h2>
      <p className="mt-1 text-sm">캠페인 설정 프리셋 — 곧 제공됩니다.</p>
    </div>
  );
}
