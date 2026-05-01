// Atomic tenant provisioning flow (Rule 19 — no orphans)
// Orchestrates Cloudflare DNS, Plesk vhosts, and Firestore seeding.

import { z } from 'zod';
import {
  createDnsRecord,
  deleteDnsRecord,
  getDnsRecord,
  dnsRecordExists,
} from './cloudflare';
import type { DnsRecord } from './cloudflare';
import {
  createSubdomain,
  deleteSubdomain,
  requestSslCert,
  subdomainExists,
} from './plesk';
import { createStripeCustomer, deleteStripeCustomer } from './stripe';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESERVED_SLUGS = [
  'app', 'manage', 'admin', 'api', 'www', 'mail', 'ftp',
  'portal', 'cdn', 'assets', 'static', 'dev', 'staging',
  'test', 'demo', 'help', 'support', 'docs', 'blog',
] as const;

const VPS_IP = process.env.VPS_IP ?? '66.179.189.87';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const slugSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Slug must be lowercase alphanumeric with hyphens, cannot start/end with hyphen',
  )
  .refine(
    (slug) => !RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number]),
    'This subdomain is reserved',
  );

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvisioningStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  error?: string;
}

export interface ProvisionResult {
  success: boolean;
  slug: string;
  groupId?: string;
  steps: ProvisioningStep[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSteps(names: string[]): ProvisioningStep[] {
  return names.map((name) => ({ name, status: 'pending' as const }));
}

function markStep(
  steps: ProvisioningStep[],
  name: string,
  status: ProvisioningStep['status'],
  error?: string,
): void {
  const step = steps.find((s) => s.name === name);
  if (step) {
    step.status = status;
    if (error) step.error = error;
  }
}

/**
 * Get Firebase Admin SDK instances.
 * Imports from @rally/firebase when available; falls back to direct
 * firebase-admin import. This avoids a hard dependency on the firebase
 * package being built first while still using it when possible.
 */
async function getFirebaseAdmin() {
  // TODO: When @rally/firebase is fully wired, import from there:
  //   import { adminAuth, adminDb } from '@rally/firebase/admin';
  // For now, use firebase-admin directly.
  const { initializeApp, getApps, getApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
              /\\n/g,
              '\n',
            ),
          }),
        });

  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

// ---------------------------------------------------------------------------
// Provision
// ---------------------------------------------------------------------------

/**
 * Atomic tenant provisioning.
 *
 * Steps execute sequentially. On failure, all previously completed
 * infrastructure steps are rolled back so no orphaned resources remain.
 *
 * Step order:
 * 1. Validate slug (format + not reserved)
 * 2. Check Firestore — slug not already taken
 * 3. Cloudflare → Create A record: {slug}.rally.vin → VPS_IP (proxied)
 * 4. Plesk → Create subdomain vhost → proxy to 127.0.0.1:3004
 * 5. Plesk → Request Let's Encrypt cert
 * 6. Firestore → Seed groups/{groupId}/config/subdomain
 * 7. Firebase Auth → Create principal user account
 * 8. Stripe → Create Customer + persist groups/{groupId}/config/billing
 * 9. Firestore → Write to auditLog
 */
