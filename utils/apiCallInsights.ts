import { ProcessedFile } from '../types';

interface ApiCallSite {
  method: string;
  url: string;
  filePath: string;
  line: number;
  container?: { kind: 'class' | 'function' | 'global'; name: string };
}

interface ApiEndpoint {
  method: string;
  path: string;
  host?: string;
  filePath: string;
  line: number;
  container?: { kind: 'class' | 'function' | 'global'; name: string };
  source: 'internal' | 'external';
}

const toMethod = (value: string) => value.toUpperCase();

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');

const escapeLabel = (value: string) => value.replace(/"/g, '&quot;');

const formatContainer = (container?: { kind: 'class' | 'function' | 'global'; name: string }) => {
  if (!container) return 'scope: global';
  if (container.kind === 'global') return 'scope: global';
  return `${container.kind}: ${container.name}`;
};

const parseUrlParts = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  const absoluteMatch = trimmed.match(/^(https?:\/\/[^/\s]+)(\/[^?\s]*)?/i);
  if (absoluteMatch) {
    const host = absoluteMatch[1].replace(/^https?:\/\//i, '');
    const path = absoluteMatch[2] || '/';
    return { host, path };
  }

  const relativeMatch = trimmed.match(/^(\/[^?\s]*)/);
  if (relativeMatch) {
    return { host: '', path: relativeMatch[1] };
  }

  return { host: '', path: trimmed || '/' };
};

const extractHost = (url: string) => {
  const { host } = parseUrlParts(url);
  return host;
};

const extractFetchMethod = (line: string) => {
  const match = line.match(/method\s*:\s*['"`](get|post|put|patch|delete)['"`]/i);
  return match ? toMethod(match[1]) : 'GET';
};

const findNearestContainer = (file: ProcessedFile, line: number) => {
  const candidates = file.metadata.symbols
    .filter(symbol => (symbol.kind === 'class' || symbol.kind === 'function') && symbol.line <= line)
    .sort((a, b) => b.line - a.line);

  const best = candidates[0];
  if (!best) {
    return { kind: 'global' as const, name: 'global' };
  }

  return { kind: best.kind as 'class' | 'function', name: best.name };
};

const buildMermaidFlow = (callSites: ApiCallSite[], endpoints: ApiEndpoint[]) => {
  if (!callSites.length) return '';
  const limitedCalls = callSites.slice(0, 12);
  const nodes: string[] = [];
  const edges: string[] = [];
  const endpointNodes = new Set<string>();

  const endpointIndex = new Map<string, ApiEndpoint>();
  endpoints.forEach(endpoint => {
    const key = `${endpoint.host || ''}:${endpoint.path}`;
    if (!endpointIndex.has(key)) {
      endpointIndex.set(key, endpoint);
    }
  });

  const bestEndpointForCall = (call: ApiCallSite) => {
    const { host: callHost, path: callPath } = parseUrlParts(call.url);
    const internalMatches = endpoints
      .filter(endpoint => endpoint.source === 'internal')
      .filter(endpoint => endpoint.method === call.method || endpoint.method === 'GET')
      .filter(endpoint => callPath.includes(endpoint.path))
      .sort((a, b) => b.path.length - a.path.length);

    if (internalMatches.length) {
      return internalMatches[0];
    }

    const externalKey = `${callHost}:${callPath}`;
    return endpointIndex.get(externalKey);
  };

  limitedCalls.forEach((call, idx) => {
    const callId = `Call_${sanitizeId(`${call.filePath}_${call.line}_${idx}`)}`;
    const callLabel = [
      `${call.method} ${call.url}`,
      `${call.filePath}:${call.line}`,
      formatContainer(call.container)
    ].map(escapeLabel).join('<br/>');
    nodes.push(`${callId}["${callLabel}"]`);

    const target = bestEndpointForCall(call);
    if (target) {
      const endpointId = `Endpoint_${sanitizeId(`${target.host || 'internal'}_${target.path}_${target.method}`)}`;
      if (!endpointNodes.has(endpointId)) {
        const endpointTitle = target.host ? `${target.method} ${target.host}${target.path}` : `${target.method} ${target.path}`;
        const endpointLabel = [
          endpointTitle,
          `${target.filePath}:${target.line}`,
          formatContainer(target.container)
        ].map(escapeLabel).join('<br/>');
        const endpointShape = target.source === 'internal' ? `["${endpointLabel}"]` : `(["${endpointLabel}"])`;
        nodes.push(`${endpointId}${endpointShape}`);
        endpointNodes.add(endpointId);
      }
      edges.push(`${callId} --> ${endpointId}`);
    }
  });

  const callLines = nodes.filter(node => node.startsWith('Call_'));
  const endpointOnlyLines = nodes.filter(node => node.startsWith('Endpoint_'));

  const mermaidLines = [
    'flowchart LR',
    '  subgraph CallSites["Call Sites (file:line / scope)"]',
    ...callLines.map(line => `    ${line}`),
    '  end',
    '  subgraph Endpoints["Endpoints (host/path / definition)"]',
    ...endpointOnlyLines.map(line => `    ${line}`),
    '  end',
    ...edges.map(edge => `  ${edge}`)
  ];

  return `\n\n\`\`\`mermaid\n${mermaidLines.join('\n')}\n\`\`\``;
};

export const buildApiCallInsights = (files: ProcessedFile[]) => {
  const callSites: ApiCallSite[] = [];
  const internalEndpoints: ApiEndpoint[] = [];
  const externalEndpointMap = new Map<string, ApiEndpoint>();

  files.forEach(file => {
    const lines = file.content.split(/\r\n|\r|\n/);
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const container = findNearestContainer(file, lineNumber);

      const fetchMatch = line.match(/fetch\(\s*['"`]([^'"`]+)['"`]/);
      if (fetchMatch) {
        const method = extractFetchMethod(line);
        callSites.push({ method, url: fetchMatch[1], filePath: file.path, line: lineNumber, container });
      }

      const axiosMatch = line.match(/axios\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
      if (axiosMatch) {
        callSites.push({ method: toMethod(axiosMatch[1]), url: axiosMatch[2], filePath: file.path, line: lineNumber, container });
      }

      const clientMatch = line.match(/\b([A-Za-z0-9_]+)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
      if (clientMatch && clientMatch[1].toLowerCase() !== 'axios') {
        callSites.push({ method: toMethod(clientMatch[2]), url: clientMatch[3], filePath: file.path, line: lineNumber, container });
      }

      const routeMatch = line.match(/\b(app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/i);
      if (routeMatch) {
        internalEndpoints.push({ method: toMethod(routeMatch[2]), path: routeMatch[3], filePath: file.path, line: lineNumber, container, source: 'internal' });
      }

      const nestMatch = line.match(/@(Get|Post|Put|Patch|Delete)\(['"`]?(.*?)['"`]?\)/);
      if (nestMatch) {
        internalEndpoints.push({ method: toMethod(nestMatch[1]), path: nestMatch[2] || '/', filePath: file.path, line: lineNumber, container, source: 'internal' });
      }
    });
  });

  callSites.forEach((call) => {
    const { host, path } = parseUrlParts(call.url);
    const key = `${host}:${path}`;
    if (!externalEndpointMap.has(key)) {
      externalEndpointMap.set(key, {
        method: call.method,
        path,
        host,
        filePath: call.filePath,
        line: call.line,
        container: call.container,
        source: 'external'
      });
    }
  });

  const endpoints = [...internalEndpoints, ...externalEndpointMap.values()];

  const methodsCount: Record<string, number> = {};
  callSites.forEach(call => {
    methodsCount[call.method] = (methodsCount[call.method] || 0) + 1;
  });

  const externalHosts = Array.from(new Set(callSites.map(call => extractHost(call.url)).filter(Boolean)));
  const tableLines = Object.entries(methodsCount)
    .map(([method, count]) => `| ${method} | ${count} |`)
    .join('\n');

  const callSamples = callSites.slice(0, 6)
    .map(call => `- ${call.method} ${call.url} — ${call.filePath}:${call.line} (${formatContainer(call.container)})`)
    .join('\n') || '- موردی یافت نشد';

  const endpointSamples = endpoints.slice(0, 6)
    .map(endpoint => {
      const target = endpoint.host ? `${endpoint.host}${endpoint.path}` : endpoint.path;
      return `- ${endpoint.method} ${target} — ${endpoint.filePath}:${endpoint.line} (${formatContainer(endpoint.container)})`;
    })
    .join('\n') || '- موردی یافت نشد';

  const hostLines = externalHosts.length ? externalHosts.map(host => `- ${host}`).join('\n') : '- موردی یافت نشد';

  const mermaidFlow = buildMermaidFlow(callSites, endpoints);
  const pieLines = Object.entries(methodsCount)
    .map(([method, count]) => `  \"${method}\" : ${count}`)
    .join('\n');
  const mermaidPie = pieLines
    ? `\n\n\`\`\`mermaid\npie title توزیع متدهای API\n${pieLines}\n\`\`\``
    : '';

  const markdown = [
    '## 📡 وضعیت فراخوانی‌های API',
    `- تعداد فراخوانی‌ها: ${callSites.length}`,
    `- تعداد endpointها: ${endpoints.length}`,
    '',
    '### 📊 توزیع متدها',
    '| متد | تعداد |',
    '| --- | --- |',
    tableLines || '| - | 0 |',
    mermaidPie,
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
