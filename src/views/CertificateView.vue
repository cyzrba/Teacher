<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import PanelBlock from '@/components/PanelBlock.vue'
import StatusPill from '@/components/StatusPill.vue'
import ListPagination from '@/components/ListPagination.vue'
import { usePaging } from '@/composables/usePaging'
import { aiCapabilities } from '@/config/ai'
import { platformInfo } from '@/config/nav'
import { useCertificateStore } from '@/stores/certificate'
import { usePositionStore } from '@/stores/position'
import { useSkillStore } from '@/stores/skill'
import { CERT_STATUS_LABEL } from '@/types'
import type {
  Certificate,
  CertificateApplication,
  CertificateRule,
  CertificateStatus,
  CertificateApplyStatus,
} from '@/types'
import {
  certApplyStatusLabel,
  certApplyStatusTone,
  nextCertNo,
} from '@/utils/format'

const route = useRoute()
const router = useRouter()
const store = useCertificateStore()
const positionStore = usePositionStore()
const skill = useSkillStore()

const activeTab = ref<string>(typeof route.query.tab === 'string' ? route.query.tab : 'rules')
watch(activeTab, (value) => {
  void router.replace({ query: { ...route.query, tab: value } })
})

/* 枚举取值包装：el-table 插槽里的 row 是 any，直接索引 Record 会触发 noImplicitAny */
const applyToneOf = (status: CertificateApplyStatus) => certApplyStatusTone[status]
const applyLabelOf = (status: CertificateApplyStatus) => certApplyStatusLabel[status]
const certLabelOf = (status: CertificateStatus) => CERT_STATUS_LABEL[status]

/* -------------------------------------------------------------------------- */
/* Tab 1 · 证书规则配置                                                        */
/* -------------------------------------------------------------------------- */

const ruleVisible = ref(false)
const ruleFormRef = ref<FormInstance>()
/** 非空表示正在编辑既有规则，为空表示新增 */
const editingRuleId = ref('')

const ruleForm = reactive({
  positionId: '',
  name: '',
  minSkillRate: 80,
  minProjectRate: 75,
  minAvgScore: 70,
  basicProjectRule: '全部通关',
  advancedProjectRule: '至少一项',
  validMonths: 24,
})

const ruleRules: FormRules = {
  positionId: [{ required: true, message: '请选择适用岗位', trigger: 'change' }],
  name: [{ required: true, message: '请输入证书名称', trigger: 'blur' }],
}

const bannerStats = computed(() => {
  const list = store.rules
  const months = list.length
    ? Math.round(list.reduce((sum, item) => sum + item.validMonths, 0) / list.length)
    : 0
  return [
    { label: '规则总数', value: list.length },
    { label: '生效中', value: list.filter((item) => item.active).length },
    { label: '覆盖岗位', value: new Set(list.map((item) => item.positionId)).size },
    { label: '平均有效期(月)', value: months },
  ]
})

/** 规则卡片的确认项：以「名称 + 数值」成对呈现，不用图标 */
function conditionRows(rule: CertificateRule): { label: string; text: string }[] {
  return [
    { label: '技能点亮率', text: `${rule.minSkillRate}%` },
    { label: '项目完成率', text: `${rule.minProjectRate}%` },
    { label: '最低平均分', text: `${rule.minAvgScore} 分` },
    { label: '基础项目', text: `通关${rule.basicProjectRule}` },
    { label: '进阶项目', text: `通关${rule.advancedProjectRule}` },
    { label: '有效期', text: `${rule.validMonths} 个月` },
  ]
}

function openRule(row?: CertificateRule): void {
  editingRuleId.value = row?.id ?? ''
  Object.assign(
    ruleForm,
    row
      ? {
          positionId: row.positionId,
          name: row.name,
          minSkillRate: row.minSkillRate,
          minProjectRate: row.minProjectRate,
          minAvgScore: row.minAvgScore,
          basicProjectRule: row.basicProjectRule,
          advancedProjectRule: row.advancedProjectRule,
          validMonths: row.validMonths,
        }
      : {
          positionId: positionStore.options[0]?.id ?? '',
          name: '',
          minSkillRate: 80,
          minProjectRate: 75,
          minAvgScore: 70,
          basicProjectRule: '全部通关',
          advancedProjectRule: '至少一项',
          validMonths: 24,
        },
  )
  ruleVisible.value = true
}

