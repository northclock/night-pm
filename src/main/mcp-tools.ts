import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { readJsonFile, writeJsonFile, readTextFile, getProjectFile } from './file-io';

export function createProjectMcpServer(projectPath: string) {
  const calFile = getProjectFile(projectPath, 'calendar.json');
  const todoFile = getProjectFile(projectPath, 'todos.json');
  const contactFile = getProjectFile(projectPath, 'contacts.json');
  const thoughtFile = getProjectFile(projectPath, 'thoughts.json');
  const infoFile = getProjectFile(projectPath, 'info.md');

  return createSdkMcpServer({
    name: 'night-pm',
    version: '1.0.0',
    tools: [
      // ── Calendar ──
      tool('calendar_list_events', 'List all calendar events', {}, async () => {
        const events = await readJsonFile(calFile);
        return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
      }),

      tool('calendar_add_event', 'Add a new calendar event', {
        title: z.string().describe('Event title'),
        description: z.string().optional().default('').describe('Event description'),
        start: z.string().describe('Start date/time ISO string'),
        end: z.string().describe('End date/time ISO string'),
        allDay: z.boolean().optional().default(false).describe('All-day event'),
      }, async ({ title, description, start, end, allDay }) => {
        const events = await readJsonFile(calFile);
        const id = uuidv4();
        events.push({ id, title, description: description ?? '', start, end, allDay: allDay ?? false, createdOn: new Date().toISOString() });
        await writeJsonFile(calFile, events);
        return { content: [{ type: 'text', text: `Event "${title}" added (ID: ${id})` }] };
      }),

      tool('calendar_update_event', 'Update an existing calendar event', {
        id: z.string().describe('Event ID'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        start: z.string().optional().describe('New start'),
        end: z.string().optional().describe('New end'),
        allDay: z.boolean().optional().describe('New all-day flag'),
      }, async ({ id, ...updates }) => {
        const events = await readJsonFile<Record<string, unknown>>(calFile);
        const idx = events.findIndex((e) => e.id === id);
        if (idx === -1) return { content: [{ type: 'text', text: `Event ${id} not found` }], isError: true };
        const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        events[idx] = { ...events[idx], ...clean };
        await writeJsonFile(calFile, events);
        return { content: [{ type: 'text', text: `Event updated` }] };
      }),

      tool('calendar_delete_event', 'Delete a calendar event', {
        id: z.string().describe('Event ID'),
      }, async ({ id }) => {
        const events = await readJsonFile<Record<string, unknown>>(calFile);
        const filtered = events.filter((e) => e.id !== id);
        if (filtered.length === events.length) return { content: [{ type: 'text', text: `Event ${id} not found` }], isError: true };
        await writeJsonFile(calFile, filtered);
        return { content: [{ type: 'text', text: `Event deleted` }] };
      }),

      // ── Todos ──
      tool('todo_list_tasks', 'List all tasks, optionally filter by status', {
        status: z.enum(['created', 'blocked', 'done']).optional().describe('Filter by status'),
      }, async ({ status }) => {
        let todos = await readJsonFile<Record<string, unknown>>(todoFile);
        if (status) todos = todos.filter((t) => t.status === status);
        return { content: [{ type: 'text', text: JSON.stringify(todos, null, 2) }] };
      }),

      tool('todo_add_task', 'Add a new task', {
        title: z.string().describe('Task title'),
        description: z.string().optional().default('').describe('Description'),
        dueDate: z.string().optional().default('').describe('Due date ISO'),
        status: z.enum(['created', 'blocked', 'done']).optional().default('created').describe('Status'),
      }, async ({ title, description, dueDate, status }) => {
        const todos = await readJsonFile(todoFile);
        const now = new Date().toISOString();
        const id = uuidv4();
        todos.push({ id, title, description: description ?? '', dueDate: dueDate ?? '', createdOn: now, updatedOn: now, status: status ?? 'created' });
        await writeJsonFile(todoFile, todos);
        return { content: [{ type: 'text', text: `Task "${title}" added (ID: ${id})` }] };
      }),

      tool('todo_update_task', 'Update an existing task', {
        id: z.string().describe('Task ID'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        dueDate: z.string().optional().describe('New due date'),
        status: z.enum(['created', 'blocked', 'done']).optional().describe('New status'),
      }, async ({ id, ...updates }) => {
        const todos = await readJsonFile<Record<string, unknown>>(todoFile);
        const idx = todos.findIndex((t) => t.id === id);
        if (idx === -1) return { content: [{ type: 'text', text: `Task ${id} not found` }], isError: true };
        const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        todos[idx] = { ...todos[idx], ...clean, updatedOn: new Date().toISOString() };
        await writeJsonFile(todoFile, todos);
        return { content: [{ type: 'text', text: `Task "${todos[idx].title}" updated` }] };
      }),

      tool('todo_delete_task', 'Delete a task', {
        id: z.string().describe('Task ID'),
      }, async ({ id }) => {
        const todos = await readJsonFile<Record<string, unknown>>(todoFile);
        const filtered = todos.filter((t) => t.id !== id);
        if (filtered.length === todos.length) return { content: [{ type: 'text', text: `Task ${id} not found` }], isError: true };
        await writeJsonFile(todoFile, filtered);
        return { content: [{ type: 'text', text: `Task deleted` }] };
      }),

      // ── Contacts ──
      tool('contact_list', 'List all contacts', {}, async () => {
        const contacts = await readJsonFile(contactFile);
        return { content: [{ type: 'text', text: JSON.stringify(contacts, null, 2) }] };
      }),

      tool('contact_search', 'Search contacts by name (partial, case-insensitive). Use BEFORE contact_add to check duplicates.', {
        query: z.string().describe('Search query'),
      }, async ({ query }) => {
        const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
        const q = query.toLowerCase().trim();
        const matches = contacts.filter((c) => String(c.name ?? '').toLowerCase().includes(q));
        if (matches.length === 0) return { content: [{ type: 'text', text: `No contacts matching "${query}"` }] };
        return { content: [{ type: 'text', text: `Found ${matches.length} contact(s):\n${JSON.stringify(matches, null, 2)}` }] };
      }),

      tool('contact_add', 'Add a new contact. Checks for duplicates by name first.', {
        name: z.string().describe('Contact name'),
        title: z.string().optional().default('').describe('Title/role'),
        info: z.string().optional().default('').describe('Additional info'),
        relatedContacts: z.array(z.object({ relatedContactId: z.string(), relationship: z.string() })).optional().default([]).describe('Related contacts'),
      }, async ({ name, title, info, relatedContacts }) => {
        const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
        const existing = contacts.find((c) => String(c.name ?? '').toLowerCase().trim() === name.toLowerCase().trim());
        if (existing) {
          return { content: [{ type: 'text', text: `Contact "${existing.name}" already exists (ID: ${existing.id}). Use contact_update instead.` }] };
        }
        const id = uuidv4();
        contacts.push({ id, name, title: title ?? '', info: info ?? '', relatedContacts: relatedContacts ?? [] });
        await writeJsonFile(contactFile, contacts);
        return { content: [{ type: 'text', text: `Contact "${name}" added (ID: ${id})` }] };
      }),

      tool('contact_update', 'Update an existing contact', {
        id: z.string().describe('Contact ID'),
        name: z.string().optional().describe('New name'),
        title: z.string().optional().describe('New title'),
        info: z.string().optional().describe('New info (appended)'),
        relatedContacts: z.array(z.object({ relatedContactId: z.string(), relationship: z.string() })).optional().describe('Related contacts'),
      }, async ({ id, info, ...updates }) => {
        const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
        const idx = contacts.findIndex((c) => c.id === id);
        if (idx === -1) return { content: [{ type: 'text', text: `Contact ${id} not found` }], isError: true };
        const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        if (info !== undefined) {
          clean.info = contacts[idx].info ? `${contacts[idx].info}\n${info}` : info;
        }
        contacts[idx] = { ...contacts[idx], ...clean };
        await writeJsonFile(contactFile, contacts);
        return { content: [{ type: 'text', text: `Contact "${contacts[idx].name}" updated` }] };
      }),

      tool('contact_delete', 'Delete a contact', {
        id: z.string().describe('Contact ID'),
      }, async ({ id }) => {
        const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
        const filtered = contacts.filter((c) => c.id !== id);
        if (filtered.length === contacts.length) return { content: [{ type: 'text', text: `Contact ${id} not found` }], isError: true };
        await writeJsonFile(contactFile, filtered);
        return { content: [{ type: 'text', text: `Contact deleted` }] };
      }),

      // ── Thoughts ──
      tool('thought_list', 'List all recorded thoughts', {}, async () => {
        const thoughts = await readJsonFile(thoughtFile);
        return { content: [{ type: 'text', text: JSON.stringify(thoughts, null, 2) }] };
      }),

      tool('thought_add', 'Add a new thought entry', {
        thought: z.string().describe('The thought text'),
        actionsTriggered: z.array(z.string()).optional().default([]).describe('Actions triggered'),
      }, async ({ thought, actionsTriggered }) => {
        const thoughts = await readJsonFile(thoughtFile);
        thoughts.push({ thought, actionsTriggered: actionsTriggered ?? [], createdOn: new Date().toISOString() });
        await writeJsonFile(thoughtFile, thoughts);
        return { content: [{ type: 'text', text: `Thought recorded` }] };
      }),

      tool('project_info', 'Read the project info/context from info.md', {}, async () => {
        const content = await readTextFile(infoFile);
        return { content: [{ type: 'text', text: content || 'No project info available.' }] };
      }),
    ],
  });
}
