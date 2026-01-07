
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, ZoomIn, ZoomOut, RefreshCcw, Download } from 'lucide-react';
import mermaid from 'mermaid';

const MermaidRenderer = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Handlers
  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 10)); // Increased max zoom to 10x
  const handleZoomOut = () => setScale(s => Math.max(s - 0.5, 0.1)); // Decreased min zoom
  const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom support (optional, requires ctrl key to not hijack scroll)
  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(s => Math.min(Math.max(s + delta, 0.1), 10));
      }
  };

  const fixMermaidSyntax = (rawCode: string) => {
    let fixed = rawCode
      .replace(/```mermaid/gi, '')
      .replace(/```/g, '')
      .trim();
    
    if (fixed.toLowerCase().startsWith('mermaid')) {
        fixed = fixed.substring(7).trim();
    }
    fixed = fixed.replace(/^#+.*$/gm, '');
    
    // Fix: Unquoted labels, but PROTECT database shapes like [("Label")]
    // We only quote if it contains parenthesis AND does NOT start with ("
    fixed = fixed.replace(/\[(?![ "])(?!\(")(.*?\(.*?\).*?)(?<![" ])\]/g, '["$1"]');
    
    // Fix: Generic unquoted labels with spaces, ignoring those starting with ("
    fixed = fixed.replace(/\[(?![ "])(?!\(")(.*\s+.*)(?<![" ])\]/g, '["$1"]');
    
    // Fix: Ensure 'end' keyword is on its own line (common LLM issue)
    fixed = fixed.replace(/(\S)\s+end\s*$/gm, '$1\nend');

    fixed = fixed.replace(/Style /g, 'style ');
    if (fixed.startsWith('graph ')) {
       fixed = fixed.replace('graph ', 'flowchart ');
    }
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

    const renderDiagram = async (codeToRender: string, retry = true) => {
      if (!codeToRender) return;
      try {
        if (isMounted) {
            setIsError(false);
            setErrorMsg('');
        }

        const cleanCode = fixMermaidSyntax(codeToRender);

        const validStarts = ['sequenceDiagram', 'classDiagram', 'erDiagram', 'flowchart', 'gantt', 'stateDiagram', 'pie', 'gitGraph'];
        if (!validStarts.some(start => cleanCode.startsWith(start))) {
           if (cleanCode.includes('-->') || cleanCode.includes('---')) {
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

        // Auto-Recovery for specific errors (Activation/Deactivation mismatches)
        // If we get "inactive participant" or general parser error on sequence diagram, we strip activations.
        if (retry && error.message && (error.message.includes('inactive participant') || error.message.includes('activate'))) {
             console.warn('Attempting to fix activation error by stripping activation commands...');
             // Strip all activate/deactivate lines (safe fallback for visuals)
             const simplifiedCode = codeToRender.replace(/^\s*(activate|deactivate)\s+.*$/gm, '');
             await renderDiagram(simplifiedCode, false);
             return;
        }

        if (isMounted) {
            setIsError(true);
            setErrorMsg(error.message || 'Syntax Error in Diagram Code');
        }
      }
    };

    renderDiagram(code);

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
    <div className="relative group my-8">
      <div 
        className="bg-slate-50 rounded-2xl overflow-hidden shadow-soft border border-slate-200 select-none relative" 
        dir="ltr"
        style={{ height: '500px' }} // Fixed height for consistent viewport
      >
         {/* Toolbar */}
         <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-white/90 backdrop-blur p-1.5 rounded-xl shadow-sm border border-slate-200 transition-opacity opacity-0 group-hover:opacity-100">
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="بزرگنمایی"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="کوچک‌نمایی"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={handleReset} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="بازنشانی"><RefreshCcw className="w-4 h-4" /></button>
            <div className="h-px bg-slate-200 my-0.5"></div>
            <button onClick={handleDownload} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="دانلود دیاگرام (SVG)"><Download className="w-4 h-4" /></button>
         </div>

         {/* Canvas */}
         <div 
           ref={containerRef}
           className={`w-full h-full flex items-center justify-center overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
           onMouseDown={handleMouseDown}
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseUp}
           onWheel={handleWheel}
         >
            <div 
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                transformOrigin: 'center center'
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
         </div>
      </div>
      <div className="text-center text-[10px] text-slate-400 mt-2 font-medium">
         برای جابجایی کلیک کنید و بکشید • بزرگنمایی با دکمه‌ها یا Ctrl + Scroll
      </div>
    </div>
  );
};

export default MermaidRenderer;
