<script setup lang="ts">
/**
 * 岗位与技能体系（对接真实后端，接口文档 §6）
 *
 * 两个 Tab：
 * ① 岗位列表管理 —— 岗位增删改查（含方向标签 / 推荐层级 / 适配场景 / 热度 / 状态），
 *    并在同一个弹窗里维护「岗位关联技能点」（覆盖式写入 `/jobs/{id}/skills`）；
 * ② 技能管理 —— 技能树（四大体系）与技能点的增删改查：
 *    左栏选技能树、右栏维护该树的技能点，技能点可设前置技能（技能树的连线来源）。
 */

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import PanelBlock from '@/components/PanelBlock.vue'
import StatusPill from '@/components/StatusPill.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListPagination from '@/components/ListPagination.vue'
import { usePaging } from '@/composables/usePaging'
import { useCatalogStore } from '@/stores/catalog'
import { fetchSkillCatalog } from '@/api/backend/catalog'
import { LEVEL_LABEL, JOB_STATUS_LABEL } from '@/config/backend'
import type { JobRead, SkillTreeNode, SkillTreeRead } from '@/api/backend/types'

const route = useRoute()
const router = useRouter()
const store = useCatalogStore()

const activeTab = ref<string>(typeof route.query.tab === 'string' ? route.query.tab : 'list')
watch(activeTab, (value) => {
  void router.replace({ query: { ...route.query, tab: value } })
})

/** 技能点选择器用的「技能树 → 节点」字典 */
const skillCatalog = ref<{ tree: SkillTreeRead; nodes: SkillTreeNode[] }[]>([])

async function loadSkillCatalog(): Promise<void> {
  skillCatalog.value = await fetchSkillCatalog()
}

/* -------------------------------------------------------------------------- */
/* Tab 1 · 岗位列表管理                                                        */
/* -------------------------------------------------------------------------- */

const keyword = ref('')
const levelFilter = ref('ALL')
const statusFilter = ref('ALL')

const filteredJobs = computed(() =>
  store.jobs
    .filter((item) => (levelFilter.value === 'ALL' ? true : item.recommended_level === levelFilter.value))
    .filter((item) => (statusFilter.value === 'ALL' ? true : item.status === statusFilter.value))
    .filter((item) => {
      const target = keyword.value.trim().toLowerCase()
      if (!target) return true
      return (
        item.job_name.toLowerCase().includes(target) ||
        (item.direction_tag ?? '').toLowerCase().includes(target) ||
        (item.scene ?? '').toLowerCase().includes(target)
      )
    }),
)

const {
  page: jobPage,
  pageSize: jobPageSize,
  total: jobTotal,
  paged: jobRows,
  reset: resetJobPage,
} = usePaging(() => filteredJobs.value)

watch([keyword, levelFilter, statusFilter], () => resetJobPage())

const levelOptions = [
  { value: 'ALL', label: '全部层级' },
  { value: 'BASIC', label: '基础' },
  { value: 'ADVANCED', label: '进阶' },
  { value: 'EXPANDED', label: '拓展' },
]

/* —— 岗位弹窗 —— */

const jobDialogVisible = ref(false)
const editingJobId = ref<number | null>(null)
const jobSaving = ref(false)
const jobFormRef = ref<FormInstance>()
const jobSkillIds = ref<number[]>([])

const jobForm = reactive({
  job_name: '',
  direction_tag: '',
  recommended_level: 'BASIC' as 'BASIC' | 'ADVANCED' | 'EXPANDED',
  scene: '',
  description: '',
  heat: 0,
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
})

const jobRules: FormRules = {
  job_name: [{ required: true, message: '请输入岗位名称', trigger: 'blur' }],
}

async function openJobCreate(): Promise<void> {
  editingJobId.value = null
  jobSkillIds.value = []
  Object.assign(jobForm, {
    job_name: '',
    direction_tag: '',
    recommended_level: 'BASIC',
    scene: '',
    description: '',
    heat: 0,
    status: 'ENABLED',
  })
  await loadSkillCatalog()
  jobDialogVisible.value = true
}

