'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { authFetch } from '@rally/firebase';
import {
  Sparkles,
  Send,
  User,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Skeleton,
} from '@rally/ui';
import { useToast } from '@rally/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageRole = 'system' | 'user' | 'ai';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Initial conversation
// ---------------------------------------------------------------------------

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'ai',
    content:
      "I'm Rally AI, your sales assistant. Ask me about vehicles, financing, competitor comparisons, or sales techniques.",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 'msg-2',
    role: 'user',
    content:
      "What's the best way to pitch the 2024 Wrangler Rubicon to an outdoor enthusiast?",
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
  },
  {
    id: 'msg-3',
    role: 'ai',
    content:
      "Great question! For outdoor enthusiasts, focus on three key selling points:\n\n1. **Trail Rated Badge** \u2014 Rubicon is the only Wrangler that comes factory-built for serious off-roading with locking front and rear differentials, disconnectable sway bar, and 33\" mud-terrain tires.\n\n2. **Removable Doors & Top** \u2014 Perfect for experiencing nature. The Sky One-Touch power top gives open-air freedom at the push of a button.\n\n3. **Dana 44 Axles** \u2014 Heavy-duty axles mean confidence on any terrain. Pair this with the 4:1 low-range crawl ratio and you have a vehicle that's genuinely trail-capable out of the box.\n\nTip: Ask the customer about their specific outdoor activities. If they camp, highlight the Jeep tent accessory. If they kayak or bike, talk about the Mopar rack system.",
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: 'msg-4',
    role: 'user',
    content: "What's our best price on stock R1234?",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: 'msg-5',
    role: 'ai',
    content:
      "STK# R1234 is a 2024 Jeep Wrangler Rubicon listed at $52,995. Based on market data, competitive pricing in the Nashville area ranges from $50,500 to $54,200. Your vehicle has the cold weather package which adds value.\n\nCurrent incentives:\n\u2022 $1,500 Stellantis Customer Cash\n\u2022 2.9% APR for 60 months (through Chrysler Capital)\n\u2022 Conquest bonus: $500 for competitive trade-ins\n\nRecommended presentation price: **$51,495** after manufacturer incentives, leaving room for negotiation while staying competitive in market.",
    timestamp: new Date(Date.now() - 1 * 60 * 1000),
  },
] as const;

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  'Compare vehicles',
  'Financing options',
  'Sales tips',
  'Customer objections',
] as const;

// ---------------------------------------------------------------------------
// Chat message bubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-[var(--rally-gold)] text-[var(--surface-base)]'
            : 'bg-[var(--surface-overlay)] text-[var(--rally-gold)]'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-[var(--radius-rally-lg)] px-4 py-3 ${
          isUser
            ? 'bg-[var(--rally-gold)] text-[var(--surface-base)]'
            : 'bg-[var(--surface-raised)] text-[var(--text-primary)]'
        }`}
      >
        {/* Render content with basic markdown-like formatting */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content.split('\n').map((line, lineIdx) => {
            // Bold text
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <span key={lineIdx}>
                {lineIdx > 0 && <br />}
                {parts.map((part, partIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <strong key={partIdx} className="font-semibold">
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  return <span key={partIdx}>{part}</span>;
                })}
              </span>
            );
          })}
        </div>
        <p
          className={`mt-1 text-[10px] ${
            isUser ? 'text-[var(--surface-base)]/60' : 'text-[var(--text-tertiary)]'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function AISkeleton() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center gap-3">
        <Skeleton variant="text" className="h-8 w-32" />
        <Skeleton variant="text" className="h-6 w-12" />
      </div>
      <Skeleton variant="card" className="flex-1 min-h-[400px]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AIPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([...INITIAL_MESSAGES]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const aiMessageId = `msg-ai-${Date.now()}`;

    // Capture conversation history BEFORE we mutate state.
    // Anthropic requires alternating user/assistant turns starting with user.
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'ai')
      .map((m) => ({
        role: m.role === 'ai' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Seed an empty AI message we can append delta text into
    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        role: 'ai',
        content: '',
        timestamp: new Date(),
      },
    ]);

    try {
      const res = await authFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: trimmed }],
        }),
      });

      if (!res.ok || !res.body) {
        // Try to parse error JSON if present
        let errMsg = `Server error: ${res.status}`;
        try {
          const errJson = await res.json() as { error?: unknown; code?: string };
          if (typeof errJson.error === 'string') errMsg = errJson.error;
        } catch {
          // body wasn't JSON
        }
        throw new Error(errMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedText = '';
      let streamError: string | null = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;

        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;

          try {
            const frame = JSON.parse(line) as
              | { type: 'delta'; text: string }
              | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }
              | { type: 'error'; message: string };

            if (frame.type === 'delta') {
              receivedText += frame.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMessageId ? { ...m, content: receivedText } : m,
                ),
              );
            } else if (frame.type === 'error') {
              streamError = frame.message;
            }
            // 'done' frame currently ignored on the client
          } catch {
            // Ignore malformed lines — keep the stream going
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }

      // If the stream produced no text at all, treat that as an error
      if (!receivedText) {
        throw new Error('AI returned an empty response.');
      }
    } catch (err) {
      toast({
        type: 'error',
        title: 'AI response failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });

      // Replace the in-flight AI bubble with a fallback message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMessageId
            ? {
                ...m,
                content:
                  "I wasn't able to process that request. Please try again, or contact support if the issue persists.",
              }
            : m,
        ),
      );
    } finally {
      setIsTyping(false);
    }
  }, [messages, toast]);

  const handleSend = () => {
    sendMessage(inputValue);
  };

  const handleSuggestedPrompt = (prompt: string) => {
    // Auto-send the suggested prompt immediately
    sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.12)-theme(spacing.6))]">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Rally AI</h1>
        <Badge variant="warning" size="sm">Beta</Badge>
      </div>

      {/* Chat container */}
      <Card className="flex-1 flex flex-col min-h-0">
        {/* Messages area */}
        <CardContent className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-overlay)] text-[var(--rally-gold)]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="rounded-[var(--radius-rally-lg)] bg-[var(--surface-raised)] px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </CardContent>

        {/* Suggested prompts */}
        <div className="shrink-0 px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSuggestedPrompt(prompt)}
                disabled={isTyping}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--rally-gold)]/30 hover:text-[var(--rally-gold)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="h-3 w-3" />
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-[var(--surface-border)] p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Ask Rally AI..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Disclaimer */}
          <div className="flex items-center gap-1.5 mt-2">
            <AlertCircle className="h-3 w-3 text-[var(--text-disabled)] shrink-0" />
            <p className="text-[10px] text-[var(--text-disabled)]">
              AI responses are generated. Verify pricing before sharing with customers.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
