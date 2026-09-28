<script setup lang="ts">
/**
 * 实训项目管理（对接真实后端，接口文档 §7）
 *
 * 两个 Tab：
 * ① 项目全流程管理 —— 项目的增删改查 + 发布 / 下架；新建时填基本信息、
 *    选岗位与关联技能点、上传实训资料与评分文件、从模块库挑关卡并排序、
 *    给关卡填引导子标题与提示词（items_json）；
 * ② 标准化实训模块 —— 模块库（关卡模板）的增删改查，项目里的关卡都来自这里。
 */

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'
import PanelBlock from '@/components/PanelBlock.vue'
import StatusPill from '@/components/StatusPill.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListPagination from '@/components/ListPagination.vue'
import { usePaging } from '@/composables/usePaging'
import { useProjectsStore } from '@/stores/projects'
import { createSkillNode, fetchJobs, fetchSkillBindings, fetchSkillCatalog } from '@/api/backend/catalog'
import {
  addProjectModule,
  removeProjectModule,
  reorderProjectModules,
  setModuleSkills,
  updateProjectModule,
  uploadProjectFile,
} from '@/api/backend/projects'
import { formatDateTime, num } from '@/api/backend/client'
import {
  CURRENT_TEACHER_ID,
  FILE_KIND,
  FILE_KIND_LABEL,
  LEVEL_LABEL,
  MAX_UPLOAD_MB,
  PROJECT_STATUS_LABEL,
} from '@/config/backend'
import type {
  JobRead,
  ProjectRead,
  SkillBindingStatus,
  SkillTreeNode,
  StageItem,
  StageTemplate,
} from '@/api/backend/types'

const route = useRoute()
const router = useRouter()
const store = useProjectsStore()

const activeTab = ref<string>(typeof route.query.tab === 'string' ? route.query.tab : 'list')
watch(activeTab, (value) => {
  void router.replace({ query: { ...route.query, tab: value } })
})

const levelOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'BASIC', label: '基础' },
  { value: 'ADVANCED', label: '进阶' },
  { value: 'EXPANDED', label: '拓展' },
]

/* -------------------------------------------------------------------------- */
/* Tab 1 · 项目全流程管理                                                      */
/* -------------------------------------------------------------------------- */

const levelFilter = ref('ALL')
const statusFilter = ref('ALL')
const jobFilter = ref<number | 'ALL'>('ALL')
const keyword = ref('')

const filteredProjects = computed(() =>
  store.list
    .filter((item) => (levelFilter.value === 'ALL' ? true : item.project_level === levelFilter.value))
    .filter((item) => (statusFilter.value === 'ALL' ? true : item.status === statusFilter.value))
    .filter((item) =>
      jobFilter.value === 'ALL' ? true : (item.job_id ?? 0) === Number(jobFilter.value),
    )
    .filter((item) => {
      const target = keyword.value.trim().toLowerCase()
      if (!target) return true
      return (
        item.project_name.toLowerCase().includes(target) ||
        (item.description ?? '').toLowerCase().includes(target)
      )
    }),
)

const {
  page: projectPage,
  pageSize: projectPageSize,
  total: projectTotal,
  paged: projectRows,
  reset: resetProjectPage,
} = usePaging(() => filteredProjects.value)

function applyFilter(): void {
  resetProjectPage()
}

function pickLevel(value: string): void {
  levelFilter.value = value
  applyFilter()
}

/* —— 岗位 / 技能点可选项 —— */

const jobs = ref<JobRead[]>([])
const skillCatalog = ref<{ tree: { id: number; tree_name: string }; nodes: SkillTreeNode[] }[]>([])
/** 绑定不全的技能点（缺岗位或缺项目），用于在下拉里高亮提醒 */
const skillBindings = ref<SkillBindingStatus[]>([])
const jobNameMap = computed(() => new Map(jobs.value.map((item) => [item.id, item.job_name])))

async function loadCatalog(): Promise<void> {
  const [jobResult, catalog, bindings] = await Promise.all([
    fetchJobs({ status: 'ENABLED' }),
    fetchSkillCatalog(),
    fetchSkillBindings(),
  ])
  jobs.value = jobResult.items
  skillCatalog.value = catalog
  skillBindings.value = bindings
}

const unboundIds = computed(() => new Set(skillBindings.value.map((item) => item.skill_node_id)))

function isUnbound(nodeId: number): boolean {
  return unboundIds.value.has(nodeId)
}

/** 下拉选项文案：名称 + 简述（鼠标悬浮能看到完整描述） */
function skillOptionLabel(node: SkillTreeNode): string {
  return node.description ? `${node.node_name} — ${node.description}` : node.node_name
}

function jobNameOf(jobId: number | null): string {
  if (!jobId) return '--'
  return jobNameMap.value.get(jobId) ?? `岗位 #${jobId}`
}

/* —— 新建 / 编辑项目弹窗 —— */

interface ModuleDraft {
  /** 已存在于项目里的关卡 id；新建项目中为空 */
  moduleId?: number
  templateId: number
  stageName: string
  weight: number
  required: boolean
  requirement: string
  acceptStandard: string
  items: StageItem[]
  /** 本关卡关联的技能点（技能点亮按关卡得分判定） */
  skillIds: number[]
}

