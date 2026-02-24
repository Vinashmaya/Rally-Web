'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
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
// Mock conversation
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

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

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

    // TODO: Send message to AI backend (OpenAI/Anthropic API via server route)
    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'ai',
        content:
          "That's a great question! I'm currently running with mock responses. When connected to the Rally AI backend, I'll be able to pull real inventory data, market comparisons, and financing calculations to help you close more deals.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 2000);
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInputValue(prompt);
    // TODO: Auto-send suggested prompts
    toast({
      type: 'info',
      title: 'Suggested prompt selected',
      description: 'Press send or customize the prompt before sending.',
    });
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
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--rally-gold)]/30 hover:text-[var(--rally-gold)] cursor-pointer"
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
