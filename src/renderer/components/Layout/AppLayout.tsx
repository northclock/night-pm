import { useState, useEffect } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { TitleBar } from './TitleBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { TabBar } from '../TabBar/TabBar';
import { ContentArea } from '../ContentArea/ContentArea';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { AIConsole } from '../AIConsole/AIConsole';
import { AllCalendarsView } from '../Calendar/AllCalendarsView';
import { ProviderSetupDialog } from '../ProviderSetup/ProviderSetupDialog';
import { useAppStore } from '../../store';
import type { ProviderAvailability, ProviderId } from '../../types';
import { logoUrl } from '../../assets';

type OverlayPanel = 'settings' | 'console' | 'all-calendars' | null;

export function AppLayout() {
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const openFiles = useAppStore((s) => s.openFiles);
  const [overlayPanel, setOverlayPanel] = useState<OverlayPanel>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  const [providerList, setProviderList] = useState<ProviderAvailability[]>([]);

  useEffect(() => {
    const cleanup = window.nightAPI.window.onFullscreenChanged(setIsFullscreen);
    return cleanup;
  }, []);

  useEffect(() => {
    (async () => {
      const [settings, providers] = await Promise.all([
        window.nightAPI.settings.get(),
        window.nightAPI.ai.detectProviders(),
      ]);
      setProviderList(providers);

      const hasProvider = settings.provider && settings.provider !== '';
      const selectedAvailable = providers.find((p) => p.id === settings.provider)?.available;
      if (!hasProvider || !selectedAvailable) {
        setShowProviderSetup(true);
      }
    })();
  }, []);

  async function handleProviderSelected(providerId: ProviderId) {
    await window.nightAPI.settings.set({ provider: providerId });
    setShowProviderSetup(false);
  }

  function openPanel(panel: OverlayPanel) {
    setOverlayPanel((prev) => (prev === panel ? null : panel));
  }

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {!isFullscreen && <TitleBar />}
      <div className="flex-1 flex overflow-hidden">
        <Allotment>
          <Allotment.Pane preferredSize={260} minSize={180} maxSize={500}>
            <Sidebar
              onOpenSettings={() => openPanel('settings')}
              onOpenConsole={() => openPanel('console')}
              onOpenAllCalendars={() => openPanel('all-calendars')}
            />
          </Allotment.Pane>
          <Allotment.Pane>
            <div className="h-full flex flex-col">
              {openFiles.length > 0 && !overlayPanel && <TabBar />}
              <div className="flex-1 overflow-hidden">
                {overlayPanel === 'settings' ? (
                  <SettingsPanel onClose={() => setOverlayPanel(null)} />
                ) : overlayPanel === 'console' ? (
                  <AIConsole onClose={() => setOverlayPanel(null)} />
                ) : overlayPanel === 'all-calendars' ? (
                  <AllCalendarsView onClose={() => setOverlayPanel(null)} />
                ) : activeFilePath ? (
                  <ContentArea />
                ) : (
                  <WelcomeScreen />
                )}
              </div>
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>

      {showProviderSetup && (
        <ProviderSetupDialog
          providers={providerList}
          onSelect={handleProviderSelected}
        />
      )}
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="relative h-full flex flex-col items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px] mix-blend-screen animate-float" />
        <div className="absolute bottom-[10%] right-[10%] w-[45vw] h-[45vw] rounded-full bg-night-accent2/5 blur-[100px] mix-blend-screen animate-float" style={{ animationDelay: '-7s' }} />
        <div className="absolute top-[30%] left-[50%] w-[40vw] h-[40vw] -translate-x-1/2 rounded-full bg-muted/40 blur-[80px] mix-blend-screen animate-breathe" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="flex items-center justify-center w-24 h-24 rounded-[2rem] bg-gradient-to-br from-muted/80 to-background/50 border border-border shadow-2xl backdrop-blur-md">
        <img src={logoUrl} alt="Night PM" className="w-14 h-14 opacity-90 dark:invert" draggable={false} />
        </div>
        
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-light tracking-[0.2em] text-foreground">
            NIGHT <span className="font-medium text-primary">PM</span>
          </h1>
          <p className="text-sm text-muted-foreground/80 font-light tracking-wide">
            Calm Product Management
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="px-5 py-2.5 bg-muted/30 backdrop-blur-md border border-border/50 rounded-xl text-xs text-muted-foreground flex items-center gap-4 shadow-sm">
            <span className="opacity-80">Quick thought</span>
            <div className="flex gap-1.5">
              <kbd className="px-2 py-1 bg-background/80 border border-border/80 rounded flex items-center justify-center text-[10px] min-w-[24px]">&#x21E7;</kbd>
              <kbd className="px-2 py-1 bg-background/80 border border-border/80 rounded flex items-center justify-center text-[10px] min-w-[24px]">&#x2318;</kbd>
              <kbd className="px-2 py-1 bg-background/80 border border-border/80 rounded flex items-center justify-center text-[10px] min-w-[24px]">Y</kbd>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/50">
            Open a directory or create a new project to begin
          </p>
        </div>
      </div>
    </div>
  );
}
