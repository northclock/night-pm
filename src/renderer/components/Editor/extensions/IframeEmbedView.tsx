import { useCallback, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';

export function IframeEmbedView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const { src, title, width, height, frameborder } = node.attrs;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const startY = e.clientY;
      const startHeight = parseInt(String(height), 10) || 400;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startY;
        const newHeight = Math.max(100, startHeight + delta);
        if (wrapperRef.current) {
          const iframe = wrapperRef.current.querySelector('iframe');
          if (iframe) iframe.style.height = `${newHeight}px`;
        }
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        setResizing(false);

        const delta = upEvent.clientY - startY;
        const newHeight = Math.max(100, startHeight + delta);
        updateAttributes({ height: String(newHeight) });
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [height, updateAttributes],
  );

  return (
    <NodeViewWrapper data-type="iframe-embed">
      <div
        ref={wrapperRef}
        className={`iframe-embed-wrapper${selected ? ' iframe-embed-selected' : ''}${resizing ? ' iframe-embed-resizing' : ''}`}
      >
        <iframe
          src={src}
          title={title || undefined}
          width={width || '100%'}
          height={height || '400'}
          frameBorder={frameborder || '0'}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
          allowFullScreen
          style={{ height: `${parseInt(String(height), 10) || 400}px` }}
        />
        <div
          className="iframe-embed-resize-handle"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        >
          <span className="iframe-embed-resize-grip" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
