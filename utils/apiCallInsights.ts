import { ProcessedFile } from '../types';

interface ApiCallSite {
  method: string;
  url: string;
  filePath: string;
  line: number;
}

interface ApiEndpoint {
  method: string;
  path: string;
  filePath: string;
  line: number;
}

const METHOD_KEYS = ['get', 'post', 'put', 'patch', 'delete'];

const toMethod = (value: string) => value.toUpperCase();

const extractHost = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch (error) {
    return '';
  }
};

const buildMermaidFlow = (callSites: ApiCallSite[], endpoints: ApiEndpoint[]) => {
  if (!callSites.length || !endpoints.length) return '';
  const limitedCalls = callSites.slice(0, 6);
  const limitedEndpoints = endpoints.slice(0, 6);
  const nodes: string[] = [];
  const edges: string[] = [];

  const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');

  limitedCalls.forEach((call, idx) => {
    const callId = `Call_${sanitize(`${call.filePath}_${call.line}_${idx}`)}`;
    nodes.push(`${callId}(["${call.method} ${call.url}"])`);
    const target = limitedEndpoints[idx % limitedEndpoints.length];
    const targetId = `Endpoint_${sanitize(`${target.path}_${idx}`)}`;
    if (!nodes.some(node => node.includes(targetId))) {
      nodes.push(`${targetId}["${target.method} ${target.path}"]`);
    }
    edges.push(`${callId} --> ${targetId}`);
  });

  return `\n\n\`\`\`mermaid\nflowchart LR\n${[...nodes, ...edges].join('\n')}\n\`\`\``;
};

export const buildApiCallInsights = (files: ProcessedFile[]) => {
  const callSites: ApiCallSite[] = [];
  const endpoints: ApiEndpoint[] = [];

  files.forEach(file => {
    const lines = file.content.split(/\r\n|\r|\n/);
    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      const fetchMatch = line.match(/fetch\(\s*['"`]([^'"`]+)['"`]/);
      if (fetchMatch) {
        callSites.push({ method: 'FETCH', url: fetchMatch[1], filePath: file.path, line: lineNumber });
      }

      const axiosMatch = line.match(/axios\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
      if (axiosMatch) {
        callSites.push({ method: toMethod(axiosMatch[1]), url: axiosMatch[2], filePath: file.path, line: lineNumber });
      }

      const routeMatch = line.match(/\b(app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
      if (routeMatch) {
        endpoints.push({ method: toMethod(routeMatch[2]), path: routeMatch[3], filePath: file.path, line: lineNumber });
      }

      const nestMatch = line.match(/@(Get|Post|Put|Patch|Delete)\(['"`]?(.*?)['"`]?\)/);
      if (nestMatch) {
        endpoints.push({ method: toMethod(nestMatch[1]), path: nestMatch[2] || '/', filePath: file.path, line: lineNumber });
      }
    });
  });

  const methodsCount: Record<string, number> = {};
  callSites.forEach(call => {
    methodsCount[call.method] = (methodsCount[call.method] || 0) + 1;
  });
  endpoints.forEach(endpoint => {
    methodsCount[endpoint.method] = (methodsCount[endpoint.method] || 0) + 1;
  });

  const externalHosts = Array.from(new Set(callSites.map(call => extractHost(call.url)).filter(Boolean)));
  const tableLines = Object.entries(methodsCount)
    .map(([method, count]) => `| ${method} | ${count} |`)
    .join('\n');

  const callSamples = callSites.slice(0, 6)
    .map(call => `- ${call.method} ${call.url} — ${call.filePath}:${call.line}`)
    .join('\n') || '- موردی یافت نشد';

  const endpointSamples = endpoints.slice(0, 6)
    .map(endpoint => `- ${endpoint.method} ${endpoint.path} — ${endpoint.filePath}:${endpoint.line}`)
    .join('\n') || '- موردی یافت نشد';

  const hostLines = externalHosts.length ? externalHosts.map(host => `- ${host}`).join('\n') : '- موردی یافت نشد';

  const mermaidFlow = buildMermaidFlow(callSites, endpoints);

  const markdown = [
    '## 📡 وضعیت فراخوانی‌های API',
    `- تعداد فراخوانی‌ها: ${callSites.length}`,
    `- تعداد endpointها: ${endpoints.length}`,
    '',
    '### 📊 توزیع متدها',
    '| متد | تعداد |',
    '| --- | --- |',
    tableLines || '| - | 0 |',
    '',
    '### 🌐 میزبان‌های خارجی',
    hostLines,
    '',
    '### 🧪 نمونه فراخوانی‌ها',
    callSamples,
    '',
    '### 🧩 نمونه endpointها',
    endpointSamples,
    mermaidFlow
  ].join('\n');

  return markdown;
};
