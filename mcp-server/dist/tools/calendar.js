import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { readJsonFile, writeJsonFile, getProjectFile } from '../utils/file-io.js';
export function registerCalendarTools(server, projectPath) {
    const filePath = getProjectFile(projectPath, 'calendar.json');
    server.tool('calendar_list_events', 'List all calendar events', {}, async () => {
        try {
            const events = await readJsonFile(filePath);
            return {
                content: [{ type: 'text', text: JSON.stringify(events, null, 2) }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error listing events: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('calendar_add_event', 'Add a new calendar event', {
        title: z.string().describe('Event title'),
        description: z.string().optional().default('').describe('Event description'),
        start: z.string().describe('Start date/time ISO string'),
        end: z.string().describe('End date/time ISO string'),
        allDay: z.boolean().optional().default(false).describe('Whether this is an all-day event'),
    }, async ({ title, description, start, end, allDay }) => {
        try {
            const events = await readJsonFile(filePath);
            const newEvent = {
                id: uuidv4(),
                title,
                description: description ?? '',
                start,
                end,
                allDay: allDay ?? false,
                createdOn: new Date().toISOString(),
            };
            events.push(newEvent);
            await writeJsonFile(filePath, events);
            return {
                content: [
                    { type: 'text', text: `Event "${title}" added with ID ${newEvent.id}` },
                ],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error adding event: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('calendar_update_event', 'Update an existing calendar event', {
        id: z.string().describe('Event ID to update'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        start: z.string().optional().describe('New start date/time'),
        end: z.string().optional().describe('New end date/time'),
        allDay: z.boolean().optional().describe('New all-day flag'),
    }, async ({ id, ...updates }) => {
        try {
            const events = await readJsonFile(filePath);
            const idx = events.findIndex((e) => e.id === id);
            if (idx === -1) {
                return {
                    content: [{ type: 'text', text: `Event with ID ${id} not found` }],
                    isError: true,
                };
            }
            const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
            events[idx] = { ...events[idx], ...filtered };
            await writeJsonFile(filePath, events);
            return {
                content: [{ type: 'text', text: `Event "${events[idx].title}" updated` }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error updating event: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('calendar_delete_event', 'Delete a calendar event', {
        id: z.string().describe('Event ID to delete'),
    }, async ({ id }) => {
        try {
            const events = await readJsonFile(filePath);
            const filtered = events.filter((e) => e.id !== id);
            if (filtered.length === events.length) {
                return {
                    content: [{ type: 'text', text: `Event with ID ${id} not found` }],
                    isError: true,
                };
            }
            await writeJsonFile(filePath, filtered);
            return {
                content: [{ type: 'text', text: `Event deleted` }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error deleting event: ${err}` }],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=calendar.js.map