// @rally/infra — Cloudflare DNS + Plesk vhost automation for tenant provisioning

export {
  createDnsRecord,
  deleteDnsRecord,
  listDnsRecords,
  dnsRecordExists,
  getDnsRecord,
} from './cloudflare';
export type { DnsRecord } from './cloudflare';

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
