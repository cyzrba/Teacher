/** 证书规则 / 证书申请 / 证书台账（真实后端） */

import { del, get, patch, post } from './client'
import type { ApiPage } from './client'

export interface CertRuleSkill {
  skill_node_id: number
  node_name: string
  description: string | null
  tree_name: string | null
}

export interface CertRule {
  id: number
  job_id: number
  job_name: string | null
  cert_name: string
  issue_org_name: string | null
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  skill_count: number
  skill_node_ids: number[]
}

export interface CertRuleDetail extends CertRule {
  skills: CertRuleSkill[]
}

export type CertApplyStatus = 'PENDING_INTERVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'

export interface CertApplication {
  id: number
  student_id: number
  student_name: string | null
  student_no: string | null
  certificate_rule_id: number
  job_name: string | null
  cert_name: string | null
  status: CertApplyStatus
  interview_note: string | null
  review_comment: string | null
  student_certificate_id: number | null
  created_at: string
}

export interface IssuedCert {
  id: number
  job_id: number
  job_name: string | null
  cert_name: string
  issue_org_name: string | null
  certificate_no: string
  issue_date: string | null
  status: string
  student_name?: string
  student_no?: string
}

export interface CertRulePayload {
  job_id: number
  cert_name: string
  issue_org_name?: string | null
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
  skill_node_ids: number[]
}

export function fetchCertRules(params: {
  page?: number
  page_size?: number
  keyword?: string
  status?: string
} = {}): Promise<ApiPage<CertRule>> {
  return get<ApiPage<CertRule>>('/cert-rules', { page_size: 100, ...params })
}

export function createCertRule(payload: CertRulePayload): Promise<CertRuleDetail> {
  return post<CertRuleDetail>('/cert-rules', payload)
}

export function updateCertRule(
  id: number,
  payload: Partial<Omit<CertRulePayload, 'job_id'>>,
): Promise<CertRuleDetail> {
  return patch<CertRuleDetail>(`/cert-rules/${id}`, payload)
}

export function deleteCertRule(id: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/cert-rules/${id}`)
}

export function fetchCertApplications(params: {
  page?: number
  page_size?: number
  status?: string
  keyword?: string
} = {}): Promise<ApiPage<CertApplication>> {
  return get<ApiPage<CertApplication>>('/cert-applications', { page_size: 100, ...params })
}

export function reviewCertApplication(
  id: number,
  payload: { status: 'APPROVED' | 'REJECTED'; review_comment?: string },
): Promise<CertApplication> {
  return post<CertApplication>(`/cert-applications/${id}/review`, payload)
}

export function fetchIssuedCertificates(params: {
  page?: number
  page_size?: number
  keyword?: string
} = {}): Promise<ApiPage<IssuedCert>> {
  return get<ApiPage<IssuedCert>>('/certificates', { page_size: 100, ...params })
}
