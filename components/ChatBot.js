'use client';

import { useState, useRef, useEffect } from 'react';
import NeoButton from './NeoButton';
import NeoTextarea from './NeoTextarea';
import { executeAgentWithLogs, executeAgent } from '@/lib/api';

export default function ChatBot({ agentId, frameworkOverride, sessionId, onSendMessage, loading, useStreaming = true }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [enableLogs, setEnableLogs] = useState(true); // Toggle for logs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !agentId || loading || isStreaming) {
      return;
    }

    const userMessage = message.trim();
    setMessage('');
    
    // Add user message to chat
    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newUserMessage]);

    // Use logs API if enabled, otherwise use regular API
    if (enableLogs) {
      await handleStreamingExecution(userMessage);
    } else {
      await handleRegularExecution(userMessage);
    }
  };

  const handleStreamingExecution = async (userMessage) => {
    setIsStreaming(true);
    
    // Add loading message with thinking logs array
    const loadingMessageId = Date.now() + 1;
    const loadingMessage = {
      id: loadingMessageId,
      type: 'assistant',
      content: '',
      loading: true,
      thinkingLogs: [], // Store thinking logs in the message
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const executeRequest = {
        task: userMessage,
        parameters: {},
        context: {},
        framework: frameworkOverride || null,
        session_id: sessionId || null,
      };

      let finalResult = null;
      let finalError = null;

      await executeAgentWithLogs(agentId, executeRequest, (eventType, data) => {
        // Update the message with thinking logs in real-time
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.id !== loadingMessageId) return msg;
            
            const updatedLogs = [...(msg.thinkingLogs || [])];
            
            // Handle different event types
            switch (eventType) {
              case 'thinking':
                updatedLogs.push({
                  type: 'thought',
                  content: data.content,
                  timestamp: data.timestamp,
                });
                break;
              
              case 'action':
                // Check if this is action_input or action
                if (data.type === 'action_input') {
                  updatedLogs.push({
                    type: 'action_input',
                    content: data.content,
                    tool: data.metadata?.tool,
                    input: data.metadata?.input,
                    timestamp: data.timestamp,
                  });
                } else {
                  updatedLogs.push({
                    type: 'action',
                    content: data.content,
                    tool: data.metadata?.tool,
                    timestamp: data.timestamp,
                  });
                }
                break;
              
              case 'observation':
                updatedLogs.push({
                  type: 'observation',
                  content: data.content,
                  timestamp: data.timestamp,
                });
                break;
              
              case 'final_answer':
                updatedLogs.push({
                  type: 'final_answer',
                  content: data.content,
                  timestamp: data.timestamp,
                });
                return {
                  ...msg,
                  content: data.content,
                  thinkingLogs: updatedLogs,
                  loading: false,
                  success: true,
                };
              
              case 'complete':
                if (data.success && data.result && !data.error) {
                  return {
                    ...msg,
                    loading: false,
                    success: true,
                    thinkingLogs: updatedLogs,
                  };
                } else if (data.error) {
                  return {
                    ...msg,
                    content: `Error: ${data.error}`,
                    error: true,
                    loading: false,
                    thinkingLogs: updatedLogs,
                  };
                }
                break;
              
              case 'error':
                return {
                  ...msg,
                  content: `Error: ${data.error || 'Unknown error'}`,
                  error: true,
                  loading: false,
                  thinkingLogs: updatedLogs,
                };
            }
            
            return {
              ...msg,
              thinkingLogs: updatedLogs,
            };
          });
        });
      });

      setIsStreaming(false);
    } catch (error) {
      setIsStreaming(false);
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== loadingMessageId);
        return [...filtered, {
          id: loadingMessageId,
          type: 'assistant',
          content: `Error: ${error.message}`,
          error: true,
          loading: false,
          timestamp: new Date(),
        }];
      });
    }
  };

  const handleRegularExecution = async (userMessage) => {
    setIsStreaming(true);
    
    // Add loading message
    const loadingMessageId = Date.now() + 1;
    const loadingMessage = {
      id: loadingMessageId,
      type: 'assistant',
      content: 'Thinking...',
      loading: true,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const executeRequest = {
        task: userMessage,
        parameters: {},
        context: {},
        framework: frameworkOverride || null,
        session_id: sessionId || null,
      };

      // Use executeAgent API (without logs)
      const response = await executeAgent(agentId, executeRequest);
      
      setIsStreaming(false);
      
      // Remove loading message and add actual response
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== loadingMessageId);
        
        // Handle response structure: { data: { success, result, error, ... }, error: null }
        const responseData = response.data || {};
        const hasError = response.error || !responseData.success;
        const content = responseData.result || responseData.error || response.error || 'No response received';
        
        const assistantMessage = {
          id: Date.now(),
          type: 'assistant',
          content: content,
          error: hasError,
          success: responseData.success || false,
          timestamp: new Date(),
        };
        return [...filtered, assistantMessage];
      });
    } catch (error) {
      setIsStreaming(false);
      
      // Remove loading message and add error
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== loadingMessageId);
        const errorMessage = {
          id: Date.now(),
          type: 'assistant',
          content: `Error: ${error.message}`,
          error: true,
          timestamp: new Date(),
        };
        return [...filtered, errorMessage];
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="neo-card-colored bg-[#87CEEB] mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-black text-black">💬 Chat</h2>
        <div className="flex items-center gap-3">
          {/* Toggle for logs */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-black">Without Logs</span>
            <button
              type="button"
              onClick={() => setEnableLogs(!enableLogs)}
              disabled={loading || isStreaming}
              className={`relative inline-flex h-6 w-11 items-center rounded-full border-4 border-black transition-colors focus:outline-none focus:ring-4 focus:ring-[#87CEEB] ${
                enableLogs ? 'bg-[#90EE90]' : 'bg-[#FFB6C1]'
              } ${loading || isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-label={enableLogs ? 'Disable logs' : 'Enable logs'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full border-2 border-black bg-white transition-transform ${
                  enableLogs ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-bold text-black">With Logs</span>
          </div>
          {messages.length > 0 && (
            <NeoButton
              variant="secondary"
              onClick={clearChat}
              className="text-sm"
            >
              🗑️ Clear Chat
            </NeoButton>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="neo-card flex-1 overflow-y-auto mb-4 min-h-[400px] max-h-[600px]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-black font-semibold text-lg text-center">
              👋 Start a conversation! Select an agent and send a message.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] border-4 border-black p-4 ${
                    msg.type === 'user'
                      ? 'bg-[#90EE90]'
                      : msg.error
                      ? 'bg-[#FFB6C1]'
                      : 'bg-[#FFD700]'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="font-black text-black text-lg">
                      {msg.type === 'user' ? '👤 You' : '🤖 Agent'}
                    </span>
                    <span className="text-xs text-black opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Thinking Logs Section (inline within message) */}
                  {msg.thinkingLogs && msg.thinkingLogs.length > 0 && (
                    <div className="mb-3 p-3 bg-gradient-to-r from-black/5 to-black/10 border-2 border-black/30 rounded-md shadow-sm">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-black/20">
                        <span className="text-xs font-black text-black flex items-center gap-1">
                          <span className="text-base">🧠</span>
                          Thinking Process
                        </span>
                        {msg.loading && (
                          <span className="animate-pulse text-xs text-black/60">●</span>
                        )}
                        <span className="text-xs text-black/60 ml-auto">
                          {msg.thinkingLogs.filter(log => log.type !== 'final_answer').length} step{msg.thinkingLogs.filter(log => log.type !== 'final_answer').length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2 font-mono text-xs max-h-[250px] overflow-y-auto pr-1">
                        {msg.thinkingLogs
                          .filter(log => log.type !== 'final_answer') // Filter out final_answer from thinking logs
                          .map((log, index) => (
                          <div 
                            key={index} 
                            className="text-black animate-fade-in bg-white/50 p-2 rounded border border-black/10"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            {log.type === 'thought' && (
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-green-700 flex-shrink-0 text-base">💭</span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-bold text-green-700">Thought:</span>{' '}
                                  <span className="font-semibold break-words">{log.content}</span>
                                </div>
                              </div>
                            )}
                            {log.type === 'action' && (
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 flex-shrink-0 text-base">⚡</span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-bold text-blue-700">Action:</span>{' '}
                                  <span className="font-semibold break-words">{log.content}</span>
                                  {log.tool && (
                                    <span className="text-xs ml-2 opacity-70 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-300">
                                      {log.tool}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {log.type === 'action_input' && (
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-blue-600 flex-shrink-0 text-base">📥</span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-bold text-blue-600">Action Input:</span>{' '}
                                  <span className="font-semibold break-words bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                    {log.content}
                                  </span>
                                </div>
                              </div>
                            )}
                            {log.type === 'observation' && (
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-purple-700 flex-shrink-0 text-base">👁️</span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-bold text-purple-700">Observation:</span>{' '}
                                  <span className="font-semibold break-words">{log.content}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Main Content */}
                  <div className="text-black font-semibold whitespace-pre-wrap break-words">
                    {msg.loading && (!msg.thinkingLogs || msg.thinkingLogs.length === 0) ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-pulse">●</span>
                        Thinking...
                      </span>
                    ) : msg.content ? (
                      msg.content
                    ) : null}
                  </div>
                  
                  {msg.success !== undefined && !msg.loading && (
                    <div className="mt-2 text-xs font-bold text-black">
                      Status: {msg.success ? '✅ Success' : '❌ Failed'}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="neo-card">
        <div className="flex gap-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !agentId
                  ? 'Please select an agent first...'
                  : 'Type your message here... (Press Enter to send, Shift+Enter for new line)'
              }
              rows={3}
              disabled={!agentId || loading || isStreaming}
              className="w-full px-4 py-2 border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none focus:ring-4 focus:ring-[#87CEEB] resize-y"
            />
          </div>
          <div className="flex items-end">
            <NeoButton
              type="submit"
              variant="primary"
              disabled={!message.trim() || !agentId || loading || isStreaming}
            >
              {loading || isStreaming ? '⏳' : '📤 Send'}
            </NeoButton>
          </div>
        </div>
        <p className="text-xs text-black mt-2 font-semibold">
          💡 Tip: Press Enter to send, Shift+Enter for a new line
        </p>
      </form>
    </div>
  );
}
