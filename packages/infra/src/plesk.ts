// Plesk REST API integration for subdomain vhost management
// Uses env vars: PLESK_API_URL, PLESK_API_KEY

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARENT_DOMAIN = 'rally.vin' as const;
const PORTAL_PORT = 3004 as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(): { apiUrl: string; apiKey: string } {
  const apiUrl = process.env.PLESK_API_URL;
  const apiKey = process.env.PLESK_API_KEY;

  if (!apiUrl) {
    throw new Error('[Plesk] Missing PLESK_API_URL env var');
  }
  if (!apiKey) {
    throw new Error('[Plesk] Missing PLESK_API_KEY env var');
  }

  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey };
}

function headers(apiKey: string): HeadersInit {
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

interface PleskCliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a Plesk CLI command via the REST API.
 * This is the most reliable way to manage subdomains — the CLI gateway
 * provides access to the full `subdomain` utility.
 */
async function pleskCli(
  apiUrl: string,
  apiKey: string,
  params: string[],
): Promise<PleskCliResult> {
  const response = await fetch(`${apiUrl}/api/v2/cli/plesk/call`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ params }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[Plesk] CLI call failed (HTTP ${response.status}): ${body}`,
    );
  }

  const result = (await response.json()) as PleskCliResult;

  if (result.code !== 0) {
    throw new Error(
      `[Plesk] CLI command exited with code ${result.code}: ${result.stderr || result.stdout}`,
    );
  }

  return result;
}

/**
 * Generic fetch wrapper for the Plesk REST API (non-CLI endpoints).
 */
async function pleskFetch<T>(
  apiUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...headers(apiKey),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[Plesk] API error (HTTP ${response.status}) on ${path}: ${body}`,
    );
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a subdomain with a reverse proxy to the portal app (port 3004).
 *
 * Steps:
 * 1. Create the subdomain via CLI (`subdomain --create`)
 * 2. Configure nginx reverse proxy via additional nginx directives
 */
export async function createSubdomain(slug: string): Promise<void> {
  const { apiUrl, apiKey } = getEnv();
  const fqdn = `${slug}.${PARENT_DOMAIN}`;

  // Step 1: Create the subdomain under the parent domain
  await pleskCli(apiUrl, apiKey, [
    'bin/subdomain',
    '--create',
    fqdn,
    '-parent', PARENT_DOMAIN,
    '-www-root', `/var/www/vhosts/${PARENT_DOMAIN}/${slug}`,
  ]);

  // Step 2: Set up nginx reverse proxy to the portal app.
  // We use the site CLI to inject additional nginx directives that
  // proxy all traffic to the portal Next.js app on 127.0.0.1:3004.
  const nginxDirectives = [
    `location / {`,
    `  proxy_pass http://127.0.0.1:${PORTAL_PORT};`,
    `  proxy_http_version 1.1;`,
    `  proxy_set_header Upgrade $http_upgrade;`,
    `  proxy_set_header Connection 'upgrade';`,
    `  proxy_set_header Host $host;`,
    `  proxy_set_header X-Real-IP $remote_addr;`,
    `  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
    `  proxy_set_header X-Forwarded-Proto $scheme;`,
    `  proxy_cache_bypass $http_upgrade;`,
    `}`,
  ].join('\n');

  await pleskCli(apiUrl, apiKey, [
    'bin/site',
    '--update', fqdn,
    '-nginx-additional-directives', nginxDirectives,
  ]);
}

/**
 * Delete a subdomain (for rollback or deprovisioning).
 */
export async function deleteSubdomain(slug: string): Promise<void> {
  const { apiUrl, apiKey } = getEnv();
  const fqdn = `${slug}.${PARENT_DOMAIN}`;

  await pleskCli(apiUrl, apiKey, [
    'bin/subdomain',
    '--remove',
    fqdn,
  ]);
}

/**
 * Check if a subdomain exists in Plesk.
 */
export async function subdomainExists(slug: string): Promise<boolean> {
  const { apiUrl, apiKey } = getEnv();
  const fqdn = `${slug}.${PARENT_DOMAIN}`;

  try {
    const result = await pleskCli(apiUrl, apiKey, [
      'bin/subdomain',
      '--info',
      fqdn,
    ]);
    // If the command succeeds, the subdomain exists
    return result.code === 0;
  } catch {
    // Command fails if subdomain doesn't exist
    return false;
  }
}

/**
 * Request a Let's Encrypt certificate for a subdomain.
 * Uses the Plesk Let's Encrypt extension CLI.
 */
export async function requestSslCert(slug: string): Promise<void> {
  const { apiUrl, apiKey } = getEnv();
  const fqdn = `${slug}.${PARENT_DOMAIN}`;

  await pleskCli(apiUrl, apiKey, [
    'bin/extension',
    '--exec', 'letsencrypt',
    '--',
    'cli.php',
    '-d', fqdn,
    '-m', 'admin@rally.vin',
  ]);
}
