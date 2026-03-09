import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('markdown-body break-words text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}>
      <ReactMarkdown
        components={{
          p: ({ children: c }) => <p className="mb-2 leading-relaxed">{c}</p>,
          h1: ({ children: c }) => <h1 className="text-lg font-bold mb-2 mt-3">{c}</h1>,
          h2: ({ children: c }) => <h2 className="text-base font-bold mb-2 mt-3">{c}</h2>,
          h3: ({ children: c }) => <h3 className="text-sm font-semibold mb-1.5 mt-2">{c}</h3>,
          ul: ({ children: c }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{c}</ul>,
          ol: ({ children: c }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{c}</ol>,
          li: ({ children: c }) => <li className="leading-relaxed">{c}</li>,
          blockquote: ({ children: c }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">{c}</blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
          strong: ({ children: c }) => <strong className="font-semibold">{c}</strong>,
          pre: ({ children: c }) => (
            <pre className="bg-muted/60 border border-border rounded-md px-3 py-2 overflow-x-auto text-xs my-2">{c}</pre>
          ),
          code: ({ children: c, node, ...rest }) => {
            const isInline = !node?.properties?.className;
            if (isInline) {
              return <code className="bg-muted/60 px-1 py-0.5 rounded text-xs font-mono">{c}</code>;
            }
            return <code>{c}</code>;
          },
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">{c}</a>
          ),
          table: ({ children: c }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border border-border rounded">{c}</table>
            </div>
          ),
          th: ({ children: c }) => <th className="border border-border px-2 py-1 bg-muted/40 font-semibold text-left">{c}</th>,
          td: ({ children: c }) => <td className="border border-border px-2 py-1">{c}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
