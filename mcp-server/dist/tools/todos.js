import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { readJsonFile, writeJsonFile, getProjectFile } from '../utils/file-io.js';
export function registerTodoTools(server, projectPath) {
    const filePath = getProjectFile(projectPath, 'todos.json');
    server.tool('todo_list_tasks', 'List all tasks, optionally filtered by status', {
        status: z
            .enum(['created', 'blocked', 'done'])
            .optional()
            .describe('Filter by status'),
    }, async ({ status }) => {
        try {
            let todos = await readJsonFile(filePath);
            if (status) {
                todos = todos.filter((t) => t.status === status);
            }
            return {
                content: [{ type: 'text', text: JSON.stringify(todos, null, 2) }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error listing tasks: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('todo_add_task', 'Add a new task/todo', {
        title: z.string().describe('Task title'),
        description: z.string().optional().default('').describe('Task description'),
        dueDate: z.string().optional().default('').describe('Due date ISO string'),
        status: z
            .enum(['created', 'blocked', 'done'])
            .optional()
            .default('created')
            .describe('Initial status (default: created)'),
    }, async ({ title, description, dueDate, status }) => {
        try {
            const todos = await readJsonFile(filePath);
            const now = new Date().toISOString();
            const newTodo = {
                id: uuidv4(),
                title,
                description: description ?? '',
                dueDate: dueDate ?? '',
                createdOn: now,
                updatedOn: now,
                status: status ?? 'created',
            };
            todos.push(newTodo);
            await writeJsonFile(filePath, todos);
            return {
                content: [
                    { type: 'text', text: `Task "${title}" added with ID ${newTodo.id}` },
                ],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error adding task: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('todo_update_task', 'Update an existing task', {
        id: z.string().describe('Task ID to update'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        dueDate: z.string().optional().describe('New due date'),
        status: z
            .enum(['created', 'blocked', 'done'])
            .optional()
            .describe('New status'),
    }, async ({ id, ...updates }) => {
        try {
            const todos = await readJsonFile(filePath);
            const idx = todos.findIndex((t) => t.id === id);
            if (idx === -1) {
                return {
                    content: [{ type: 'text', text: `Task with ID ${id} not found` }],
                    isError: true,
                };
            }
            const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
            todos[idx] = {
                ...todos[idx],
                ...filtered,
                updatedOn: new Date().toISOString(),
            };
            await writeJsonFile(filePath, todos);
            return {
                content: [{ type: 'text', text: `Task "${todos[idx].title}" updated` }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error updating task: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('todo_delete_task', 'Delete a task', {
        id: z.string().describe('Task ID to delete'),
    }, async ({ id }) => {
        try {
            const todos = await readJsonFile(filePath);
            const filtered = todos.filter((t) => t.id !== id);
            if (filtered.length === todos.length) {
                return {
                    content: [{ type: 'text', text: `Task with ID ${id} not found` }],
                    isError: true,
                };
            }
            await writeJsonFile(filePath, filtered);
            return {
                content: [{ type: 'text', text: `Task deleted` }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error deleting task: ${err}` }],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=todos.js.map