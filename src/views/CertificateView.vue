<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchJobs, fetchSkillCatalog } from '@/api/backend/catalog'
import {
  createCertRule,
  deleteCertRule,
  fetchCertApplications,
  fetchCertRules,
  fetchIssuedCertificates,
  reviewCertApplication,
  updateCertRule,
} from '@/api/backend/certificates'
import type {
  CertApplyStatus,
  CertApplication,
  CertRule,
  IssuedCert,
} from '@/api/backend/certificates'

type SkillCatalogGroup = { tree: { id: number; tree_name: string }; nodes: { id: number; node_name: string }[] }

const activeTab = ref('rules')

const rulesLoading = ref(false)
const rules = ref<CertRule[]>([])
const applications = ref<CertApplication[]>([])
const certificates = ref<IssuedCert[]>([])

const jobs = ref<{ id: number; job_name: string }[]>([])
const skillCatalog = ref<SkillCatalogGroup[]>([])

const ruleDialogVisible = ref(false)
const ruleSaving = ref(false)
const editingRuleId = ref<number | null>(null)
const ruleForm = ref({
  job_id: null as number | null,
  cert_name: '',
  issue_org_name: '',
  description: '',
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
  skill_node_ids: [] as number[],
})

const applyStatusLabel: Record<CertApplyStatus, string> = {
  PENDING_INTERVIEW: '待 AI 面试',
  UNDER_REVIEW: '待人工审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const certStatusLabel: Record<string, string> = {
  VALID: '有效',
  EXPIRED: '已过期',
  REVOKED: '已作废',
  RESSUED: '已补发',
}

const selectedRuleSkills = computed(() =>
  skillCatalog.value.flatMap((group) => group.nodes),
)

async function loadRules(): Promise<void> {
  rulesLoading.value = true
  try {
    const page = await fetchCertRules({ page_size: 100 })
    rules.value = page.items
  } finally {
    rulesLoading.value = false
  }
}

async function loadApplications(): Promise<void> {
  const page = await fetchCertApplications({ page_size: 100 })
  applications.value = page.items
}

async function loadCertificates(): Promise<void> {
  const page = await fetchIssuedCertificates({ page_size: 100 })
  certificates.value = page.items
}

function openRuleCreate(): void {
  editingRuleId.value = null
  ruleForm.value = {
    job_id: null,
    cert_name: '',
    issue_org_name: '人工智能本科学院',
    description: '',
    status: 'ENABLED',
    skill_node_ids: [],
  }
  ruleDialogVisible.value = true
}

function openRuleEdit(row: CertRule): void {
  editingRuleId.value = row.id
  ruleForm.value = {
    job_id: row.job_id,
    cert_name: row.cert_name,
    issue_org_name: row.issue_org_name ?? '人工智能本科学院',
    description: row.description ?? '',
    status: row.status,
    skill_node_ids: [...row.skill_node_ids],
  }
  ruleDialogVisible.value = true
}

async function saveRule(): Promise<void> {
  if (!ruleForm.value.cert_name.trim()) {
    ElMessage.warning('请填写证书名称')
    return
  }
  if (ruleForm.value.skill_node_ids.length === 0) {
    ElMessage.warning('请至少选择一个所需技能点')
    return
  }
  ruleSaving.value = true
  try {
    if (editingRuleId.value === null) {
      if (ruleForm.value.job_id === null) {
        ElMessage.warning('请选择认证岗位')
        return
      }
      await createCertRule({
        job_id: ruleForm.value.job_id,
        cert_name: ruleForm.value.cert_name.trim(),
        issue_org_name: ruleForm.value.issue_org_name || null,
        description: ruleForm.value.description || null,
        status: ruleForm.value.status,
        skill_node_ids: ruleForm.value.skill_node_ids,
      })
      ElMessage.success('证书规则已创建')
    } else {
      await updateCertRule(editingRuleId.value, {
        cert_name: ruleForm.value.cert_name.trim(),
        issue_org_name: ruleForm.value.issue_org_name || null,
        description: ruleForm.value.description || null,
        status: ruleForm.value.status,
        skill_node_ids: ruleForm.value.skill_node_ids,
      })
      ElMessage.success('证书规则已更新')
    }
    ruleDialogVisible.value = false
    await loadRules()
  } finally {
    ruleSaving.value = false
  }
}

async function removeRule(row: CertRule): Promise<void> {
  await ElMessageBox.confirm(
    `删除「${row.cert_name}」后，该岗位将不再有认证规则。确认删除？`,
    '删除证书规则',
    { type: 'warning' },
  )
  await deleteCertRule(row.id)
  ElMessage.success('证书规则已删除')
  await loadRules()
}

