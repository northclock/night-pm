# MCP Tools Reference

Night PM exposes all of its data management capabilities as Model Context Protocol (MCP) tools. This means any AI CLI that supports MCP can manage your project data.

## Overview

There are 16 tools organized into five categories: Calendar, Todos, Contacts, Thoughts, and Project.

All tools operate on plain JSON files in the active project directory. Tool inputs are validated with Zod schemas. Tool outputs are text-formatted JSON or confirmation messages.

## Calendar Tools

### `calendar_list_events`
List all calendar events.

**Input**: None

**Output**: JSON array of all events from `calendar.json`.

### `calendar_add_event`
Add a new calendar event.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Event title |
| `description` | string | no | Event description (default: `""`) |
| `start` | string | yes | Start date/time as ISO 8601 string |
| `end` | string | yes | End date/time as ISO 8601 string |
| `allDay` | boolean | no | Whether this is an all-day event (default: `false`) |

**Output**: Confirmation with event ID.

### `calendar_update_event`
Update an existing calendar event by ID.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Event ID |
| `title` | string | no | New title |
| `description` | string | no | New description |
| `start` | string | no | New start date/time |
| `end` | string | no | New end date/time |
| `allDay` | boolean | no | New all-day flag |

### `calendar_delete_event`
Delete a calendar event by ID.

**Input**: `{ id: string }`

## Todo Tools

### `todo_list_tasks`
List all tasks, optionally filtered by status.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `"created" \| "blocked" \| "done"` | no | Filter by status |

### `todo_add_task`
Add a new task.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Task title |
| `description` | string | no | Description (default: `""`) |
| `dueDate` | string | no | Due date as ISO 8601 (default: `""`) |
| `status` | `"created" \| "blocked" \| "done"` | no | Initial status (default: `"created"`) |

### `todo_update_task`
Update an existing task by ID.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Task ID |
| `title` | string | no | New title |
| `description` | string | no | New description |
| `dueDate` | string | no | New due date |
| `status` | `"created" \| "blocked" \| "done"` | no | New status |

The `updatedOn` timestamp is set automatically.

### `todo_delete_task`
Delete a task by ID.

**Input**: `{ id: string }`

## Contact Tools

### `contact_list`
List all contacts.

**Input**: None

### `contact_search`
Search contacts by name (partial, case-insensitive). Use this before `contact_add` to check for duplicates.

**Input**: `{ query: string }`

### `contact_add`
Add a new contact. Automatically checks for duplicates by name.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Contact name |
| `title` | string | no | Title/role (default: `""`) |
| `info` | string | no | Additional info (default: `""`) |
| `relatedContacts` | array | no | Related contacts with IDs and relationships |

If a contact with the same name already exists, the tool returns the existing contact's ID and suggests using `contact_update` instead.

### `contact_update`
Update an existing contact by ID. The `info` field is appended (not replaced) when provided.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Contact ID |
| `name` | string | no | New name |
| `title` | string | no | New title |
| `info` | string | no | Info to append |
| `relatedContacts` | array | no | Updated related contacts |

### `contact_delete`
Delete a contact by ID.

**Input**: `{ id: string }`

## Thought Tools

### `thought_list`
List all recorded thoughts.

**Input**: None

### `thought_add`
Record a new thought entry.

**Input**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `thought` | string | yes | The thought text |
| `actionsTriggered` | string[] | no | Actions triggered by this thought |

### `project_info`
Read the project's `info.md` file for context.

**Input**: None

**Output**: The contents of `info.md`, or "No project info available." if the file doesn't exist.

## Using with External Apps

Night PM automatically starts an MCP server on `http://127.0.0.1:7777/sse` when the app launches. Any MCP-compatible tool can connect via SSE. Check **Settings > MCP Server** for the actual URL and ready-to-copy configs.

### Claude Code (in-app)

Night PM's MCP tools are automatically available when using Claude as the provider (via in-process SDK server). No configuration needed.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "night-pm": {
      "url": "http://127.0.0.1:7777/sse"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "night-pm": {
      "url": "http://127.0.0.1:7777/sse"
    }
  }
}
```

### Windsurf

```json
{
  "mcpServers": {
    "night-pm": {
      "serverUrl": "http://127.0.0.1:7777/sse"
    }
  }
}
```

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "night-pm": {
      "url": "http://127.0.0.1:7777/sse"
    }
  }
}
```

### Generic SSE

Any MCP client that supports SSE can connect to:

```
http://127.0.0.1:7777/sse
```

If port 7777 is in use, Night PM picks the next available port. Check **Settings > MCP Server** for the actual URL.