async function submitRule(): Promise<void> {
  const instance = ruleFormRef.value
  if (!instance) return
  const valid = await instance.validate().catch(() => false)
  if (!valid) return
  if (editingRuleId.value) {
    await store.editRule(editingRuleId.value, { ...ruleForm })
  } else {
    await store.addRule({ ...ruleForm })
  }
  ruleVisible.value = false
  ElMessage.success(editingRuleId.value ? '证书规则已更新' : '证书规则已保存')
  editingRuleId.value = ''
}

async function removeRule(row: CertificateRule): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除「${row.name}」后，该岗位将不再有认证申领规则，已发放的证书不受影响。确认删除？`,
      '删除证书规则',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await store.removeRule(row.id)
  ElMessage.success('证书规则已删除')
}

/* -------------------------------------------------------------------------- */
/* Tab 2 · 证书审核                                                            */
/* -------------------------------------------------------------------------- */

const applyStatus = ref('all')
const applyKeyword = ref('')
const selectedApps = ref<string[]>([])

const filteredApps = computed(() =>
  store.applications.filter((item) => {
    const matchStatus = applyStatus.value === 'all' || item.status === applyStatus.value
    const text = `${item.studentName}${item.positionName}${item.certNo}`
    const matchKeyword =
      applyKeyword.value.length === 0 || text.includes(applyKeyword.value.trim())
    return matchStatus && matchKeyword
  }),
)

function onAppSelection(rows: CertificateApplication[]): void {
  selectedApps.value = rows.map((row) => row.id)
}

async function batchApprove(): Promise<void> {
  if (selectedApps.value.length === 0) {
    ElMessage.warning('请先勾选需要通过的申请')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将对 ${selectedApps.value.length} 条证书申请执行「批量通过」，通过后自动进入证书管理列表。确认继续？`,
      '批量通过',
      { confirmButtonText: '批量通过', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await store.batchApprove([...selectedApps.value])
  selectedApps.value = []
  ElMessage.success('已批量通过')
}

const reviewVisible = ref(false)
const reviewTarget = ref<CertificateApplication | null>(null)
const reviewForm = reactive({ status: 'approved' as 'approved' | 'rejected', comment: '' })

function openReview(row: CertificateApplication): void {
  reviewTarget.value = row
  reviewForm.status = 'approved'
  reviewForm.comment = ''
  reviewVisible.value = true
}

async function submitReview(): Promise<void> {
  const target = reviewTarget.value
  if (!target) return
  if (reviewForm.status === 'rejected' && !reviewForm.comment.trim()) {
    ElMessage.warning('驳回时需要填写审核意见')
    return
  }
  await store.review(target.id, {
    status: reviewForm.status,
    rejectReason: reviewForm.status === 'rejected' ? reviewForm.comment : undefined,
  })
  reviewVisible.value = false
  ElMessage.success(reviewForm.status === 'approved' ? '证书申请已通过' : '证书申请已驳回')
}

/* -------------------------------------------------------------------------- */
/* Tab 3 · 证书管理                                                            */
/* -------------------------------------------------------------------------- */

const certKeyword = ref('')
const generateVisible = ref(false)
const generateFormRef = ref<FormInstance>()

const generateForm = reactive({
  studentName: '',
  className: '21级1班',
  positionId: '',
  issuer: platformInfo.defaultIssuer,
  prefix: platformInfo.certNoPrefix,
})

const generateRules: FormRules = {
  studentName: [{ required: true, message: '请选择学生', trigger: 'change' }],
  positionId: [{ required: true, message: '请选择认证岗位', trigger: 'change' }],
}

/** 学生下拉来自名册，附带班级，便于核对（修复#11） */
const studentOptions = computed(() =>
  store.roster.map((item) => ({ name: item.name, className: item.className })),
)