async function openJobEdit(row: JobRead): Promise<void> {
  editingJobId.value = row.id
  Object.assign(jobForm, {
    job_name: row.job_name,
    direction_tag: row.direction_tag ?? '',
    recommended_level: row.recommended_level ?? 'BASIC',
    scene: row.scene ?? '',
    description: row.description ?? '',
    heat: row.heat ?? 0,
    status: row.status,
  })
  await loadSkillCatalog()
  // 岗位详情不含技能，单独查一次回填
  jobSkillIds.value = (await store.loadJobSkills(row.id)).map((item) => item.id)
  jobDialogVisible.value = true
}

async function submitJob(): Promise<void> {
  const valid = await jobFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    job_name: jobForm.job_name.trim(),
    direction_tag: jobForm.direction_tag.trim() || null,
    recommended_level: jobForm.recommended_level,
    scene: jobForm.scene.trim() || null,
    description: jobForm.description.trim() || null,
    heat: jobForm.heat,
    status: jobForm.status,
  }

  jobSaving.value = true
  try {
    let jobId = editingJobId.value ?? 0
    if (editingJobId.value) {
      await store.update(editingJobId.value, payload)
    } else {
      const created = await store.create(payload)
      jobId = created.id
    }
    // 关联技能：覆盖式写入（与项目里的技能关联同一套口径）
    await store.saveJobSkills(jobId, jobSkillIds.value)

    jobDialogVisible.value = false
    ElMessage.success(editingJobId.value ? '岗位已更新' : '岗位已创建')
  } catch {
    /* 失败原因由请求层统一提示（如岗位重名） */
  } finally {
    jobSaving.value = false
  }
}

