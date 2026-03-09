import { useState, useEffect, useCallback, useMemo } from 'react';
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isSameDay, parseISO, isToday,
  startOfDay, endOfDay,
  addYears,
} from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { OpenFile, CalendarEvent } from '../../types';
import { EventForm } from './EventForm';

type ViewMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  file: OpenFile;
  extraEvents?: CalendarEvent[];
  projectLabel?: string;
}

function expandRecurring(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  for (const evt of events) {
    if (!evt.recurrence) {
      result.push(evt);
      continue;
    }
    const evtStart = parseISO(evt.start);
    const evtEnd = parseISO(evt.end);
    const duration = evtEnd.getTime() - evtStart.getTime();
    const { frequency, interval = 1, endDate } = evt.recurrence;
    const recEnd = endDate ? parseISO(endDate) : rangeEnd;

    let cursor = evtStart;
    let safety = 0;
    while (cursor <= recEnd && cursor <= rangeEnd && safety < 1000) {
      safety++;
      if (cursor >= rangeStart || addDays(cursor, 0).getTime() + duration >= rangeStart.getTime()) {
        const instanceEnd = new Date(cursor.getTime() + duration);
        result.push({
          ...evt,
          id: `${evt.id}_${cursor.toISOString()}`,
          start: cursor.toISOString(),
          end: instanceEnd.toISOString(),
        });
      }
      switch (frequency) {
        case 'daily': cursor = addDays(cursor, interval); break;
        case 'weekly': cursor = addDays(cursor, 7 * interval); break;
        case 'monthly': cursor = addMonths(cursor, interval); break;
        case 'yearly': cursor = addYears(cursor, interval); break;
      }
    }
  }
  return result;
}