/** 当前选中的学生与证书规则（修复#12） */
const selectedStudent = computed(() => store.findStudent(generateForm.studentName))
const selectedRule = computed(() => store.findRule(generateForm.positionId))

/** 未达标的申领条件列表（修复#12） */
const unmetConditions = computed(() => {
  const rule = selectedRule.value
  const student = selectedStudent.value
  if (!rule || !student) return []
  const list: string[] = []
  if (student.skillRate < rule.minSkillRate) {
    list.push(`技能树点亮率 ${student.skillRate}% 未达 ${rule.minSkillRate}%`)
  }
  if (student.projectRate < rule.minProjectRate) {
    list.push(`项目完成率 ${student.projectRate}% 未达 ${rule.minProjectRate}%`)
  }
  if (student.avgScore < rule.minAvgScore) {
    list.push(`平均分 ${student.avgScore} 未达 ${rule.minAvgScore}`)
  }
  return list
})

/** 修复#18：该学生是否已持有该岗位的有效证书 */
const existingCert = computed(() => {
  const student = generateForm.studentName
  const position = generateForm.positionId
  if (!student || !position) return null
  return (
    store.certificates.find(
      (item) =>
        item.studentName === student && item.positionId === position && item.status === 'valid',
    ) ?? null
  )
})

/** 班级随所选学生联动（修复#11） */
watch(
  () => generateForm.studentName,
  (name) => {
    generateForm.className = store.findStudent(name)?.className ?? ''
  },
)

const filteredCerts = computed(() =>
  store.certificates.filter((item) => {
    const text = `${item.studentName}${item.certNo}`
    return certKeyword.value.length === 0 || text.includes(certKeyword.value.trim())
  }),
)

const previewNo = computed(() =>
  nextCertNo(
    generateForm.prefix,
    store.certificates.map((item) => item.certNo),
  ),
)

function openGenerate(): void {
  Object.assign(generateForm, {
    studentName: '',
    className: '21级1班',
    positionId: positionStore.options[0]?.id ?? '',
    issuer: platformInfo.defaultIssuer,
    prefix: platformInfo.certNoPrefix,
  })
  generateVisible.value = true
}

async function submitGenerate(): Promise<void> {
  const instance = generateFormRef.value
  if (!instance) return
  const valid = await instance.validate().catch(() => false)
  if (!valid) return

  // 修复#12：发放前校验达标情况，不达标必须二次确认（可强制发放，但不静默通过）
  if (unmetConditions.value.length > 0) {
    try {
      await ElMessageBox.confirm(
        `该学生未满足「${selectedRule.value?.name ?? '该岗位证书'}」的申领条件：\n\n${unmetConditions.value.map((item) => `· ${item}`).join('\n')}\n\n仍要强制发放证书吗？`,
        '未达到证书申领条件',
        { confirmButtonText: '仍然发放', cancelButtonText: '取消', type: 'warning' },
      )
    } catch {
      return
    }
  }

  // 修复#18：重复发证必须二次确认
  if (existingCert.value) {
    try {
      await ElMessageBox.confirm(
        `「${generateForm.studentName}」已持有「${existingCert.value.positionName}」的有效证书` +
          `（编号 ${existingCert.value.certNo}，有效期至 ${existingCert.value.validUntil}）。\n\n` +
          `重复发放会产生两条并存的有效证书，建议改用「补发」或先作废旧证书。\n\n确定仍要重复发放吗？`,
        '该学生已持有该岗位的有效证书',
        { confirmButtonText: '仍然发放', cancelButtonText: '取消', type: 'warning' },
      )
    } catch {
      return
    }
  }

  // 修复#10：提示使用本次实际写入的证书编号
  const created = await store.generate({
    studentName: generateForm.studentName,
    className: generateForm.className,
    positionId: generateForm.positionId,
    certNo: previewNo.value,
    issuer: generateForm.issuer,
  })
  generateVisible.value = false
  // 修复#10：提示使用本次实际写入的编号；修复#17：提示演示数据会重置
  ElMessage.success(
    `电子证书已生成：${created.certNo}（演示数据，刷新页面或重新进入会重置）`,
  )
}

