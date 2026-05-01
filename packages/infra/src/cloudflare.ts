// Cloudflare DNS API integration
// Uses env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_EMAIL

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(): { apiKey: string; email: string; zoneId: string } {
  const apiKey = process.env.CLOUDFLARE_API_TOKEN;
  const email = process.env.CLOUDFLARE_EMAIL;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!apiKey) {
    throw new Error('[Cloudflare] Missing CLOUDFLARE_API_TOKEN env var');
  }
  if (!email) {
    throw new Error('[Cloudflare] Missing CLOUDFLARE_EMAIL env var');
  }
  if (!zoneId) {
    throw new Error('[Cloudflare] Missing CLOUDFLARE_ZONE_ID env var');
  }

  return { apiKey, email, zoneId };
}

function baseUrl(zoneId: string): string {
  return `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
}

function headers(apiKey: string, email: string): HeadersInit {
  return {
    'X-Auth-Key': apiKey,
    'X-Auth-Email': email,
    'Content-Type': 'application/json',
  };
}

async function cfFetch<T>(
  url: string,
  apiKey: string,
  email: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers(apiKey, email),
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as CloudflareApiResponse<T>;

  if (!body.success) {
    const errorMessages = body.errors
      .map((e) => `[${e.code}] ${e.message}`)
      .join('; ');
    throw new Error(
      `[Cloudflare] API error (HTTP ${response.status}): ${errorMessages}`,
    );
  }

  return body.result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an A record for a tenant subdomain.
 * Always proxied (orange cloud) with TTL auto.
 */
export async function createDnsRecord(
  name: string,
  content: string,
): Promise<DnsRecord> {
  const { apiKey, email, zoneId } = getEnv();

  const record = await cfFetch<DnsRecord>(baseUrl(zoneId), apiKey, email, {
    method: 'POST',
    body: JSON.stringify({
      type: 'A',
      name,
      content,
      proxied: true,
      ttl: 1, // auto
    }),
  });

  return record;
}

/**
 * Delete a DNS record by ID (for rollback).
 */
export async function deleteDnsRecord(recordId: string): Promise<void> {
  const { apiKey, email, zoneId } = getEnv();

  await cfFetch<{ id: string }>(
    `${baseUrl(zoneId)}/${recordId}`,
    apiKey,
    email,
    { method: 'DELETE' },
  );
}

/**
 * Update a DNS record by ID. Uses Cloudflare's PATCH endpoint so callers
 * can pass only the fields they want to change.
 */
export interface UpdateDnsRecordInput {
  content?: string;
  proxied?: boolean;
  ttl?: number;
}

export async function updateDnsRecord(
  recordId: string,
  input: UpdateDnsRecordInput,
): Promise<DnsRecord> {
  const { apiKey, email, zoneId } = getEnv();

  const body: Record<string, unknown> = {};
  if (input.content !== undefined) body.content = input.content;
  if (input.proxied !== undefined) body.proxied = input.proxied;
  if (input.ttl !== undefined) body.ttl = input.ttl;

  const record = await cfFetch<DnsRecord>(
    `${baseUrl(zoneId)}/${recordId}`,
    apiKey,
    email,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );

  return record;
}

/**
 * List all DNS records for the zone.
 */
export async function listDnsRecords(): Promise<DnsRecord[]> {
  const { apiKey, email, zoneId } = getEnv();

  // Cloudflare paginates at 100 per page. Iterate until we have them all.
  const allRecords: DnsRecord[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${baseUrl(zoneId)}?page=${page}&per_page=100`;
    const records = await cfFetch<DnsRecord[]>(url, apiKey, email);
    allRecords.push(...records);
    // If we got fewer than 100, we've reached the last page
    hasMore = records.length === 100;
    page++;
  }

  return allRecords;
}

/**
 * Check if a subdomain A record already exists.
 */
export async function dnsRecordExists(name: string): Promise<boolean> {
  const record = await getDnsRecord(name);
  return record !== null;
}

/**
 * Get a specific DNS record by name. Returns null if not found.
 */
export async function getDnsRecord(name: string): Promise<DnsRecord | null> {
  const { apiKey, email, zoneId } = getEnv();

  // Cloudflare expects FQDN in the name filter.
  // If the caller passed a bare subdomain (e.g. "acme"), qualify it.
  const fqdn = name.includes('.') ? name : `${name}.rally.vin`;

  const url = `${baseUrl(zoneId)}?type=A&name=${encodeURIComponent(fqdn)}`;
  const records = await cfFetch<DnsRecord[]>(url, apiKey, email);

  if (records.length === 0) {
    return null;
  }

  return records[0] ?? null;
}
