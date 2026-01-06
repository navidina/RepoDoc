
export const generateFileHeaderHTML = (path: string, size: number) => {
  const parts = path.split('/');
  const filename = parts.pop();
  const dir = parts.join('/');
  const sizeKb = (size / 1024).toFixed(1);
  
  return `
<div class="file-header">
  <div class="file-info-group">
    <span class="file-icon">📄</span>
    <span class="file-name">${filename}</span>
    <span class="file-path">${dir ? `${dir}/` : ''}</span>
  </div>
  <span class="file-size">${sizeKb} KB</span>
</div>`;
};

export const extractMermaidCode = (response: string): string => {
  // 1. Try to find strict markdown block
  const match = response.match(/```mermaid([\s\S]*?)```/);
  if (match) {
    return `\`\`\`mermaid${match[1]}\`\`\``;
  }

  // 2. Fallback: Search for diagram keywords
  const keywords = ['sequenceDiagram', 'classDiagram', 'erDiagram', 'flowchart', 'graph', 'gantt', 'stateDiagram'];
  for (const keyword of keywords) {
    const regex = new RegExp(`(^|\\n)${keyword}[\\s\\S]*`, 'i');
    const keywordMatch = response.match(regex);
    if (keywordMatch) {
      let content = keywordMatch[0].trim();
      // Remove backticks if present
      content = content.replace(/```/g, '');
      return `\`\`\`mermaid\n${content}\n\`\`\``;
    }
  }

  // 3. Last Resort: Return error graph
  return `\`\`\`mermaid\nflowchart TD;\nError["خطا در تولید دیاگرام"]\nstyle Error fill:#ffcccc,stroke:#ff0000;\n\`\`\``;
};