async function revoke(row: Certificate): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `作废「${row.studentName}」的证书 ${row.certNo} 后不可恢复，学生端将看到「已作废」状态。确认作废？`,
      '作废证书',
      { confirmButtonText: '作废', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  await store.revoke(row.id)
  ElMessage.success('证书已作废')
}

async function reissue(row: Certificate): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `为「${row.studentName}」补发证书 ${row.certNo}？补发后有效期将顺延一年。`,
      '补发证书',
      { confirmButtonText: '补发', cancelButtonText: '取消', type: 'info' },
    )
  } catch {
    return
  }
  await store.reissue(row.id)
  ElMessage.success('证书已补发')
}

/* -------------------------------------------------------------------------- */
/* Tab 4 · 证书台账                                                            */
/* -------------------------------------------------------------------------- */

const ledgerKeyword = ref('')
const ledgerPosition = ref('all')

const filteredLedger = computed(() =>
  store.ledger.filter((item) => {
    const matchPosition =
      ledgerPosition.value === 'all' || item.positionId === ledgerPosition.value
    const text = `${item.studentName}${item.certNo}`
    const matchKeyword =
      ledgerKeyword.value.length === 0 || text.includes(ledgerKeyword.value.trim())
    return matchPosition && matchKeyword
  }),
)