export function CalendarView({ file, extraEvents, projectLabel }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    try { setEvents(JSON.parse(file.content || '[]')); } catch { setEvents([]); }
  }, [file.content]);

  const allRawEvents = useMemo(() => [...events, ...(extraEvents || [])], [events, extraEvents]);

  const saveEvents = useCallback(async (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    await window.nightAPI.fs.writeFile(file.path, JSON.stringify(newEvents, null, 2));
  }, [file.path]);

  function handleAddEvent(data: Omit<CalendarEvent, 'id' | 'createdOn'>) {
    saveEvents([...events, { ...data, id: uuidv4(), createdOn: new Date().toISOString() }]);
    setShowForm(false); setEditingEvent(null);
  }
  function handleUpdateEvent(data: Omit<CalendarEvent, 'id' | 'createdOn'>) {
    if (!editingEvent) return;
    const realId = editingEvent.id.split('_')[0];
    saveEvents(events.map((e) => e.id === realId ? { ...e, ...data } : e));
    setShowForm(false); setEditingEvent(null);
  }
  function handleDeleteEvent(id: string) {
    const realId = id.split('_')[0];
    saveEvents(events.filter((e) => e.id !== realId));
    setShowForm(false); setEditingEvent(null);
  }

  function navigate(dir: -1 | 1) {
    switch (viewMode) {
      case 'month': setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1)); break;
      case 'week': setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)); break;
      case 'day': setCurrentDate(addDays(currentDate, dir)); break;
    }
  }

  function headerLabel(): string {
    switch (viewMode) {
      case 'month': return format(currentDate, 'MMMM yyyy');
      case 'week': {
        const ws = startOfWeek(currentDate);
        const we = endOfWeek(currentDate);
        return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
      }
      case 'day': return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
  }

  const readOnly = !!extraEvents;

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}><CaretLeft size={18} /></Button>
          <h2 className="text-lg font-semibold text-foreground min-w-[220px] text-center">{headerLabel()}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}><CaretRight size={18} /></Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
              <button key={m} className={cn('px-3 py-1 text-xs transition-colors', viewMode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')} onClick={() => setViewMode(m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>Today</Button>
          {!readOnly && (
            <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30" onClick={() => { setEditingEvent(null); setShowForm(true); }}>
              <Plus size={14} /> Add Event
            </Button>
          )}
        </div>
      </div>
      {projectLabel && <p className="text-xs text-muted-foreground mb-2">{projectLabel}</p>}

      {viewMode === 'month' && <MonthGrid currentDate={currentDate} events={allRawEvents} selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); if (!readOnly) { setEditingEvent(null); setShowForm(true); } }} onEditEvent={(e) => { if (!readOnly) { setEditingEvent(e); setShowForm(true); } }} />}
      {viewMode === 'week' && <WeekGrid currentDate={currentDate} events={allRawEvents} onSelectDate={(d) => { setSelectedDate(d); if (!readOnly) { setEditingEvent(null); setShowForm(true); } }} onEditEvent={(e) => { if (!readOnly) { setEditingEvent(e); setShowForm(true); } }} />}
      {viewMode === 'day' && <DayGrid currentDate={currentDate} events={allRawEvents} onEditEvent={(e) => { if (!readOnly) { setEditingEvent(e); setShowForm(true); } }} />}

      {!readOnly && (
        <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingEvent(null); } }}>
          <DialogContent className="sm:max-w-[420px] p-0 pt-6">
            <EventForm
              event={editingEvent}
              defaultDate={selectedDate}
              onSave={editingEvent ? handleUpdateEvent : handleAddEvent}
              onDelete={editingEvent ? () => handleDeleteEvent(editingEvent.id) : undefined}
              onCancel={() => { setShowForm(false); setEditingEvent(null); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MonthGrid({ currentDate, events, selectedDate, onSelectDate, onEditEvent }: {
  currentDate: Date; events: CalendarEvent[]; selectedDate: Date | null;
  onSelectDate: (d: Date) => void; onEditEvent: (e: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(endOfMonth(monthStart));
  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { days.push(d); d = addDays(d, 1); }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const expanded = useMemo(() => expandRecurring(events, calStart, calEnd), [events, calStart, calEnd]);
  const getEventsForDay = (day: Date) => expanded.filter((e) => isSameDay(parseISO(e.start), day));

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden flex-1">
      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => (
        <div key={day} className="bg-sidebar p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
      ))}
      {weeks.map((week, wi) => week.map((day, di) => {
        const dayEvents = getEventsForDay(day);
        return (
          <div
            key={`${wi}-${di}`}
            className={cn(
              'bg-background p-1.5 min-h-[80px] cursor-pointer transition-colors hover:bg-accent/30',
              !isSameMonth(day, currentDate) && 'opacity-40',
              selectedDate && isSameDay(day, selectedDate) && 'ring-1 ring-primary',
            )}
            onClick={() => onSelectDate(day)}
          >
            <div className={cn(
              'text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full',
              isToday(day) ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground',
            )}>{format(day, 'd')}</div>
            {dayEvents.slice(0, 3).map((evt) => (
              <div key={evt.id} className="text-[10px] px-1 py-0.5 mb-0.5 rounded bg-primary/20 text-primary truncate cursor-pointer hover:bg-primary/30"
                onClick={(e) => { e.stopPropagation(); onEditEvent(evt); }}>{evt.title}</div>
            ))}
            {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>}
          </div>
        );
      }))}
    </div>
  );
}

const HOUR_HEIGHT = 60;
const MIN_EVENT_HEIGHT = 18;
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const period = i < 12 ? 'AM' : 'PM';
  const h = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return `${h} ${period}`;
});

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  totalCols: number;
}