async function approveApp(row: CertApplication): Promise<void> {
  await ElMessageBox.confirm(
    `确认通过「${row.student_name}」的「${row.cert_name}」申请并发放证书？`,
    '证书审核',
    { type: 'info' },
  )
  await reviewCertApplication(row.id, { status: 'APPROVED' })
  ElMessage.success('已通过并发放证书')
  await Promise.all([loadApplications(), loadCertificates()])
}

async function rejectApp(row: CertApplication): Promise<void> {
  const { value } = await ElMessageBox.prompt('请填写驳回原因', '驳回申请', {
    inputType: 'textarea',
    inputValidator: (text) => (text && text.trim() ? true : '驳回原因不能为空'),
  })
  await reviewCertApplication(row.id, { status: 'REJECTED', review_comment: value.trim() })
  ElMessage.success('已驳回')
  await loadApplications()
}

onMounted(async () => {
  await Promise.all([
    loadRules(),
    loadApplications(),
    loadCertificates(),
    (async () => {
      const jobPage = await fetchJobs({ page_size: 200 })
      jobs.value = jobPage.items.map((item) => ({ id: item.id, job_name: item.job_name }))
    })(),
    (async () => {
      skillCatalog.value = await fetchSkillCatalog()
    })(),
  ])
})
</script>

<template>
  <div class="cert-page">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="证书规则" name="rules">
        <div class="toolbar">
          <el-button type="primary" round @click="openRuleCreate">＋ 新建证书规则</el-button>
        </div>
        <el-table v-loading="rulesLoading" :data="rules" class="data-table">
          <el-table-column prop="job_name" label="认证岗位" min-width="160" />
          <el-table-column prop="cert_name" label="证书名称" min-width="200" />
          <el-table-column label="所需技能点" width="120" align="center">
            <template #default="{ row }">{{ row.skill_count }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="light">
                {{ row.status === 'ENABLED' ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRuleEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="removeRule(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="证书审核" name="applications">
        <el-table :data="applications" class="data-table">
          <el-table-column prop="student_name" label="学生" width="120" />
          <el-table-column prop="job_name" label="岗位" min-width="140" />
          <el-table-column prop="cert_name" label="证书" min-width="180" />
          <el-table-column label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag effect="light">{{ applyStatusLabel[row.status as CertApplyStatus] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'UNDER_REVIEW'">
                <el-button link type="success" @click="approveApp(row)">通过</el-button>
                <el-button link type="danger" @click="rejectApp(row)">驳回</el-button>
              </template>
              <span v-else class="muted">--</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="证书台账" name="ledger">
        <el-table :data="certificates" class="data-table">
          <el-table-column prop="student_name" label="学生" width="120" />
          <el-table-column prop="job_name" label="岗位" min-width="140" />
          <el-table-column prop="cert_name" label="证书" min-width="180" />
          <el-table-column prop="certificate_no" label="证书编号" min-width="200" />
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag type="success" effect="light">{{ certStatusLabel[row.status] ?? row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="issue_date" label="发放日期" width="120" />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="ruleDialogVisible"
      :title="editingRuleId ? '编辑证书规则' : '新建证书规则'"
      width="560px"
    >
      <el-form label-width="90px">
        <el-form-item v-if="!editingRuleId" label="认证岗位" required>
          <el-select v-model="ruleForm.job_id" filterable placeholder="选择岗位" class="full">
            <el-option v-for="job in jobs" :key="job.id" :label="job.job_name" :value="job.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书名称" required>
          <el-input v-model="ruleForm.cert_name" placeholder="如：计算机视觉工程师 认证证书" />
        </el-form-item>
        <el-form-item label="发证机构">
          <el-input v-model="ruleForm.issue_org_name" />
        </el-form-item>
        <el-form-item label="证书说明">
          <el-input v-model="ruleForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="所需技能点" required>
          <el-select
            v-model="ruleForm.skill_node_ids"
            multiple
            filterable
            collapse-tags
            placeholder="选择技能点"
            class="full"
          >
            <el-option-group
              v-for="group in skillCatalog"
              :key="group.tree.id"
              :label="group.tree.tree_name"
            >
              <el-option
                v-for="node in group.nodes"
                :key="node.id"
                :label="node.node_name"
                :value="node.id"
              />
            </el-option-group>
          </el-select>
          <div class="muted">共 {{ selectedRuleSkills.length }} 个技能点可选；全部点亮后学生才能申请该证书。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="ruleSaving" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cert-page {
  padding: 4px 4px 24px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.data-table {
  width: 100%;
}

.full {
  width: 100%;
}

.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