/** 导出台账：本地生成 CSV（真实后端接入后改为调用 /exports 接口） */
function exportLedger(): void {
  const header = ['学生', '班级', '认证岗位', '证书编号', '发放日期', '有效期至', '状态']
  const rows = filteredLedger.value.map((item) => [
    item.studentName,
    item.className,
    item.positionName,
    item.certNo,
    item.issuedAt,
    item.validUntil,
    CERT_STATUS_LABEL[item.status],
  ])
  const csv = [header, ...rows].map((line) => line.join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `证书台账-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('台账已导出')
}

function printLedger(): void {
  window.print()
}

/* 分页（三张表各一份；数据变少时页码自动收回） */
const {
  page: applyPage,
  pageSize: applyPageSize,
  total: applyTotal,
  paged: applyRows,
} = usePaging(() => filteredApps.value)

const {
  page: certPage,
  pageSize: certPageSize,
  total: certTotal,
  paged: certRows,
} = usePaging(() => filteredCerts.value)

const {
  page: ledgerPage,
  pageSize: ledgerPageSize,
  total: ledgerTotal,
  paged: ledgerRows,
} = usePaging(() => filteredLedger.value)

/* -------------------------------------------------------------------------- */

onMounted(async () => {
  await Promise.all([store.load(), positionStore.load(), skill.load()])
})
</script>

<template>
  <div class="cert-view">
    <!-- 页面标题已由外层布局渲染（「企业认证证书」），这里不再重复一遍 -->
    <PanelBlock :padded="false">
      <el-tabs v-model="activeTab" class="tabs">
        <!-- ① 证书规则配置 -->
        <el-tab-pane name="rules">
          <template #label><span class="tab-label">证书规则配置</span></template>

          <div class="rules">
            <section class="banner">
              <div class="banner__head">
                <div>
                  <p class="banner__title">证书规则配置</p>
                  <p class="banner__sub">配置各岗位证书申领条件，满足条件的学生可自主提交认证申请</p>
                </div>
                <el-button class="banner__btn" round @click="openRule()">＋ 新增规则</el-button>
              </div>
              <ul class="banner__stats">
                <li v-for="item in bannerStats" :key="item.label" class="banner-stat">
                  <p class="banner-stat__value num">{{ item.value }}</p>
                  <p class="banner-stat__label">{{ item.label }}</p>
                </li>
              </ul>
            </section>

            <section class="rule-grid">
              <article v-for="rule in store.rules" :key="rule.id" class="rule-card">
                <header class="rule-card__head">
                  <div class="rule-card__titles">
                    <p class="rule-card__position">
                      <span class="rule-card__swatch" :style="{ background: rule.swatch }" />
                      {{ rule.positionName }}
                    </p>
                    <p class="rule-card__name">{{ rule.name }}</p>
                  </div>
                  <div class="rule-card__ops">
                    <button
                      class="icon-btn icon-btn--edit"
                      type="button"
                      title="编辑规则"
                      aria-label="编辑规则"
                      @click="openRule(rule)"
                    >
                      编辑
                    </button>
                    <button
                      class="icon-btn icon-btn--del"
                      type="button"
                      title="删除规则"
                      aria-label="删除规则"
                      @click="removeRule(rule)"
                    >
                      删除
                    </button>
                  </div>
                </header>
                <ul class="rule-card__list">
                  <li v-for="item in conditionRows(rule)" :key="item.text" class="rule-item">
                    <span class="rule-item__label">{{ item.label }}</span>
                    <span class="rule-item__value num">{{ item.text }}</span>
                  </li>
                </ul>
              </article>
            </section>
          </div>
        </el-tab-pane>

        <!-- ② 证书审核 -->
        <el-tab-pane name="apply">
          <template #label><span class="tab-label">证书审核</span></template>

          <div class="toolbar">
            <div class="toolbar__filters">
              <el-select v-model="applyStatus" class="filter-select">
                <el-option label="全部状态" value="all" />
                <el-option label="待审核" value="pending" />
                <el-option label="已通过" value="approved" />
                <el-option label="已驳回" value="rejected" />
              </el-select>
              <el-input v-model="applyKeyword" class="toolbar__search" placeholder="搜索学生/岗位" clearable />
            </div>
            <el-button
              type="primary"
              round
              :disabled="selectedApps.length === 0"
              @click="batchApprove"
            >
              批量通过
            </el-button>
          </div>

          <el-table
            :data="applyRows"
            row-key="id"
            v-loading="store.loading"
            style="width: 100%"
            @selection-change="onAppSelection"
          >
            <el-table-column type="selection" width="48" />
            <el-table-column prop="studentName" label="学生" width="120" />
            <el-table-column prop="positionName" label="申请岗位" min-width="200" />
            <el-table-column prop="certNo" label="证书编号" width="180" />
            <el-table-column prop="appliedAt" label="申请时间" width="140" />
            <el-table-column label="技能点亮率" width="130">
              <template #default="{ row }"><span class="num">{{ row.skillRate }}%</span></template>
            </el-table-column>
            <el-table-column label="项目完成率" width="130">
              <template #default="{ row }"><span class="num">{{ row.projectRate }}%</span></template>
            </el-table-column>
            <el-table-column label="平均分" width="110">
              <template #default="{ row }"><span class="num">{{ row.avgScore }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <StatusPill
                  :tone="applyToneOf(row.status)"
                  :text="applyLabelOf(row.status)"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'pending'"
                  type="primary"
                  size="small"
                  round
                  @click="openReview(row)"
                >
                  审核
                </el-button>
                <span v-else-if="row.status === 'rejected'" class="reject-reason">
                  {{ row.rejectReason ?? '未达标' }}
                </span>
                <span v-else class="muted">--</span>
              </template>
            </el-table-column>
          </el-table>
          <ListPagination
            v-model:page="applyPage"
            v-model:page-size="applyPageSize"
            :total="applyTotal"
          />
        </el-tab-pane>

        <!-- ③ 证书管理 -->
        <el-tab-pane name="manage">
          <template #label><span class="tab-label">证书管理</span></template>

          <div class="toolbar">
            <el-input v-model="certKeyword" class="toolbar__search" placeholder="搜索证书编号/学生" clearable />
            <el-button type="primary" round @click="openGenerate">生成电子证书</el-button>
          </div>

          <el-table :data="certRows" row-key="id" v-loading="store.loading" style="width: 100%">
            <el-table-column prop="studentName" label="学生" width="120" />
            <el-table-column prop="positionName" label="认证岗位" min-width="220" />
            <el-table-column prop="certNo" label="证书编号" width="190" />
            <el-table-column prop="issuedAt" label="发放日期" width="150" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">{{ certLabelOf(row.status) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="190" fixed="right">
              <template #default="{ row }">
                <div class="ops">
                  <el-button
                    v-if="row.status === 'valid'"
                    class="btn-danger"
                    size="small"
                    round
                    @click="revoke(row)"
                  >
                    作废
                  </el-button>
                  <el-button size="small" round @click="reissue(row)">补发</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <ListPagination
            v-model:page="certPage"
            v-model:page-size="certPageSize"
            :total="certTotal"
          />
        </el-tab-pane>

        <!-- ④ 证书台账 -->
        <el-tab-pane name="ledger">
          <template #label><span class="tab-label">证书台账</span></template>

          <div class="toolbar">
            <div class="toolbar__filters">
              <el-input v-model="ledgerKeyword" class="toolbar__search" placeholder="搜索学生/证书编号" clearable />
              <el-select v-model="ledgerPosition" class="filter-select filter-select--wide">
                <el-option label="全部岗位" value="all" />
                <el-option
                  v-for="item in positionStore.options"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </div>
            <div class="toolbar__right">
              <el-button round @click="exportLedger">导出台账</el-button>
              <el-button round @click="printLedger">打印</el-button>
            </div>
          </div>

          <el-table :data="ledgerRows" row-key="id" style="width: 100%">
            <el-table-column prop="studentName" label="学生" width="120" />
            <el-table-column prop="className" label="班级" width="130" />
            <el-table-column prop="positionName" label="认证岗位" min-width="200" />
            <el-table-column prop="certNo" label="证书编号" width="190" />
            <el-table-column prop="issuedAt" label="发放日期" width="140" />
            <el-table-column prop="validUntil" label="有效期至" width="140" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">{{ certLabelOf(row.status) }}</template>
            </el-table-column>
          </el-table>
          <ListPagination
            v-model:page="ledgerPage"
            v-model:page-size="ledgerPageSize"
            :total="ledgerTotal"
          />
        </el-tab-pane>
      </el-tabs>
    </PanelBlock>

    <!-- AI 能力预留（P0 接口占位，不做页面） -->
    <PanelBlock title="AI 能力（预留）">
      <div class="ai-grid">
        <article v-for="item in aiCapabilities" :key="item.id" class="ai-card">
          <div class="ai-card__head">
            <span class="ai-card__name">{{ item.name }}</span>
            <StatusPill tone="lock" text="敬请期待" />
          </div>
          <p class="ai-card__desc">{{ item.description }}</p>
          <p class="ai-card__endpoint num">{{ item.endpoint }}</p>
        </article>
      </div>
    </PanelBlock>

    <!-- 新增规则 -->
    <el-dialog
      v-model="ruleVisible"
      :title="editingRuleId ? '编辑证书规则' : '新增证书规则'"
      width="560px"
      align-center
    >
      <el-form ref="ruleFormRef" :model="ruleForm" :rules="ruleRules" label-position="top">
        <el-form-item label="适用岗位" prop="positionId">
          <el-select v-model="ruleForm.positionId" class="full">
            <el-option
              v-for="item in positionStore.options"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="证书名称" prop="name">
          <el-input v-model="ruleForm.name" placeholder="如：视觉检测算法工程师认证证书" />
        </el-form-item>

        <section class="field-box">
          <p class="field-box__title">申领条件</p>
          <div class="field-box__row">
            <span class="field">
              <span class="field__label">技能树点亮率 ≥</span>
              <el-input-number v-model="ruleForm.minSkillRate" :min="0" :max="100" :controls="false" class="field__num" />
              <span class="field__unit">%</span>
            </span>
            <span class="field">
              <span class="field__label">项目完成率 ≥</span>
              <el-input-number v-model="ruleForm.minProjectRate" :min="0" :max="100" :controls="false" class="field__num" />
              <span class="field__unit">%</span>
            </span>
          </div>
          <div class="field-box__row">
            <span class="field">
              <span class="field__label">最低平均分 ≥</span>
              <el-input-number v-model="ruleForm.minAvgScore" :min="0" :max="100" :controls="false" class="field__num" />
              <span class="field__unit">分</span>
            </span>
          </div>
        </section>

        <section class="field-box">
          <p class="field-box__title">满级标准</p>
          <div class="field-box__row">
            <span class="field field--grow">
              <span class="field__label">基础项目通关</span>
              <el-select v-model="ruleForm.basicProjectRule" class="full">
                <el-option label="全部通关" value="全部通关" />
                <el-option label="至少一项" value="至少一项" />
              </el-select>
            </span>
            <span class="field field--grow">
              <span class="field__label">进阶项目通关</span>
              <el-select v-model="ruleForm.advancedProjectRule" class="full">
                <el-option label="全部通关" value="全部通关" />
                <el-option label="至少一项" value="至少一项" />
              </el-select>
            </span>
          </div>
        </section>

        <el-form-item label="证书有效期（月）">
          <el-input-number v-model="ruleForm.validMonths" :min="1" :max="120" :controls="false" class="field__num" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="ruleVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitRule">
          {{ editingRuleId ? '保存修改' : '保存规则' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 证书审核 -->
    <el-dialog v-model="reviewVisible" title="证书申请审核" width="480px" align-center>
      <p class="dialog-hint">
        {{ reviewTarget?.studentName }} · {{ reviewTarget?.positionName }} ·
        <span class="num">{{ reviewTarget?.certNo }}</span>
      </p>
      <el-form label-position="top">
        <el-form-item label="审核结果">
          <el-radio-group v-model="reviewForm.status">
            <el-radio value="approved">通过</el-radio>
            <el-radio value="rejected">驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审核意见">
          <el-input
            v-model="reviewForm.comment"
            type="textarea"
            :rows="3"
            resize="none"
            :placeholder="reviewForm.status === 'rejected' ? '驳回时必填，如：技能树点亮率未达标' : '选填'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitReview">提交审核</el-button>
      </template>
    </el-dialog>

    <!-- 生成电子证书 -->
    <el-dialog v-model="generateVisible" title="生成电子证书" width="520px" align-center>
      <el-form ref="generateFormRef" :model="generateForm" :rules="generateRules" label-position="top">
        <el-form-item label="选择学生" prop="studentName">
          <el-select
            v-model="generateForm.studentName"
            filterable
            class="full"
            placeholder="请选择学生"
          >
            <el-option
              v-for="item in studentOptions"
              :key="item.name"
              :label="`${item.name}（${item.className}）`"
              :value="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="认证岗位" prop="positionId">
          <el-select v-model="generateForm.positionId" class="full">
            <el-option
              v-for="item in positionStore.options"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="所属班级（随所选学生自动读取）">
          <el-input :model-value="generateForm.className" disabled placeholder="选择学生后自动带出" />
        </el-form-item>
        <!-- 达标校验提示（修复#12） -->
        <div
          v-if="selectedRule"
          class="qualify"
          :class="{ 'is-warn': unmetConditions.length > 0 }"
        >
          <template v-if="unmetConditions.length === 0">
            满足「{{ selectedRule.name }}」的申领条件
          </template>
          <template v-else>
            不满足申领条件：{{ unmetConditions.join('；') }}
            <br />
            仍可强制发放，但需要二次确认。
          </template>
        </div>
        <!-- 重复发证提示（修复#18） -->
        <div v-if="existingCert" class="qualify is-warn">
          该学生已持有「{{ existingCert.positionName }}」的有效证书（编号
          {{ existingCert.certNo }}，有效期至 {{ existingCert.validUntil }}），重复发放会新增一条并存记录。
        </div>
        <el-form-item label="认证机构">
          <el-input v-model="generateForm.issuer" />
        </el-form-item>
        <el-form-item label="证书编号前缀">
          <el-input v-model="generateForm.prefix" />
        </el-form-item>
        <p class="cert-hint">编号将自动递增生成，确保证书唯一性 · 本次编号：{{ previewNo }}</p>
      </el-form>
      <template #footer>
        <el-button round @click="generateVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitGenerate">生成证书</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.tabs :deep(.el-tabs__header) {
  padding: 8px 20px 0;
  border-bottom: 1px solid var(--line);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px 12px;
}

.toolbar__filters {
  display: flex;
  gap: 10px;
}

.toolbar__right {
  display: flex;
  gap: 10px;
}

.toolbar__search {
  width: 240px;
}

.filter-select {
  width: 140px;
}

.filter-select--wide {
  width: 190px;
}

.ops {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-danger {
  color: var(--danger-ink);
  border-color: var(--danger-line);
  background: #fff;
}

.btn-danger:hover {
  color: var(--danger-ink);
  border-color: var(--danger-line);
  background: var(--danger-bg);
}

.reject-reason {
  color: var(--danger-ink);
  font-size: 12.5px;
}

/* —— 证书规则配置 —— */
.rules {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.banner {
  padding: 20px 22px;
  border-radius: var(--r-lg);
  background:
    radial-gradient(120% 160% at 100% 0%, rgba(255, 255, 255, 0.28), transparent 60%),
    linear-gradient(105deg, var(--brand-700) 0%, var(--brand-500) 56%, var(--brand-400) 100%);
  color: #fff;
}

.banner__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.banner__title {
  font-size: 17px;
  font-weight: 700;
}

.banner__sub {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12.5px;
}

.banner__btn {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
}

.banner__btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: #fff;
  color: #fff;
}

.banner__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.banner-stat {
  padding: 12px 16px;
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.16);
}

.banner-stat__value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.15;
}

.banner-stat__label {
  color: rgba(255, 255, 255, 0.82);
  font-size: 11.5px;
}

.rule-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.rule-card {
  padding: 14px 16px 8px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--sh-1);
}

.rule-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.rule-card__position {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
  font-size: 12px;
}

.rule-card__swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex: none;
}

.rule-card__name {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.rule-card__ops {
  display: flex;
  gap: 6px;
  flex: none;
}

.icon-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.icon-btn:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}

.icon-btn--del {
  color: var(--danger-ink);
}

.icon-btn--del:hover {
  border-color: var(--danger-line);
  background: var(--danger-bg);
  color: var(--danger-ink);
}

.rule-card__list {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
}

.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--line-soft);
  color: var(--ink-2);
  font-size: 12.5px;
}

.rule-item__label {
  color: var(--ink-3);
}

.rule-item__value {
  color: var(--ink-1);
  font-weight: 600;
}

/* —— AI 预留 —— */
.ai-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.ai-card {
  padding: 16px 18px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-md);
  background: var(--surface-2);
}

.ai-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ai-card__name {
  font-size: 14.5px;
  font-weight: 700;
}

.ai-card__desc {
  margin-top: 6px;
  color: var(--ink-2);
  font-size: 12.5px;
}

.ai-card__endpoint {
  margin-top: 8px;
  color: var(--ink-3);
  font-size: 12px;
}

/* —— 对话框 —— */
.field-box {
  padding: 14px 16px;
  margin-bottom: 18px;
  border-radius: var(--r-md);
  background: var(--surface-2);
}

.field-box__title {
  margin-bottom: 10px;
  font-size: 13.5px;
  font-weight: 700;
}

.field-box__row {
  display: flex;
  gap: 18px;
  align-items: center;
}

.field-box__row + .field-box__row {
  margin-top: 10px;
}

.field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.field--grow {
  flex: 1;
  min-width: 0;
}

.field__label {
  color: var(--ink-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.field__num {
  width: 110px;
}

.field__unit {
  color: var(--ink-3);
  font-size: 12.5px;
}

.full {
  width: 100%;
}

.dialog-hint {
  margin-bottom: 14px;
  color: var(--ink-2);
  font-size: 13px;
}

.cert-hint {
  padding: 10px 14px;
  border-radius: var(--r-sm);
  background: var(--wip-bg);
  color: #b35c00;
  font-size: 12.5px;
}

/* 达标校验提示（修复#12） */
.qualify {
  padding: 9px 12px;
  margin-bottom: 16px;
  border-radius: var(--r-sm);
  background: var(--ok-bg);
  color: #2f8a08;
  font-size: 12.5px;
  line-height: 1.7;
}

.qualify.is-warn {
  background: var(--wip-bg);
  color: #b35c00;
}

@media (max-width: 1440px) {
  .rule-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
