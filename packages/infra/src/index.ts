// @rally/infra — Cloudflare DNS + Plesk vhost automation for tenant provisioning

export {
  createDnsRecord,
  deleteDnsRecord,
  updateDnsRecord,
  listDnsRecords,
  dnsRecordExists,
  getDnsRecord,
} from './cloudflare';
export type { DnsRecord, UpdateDnsRecordInput } from './cloudflare';

export {
  createSubdomain,
  deleteSubdomain,
  subdomainExists,
  requestSslCert,
} from './plesk';

export {
  provisionTenant,
  deprovisionTenant,
  slugSchema,
  RESERVED_SLUGS,
} from './provision';
export type {
  ProvisioningStep,
  ProvisionResult,
} from './provision';

// Stripe — billing integration for tenant subscriptions
export {
  getStripe,
  isStripeTestMode,
  createStripeCustomer,
  deleteStripeCustomer,
  getLatestSubscription,
  listPaidInvoices,
  listRecentInvoices,
  listAllPaidInvoicesSince,
  getDefaultPaymentMethod,
  createBillingPortalSession,
} from './stripe';
export type {
  CreateStripeCustomerInput,
  SubscriptionSummary,
  InvoiceSummary,
  PaymentMethodSummary,
} from './stripe';
