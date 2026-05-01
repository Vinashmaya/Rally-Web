'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '@rally/firebase';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Skeleton,
  RallyBarChart,
  EmptyState,
  Input,
  useToast,
} from '@rally/ui';
import {
  Brain,
  BookOpen,
  MessageSquare,
  Clock,
  Users,
  Zap,
  Settings,
  Database,
  Car,
  AlertTriangle,
  Save,
  X,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPromptVersion: string;
  knowledgeBaseEnabled: boolean;
}

interface KnowledgeBaseStats {
  totalEntries: number;
  makes: number;
  models: number;
  yearMin: number | null;
  yearMax: number | null;
  lastUpdated: string;
  sourceScrapedAt: string | null;
  fileSizeBytes: number;
}

interface KnowledgeBaseCategory {
  id: string;
  name: string;
  kind: 'bodyType' | 'condition';
  entries: number;
}

interface KnowledgeBaseResponse {
  available: boolean;
  stats: KnowledgeBaseStats | null;
  categories: KnowledgeBaseCategory[];
}

interface UsageMetrics {
  monthQueries: number;
  uniqueUsers: number;
  avgResponseMs: number;
  topDealerships: { dealershipId: string; count: number }[];
}

interface DailyTokenUsage {
  day: string;
  inputTokens: number;
  outputTokens: number;
  tokens: number;
  queries: number;
}

interface UsageResponse {
  knowledgeBase: KnowledgeBaseResponse;
  usageMetrics: UsageMetrics;
  tokenUsageDaily: DailyTokenUsage[];
}

interface ConfigGetResponse {
  success: boolean;
  data?: AIConfig;
  code?: 'CONFIG_NOT_FOUND';
  defaults?: AIConfig;
}

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

