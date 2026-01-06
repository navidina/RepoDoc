
import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
// @ts-ignore
import mermaid from 'https://esm.sh/mermaid@10.9.0';

const MermaidRenderer = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fixMermaidSyntax = (rawCode: string) => {
    // 1. Strip Markdown wrappers
    let fixed = rawCode
      .replace(/```mermaid/gi, '')
      .replace(/```/g, '')
      .trim();
    
    // 2. Remove any "mermaid" keyword if it appears again at the start
    if (fixed.toLowerCase().startsWith('mermaid')) {
        fixed = fixed.substring(7).trim();
    }

    // 3. Remove common Markdown headers that might have snuck in (e.g., # Class Diagram)
    fixed = fixed.replace(/^#+.*$/gm, '');

    // 4. Fix Unquoted Labels with Parentheses: Node[Label(text)] -> Node["Label(text)"]
    // This regex looks for [text] where text contains () and is NOT already quoted.
    fixed = fixed.replace(/\[(?![ "])(.*?\(.*?\).*?)(?<![" ])\]/g, '["$1"]');

    // 5. Fix Unquoted Labels with Spaces: Node[Label Text] -> Node["Label Text"]
    // This is aggressive but helps with "Infrastructure" diagrams
    // It looks for content inside [] that has spaces but no quotes.
    fixed = fixed.replace(/\[(?![ "])(.*\s+.*)(?<![" ])\]/g, '["$1"]');

    // 6. Normalize keywords
    fixed = fixed.replace(/Style /g, 'style ');
    if (fixed.startsWith('graph ')) {
       fixed = fixed.replace('graph ', 'flowchart ');
    }

    // 7. Remove any leading conversational text that extraction missed (Last Resort)
    // If code doesn't start with a known keyword, try to find it.
    const keywords = ['sequenceDiagram', 'classDiagram', 'erDiagram', 'flowchart', 'gantt', 'stateDiagram'];
    const startIdx = keywords.findIndex(k => fixed.includes(k));
    if (startIdx !== -1 && !keywords.some(k => fixed.startsWith(k))) {
       const keyword = keywords[startIdx];
       fixed = fixed.substring(fixed.indexOf(keyword));
    }

    return fixed.trim();
  };

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      if (!code) return;
      try {
        if (isMounted) {
            setIsError(false);
            setErrorMsg('');
        }

        const cleanCode = fixMermaidSyntax(code);

        // Validation Check
        const validStarts = ['sequenceDiagram', 'classDiagram', 'erDiagram', 'flowchart', 'gantt', 'stateDiagram', 'pie', 'gitGraph'];
        if (!validStarts.some(start => cleanCode.startsWith(start))) {
           // Fallback: If no start found, assume flowchart if it looks like arrows
           if (cleanCode.includes('-->') || cleanCode.includes('---')) {
               // It's likely a flowchart missing the header
               mermaid.initialize({ startOnLoad: false });
               const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
               const { svg } = await mermaid.render(id, `flowchart TD\n${cleanCode}`);
               if (isMounted) setSvg(svg);
               return;
           }
           throw new Error('Invalid Mermaid code detected (No valid diagram type found).');
        }

        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'base', 
          themeVariables: { 
            fontFamily: 'Vazirmatn', 
            primaryColor: '#e2e8f0', 
            primaryTextColor: '#1e293b', 
            lineColor: '#64748b',
            fontSize: '14px'
          }, 
          securityLevel: 'loose',
          flowchart: { htmlLabels: true, useMaxWidth: true }
        });

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg } = await mermaid.render(id, cleanCode);
        
        if (isMounted) setSvg(svg);
      } catch (error: any) {
        console.error('Mermaid rendering failed:', error);
        if (isMounted) {
            setIsError(true);
            setErrorMsg(error.message || 'Syntax Error in Diagram Code');
        }
      }
    };

    renderDiagram();

    return () => { isMounted = false; };
  }, [code]);

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-left dir-ltr my-4 shadow-sm">
        <p className="text-red-600 text-xs font-mono mb-2 font-bold flex items-center gap-2">
          <AlertCircle className="w-3 h-3" /> Mermaid Syntax Error
        </p>
        <div className="text-red-500 text-[10px] mb-2 font-mono">{errorMsg}</div>
        <pre className="text-red-800 text-xs font-mono overflow-auto whitespace-pre-wrap bg-red-100/50 p-2 rounded max-h-40">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
       <div className="flex items-center justify-center p-8 bg-slate-50 rounded-2xl my-4 border border-dashed border-slate-300">
         <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
         <span className="ml-3 text-sm text-slate-500 font-medium">در حال ترسیم دیاگرام...</span>
       </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 my-6 overflow-x-auto shadow-soft text-center border border-slate-100" dir="ltr">
       <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};

export default MermaidRenderer;
