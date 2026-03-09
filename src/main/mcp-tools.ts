import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readJsonFile, writeJsonFile, readTextFile, getProjectFile } from './file-io';

interface ProjectMcpOptions {
  projectPath: string;
  rootPath?: string;
  setActiveProject?: (projectPath: string) => void;
}

export async function scanProjectTree(dir: string): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    const nipmPath = path.join(fullPath, 'project.nipm');

    let isProject = false;
    let info: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(nipmPath, 'utf-8');
      info = JSON.parse(raw);
      isProject = true;
    } catch { /* not a project */ }

    const children = await scanProjectTree(fullPath);

    if (isProject) {
      results.push({
        name: info.name || entry.name,
        description: info.description || '',
        path: fullPath,
        children,
      });
    } else if (children.length > 0) {
      results.push(...children);
    }
  }
  return results;
}

export function createProjectMcpServer(opts: ProjectMcpOptions) {
  const { projectPath, rootPath, setActiveProject } = opts;
  const calFile = getProjectFile(projectPath, 'calendar.json');
  const todoFile = getProjectFile(projectPath, 'todos.json');
  const contactFile = getProjectFile(projectPath, 'contacts.json');
  const thoughtFile = getProjectFile(projectPath, 'thoughts.json');
  const infoFile = getProjectFile(projectPath, 'info.md');
  const nipmFile = getProjectFile(projectPath, 'project.nipm');
  const ideasFile = getProjectFile(projectPath, 'ideas.json');
  const secretsFile = getProjectFile(projectPath, 'secrets.json');
  const standupFile = getProjectFile(projectPath, 'standup.json');

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
        recurrence: z.object({
          frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
          interval: z.number().optional().describe('Repeat every N frequency units'),
          endDate: z.string().optional().describe('Recurrence end date ISO'),
        }).optional().describe('Recurrence rule'),
      }, async ({ title, description, start, end, allDay, recurrence }) => {
        const events = await readJsonFile(calFile);
        const id = uuidv4();
        const event: Record<string, unknown> = {
          id, title, description: description ?? '', start, end,
          allDay: allDay ?? false, createdOn: new Date().toISOString(),
        };
        if (recurrence) event.recurrence = recurrence;
        events.push(event);
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
        recurrence: z.object({
          frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
          interval: z.number().optional(),
          endDate: z.string().optional(),
        }).optional().describe('Updated recurrence rule'),
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
      tool('todo_list_tasks', 'List tasks, optionally filter by status and/or date range', {
        status: z.enum(['created', 'blocked', 'done']).optional().describe('Filter by status'),
        startDate: z.string().optional().describe('Only tasks with dueDate >= this ISO date (inclusive)'),
        endDate: z.string().optional().describe('Only tasks with dueDate <= this ISO date (inclusive)'),
      }, async ({ status, startDate, endDate }) => {
        let todos = await readJsonFile<Record<string, unknown>>(todoFile);
        if (status) todos = todos.filter((t) => t.status === status);
        if (startDate) todos = todos.filter((t) => typeof t.dueDate === 'string' && t.dueDate >= startDate);
        if (endDate) todos = todos.filter((t) => typeof t.dueDate === 'string' && t.dueDate <= endDate);
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

      tool('project_info', 'Read the project info/context from project.nipm and info.md', {}, async () => {
        let nipmContent = '';
        try {
          const raw = await fs.readFile(nipmFile, 'utf-8');
          nipmContent = raw;
        } catch { /* no .nipm */ }
        const mdContent = await readTextFile(infoFile);
        const parts: string[] = [];
        if (nipmContent) parts.push(`project.nipm:\n${nipmContent}`);
        if (mdContent) parts.push(`info.md:\n${mdContent}`);
        return { content: [{ type: 'text', text: parts.join('\n\n') || 'No project info available.' }] };
      }),

      tool('project_info_update', 'Update the project identity file (project.nipm)', {
        name: z.string().optional().describe('Project name'),
        description: z.string().optional().describe('Project description'),
        whoAmI: z.string().optional().describe('Who am I in this project context'),
        tags: z.array(z.string()).optional().describe('Project tags'),
      }, async ({ name, description, whoAmI, tags }) => {
        let existing: Record<string, unknown> = {};
        try {
          const raw = await fs.readFile(nipmFile, 'utf-8');
          existing = JSON.parse(raw);
        } catch { /* will create new */ }
        if (name !== undefined) existing.name = name;
        if (description !== undefined) existing.description = description;
        if (whoAmI !== undefined) existing.whoAmI = whoAmI;
        if (tags !== undefined) existing.tags = tags;
        if (!existing.created) existing.created = new Date().toISOString();
        await fs.writeFile(nipmFile, JSON.stringify(existing, null, 2), 'utf-8');
        return { content: [{ type: 'text', text: `Project info updated` }] };
      }),

      // ── Ideas ──
      tool('idea_list', 'List all ideas', {}, async () => {
        const ideas = await readJsonFile(ideasFile);
        return { content: [{ type: 'text', text: JSON.stringify(ideas, null, 2) }] };
      }),

      tool('idea_add', 'Add a new half-baked idea', {
        title: z.string().describe('Idea title'),
        description: z.string().optional().default('').describe('Description'),
        tags: z.array(z.string()).optional().default([]).describe('Tags'),
      }, async ({ title, description, tags }) => {
        const ideas = await readJsonFile(ideasFile);
        const id = uuidv4();
        ideas.push({ id, title, description: description ?? '', createdOn: new Date().toISOString(), tags: tags ?? [] });
        await writeJsonFile(ideasFile, ideas);
        return { content: [{ type: 'text', text: `Idea "${title}" added (ID: ${id})` }] };
      }),

      tool('idea_update', 'Update an existing idea', {
        id: z.string().describe('Idea ID'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        tags: z.array(z.string()).optional().describe('New tags'),
      }, async ({ id, ...updates }) => {
        const ideas = await readJsonFile<Record<string, unknown>>(ideasFile);
        const idx = ideas.findIndex((i) => i.id === id);
        if (idx === -1) return { content: [{ type: 'text', text: `Idea ${id} not found` }], isError: true };
        const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        ideas[idx] = { ...ideas[idx], ...clean };
        await writeJsonFile(ideasFile, ideas);
        return { content: [{ type: 'text', text: `Idea updated` }] };
      }),

      tool('idea_delete', 'Delete an idea', {
        id: z.string().describe('Idea ID'),
      }, async ({ id }) => {
        const ideas = await readJsonFile<Record<string, unknown>>(ideasFile);
        const filtered = ideas.filter((i) => i.id !== id);
        if (filtered.length === ideas.length) return { content: [{ type: 'text', text: `Idea ${id} not found` }], isError: true };
        await writeJsonFile(ideasFile, filtered);
        return { content: [{ type: 'text', text: `Idea deleted` }] };
      }),

      // ── Secrets ──
      tool('secret_list', 'List all secrets (private thoughts)', {}, async () => {
        const secrets = await readJsonFile(secretsFile);
        return { content: [{ type: 'text', text: JSON.stringify(secrets, null, 2) }] };
      }),

      tool('secret_add', 'Add a private secret thought (never used for document generation). Automatically removes the matching entry from thoughts.json.', {
        text: z.string().describe('The secret text'),
      }, async ({ text }) => {
        const secrets = await readJsonFile(secretsFile);
        const id = uuidv4();
        secrets.push({ id, text, createdOn: new Date().toISOString() });
        await writeJsonFile(secretsFile, secrets);

        const thoughts = await readJsonFile<Record<string, unknown>>(thoughtFile);
        const cleaned = thoughts.filter((t) => String(t.thought ?? '') !== text);
        if (cleaned.length !== thoughts.length) {
          await writeJsonFile(thoughtFile, cleaned);
        }

        return { content: [{ type: 'text', text: `Secret recorded (ID: ${id}). Removed from thought log.` }] };
      }),

      // ── Standups ──
      tool('standup_list', 'List all saved standups', {}, async () => {
        const standups = await readJsonFile(standupFile);
        return { content: [{ type: 'text', text: JSON.stringify(standups, null, 2) }] };
      }),

      tool('standup_generate', 'Generate and save a standup update. ALWAYS call this when the user asks for a standup, daily update, status report, or daily summary.', {
        startDate: z.string().optional().describe('Start of date range for tasks/events to consider (ISO date, inclusive). Defaults to yesterday.'),
        endDate: z.string().optional().describe('End of date range for tasks/events to consider (ISO date, inclusive). Defaults to today.'),
      }, async ({ startDate, endDate }) => {
        const now = new Date();
        const end = endDate ? new Date(endDate) : now;
        const start = startDate ? new Date(startDate) : new Date(new Date(end).setDate(end.getDate() - 1));
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const todos = await readJsonFile<Record<string, unknown>>(todoFile);
        const events = await readJsonFile<Record<string, unknown>>(calFile);

        const recentlyDone = todos.filter((t) => {
          if (t.status !== 'done') return false;
          const updated = String(t.updatedOn ?? '');
          return updated >= startStr && updated <= endStr + 'T23:59:59';
        });

        const inProgress = todos.filter((t) => t.status === 'created');
        const blocked = todos.filter((t) => t.status === 'blocked');

        const rangeEvents = events.filter((e) => {
          const eDate = String(e.start ?? '').split('T')[0];
          return eDate >= startStr && eDate <= endStr;
        });

        const doneItems = recentlyDone.map((t) => String(t.title));
        const ipItems = inProgress.map((t) => `${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}`);
        const blockedItems = blocked.map((t) => String(t.title));
        const eventItems = rangeEvents.map((e) => `${e.title} (${e.start})`);

        const rangeLabel = startStr === endStr ? endStr : `${startStr} → ${endStr}`;
        const sections: string[] = [];
        sections.push(`## Standup for ${rangeLabel}`);
        sections.push(`### Done\n${doneItems.length ? doneItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`);
        sections.push(`### In Progress\n${ipItems.length ? ipItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`);
        sections.push(`### Blocked\n${blockedItems.length ? blockedItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`);
        sections.push(`### Events\n${eventItems.length ? eventItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`);

        const summary = sections.join('\n\n');

        const standups = await readJsonFile<Record<string, unknown>>(standupFile);
        const existing = standups.findIndex((s) => s.date === endStr);
        const entry = {
          id: existing >= 0 ? standups[existing].id as string : uuidv4(),
          date: endStr,
          startDate: startStr,
          endDate: endStr,
          summary,
          done: doneItems,
          inProgress: ipItems,
          blocked: blockedItems,
          events: eventItems,
          createdOn: existing >= 0 ? standups[existing].createdOn as string : new Date().toISOString(),
        };
        if (existing >= 0) {
          standups[existing] = entry;
        } else {
          standups.push(entry);
        }
        await writeJsonFile(standupFile, standups);

        return { content: [{ type: 'text', text: summary }] };
      }),

      tool('standup_delete', 'Delete a standup entry', {
        id: z.string().describe('Standup ID to delete'),
      }, async ({ id }) => {
        const standups = await readJsonFile<Record<string, unknown>>(standupFile);
        const filtered = standups.filter((s) => s.id !== id);
        if (filtered.length === standups.length) return { content: [{ type: 'text', text: `Standup ${id} not found` }], isError: true };
        await writeJsonFile(standupFile, filtered);
        return { content: [{ type: 'text', text: 'Standup deleted' }] };
      }),

      // ── Project Discovery ──
      tool('project_list', 'List all available projects (recursive tree with nested projects)', {}, async () => {
        const scanRoot = rootPath || path.dirname(projectPath);
        const tree = await scanProjectTree(scanRoot);
        return { content: [{ type: 'text', text: JSON.stringify(tree, null, 2) }] };
      }),

      tool('project_set_active', 'Set the active project by path', {
        path: z.string().describe('Absolute path to the project folder'),
      }, async ({ path: projectDir }) => {
        if (setActiveProject) {
          setActiveProject(projectDir);
          return { content: [{ type: 'text', text: `Active project set to "${projectDir}"` }] };
        }
        return { content: [{ type: 'text', text: 'Cannot change active project in this context' }], isError: true };
      }),
    ],
  });
}
