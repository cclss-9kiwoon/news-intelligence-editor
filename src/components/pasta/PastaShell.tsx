import { useState, useEffect } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import { CampaignSidebar } from './CampaignSidebar';
import { CampaignSettingsPanel } from './CampaignSettingsPanel';
import { GroupPanel } from './GroupPanel';

export function PastaShell({ onOpenCampaign }: { onOpenCampaign: (campaignId: string) => void }) {
  const { groups, campaigns } = useCampaigns();
  const [selCampaign, setSelCampaign] = useState<string | null>(campaigns[0]?.id ?? null);
  const [selGroup, setSelGroup] = useState<string | null>(null);

  // 캠페인 비동기 로드 후 미선택이면 첫 캠페인 자동 선택
  useEffect(() => {
    if (selCampaign === null && selGroup === null && campaigns.length > 0) {
      setSelCampaign(campaigns[0].id);
    }
  }, [campaigns, selCampaign, selGroup]);

  const campaign = campaigns.find(c => c.id === selCampaign) ?? null;
  const group = groups.find(g => g.id === selGroup) ?? null;
  const showGroup = selGroup !== null && group !== null;

  return (
    <div className="grid h-screen grid-cols-[260px_1fr] bg-white">
      <CampaignSidebar
        selectedId={showGroup ? null : selCampaign}
        selectedGroupId={showGroup ? selGroup : null}
        onSelectCampaign={(id) => { setSelCampaign(id); setSelGroup(null); }}
        onSelectGroup={(id) => { setSelGroup(id); }}
      />
      <div className="min-h-0 overflow-hidden" style={{ background: 'radial-gradient(ellipse at top left, #D6EAF8 0%, transparent 45%), radial-gradient(ellipse at bottom center, #FDE8C0 0%, transparent 50%), radial-gradient(ellipse at right, #F5E0F8 0%, transparent 45%), #FDF6EC' }}>
        {showGroup ? (
          <GroupPanel group={group} />
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
