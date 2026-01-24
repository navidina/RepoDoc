
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import MermaidRenderer from './MermaidRenderer';
import { CodeSymbol } from '../types';
import { ArrowRight, Code, MapPin, List } from 'lucide-react';

interface WikiLinkProps {
  symbolName: string;
  children: React.ReactNode;
  knowledgeGraph: Record<string, CodeSymbol>;
}

// Interactive WikiLink Component with "Go to Definition"
const WikiLink: React.FC<WikiLinkProps> = ({ symbolName, children, knowledgeGraph }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Find symbol in graph. Since we pass the NAME, we need to find the ID.
  const symbolEntry = (Object.values(knowledgeGraph) as CodeSymbol[]).find(s => s.name === symbolName);

  if (!symbolEntry) return <span className="text-slate-700 font-medium">{children}</span>;

  const handleJump = (e: React.MouseEvent) => {
    e.preventDefault();
    const safeId = `file-${symbolEntry.filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const element = document.getElementById(safeId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const details = element.querySelector('details');
      if (details) details.open = true;
      element.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2');
      setTimeout(() => element.classList.remove('ring-2', 'ring-brand-500', 'ring-offset-2'), 2000);
    } else {
      console.warn('Target element not found:', safeId);
    }
  };

  return (
    <span 
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button 
        onClick={handleJump}
        className="text-brand-600 font-bold cursor-pointer border-b border-dashed border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors inline-flex items-center gap-0.5"
      >
        {children}
      </button>

      {/* Code Preview Hover Card */}
      {isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-96 bg-[#1E293B] rounded-xl shadow-2xl border border-slate-700 text-left dir-ltr p-4 animate-in zoom-in-95 duration-200 pointer-events-none">
           <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
              <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                <Code className="w-3 h-3" />
                {symbolEntry.kind} {symbolEntry.name}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {symbolEntry.filePath}:{symbolEntry.line}
              </span>
           </div>
           {symbolEntry.complexityScore > 10 && (
             <div className="mb-2 text-[10px] text-orange-400 font-bold">⚠️ High Complexity: {symbolEntry.complexityScore}</div>
           )}
           <pre className="text-xs font-mono text-slate-300 overflow-x-auto custom-scrollbar max-h-48 p-2 bg-slate-900 rounded-lg">
             {symbolEntry.codeSnippet || 'Loading snippet...'}
           </pre>
           <div className="mt-2 text-[10px] text-slate-500 flex justify-between items-center">
              <span>Calls: {symbolEntry.relationships?.calls?.length || 0} | Refs: {symbolEntry.relationships?.calledBy?.length || 0}</span>
              <span className="text-brand-400 flex items-center gap-1">Click to navigate <ArrowRight className="w-3 h-3" /></span>
           </div>
           <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1E293B] rotate-45 border-r border-b border-slate-700 -mt-1.5"></div>
        </div>
      )}
    </span>
  );
};

interface MarkdownRendererProps {
  content: string;
  knowledgeGraph?: Record<string, CodeSymbol>;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, knowledgeGraph = {} }) => {
  const [headers, setHeaders] = useState<{ id: string; text: string; level: number }[]>([]);

  // Parse headers for TOC
  useEffect(() => {
    const lines = content.split('\n');
    const extractedHeaders: { id: string; text: string; level: number }[] = [];
    
    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');
        extractedHeaders.push({ id, text, level });
      }
    });
    setHeaders(extractedHeaders);
  }, [content]);

  // Generate ID for headers inside Markdown
  const HeaderComponent = ({ level, children }: any) => {
    const text = String(children);
    const id = text.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');
    const Tag = `h${level}` as any;
    
    // Style adjustments per level
    const classes = level === 1 
      ? "text-2xl font-bold text-slate-900 my-6 border-b-2 border-slate-100 pb-3"
      : level === 2 
        ? "text-xl font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2"
        : "text-lg font-semibold text-slate-700 mt-6 mb-2";

    return <Tag id={id} className={classes}>{children}</Tag>;
  };

  const TextRenderer = ({ children }: any) => {
    const text = String(children);
    if (!knowledgeGraph || Object.keys(knowledgeGraph).length === 0) return <>{children}</>;
    const parts = text.split(/(\s+|[,.;()])/); 
    return (
      <>
        {parts.map((part, i) => {
           const cleanPart = part.trim();
           const isSymbol = (Object.values(knowledgeGraph) as CodeSymbol[]).some(s => s.name === cleanPart && (s.kind === 'class' || s.kind === 'function' || s.kind === 'interface'));
           if (isSymbol && cleanPart.length > 2) { 
              return <WikiLink key={i} symbolName={cleanPart} knowledgeGraph={knowledgeGraph}>{part}</WikiLink>;
           }
           return part;
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 relative items-start">
      {/* Table of Contents Sidebar */}
      <aside className="hidden xl:block w-64 shrink-0 sticky top-24 max-h-[80vh] overflow-y-auto custom-scrollbar pl-4">
         <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
               <List className="w-4 h-4" /> فهرست مطالب
            </h4>
            <ul className="space-y-2 text-xs">
               {headers.map((h, i) => (
                  <li key={i} style={{ marginRight: (h.level - 1) * 12 + 'px' }}>
                     <a href={`#${h.id}`} className="text-slate-500 hover:text-brand-600 block truncate transition-colors border-r-2 border-transparent hover:border-brand-300 pr-2">
                       {h.text}
                     </a>
                  </li>
               ))}
            </ul>
         </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({children}) => <HeaderComponent level={1}>{children}</HeaderComponent>,
            h2: ({children}) => <HeaderComponent level={2}>{children}</HeaderComponent>,
            h3: ({children}) => <HeaderComponent level={3}>{children}</HeaderComponent>,
            p: ({children, ...props}: any) => (
              <p className="text-slate-600 leading-8 mb-4 text-justify" {...props}>
                {React.Children.map(children, child => {
                    if (typeof child === 'string') return <TextRenderer>{child}</TextRenderer>;
                    return child;
                })}
              </p>
            ),
            li: ({children, ...props}: any) => (
              <li {...props}>
                  {React.Children.map(children, child => {
                    if (typeof child === 'string') return <TextRenderer>{child}</TextRenderer>;
                    return child;
                })}
              </li>
            ),
            ul: ({node, ...props}: any) => <ul className="list-disc list-outside mr-6 space-y-2 mb-4 text-slate-600" {...props} />,
            ol: ({node, ...props}: any) => <ol className="list-decimal list-outside mr-6 space-y-2 mb-4 text-slate-600" {...props} />,
            table: ({node, ...props}: any) => <div className="overflow-x-auto my-6 border border-slate-200 rounded-xl shadow-sm"><table className="w-full text-right" {...props} /></div>,
            thead: ({node, ...props}: any) => <thead className="bg-slate-50 text-slate-700" {...props} />,
            th: ({node, ...props}: any) => <th className="px-6 py-3 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500" {...props} />,
            td: ({node, ...props}: any) => <td className="px-6 py-4 border-b border-slate-100 text-sm" {...props} />,
            code: ({node, inline, className, children, ...props}: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const isMermaid = match && match[1] === 'mermaid';
              
              if (!inline && isMermaid) {
                return <MermaidRenderer code={String(children).replace(/\n$/, '')} />;
              }

              return inline ? (
                <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200 shadow-sm" {...props}>{children}</code>
              ) : (
                <div className="my-4 dir-ltr"><code className="block bg-[#1E293B] p-4 rounded-xl overflow-x-auto text-sm font-mono text-slate-300 border border-slate-800 shadow-lg" {...props}>{children}</code></div>
              )
            },
            details: ({node, ...props}: any) => <details className="group bg-white border border-slate-200 rounded-xl mb-3 overflow-hidden transition-all shadow-sm hover:shadow-md" {...props} />,
            summary: ({node, ...props}: any) => <summary className="cursor-pointer p-4 hover:bg-slate-50 select-none text-slate-700 outline-none" {...props} />
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownRenderer;
