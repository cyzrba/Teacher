import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  batchApproveApplications,
  createCertRule,
  deleteCertRule,
  fetchApplications,
  fetchCertRules,
  fetchCertificates,
  fetchLedger,
  generateCertificate,
  reissueCertificate,
  reviewApplication,
  revokeCertificate,
  updateCertRule,
} from '@/api/certificates'
import type { CertRulePayload, GenerateCertPayload } from '@/api/certificates'
import { fetchStudents } from '@/api/students'
import type { RosterStudent } from '@/api/students'
import type { Certificate, CertificateApplication, CertificateRule } from '@/types'

export const useCertificateStore = defineStore('certificate', () => {
  const rules = ref<CertificateRule[]>([])
  const applications = ref<CertificateApplication[]>([])
  const certificates = ref<Certificate[]>([])
  const ledger = ref<Certificate[]>([])
  /** 学生名册：证书发放的班级字段与达标校验都取自这里（修复#11 / #12） */
  const roster = ref<RosterStudent[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const [ruleList, appResult, certResult, ledgerResult] = await Promise.all([
        fetchCertRules(),
        fetchApplications({ pageSize: 100 }),
        fetchCertificates({ pageSize: 100 }),
        fetchLedger({ pageSize: 100 }),
      ])
      roster.value = await fetchStudents()
      rules.value = ruleList
      applications.value = appResult.list
      certificates.value = certResult.list
      ledger.value = ledgerResult.list
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function addRule(
    payload: CertRulePayload,
  ): Promise<void> {
    await createCertRule(payload)
    await load(true)
  }

  async function editRule(id: string, payload: CertRulePayload): Promise<void> {
    await updateCertRule(id, payload)
    await load(true)
  }

  async function removeRule(id: string): Promise<void> {
    await deleteCertRule(id)
    await load(true)
  }

  async function review(
    id: string,
    payload: { status: CertificateApplication['status']; rejectReason?: string },
  ): Promise<void> {
    await reviewApplication(id, payload)
    await load(true)
  }

  async function batchApprove(ids: string[]): Promise<void> {
    await batchApproveApplications(ids)
    await load(true)
  }

  /** 生成证书：返回本次实际写入的证书，调用方据此提示编号（修复#10） */
  async function generate(payload: GenerateCertPayload): Promise<Certificate> {
    const created = await generateCertificate(payload)
    await load(true)
    return created
  }

  /** 按姓名取名册记录（修复#11） */
  function findStudent(name: string): RosterStudent | undefined {
    return roster.value.find((item) => item.name === name)
  }

  /** 按岗位取生效中的证书规则（修复#9 / #12） */
  function findRule(positionId: string): CertificateRule | undefined {
    return rules.value.find((item) => item.positionId === positionId && item.active)
  }

  async function revoke(id: string): Promise<void> {
    await revokeCertificate(id)
    await load(true)
  }

  async function reissue(id: string): Promise<void> {
    await reissueCertificate(id)
    await load(true)
  }

  return {
    rules,
    applications,
    certificates,
    ledger,
    roster,
    loading,
    load,
    addRule,
    editRule,
    removeRule,
    review,
    batchApprove,
    generate,
    revoke,
    reissue,
    findStudent,
    findRule,
  }
})
