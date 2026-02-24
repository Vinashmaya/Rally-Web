'use client';

import { useState } from 'react';
import {
  Languages,
  Phone,
  Globe,
  MessageSquare,
  Bell,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Skeleton,
} from '@rally/ui';
import { useToast } from '@rally/ui';

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

interface SupportedLanguage {
  name: string;
  nativeName: string;
  code: string;
}

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { name: 'English', nativeName: 'English', code: 'en' },
  { name: 'Spanish', nativeName: 'Espa\u00f1ol', code: 'es' },
  { name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', code: 'ar' },
  { name: 'Mandarin', nativeName: '\u4e2d\u6587', code: 'zh' },
  { name: 'Vietnamese', nativeName: 'Ti\u1ebfng Vi\u1ec7t', code: 'vi' },
  { name: 'Korean', nativeName: '\ud55c\uad6d\uc5b4', code: 'ko' },
  { name: 'Hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940', code: 'hi' },
  { name: 'French', nativeName: 'Fran\u00e7ais', code: 'fr' },
] as const;

// ---------------------------------------------------------------------------
// How-it-works steps
// ---------------------------------------------------------------------------

interface StepInfo {
  title: string;
  description: string;
  icon: React.ElementType;
  stepNumber: number;
}

const STEPS: StepInfo[] = [
  {
    title: 'Start a call',
    description: 'Make or receive a phone call normally through your phone.',
    icon: Phone,
    stepNumber: 1,
  },
  {
    title: 'Tap Translate',
    description: 'Open Rally and tap the translate button to begin real-time translation.',
    icon: Globe,
    stepNumber: 2,
  },
  {
    title: 'Speak naturally',
    description: 'Both parties hear the conversation in their preferred language in real-time.',
    icon: MessageSquare,
    stepNumber: 3,
  },
] as const;

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: StepInfo;
}

function StepCard({ step }: StepCardProps) {
  const Icon = step.icon;
  return (
    <Card>
      <CardContent className="flex flex-col items-center text-center gap-3 py-6">
        <div className="relative">
          <div className="rounded-full bg-[var(--rally-gold-muted)] p-4">
            <Icon className="h-6 w-6 text-[var(--rally-gold)]" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--rally-gold)] text-[10px] font-bold text-[var(--surface-base)]">
            {step.stepNumber}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
        <p className="text-xs text-[var(--text-secondary)] max-w-[200px]">{step.description}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TranslateSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="text" className="h-6 w-24" />
      </div>
      <Skeleton variant="card" className="h-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-40" />
        ))}
      </div>
      <Skeleton variant="card" className="h-32" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TranslatePage() {
  const { toast } = useToast();
  const [notifyRequested, setNotifyRequested] = useState(false);

  const handleNotifyMe = () => {
    // TODO: Save notification preference to Firestore user profile
    setNotifyRequested(true);
    toast({
      type: 'success',
      title: 'Notification set',
      description: "We'll notify you when Live Translate is available.",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Live Translate</h1>
        <Badge variant="warning" size="sm">Coming Soon</Badge>
      </div>

      {/* Hero card */}
      <Card>
        <CardContent className="flex flex-col items-center text-center py-12 gap-4">
          <div className="rounded-full bg-[var(--rally-gold-muted)] p-6">
            <Languages className="h-12 w-12 text-[var(--rally-gold)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Real-time call translation powered by AI
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md">
            Translate phone conversations in real-time. Support for 40+ languages.
            Break down language barriers and serve every customer on your lot.
          </p>
          {notifyRequested ? (
            <div className="flex items-center gap-2 rounded-full bg-[var(--status-success)]/15 px-4 py-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
              <span className="text-sm font-medium text-[var(--status-success)]">
                You&apos;ll be notified when available
              </span>
            </div>
          ) : (
            <Button variant="primary" size="lg" onClick={handleNotifyMe}>
              <Bell className="h-4 w-4" />
              Notify Me When Available
            </Button>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          How It Works
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <StepCard key={step.stepNumber} step={step} />
          ))}
        </div>
      </div>

      {/* Arrow connectors between steps (visible on sm+) */}
      <div className="hidden sm:flex justify-center -mt-4 mb-2">
        <div className="flex items-center gap-8 text-[var(--text-disabled)]">
          <ArrowRight className="h-4 w-4" />
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>

      {/* Supported languages */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--rally-gold)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Supported Languages
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <div
                key={lang.code}
                className="flex items-center gap-2 rounded-[var(--radius-rally)] bg-[var(--surface-overlay)] px-3 py-2"
              >
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {lang.name}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {lang.nativeName}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            40+ additional languages available at launch. Powered by the Gemini Live API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
