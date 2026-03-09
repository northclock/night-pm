import { useState, useEffect } from 'react';
import { X, CalendarBlank } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '../../store';
import { CalendarView } from './CalendarView';
import type { CalendarEvent, OpenFile } from '../../types';

interface Props {
  onClose: () => void;
}

export function AllCalendarsView({ onClose }: Props) {
  const rootPath = useAppStore((s) => s.rootPath);
  const [mergedEvents, setMergedEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rootPath) { setLoading(false); return; }
    scanCalendars(rootPath).then((evts) => { setMergedEvents(evts); setLoading(false); });
  }, [rootPath]);

  async function scanCalendars(dir: string): Promise<CalendarEvent[]> {
    const all: CalendarEvent[] = [];
    try {
      const entries = await window.nightAPI.fs.readDir(dir);
      for (const entry of entries) {
        if (entry.isFile && entry.name === 'calendar.json') {
          try {
            const raw = await window.nightAPI.fs.readFile(entry.path);
            const events: CalendarEvent[] = JSON.parse(raw);
            const projectName = dir.split('/').pop() || 'Unknown';
            for (const evt of events) {
              all.push({ ...evt, title: `[${projectName}] ${evt.title}` });
            }
          } catch { /* skip malformed */ }
        }
        if (entry.isDirectory && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const sub = await scanCalendars(entry.path);
          all.push(...sub);
        }
      }
    } catch { /* skip unreadable */ }
    return all;
  }

  const dummyFile: OpenFile = { path: '__all_calendars__', name: 'All Calendars', content: '[]' };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarBlank size={18} className="text-primary" weight="duotone" />
          <h2 className="text-sm font-semibold text-foreground">All Calendars</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading calendars...</div>
      ) : (
        <CalendarView file={dummyFile} extraEvents={mergedEvents} projectLabel="Showing events from all projects" />
      )}
    </div>
  );
}