async function removeJob(row: JobRead): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后岗位从列表消失（岗位关联的技能关系一并解除，学生的历史进度保留）。确认删除「${row.job_name}」？`,
      '删除岗位',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await store.remove(row.id)
    ElMessage.success('岗位已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* -------------------------------------------------------------------------- */
/* Tab 2 · 技能管理（技能树 + 技能点）                                          */
/* -------------------------------------------------------------------------- */

const activeTreeId = ref<number | null>(null)
const nodeKeyword = ref('')

const activeTree = computed<SkillTreeRead | null>(
  () => store.trees.find((item) => item.id === activeTreeId.value) ?? null,
)

const filteredNodes = computed(() => {
  const target = nodeKeyword.value.trim().toLowerCase()
  if (!target) return store.nodes
  return store.nodes.filter(
    (item) =>
      item.node_name.toLowerCase().includes(target) ||
      item.node_code.toLowerCase().includes(target) ||
      (item.description ?? '').toLowerCase().includes(target),
  )
})

const {
  page: nodePage,
  pageSize: nodePageSize,
  total: nodeTotal,
  paged: nodeRows,
  reset: resetNodePage,
} = usePaging(() => filteredNodes.value)

watch(nodeKeyword, () => resetNodePage())

async function pickTree(tree: SkillTreeRead): Promise<void> {
  activeTreeId.value = tree.id
  nodeKeyword.value = ''
  await store.loadNodes(tree.id)
  resetNodePage()
}

/* —— 技能树弹窗 —— */

const treeDialogVisible = ref(false)
const editingTreeId = ref<number | null>(null)
const treeFormRef = ref<FormInstance>()

const treeForm = reactive({
  tree_code: '',
  tree_name: '',
  description: '',
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
})

const treeRules: FormRules = {
  tree_code: [{ required: true, message: '请输入技能树编码', trigger: 'blur' }],
  tree_name: [{ required: true, message: '请输入技能树名称', trigger: 'blur' }],
}

function openTreeCreate(): void {
  editingTreeId.value = null
  Object.assign(treeForm, { tree_code: '', tree_name: '', description: '', status: 'ENABLED' })
  treeDialogVisible.value = true
}

function openTreeEdit(row: SkillTreeRead): void {
  editingTreeId.value = row.id
  Object.assign(treeForm, {
    tree_code: row.tree_code,
    tree_name: row.tree_name,
    description: row.description ?? '',
    status: row.status,
  })
  treeDialogVisible.value = true
}

async function submitTree(): Promise<void> {
  const valid = await treeFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    tree_code: treeForm.tree_code.trim().toUpperCase(),
    tree_name: treeForm.tree_name.trim(),
    description: treeForm.description.trim() || null,
    status: treeForm.status,
  }

  try {
    if (editingTreeId.value) {
      await store.updateTree(editingTreeId.value, payload)
      ElMessage.success('技能树已更新')
    } else {
      const created = await store.createTree(payload)
      ElMessage.success('技能树已创建，可以开始加技能点')
      await pickTree(created)
    }
    treeDialogVisible.value = false
  } catch {
    /* 提示已由请求层给出（如编码重复） */
  }
}

async function removeTree(row: SkillTreeRead): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后「${row.tree_name}」不再出现在技能树里，树下的技能点也会一并软删。确认删除？`,
      '删除技能树',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await store.removeTree(row.id)
    if (activeTreeId.value === row.id) {
      activeTreeId.value = null
      // 删掉的正是当前选中项：自动落到第一棵树上，避免右侧空白
      const next = store.trees[0]
      if (next) await pickTree(next)
    }
    ElMessage.success('技能树已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* —— 技能点弹窗 —— */

const nodeDialogVisible = ref(false)
const editingNodeId = ref<number | null>(null)
const nodeFormRef = ref<FormInstance>()
const nodeSaving = ref(false)
const prerequisiteIds = ref<number[]>([])

const nodeForm = reactive({
  node_code: '',
  node_name: '',
  description: '',
  unlock_note: '',
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
})

const nodeRules: FormRules = {
  node_code: [{ required: true, message: '请输入技能点编码', trigger: 'blur' }],
  node_name: [{ required: true, message: '请输入技能点名称', trigger: 'blur' }],
}

/** 前置技能候选：同一棵树里除自己以外的技能点 */
const prerequisiteOptions = computed(() =>
  store.nodes.filter((item) => item.id !== editingNodeId.value),
)

function nodeNameOf(id: number): string {
  return store.nodes.find((item) => item.id === id)?.node_name ?? `技能点 #${id}`
}

async function openNodeCreate(): Promise<void> {
  editingNodeId.value = null
  prerequisiteIds.value = []
  Object.assign(nodeForm, {
    node_code: '',
    node_name: '',
    description: '',
    unlock_note: '',
    status: 'ENABLED',
  })
  nodeDialogVisible.value = true
}

async function openNodeEdit(row: SkillTreeNode): Promise<void> {
  editingNodeId.value = row.id
  Object.assign(nodeForm, {
    node_code: row.node_code,
    node_name: row.node_name,
    description: row.description ?? '',
    unlock_note: row.unlock_note ?? '',
    status: row.status,
  })
  prerequisiteIds.value = await store.loadDependencies(row.id)
  nodeDialogVisible.value = true
}

async function submitNode(): Promise<void> {
  const valid = await nodeFormRef.value?.validate().catch(() => false)
  if (!valid || !activeTreeId.value) return

  const payload = {
    node_code: nodeForm.node_code.trim().toUpperCase(),
    node_name: nodeForm.node_name.trim(),
    description: nodeForm.description.trim() || null,
    unlock_note: nodeForm.unlock_note.trim() || null,
    status: nodeForm.status,
  }

  nodeSaving.value = true
  try {
    let nodeId = editingNodeId.value ?? 0
    if (editingNodeId.value) {
      await store.updateNode(activeTreeId.value, editingNodeId.value, payload)
    } else {
      const created = await store.createNode(activeTreeId.value, payload)
      nodeId = created.id
    }
    // 前置技能：覆盖式写入（后端会拦自环与环路）
    await store.saveDependencies(nodeId, prerequisiteIds.value)
    // 依赖改完要重新拉一次列表，否则「前置技能」列还是旧值
    await store.loadNodes(activeTreeId.value)

    nodeDialogVisible.value = false
    ElMessage.success(editingNodeId.value ? '技能点已更新' : '技能点已新增')
  } catch {
    /* 提示已由请求层给出 */
  } finally {
    nodeSaving.value = false
  }
}

async function removeNode(row: SkillTreeNode): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后技能点「${row.node_name}」不再出现在技能树里（引用它的岗位 / 项目关联同时失效）。确认删除？`,
      '删除技能点',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  if (!activeTreeId.value) return
  try {
    await store.removeNode(activeTreeId.value, row.id)
    ElMessage.success('技能点已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* -------------------------------------------------------------------------- */

onMounted(async () => {
  await Promise.all([store.loadJobs(), store.loadTrees(), loadSkillCatalog()])
  const first = store.trees[0]
  if (first) await pickTree(first)
})
</script>

<template>
  <div class="position-skill">
    <PanelBlock :padded="false">
      <el-tabs v-model="activeTab" class="tabs">
        <!-- ① 岗位列表管理 -->
        <el-tab-pane name="list">
          <template #label><span class="tab-label">岗位列表管理</span></template>

          <div class="toolbar">
            <div class="toolbar__filters">
              <el-input
                v-model="keyword"
                class="toolbar__search"
                placeholder="搜索岗位 / 方向 / 场景"
                clearable
              />
              <el-select v-model="levelFilter" class="filter-select">
                <el-option
                  v-for="item in levelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-select v-model="statusFilter" class="filter-select">
                <el-option label="全部状态" value="ALL" />
                <el-option label="启用" value="ENABLED" />
                <el-option label="停用" value="DISABLED" />
              </el-select>
            </div>
            <el-button type="primary" round @click="openJobCreate">＋ 新增岗位</el-button>
          </div>

          <el-table
            v-if="jobRows.length > 0 || store.jobsLoading"
            :data="jobRows"
            v-loading="store.jobsLoading"
            style="width: 100%"
          >
            <el-table-column label="岗位名称" min-width="170">
              <template #default="{ row }">
                <div class="cell-main">
                  <p class="cell-main__title">{{ row.job_name }}</p>
                  <p v-if="row.description" class="cell-main__desc">{{ row.description }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="方向标签" width="110">
              <template #default="{ row }">
                <span :class="{ muted: !row.direction_tag }">{{ row.direction_tag || '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="推荐层级" width="100">
              <template #default="{ row }">
                <StatusPill
                  v-if="row.recommended_level"
                  :tone="
                    row.recommended_level === 'BASIC'
                      ? 'todo'
                      : row.recommended_level === 'ADVANCED'
                        ? 'wip'
                        : 'violet'
                  "
                  :text="LEVEL_LABEL[row.recommended_level] ?? row.recommended_level"
                />
                <span v-else class="muted">--</span>
              </template>
            </el-table-column>
            <el-table-column label="适配场景" min-width="150">
              <template #default="{ row }">
                <span :class="{ muted: !row.scene }">{{ row.scene || '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="热度" width="90">
              <template #default="{ row }">
                <span class="num">{{ row.heat ?? 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column label="关联技能" width="100">
              <template #default="{ row }">
                <span class="num">{{ row.skill_count ?? 0 }}</span>
                <span class="muted"> 个</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <StatusPill
                  :tone="row.status === 'ENABLED' ? 'done' : 'lock'"
                  :text="JOB_STATUS_LABEL[row.status] ?? row.status"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <div class="ops">
                  <el-button type="primary" size="small" round @click="openJobEdit(row)">编辑</el-button>
                  <el-button class="btn-danger" size="small" round @click="removeJob(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <ListPagination
            v-model:page="jobPage"
            v-model:page-size="jobPageSize"
            :total="jobTotal"
          />

          <EmptyState
            v-if="!jobRows.length && !store.jobsLoading"
            title="没有匹配的岗位"
            description="换个筛选条件，或点「新增岗位」建立一个岗位并关联技能点。"
          />
        </el-tab-pane>

        <!-- ② 技能管理：技能树 + 技能点 -->
        <el-tab-pane name="skill">
          <template #label><span class="tab-label">技能管理</span></template>

          <div class="skill-admin">
            <!-- 左：技能树 -->
            <aside class="systems">
              <header class="systems__head">
                <p class="systems__title">技能树</p>
                <button class="add-mini" type="button" @click="openTreeCreate">＋ 新建</button>
              </header>

              <ul v-if="store.trees.length" class="systems__list">
                <li v-for="tree in store.trees" :key="tree.id">
                  <button
                    class="sys-item"
                    :class="{ 'is-on': activeTreeId === tree.id }"
                    type="button"
                    @click="pickTree(tree)"
                  >
                    <span class="sys-item__name">{{ tree.tree_name }}</span>
                    <span class="sys-item__count num">
                      {{ activeTreeId === tree.id ? store.nodes.length : '' }}
                    </span>
                  </button>
                  <p class="sys-item__code num">{{ tree.tree_code }}</p>
                </li>
              </ul>
              <p v-else class="systems__empty">还没有技能树，点右上「＋ 新建」创建一棵。</p>

              <p class="systems__note">
                技能树是技能点的分组（对应学生端技能树的四大体系），
                选中后在右侧维护技能点与前置关系。
              </p>
            </aside>

            <!-- 右：技能点 -->
            <section class="points">
              <template v-if="activeTree">
                <header class="points__head">
                  <div class="points__title">
                    <p class="points__name">{{ activeTree.tree_name }}</p>
                    <p class="points__desc">
                      {{ activeTree.description || '暂无说明' }}
                    </p>
                  </div>
                  <div class="points__ops">
                    <StatusPill
                      :tone="activeTree.status === 'ENABLED' ? 'done' : 'lock'"
                      :text="activeTree.status === 'ENABLED' ? '启用' : '停用'"
                    />
                    <button class="icon-op" type="button" @click="openTreeEdit(activeTree)">编辑技能树</button>
                    <button
                      class="icon-op icon-op--danger"
                      type="button"
                      @click="removeTree(activeTree)"
                    >
                      删除技能树
                    </button>
                  </div>
                </header>

                <div class="points__toolbar">
                  <el-input
                    v-model="nodeKeyword"
                    class="toolbar__search"
                    placeholder="搜索技能点名称 / 编码"
                    clearable
                  />
                  <span class="points__stat">技能点 <b class="num">{{ store.nodes.length }}</b></span>
                  <el-button type="primary" round @click="openNodeCreate">＋ 新建技能点</el-button>
                </div>

                <el-table
                  v-if="nodeRows.length > 0 || store.nodesLoading"
                  :data="nodeRows"
                  v-loading="store.nodesLoading"
                  style="width: 100%"
                >
                  <el-table-column label="技能点" min-width="180">
                    <template #default="{ row }">
                      <div class="cell-main">
                        <p class="cell-main__title">{{ row.node_name }}</p>
                        <p class="cell-main__code num">{{ row.node_code }}</p>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="说明" min-width="180">
                    <template #default="{ row }">
                      <span :class="{ muted: !row.description }">{{ row.description || '--' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="解锁说明（学生端可见）" min-width="160">
                    <template #default="{ row }">
                      <span :class="{ muted: !row.unlock_note }">{{ row.unlock_note || '--' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="前置技能" min-width="160">
                    <template #default="{ row }">
                      <span v-if="!row.prerequisite_ids?.length" class="muted">无</span>
                      <span v-else class="prereq">
                        {{ row.prerequisite_ids.map((id: number) => nodeNameOf(id)).join('、') }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="状态" width="90">
                    <template #default="{ row }">
                      <StatusPill
                        :tone="row.status === 'ENABLED' ? 'done' : 'lock'"
                        :text="row.status === 'ENABLED' ? '启用' : '停用'"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="170" fixed="right">
                    <template #default="{ row }">
                      <div class="ops">
                        <el-button type="primary" size="small" round @click="openNodeEdit(row)">
                          编辑
                        </el-button>
                        <el-button class="btn-danger" size="small" round @click="removeNode(row)">
                          删除
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>

                <ListPagination
                  v-model:page="nodePage"
                  v-model:page-size="nodePageSize"
                  :total="nodeTotal"
                />

                <EmptyState
                  v-if="!nodeRows.length && !store.nodesLoading"
                  :title="nodeKeyword ? '没有匹配的技能点' : '这棵技能树还没有技能点'"
                  description="点「＋ 新建技能点」把最小能力单元加进来，可同时设置前置技能。"
                />
              </template>

              <EmptyState
                v-else
                title="请先在左侧选择一棵技能树"
                description="技能点挂在技能树下；没有技能树时先点左侧「＋ 新建」。"
              />
            </section>
          </div>
        </el-tab-pane>
      </el-tabs>
    </PanelBlock>

    <!-- 新增 / 编辑岗位 -->
    <el-dialog
      v-model="jobDialogVisible"
      :title="editingJobId ? '编辑岗位' : '新增岗位'"
      width="640px"
      align-center
    >
      <el-form ref="jobFormRef" :model="jobForm" :rules="jobRules" label-position="top">
        <div class="grid-2">
          <el-form-item label="岗位名称" prop="job_name">
            <el-input v-model="jobForm.job_name" placeholder="如：工业视觉工程师（名称唯一）" />
          </el-form-item>
          <el-form-item label="方向标签">
            <el-input v-model="jobForm.direction_tag" placeholder="如：机器视觉" />
          </el-form-item>
        </div>

        <div class="grid-3">
          <el-form-item label="推荐层级">
            <el-select v-model="jobForm.recommended_level" class="full">
              <el-option label="基础" value="BASIC" />
              <el-option label="进阶" value="ADVANCED" />
              <el-option label="拓展" value="EXPANDED" />
            </el-select>
          </el-form-item>
          <el-form-item label="岗位状态">
            <el-select v-model="jobForm.status" class="full">
              <el-option label="启用" value="ENABLED" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
          <el-form-item label="热度">
            <el-input-number v-model="jobForm.heat" :min="0" :controls="false" class="full" />
          </el-form-item>
        </div>

        <el-form-item label="适配实训场景">
          <el-input v-model="jobForm.scene" placeholder="如：工业缺陷检测实训" />
        </el-form-item>

        <el-form-item label="岗位简介">
          <el-input
            v-model="jobForm.description"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="这个岗位做什么、需要什么能力"
          />
        </el-form-item>

        <el-form-item label="关联技能点（岗位技能，用于岗位与项目的匹配度）">
          <el-select v-model="jobSkillIds" class="full" multiple filterable placeholder="选择技能点">
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
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button round @click="jobDialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="jobSaving" @click="submitJob">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增 / 编辑技能树 -->
    <el-dialog
      v-model="treeDialogVisible"
      :title="editingTreeId ? '编辑技能树' : '新建技能树'"
      width="520px"
      align-center
    >
      <el-form ref="treeFormRef" :model="treeForm" :rules="treeRules" label-position="top">
        <div class="grid-2">
          <el-form-item label="技能树编码" prop="tree_code">
            <el-input v-model="treeForm.tree_code" placeholder="如：DEEP_LEARNING（唯一）" />
          </el-form-item>
          <el-form-item label="技能树名称" prop="tree_name">
            <el-input v-model="treeForm.tree_name" placeholder="如：深度学习系" />
          </el-form-item>
        </div>

        <el-form-item label="说明">
          <el-input
            v-model="treeForm.description"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="这棵技能树覆盖的能力范围"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-select v-model="treeForm.status" class="full">
            <el-option label="启用" value="ENABLED" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="treeDialogVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitTree">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增 / 编辑技能点 -->
    <el-dialog
      v-model="nodeDialogVisible"
      :title="editingNodeId ? '编辑技能点' : '新建技能点'"
      width="560px"
      align-center
    >
      <el-form ref="nodeFormRef" :model="nodeForm" :rules="nodeRules" label-position="top">
        <div class="grid-2">
          <el-form-item label="技能点编码" prop="node_code">
            <el-input v-model="nodeForm.node_code" placeholder="如：MODEL_TRAIN（全局唯一）" />
          </el-form-item>
          <el-form-item label="技能点名称" prop="node_name">
            <el-input v-model="nodeForm.node_name" placeholder="如：模型训练" />
          </el-form-item>
        </div>

        <el-form-item :label="`所属技能树（${activeTree?.tree_name ?? '--'}）`">
          <span class="form-static">
            技能点挂在当前选中的技能树下；要换树请先在左侧切换目标技能树后新建。
          </span>
        </el-form-item>

        <el-form-item label="能力说明">
          <el-input
            v-model="nodeForm.description"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="如：能独立完成训练环境搭建与参数配置"
          />
        </el-form-item>

        <el-form-item label="解锁说明（学生端技能树里展示）">
          <el-input v-model="nodeForm.unlock_note" placeholder="如：完成基础项目后解锁" />
        </el-form-item>

        <el-form-item label="前置技能（覆盖式；不能选自己、不能成环）">
          <el-select
            v-model="prerequisiteIds"
            class="full"
            multiple
            filterable
            clearable
            placeholder="选择前置技能点"
          >
            <el-option
              v-for="item in prerequisiteOptions"
              :key="item.id"
              :label="item.node_name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="状态">
          <el-select v-model="nodeForm.status" class="full">
            <el-option label="启用" value="ENABLED" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="nodeDialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="nodeSaving" @click="submitNode">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.position-skill {
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
  flex-wrap: wrap;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar__search {
  width: 220px;
}

.filter-select {
  width: 130px;
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

.cell-main__code {
  color: var(--ink-3);
  font-size: 11.5px;
}

.prereq {
  color: var(--brand-600);
  font-size: 12.5px;
}

.form-static {
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.7;
}

.full {
  width: 100%;
}

/* —— 技能管理：左树右点 —— */
.skill-admin {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  align-items: start;
  gap: 20px;
  padding: 16px 20px 20px;
}

.systems {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-md);
  background: var(--surface-2);
}

.systems__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px 4px;
}

.systems__title {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.add-mini {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.add-mini:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}

.systems__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sys-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--ink-2);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}

.sys-item:hover {
  background: var(--surface);
  color: var(--ink-1);
}

.sys-item.is-on {
  background: var(--brand-050);
  color: var(--brand-600);
  font-weight: 700;
}

.sys-item__name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sys-item__count {
  flex: none;
  color: var(--brand-600);
  font-size: 12px;
}

.sys-item__code {
  padding: 0 10px;
  color: var(--ink-3);
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

.systems__empty {
  padding: 0 8px;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.7;
}

.systems__note {
  padding: 8px 8px 0;
  border-top: 1px solid var(--line);
  color: var(--ink-3);
  font-size: 11.5px;
  line-height: 1.7;
}

.points {
  min-width: 0;
}

.points__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-soft);
}

.points__name {
  font-size: 15.5px;
  font-weight: 700;
}

.points__desc {
  margin-top: 2px;
  color: var(--ink-3);
  font-size: 12px;
}

.points__ops {
  display: flex;
  align-items: center;
  gap: 8px;
}

.points__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 0;
}

.points__stat {
  color: var(--ink-2);
  font-size: 12.5px;
}

.points__stat b {
  margin-left: 2px;
  color: var(--ink-1);
  font-size: 14px;
}

@media (max-width: 1280px) {
  .skill-admin,
  .grid-2,
  .grid-3 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
