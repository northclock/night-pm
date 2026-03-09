import { useAppStore } from '../../store';
import { MarkdownEditor } from '../Editor/MarkdownEditor';
import { PlainTextViewer } from '../Editor/PlainTextViewer';
import { CalendarView } from '../Calendar/CalendarView';
import { TodosView } from '../Todos/TodosView';
import { ContactsView } from '../Contacts/ContactsView';
import { ThoughtsListView } from '../Thoughts/ThoughtsListView';
import { ProjectInfoView } from '../ProjectInfo/ProjectInfoView';
import { IdeasView } from '../Ideas/IdeasView';
import { SecretsView } from '../Secrets/SecretsView';
import { StandupView } from '../Standups/StandupView';

function getViewType(filePath: string): string {
  const name = filePath.split('/').pop() || '';
  if (name === 'calendar.json') return 'calendar';
  if (name === 'todos.json') return 'todos';
  if (name === 'contacts.json') return 'contacts';
  if (name === 'thoughts.json') return 'thoughts';
  if (name === 'ideas.json') return 'ideas';
  if (name === 'secrets.json') return 'secrets';
  if (name === 'standup.json') return 'standup';
  if (name === 'project.nipm') return 'project-info';
  if (name.endsWith('.md')) return 'markdown';
  return 'plain';
}

export function ContentArea() {
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const openFiles = useAppStore((s) => s.openFiles);

  if (!activeFilePath) return null;

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  if (!activeFile) return null;

  const viewType = getViewType(activeFilePath);

  switch (viewType) {
    case 'calendar':
      return <CalendarView file={activeFile} />;
    case 'todos':
      return <TodosView file={activeFile} />;
    case 'contacts':
      return <ContactsView file={activeFile} />;
    case 'thoughts':
      return <ThoughtsListView file={activeFile} />;
    case 'project-info':
      return <ProjectInfoView file={activeFile} />;
    case 'ideas':
      return <IdeasView file={activeFile} />;
    case 'secrets':
      return <SecretsView file={activeFile} />;
    case 'standup':
      return <StandupView file={activeFile} />;
    case 'markdown':
      return <MarkdownEditor file={activeFile} />;
    default:
      return <PlainTextViewer file={activeFile} />;
  }
}
