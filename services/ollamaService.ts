

import { OllamaConfig, ChatMessage } from '../types';

export const checkOllamaConnection = async (config: OllamaConfig): Promise<boolean> => {
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`);
    return response.ok;
  } catch (e) {
    return false;
  }
};

export const generateCompletion = async (
  config: OllamaConfig,
  prompt: string,
  system: string
): Promise<string> => {
  try {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
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
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    console.error("Ollama Generation Error:", error);
    throw error;
  }
};

export const sendChatRequest = async (
  config: OllamaConfig,
  messages: ChatMessage[]
): Promise<string> => {
  try {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
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
    });

    if (!response.ok) {
      throw new Error(`Chat API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    console.error("Ollama Chat Error:", error);
    throw error;
  }
};

// --- New RAG Method ---
export const generateEmbeddings = async (
  config: OllamaConfig,
  prompt: string
): Promise<number[]> => {
  try {
    const response = await fetch(`${config.baseUrl}/api/embeddings`, {
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
       throw new Error(`Embedding API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error("Ollama Embedding Error:", error);
    throw error;
  }
};