

import { OllamaConfig, ChatMessage } from '../types';

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

export const checkOllamaConnection = async (config: OllamaConfig): Promise<boolean> => {
  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/api/tags`);
    return response.ok;
  } catch (e) {
    return false;
  }
};

export const checkEmbeddingModelAvailable = async (config: OllamaConfig): Promise<boolean> => {
  if (!config.embeddingModel) return false;
  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/api/tags`);
    if (!response.ok) return false;
    const data = await response.json();
    const models = (data.models || []).map((model: { name?: string }) => model.name).filter(Boolean);
    return models.includes(config.embeddingModel);
  } catch (error) {
    return false;
  }
};

const requestCompletion = async (
  config: OllamaConfig,
  prompt: string,
  system: string,
  timeoutMs: number
): Promise<string> => {
  const response = await fetchWithTimeout(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: {
        temperature: 0.1, // Strict adherence to instructions
        num_ctx: 16384    // Increased to 16k for deep analysis of large files
      }
    }),
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`Ollama API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.message.content;
};

export const generateCompletion = async (
  config: OllamaConfig,
  prompt: string,
  system: string
): Promise<string> => {
  try {
    return await requestCompletion(config, prompt, system, 30000);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('Ollama Generation timed out. Retrying with longer timeout.');
      try {
        return await requestCompletion(config, prompt, system, 60000);
      } catch (retryError) {
        console.warn('Ollama Generation retry timed out.');
        return '⚠️ پاسخ مدل به‌دلیل زمان‌بر بودن عملیات کامل نشد.';
      }
    }
    console.error("Ollama Generation Error:", error);
    throw error;
  }
};

export const sendChatRequest = async (
  config: OllamaConfig,
  messages: ChatMessage[]
): Promise<string> => {
  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model, // For chat generation we use the main model
        messages: messages,
        stream: false,
        options: {
          temperature: 0.2,
          num_ctx: 16384 // Increased context for chat as well
        }
      }),
    }, 30000);

    if (!response.ok) {
      throw new Error(`Chat API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('Ollama Chat timed out.');
      throw new Error('درخواست چت به Ollama زمان‌بر شد. لطفاً دوباره تلاش کنید.');
    }
    console.error("Ollama Chat Error:", error);
    throw error;
  }
};

// --- New RAG Method ---
export const generateEmbeddings = async (
  config: OllamaConfig,
  prompt: string
): Promise<number[]> => {
  if (!config.embeddingModel) {
    return [];
  }
  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.embeddingModel, // Use the lightweight embedding model
        prompt: prompt,
      }),
    });

    if (!response.ok) {
       // Fallback: Try using the main model if embedding model fails, though not ideal
       if (config.embeddingModel !== config.model) {
           console.warn("Embedding model failed, retrying with main model...");
           return generateEmbeddings({...config, embeddingModel: config.model}, prompt);
       }
       if (response.status === 400) {
         console.warn('Embedding API returned 400. Disabling embeddings for this session.');
         return [];
       }
       throw new Error(`Embedding API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('Embedding request timed out. Falling back to keyword search.');
      return [];
    }
    console.error("Ollama Embedding Error:", error);
    throw error;
  }
};
