'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface InlineChatProps {
  apiUrl?: string;
  pageContext?: string;
  placeholder?: string;
  heading?: string;
  subheading?: string;
}

export default function InlineChat({
  apiUrl = '/api/chat',
  pageContext,
  placeholder = 'Ask me anything about Afterlife...',
  heading = 'Ask me anything about Afterlife',
  subheading = 'Digital Vault, Will creation, pricing, claim assistance, and more',
}: InlineChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorId] = useState(
    () => `visitor_${Date.now()}_${Math.random().toString(36).substring(7)}`
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notify parent (Wix) of height changes for responsive iframe
  useEffect(() => {
    const sendHeight = () => {
      const height = containerRef.current?.scrollHeight || 400;
      window.parent.postMessage({ type: 'afterlife-chat-height', height }, '*');
    };
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isExpanded, messages]);

  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #c8a97e; text-decoration: underline;">$1</a>'
      )
      .replace(/\n/g, '<br/>');
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    // Expand on first message
    if (!isExpanded) {
      setIsExpanded(true);
    }

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversationId,
          visitor_id: visitorId,
          page_context: pageContext || 'homepage',
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content:
            "I'm having trouble connecting right now. Please try again in a moment, or reach out to us at hello@myafterlife.in.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isExpanded, apiUrl, conversationId, visitorId, pageContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    'What is Afterlife?',
    'How does the Digital Vault work?',
    'What does it cost?',
    'Is my data safe?',
  ];

  return (
    <div ref={containerRef} className="inline-chat-container">
      {/* Heading — only show when not expanded */}
      {!isExpanded && (
        <div className="inline-chat-hero">
          <h2 className="inline-chat-heading">{heading}</h2>
          <p className="inline-chat-subheading">{subheading}</p>
        </div>
      )}

      {/* Expanded chat messages */}
      {isExpanded && (
        <div className="inline-chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`inline-msg ${
                msg.role === 'user' ? 'inline-msg-user' : 'inline-msg-assistant'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="inline-msg-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
              )}
              <div
                className={`inline-msg-bubble ${
                  msg.role === 'user' ? 'inline-msg-bubble-user' : 'inline-msg-bubble-assistant'
                }`}
                dangerouslySetInnerHTML={{
                  __html: formatContent(msg.content),
                }}
              />
            </div>
          ))}
          {isLoading && (
            <div className="inline-msg inline-msg-assistant">
              <div className="inline-msg-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="inline-msg-bubble inline-msg-bubble-assistant">
                <div className="inline-typing">
                  <div className="inline-typing-dot" />
                  <div className="inline-typing-dot" />
                  <div className="inline-typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar */}
      <div className={`inline-chat-input-wrapper ${isExpanded ? 'inline-chat-input-expanded' : ''}`}>
        <div className="inline-chat-input-bar">
          <input
            ref={inputRef}
            type="text"
            className="inline-chat-input"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="inline-chat-send"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Suggested questions — only show when not expanded */}
      {!isExpanded && (
        <div className="inline-chat-suggestions">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              className="inline-chat-suggestion"
              onClick={() => {
                // Directly send the suggested question
                setIsExpanded(true);
                const userMessage: Message = {
                  id: `user_${Date.now()}`,
                  role: 'user',
                  content: q,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMessage]);
                setIsLoading(true);
                fetch(apiUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: q,
                    conversation_id: conversationId,
                    visitor_id: visitorId,
                    page_context: pageContext || 'homepage',
                  }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.conversation_id) setConversationId(data.conversation_id);
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `assistant_${Date.now()}`,
                        role: 'assistant' as const,
                        content: data.response,
                        timestamp: new Date(),
                      },
                    ]);
                  })
                  .catch(() => {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `error_${Date.now()}`,
                        role: 'assistant' as const,
                        content: "I'm having trouble connecting. Please try again or reach out at hello@myafterlife.in.",
                        timestamp: new Date(),
                      },
                    ]);
                  })
                  .finally(() => setIsLoading(false));
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Powered by */}
      <div className="inline-chat-footer">
        <span>Powered by Afterlife AI</span>
      </div>
    </div>
  );
}
