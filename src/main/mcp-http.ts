import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import * as http from 'node:http';
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { readJsonFile, writeJsonFile, readTextFile, getProjectFile } from './file-io';
import { scanProjectTree } from './mcp-tools';

const DEFAULT_PORT = 7777;
const PORT_RANGE = 100;

let httpServer: http.Server | null = null;
let activePort: number | null = null;
const transports = new Map<string, SSEServerTransport>();

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => { s.close(() => resolve(true)); });
    s.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(): Promise<number> {
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + PORT_RANGE; p++) {
    if (await isPortAvailable(p)) return p;
  }
  throw new Error(`No available port in range ${DEFAULT_PORT}–${DEFAULT_PORT + PORT_RANGE - 1}`);
}

function createMcpServerInstance(
  getProjectPath: () => string | null,
  getRootPath: () => string | null,
  setActiveProject?: (p: string) => void,
): McpServer {
  const server = new McpServer({ name: 'night-pm', version: '1.0.0' });

  function requireProject(): { calFile: string; todoFile: string; contactFile: string; thoughtFile: string; infoFile: string; nipmFile: string; ideasFile: string; secretsFile: string; standupFile: string } {
    const pp = getProjectPath();
    if (!pp) throw new Error('No active project. Open a project in Night PM first.');
    return {
      calFile: getProjectFile(pp, 'calendar.json'),
      todoFile: getProjectFile(pp, 'todos.json'),
      contactFile: getProjectFile(pp, 'contacts.json'),
      thoughtFile: getProjectFile(pp, 'thoughts.json'),
      infoFile: getProjectFile(pp, 'info.md'),
      nipmFile: getProjectFile(pp, 'project.nipm'),
      ideasFile: getProjectFile(pp, 'ideas.json'),
      secretsFile: getProjectFile(pp, 'secrets.json'),
      standupFile: getProjectFile(pp, 'standup.json'),
    };
  }

  const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
  const err = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true as const });

  // ── Calendar ──
  server.tool('calendar_list_events', 'List all calendar events', {}, async () => {
    const { calFile } = requireProject();
    return ok(JSON.stringify(await readJsonFile(calFile), null, 2));
  });

  server.tool('calendar_add_event', 'Add a new calendar event', {
    title: z.string(), description: z.string().optional().default(''),
    start: z.string(), end: z.string(),
    allDay: z.boolean().optional().default(false),
    recurrence: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      interval: z.number().optional(), endDate: z.string().optional(),
    }).optional(),
  }, async ({ title, description, start, end, allDay, recurrence }) => {
    const { calFile } = requireProject();
    const events = await readJsonFile(calFile);
    const id = uuidv4();
    const ev: Record<string, unknown> = { id, title, description: description ?? '', start, end, allDay: allDay ?? false, createdOn: new Date().toISOString() };
    if (recurrence) ev.recurrence = recurrence;
    events.push(ev);
    await writeJsonFile(calFile, events);
    return ok(`Event "${title}" added (ID: ${id})`);
  });

  server.tool('calendar_update_event', 'Update an existing calendar event', {
    id: z.string(), title: z.string().optional(), description: z.string().optional(),
    start: z.string().optional(), end: z.string().optional(), allDay: z.boolean().optional(),
    recurrence: z.object({ frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']), interval: z.number().optional(), endDate: z.string().optional() }).optional(),
  }, async ({ id, ...updates }) => {
    const { calFile } = requireProject();
    const events = await readJsonFile<Record<string, unknown>>(calFile);
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return err(`Event ${id} not found`);
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    events[idx] = { ...events[idx], ...clean };
    await writeJsonFile(calFile, events);
    return ok('Event updated');
  });

  server.tool('calendar_delete_event', 'Delete a calendar event', { id: z.string() }, async ({ id }) => {
    const { calFile } = requireProject();
    const events = await readJsonFile<Record<string, unknown>>(calFile);
    const filtered = events.filter((e) => e.id !== id);
    if (filtered.length === events.length) return err(`Event ${id} not found`);
    await writeJsonFile(calFile, filtered);
    return ok('Event deleted');
  });

  // ── Todos ──
  server.tool('todo_list_tasks', 'List tasks, optionally filter by status and/or date range', {
    status: z.enum(['created', 'blocked', 'done']).optional(),
    startDate: z.string().optional(), endDate: z.string().optional(),
  }, async ({ status, startDate, endDate }) => {
    const { todoFile } = requireProject();
    let todos = await readJsonFile<Record<string, unknown>>(todoFile);
    if (status) todos = todos.filter((t) => t.status === status);
    if (startDate) todos = todos.filter((t) => typeof t.dueDate === 'string' && t.dueDate >= startDate);
    if (endDate) todos = todos.filter((t) => typeof t.dueDate === 'string' && t.dueDate <= endDate);
    return ok(JSON.stringify(todos, null, 2));
  });

  server.tool('todo_add_task', 'Add a new task', {
    title: z.string(), description: z.string().optional().default(''),
    dueDate: z.string().optional().default(''), status: z.enum(['created', 'blocked', 'done']).optional().default('created'),
  }, async ({ title, description, dueDate, status }) => {
    const { todoFile } = requireProject();
    const todos = await readJsonFile(todoFile);
    const now = new Date().toISOString();
    const id = uuidv4();
    todos.push({ id, title, description: description ?? '', dueDate: dueDate ?? '', createdOn: now, updatedOn: now, status: status ?? 'created' });
    await writeJsonFile(todoFile, todos);
    return ok(`Task "${title}" added (ID: ${id})`);
  });

  server.tool('todo_update_task', 'Update an existing task', {
    id: z.string(), title: z.string().optional(), description: z.string().optional(),
    dueDate: z.string().optional(), status: z.enum(['created', 'blocked', 'done']).optional(),
  }, async ({ id, ...updates }) => {
    const { todoFile } = requireProject();
    const todos = await readJsonFile<Record<string, unknown>>(todoFile);
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) return err(`Task ${id} not found`);
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    todos[idx] = { ...todos[idx], ...clean, updatedOn: new Date().toISOString() };
    await writeJsonFile(todoFile, todos);
    return ok(`Task "${todos[idx].title}" updated`);
  });

  server.tool('todo_delete_task', 'Delete a task', { id: z.string() }, async ({ id }) => {
    const { todoFile } = requireProject();
    const todos = await readJsonFile<Record<string, unknown>>(todoFile);
    const filtered = todos.filter((t) => t.id !== id);
    if (filtered.length === todos.length) return err(`Task ${id} not found`);
    await writeJsonFile(todoFile, filtered);
    return ok('Task deleted');
  });

  // ── Contacts ──
  server.tool('contact_list', 'List all contacts', {}, async () => {
    const { contactFile } = requireProject();
    return ok(JSON.stringify(await readJsonFile(contactFile), null, 2));
  });

  server.tool('contact_search', 'Search contacts by name (partial, case-insensitive)', { query: z.string() }, async ({ query }) => {
    const { contactFile } = requireProject();
    const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
    const q = query.toLowerCase().trim();
    const matches = contacts.filter((c) => String(c.name ?? '').toLowerCase().includes(q));
    if (matches.length === 0) return ok(`No contacts matching "${query}"`);
    return ok(`Found ${matches.length} contact(s):\n${JSON.stringify(matches, null, 2)}`);
  });

  server.tool('contact_add', 'Add a new contact', {
    name: z.string(), title: z.string().optional().default(''),
    info: z.string().optional().default(''),
    relatedContacts: z.array(z.object({ relatedContactId: z.string(), relationship: z.string() })).optional().default([]),
  }, async ({ name, title, info, relatedContacts }) => {
    const { contactFile } = requireProject();
    const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
    const existing = contacts.find((c) => String(c.name ?? '').toLowerCase().trim() === name.toLowerCase().trim());
    if (existing) return ok(`Contact "${existing.name}" already exists (ID: ${existing.id}). Use contact_update instead.`);
    const id = uuidv4();
    contacts.push({ id, name, title: title ?? '', info: info ?? '', relatedContacts: relatedContacts ?? [] });
    await writeJsonFile(contactFile, contacts);
    return ok(`Contact "${name}" added (ID: ${id})`);
  });

  server.tool('contact_update', 'Update an existing contact', {
    id: z.string(), name: z.string().optional(), title: z.string().optional(),
    info: z.string().optional(),
    relatedContacts: z.array(z.object({ relatedContactId: z.string(), relationship: z.string() })).optional(),
  }, async ({ id, info, ...updates }) => {
    const { contactFile } = requireProject();
    const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
    const idx = contacts.findIndex((c) => c.id === id);
    if (idx === -1) return err(`Contact ${id} not found`);
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    if (info !== undefined) clean.info = contacts[idx].info ? `${contacts[idx].info}\n${info}` : info;
    contacts[idx] = { ...contacts[idx], ...clean };
    await writeJsonFile(contactFile, contacts);
    return ok(`Contact "${contacts[idx].name}" updated`);
  });

  server.tool('contact_delete', 'Delete a contact', { id: z.string() }, async ({ id }) => {
    const { contactFile } = requireProject();
    const contacts = await readJsonFile<Record<string, unknown>>(contactFile);
    const filtered = contacts.filter((c) => c.id !== id);
    if (filtered.length === contacts.length) return err(`Contact ${id} not found`);
    await writeJsonFile(contactFile, filtered);
    return ok('Contact deleted');
  });

  // ── Thoughts ──
  server.tool('thought_list', 'List all recorded thoughts', {}, async () => {
    const { thoughtFile } = requireProject();
    return ok(JSON.stringify(await readJsonFile(thoughtFile), null, 2));
  });

  server.tool('thought_add', 'Add a new thought entry', {
    thought: z.string(), actionsTriggered: z.array(z.string()).optional().default([]),
  }, async ({ thought, actionsTriggered }) => {
    const { thoughtFile } = requireProject();
    const thoughts = await readJsonFile(thoughtFile);
    thoughts.push({ thought, actionsTriggered: actionsTriggered ?? [], createdOn: new Date().toISOString() });
    await writeJsonFile(thoughtFile, thoughts);
    return ok('Thought recorded');
  });

  // ── Project Info ──
  server.tool('project_info', 'Read the project info/context from project.nipm and info.md', {}, async () => {
    const { nipmFile, infoFile } = requireProject();
    let nipmContent = '';
    try { nipmContent = await fs.readFile(nipmFile, 'utf-8'); } catch { /* no file */ }
    const mdContent = await readTextFile(infoFile);
    const parts: string[] = [];
    if (nipmContent) parts.push(`project.nipm:\n${nipmContent}`);
    if (mdContent) parts.push(`info.md:\n${mdContent}`);
    return ok(parts.join('\n\n') || 'No project info available.');
  });

  server.tool('project_info_update', 'Update the project identity file (project.nipm)', {
    name: z.string().optional(), description: z.string().optional(),
    whoAmI: z.string().optional(), tags: z.array(z.string()).optional(),
  }, async ({ name, description, whoAmI, tags }) => {
    const { nipmFile } = requireProject();
    let existing: Record<string, unknown> = {};
    try { existing = JSON.parse(await fs.readFile(nipmFile, 'utf-8')); } catch { /* create new */ }
    if (name !== undefined) existing.name = name;
    if (description !== undefined) existing.description = description;
    if (whoAmI !== undefined) existing.whoAmI = whoAmI;
    if (tags !== undefined) existing.tags = tags;
    if (!existing.created) existing.created = new Date().toISOString();
    await fs.mkdir(path.dirname(nipmFile), { recursive: true });
    await fs.writeFile(nipmFile, JSON.stringify(existing, null, 2), 'utf-8');
    return ok('Project info updated');
  });

  // ── Ideas ──
  server.tool('idea_list', 'List all ideas', {}, async () => {
    const { ideasFile } = requireProject();
    return ok(JSON.stringify(await readJsonFile(ideasFile), null, 2));
  });

  server.tool('idea_add', 'Add a new idea', {
    title: z.string(), description: z.string().optional().default(''), tags: z.array(z.string()).optional().default([]),
  }, async ({ title, description, tags }) => {
    const { ideasFile } = requireProject();
    const ideas = await readJsonFile(ideasFile);
    const id = uuidv4();
    ideas.push({ id, title, description: description ?? '', createdOn: new Date().toISOString(), tags: tags ?? [] });
    await writeJsonFile(ideasFile, ideas);
    return ok(`Idea "${title}" added (ID: ${id})`);
  });

  server.tool('idea_update', 'Update an existing idea', {
    id: z.string(), title: z.string().optional(), description: z.string().optional(), tags: z.array(z.string()).optional(),
  }, async ({ id, ...updates }) => {
    const { ideasFile } = requireProject();
    const ideas = await readJsonFile<Record<string, unknown>>(ideasFile);
    const idx = ideas.findIndex((i) => i.id === id);
    if (idx === -1) return err(`Idea ${id} not found`);
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    ideas[idx] = { ...ideas[idx], ...clean };
    await writeJsonFile(ideasFile, ideas);
    return ok('Idea updated');
  });

  server.tool('idea_delete', 'Delete an idea', { id: z.string() }, async ({ id }) => {
    const { ideasFile } = requireProject();
    const ideas = await readJsonFile<Record<string, unknown>>(ideasFile);
    const filtered = ideas.filter((i) => i.id !== id);
    if (filtered.length === ideas.length) return err(`Idea ${id} not found`);
    await writeJsonFile(ideasFile, filtered);
    return ok('Idea deleted');
  });

  // ── Secrets ──
  server.tool('secret_list', 'List all secrets (private thoughts)', {}, async () => {
    const { secretsFile } = requireProject();
    return ok(JSON.stringify(await readJsonFile(secretsFile), null, 2));
  });

  server.tool('secret_add', 'Add a private secret thought. Automatically removes matching entry from thoughts.json.', {
    text: z.string(),
  }, async ({ text }) => {
    const { secretsFile, thoughtFile } = requireProject();
    const secrets = await readJsonFile(secretsFile);
    const id = uuidv4();
    secrets.push({ id, text, createdOn: new Date().toISOString() });
    await writeJsonFile(secretsFile, secrets);
    const thoughts = await readJsonFile<Record<string, unknown>>(thoughtFile);
    const cleaned = thoughts.filter((t) => String(t.thought ?? '') !== text);
    if (cleaned.length !== thoughts.length) await writeJsonFile(thoughtFile, cleaned);
    return ok(`Secret recorded (ID: ${id}). Removed from thought log.`);
  });

  // ── Standups ──
  server.tool('standup_list', 'List all saved standups', {}, async () => {
    const { standupFile } = requireProject();
    return ok(JSON.stringify(await readJsonFile(standupFile), null, 2));
  });

  server.tool('standup_generate', 'Generate and save a standup update', {
    startDate: z.string().optional(), endDate: z.string().optional(),
  }, async ({ startDate, endDate }) => {
    const { todoFile, calFile: calendarFile, standupFile } = requireProject();
    const now = new Date();
    const end = endDate ? new Date(endDate) : now;
    const start = startDate ? new Date(startDate) : new Date(new Date(end).setDate(end.getDate() - 1));
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const todos = await readJsonFile<Record<string, unknown>>(todoFile);
    const events = await readJsonFile<Record<string, unknown>>(calendarFile);

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
    const sections = [
      `## Standup for ${rangeLabel}`,
      `### Done\n${doneItems.length ? doneItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`,
      `### In Progress\n${ipItems.length ? ipItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`,
      `### Blocked\n${blockedItems.length ? blockedItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`,
      `### Events\n${eventItems.length ? eventItems.map((i) => `- ${i}`).join('\n') : '- (none)'}`,
    ];
    const summary = sections.join('\n\n');

    const standups = await readJsonFile<Record<string, unknown>>(standupFile);
    const existingIdx = standups.findIndex((s) => s.date === endStr);
    const entry = {
      id: existingIdx >= 0 ? standups[existingIdx].id as string : uuidv4(),
      date: endStr, startDate: startStr, endDate: endStr, summary,
      done: doneItems, inProgress: ipItems, blocked: blockedItems, events: eventItems,
      createdOn: existingIdx >= 0 ? standups[existingIdx].createdOn as string : new Date().toISOString(),
    };
    if (existingIdx >= 0) standups[existingIdx] = entry; else standups.push(entry);
    await writeJsonFile(standupFile, standups);
    return ok(summary);
  });

  server.tool('standup_delete', 'Delete a standup entry', { id: z.string() }, async ({ id }) => {
    const { standupFile } = requireProject();
    const standups = await readJsonFile<Record<string, unknown>>(standupFile);
    const filtered = standups.filter((s) => s.id !== id);
    if (filtered.length === standups.length) return err(`Standup ${id} not found`);
    await writeJsonFile(standupFile, filtered);
    return ok('Standup deleted');
  });

  // ── Project Discovery ──
  server.tool('project_list', 'List all available projects', {}, async () => {
    const rootPath = getRootPath();
    const pp = getProjectPath();
    const scanRoot = rootPath || (pp ? path.dirname(pp) : null);
    if (!scanRoot) return err('No root path configured');
    const tree = await scanProjectTree(scanRoot);
    return ok(JSON.stringify(tree, null, 2));
  });

  server.tool('project_set_active', 'Set the active project by path', { path: z.string() }, async ({ path: projectDir }) => {
    if (setActiveProject) {
      setActiveProject(projectDir);
      return ok(`Active project set to "${projectDir}"`);
    }
    return err('Cannot change active project in this context');
  });

  return server;
}

