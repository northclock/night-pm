import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readJsonFile, writeJsonFile, readTextFile, getProjectFile } from '../utils/file-io.js';

interface Thought {
  thought: string;
  actionsTriggered: string[];
  createdOn: string;
}

export function registerThoughtTools(server: McpServer, projectPath: string) {
  const filePath = getProjectFile(projectPath, 'thoughts.json');

  server.tool('thought_list', 'List all recorded thoughts', {}, async () => {
    try {
      const thoughts = await readJsonFile<Thought>(filePath);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(thoughts, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error listing thoughts: ${err}` }],
        isError: true,
      };
    }
  });

  server.tool(
    'thought_add',
    'Add a new thought entry',
    {
      thought: z.string().describe('The thought text'),
      actionsTriggered: z
        .array(z.string())
        .optional()
        .default([])
        .describe('Actions triggered by this thought'),
    },
    async ({ thought, actionsTriggered }) => {
      try {
        const thoughts = await readJsonFile<Thought>(filePath);
        thoughts.push({
          thought,
          actionsTriggered: actionsTriggered ?? [],
          createdOn: new Date().toISOString(),
        });
        await writeJsonFile(filePath, thoughts);
        return {
          content: [{ type: 'text' as const, text: `Thought recorded` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error recording thought: ${err}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'project_info',
    'Read the project info/context from info.md',
    {},
    async () => {
      try {
        const infoPath = getProjectFile(projectPath, 'info.md');
        const content = await readTextFile(infoPath);
        return {
          content: [
            {
              type: 'text' as const,
              text: content || 'No project info available.',
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error reading project info: ${err}` }],
          isError: true,
        };
      }
    },
  );
}
