// AI chat proxy — Anthropic streaming over NDJSON.
//
// Streaming protocol: newline-delimited JSON (one object per line).
// Frame shapes:
//   { "type": "delta", "text": "..." }                           // token chunk
//   { "type": "done", "usage": { "inputTokens": n, "outputTokens": n } }
//   { "type": "error", "message": "..." }                        // terminal failure
//
// Body shape:
//   { messages: { role: 'user' | 'assistant', content: string }[],
//     context?: { vin?: string, customerId?: string } }

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  adminDb,
  FieldValue,
  requireAuth,
  isVerifiedSession,
} from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Zod request schema
// ---------------------------------------------------------------------------

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(50),
  context: z
    .object({
      vin: z.string().optional(),
      customerId: z.string().optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6' as const;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;

const BASE_SYSTEM_PROMPT = `You are Rally AI, a sales assistant for a Chrysler-Dodge-Jeep-Ram dealership.

You help sales staff:
- Answer customer questions about vehicles in inventory
- Compare trims, options, and competitive vehicles
- Quote financing scenarios honestly (never fabricate APR or rebates)
- Coach on objection handling

Rules:
- Never invent a price, payment, VIN, or stock number. If you do not know, say so.
- Be concise and conversational. Markdown bold for key figures.
- When a Vehicle Knowledge block is provided, treat it as authoritative.`;

// ---------------------------------------------------------------------------
// Vehicle knowledge lookup
// ---------------------------------------------------------------------------

interface VehicleRecord {
  vin?: string;
  stock?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  msrp?: number;
  price?: number;
  savings?: number;
  monthlyPayment?: number;
  loanTermMonths?: number;
  apr?: number;
  downPayment?: number;
  exterior?: string;
  interior?: string;
  bodyType?: string;
  driveType?: string;
  engine?: string;
  transmission?: string;
  mileage?: number | null;
  condition?: string;
  conditionalOffers?: { name: string; amount: number }[];
  windowStickerData?: { options?: { name: string; price: number }[] } | null;
  [key: string]: unknown;
}

interface VehicleDetailsFile {
  vehicles: VehicleRecord[];
}

let _vehicleCache: VehicleDetailsFile | null = null;

async function loadVehicleDetails(): Promise<VehicleDetailsFile | null> {
  if (_vehicleCache) return _vehicleCache;
  try {
    // Repo root: cwd in dev is the staff app, but in production turbo build runs from repo root.
    // Try a few candidate paths.
    const candidates = [
      path.join(process.cwd(), 'vehicle-details.json'),
      path.join(process.cwd(), '..', '..', 'vehicle-details.json'),
      path.join(process.cwd(), '..', 'vehicle-details.json'),
    ];
    for (const candidate of candidates) {
      try {
        const raw = await fs.readFile(candidate, 'utf8');
        _vehicleCache = JSON.parse(raw) as VehicleDetailsFile;
        return _vehicleCache;
      } catch {
        // try next path
      }
    }
    return null;
  } catch (err) {
    console.error('[ai/chat] Failed to load vehicle-details.json:', err);
    return null;
  }
}

function pickVehicleSlice(v: VehicleRecord): Record<string, unknown> {
  // Project to a compact, prompt-safe shape — exclude photos, urls, raw scrape data.
  return {
    vin: v.vin,
    stock: v.stock,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    msrp: v.msrp,
    price: v.price,
    savings: v.savings,
    monthlyPayment: v.monthlyPayment,
    loanTermMonths: v.loanTermMonths,
    apr: v.apr,
    downPayment: v.downPayment,
    exterior: v.exterior,
    interior: v.interior,
    bodyType: v.bodyType,
    driveType: v.driveType,
    engine: v.engine,
    transmission: v.transmission,
    mileage: v.mileage ?? null,
    condition: v.condition,
    conditionalOffers: v.conditionalOffers,
    factoryOptions: v.windowStickerData?.options?.slice(0, 12) ?? [],
  };
}

async function buildSystemPrompt(vin?: string): Promise<{
  prompt: string;
  hadVinContext: boolean;
}> {
  if (!vin) return { prompt: BASE_SYSTEM_PROMPT, hadVinContext: false };

  const file = await loadVehicleDetails();
  if (!file) return { prompt: BASE_SYSTEM_PROMPT, hadVinContext: false };

  const match = file.vehicles.find(
    (v) => v.vin?.toUpperCase() === vin.toUpperCase() || v.stock?.toUpperCase() === vin.toUpperCase(),
  );
  if (!match) return { prompt: BASE_SYSTEM_PROMPT, hadVinContext: false };

  const slice = pickVehicleSlice(match);
  const block = `\n\n--- Vehicle Knowledge (authoritative for this conversation) ---\n${JSON.stringify(slice, null, 2)}\n--- End Vehicle Knowledge ---`;
  return { prompt: BASE_SYSTEM_PROMPT + block, hadVinContext: true };
}

// ---------------------------------------------------------------------------
// Usage logging
// ---------------------------------------------------------------------------

interface LogUsageArgs {
  uid: string;
  dealershipId: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  hadVinContext: boolean;
  errored?: boolean;
}

async function logUsage(args: LogUsageArgs): Promise<void> {
  try {
    await adminDb.collection('aiUsage').add({
      uid: args.uid,
      dealershipId: args.dealershipId,
      model: MODEL,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      durationMs: args.durationMs,
      hadVinContext: args.hadVinContext,
      errored: args.errored ?? false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[ai/chat] Failed to log aiUsage:', err);
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!isVerifiedSession(auth)) return auth;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'AI service not configured. Set ANTHROPIC_API_KEY.',
        code: 'AI_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  // Parse + validate body
  let parsed: z.infer<typeof ChatRequestSchema>;
  try {
    const body = await request.json();
    parsed = ChatRequestSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof z.ZodError ? err.flatten() : 'Invalid request body',
        code: 'INVALID_REQUEST',
      },
      { status: 400 },
    );
  }

  const { messages, context } = parsed;

  const { prompt: systemPrompt, hadVinContext } = await buildSystemPrompt(context?.vin);

  const anthropic = new Anthropic({ apiKey });

  const startedAt = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeFrame = (frame: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(frame) + '\n'));
      };

      let inputTokens = 0;
      let outputTokens = 0;
      let errored = false;

      try {
        const sdkStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: DEFAULT_MAX_TOKENS,
          temperature: DEFAULT_TEMPERATURE,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of sdkStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            writeFrame({ type: 'delta', text: event.delta.text });
          } else if (event.type === 'message_delta' && event.usage) {
            // Final token tallies arrive on message_delta
            outputTokens = event.usage.output_tokens ?? outputTokens;
          } else if (event.type === 'message_start' && event.message.usage) {
            inputTokens = event.message.usage.input_tokens ?? 0;
            outputTokens = event.message.usage.output_tokens ?? 0;
          }
        }

        const finalMessage = await sdkStream.finalMessage();
        inputTokens = finalMessage.usage?.input_tokens ?? inputTokens;
        outputTokens = finalMessage.usage?.output_tokens ?? outputTokens;

        writeFrame({
          type: 'done',
          usage: { inputTokens, outputTokens },
        });
      } catch (err) {
        errored = true;
        const message =
          err instanceof Anthropic.APIError
            ? `Anthropic ${err.status ?? ''}: ${err.message}`.trim()
            : err instanceof Error
              ? err.message
              : 'Unknown error';
        console.error('[ai/chat] stream error:', message);
        writeFrame({ type: 'error', message });
      } finally {
        controller.close();
        // Log AFTER stream closes — fire and forget
        void logUsage({
          uid: auth.uid,
          dealershipId: auth.dealershipId,
          inputTokens,
          outputTokens,
          durationMs: Date.now() - startedAt,
          hadVinContext,
          errored,
        });
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
