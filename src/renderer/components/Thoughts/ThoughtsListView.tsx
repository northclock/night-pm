import { useState, useEffect } from 'react';
import { Lightning } from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OpenFile, Thought } from '../../types';
import { logoUrl } from '../../assets';

interface ThoughtsListViewProps { file: OpenFile; }

export function ThoughtsListView({ file }: ThoughtsListViewProps) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);

  useEffect(() => {
    try { setThoughts(JSON.parse(file.content || '[]')); } catch { setThoughts([]); }
  }, [file.content]);

  const sorted = [...thoughts].reverse();

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center gap-2 mb-4">
        <img src={logoUrl} alt="" className="w-5 h-5 dark:invert" draggable={false} />
        <h2 className="text-lg font-semibold text-foreground">Thoughts</h2>
        <span className="text-xs text-muted-foreground ml-2">{thoughts.length} thought{thoughts.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">Shift+Cmd+Y</kbd> to add a thought from anywhere.
      </p>
      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No thoughts recorded yet</div>
      ) : (
        <div className="space-y-3">
          {sorted.map((t, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="text-sm text-foreground">{t.thought}</div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-muted-foreground">{format(parseISO(t.createdOn), 'MMM d, yyyy h:mm a')}</span>
                  {t.actionsTriggered.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Lightning size={10} className="text-night-yellow" weight="fill" />
                      {t.actionsTriggered.map((action, ai) => (
                        <Badge key={ai} variant="outline" className="text-[10px] text-night-yellow border-night-yellow/30">{action}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
