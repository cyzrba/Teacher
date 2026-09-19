import { http, unwrap } from './http'
import type {
  Certificate,
  CertificateApplication,
  CertificateRule,
  PageQuery,
  PageResult,
} from '@/types'

/* —— 证书规则（P2）：列表 + 新增 —— */
export function fetchCertRules(): Promise<CertificateRule[]> {
  return unwrap<CertificateRule[]>(http.get('/cert-rules'))
}

export function createCertRule(
  payload: Omit<CertificateRule, 'id' | 'positionName' | 'swatch' | 'active'>,
): Promise<CertificateRule> {
  return unwrap<CertificateRule>(http.post('/cert-rules', payload))
}

export type CertRulePayload = Omit<CertificateRule, 'id' | 'positionName' | 'swatch' | 'active'>

export function updateCertRule(id: string, payload: CertRulePayload): Promise<CertificateRule | null> {
  return unwrap<CertificateRule | null>(http.put(`/cert-rules/${id}`, payload))
}

export function deleteCertRule(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(http.delete(`/cert-rules/${id}`))
}

/* —— 证书审核（P2）—— */
export interface CertApplyQuery extends PageQuery {
  status?: string
}

export function fetchApplications(
  query: CertApplyQuery = {},
): Promise<PageResult<CertificateApplication>> {
  return unwrap<PageResult<CertificateApplication>>(http.get('/cert-applications', { params: query }))
}

export function reviewApplication(
  id: string,
  payload: { status: CertificateApplication['status']; rejectReason?: string },
): Promise<CertificateApplication | null> {
  return unwrap<CertificateApplication | null>(http.put(`/cert-applications/${id}`, payload))
}

export function batchApproveApplications(
  ids: string[],
): Promise<{ ok: boolean; count: number }> {
  return unwrap<{ ok: boolean; count: number }>(
    http.post('/cert-applications/batch-approve', { ids }),
  )
}

/* —— 证书管理（P0）—— */
export function fetchCertificates(query: PageQuery = {}): Promise<PageResult<Certificate>> {
  return unwrap<PageResult<Certificate>>(http.get('/certificates', { params: query }))
}

export interface GenerateCertPayload {
  studentName: string
  className: string
  positionId: string
  certNo: string
  issuer: string
}

export function generateCertificate(payload: GenerateCertPayload): Promise<Certificate> {
  return unwrap<Certificate>(http.post('/certificates', payload))
}

export function revokeCertificate(id: string): Promise<Certificate | null> {
  return unwrap<Certificate | null>(http.put(`/certificates/${id}/revoke`))
}

export function reissueCertificate(id: string): Promise<Certificate | null> {
  return unwrap<Certificate | null>(http.put(`/certificates/${id}/reissue`))
}

/* —— 证书台账（P0）—— */
export function fetchLedger(query: PageQuery & { positionId?: string } = {}): Promise<PageResult<Certificate>> {
  return unwrap<PageResult<Certificate>>(http.get('/certificates/ledger', { params: query }))
}
