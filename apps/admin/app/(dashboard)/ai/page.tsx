'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Skeleton,
  RallyBarChart,
  useToast,
} from '@rally/ui';
import {
  Brain,
  BookOpen,
  MessageSquare,
  Clock,
  Star,
  Zap,
  Settings,
  Upload,
  Database,
  FileText,
  Car,
  DollarSign,
  Swords,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KnowledgeBaseCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  entries: number;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MODEL_CONFIG = {
  model: 'GPT-4 Turbo',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt:
    'You are Rally AI, a helpful dealership assistant. You help sales staff find vehicle information, compare models, answer customer questions about financing, and provide inventory insights. Always be professional and accurate.',
} as const;

const KB_STATS = {
  totalDocuments: 14134,
  lastUpdated: '2026-02-23T18:30:00Z',
  indexSizeMB: 842,
} as const;

const KB_CATEGORIES: KnowledgeBaseCategory[] = [
  {
    id: 'vehicle-specs',
    name: 'Vehicle Specifications',
    icon: Car,
    entries: 12450,
    lastUpdated: '2026-02-23T18:30:00Z',
  },
  {
    id: 'sales-scripts',
    name: 'Sales Scripts',
    icon: FileText,
    entries: 234,
    lastUpdated: '2026-02-22T10:15:00Z',
  },
  {
    id: 'policies',
    name: 'Dealership Policies',
    icon: BookOpen,
    entries: 89,
    lastUpdated: '2026-02-20T14:00:00Z',
  },
  {
    id: 'financing',
    name: 'Financing Options',
    icon: DollarSign,
    entries: 156,
    lastUpdated: '2026-02-21T09:45:00Z',
  },
  {
    id: 'competitors',
    name: 'Competitor Comparisons',
    icon: Swords,
    entries: 1205,
    lastUpdated: '2026-02-23T12:00:00Z',
  },
] as const;

const TOKEN_USAGE_DATA = [
  { day: 'Mon', tokens: 18200 },
  { day: 'Tue', tokens: 22400 },
  { day: 'Wed', tokens: 19800 },
  { day: 'Thu', tokens: 25100 },
  { day: 'Fri', tokens: 31200 },
  { day: 'Sat', tokens: 12600 },
  { day: 'Sun', tokens: 9400 },
] as const;

const USAGE_METRICS = {
  totalConversations: 1234,
  avgResponseTime: 2.3,
  userSatisfaction: 4.2,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AIManagementPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const chartBars = useMemo(
    () => [{ dataKey: 'tokens', color: 'var(--rally-gold)', label: 'Tokens Used' }],
    [],
  );

  const chartData = useMemo(
    () => TOKEN_USAGE_DATA.map((d) => ({ day: d.day, tokens: d.tokens })),
    [],
  );

  const temperaturePercent = useMemo(
    () => Math.round((MODEL_CONFIG.temperature / 2) * 100),
    [],
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="text" className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton variant="card" className="h-64" />
          <Skeleton variant="card" className="h-64" />
        </div>
        <Skeleton variant="card" className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          AI & Knowledge Base
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Model configuration, knowledge base management, and usage analytics
        </p>
      </div>

      {/* ── Model Config + KB Stats ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Config Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Model Configuration
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Model */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Current Model</span>
              <Badge variant="gold">{MODEL_CONFIG.model}</Badge>
            </div>

            {/* Temperature */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Temperature</span>
                <span className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
                  {MODEL_CONFIG.temperature}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-overlay">
                <div
                  className="h-2 rounded-full bg-rally-gold transition-all"
                  style={{ width: `${temperaturePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-text-tertiary">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Max Tokens</span>
              <span className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
                {formatNumber(MODEL_CONFIG.maxTokens)}
              </span>
            </div>

            {/* System Prompt Preview */}
            <div className="space-y-1.5">
              <span className="text-sm text-text-secondary">System Prompt</span>
              <p className="text-xs text-text-tertiary bg-surface-overlay rounded-rally p-3 line-clamp-3 leading-relaxed">
                {MODEL_CONFIG.systemPrompt}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast({
                  type: 'info',
                  title: 'Coming Soon',
                  description: 'Model config editing will be available in the next release.',
                })
              }
            >
              <Settings className="h-3.5 w-3.5" />
              Edit Config
            </Button>
          </CardFooter>
        </Card>

        {/* Knowledge Base Stats Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Knowledge Base
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {formatNumber(KB_STATS.totalDocuments)}
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
                  Documents
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {KB_STATS.indexSizeMB}
                  <span className="text-sm text-text-secondary ml-0.5">MB</span>
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
                  Index Size
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary mt-1">
                  {formatDate(KB_STATS.lastUpdated)}
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
                  Last Updated
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() =>
                toast({
                  type: 'info',
                  title: 'Coming Soon',
                  description: 'Bulk upload will be available in the next release.',
                })
              }
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Documents
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Knowledge Base Categories ──────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          Knowledge Base Categories
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {KB_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.id} variant="interactive">
                <CardContent className="flex items-start gap-3">
                  <div className="shrink-0 rounded-rally bg-rally-goldMuted p-2">
                    <Icon className="h-4 w-4 text-rally-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {category.name}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5 font-[family-name:var(--font-geist-mono)]">
                      {formatNumber(category.entries)} entries
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-1">
                      Updated {formatDate(category.lastUpdated)}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toast({
                        type: 'info',
                        title: category.name,
                        description: `Managing ${formatNumber(category.entries)} entries.`,
                      })
                    }
                  >
                    Manage
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Usage Metrics ──────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          Usage Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
                <MessageSquare className="h-4 w-4 text-rally-gold" />
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {formatNumber(USAGE_METRICS.totalConversations)}
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  Conversations This Month
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
                <Clock className="h-4 w-4 text-status-info" />
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {USAGE_METRICS.avgResponseTime}
                  <span className="text-sm text-text-secondary ml-0.5">s</span>
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  Avg Response Time
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
                <Star className="h-4 w-4 text-status-warning" />
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {USAGE_METRICS.userSatisfaction}
                  <span className="text-sm text-text-secondary ml-0.5">/5</span>
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  User Satisfaction
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Token Usage Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Token Usage — Last 7 Days
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <RallyBarChart
              data={chartData}
              bars={chartBars}
              xAxisKey="day"
              height={260}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
