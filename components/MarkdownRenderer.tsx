
import React from 'react';
// @ts-ignore
import ReactMarkdown from 'https://esm.sh/react-markdown@9.0.1?deps=react@19.2.3';
// @ts-ignore
import remarkGfm from 'https://esm.sh/remark-gfm@4.0.0';
// @ts-ignore
import rehypeRaw from 'https://esm.sh/rehype-raw@7.0.0?bundle';
import MermaidRenderer from './MermaidRenderer';

const MarkdownRenderer = ({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw]}
    components={{
      h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-slate-900 my-6 border-b-2 border-slate-100 pb-3" {...props} />,
      h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2" {...props} />,
      h3: ({node, ...props}: any) => <h3 className="text-lg font-semibold text-slate-700 mt-6 mb-2" {...props} />,
      p: ({node, ...props}: any) => <p className="text-slate-600 leading-8 mb-4 text-justify" {...props} />,
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

export default MarkdownRenderer;
