import { useState, useEffect, useMemo } from 'react';
import { Lightning } from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OpenFile, Thought } from '../../types';
import { logoUrl } from '../../assets';
import { useChildProjectData } from '../../hooks/useChildProjectData';
import { ChildrenToggleButton, ChildrenLegend } from '../ui/ChildrenToggleBar';

interface ThoughtsListViewProps { file: OpenFile; }

interface DisplayThought extends Thought {
  _color?: string;
  _projectName?: string;
}

export function ThoughtsListView({ file }: ThoughtsListViewProps) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);

  const {
    showChildren, toggleChildren, children: childProjects,
    loaded: childrenLoaded, childDisplayItems, toggleChildVisibility, hasProject,
  } = useChildProjectData<Thought>(file.path, 'thoughts.json');

  useEffect(() => {
    try { setThoughts(JSON.parse(file.content || '[]')); } catch { setThoughts([]); }
  }, [file.content]);

  const allThoughts: DisplayThought[] = useMemo(() => [
    ...thoughts,
    ...childDisplayItems.map((d) => ({ ...d.item, _color: d._color, _projectName: d._projectName })),
  ], [thoughts, childDisplayItems]);

  const sorted = [...allThoughts].sort((a, b) => b.createdOn.localeCompare(a.createdOn));

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="" className="w-5 h-5 dark:invert" draggable={false} />
          <h2 className="text-lg font-semibold text-foreground">Thoughts</h2>
          <span className="text-xs text-muted-foreground ml-2">{allThoughts.length} thought{allThoughts.length !== 1 ? 's' : ''}</span>
        </div>
        <ChildrenToggleButton showChildren={showChildren} onToggle={toggleChildren} hasProject={hasProject} />
      </div>
      <ChildrenLegend showChildren={showChildren} children={childProjects} loaded={childrenLoaded} onToggleChild={toggleChildVisibility} />
      <p className="text-xs text-muted-foreground mb-4">
        Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">Shift+Cmd+Y</kbd> to add a thought from anywhere.
      </p>
      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No thoughts recorded yet</div>
      ) : (
        <div className="space-y-3">
          {sorted.map((t, i) => (
            <Card
              key={`${t._projectName ?? 'own'}-${i}`}
              style={t._color ? { borderLeftWidth: 3, borderLeftColor: t._color } : undefined}
            >
              <CardContent className="p-3">
                <div className="text-sm text-foreground">
                  {t._projectName && <span className="text-[11px] font-semibold mr-1.5" style={{ color: t._color }}>{t._projectName}:</span>}
                  {t.thought}
                </div>
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
