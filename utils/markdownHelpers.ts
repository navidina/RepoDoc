

export const generateFileHeaderHTML = (path: string, lines: number) => {
  const parts = path.split('/');
  const filename = parts.pop();
  const dir = parts.join('/');
  
  return `
<div class="file-header">
  <div class="file-info-group">
    <span class="file-icon">📄</span>
    <span class="file-name">${filename}</span>
    <span class="file-path">${dir ? `${dir}/` : ''}</span>
  </div>
  <span class="file-size">${lines.toLocaleString()} Lines</span>
</div>`;
};

export const extractMermaidCode = (response: string): string => {
  if (!response) return '';

  // Clean up common markdown errors from LLMs
  // Sometimes they write "``` mermaid" (space) or "'''mermaid" (wrong quote)
  let cleanResponse = response.replace(/'''/g, '```').replace(/```\s+mermaid/gi, '```mermaid');

  const keywords = ['sequenceDiagram', 'classDiagram', 'erDiagram', 'flowchart', 'graph', 'gantt', 'stateDiagram', 'usecaseDiagram'];

  // 1. Try to find a clean Mermaid code block
  const strictMatch = cleanResponse.match(/```mermaid\s*([\s\S]*?)```/i);
  if (strictMatch && strictMatch[1]) {
    return `\`\`\`mermaid\n${strictMatch[1].trim()}\n\`\`\``;
  }

  // 2. Try to find ANY code block and check if it looks like Mermaid
  const genericBlockMatch = cleanResponse.match(/```([\s\S]*?)```/g);
  if (genericBlockMatch) {
    for (const block of genericBlockMatch) {
      const content = block.replace(/```/g, '').trim();
      // Check if it starts with a keyword (ignoring case) or contains "-->" (common in flowcharts/sequences)
      if (keywords.some(kw => content.toLowerCase().startsWith(kw.toLowerCase())) || content.includes('-->') || content.includes('->>')) {
        return `\`\`\`mermaid\n${content}\n\`\`\``;
      }
    }
  }

  // 3. Aggressive Extraction (Deep Scan)
  // If the LLM wrote a lot of text and then just dumped the code without backticks, or buried it.
  // We look for the FIRST occurrence of a diagram keyword and capture until a double newline or end of text.
  for (const keyword of keywords) {
    // Regex: Find keyword at start of line OR after a newline. Capture everything until a double newline that isn't part of a relationship (hacky but works for simple cases)
    // Actually, safer to capture until the next markdown header (#) or end of string.
    const regex = new RegExp(`(${keyword}[\\s\\S]*?)(?=\\n#|\\n\\n\\n|$)`, 'i');
    const match = cleanResponse.match(regex);
    
    if (match && match[1]) {
      let candidate = match[1].trim();
      // Heuristic: If it contains typical mermaid arrows, it's likely the code
      if (candidate.includes('-->') || candidate.includes('->>') || candidate.includes('||--') || candidate.includes('{') || candidate.includes('class ')) {
         return `\`\`\`mermaid\n${candidate}\n\`\`\``;
      }
    }
  }

  // Error fallback
  console.warn("Mermaid extraction failed. Raw response snippet:", response.substring(0, 50));
  return `\`\`\`mermaid\nflowchart TD;\nError["خطا در تولید دیاگرام"]\nNote["مدل پاسخ نامعتبری ارسال کرد"]\nstyle Error fill:#ffcccc,stroke:#ff0000;\n\`\`\``;
};

export const normalizeUseCaseDiagram = (diagram: string): string => {
  const match = diagram.match(/```mermaid\s*([\s\S]*?)```/i);
  if (!match) return diagram;

  let body = match[1].trim();
  if (!body.toLowerCase().startsWith('usecasediagram')) return diagram;

  body = body.replace(/^usecaseDiagram\s*/i, 'usecaseDiagram\n');
  body = body.replace(/\r/g, '');
  body = body.replace(/\s{2,}/g, '\n  ');

  const lines = body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const normalized = lines.map(line => {
    if (line.toLowerCase() === 'usecasediagram') return 'usecaseDiagram';
    let updated = line;
    updated = updated.replace(/^include\s+(.+?)\s+in\s+\((.+?)\)/i, '$1 ..> ($2) : <<include>>');
    updated = updated.replace(/^extend\s+(.+?)\s+in\s+\((.+?)\)/i, '$1 ..> ($2) : <<extend>>');
    return `  ${updated}`;
  });

  return `\`\`\`mermaid\n${normalized.join('\n')}\n\`\`\``;
};

const sanitizeNodeId = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');

export const buildDependencyMermaid = (edges: [string, string][]): string => {
  if (edges.length === 0) return '';
  const lines = edges.map(([from, to]) => {
    const fromId = sanitizeNodeId(from);
    const toId = sanitizeNodeId(to);
    return `${fromId}["${from}"] --> ${toId}["${to}"]`;
  });
  return `\`\`\`mermaid\nflowchart LR\n${lines.join('\n')}\n\`\`\``;
};
