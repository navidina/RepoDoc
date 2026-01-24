

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

  body = body.replace(/\r/g, '');
  body = body.replace(/^usecaseDiagram\s*/i, 'usecaseDiagram\n');

  // Force breaks before key tokens so collapsed output becomes valid Mermaid
  body = body.replace(/\s+(actor|usecase|include|extend)\b/gi, '\n$1');
  body = body.replace(/\s+([A-Za-z0-9_]+)\s*-->/g, '\n$1 -->');

  const lines = body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');
  const escapeLabel = (value: string) => value.replace(/"/g, '&quot;');
  const cleanName = (value: string) => value.trim().replace(/^\(+|\)+$/g, '').replace(/^"+|"+$/g, '');

  const actorId = (name: string) => `actor_${sanitizeId(name)}`;
  const usecaseId = (name: string) => `usecase_${sanitizeId(name)}`;
  const renderActorNode = (name: string) => `${actorId(name)}["👤 ${escapeLabel(name)}"]`;
  const renderUsecaseNode = (name: string) => `${usecaseId(name)}(["${escapeLabel(name)}"])`;

  const actors = new Set<string>();
  const usecases = new Set<string>();
  const edges = new Set<string>();
  let seenHeader = false;

  const ensureActor = (raw: string) => {
    const name = cleanName(raw);
    if (!name) return '';
    actors.add(name);
    return name;
  };

  const ensureUsecase = (raw: string) => {
    const name = cleanName(raw);
    if (!name) return '';
    usecases.add(name);
    return name;
  };

  const addRelation = (from: string, to: string, label?: string) => {
    if (!from || !to) return;
    const rendered = label
      ? `${from} -->|${label}| ${to}`
      : `${from} --> ${to}`;
    edges.add(rendered);
  };

  lines.forEach((line) => {
    if (line.toLowerCase() === 'usecasediagram') {
      if (seenHeader) return;
      seenHeader = true;
      return;
    }

    const actorMatch = line.match(/^actor\s+(.+)$/i);
    if (actorMatch) {
      ensureActor(actorMatch[1]);
      return;
    }

    const useCaseMatch = line.match(/^usecase\s+(.+)$/i);
    if (useCaseMatch) {
      ensureUsecase(useCaseMatch[1]);
      return;
    }

    const includeWithMatch = line.match(/^include\s+(.+?)\s+with\s+(.+)$/i);
    if (includeWithMatch) {
      const base = ensureUsecase(includeWithMatch[1]);
      const inc = ensureUsecase(includeWithMatch[2]);
      if (base && inc) addRelation(usecaseId(base), usecaseId(inc), '<<include>>');
      return;
    }

    const includeCommaMatch = line.match(/^include\s+(.+?)\s*,\s*(.+)$/i);
    if (includeCommaMatch) {
      const base = ensureUsecase(includeCommaMatch[1]);
      includeCommaMatch[2].split(',').forEach((part) => {
        const inc = ensureUsecase(part);
        if (base && inc) addRelation(usecaseId(base), usecaseId(inc), '<<include>>');
      });
      return;
    }

    const includeInMatch = line.match(/^include\s+(.+?)\s+in\s+(.+)$/i);
    if (includeInMatch) {
      const inc = ensureUsecase(includeInMatch[1]);
      const base = ensureUsecase(includeInMatch[2]);
      if (base && inc) addRelation(usecaseId(base), usecaseId(inc), '<<include>>');
      return;
    }

    const extendWithMatch = line.match(/^extend\s+(.+?)\s+with\s+(.+)$/i);
    if (extendWithMatch) {
      const base = ensureUsecase(extendWithMatch[1]);
      const ext = ensureUsecase(extendWithMatch[2]);
      if (base && ext) addRelation(usecaseId(ext), usecaseId(base), '<<extend>>');
      return;
    }

    const extendInMatch = line.match(/^extend\s+(.+?)\s+in\s+(.+)$/i);
    if (extendInMatch) {
      const ext = ensureUsecase(extendInMatch[1]);
      const base = ensureUsecase(extendInMatch[2]);
      if (base && ext) addRelation(usecaseId(ext), usecaseId(base), '<<extend>>');
      return;
    }

    const arrowMatch = line.match(/^(.+?)\s*-->\s*(.+)$/);
    if (arrowMatch) {
      const fromRaw = arrowMatch[1].trim();
      const toRaw = arrowMatch[2].trim();

      const fromIsActor = /^\(?[A-Za-z0-9_]+\)?$/.test(fromRaw) && !fromRaw.startsWith('(');
      const fromName = fromIsActor ? ensureActor(fromRaw) : ensureUsecase(fromRaw);
      const toName = ensureUsecase(toRaw);
      const fromId = fromIsActor ? actorId(fromName) : usecaseId(fromName);
      if (fromName && toName) addRelation(fromId, usecaseId(toName));
    }
  });

  const actorNodes = Array.from(actors).map(renderActorNode);
  const usecaseNodes = Array.from(usecases).map(renderUsecaseNode);

  if (!actorNodes.length && !usecaseNodes.length) {
    return `\`\`\`mermaid\nflowchart LR\n  fallback["Use case diagram not detected"]\n\`\`\``;
  }

  const mermaidLines = [
    'flowchart LR',
    '  subgraph Actors["Actors"]',
    ...actorNodes.map(node => `    ${node}`),
    '  end',
    '  subgraph UseCases["Use Cases"]',
    ...usecaseNodes.map(node => `    ${node}`),
    '  end',
    ...Array.from(edges).map(edge => `  ${edge}`)
  ];

  return `\`\`\`mermaid\n${mermaidLines.join('\n')}\n\`\`\``;
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
