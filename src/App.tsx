import { useState, useEffect, useRef } from 'react';
import { SettingsProvider, useSettings } from './state/SettingsContext';
import { CampaignProvider, useCampaigns } from './state/CampaignContext';
import { TaskProvider } from './state/TaskContext';
import { HistoryProvider } from './state/HistoryContext';
import { ArticlesProvider } from './state/ArticlesContext';
import { ClustersProvider } from './state/ClustersContext';
import { BreakingProvider } from './state/BreakingContext';
import { ConversionProvider } from './state/ConversionContext';
import { Header } from './components/Header';
import { AlertBanner } from './components/AlertBanner';
import { ClusterPicker } from './components/ClusterPicker';
import { Workbench } from './components/Workbench';
import { StoryPreview } from './components/StoryPreview';
import { SettingsModal } from './components/SettingsModal';
import { HistoryPanel } from './components/HistoryPanel';
import { GuideModal } from './components/GuideModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { VerticalSplitter } from './components/VerticalSplitter';
import { PastaShell } from './components/pasta/PastaShell';
import { CampaignShell } from './components/pasta/CampaignShell';
import { SearchingPipeline } from './components/pasta/SearchingPipeline';
import { CampaignWorkspace } from './components/pasta/CampaignWorkspace';
import { loadJson, saveJson } from './lib/storage';

const COLLAPSE_KEY = 'nie:workbench-collapsed';

function AppShell({ onBackToPasta, campaignName }: { onBackToPasta: () => void; campaignName: string }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [workbenchCollapsed, setWorkbenchCollapsed] = useState(() => loadJson<boolean>(COLLAPSE_KEY, false));
  const { settings } = useSettings();

  const handleMissingKey = () => setSettingsOpen(true);
  const toggleCollapsed = () => {
    setWorkbenchCollapsed(prev => {
      const next = !prev;
      saveJson(COLLAPSE_KEY, next);
      return next;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-800 px-4 py-1.5 text-xs text-white">
        <button onClick={onBackToPasta} className="rounded px-2 py-0.5 hover:bg-gray-700">← 캠페인 목록</button>
        <span className="text-gray-400">|</span>
        <span className="text-gray-300">🍝 Pasta · 캠페인:</span>
        <span className="font-medium">{campaignName}</span>
      </div>
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenTutorial={() => setTutorialOpen(true)}
      />
      <AlertBanner />
      {!settings.apiKey && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠ OpenAI API 키가 설정되지 않았습니다.
          <button onClick={() => setSettingsOpen(true)} className="ml-2 underline">설정 열기</button>
        </div>
      )}
      <div className="grid flex-1 min-h-0 grid-cols-[340px_1fr] overflow-hidden">
        <ClusterPicker />
        <div className="flex min-h-0 flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 80% at top left, #C5E3F6 0%, transparent 55%), radial-gradient(ellipse at bottom center, #FBE2BC 0%, transparent 55%), radial-gradient(ellipse at right, #F0D5F7 0%, transparent 55%), #FCF4E8' }}>
          <VerticalSplitter
            storageKey="nie:workbench-split"
            defaultTopFraction={0.62}
            minTopPx={140}
            minBottomPx={160}
            topCollapsed={workbenchCollapsed}
            top={
              <Workbench
                onMissingKey={handleMissingKey}
                collapsed={workbenchCollapsed}
                onToggleCollapsed={toggleCollapsed}
              />
            }
            bottom={
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <StoryPreview />
              </div>
            }
          />
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <TutorialOverlay
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onOpenGuide={() => setGuideOpen(true)}
      />
    </div>
  );
}

function PastaRouter() {
  // reload 시 마지막 위치 복원 — workspace는 openTaskId 없으니 kanban으로 폴백
  const [mode, setMode] = useState<'pasta' | 'kanban' | 'workspace' | 'workbench'>(() => {
    const m = loadJson<string>('pasta:mode', 'pasta');
    return m === 'kanban' || m === 'workbench' ? (m as 'kanban' | 'workbench') : 'pasta';
  });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [forceSettingsId, setForceSettingsId] = useState<string | null>(null);
  const { applyCampaignSettings } = useSettings();
  const { campaigns, groups, setActiveCampaign, activeCampaign, markCampaignConfigured } = useCampaigns();

  useEffect(() => { saveJson('pasta:mode', mode); }, [mode]);

  // 마운트 시 복원: 칸반/워크벤치였으면 활성 캠페인 설정 재주입(파이프라인용). 캠페인 없으면 목록으로.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    if (mode !== 'pasta') {
      if (activeCampaign) {
        const g = groups.find(x => x.id === activeCampaign.groupId);
        applyCampaignSettings(activeCampaign.settings, g?.profile);
      } else {
        setMode('pasta');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCampaign = (campaignId: string) => {
    const c = campaigns.find(x => x.id === campaignId);
    if (!c) return;
    const g = groups.find(x => x.id === c.groupId);
    applyCampaignSettings(c.settings, g?.profile);   // 캠페인 설정 + 그룹 배포맥락 주입
    setActiveCampaign(campaignId);
    markCampaignConfigured(campaignId);              // 1회 진입 = 설정 완료 → 이후 칸반 직행
    setMode('kanban');
  };

  if (mode === 'pasta') {
    return (
      <PastaShell
        onOpenCampaign={openCampaign}
        forceSettingsId={forceSettingsId}
        onConsumeForceSettings={() => setForceSettingsId(null)}
      />
    );
  }

  return (
    <HistoryProvider>
      <ArticlesProvider>
        <ClustersProvider>
          <ConversionProvider>
            <BreakingProvider>
              {activeCampaign && <SearchingPipeline campaign={activeCampaign} />}
              {mode === 'workspace' && openTaskId ? (
                <CampaignWorkspace taskId={openTaskId} onBack={() => setMode('kanban')} />
              ) : mode === 'kanban' && activeCampaign ? (
                <CampaignShell
                  campaign={activeCampaign}
                  onBackToList={() => setMode('pasta')}
                  onOpenSettings={() => { setForceSettingsId(activeCampaign.id); setMode('pasta'); }}
                  onOpenTask={(taskId) => { setOpenTaskId(taskId); setMode('workspace'); }}
                  onOpenWorkbench={() => setMode('workbench')}
                />
              ) : (
                <AppShell
                  onBackToPasta={() => setMode(activeCampaign ? 'kanban' : 'pasta')}
                  campaignName={activeCampaign?.name ?? '—'}
                />
              )}
            </BreakingProvider>
          </ConversionProvider>
        </ClustersProvider>
      </ArticlesProvider>
    </HistoryProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <CampaignProvider>
        <TaskProvider>
          <PastaRouter />
        </TaskProvider>
      </CampaignProvider>
    </SettingsProvider>
  );
}
