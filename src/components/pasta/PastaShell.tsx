import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import { CampaignSidebar } from './CampaignSidebar';
import { CampaignSettingsPanel } from './CampaignSettingsPanel';
import { GroupPanel } from './GroupPanel';

export function PastaShell({ onOpenCampaign }: { onOpenCampaign: (campaignId: string) => void }) {
  const { groups, campaigns } = useCampaigns();
  const [selCampaign, setSelCampaign] = useState<string | null>(campaigns[0]?.id ?? null);
  const [selGroup, setSelGroup] = useState<string | null>(null);

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
      <div className="min-h-0 overflow-hidden">
        {showGroup ? (
          <GroupPanel group={group} />
        ) : campaign ? (
          <CampaignSettingsPanel campaign={campaign} onOpen={() => onOpenCampaign(campaign.id)} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            캠페인을 선택하거나 새로 만드세요
          </div>
        )}
      </div>
    </div>
  );
}
