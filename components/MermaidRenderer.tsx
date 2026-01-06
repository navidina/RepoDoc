
import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import mermaid from 'mermaid';

const MermaidRenderer = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fixMermaidSyntax = (rawCode: string) => {
    let fixed = rawCode
      .replace(/```mermaid/g, '')
      .replace(/```/g, '')
      .trim();
    
    if (fixed.toLowerCase().startsWith('mermaid')) {
        fixed = fixed.substring(7).trim();
    }
    
    fixed = fixed.replace(/Style /g, 'style ');

    if (fixed.startsWith('graph ')) {
       fixed = fixed.replace('graph ', 'flowchart ');
    }

    return fixed;
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

        if (!cleanCode.startsWith('sequenceDiagram') && 
            !cleanCode.startsWith('classDiagram') && 
            !cleanCode.startsWith('erDiagram') && 
            !cleanCode.startsWith('flowchart') && 
            !cleanCode.startsWith('gantt') &&
            !cleanCode.startsWith('stateDiagram')) {
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
