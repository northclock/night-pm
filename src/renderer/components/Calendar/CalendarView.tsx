import { useState, useEffect, useCallback } from 'react';
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, isToday,
} from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { OpenFile, CalendarEvent } from '../../types';
import { EventForm } from './EventForm';

interface CalendarViewProps { file: OpenFile; }

export function CalendarView({ file }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    try { setEvents(JSON.parse(file.content || '[]')); } catch { setEvents([]); }
  }, [file.content]);

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
    saveEvents(events.map((e) => e.id === editingEvent.id ? { ...e, ...data } : e));
    setShowForm(false); setEditingEvent(null);
  }
  function handleDeleteEvent(id: string) {
    saveEvents(events.filter((e) => e.id !== id));
    setShowForm(false); setEditingEvent(null);
  }

  const monthStart = startOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(endOfMonth(monthStart));
  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { days.push(d); d = addDays(d, 1); }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const getEventsForDay = (day: Date) => events.filter((e) => isSameDay(parseISO(e.start), day));

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><CaretLeft size={18} /></Button>
          <h2 className="text-lg font-semibold text-foreground min-w-[180px] text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><CaretRight size={18} /></Button>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30" onClick={() => { setEditingEvent(null); setShowForm(true); }}>
          <Plus size={14} /> Add Event
        </Button>
      </div>

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
                !isSameMonth(day, currentMonth) && 'opacity-40',
                selectedDate && isSameDay(day, selectedDate) && 'ring-1 ring-primary',
              )}
              onClick={() => { setSelectedDate(day); setEditingEvent(null); setShowForm(true); }}
            >
              <div className={cn(
                'text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                isToday(day) ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground',
              )}>{format(day, 'd')}</div>
              {dayEvents.slice(0, 3).map((evt) => (
                <div key={evt.id} className="text-[10px] px-1 py-0.5 mb-0.5 rounded bg-primary/20 text-primary truncate cursor-pointer hover:bg-primary/30"
                  onClick={(e) => { e.stopPropagation(); setEditingEvent(evt); setShowForm(true); }}>{evt.title}</div>
              ))}
              {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>}
            </div>
          );
        }))}
      </div>

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
    </div>
  );
}
