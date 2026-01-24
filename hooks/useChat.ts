
import React, { useState, useEffect } from 'react';
import { ChatMessage, OllamaConfig } from '../types';
import { LocalVectorStore } from '../services/vectorStore';
import { sendChatRequest } from '../services/ollamaService';
import { useRepoProcessor } from './useRepoProcessor'; // Access KnowledgeGraph

const CHAT_STORAGE_KEY = 'rayan_chat_history';
const DEFAULT_SYSTEM_MSG: ChatMessage = { role: 'system', content: 'شما یک دستیار هوشمند برنامه‌نویسی هستید. پاسخ‌ها باید کوتاه، دقیق و حرفه‌ای باشند.' };

export const useChat = (config: OllamaConfig, vectorStoreRef: React.MutableRefObject<LocalVectorStore | null>, hasContext: boolean) => {
  // Access global knowledge graph to resolve symbol IDs
  const { knowledgeGraph } = useRepoProcessor();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [DEFAULT_SYSTEM_MSG];
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [DEFAULT_SYSTEM_MSG];
    } catch { return [DEFAULT_SYSTEM_MSG]; }
  });

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
  }, [chatMessages]);

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
         const relevantDocs = await vectorStoreRef.current.similaritySearch(userText, 4);
         
         const chunksText = relevantDocs.map(d => {
            // GRAPH RAG INJECTION:
            // Look up related symbols from the knowledge graph
            let graphContext = "";
            if (d.metadata.relatedSymbols && knowledgeGraph) {
                const relations = d.metadata.relatedSymbols
                    .map(id => knowledgeGraph[id])
                    .filter(s => s) // exist check
                    .map(s => {
                        const calls = s.relationships.calls.length;
                        const calledBy = s.relationships.calledBy.map(cid => knowledgeGraph[cid]?.name).join(', ');
                        return `> Symbol: ${s.name} (${s.kind}) | Calls: ${calls} | Used By: ${calledBy || 'None'}`;
                    }).slice(0, 3).join('\n');
                
                if (relations) graphContext = `\n[Graph Analysis]\n${relations}`;
            }

            return `SOURCE: ${d.metadata.filePath}\n\`\`\`\n${d.content}\n\`\`\`${graphContext}`;
         }).join('\n\n');

         if (chunksText) {
             contextContent = `*** RETRIEVED SOURCE CODE & GRAPH CONTEXT ***\n${chunksText}\n*** END SOURCE ***\n\n`;
         }
         setIsRetrieving(false);
      }

      const systemMessage: ChatMessage = { 
         role: 'system', 
         content: `You are an expert code assistant named 'Rayan'. 
         ${contextContent ? `Use the following retrieved code and GRAPH RELATIONSHIPS to answer:\n${contextContent}` : 'Answer based on your knowledge.'}
         
         Rules:
         1. Always answer in Persian (Farsi).
         2. Use the [Graph Analysis] section to understand what functions call what.
         3. If a function is complex (High Complexity score), suggest refactoring.`
      };

      const messagesToSend = [systemMessage, ...chatMessages.filter(m => m.role !== 'system'), newUserMessage];
      const responseContent = await sendChatRequest(config, messagesToSend);
      setChatMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (error) {
      setIsRetrieving(false);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '**خطا در ارتباط.**' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return { chatMessages, chatInput, setChatInput, isChatLoading, isRetrieving, handleSendMessage };
};