function layoutDayEvents(dayEvents: CalendarEvent[], day: Date): PositionedEvent[] {
  const dayMs = startOfDay(day).getTime();
  const items = dayEvents
    .filter((e) => isSameDay(parseISO(e.start), day))
    .map((e) => {
      const s = parseISO(e.start);
      const end = parseISO(e.end);
      const startMin = (s.getTime() - dayMs) / 60000;
      const endMin = Math.max((end.getTime() - dayMs) / 60000, startMin + 15);
      return { event: e, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const columns: number[] = [];
  const placed: { col: number; endMin: number; startMin: number; event: CalendarEvent }[] = [];

  for (const item of items) {
    let col = 0;
    while (col < columns.length && columns[col] > item.startMin) col++;
    if (col === columns.length) columns.push(0);
    columns[col] = item.endMin;
    placed.push({ col, endMin: item.endMin, startMin: item.startMin, event: item.event });
  }

  const groups: typeof placed[] = [];
  for (const p of placed) {
    let added = false;
    for (const g of groups) {
      if (g.some((m) => m.startMin < p.endMin && p.startMin < m.endMin)) {
        g.push(p);
        added = true;
        break;
      }
    }
    if (!added) groups.push([p]);
  }

  const colCounts = new Map<typeof placed[number], number>();
  for (const g of groups) {
    const maxCol = Math.max(...g.map((m) => m.col)) + 1;
    for (const m of g) colCounts.set(m, maxCol);
  }

  return placed.map((p) => ({
    event: p.event,
    top: (p.startMin / 60) * HOUR_HEIGHT,
    height: Math.max(((p.endMin - p.startMin) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT),
    col: p.col,
    totalCols: colCounts.get(p) || 1,
  }));
}

function EventBlocks({ positioned, onEditEvent }: { positioned: PositionedEvent[]; onEditEvent: (e: CalendarEvent) => void }) {
  return (
    <>
      {positioned.map((p) => {
        const left = `${(p.col / p.totalCols) * 100}%`;
        const width = `${(1 / p.totalCols) * 100}%`;
        return (
          <div
            key={p.event.id}
            className="absolute rounded bg-primary/20 text-primary border-l-2 border-primary px-1.5 py-0.5 overflow-hidden cursor-pointer hover:bg-primary/30 transition-colors"
            style={{ top: p.top, height: p.height, left, width }}
            onClick={(e) => { e.stopPropagation(); onEditEvent(p.event); }}
          >
            <div className="text-[10px] font-medium truncate leading-tight">{p.event.title}</div>
            {p.height > 30 && (
              <div className="text-[9px] text-primary/70 truncate">
                {format(parseISO(p.event.start), 'h:mm a')} – {format(parseISO(p.event.end), 'h:mm a')}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function HourLines({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-border" style={{ top: i * HOUR_HEIGHT }} />
      ))}
    </>
  );
}

function TimeLabels() {
  return (
    <div className="w-14 shrink-0 relative bg-sidebar" style={{ height: 24 * HOUR_HEIGHT }}>
      {HOUR_LABELS.map((label, i) => (
        i > 0 && (
          <div
            key={i}
            className="absolute right-2 text-[10px] text-muted-foreground leading-none"
            style={{ top: i * HOUR_HEIGHT, transform: 'translateY(-50%)' }}
          >
            {label}
          </div>
        )
      ))}
    </div>
  );
}

function WeekGrid({ currentDate, events, onSelectDate, onEditEvent }: {
  currentDate: Date; events: CalendarEvent[];
  onSelectDate: (d: Date) => void; onEditEvent: (e: CalendarEvent) => void;
}) {
  const ws = startOfWeek(currentDate);
  const we = endOfWeek(currentDate);
  const weekDays: Date[] = [];
  let d = ws;
  while (d <= we) { weekDays.push(d); d = addDays(d, 1); }

  const expanded = useMemo(() => expandRecurring(events, ws, we), [events, ws, we]);

  const dayLayouts = useMemo(
    () => weekDays.map((day) => layoutDayEvents(expanded, day)),
    [expanded, weekDays],
  );

  const gridHeight = 24 * HOUR_HEIGHT;

  return (
    <div className="flex-1 overflow-auto border border-border rounded-lg">
      <div className="flex">
        <div className="w-14 shrink-0 bg-sidebar" />
        {weekDays.map((day) => (
          <div key={day.toISOString()} className={cn('flex-1 p-2 text-center border-l border-border bg-sidebar', isToday(day) && 'bg-primary/10')}>
            <div className="text-[10px] text-muted-foreground">{format(day, 'EEE')}</div>
            <div className={cn('text-sm', isToday(day) ? 'font-bold text-primary' : 'text-foreground')}>{format(day, 'd')}</div>
          </div>
        ))}
      </div>
      <div className="flex">
        <TimeLabels />
        {weekDays.map((day, di) => (
          <div
            key={day.toISOString()}
            className="flex-1 relative border-l border-border"
            style={{ height: gridHeight }}
            onClick={() => onSelectDate(day)}
          >
            <HourLines count={24} />
            <EventBlocks positioned={dayLayouts[di]} onEditEvent={onEditEvent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DayGrid({ currentDate, events, onEditEvent }: {
  currentDate: Date; events: CalendarEvent[];
  onEditEvent: (e: CalendarEvent) => void;
}) {
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);
  const expanded = useMemo(() => expandRecurring(events, dayStart, dayEnd), [events, dayStart, dayEnd]);

  const positioned = useMemo(
    () => layoutDayEvents(expanded, currentDate),
    [expanded, currentDate],
  );

  const gridHeight = 24 * HOUR_HEIGHT;

  return (
    <div className="flex-1 overflow-auto border border-border rounded-lg">
      <div className="flex">
        <TimeLabels />
        <div className="flex-1 relative" style={{ height: gridHeight }}>
          <HourLines count={24} />
          <EventBlocks positioned={positioned} onEditEvent={onEditEvent} />
        </div>
      </div>
    </div>
  );
}