interface PendingFile {
  uid: string
  name: string
  size: number
  kind: string
  raw: File
}

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  project_name: '',
  project_level: 'BASIC' as 'BASIC' | 'ADVANCED' | 'EXPANDED',
  difficulty: 3,
  job_id: null as number | null,
  description: '',
})

const moduleDrafts = ref<ModuleDraft[]>([])
const removedModuleIds = ref<number[]>([])
const pendingFiles = ref<PendingFile[]>([])
const removedFileIds = ref<number[]>([])
const templateToAdd = ref<number | null>(null)
const savingHint = ref('')

const rules: FormRules = {
  project_name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  project_level: [{ required: true, message: '请选择项目层级', trigger: 'change' }],
}

/** 还没被当前项目选中的模块库条目 */
const availableTemplates = computed<StageTemplate[]>(() => {
  const used = new Set(moduleDrafts.value.map((item) => item.templateId))
  return store.templates.filter((item) => !used.has(item.id))
})

const weightTotal = computed(() =>
  moduleDrafts.value.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0),
)

const weightValid = computed(() => Math.abs(weightTotal.value - 100) < 0.01)

const difficultyText = computed(() => `${form.difficulty} 星`)

function resetForm(): void {
  editingId.value = null
  removedModuleIds.value = []
  removedFileIds.value = []
  pendingFiles.value = []
  moduleDrafts.value = []
  templateToAdd.value = null
  savingHint.value = ''
  Object.assign(form, {
    project_name: '',
    project_level: 'BASIC',
    difficulty: 3,
    job_id: jobs.value[0]?.id ?? null,
    description: '',
  })
}

async function openCreate(): Promise<void> {
  resetForm()
  // 新建项目默认带上七个标准模块，权重按模块库默认值（合计 100）
  moduleDrafts.value = store.templates.map((template) => ({
    templateId: template.id,
    stageName: template.stage_name,
    weight: num(template.default_weight),
    required: template.default_required,
    requirement: template.default_requirement ?? '',
    acceptStandard: template.default_accept_standard ?? '',
    items: [],
    skillIds: [],
  }))
  dialogVisible.value = true
}

async function openEdit(row: ProjectRead): Promise<void> {
  resetForm()
  editingId.value = row.id
  const detail = await store.loadDetail(row.id)
  Object.assign(form, {
    project_name: detail.project_name,
    project_level: detail.project_level,
    difficulty: detail.difficulty,
    job_id: detail.job_id,
    description: detail.description ?? '',
  })
  moduleDrafts.value = (detail.modules ?? []).map((item) => ({
    moduleId: item.id,
    templateId: item.template_id,
    stageName: item.stage_name,
    weight: num(item.weight),
    required: item.required,
    requirement: item.requirement ?? '',
    acceptStandard: item.accept_standard ?? '',
    items: (item.items_json ?? []).map((entry) => ({ title: entry.title, prompt: entry.prompt })),
    skillIds: [...(item.skill_node_ids ?? [])],
  }))
  dialogVisible.value = true
}

/* —— 关卡编辑 —— */

function addTemplateToDraft(): void {
  const template = store.templates.find((item) => item.id === templateToAdd.value)
  if (!template) {
    ElMessage.warning('请先选择要加入的模块')
    return
  }
  moduleDrafts.value = [
    ...moduleDrafts.value,
    {
      templateId: template.id,
      stageName: template.stage_name,
      weight: num(template.default_weight),
      required: template.default_required,
      requirement: template.default_requirement ?? '',
      acceptStandard: template.default_accept_standard ?? '',
      items: [],
      skillIds: [],
    },
  ]
  templateToAdd.value = null
}

function removeDraft(index: number): void {
  const draft = moduleDrafts.value[index]
  if (draft?.moduleId) removedModuleIds.value = [...removedModuleIds.value, draft.moduleId]
  moduleDrafts.value = moduleDrafts.value.filter((_, i) => i !== index)
}

function moveDraft(index: number, offset: number): void {
  const target = index + offset
  if (target < 0 || target >= moduleDrafts.value.length) return
  const next = [...moduleDrafts.value]
  const [item] = next.splice(index, 1)
  if (item) next.splice(target, 0, item)
  moduleDrafts.value = next
}

function addItemRow(index: number): void {
  const draft = moduleDrafts.value[index]
  if (!draft) return
  draft.items = [...draft.items, { title: '', prompt: '' }]
}

function removeItemRow(moduleIndex: number, itemIndex: number): void {
  const draft = moduleDrafts.value[moduleIndex]
  if (!draft) return
  draft.items = draft.items.filter((_, i) => i !== itemIndex)
}

/** 权重合计不等 100 时，按当前比例归一化（差额补到权重最大的关卡上） */
function normalizeWeights(): void {
  const total = weightTotal.value
  if (total <= 0) {
    ElMessage.warning('权重合计为 0，无法归一化')
    return
  }
  const scaled = moduleDrafts.value.map((item) => ({
    ...item,
    weight: Math.round((item.weight / total) * 10000) / 100,
  }))
  const diff = Math.round((100 - scaled.reduce((sum, item) => sum + item.weight, 0)) * 100) / 100
  if (diff !== 0) {
    let maxIndex = 0
    scaled.forEach((item, index) => {
      if (item.weight > (scaled[maxIndex]?.weight ?? 0)) maxIndex = index
    })
    const target = scaled[maxIndex]
    if (target) target.weight = Math.round((target.weight + diff) * 100) / 100
  }
  moduleDrafts.value = scaled
}

