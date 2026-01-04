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
        stream: false
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
        model: config.model,
        messages: messages,
        stream: false
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