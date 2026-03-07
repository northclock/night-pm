import { useState } from 'react';
import { Brain, Check, ArrowSquareOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProviderId, ProviderAvailability } from '../../types';

interface ProviderSetupDialogProps {
  providers: ProviderAvailability[];
  onSelect: (providerId: ProviderId) => void;
}

export function ProviderSetupDialog({ providers, onSelect }: ProviderSetupDialogProps) {
  const [selected, setSelected] = useState<ProviderId | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex flex-col items-center gap-2 px-6 pt-8 pb-4">
          <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary mb-1">
            <Brain size={28} weight="duotone" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to Night PM</h1>
          <p className="text-sm text-muted-foreground">Choose your AI provider to get started</p>
        </div>

        <div className="grid gap-2 px-6 py-4">
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => setSelected(provider.id)}
              className={cn(
                'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                selected === provider.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                  : 'border-border bg-card hover:bg-accent/40',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{provider.displayName}</span>
                  {provider.available ? (
                    <Badge variant="outline" className="gap-1 text-[10px] text-night-green border-night-green/30">
                      <span className="size-1.5 rounded-full bg-night-green" />
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px] text-night-red border-night-red/30">
                      <span className="size-1.5 rounded-full bg-night-red" />
                      Not installed
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{provider.description}</p>
                {!provider.available && provider.installUrl && (
                  <a
                    href={provider.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Install instructions <ArrowSquareOut size={12} />
                  </a>
                )}
              </div>
              {selected === provider.id && (
                <div className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shrink-0 mt-0.5">
                  <Check size={12} weight="bold" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="px-6 pb-6 pt-2">
          <Button
            className="w-full gap-2"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
