import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CalendarEvent } from '../../types';

interface EventFormProps {
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  onSave: (data: Omit<CalendarEvent, 'id' | 'createdOn'>) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function EventForm({ event, defaultDate, onSave, onDelete, onCancel }: EventFormProps) {
  const defaultStart = event?.start
    ? event.start.substring(0, 16)
    : defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const defaultEnd = event?.end
    ? event.end.substring(0, 16)
    : defaultDate ? format(addDays(defaultDate || new Date(), 0), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [isRecurring, setIsRecurring] = useState(!!event?.recurrence);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(event?.recurrence?.frequency || 'weekly');
  const [interval, setInterval] = useState(String(event?.recurrence?.interval || 1));
  const [recEndDate, setRecEndDate] = useState(event?.recurrence?.endDate ? event.recurrence.endDate.substring(0, 10) : '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const data: Omit<CalendarEvent, 'id' | 'createdOn'> = {
      title: title.trim(),
      description: description.trim(),
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay,
    };
    if (isRecurring) {
      data.recurrence = {
        frequency,
        interval: parseInt(interval) || 1,
        endDate: recEndDate ? new Date(recEndDate).toISOString() : undefined,
      };
    }
    onSave(data);
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{event ? 'Edit Event' : 'New Event'}</h3>
      <div className="space-y-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="event-desc">Description</Label>
        <Textarea id="event-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="allDay" checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} />
        <Label htmlFor="allDay" className="text-xs">All day</Label>
      </div>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="text-xs" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox id="recurring" checked={isRecurring} onCheckedChange={(v) => setIsRecurring(v === true)} />
        <Label htmlFor="recurring" className="text-xs">Recurring</Label>
      </div>
      {isRecurring && (
        <div className="space-y-3 pl-6 border-l-2 border-border">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Every N</Label>
              <Input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End date (optional)</Label>
            <Input type="date" value={recEndDate} onChange={(e) => setRecEndDate(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">{event ? 'Update' : 'Create'}</Button>
        {onDelete && <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>}
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
