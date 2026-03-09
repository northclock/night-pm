import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Trash, CheckCircle, Circle, Warning, CalendarBlank, CaretDown, CaretRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OpenFile, Standup } from '../../types';

interface Props { file: OpenFile; }

export function StandupView({ file }: Props) {
  const [standups, setStandups] = useState<Standup[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    try { setStandups(JSON.parse(file.content || '[]')); } catch { setStandups([]); }
  }, [file.content]);

  const saveStandups = useCallback(async (updated: Standup[]) => {
    setStandups(updated);
    await window.nightAPI.fs.writeFile(file.path, JSON.stringify(updated, null, 2));
  }, [file.path]);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (expandedId === id) setExpandedId(null);
    saveStandups(standups.filter((s) => s.id !== id));
  }

  function buildQuickSummary(s: Standup): string {
    const parts: string[] = [];
    if (s.done.length) parts.push(`${s.done.length} done`);
    if (s.inProgress.length) parts.push(`${s.inProgress.length} in progress`);
    if (s.blocked.length) parts.push(`${s.blocked.length} blocked`);
    if (s.events.length) parts.push(`${s.events.length} event${s.events.length > 1 ? 's' : ''}`);
    return parts.length ? parts.join(' · ') : 'Empty standup';
  }

  const sorted = [...standups].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone size={20} className="text-night-accent2" weight="duotone" />
          <h2 className="text-lg font-semibold text-foreground">Standups</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Ask the AI for a standup to generate one
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No standups yet — ask the AI &quot;give me a standup&quot; to generate one.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((standup) => {
            const isExpanded = expandedId === standup.id;
            const dateLabel = standup.startDate && standup.startDate !== standup.endDate
              ? `${standup.startDate} → ${standup.endDate ?? standup.date}`
              : standup.date;

            return (
              <Card
                key={standup.id}
                className={`cursor-pointer transition-colors ${isExpanded ? 'border-primary/40' : 'hover:border-primary/20'}`}
                onClick={() => setExpandedId(isExpanded ? null : standup.id)}
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <CaretDown size={12} className="text-muted-foreground shrink-0" />
                      : <CaretRight size={12} className="text-muted-foreground shrink-0" />}
                    <Badge variant="outline" className="font-mono text-xs shrink-0">
                      {dateLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {buildQuickSummary(standup)}
                    </span>
                    <div className="ml-auto shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(standup.id, e)}
                      >
                        <Trash size={12} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4 space-y-3">
                    <div className="border-t border-border/50 pt-3 space-y-3">
                      <Section
                        icon={<CheckCircle size={14} className="text-night-green" weight="duotone" />}
                        title="Done"
                        items={standup.done}
                        emptyText="(none)"
                      />
                      <Section
                        icon={<Circle size={14} className="text-primary" weight="duotone" />}
                        title="In Progress"
                        items={standup.inProgress}
                        emptyText="(none)"
                      />
                      <Section
                        icon={<Warning size={14} className="text-night-peach" weight="duotone" />}
                        title="Blocked"
                        items={standup.blocked}
                        emptyText="(none)"
                      />
                      <Section
                        icon={<CalendarBlank size={14} className="text-night-accent2" weight="duotone" />}
                        title="Events"
                        items={standup.events}
                        emptyText="(none)"
                      />
                      <p className="text-[10px] text-muted-foreground pt-1">
                        Generated {new Date(standup.createdOn).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, items, emptyText }: { icon: React.ReactNode; title: string; items: string[]; emptyText: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium text-foreground">{title}</span>
      </div>
      {items.length > 0 ? (
        <ul className="ml-5 space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-muted-foreground">• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="ml-5 text-xs text-muted-foreground italic">{emptyText}</p>
      )}
    </div>
  );
}
