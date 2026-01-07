
import React, { useState } from 'react';
// @ts-ignore
import ReactMarkdown from 'https://esm.sh/react-markdown@9.0.1?deps=react@19.2.3';
// @ts-ignore
import remarkGfm from 'https://esm.sh/remark-gfm@4.0.0';
// @ts-ignore
import rehypeRaw from 'https://esm.sh/rehype-raw@7.0.0?bundle';
import MermaidRenderer from './MermaidRenderer';
import { useRepoProcessor } from '../hooks/useRepoProcessor'; // Access Knowledge Graph
import { CodeSymbol } from '../types';

interface WikiLinkProps {
  symbolName: string;
  children: React.ReactNode;
  knowledgeGraph: Record<string, CodeSymbol>;
}

// Interactive WikiLink Component
const WikiLink: React.FC<WikiLinkProps> = ({ symbolName, children, knowledgeGraph }) => {
  const [isHovered, setIsHovered] = useState(false);
  const symbol = knowledgeGraph[symbolName];

  if (!symbol) return <span className="text-slate-700 font-medium">{children}</span>;

  return (
    <span 
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-brand-600 font-bold cursor-pointer border-b border-dashed border-brand-300 hover:bg-brand-50 transition-colors">
        {children}
      </span>

      {/* Code Preview Hover Card */}
      {isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-96 bg-[#1E293B] rounded-xl shadow-2xl border border-slate-700 text-left dir-ltr p-4 animate-in zoom-in-95 duration-200">
           <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
              <span className="text-xs font-mono text-emerald-400 font-bold">{symbol.kind} {symbol.name}</span>
              <span className="text-[10px] text-slate-400">{symbol.filePath}:{symbol.line}</span>
           </div>
           <pre className="text-xs font-mono text-slate-300 overflow-x-auto custom-scrollbar max-h-48">
             {symbol.codeSnippet}
           </pre>
           <div className="mt-2 text-[10px] text-slate-500 flex gap-2">
              <span>References: {symbol.references.length}</span>
           </div>
           {/* Arrow */}
           <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1E293B] rotate-45 border-r border-b border-slate-700 -mt-1.5"></div>
        </div>
      )}
    </span>
  );
};

const MarkdownRenderer = ({ content }: { content: string }) => {
  const { knowledgeGraph } = useRepoProcessor();

  // Pre-process text to auto-link known symbols (Simple regex approach for performance)
  // In a full implementation, we would use a rehype plugin.
  const processedContent = React.useMemo(() => {
    if (!knowledgeGraph || Object.keys(knowledgeGraph).length === 0) return content;
    
    // Naive replacement for demo purposes. Real parser would be safer.
    // We only replace exact words that match a symbol name and are capitalized (usually classes)
    let newContent = content;
    Object.keys(knowledgeGraph).forEach(key => {
        if (key.length > 3) { // Avoid linking short words
           const regex = new RegExp(`\\b(${key})\\b`, 'g');
           // We use a special marker that we can pick up in the custom component renderer
           // However, since we can't easily inject custom components into raw string for ReactMarkdown without plugins,
           // We will rely on ReactMarkdown's 'code' block detection or specific text handling.
           
           // Better strategy for this constraint: 
           // We will pass the knowledgeGraph to a custom text renderer if possible, 
           // OR we accept that only explicit links work in this version.
        }
    });
    return content;
  }, [content, knowledgeGraph]);

  // Helper to detect if a text node matches a symbol
  const TextRenderer = ({ children }: any) => {
    const text = String(children);
    // If text is exactly a known symbol
    if (knowledgeGraph && knowledgeGraph[text]) {
      return <WikiLink symbolName={text} knowledgeGraph={knowledgeGraph}>{text}</WikiLink>;
    }
    // If text contains a symbol (simple split)
    if (knowledgeGraph) {
       const parts = text.split(/(\s+)/);
       return (
         <>
           {parts.map((part, i) => {
             if (knowledgeGraph[part]) {
                return <WikiLink key={i} symbolName={part} knowledgeGraph={knowledgeGraph}>{part}</WikiLink>;
             }
             return part;
           })}
         </>
       );
    }
    return <>{children}</>;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-slate-900 my-6 border-b-2 border-slate-100 pb-3" {...props} />,
        h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2" {...props} />,
        h3: ({node, ...props}: any) => <h3 className="text-lg font-semibold text-slate-700 mt-6 mb-2" {...props} />,
        // Use custom text renderer for auto-linking
        p: ({node, children, ...props}: any) => (
           <p className="text-slate-600 leading-8 mb-4 text-justify" {...props}>
             {React.Children.map(children, child => {
                if (typeof child === 'string') return <TextRenderer>{child}</TextRenderer>;
                return child;
             })}
           </p>
        ),
        li: ({node, children, ...props}: any) => (
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
  );
};

export default MarkdownRenderer;
