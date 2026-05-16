import React from 'react';

interface MarkdownMessageProps {
  content: string;
  role: 'user' | 'assistant';
}

/**
 * Lightweight markdown renderer for the Co-Pilot chat
 * Handles: **bold**, *italic*, `code`, ```blocks```, - lists, headers, links
 */
export function MarkdownMessage({ content, role }: MarkdownMessageProps) {
  const isAssistant = role === 'assistant';

  // Parse markdown and convert to React elements with block-level grouping
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentBlock: { type: 'list' | 'ordered' | 'code' | 'none', items: string[], language?: string } = { type: 'none', items: [] };

    const flushBlock = (key: string | number) => {
      if (currentBlock.type === 'list') {
        elements.push(
          <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1.5 my-2">
            {currentBlock.items.map((item, i) => (
              <li key={i} className="text-slate-200 leading-relaxed">
                {parseInline(item)}
              </li>
            ))}
          </ul>
        );
      } else if (currentBlock.type === 'ordered') {
        elements.push(
          <ol key={`ol-${key}`} className="list-decimal pl-5 space-y-1.5 my-2">
            {currentBlock.items.map((item, i) => (
              <li key={i} className="text-slate-200 leading-relaxed">
                {parseInline(item)}
              </li>
            ))}
          </ol>
        );
      } else if (currentBlock.type === 'code') {
        elements.push(
          <pre key={`code-${key}`} className="bg-slate-950 rounded-lg p-3 my-3 overflow-x-auto border border-slate-700 shadow-inner">
            {currentBlock.language && (
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-semibold border-b border-slate-800 pb-1">
                {currentBlock.language}
              </div>
            )}
            <code className="text-[13px] font-mono text-emerald-400 leading-normal">
              {currentBlock.items.join('\n')}
            </code>
          </pre>
        );
      }
      currentBlock = { type: 'none', items: [] };
    };

    lines.forEach((line, idx) => {
      // Code block toggle
      if (line.startsWith('```')) {
        if (currentBlock.type !== 'code') {
          flushBlock(idx);
          currentBlock.type = 'code';
          currentBlock.language = line.slice(3).trim();
        } else {
          flushBlock(idx);
        }
        return;
      }

      if (currentBlock.type === 'code') {
        currentBlock.items.push(line);
        return;
      }

      // List detection
      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);

      if (bulletMatch) {
        if (currentBlock.type !== 'list') flushBlock(idx);
        currentBlock.type = 'list';
        currentBlock.items.push(bulletMatch[1]);
        return;
      }

      if (orderedMatch) {
        if (currentBlock.type !== 'ordered') flushBlock(idx);
        currentBlock.type = 'ordered';
        currentBlock.items.push(orderedMatch[2]);
        return;
      }

      // Paragraph or empty line
      flushBlock(idx);
      if (!line.trim()) {
        elements.push(<div key={`gap-${idx}`} className="h-3" />);
        return;
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={idx} className="text-sm font-bold text-slate-100 mt-5 mb-2 border-b border-slate-800 pb-1">{parseInline(line.slice(4))}</h3>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={idx} className="text-base font-bold text-slate-100 mt-5 mb-2 border-b border-slate-800 pb-1">{parseInline(line.slice(3))}</h2>);
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={idx} className="text-lg font-bold text-slate-100 mt-5 mb-2 border-b border-slate-800 pb-1">{parseInline(line.slice(2))}</h1>);
      } else {
        elements.push(
          <p key={idx} className="mb-2 leading-relaxed text-slate-200">
            {parseInline(line)}
          </p>
        );
      }
    });

    flushBlock('final');
    return elements;
  };


  // Parse inline markdown (bold, italic, code, links)
  const parseInline = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Pattern matching for inline elements
    const patterns = [
      // Bold: **text** or __text__
      { regex: /\*\*(.+?)\*\*/g, render: (match: string) => <strong key={key++} className="font-semibold text-slate-100">{match}</strong> },
      { regex: /__(.+?)__/g, render: (match: string) => <strong key={key++} className="font-semibold text-slate-100">{match}</strong> },
      // Italic: *text* or _text_
      { regex: /\*([^*]+?)\*/g, render: (match: string) => <em key={key++} className="italic text-slate-300">{match}</em> },
      { regex: /_([^_]+?)_/g, render: (match: string) => <em key={key++} className="italic text-slate-300">{match}</em> },
      // Inline code: `code`
      { regex: /`([^`]+?)`/g, render: (match: string) => <code key={key++} className="bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-cyan-400">{match}</code> },
      // Links: [text](url)
      {
        regex: /\[([^\]]+)\]\(([^)]+)\)/g, render: (text: string, url: string) => (
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
            {text}
          </a>
        )
      },
    ];

    // Simple approach: process sequentially
    // First handle bold
    remaining = remaining.replace(/\*\*(.+?)\*\*/g, '⟨BOLD:$1⟩');
    // Then inline code (before italic to avoid conflicts)
    remaining = remaining.replace(/`([^`]+?)`/g, '⟨CODE:$1⟩');
    // Then italic (single asterisks that remain)
    remaining = remaining.replace(/\*([^*\s][^*]*?)\*/g, '⟨ITALIC:$1⟩');
    // Then links
    remaining = remaining.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '⟨LINK:$1|$2⟩');

    // Split and render
    const parts = remaining.split(/(⟨[A-Z]+:[^⟩]+⟩)/g);

    return parts.map((part, i) => {
      if (part.startsWith('⟨BOLD:')) {
        const content = part.slice(6, -1);
        return <strong key={i} className="font-semibold text-slate-100">{content}</strong>;
      }
      if (part.startsWith('⟨CODE:')) {
        const content = part.slice(6, -1);
        return <code key={i} className="bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-cyan-400">{content}</code>;
      }
      if (part.startsWith('⟨ITALIC:')) {
        const content = part.slice(8, -1);
        return <em key={i} className="italic text-slate-300">{content}</em>;
      }
      if (part.startsWith('⟨LINK:')) {
        const content = part.slice(6, -1);
        const [text, url] = content.split('|');
        return (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
            {text}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className={`text-sm leading-relaxed break-words overflow-wrap-anywhere ${isAssistant ? 'text-slate-200' : 'text-white'}`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {parseMarkdown(content)}
    </div>
  );
}
