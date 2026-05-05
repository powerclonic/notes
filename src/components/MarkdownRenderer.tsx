import { useMemo } from 'react';
import { marked } from 'marked';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    try {
      return marked.parse(content, { async: false }) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={cn('markdown-content', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
