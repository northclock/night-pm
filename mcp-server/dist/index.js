#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCalendarTools } from './tools/calendar.js';
import { registerTodoTools } from './tools/todos.js';
import { registerContactTools } from './tools/contacts.js';
import { registerThoughtTools } from './tools/thoughts.js';
import * as path from 'node:path';
function getProjectPath() {
    const args = process.argv.slice(2);
    const pathIdx = args.indexOf('--project-path');
    if (pathIdx !== -1 && pathIdx + 1 < args.length) {
        const p = args[pathIdx + 1];
        return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    }
    // No --project-path provided: use the current working directory.
    // This works because the app spawns Gemini CLI with cwd set to
    // the active project folder.
    return process.cwd();
}
async function main() {
    const projectPath = getProjectPath();
    const server = new McpServer({
        name: 'night-pm',
        version: '1.0.0',
    });
    registerCalendarTools(server, projectPath);
    registerTodoTools(server, projectPath);
    registerContactTools(server, projectPath);
    registerThoughtTools(server, projectPath);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map