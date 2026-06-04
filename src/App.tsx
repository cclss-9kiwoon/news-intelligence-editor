import { useState } from 'react';
import { SettingsProvider, useSettings } from './state/SettingsContext';
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
import { loadJson, saveJson } from './lib/storage';

const COLLAPSE_KEY = 'nie:workbench-collapsed';

function AppShell() {
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
        <div className="flex min-h-0 flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse at top left, #D6EAF8 0%, transparent 45%), radial-gradient(ellipse at bottom center, #FDE8C0 0%, transparent 50%), radial-gradient(ellipse at right, #F5E0F8 0%, transparent 45%), #FDF6EC' }}>
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

export default function App() {
  return (
    <SettingsProvider>
      <HistoryProvider>
        <ArticlesProvider>
          <ClustersProvider>
            <ConversionProvider>
              <BreakingProvider>
                <AppShell />
              </BreakingProvider>
            </ConversionProvider>
          </ClustersProvider>
        </ArticlesProvider>
      </HistoryProvider>
    </SettingsProvider>
  );
}
