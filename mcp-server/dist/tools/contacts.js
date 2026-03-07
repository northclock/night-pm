import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { readJsonFile, writeJsonFile, getProjectFile } from '../utils/file-io.js';
export function registerContactTools(server, projectPath) {
    const filePath = getProjectFile(projectPath, 'contacts.json');
    server.tool('contact_list', 'List all contacts', {}, async () => {
        try {
            const contacts = await readJsonFile(filePath);
            return {
                content: [{ type: 'text', text: JSON.stringify(contacts, null, 2) }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error listing contacts: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('contact_add', 'Add a new contact. Checks for duplicates by name first — if a match is found, returns the existing contact instead of creating a duplicate.', {
        name: z.string().describe('Contact name'),
        title: z.string().optional().default('').describe('Contact title/role'),
        info: z.string().optional().default('').describe('Additional info about the contact'),
        relatedContacts: z
            .array(z.object({
            relatedContactId: z.string(),
            relationship: z.string(),
        }))
            .optional()
            .default([])
            .describe('Related contacts'),
    }, async ({ name, title, info, relatedContacts }) => {
        try {
            const contacts = await readJsonFile(filePath);
            const nameLower = name.toLowerCase().trim();
            const existing = contacts.find((c) => c.name.toLowerCase().trim() === nameLower);
            if (existing) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Contact "${existing.name}" already exists (ID: ${existing.id}, title: "${existing.title}", info: "${existing.info}"). Use contact_update with this ID to modify their information instead of creating a duplicate.`,
                        },
                    ],
                };
            }
            const newContact = {
                id: uuidv4(),
                name,
                title: title ?? '',
                info: info ?? '',
                relatedContacts: relatedContacts ?? [],
            };
            contacts.push(newContact);
            await writeJsonFile(filePath, contacts);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Contact "${name}" added with ID ${newContact.id}`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error adding contact: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('contact_search', 'Search contacts by name (partial, case-insensitive match). Use this BEFORE contact_add to check if a contact already exists.', {
        query: z.string().describe('Name or partial name to search for'),
    }, async ({ query }) => {
        try {
            const contacts = await readJsonFile(filePath);
            const q = query.toLowerCase().trim();
            const matches = contacts.filter((c) => c.name.toLowerCase().includes(q));
            if (matches.length === 0) {
                return {
                    content: [{ type: 'text', text: `No contacts found matching "${query}"` }],
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${matches.length} contact(s):\n${JSON.stringify(matches, null, 2)}`,
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error searching contacts: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('contact_update', 'Update an existing contact', {
        id: z.string().describe('Contact ID to update'),
        name: z.string().optional().describe('New name'),
        title: z.string().optional().describe('New title/role'),
        info: z.string().optional().describe('New info (appended to existing)'),
        relatedContacts: z
            .array(z.object({
            relatedContactId: z.string(),
            relationship: z.string(),
        }))
            .optional()
            .describe('New related contacts list'),
    }, async ({ id, info, ...updates }) => {
        try {
            const contacts = await readJsonFile(filePath);
            const idx = contacts.findIndex((c) => c.id === id);
            if (idx === -1) {
                return {
                    content: [{ type: 'text', text: `Contact with ID ${id} not found` }],
                    isError: true,
                };
            }
            const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
            if (info !== undefined) {
                filtered.info = contacts[idx].info
                    ? `${contacts[idx].info}\n${info}`
                    : info;
            }
            contacts[idx] = { ...contacts[idx], ...filtered };
            await writeJsonFile(filePath, contacts);
            return {
                content: [
                    { type: 'text', text: `Contact "${contacts[idx].name}" updated` },
                ],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error updating contact: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool('contact_delete', 'Delete a contact', {
        id: z.string().describe('Contact ID to delete'),
    }, async ({ id }) => {
        try {
            const contacts = await readJsonFile(filePath);
            const filtered = contacts.filter((c) => c.id !== id);
            if (filtered.length === contacts.length) {
                return {
                    content: [{ type: 'text', text: `Contact with ID ${id} not found` }],
                    isError: true,
                };
            }
            await writeJsonFile(filePath, filtered);
            return {
                content: [{ type: 'text', text: `Contact deleted` }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Error deleting contact: ${err}` }],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=contacts.js.map