function shortDay(isoDay: string): string {
  // isoDay: 'YYYY-MM-DD'
  const d = new Date(`${isoDay}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AIManagementPage() {
  const { toast } = useToast();

  // Config state
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [configMissing, setConfigMissing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [draftConfig, setDraftConfig] = useState<AIConfig | null>(null);

  // Usage + KB state
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  // -------- loaders --------

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await authFetch('/api/admin/ai/config');
      const json = (await res.json()) as ConfigGetResponse;
      if (res.status === 404 && json.code === 'CONFIG_NOT_FOUND') {
        setConfigMissing(true);
        setConfig(null);
      } else if (res.ok && json.success && json.data) {
        setConfig(json.data);
        setConfigMissing(false);
      } else {
        throw new Error('Failed to load AI config');
      }
    } catch (err) {
      toast({
        type: 'error',
        title: 'Config load failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setConfigLoading(false);
    }
  }, [toast]);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const res = await authFetch('/api/admin/ai/usage');
      const json = (await res.json()) as { success: boolean; data?: UsageResponse; error?: string };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setUsage(json.data);
    } catch (err) {
      setUsageError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadUsage();
  }, [loadConfig, loadUsage]);

  // -------- actions --------

  const initializeConfig = useCallback(async () => {
    setConfigSaving(true);
    try {
      const res = await authFetch('/api/admin/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { success: boolean; data?: AIConfig; error?: string };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setConfig(json.data);
      setConfigMissing(false);
      toast({ type: 'success', title: 'AI config initialized' });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Init failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setConfigSaving(false);
    }
  }, [toast]);

  const startEdit = () => {
    if (!config) return;
    setDraftConfig({ ...config });
    setEditingConfig(true);
  };

  const cancelEdit = () => {
    setEditingConfig(false);
    setDraftConfig(null);
  };

  const saveEdit = useCallback(async () => {
    if (!draftConfig) return;
    setConfigSaving(true);
    try {
      const res = await authFetch('/api/admin/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig),
      });
      const json = (await res.json()) as { success: boolean; data?: AIConfig; error?: unknown };
      if (!res.ok || !json.success || !json.data) {
        const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setConfig(json.data);
      setEditingConfig(false);
      setDraftConfig(null);
      toast({ type: 'success', title: 'AI config updated' });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setConfigSaving(false);
    }
  }, [draftConfig, toast]);

  // -------- derived --------

  const chartBars = useMemo(
    () => [{ dataKey: 'tokens', color: 'var(--rally-gold)', label: 'Tokens' }],
    [],
  );

  const chartData = useMemo(() => {
    if (!usage) return [];
    return usage.tokenUsageDaily.map((d) => ({
      day: shortDay(d.day),
      tokens: d.tokens,
    }));
  }, [usage]);

  const temperaturePercent = useMemo(() => {
    const t = editingConfig ? draftConfig?.temperature : config?.temperature;
    if (typeof t !== 'number') return 0;
    return Math.round((t / 2) * 100);
  }, [config, draftConfig, editingConfig]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (configLoading || usageLoading) {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI & Knowledge Base</h1>
          <p className="text-sm text-text-secondary mt-1">
            Anthropic Claude config, dealer-fleet knowledge base, and usage analytics
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { void loadUsage(); void loadConfig(); }}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {usageError && (
        <div className="rounded-rally-lg border border-status-error/30 bg-status-error/10 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-status-error shrink-0" />
          <p className="text-sm text-status-error">Usage analytics failed to load: {usageError}</p>
        </div>
      )}

      {/* Model Config + KB Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Model Configuration
              </p>
            </div>
          </CardHeader>

          {configMissing ? (
            <CardContent>
              <EmptyState
                icon={Brain}
                title="Set up AI config"
                description="No AI configuration exists yet. Initialize it with the recommended Claude Sonnet defaults."
                action={
                  <Button variant="primary" size="sm" onClick={initializeConfig} disabled={configSaving}>
                    {configSaving ? 'Initializing…' : 'Initialize defaults'}
                  </Button>
                }
              />
            </CardContent>
          ) : config ? (
            <>
              <CardContent className="space-y-4">
                {/* Model */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Model</span>
                  {editingConfig ? (
                    <Input
                      value={draftConfig?.model ?? ''}
                      onChange={(e) =>
                        setDraftConfig((d) => (d ? { ...d, model: e.target.value } : d))
                      }
                      className="max-w-[220px]"
                    />
                  ) : (
                    <Badge variant="gold">{config.model}</Badge>
                  )}
                </div>

                {/* Temperature */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Temperature</span>
                    <span className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
                      {(editingConfig ? draftConfig?.temperature : config.temperature)?.toFixed(2)}
                    </span>
                  </div>
                  {editingConfig ? (
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={draftConfig?.temperature ?? 0}
                      onChange={(e) =>
                        setDraftConfig((d) =>
                          d ? { ...d, temperature: Number(e.target.value) } : d,
                        )
                      }
                      className="w-full accent-rally-gold"
                    />
                  ) : (
                    <div className="h-2 w-full rounded-full bg-surface-overlay">
                      <div
                        className="h-2 rounded-full bg-rally-gold transition-all"
                        style={{ width: `${temperaturePercent}%` }}
                      />
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-text-tertiary">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Max Tokens</span>
                  {editingConfig ? (
                    <Input
                      type="number"
                      min={1}
                      max={8192}
                      value={String(draftConfig?.maxTokens ?? 0)}
                      onChange={(e) =>
                        setDraftConfig((d) =>
                          d ? { ...d, maxTokens: Number(e.target.value) } : d,
                        )
                      }
                      className="max-w-[120px]"
                    />
                  ) : (
                    <span className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
                      {formatNumber(config.maxTokens)}
                    </span>
                  )}
                </div>

                {/* Prompt Version */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">System Prompt Version</span>
                  {editingConfig ? (
                    <Input
                      value={draftConfig?.systemPromptVersion ?? ''}
                      onChange={(e) =>
                        setDraftConfig((d) =>
                          d ? { ...d, systemPromptVersion: e.target.value } : d,
                        )
                      }
                      className="max-w-[120px]"
                    />
                  ) : (
                    <Badge variant="default">{config.systemPromptVersion}</Badge>
                  )}
                </div>

                {/* KB Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Knowledge Base</span>
                  {editingConfig ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftConfig?.knowledgeBaseEnabled ?? false}
                        onChange={(e) =>
                          setDraftConfig((d) =>
                            d ? { ...d, knowledgeBaseEnabled: e.target.checked } : d,
                          )
                        }
                        className="accent-rally-gold"
                      />
                      <span className="text-xs text-text-secondary">
                        {draftConfig?.knowledgeBaseEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  ) : (
                    <Badge variant={config.knowledgeBaseEnabled ? 'success' : 'default'}>
                      {config.knowledgeBaseEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-4 gap-2">
                {editingConfig ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveEdit}
                      disabled={configSaving}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {configSaving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={configSaving}>
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={startEdit}>
                    <Settings className="h-3.5 w-3.5" />
                    Edit Config
                  </Button>
                )}
              </CardFooter>
            </>
          ) : null}
        </Card>

        {/* KB Stats */}
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
            {!usage?.knowledgeBase.available || !usage.knowledgeBase.stats ? (
              <EmptyState
                icon={Database}
                title="Knowledge base unavailable"
                description="vehicle-details.json was not found on the server. Run the inventory scrape to populate it."
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                      {formatNumber(usage.knowledgeBase.stats.totalEntries)}
                    </p>
                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
                      Vehicles
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                      {formatNumber(usage.knowledgeBase.stats.makes)}/
                      {formatNumber(usage.knowledgeBase.stats.models)}
                    </p>
                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
                      Makes / Models
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                      {usage.knowledgeBase.stats.yearMin ?? '—'}
                      {usage.knowledgeBase.stats.yearMax &&
                      usage.knowledgeBase.stats.yearMin !== usage.knowledgeBase.stats.yearMax
                        ? `–${usage.knowledgeBase.stats.yearMax}`
                        : ''}
                    </p>
                    <p className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
                      Year Range
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-text-tertiary border-t border-surface-border pt-3">
                  <div>
                    <span className="block text-text-secondary">File Size</span>
                    <span className="text-text-primary font-[family-name:var(--font-geist-mono)]">
                      {formatBytes(usage.knowledgeBase.stats.fileSizeBytes)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-text-secondary">Last Updated</span>
                    <span className="text-text-primary">
                      {formatDate(usage.knowledgeBase.stats.lastUpdated)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="pt-4">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() =>
                toast({
                  type: 'info',
                  title: 'KB import not yet implemented',
                  description:
                    'The vehicle KB is regenerated by the scraper job. Bulk import will land in a future release.',
                })
              }
              // TODO(item-6): wire to a real /api/admin/ai/kb/import endpoint
              // when the importer service is ready. For now this is a placeholder
              // that mirrors the previous behavior without the "Coming Soon" label.
            >
              <BookOpen className="h-3.5 w-3.5" />
              Manage Knowledge Base
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* KB Categories */}
      {usage?.knowledgeBase.available && usage.knowledgeBase.categories.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-3">
            Knowledge Base Categories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {usage.knowledgeBase.categories.map((category) => (
              <Card key={category.id}>
                <CardContent className="flex items-start gap-3">
                  <div className="shrink-0 rounded-rally bg-rally-goldMuted p-2">
                    <Car className="h-4 w-4 text-rally-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{category.name}</p>
                    <p className="text-xs text-text-tertiary mt-0.5 font-[family-name:var(--font-geist-mono)]">
                      {formatNumber(category.entries)} entries
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-1 uppercase tracking-wider">
                      {category.kind === 'bodyType' ? 'Body Type' : 'Condition'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Usage Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">Usage Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
                <MessageSquare className="h-4 w-4 text-rally-gold" />
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {formatNumber(usage?.usageMetrics.monthQueries ?? 0)}
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  Queries This Month
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
                <Users className="h-4 w-4 text-status-info" />
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {formatNumber(usage?.usageMetrics.uniqueUsers ?? 0)}
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  Unique Users (MTD)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
                <Clock className="h-4 w-4 text-status-warning" />
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {((usage?.usageMetrics.avgResponseMs ?? 0) / 1000).toFixed(2)}
                  <span className="text-sm text-text-secondary ml-0.5">s</span>
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  Avg Response Time
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top dealerships */}
        {usage && usage.usageMetrics.topDealerships.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Top Dealerships This Month
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {usage.usageMetrics.topDealerships.map((d) => (
                  <div key={d.dealershipId} className="flex items-center justify-between">
                    <span className="text-sm text-text-primary font-[family-name:var(--font-geist-mono)]">
                      {d.dealershipId}
                    </span>
                    <Badge variant="default">{formatNumber(d.count)} queries</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Token Usage Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Token Usage — Last 14 Days
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <RallyBarChart data={chartData} bars={chartBars} xAxisKey="day" height={260} />
            ) : (
              <EmptyState
                icon={Zap}
                title="No usage yet"
                description="Once staff start using Rally AI, token usage will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