export interface McpHttpStatus {
  running: boolean;
  port: number | null;
  connections: number;
  url: string | null;
}

export async function startMcpHttpServer(
  getProjectPath: () => string | null,
  getRootPath: () => string | null,
  setActiveProject?: (p: string) => void,
): Promise<McpHttpStatus> {
  if (httpServer) return getStatus();

  const port = await findAvailablePort();

  httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/messages', res);
      const mcpInst = createMcpServerInstance(getProjectPath, getRootPath, setActiveProject);
      transports.set(transport.sessionId, transport);
      res.on('close', () => { transports.delete(transport.sessionId); });
      await mcpInst.connect(transport);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId');
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Session not found'); return; }
      await transport.handlePostMessage(req, res);
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', name: 'night-pm', version: '1.0.0', connections: transports.size }));
      return;
    }

    res.writeHead(404); res.end('Not found');
  });

  await new Promise<void>((resolve, reject) => {
    httpServer!.once('error', reject);
    httpServer!.listen(port, '127.0.0.1', () => { activePort = port; resolve(); });
  });

  console.log(`[MCP HTTP] Server listening on http://127.0.0.1:${port}/sse`);
  return getStatus();
}

export async function stopMcpHttpServer(): Promise<void> {
  if (!httpServer) return;
  for (const t of transports.values()) {
    try { await t.close(); } catch { /* ignore */ }
  }
  transports.clear();
  await new Promise<void>((resolve) => {
    httpServer!.close(() => resolve());
  });
  httpServer = null;
  activePort = null;
  console.log('[MCP HTTP] Server stopped');
}

export function getStatus(): McpHttpStatus {
  return {
    running: httpServer !== null,
    port: activePort,
    connections: transports.size,
    url: activePort ? `http://127.0.0.1:${activePort}/sse` : null,
  };
}
