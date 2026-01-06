
import { useState } from 'react';
import { ChatMessage, OllamaConfig } from '../types';
import { LocalVectorStore } from '../services/vectorStore';
import { sendChatRequest } from '../services/ollamaService';

export const useChat = (config: OllamaConfig, vectorStoreRef: React.MutableRefObject<LocalVectorStore | null>, hasContext: boolean) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'شما یک دستیار هوشمند برنامه‌نویسی هستید. پاسخ‌ها باید کوتاه، دقیق و حرفه‌ای باشند.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput;
    const newUserMessage: ChatMessage = { role: 'user', content: userText };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      let contextContent = "";
      
      if (hasContext && vectorStoreRef.current) {
         setIsRetrieving(true);
         const relevantDocs = await vectorStoreRef.current.similaritySearch(userText, 5);
         
         if (relevantDocs.length > 0) {
           const chunksText = relevantDocs.map(d => `SOURCE: ${d.metadata.filePath}\n\`\`\`\n${d.content}\n\`\`\``).join('\n\n');
           contextContent = `*** RETRIEVED PROJECT SOURCE CODE ***\n${chunksText}\n*** END SOURCE ***\n\n`;
         }
         setIsRetrieving(false);
      }

      const systemMessage: ChatMessage = { 
         role: 'system', 
         content: `You are an expert code assistant. 
         ${contextContent ? `Use the following retrieved code snippets to answer the user's question:\n${contextContent}` : 'Answer based on your general knowledge.'}
         
         Rules:
         1. Always answer in Persian (Farsi).
         2. Be concise and technical.
         3. If the answer is in the retrieved code, cite the file name.`
      };

      const messagesToSend = [systemMessage, ...chatMessages.filter(m => m.role !== 'system'), newUserMessage];
      const responseContent = await sendChatRequest(config, messagesToSend);
      setChatMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (error) {
      setIsRetrieving(false);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '**خطا در برقراری ارتباط با مدل.** لطفا تنظیمات Ollama را بررسی کنید.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return { chatMessages, chatInput, setChatInput, isChatLoading, isRetrieving, handleSendMessage };
};
