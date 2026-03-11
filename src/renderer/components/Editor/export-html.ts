/**
 * Wraps raw TipTap HTML content in a standalone document with embedded styles
 * suitable for both HTML export and PDF rendering.
 */
export function buildExportHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --fg: #1a1a2e;
    --bg: #ffffff;
    --muted: #6b7280;
    --border: #e5e7eb;
    --primary: #4f46e5;
    --secondary: #f3f4f6;
    --code-bg: #f3f4f6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #e5e7eb;
      --bg: #1a1a2e;
      --muted: #9ca3af;
      --border: #374151;
      --primary: #818cf8;
      --secondary: #1f2937;
      --code-bg: #1f2937;
    }
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--fg);
    background: var(--bg);
    line-height: 1.75;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  h1, h2, h3, h4, h5, h6 { font-weight: 700; line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  p { margin: 0.75em 0; }
  strong { font-weight: 700; }
  a { color: var(--primary); text-decoration: underline; }
  code:not(pre code) {
    background: var(--code-bg);
    color: var(--primary);
    padding: 0.15em 0.35em;
    border-radius: 4px;
    font-size: 0.875em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1em 1.25em;
    margin: 1em 0;
    overflow-x: auto;
    font-size: 0.875em;
  }
  pre code { background: transparent; color: var(--fg); padding: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  blockquote {
    border-left: 3px solid var(--primary);
    padding-left: 1em;
    margin: 1em 0;
    color: var(--muted);
    font-style: italic;
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
  ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
  ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
  li { margin: 0.25em 0; }
  li > p { margin: 0; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
  ul[data-type="taskList"] li[data-checked="true"] > div > p { text-decoration: line-through; color: var(--muted); }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; border: 1px solid var(--border); }
  td, th { border: 1px solid var(--border); padding: 0.5em 0.75em; vertical-align: top; }
  th { background: var(--secondary); font-weight: 600; text-align: left; }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; }
  details { border: 1px solid var(--border); border-radius: 8px; margin: 1em 0; overflow: hidden; }
  details summary { padding: 0.75em 1em; cursor: pointer; font-weight: 600; background: var(--secondary); }
  details > div:last-child { padding: 0.75em 1em; }
  mark { padding: 0.1em 0.2em; border-radius: 2px; }
  iframe { width: 100%; border: none; border-radius: 8px; }
  .iframe-embed-wrapper { margin: 1em 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
  .iframe-embed-wrapper iframe { display: block; width: 100%; height: 400px; border: none; }
  div[data-youtube-video] { margin: 1em 0; }
  div[data-youtube-video] iframe { width: 100%; aspect-ratio: 16/9; border-radius: 8px; border: none; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Replaces all <iframe> elements in the HTML with screenshot images.
 * Used before PDF export since iframes render as blank boxes in printToPDF.
 */
export async function replaceIframesWithScreenshots(html: string): Promise<string> {
  const iframeRegex = /<iframe\s[^>]*src="([^"]+)"[^>]*><\/iframe>/gi;
  const matches = [...html.matchAll(iframeRegex)];
  if (matches.length === 0) return html;

  const captures = await Promise.all(
    matches.map(async (m) => {
      const url = m[1];
      const widthMatch = m[0].match(/width="(\d+)"/);
      const heightMatch = m[0].match(/height="(\d+)"/);
      const w = widthMatch ? parseInt(widthMatch[1], 10) : 800;
      const h = heightMatch ? parseInt(heightMatch[1], 10) : 400;
      const dataUri = await window.nightAPI.export.captureUrl(url, w, h);
      return { fullMatch: m[0], url, dataUri };
    }),
  );

  let result = html;
  for (const { fullMatch, url, dataUri } of captures) {
    if (dataUri) {
      const img = `<img src="${dataUri}" alt="Snapshot of ${escapeHtml(url)}" style="max-width:100%;height:auto;border-radius:8px;margin:1em 0;" />`;
      result = result.replace(fullMatch, img);
    }
  }
  return result;
}