/* —— 在项目里新建技能点（技能只能从项目 / 岗位里创建） —— */

const skillDialogVisible = ref(false)
const skillSaving = ref(false)
const skillTargetIndex = ref<number | null>(null)
const skillForm = ref({
  tree_id: null as number | null,
  node_name: '',
  description: '',
})

function openCreateSkill(moduleIndex: number): void {
  skillTargetIndex.value = moduleIndex
  skillForm.value = {
    tree_id: skillCatalog.value[0]?.tree.id ?? null,
    node_name: '',
    description: '',
  }
  skillDialogVisible.value = true
}

/** 新建技能点并直接绑到当前关卡；名称重名时复用已有技能点，避免产生孤儿技能 */
async function submitSkill(): Promise<void> {
  const name = skillForm.value.node_name.trim()
  if (!name) {
    ElMessage.warning('请输入技能点名称')
    return
  }
  const existing = skillCatalog.value.flatMap((group) => group.nodes).find((node) => node.node_name === name)
  if (!existing && !skillForm.value.tree_id) {
    ElMessage.warning('请选择所属技能体系')
    return
  }
  skillSaving.value = true
  try {
    let node = existing
    if (!node) {
      node = await createSkillNode(skillForm.value.tree_id as number, {
        node_name: name,
        description: skillForm.value.description.trim() || null,
        status: 'ENABLED',
      })
      const group = skillCatalog.value.find((item) => item.tree.id === skillForm.value.tree_id)
      if (group) group.nodes = [...group.nodes, node]
      skillBindings.value = [
        ...skillBindings.value,
        {
          skill_node_id: node.id,
          node_name: node.node_name,
          tree_id: node.tree_id,
          tree_name: group?.tree.tree_name ?? null,
          description: node.description,
          has_job: false,
          has_project: false,
        },
      ]
    }
    const draft = skillTargetIndex.value === null ? undefined : moduleDrafts.value[skillTargetIndex.value]
    if (draft && !draft.skillIds.includes(node.id)) {
      draft.skillIds = [...draft.skillIds, node.id]
    }
    ElMessage.success(existing ? '已复用同名技能点并绑定' : '技能点已创建并绑定到该关卡')
    skillDialogVisible.value = false
  } finally {
    skillSaving.value = false
  }
}

/* —— 附件 —— */

function onFilePicked(file: UploadFile, kind: string): void {
  const raw = file.raw
  if (!raw) return
  if (raw.size > MAX_UPLOAD_MB * 1024 * 1024) {
    ElMessage.error(`「${raw.name}」超过 ${MAX_UPLOAD_MB}MB 上限`)
    return
  }
  if (pendingFiles.value.some((item) => item.name === raw.name && item.kind === kind)) {
    ElMessage.warning(`「${raw.name}」已在待上传列表里`)
    return
  }
  pendingFiles.value = [
    ...pendingFiles.value,
    {
      uid: `${Date.now()}-${raw.name}`,
      name: raw.name,
      size: raw.size,
      kind,
      raw,
    },
  ]
}

/** el-upload 的 on-change 需要带上用途，这里用工厂函数包一层 */
function pickFileHandler(kind: string): (file: UploadFile) => void {
  return (file: UploadFile) => onFilePicked(file, kind)
}

function removePendingFile(uid: string): void {
  pendingFiles.value = pendingFiles.value.filter((item) => item.uid !== uid)
}

function removeExistingFile(fileId: number): void {
  removedFileIds.value = [...removedFileIds.value, fileId]
}

const currentDetail = computed(() => (editingId.value ? store.detail : null))

const visibleFiles = computed(() =>
  (currentDetail.value?.files ?? []).filter((item) => !removedFileIds.value.includes(item.id)),
)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* —— 保存 —— */

async function submitProject(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const basePayload = {
      project_name: form.project_name.trim(),
      project_level: form.project_level,
      difficulty: form.difficulty,
      job_id: form.job_id,
      description: form.description.trim() || null,
    }

    savingHint.value = '保存项目基本信息…'
    let projectId = editingId.value ?? 0
    if (editingId.value) {
      await store.update(editingId.value, basePayload)
    } else {
      const created = await store.create({ ...basePayload, creator_id: CURRENT_TEACHER_ID })
      projectId = created.id
    }

    // ① 关卡组成：先删、再改、后加，最后按界面顺序整体重排
    savingHint.value = '同步实训模块…'
    for (const moduleId of removedModuleIds.value) {
      await removeProjectModule(projectId, moduleId)
    }

    const orderedIds: number[] = []
    const moduleSkillPlan: { moduleId: number; skillIds: number[] }[] = []
    for (const draft of moduleDrafts.value) {
      const items = draft.items
        .map((entry) => ({ title: entry.title.trim(), prompt: entry.prompt.trim() }))
        .filter((entry) => entry.title.length > 0 || entry.prompt.length > 0)
      const payload = {
        requirement: draft.requirement.trim() || null,
        accept_standard: draft.acceptStandard.trim() || null,
        required: draft.required,
        weight: draft.weight,
        items_json: items,
      }
      let currentModuleId: number
      if (draft.moduleId) {
        await updateProjectModule(projectId, draft.moduleId, payload)
        currentModuleId = draft.moduleId
      } else {
        const created = await addProjectModule(projectId, {
          template_id: draft.templateId,
          ...payload,
        })
        currentModuleId = created.id
      }
      orderedIds.push(currentModuleId)
      moduleSkillPlan.push({ moduleId: currentModuleId, skillIds: [...draft.skillIds] })
    }
    if (orderedIds.length > 0) {
      await reorderProjectModules(projectId, orderedIds)
    }

    // ② 关卡关联技能点（覆盖式，逐个关卡保存）
    savingHint.value = '同步关卡技能点…'
    for (const plan of moduleSkillPlan) {
      await setModuleSkills(projectId, plan.moduleId, plan.skillIds)
    }

    // ③ 附件：先解除要移除的，再上传新选的
    if (removedFileIds.value.length > 0) {
      savingHint.value = '解除附件关联…'
      const { removeProjectFile } = await import('@/api/backend/projects')
      for (const fileId of removedFileIds.value) {
        await removeProjectFile(projectId, fileId)
      }
    }
    if (pendingFiles.value.length > 0) {
      savingHint.value = '上传实训资料与评分文件…'
      for (const item of pendingFiles.value) {
        await uploadProjectFile(projectId, item.raw, item.kind, item.name)
      }
    }

    await store.loadDetail(projectId)
    await store.load()
    dialogVisible.value = false
    ElMessage.success(
      editingId.value ? '项目已更新' : '项目已创建（默认为草稿，可在列表里发布）',
    )
  } catch {
    // 具体原因由请求层统一提示，这里保持弹窗打开便于修改
  } finally {
    saving.value = false
    savingHint.value = ''
  }
}

