import { useState } from 'react';
import { SettingsProvider, useSettings } from './state/SettingsContext';
import { HistoryProvider } from './state/HistoryContext';
import { ArticlesProvider } from './state/ArticlesContext';
import { BreakingProvider } from './state/BreakingContext';
import { ConversionProvider } from './state/ConversionContext';
import { Header } from './components/Header';
import { AlertBanner } from './components/AlertBanner';
import { ArticlePicker } from './components/ArticlePicker';
import { Workbench } from './components/Workbench';
import { FactCheckLog } from './components/FactCheckLog';
import { OutputTabs } from './components/OutputTabs';
import { SettingsModal } from './components/SettingsModal';
import { HistoryPanel } from './components/HistoryPanel';

function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { settings } = useSettings();

  const handleMissingKey = () => setSettingsOpen(true);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <AlertBanner />
      {!settings.apiKey && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠ OpenAI API 키가 설정되지 않았습니다.
          <button onClick={() => setSettingsOpen(true)} className="ml-2 underline">설정 열기</button>
        </div>
      )}
      <div className="grid flex-1 grid-cols-[320px_1fr] overflow-hidden">
        <ArticlePicker />
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Workbench onMissingKey={handleMissingKey} />
          </div>
          <FactCheckLog />
          <OutputTabs />
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <HistoryProvider>
        <ArticlesProvider>
          <ConversionProvider>
            <BreakingProvider>
              <AppShell />
            </BreakingProvider>
          </ConversionProvider>
        </ArticlesProvider>
      </HistoryProvider>
    </SettingsProvider>
  );
}