export async function provisionTenant(params: {
  slug: string;
  groupName: string;
  principalEmail: string;
  principalName: string;
}): Promise<ProvisionResult> {
  const { slug, groupName, principalEmail, principalName } = params;

  const stepNames = [
    'validate_slug',
    'check_firestore_unique',
    'create_dns_record',
    'create_plesk_subdomain',
    'request_ssl_cert',
    'seed_firestore_group',
    'create_principal_user',
    'create_stripe_customer',
    'write_audit_log',
  ];

  const steps = createSteps(stepNames);
  let dnsRecord: DnsRecord | null = null;
  let pleskCreated = false;
  let groupId: string | undefined;
  let principalUid: string | undefined;
  let stripeCustomerId: string | undefined;

  const result: ProvisionResult = {
    success: false,
    slug,
    steps,
  };

  try {
    // -----------------------------------------------------------------------
    // Step 1: Validate slug
    // -----------------------------------------------------------------------
    markStep(steps, 'validate_slug', 'running');
    const slugResult = slugSchema.safeParse(slug);
    if (!slugResult.success) {
      const errorMsg = slugResult.error.issues.map((i) => i.message).join('; ');
      markStep(steps, 'validate_slug', 'failed', errorMsg);
      result.error = `Slug validation failed: ${errorMsg}`;
      return result;
    }
    markStep(steps, 'validate_slug', 'completed');

    // -----------------------------------------------------------------------
    // Step 2: Check Firestore — slug not already taken
    // -----------------------------------------------------------------------
    markStep(steps, 'check_firestore_unique', 'running');
    const { auth, db } = await getFirebaseAdmin();

    const existingGroups = await db
      .collection('groups')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingGroups.empty) {
      markStep(
        steps,
        'check_firestore_unique',
        'failed',
        `Slug "${slug}" is already claimed by an existing group`,
      );
      result.error = `Slug "${slug}" is already taken`;
      return result;
    }
    markStep(steps, 'check_firestore_unique', 'completed');

    // -----------------------------------------------------------------------
    // Step 3: Cloudflare → Create A record
    // -----------------------------------------------------------------------
    markStep(steps, 'create_dns_record', 'running');
    try {
      // Double-check DNS doesn't already exist (idempotency guard)
      const alreadyExists = await dnsRecordExists(slug);
      if (alreadyExists) {
        throw new Error(
          `DNS record for ${slug}.rally.vin already exists — possible stale record`,
        );
      }

      dnsRecord = await createDnsRecord(`${slug}.rally.vin`, VPS_IP);
      markStep(steps, 'create_dns_record', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'create_dns_record', 'failed', message);
      result.error = `DNS record creation failed: ${message}`;
      // No rollback needed — nothing created yet in this step if it threw
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 4: Plesk → Create subdomain vhost
    // -----------------------------------------------------------------------
    markStep(steps, 'create_plesk_subdomain', 'running');
    try {
      await createSubdomain(slug);
      pleskCreated = true;
      markStep(steps, 'create_plesk_subdomain', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'create_plesk_subdomain', 'failed', message);
      result.error = `Plesk subdomain creation failed: ${message}`;

      // ROLLBACK: Delete DNS record from step 3
      if (dnsRecord) {
        try {
          await deleteDnsRecord(dnsRecord.id);
          markStep(steps, 'create_dns_record', 'rolled_back');
        } catch (rollbackErr) {
          const rbMsg =
            rollbackErr instanceof Error
              ? rollbackErr.message
              : String(rollbackErr);
          result.error += ` | DNS rollback also failed: ${rbMsg}`;
        }
      }
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 5: Plesk → Request Let's Encrypt cert
    // -----------------------------------------------------------------------
    markStep(steps, 'request_ssl_cert', 'running');
    try {
      await requestSslCert(slug);
      markStep(steps, 'request_ssl_cert', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'request_ssl_cert', 'failed', message);
      result.error = `SSL cert request failed: ${message}`;

      // ROLLBACK: Delete vhost AND DNS record
      await rollbackInfra(steps, dnsRecord, pleskCreated, slug, result);
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 6: Firestore → Seed group document
    // -----------------------------------------------------------------------
    markStep(steps, 'seed_firestore_group', 'running');
    try {
      const groupRef = db.collection('groups').doc();
      groupId = groupRef.id;
      result.groupId = groupId;

      const now = new Date().toISOString();

      await groupRef.set({
        slug,
        name: groupName,
        subdomain: `${slug}.rally.vin`,
        status: 'active',
        plan: 'trial',
        createdAt: now,
        updatedAt: now,
      });

      // Seed config subcollection
      await groupRef.collection('config').doc('subdomain').set({
        slug,
        fqdn: `${slug}.rally.vin`,
        vpsIp: VPS_IP,
        portalPort: 3004,
        sslEnabled: true,
        createdAt: now,
      });

      markStep(steps, 'seed_firestore_group', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'seed_firestore_group', 'failed', message);
      result.error = `Firestore group seeding failed: ${message}`;

      // ROLLBACK: Delete vhost AND DNS record
      await rollbackInfra(steps, dnsRecord, pleskCreated, slug, result);
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 7: Firebase Auth → Create principal user account
    // -----------------------------------------------------------------------
    markStep(steps, 'create_principal_user', 'running');
    try {
      const userRecord = await auth.createUser({
        email: principalEmail,
        displayName: principalName,
        emailVerified: false,
      });

      principalUid = userRecord.uid;

      // Set custom claims for role-based access
      await auth.setCustomUserClaims(principalUid, {
        groupId,
        role: 'owner',
      });

      // Write user doc to users/{uid} (read by authStore)
      await db.collection('users').doc(principalUid).set({
        email: principalEmail,
        displayName: principalName,
        role: 'owner',
        dealershipId: groupId,
        createdAt: new Date().toISOString(),
      });

      // Write membership doc to employees/{uid}/memberships/{groupId}
      // (read by useTenantStore and useAllUsers collection group query)
      await db
        .collection('employees')
        .doc(principalUid)
        .collection('memberships')
        .doc(groupId!)
        .set({
          employeeUid: principalUid,
          storeId: groupId,
          groupId: groupId!,
          role: 'owner',
          status: 'active',
          isPrimary: true,
          joinedAt: new Date().toISOString(),
        });

      markStep(steps, 'create_principal_user', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'create_principal_user', 'failed', message);
      result.error = `Principal user creation failed: ${message}`;

      // ROLLBACK: Delete Firestore group, vhost, and DNS record
      if (groupId) {
        try {
          await db.collection('groups').doc(groupId).delete();
        } catch {
          // Best-effort Firestore cleanup
        }
      }
      await rollbackInfra(steps, dnsRecord, pleskCreated, slug, result);
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 8: Stripe → Create Customer + persist on tenant config
    //
    // One Rally tenant maps 1:1 to one Stripe Customer. The customer id is
    // stored at groups/{groupId}/config/billing so the admin + manage billing
    // pages can fetch subscriptions on demand.
    //
    // Subscription state lives in Stripe — Rally does not duplicate it.
    // TODO(milestone-2): ingest webhooks (invoice.paid, customer.subscription.*)
    // for low-latency status updates instead of on-demand reads.
    // -----------------------------------------------------------------------
    markStep(steps, 'create_stripe_customer', 'running');
    try {
      const customer = await createStripeCustomer({
        groupId: groupId!,
        groupName,
        slug,
        email: principalEmail,
      });
      stripeCustomerId = customer.id;

      const now = new Date().toISOString();
      await db
        .collection('groups')
        .doc(groupId!)
        .collection('config')
        .doc('billing')
        .set({
          stripeCustomerId: customer.id,
          stripeMode: customer.livemode ? 'live' : 'test',
          createdAt: now,
          updatedAt: now,
        });

      markStep(steps, 'create_stripe_customer', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'create_stripe_customer', 'failed', message);
      result.error = `Stripe customer creation failed: ${message}`;

      // ROLLBACK: principal user → group → vhost → DNS
      if (principalUid) {
        try {
          await auth.deleteUser(principalUid);
        } catch {
          // Best-effort
        }
        try {
          await db.collection('users').doc(principalUid).delete();
        } catch {
          // Best-effort
        }
        if (groupId) {
          try {
            await db
              .collection('employees')
              .doc(principalUid)
              .collection('memberships')
              .doc(groupId)
              .delete();
          } catch {
            // Best-effort
          }
        }
      }
      if (groupId) {
        try {
          await db.collection('groups').doc(groupId).delete();
        } catch {
          // Best-effort
        }
      }
      await rollbackInfra(steps, dnsRecord, pleskCreated, slug, result);
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 9: Firestore → Write to auditLog
    // -----------------------------------------------------------------------
    markStep(steps, 'write_audit_log', 'running');
    try {
      await db.collection('auditLogs').add({
        action: 'tenant.provisioned',
        groupId,
        slug,
        groupName,
        principalEmail,
        principalUid,
        stripeCustomerId: stripeCustomerId ?? null,
        vpsIp: VPS_IP,
        subdomain: `${slug}.rally.vin`,
        timestamp: new Date().toISOString(),
        actorType: 'system',
      });
      markStep(steps, 'write_audit_log', 'completed');
    } catch (err) {
      // Audit log failure is non-fatal — log but don't roll back the tenant
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'write_audit_log', 'failed', message);
      // Don't set result.error — this is a soft failure
      console.error(
        `[Provision] Audit log write failed for ${slug}: ${message}`,
      );
    }

    // -----------------------------------------------------------------------
    // Success
    // -----------------------------------------------------------------------
    result.success = true;
    return result;
  } catch (err) {
    // Catch-all for unexpected errors
    const message = err instanceof Error ? err.message : String(err);
    result.error = `Unexpected provisioning error: ${message}`;

    // Best-effort rollback — order matches reverse provisioning order
    if (stripeCustomerId) {
      await deleteStripeCustomer(stripeCustomerId);
      markStep(steps, 'create_stripe_customer', 'rolled_back');
    }
    await rollbackInfra(steps, dnsRecord, pleskCreated, slug, result);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Deprovision (soft delete — 30 day recovery window)
// ---------------------------------------------------------------------------

/**
 * Soft-deprovision a tenant. Sets status to 'deprovisioned' with a 30-day
 * recovery window. DNS and vhost remain intact during the recovery period
 * but the portal middleware will block access based on the Firestore status.
 *
 * Full infra teardown happens after the 30-day window (separate cron job).
 */
export async function deprovisionTenant(params: {
  slug: string;
  groupId: string;
  reason: string;
  actorId: string;
}): Promise<ProvisionResult> {
  const { slug, groupId, reason, actorId } = params;

  const stepNames = [
    'validate_group',
    'soft_delete_group',
    'disable_members',
    'write_audit_log',
  ];

  const steps = createSteps(stepNames);

  const result: ProvisionResult = {
    success: false,
    slug,
    groupId,
    steps,
  };

  try {
    const { auth, db } = await getFirebaseAdmin();

    // -----------------------------------------------------------------------
    // Step 1: Validate that the group exists and is active
    // -----------------------------------------------------------------------
    markStep(steps, 'validate_group', 'running');
    const groupDoc = await db.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      markStep(steps, 'validate_group', 'failed', 'Group not found');
      result.error = `Group ${groupId} not found`;
      return result;
    }

    const groupData = groupDoc.data();
    if (groupData?.status === 'deprovisioned') {
      markStep(
        steps,
        'validate_group',
        'failed',
        'Group is already deprovisioned',
      );
      result.error = 'Group is already deprovisioned';
      return result;
    }
    markStep(steps, 'validate_group', 'completed');

    // -----------------------------------------------------------------------
    // Step 2: Soft-delete the group (set status, schedule teardown)
    // -----------------------------------------------------------------------
    markStep(steps, 'soft_delete_group', 'running');
    try {
      const now = new Date().toISOString();
      const recoveryDeadline = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await db.collection('groups').doc(groupId).update({
        status: 'deprovisioned',
        deprovisionedAt: now,
        deprovisionReason: reason,
        deprovisionedBy: actorId,
        recoveryDeadline,
        updatedAt: now,
      });

      markStep(steps, 'soft_delete_group', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'soft_delete_group', 'failed', message);
      result.error = `Failed to soft-delete group: ${message}`;
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 3: Disable all member accounts in Firebase Auth
    // -----------------------------------------------------------------------
    markStep(steps, 'disable_members', 'running');
    try {
      // Query memberships collection group for all members of this group
      const membersSnapshot = await db
        .collectionGroup('memberships')
        .where('groupId', '==', groupId)
        .where('status', '==', 'active')
        .get();

      const disablePromises = membersSnapshot.docs.map(async (memberDoc) => {
        const memberData = memberDoc.data();
        const memberUid = memberData.employeeUid ?? memberData.uid;
        if (memberUid) {
          try {
            await auth.updateUser(memberUid, { disabled: true });
          } catch {
            // User may already be deleted — log and continue
            console.error(
              `[Deprovision] Failed to disable user ${memberUid}`,
            );
          }
        }
      });

      await Promise.all(disablePromises);
      markStep(steps, 'disable_members', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'disable_members', 'failed', message);
      // Non-fatal — continue to audit log
      console.error(
        `[Deprovision] Member disable partially failed for ${slug}: ${message}`,
      );
    }

    // -----------------------------------------------------------------------
    // Step 4: Write audit log
    // -----------------------------------------------------------------------
    markStep(steps, 'write_audit_log', 'running');
    try {
      await db.collection('auditLogs').add({
        action: 'tenant.deprovisioned',
        groupId,
        slug,
        reason,
        actorId,
        actorType: 'user',
        timestamp: new Date().toISOString(),
      });
      markStep(steps, 'write_audit_log', 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markStep(steps, 'write_audit_log', 'failed', message);
      // Non-fatal
      console.error(
        `[Deprovision] Audit log write failed for ${slug}: ${message}`,
      );
    }

    // -----------------------------------------------------------------------
    // Success
    // -----------------------------------------------------------------------
    result.success = true;
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.error = `Unexpected deprovisioning error: ${message}`;
    return result;
  }
}

// ---------------------------------------------------------------------------
// Rollback Helper
// ---------------------------------------------------------------------------

/**
 * Roll back infrastructure resources (Plesk vhost + Cloudflare DNS).
 * Called when a later step fails after infra has been created.
 */
async function rollbackInfra(
  steps: ProvisioningStep[],
  dnsRecord: DnsRecord | null,
  pleskCreated: boolean,
  slug: string,
  result: ProvisionResult,
): Promise<void> {
  // Roll back Plesk subdomain
  if (pleskCreated) {
    try {
      await deleteSubdomain(slug);
      markStep(steps, 'create_plesk_subdomain', 'rolled_back');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.error += ` | Plesk rollback failed: ${message}`;
    }
  }

  // Roll back DNS record
  if (dnsRecord) {
    try {
      await deleteDnsRecord(dnsRecord.id);
      markStep(steps, 'create_dns_record', 'rolled_back');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.error += ` | DNS rollback failed: ${message}`;
    }
  }
}