/* —— 发布 / 下架 / 删除 —— */

async function publishProject(row: ProjectRead): Promise<void> {
  try {
    await store.setStatus(row.id, 'PUBLISHED')
    ElMessage.success(`《${row.project_name}》已发布`)
  } catch {
    // 关卡 / 权重不满足发布条件时由后端给出提示
  }
}

async function offlineProject(row: ProjectRead): Promise<void> {
  try {
    await store.setStatus(row.id, 'OFF_SHELF')
    ElMessage.success(`《${row.project_name}》已下架`)
  } catch {
    /* 提示已由请求层给出 */
  }
}

async function removeProject(row: ProjectRead): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后项目会从列表消失（学生的闯关记录保留），且已发布的项目需先下架。确认删除《${row.project_name}》？`,
      '删除项目',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await store.remove(row.id)
    ElMessage.success('项目已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* -------------------------------------------------------------------------- */
/* Tab 2 · 标准化实训模块（模块库）                                            */
/* -------------------------------------------------------------------------- */

const templateKeyword = ref('')

const filteredTemplates = computed(() => {
  const target = templateKeyword.value.trim().toLowerCase()
  if (!target) return store.templates
  return store.templates.filter(
    (item) =>
      item.stage_name.toLowerCase().includes(target) ||
      (item.description ?? '').toLowerCase().includes(target),
  )
})

const {
  page: templatePage,
  pageSize: templatePageSize,
  total: templateTotal,
  paged: templateRows,
  reset: resetTemplatePage,
} = usePaging(() => filteredTemplates.value)

watch(templateKeyword, () => resetTemplatePage())

const templateDialogVisible = ref(false)
const editingTemplateId = ref<number | null>(null)
const templateFormRef = ref<FormInstance>()

const templateForm = reactive({
  stage_name: '',
  description: '',
  default_required: true,
  default_weight: 0,
  default_requirement: '',
  default_accept_standard: '',
  sort_no: 0,
})

const templateRules: FormRules = {
  stage_name: [{ required: true, message: '请输入模块名称', trigger: 'blur' }],
}

function openTemplateCreate(): void {
  editingTemplateId.value = null
  const nextSort =
    store.templates.reduce((max, item) => Math.max(max, item.sort_no ?? 0), 0) + 1
  Object.assign(templateForm, {
    stage_name: '',
    description: '',
    default_required: true,
    default_weight: 0,
    default_requirement: '',
    default_accept_standard: '',
    sort_no: nextSort,
  })
  templateDialogVisible.value = true
}

function openTemplateEdit(row: StageTemplate): void {
  editingTemplateId.value = row.id
  Object.assign(templateForm, {
    stage_name: row.stage_name,
    description: row.description ?? '',
    default_required: row.default_required,
    default_weight: num(row.default_weight),
    default_requirement: row.default_requirement ?? '',
    default_accept_standard: row.default_accept_standard ?? '',
    sort_no: row.sort_no,
  })
  templateDialogVisible.value = true
}

async function submitTemplate(): Promise<void> {
  const valid = await templateFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    stage_name: templateForm.stage_name.trim(),
    description: templateForm.description.trim() || null,
    default_required: templateForm.default_required,
    default_weight: String(templateForm.default_weight),
    default_requirement: templateForm.default_requirement.trim() || null,
    default_accept_standard: templateForm.default_accept_standard.trim() || null,
    sort_no: templateForm.sort_no,
  }

  try {
    if (editingTemplateId.value) {
      await store.updateTemplate(editingTemplateId.value, payload)
    } else {
      await store.createTemplate(payload)
    }
    templateDialogVisible.value = false
    ElMessage.success(editingTemplateId.value ? '模块已更新' : '模块已新增')
  } catch {
    /* 提示已由请求层给出 */
  }
}

async function removeTemplate(row: StageTemplate): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后模块库不再显示「${row.stage_name}」。被项目选中过的模块不能删除，需先从项目里移除。确认删除？`,
      '删除模块',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await store.removeTemplate(row.id)
    ElMessage.success('模块已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* -------------------------------------------------------------------------- */

onMounted(async () => {
  await Promise.all([store.load(), store.loadTemplates(), loadCatalog()])
})
</script>

<template>
  <div class="project-manage">
    <PanelBlock :padded="false">
      <el-tabs v-model="activeTab" class="tabs">
        <!-- ① 项目全流程管理 -->
        <el-tab-pane name="list">
          <template #label><span class="tab-label">项目全流程管理</span></template>

          <div class="toolbar">
            <div class="toolbar__filters">
              <div class="tier-tabs">
                <button
                  v-for="item in levelOptions"
                  :key="item.value"
                  class="tier-tab"
                  :class="{ 'is-on': levelFilter === item.value }"
                  type="button"
                  @click="pickLevel(item.value)"
                >
                  {{ item.label }}
                </button>
              </div>
              <el-select v-model="statusFilter" class="filter-select" @change="applyFilter">
                <el-option label="全部状态" value="ALL" />
                <el-option label="草稿" value="DRAFT" />
                <el-option label="已发布" value="PUBLISHED" />
                <el-option label="已下架" value="OFF_SHELF" />
              </el-select>
              <el-select v-model="jobFilter" class="filter-select filter-select--wide" @change="applyFilter">
                <el-option label="全部岗位" value="ALL" />
                <el-option v-for="item in jobs" :key="item.id" :label="item.job_name" :value="item.id" />
              </el-select>
            </div>

            <div class="toolbar__right">
              <el-input
                v-model="keyword"
                class="toolbar__search"
                placeholder="搜索项目名称 / 说明"
                clearable
                @input="applyFilter"
                @clear="applyFilter"
              />
              <el-button type="primary" round @click="openCreate">＋ 新建项目</el-button>
            </div>
          </div>

          <el-table
            v-if="projectRows.length > 0 || store.loading"
            :data="projectRows"
            v-loading="store.loading"
            style="width: 100%"
          >
            <el-table-column label="项目名称" min-width="200">
              <template #default="{ row }">
                <div class="cell-main">
                  <p class="cell-main__title">{{ row.project_name }}</p>
                  <p v-if="row.description" class="cell-main__desc">{{ row.description }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="层级" width="90">
              <template #default="{ row }">
                <StatusPill
                  :tone="row.project_level === 'BASIC' ? 'todo' : row.project_level === 'ADVANCED' ? 'wip' : 'violet'"
                  :text="LEVEL_LABEL[row.project_level] ?? row.project_level"
                />
              </template>
            </el-table-column>
            <el-table-column label="难度" width="100">
              <template #default="{ row }">
                <span class="stars" :title="`难度 ${row.difficulty} / 5`">
                  {{ '★'.repeat(row.difficulty) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="绑定岗位" min-width="150">
              <template #default="{ row }">
                <span :class="{ muted: !row.job_id }">{{ jobNameOf(row.job_id) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="96">
              <template #default="{ row }">
                <StatusPill
                  :tone="row.status === 'PUBLISHED' ? 'done' : row.status === 'OFF_SHELF' ? 'lock' : 'wip'"
                  :text="PROJECT_STATUS_LABEL[row.status] ?? row.status"
                />
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="130">
              <template #default="{ row }">
                <span class="num muted">{{ formatDateTime(row.created_at) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <div class="ops">
                  <el-button type="primary" size="small" round @click="openEdit(row)">编辑</el-button>
                  <el-button
                    v-if="row.status !== 'PUBLISHED'"
                    size="small"
                    round
                    @click="publishProject(row)"
                  >
                    发布
                  </el-button>
                  <el-button v-else size="small" round @click="offlineProject(row)">下架</el-button>
                  <el-button class="btn-danger" size="small" round @click="removeProject(row)">
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <ListPagination
            v-model:page="projectPage"
            v-model:page-size="projectPageSize"
            :total="projectTotal"
          />

          <EmptyState
            v-if="!projectRows.length && !store.loading"
            title="没有匹配的项目"
            description="换个筛选条件，或点击「新建项目」创建一个实训项目。"
          />
        </el-tab-pane>

        <!-- ② 标准化实训模块（模块库） -->
        <el-tab-pane name="modules">
          <template #label><span class="tab-label">标准化实训模块</span></template>

          <div class="toolbar">
            <p class="toolbar__hint">
              模块库是关卡的唯一来源：项目里的关卡都从这里挑。改名称 / 默认权重会影响引用它的项目。
            </p>
            <div class="toolbar__right">
              <el-input
                v-model="templateKeyword"
                class="toolbar__search"
                placeholder="搜索模块名称 / 说明"
                clearable
              />
              <el-button type="primary" round @click="openTemplateCreate">＋ 新增模块</el-button>
            </div>
          </div>

          <el-table
            v-if="templateRows.length > 0 || store.templatesLoading"
            :data="templateRows"
            v-loading="store.templatesLoading"
            style="width: 100%"
          >
            <el-table-column prop="sort_no" label="排序" width="80" />
            <el-table-column label="模块名称" min-width="180">
              <template #default="{ row }">
                <span class="cell-main__title">{{ row.stage_name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="240">
              <template #default="{ row }">
                <span :class="{ muted: !row.description }">{{ row.description || '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="默认权重" width="110">
              <template #default="{ row }">
                <span class="num">{{ num(row.default_weight) }}%</span>
              </template>
            </el-table-column>
            <el-table-column label="默认必填" width="100">
              <template #default="{ row }">
                <StatusPill :tone="row.default_required ? 'done' : 'lock'" :text="row.default_required ? '必填' : '选填'" />
              </template>
            </el-table-column>
            <el-table-column label="默认作答要求" min-width="160">
              <template #default="{ row }">
                <span :class="{ muted: !row.default_requirement }">
                  {{ row.default_requirement || '--' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <div class="ops">
                  <el-button type="primary" size="small" round @click="openTemplateEdit(row)">
                    编辑
                  </el-button>
                  <el-button class="btn-danger" size="small" round @click="removeTemplate(row)">
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <ListPagination
            v-model:page="templatePage"
            v-model:page-size="templatePageSize"
            :total="templateTotal"
          />

          <EmptyState
            v-if="!templateRows.length && !store.templatesLoading"
            title="没有匹配的模块"
            description="换个关键词，或点「新增模块」补充关卡模板。"
          />
        </el-tab-pane>
      </el-tabs>
    </PanelBlock>

    <!-- 新建 / 编辑项目 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑实训项目' : '新建实训项目'"
      width="920px"
      align-center
      top="4vh"
      class="project-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <!-- 基本信息 -->
        <section class="block block--plain">
          <header class="block__head">
            <div>
              <p class="block__title">基本信息</p>
              <p class="block__hint">项目名全局唯一；保存后状态为「草稿」，需在列表里点「发布」</p>
            </div>
          </header>

          <div class="grid-3">
            <el-form-item label="项目名称" prop="project_name" class="grid-3__wide">
              <el-input v-model="form.project_name" placeholder="如：工业缺陷检测实训" />
            </el-form-item>
            <el-form-item label="项目层级" prop="project_level">
              <el-select v-model="form.project_level" class="full">
                <el-option label="基础" value="BASIC" />
                <el-option label="进阶" value="ADVANCED" />
                <el-option label="拓展" value="EXPANDED" />
              </el-select>
            </el-form-item>
            <el-form-item label="绑定岗位">
              <el-select v-model="form.job_id" class="full" clearable placeholder="请选择岗位">
                <el-option v-for="item in jobs" :key="item.id" :label="item.job_name" :value="item.id" />
              </el-select>
            </el-form-item>
          </div>

          <div class="grid-2">
            <el-form-item label="难度">
              <div class="star-field">
                <el-rate v-model="form.difficulty" :max="5" />
                <span class="star-field__hint">{{ difficultyText }}</span>
              </div>
            </el-form-item>
            <el-form-item label="关联技能点">
              <p class="cell-main__desc">
                技能点按<b>关卡</b>绑定：在下面的每个关卡里选择它培养的技能点，技能点亮按该关卡得分判定。
              </p>
            </el-form-item>
          </div>

          <el-form-item label="项目描述" class="form-item--last">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="2"
              resize="none"
              maxlength="500"
              show-word-limit
              placeholder="写清实训目标、面向的场景与产出物"
            />
          </el-form-item>
        </section>

        <!-- 实训模块 -->
        <section class="block">
          <header class="block__head">
            <div>
              <p class="block__title">实训模块（关卡）</p>
              <p class="block__hint">
                从模块库挑关卡，可调整顺序 / 权重 / 必填 / 作答要求，并给关卡填引导子标题与提示词
              </p>
            </div>
            <div class="block__tools">
              <span class="weight" :class="{ 'is-warn': !weightValid }">
                权重合计 <b class="num">{{ weightTotal.toFixed(2) }}</b>%
                <em v-if="!weightValid">发布前必须调整为 100</em>
              </span>
              <el-select
                v-model="templateToAdd"
                class="block__select"
                placeholder="从模块库选择"
                clearable
              >
                <el-option
                  v-for="item in availableTemplates"
                  :key="item.id"
                  :label="`${item.stage_name}（默认 ${num(item.default_weight)}%）`"
                  :value="item.id"
                />
              </el-select>
              <el-button round @click="addTemplateToDraft">加入</el-button>
              <el-button v-if="!weightValid" text type="primary" @click="normalizeWeights">
                按比例归一化到 100
              </el-button>
            </div>
          </header>

          <div v-if="moduleDrafts.length" class="modules">
            <article v-for="(draft, index) in moduleDrafts" :key="draft.moduleId ?? draft.templateId" class="module">
              <header class="module__head">
                <span class="module__index num">{{ index + 1 }}</span>
                <span class="module__name">{{ draft.stageName }}</span>
                <div class="module__ops">
                  <button class="icon-op" type="button" title="上移" :disabled="index === 0" @click="moveDraft(index, -1)">
                    上移
                  </button>
                  <button
                    class="icon-op"
                    type="button"
                    title="下移"
                    :disabled="index === moduleDrafts.length - 1"
                    @click="moveDraft(index, 1)"
                  >
                    下移
                  </button>
                  <button class="icon-op icon-op--danger" type="button" @click="removeDraft(index)">
                    移除
                  </button>
                </div>
              </header>

              <div class="module__grid">
                <label class="mini">
                  <span class="mini__label">分值占比</span>
                  <el-input-number
                    v-model="draft.weight"
                    :min="0"
                    :max="100"
                    :precision="2"
                    :controls="false"
                    class="mini__num"
                  />
                  <span class="mini__unit">%</span>
                </label>
                <label class="mini">
                  <span class="mini__label">必填</span>
                  <el-switch v-model="draft.required" />
                </label>
                <el-input v-model="draft.requirement" placeholder="作答要求，如：不少于 500 字" />
                <el-input v-model="draft.acceptStandard" placeholder="验收标准，如：指标可量化" />
              </div>

              <div class="module-skills">
                <div class="module-skills__head">
                  <span class="fld__label">
                    本关卡技能点（技能点亮按该关卡得分判定：得分率 ≥ 及格线才算这个关卡达标）
                  </span>
                  <button class="icon-op" type="button" @click="openCreateSkill(index)">
                    ＋ 新建技能点
                  </button>
                </div>
                <el-select
                  v-model="draft.skillIds"
                  class="full"
                  multiple
                  filterable
                  collapse-tags
                  placeholder="选择这个关卡培养的技能点"
                >
                  <el-option-group
                    v-for="group in skillCatalog"
                    :key="group.tree.id"
                    :label="group.tree.tree_name"
                  >
                    <el-option
                      v-for="node in group.nodes"
                      :key="node.id"
                      :label="skillOptionLabel(node)"
                      :value="node.id"
                    >
                      <span class="skill-opt" :title="node.description ?? node.node_name">
                        <span class="skill-opt__name">{{ node.node_name }}</span>
                        <span v-if="node.description" class="skill-opt__desc">{{ node.description }}</span>
                        <span v-if="isUnbound(node.id)" class="skill-opt__flag">未配岗位</span>
                      </span>
                    </el-option>
                  </el-option-group>
                </el-select>
              </div>

              <div class="items">
                <div class="items__head">
                  <span class="fld__label">引导子标题与提示词（只做引导，不参与评分）</span>
                  <button class="icon-op" type="button" @click="addItemRow(index)">＋ 添加子标题</button>
                </div>
                <div v-for="(item, itemIndex) in draft.items" :key="itemIndex" class="item-row">
                  <el-input v-model="item.title" class="item-row__title" placeholder="子标题，如：训练环境与参数" />
                  <el-input v-model="item.prompt" placeholder="提示词，如：写清框架版本、学习率、轮数" />
                  <button class="icon-op icon-op--danger" type="button" @click="removeItemRow(index, itemIndex)">
                    删除
                  </button>
                </div>
              </div>
            </article>
          </div>
          <EmptyState
            v-else
            title="还没有选择任何关卡"
            description="从右上角「从模块库选择」挑一个模块加入，或先在「标准化实训模块」里建模块。"
          />
        </section>

        <!-- 附件 -->
        <section class="block">
          <header class="block__head">
            <div>
              <p class="block__title">实训资料与评分文件</p>
              <p class="block__hint">
                单个文件 ≤ {{ MAX_UPLOAD_MB }}MB；评分标准上传即入库，供 AI 评审召回
                <template v-if="!editingId">；新建项目保存后才会真正上传</template>
              </p>
            </div>
          </header>

          <div class="upload-row">
            <el-upload
              v-for="kind in [FILE_KIND.REPORT_TEMPLATE, FILE_KIND.DATASET, FILE_KIND.GUIDE, FILE_KIND.SCORING_CRITERIA]"
              :key="kind"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="pickFileHandler(kind)"
            >
              <button class="upload-chip" type="button">＋ {{ FILE_KIND_LABEL[kind] }}</button>
            </el-upload>
          </div>

          <ul v-if="visibleFiles.length || pendingFiles.length" class="files">
            <li v-for="file in visibleFiles" :key="`existing-${file.id}`" class="file">
              <span class="tag-plain">{{ FILE_KIND_LABEL[file.file_kind] ?? file.file_kind }}</span>
              <span class="file__name">{{ file.title || file.original_name }}</span>
              <span class="file__meta num">{{ formatSize(file.size_bytes) }}</span>
              <span
                v-if="file.knowledge_status"
                class="file__meta"
                :title="`知识库状态：${file.knowledge_status}`"
              >
                已入库 {{ file.chunk_count ?? 0 }} 切片
              </span>
              <button class="icon-op icon-op--danger" type="button" @click="removeExistingFile(file.id)">
                移除
              </button>
            </li>
            <li v-for="file in pendingFiles" :key="file.uid" class="file">
              <span class="tag-skill">{{ FILE_KIND_LABEL[file.kind] ?? file.kind }}</span>
              <span class="file__name">{{ file.name }}</span>
              <span class="file__meta num">{{ formatSize(file.size) }}</span>
              <span class="file__meta">待上传</span>
              <button class="icon-op icon-op--danger" type="button" @click="removePendingFile(file.uid)">
                移除
              </button>
            </li>
          </ul>
        </section>
      </el-form>

      <template #footer>
        <span v-if="savingHint" class="saving-hint">{{ savingHint }}</span>
        <el-button round @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="saving" @click="submitProject">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增 / 编辑模块（模块库） -->
    <el-dialog
      v-model="templateDialogVisible"
      :title="editingTemplateId ? '编辑模块' : '新增模块'"
      width="560px"
      align-center
    >
      <el-form ref="templateFormRef" :model="templateForm" :rules="templateRules" label-position="top">
        <el-form-item label="模块名称" prop="stage_name">
          <el-input v-model="templateForm.stage_name" placeholder="如：模型训练（名称唯一）" />
        </el-form-item>

        <el-form-item label="模块说明">
          <el-input
            v-model="templateForm.description"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="如：训练环境搭建、参数配置与模型训练"
          />
        </el-form-item>

        <div class="form-row">
          <el-form-item label="默认分值占比">
            <span class="fld">
              <el-input-number
                v-model="templateForm.default_weight"
                :min="0"
                :max="100"
                :precision="2"
                :controls="false"
                class="fld__num"
              />
              <span class="fld__unit">%</span>
            </span>
          </el-form-item>
          <el-form-item label="默认是否必填">
            <el-switch v-model="templateForm.default_required" />
          </el-form-item>
        </div>

        <el-form-item label="默认作答要求">
          <el-input v-model="templateForm.default_requirement" placeholder="如：不少于 500 字" />
        </el-form-item>

        <el-form-item label="默认验收标准">
          <el-input v-model="templateForm.default_accept_standard" placeholder="如：方案可落地、指标可量化" />
        </el-form-item>

        <el-form-item label="展示排序">
          <el-input-number v-model="templateForm.sort_no" :min="1" :controls="false" class="fld__num" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitTemplate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="skillDialogVisible" title="新建技能点" width="520px" align-center>
      <el-form label-position="top">
        <el-form-item label="技能点名称" required>
          <el-input v-model="skillForm.node_name" placeholder="如：成像调试（名称全局唯一，重名会复用已有技能点）" />
        </el-form-item>
        <el-form-item label="所属技能体系" required>
          <el-select v-model="skillForm.tree_id" class="full" placeholder="选择技能体系">
            <el-option
              v-for="group in skillCatalog"
              :key="group.tree.id"
              :label="group.tree.tree_name"
              :value="group.tree.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="技能点说明">
          <el-input
            v-model="skillForm.description"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="一句话说明这个技能点什么、练到什么程度（学生端悬浮可看）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="skillDialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="skillSaving" @click="submitSkill">
          创建并绑定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.project-manage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tabs :deep(.el-tabs__header) {
  padding: 8px 20px 0;
  border-bottom: 1px solid var(--line);
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 16px 20px 12px;
}

.toolbar__filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar__search {
  width: 240px;
}

.filter-select {
  width: 140px;
}

.filter-select--wide {
  width: 170px;
}

.toolbar__hint {
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.7;
}

.tier-tabs {
  display: inline-flex;
  gap: 6px;
}

.tier-tab {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
}

.tier-tab:hover {
  color: var(--brand-600);
  border-color: var(--brand-300);
}

.tier-tab.is-on {
  background: var(--brand-500);
  border-color: var(--brand-500);
  color: #fff;
}

.stars {
  color: var(--gold);
  font-size: 13px;
  letter-spacing: 1px;
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

.cell-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.cell-main__title {
  font-weight: 600;
}

.cell-main__desc {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.full {
  width: 100%;
}

.form-static {
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.7;
}

.star-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.star-field__hint {
  color: var(--ink-3);
  font-size: 12.5px;
}

.block__select {
  width: 220px;
}

.weight {
  color: var(--ink-2);
  font-size: 12.5px;
}

.weight b {
  color: var(--brand-600);
  font-size: 15px;
}

.weight.is-warn b {
  color: var(--danger-ink);
}

.weight em {
  margin-left: 6px;
  color: var(--danger-ink);
  font-size: 11.5px;
  font-style: normal;
}

.modules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 只保留弹窗本体一层滚动，避免嵌套滚动带来的手感问题 */
}

.module {
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
  background: var(--surface);
}

.module__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.module__index {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 700;
}

.module__name {
  font-size: 14px;
  font-weight: 700;
}

.module__ops {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* 关卡配置：分值 / 必填 / 作答要求 / 验收标准 一行四列 */
.module__grid {
  display: grid;
  grid-template-columns: 132px 108px minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.mini {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mini__label {
  color: var(--ink-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.mini__num {
  width: 78px;
}

.mini__unit {
  color: var(--ink-3);
  font-size: 12.5px;
}

.fld__label {
  color: var(--ink-2);
  font-size: 12.5px;
}

.fld__num {
  width: 108px;
}

.fld__unit {
  color: var(--ink-3);
  font-size: 12.5px;
}

.items {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}

.items__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.item-row {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.files {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface);
}

.file__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file__meta {
  color: var(--ink-3);
  font-size: 11.5px;
}

.saving-hint {
  margin-right: auto;
  color: var(--ink-3);
  font-size: 12.5px;
}

@media (max-width: 1280px) {
  .module__grid,
  .grid-2,
  .grid-3,
  .form-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .item-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .files {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* 关卡技能点绑定 */
.module-skills {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-2, rgba(0, 0, 0, 0.08));
}

.module-skills__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.skill-opt {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.skill-opt__name {
  font-weight: 600;
}

.skill-opt__desc {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-3, #8a94a6);
  font-size: 12px;
}

.skill-opt__flag {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(230, 162, 60, 0.16);
  color: #b7791f;
  font-size: 11px;
}
</style>

<!--
  el-dialog 会被 teleport 到 body，根节点不带组件作用域属性，
  所以「弹窗本体」的高度约束必须写成非 scoped 样式（带自定义类避免外溢）。
-->
<style>
.project-dialog {
  display: flex;
  flex-direction: column;
  max-height: 92vh;
}

.project-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px;
}
</style>
