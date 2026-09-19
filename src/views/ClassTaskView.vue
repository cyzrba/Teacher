<script setup lang="ts">
/**
 * 班级与任务管理（对接真实后端，接口文档 §4 / §5 / §8）
 *
 * 两个 Tab：
 * ① 班级管理 —— 班级列表来自教师工作台总览 `GET /teachers/{id}/classes`
 *    （学生数 / 分组 / 任务进度 / 平均完成率一次拿到）：班级增删改查、
 *    名单 Excel 导入、自定义分组 + 随机分组；
 * ② 任务下发 —— 任务的增删改查 + 立即发布 / 撤回，可按班级与分组筛选查看。
 *    「数据导出」按要求先不做。
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
import { useOrgStore } from '@/stores/org'
import { useTasksStore } from '@/stores/tasks'
import { fetchJobs } from '@/api/backend/catalog'
import {
  addClassStudent,
  importClassStudents,
  importTemplateUrl,
  resetClassStudentPassword,
} from '@/api/backend/organization'
import { fetchPublishableProjects } from '@/api/backend/tasks'
import { formatDateTime } from '@/api/backend/client'
import {
  CLASS_STATUS_LABEL,
  CURRENT_TEACHER_ID,
  LEVEL_LABEL,
  PUBLISH_MODE_LABEL,
  TASK_STATUS_LABEL,
} from '@/config/backend'
import type {
  ClassStudent,
  GroupMember,
  JobRead,
  PublishableProject,
  TaskTarget,
  TeacherClassSummary,
} from '@/api/backend/types'

const route = useRoute()
const router = useRouter()
const org = useOrgStore()
const tasks = useTasksStore()

const activeTab = ref<string>(typeof route.query.tab === 'string' ? route.query.tab : 'class')
watch(activeTab, (value) => {
  void router.replace({ query: { ...route.query, tab: value } })
})

const jobs = ref<JobRead[]>([])

/* -------------------------------------------------------------------------- */
/* Tab 1 · 班级管理                                                            */
/* -------------------------------------------------------------------------- */

const classKeyword = ref('')
const statusFilter = ref('ALL')

const classRows = computed(() =>
  org.classes
    .filter((item) => (statusFilter.value === 'ALL' ? true : item.status === statusFilter.value))
    .filter((item) => {
      const target = classKeyword.value.trim().toLowerCase()
      if (!target) return true
      return (
        item.class_name.toLowerCase().includes(target) ||
        (item.remark ?? '').toLowerCase().includes(target)
      )
    }),
)

const groupMemberCount = (row: TeacherClassSummary): number =>
  row.groups.reduce((sum, group) => sum + group.member_count, 0)

/* —— 班级弹窗 —— */

const classDialogVisible = ref(false)
const editingClassId = ref<number | null>(null)
const classFormRef = ref<FormInstance>()

const classForm = reactive({
  class_name: '',
  grade_year: new Date().getFullYear(),
  group_count: 0,
  remark: '',
  status: 'ACTIVE' as 'ACTIVE' | 'ARCHIVED',
})

const classRules: FormRules = {
  class_name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }],
}

function openClassCreate(): void {
  editingClassId.value = null
  Object.assign(classForm, {
    class_name: '',
    grade_year: new Date().getFullYear(),
    group_count: 0,
    remark: '',
    status: 'ACTIVE',
  })
  classDialogVisible.value = true
}

function openClassEdit(row: TeacherClassSummary): void {
  editingClassId.value = row.class_id
  Object.assign(classForm, {
    class_name: row.class_name,
    grade_year: row.grade_year ?? new Date().getFullYear(),
    group_count: row.group_count,
    remark: row.remark ?? '',
    status: row.status,
  })
  classDialogVisible.value = true
}

async function submitClass(): Promise<void> {
  const valid = await classFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    class_name: classForm.class_name.trim(),
    grade_year: classForm.grade_year,
    group_count: classForm.group_count,
    remark: classForm.remark.trim() || null,
    status: classForm.status,
    head_teacher_id: CURRENT_TEACHER_ID,
  }

  try {
    if (editingClassId.value) {
      await org.update(editingClassId.value, payload)
      ElMessage.success('班级已更新')
    } else {
      await org.create(payload)
      ElMessage.success('班级已创建，可继续导入名单与分组')
    }
    classDialogVisible.value = false
  } catch {
    /* 提示已由请求层给出 */
  }
}

async function removeClass(row: TeacherClassSummary): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后班级从列表消失（学生账号与闯关记录保留，但不再被该班任务覆盖）。确认删除「${row.class_name}」？`,
      '删除班级',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await org.remove(row.class_id)
    ElMessage.success('班级已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* —— 学生与分组面板 —— */

const rosterVisible = ref(false)
const activeClass = ref<TeacherClassSummary | null>(null)
const rosterKeyword = ref('')
const rosterUngroupedOnly = ref(false)
const rosterPage = ref(1)
const rosterPageSize = ref(10)
const importVisible = ref(false)
const importFile = ref<File | null>(null)
const importDryRun = ref(true)
const importing = ref(false)
const addStudentVisible = ref(false)
const addStudentForm = reactive({ user_no: '', real_name: '', group_no: undefined as number | undefined })
const randomGroupCount = ref(4)
const grouping = ref(false)

const rosterRows = computed(() => org.roster)
const rosterTotal = computed(() => org.rosterTotal)

const classGroups = computed(() => org.groups)
const ungroupedStudents = computed<GroupMember[]>(() =>
  activeClass.value ? org.ungroupedOf(activeClass.value.class_id) : [],
)

async function openRoster(row: TeacherClassSummary): Promise<void> {
  activeClass.value = row
  rosterVisible.value = true
  rosterKeyword.value = ''
  rosterUngroupedOnly.value = false
  rosterPage.value = 1
  await Promise.all([refreshRoster(), org.loadGroups(row.class_id)])
}

async function refreshRoster(): Promise<void> {
  if (!activeClass.value) return
  await org.loadRoster(activeClass.value.class_id, {
    page: rosterPage.value,
    page_size: rosterPageSize.value,
    keyword: rosterKeyword.value.trim() || undefined,
    ungrouped: rosterUngroupedOnly.value || undefined,
  })
}

async function refreshGroups(): Promise<void> {
  if (!activeClass.value) return
  await org.loadGroups(activeClass.value.class_id)
  await org.loadOverview()
  const updated = org.classes.find((item) => item.class_id === activeClass.value?.class_id)
  if (updated) activeClass.value = updated
}

async function addGroupPrompt(): Promise<void> {
  if (!activeClass.value) return
  try {
    const result = await ElMessageBox.prompt('输入分组名称', '新建分组', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputValue: `第${org.groups.length + 1}组`,
      inputPattern: /\S+/,
      inputErrorMessage: '分组名称不能为空',
    })
    await org.addGroup(activeClass.value.class_id, result.value.trim())
    await refreshGroups()
    ElMessage.success('分组已创建')
  } catch {
    /* 取消或接口报错（提示已由请求层给出） */
  }
}

async function removeGroup(groupId: number, groupName: string): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除分组「${groupName}」？组内学生会回到未分组。`, '删除分组', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  if (!activeClass.value) return
  try {
    await org.removeGroup(groupId, activeClass.value.class_id)
    await refreshGroups()
    ElMessage.success('分组已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/** 把某个学生移到指定分组（分组下拉） */
async function onStudentGroupChange(
  student: ClassStudent | GroupMember,
  groupId: number,
): Promise<void> {
  if (!activeClass.value) return
  const classStudentId = 'class_student_id' in student ? student.class_student_id : student.id
  const currentGroupId = 'group_id' in student ? student.group_id : undefined
  try {
    await org.moveStudent(activeClass.value.class_id, classStudentId, groupId, currentGroupId)
    await refreshGroups()
    await refreshRoster()
  } catch {
    /* 提示已由请求层给出 */
  }
}

/** 随机分组：把未分组学生打散后按人数均衡塞进现有分组 */
async function randomGrouping(): Promise<void> {
  if (!activeClass.value) return
  if (org.groups.length === 0) {
    ElMessage.warning('当前班级还没有分组，请先点「＋ 新建分组」建立分组')
    return
  }
  const pool = [...ungroupedStudents.value]
  if (pool.length === 0) {
    ElMessage.warning('没有未分组的学生')
    return
  }

  grouping.value = true
  try {
    // 洗牌后按「人数尽量均衡」分桶
    const shuffled = pool
      .map((item) => ({ item, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((entry) => entry.item)
    const buckets: number[][] = org.groups.map(() => [])
    shuffled.forEach((member, index) => {
      const bucket = buckets[index % org.groups.length]
      bucket?.push(member.class_student_id)
    })

    for (let index = 0; index < org.groups.length; index += 1) {
      const group = org.groups[index]
      const ids = buckets[index] ?? []
      if (group && ids.length > 0) {
        await org.assignToGroup(activeClass.value.class_id, group.id, ids)
      }
    }

    await refreshGroups()
    await refreshRoster()
    ElMessage.success(`已把 ${shuffled.length} 名学生随机分到 ${org.groups.length} 个分组`)
  } catch {
    /* 提示已由请求层给出 */
  } finally {
    grouping.value = false
  }
}

function pickImportFile(file: UploadFile): void {
  importFile.value = file.raw ?? null
}

async function submitImport(): Promise<void> {
  if (!activeClass.value || !importFile.value) {
    ElMessage.warning('请先选择 xlsx 名单文件')
    return
  }
  importing.value = true
  try {
    const result = await importClassStudents(activeClass.value.class_id, importFile.value, {
      dryRun: importDryRun.value,
    })
    if (importDryRun.value) {
      ElMessage.success(
        `预校验通过：共 ${result.total} 行，可新建账号 ${result.created_users} 个（未落库）`,
      )
    } else {
      ElMessage.success(
        `导入完成：新建账号 ${result.created_users} 个，在班记录 ${result.created_class_students} 条`,
      )
      importVisible.value = false
      importFile.value = null
      await refreshRoster()
      await refreshGroups()
    }
  } catch {
    // 逐行错误明细在响应 data 里，这里给出可操作的提示
    ElMessage.warning('名单未通过校验，请按模板修正后重试（详见后端返回的逐行原因）')
  } finally {
    importing.value = false
  }
}

async function submitAddStudent(): Promise<void> {
  if (!activeClass.value) return
  if (!addStudentForm.user_no.trim()) {
    ElMessage.warning('请输入学号')
    return
  }
  try {
    await addClassStudent(activeClass.value.class_id, {
      user_no: addStudentForm.user_no.trim(),
      real_name: addStudentForm.real_name.trim() || undefined,
      group_no: addStudentForm.group_no,
    })
    ElMessage.success('已加入班级')
    addStudentVisible.value = false
    Object.assign(addStudentForm, { user_no: '', real_name: '', group_no: undefined })
    await refreshRoster()
    await refreshGroups()
  } catch {
    /* 提示已由请求层给出 */
  }
}

async function resetPassword(): Promise<void> {
  if (!activeClass.value) return
  try {
    await ElMessageBox.confirm(
      `把「${activeClass.value.class_name}」全体在班学生的密码重置为系统默认密码？`,
      '批量重置密码',
      { confirmButtonText: '重置', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const result = await resetClassStudentPassword(activeClass.value.class_id)
    ElMessage.success(`已重置 ${result.updated} 名学生密码`)
  } catch {
    /* 提示已由请求层给出 */
  }
}

function openImportTemplate(): void {
  window.open(importTemplateUrl(), '_blank')
}

/* -------------------------------------------------------------------------- */
/* Tab 2 · 任务下发                                                            */
/* -------------------------------------------------------------------------- */

const taskStatusFilter = ref('ALL')
const taskClassFilter = ref<number | 'ALL'>('ALL')
const taskGroupFilter = ref<number | 'ALL'>('ALL')
const taskKeyword = ref('')

const taskRows = computed(() =>
  tasks.list
    .filter((item) => (taskStatusFilter.value === 'ALL' ? true : item.status === taskStatusFilter.value))
    .filter((item) =>
      taskClassFilter.value === 'ALL'
        ? true
        : tasks.targetClassIds(item).includes(Number(taskClassFilter.value)),
    )
    .filter((item) =>
      taskGroupFilter.value === 'ALL'
        ? true
        : tasks.targetGroupIds(item).includes(Number(taskGroupFilter.value)),
    )
    .filter((item) => {
      const target = taskKeyword.value.trim().toLowerCase()
      if (!target) return true
      return (
        item.title.toLowerCase().includes(target) ||
        (item.description ?? '').toLowerCase().includes(target)
      )
    }),
)

/** 当前班级筛选下可选的分组（跨班筛选时给出全部） */
const groupOptions = computed(() => {
  if (taskClassFilter.value === 'ALL') {
    return org.classes.flatMap((item) =>
      item.groups.map((group) => ({
        id: group.group_id,
        label: `${item.class_name} · ${group.group_name}`,
      })),
    )
  }
  const target = org.classes.find((item) => item.class_id === Number(taskClassFilter.value))
  return (
    target?.groups.map((group) => ({
      id: group.group_id,
      label: group.group_name,
    })) ?? []
  )
})

watch(taskClassFilter, () => {
  taskGroupFilter.value = 'ALL'
})

/** 花名册翻页 / 改每页条数后重新拉取 */
watch([rosterPage, rosterPageSize], () => {
  void refreshRoster()
})

/** 花名册里让某个学生离班 */
async function removeRosterStudent(row: ClassStudent): Promise<void> {
  if (!activeClass.value) return
  try {
    await org.removeStudent(row.id, activeClass.value.class_id)
    await refreshGroups()
    ElMessage.success(`「${row.real_name}」已离班`)
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* —— 新建 / 编辑任务 —— */

interface TargetDraft {
  class_id: number | null
  target_type: 'CLASS' | 'GROUP'
  group_id: number | null
}

const taskDialogVisible = ref(false)
const editingTaskId = ref<number | null>(null)
const editingTaskStatus = ref<'PENDING' | 'PUBLISHED' | 'CANCELLED'>('PENDING')
const taskFormRef = ref<FormInstance>()
const taskSaving = ref(false)
const previewCount = ref<number | null>(null)
const previewing = ref(false)
const publishableProjects = ref<PublishableProject[]>([])

const taskForm = reactive({
  title: '',
  description: '',
  project_level: 'ALL' as 'ALL' | 'BASIC' | 'ADVANCED' | 'EXPANDED',
  job_ids: [] as number[],
  project_ids: [] as number[],
  publish_mode: 'IMMEDIATE' as 'IMMEDIATE' | 'SCHEDULED',
  scheduled_at: '',
  deadline_at: '',
  remark: '',
})

const targetDrafts = ref<TargetDraft[]>([{ class_id: null, target_type: 'CLASS', group_id: null }])

const taskRules: FormRules = {
  title: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
}

/** 编辑已发布任务时，只允许改说明 / 截止时间 / 备注（接口文档 §8.6） */
const lockedTask = computed(
  () => editingTaskId.value !== null && editingTaskStatus.value !== 'PENDING',
)

function classGroupsOf(classId: number | null) {
  return org.classes.find((item) => item.class_id === classId)?.groups ?? []
}

function addTarget(): void {
  targetDrafts.value = [
    ...targetDrafts.value,
    { class_id: null, target_type: 'CLASS', group_id: null },
  ]
}

function removeTarget(index: number): void {
  targetDrafts.value = targetDrafts.value.filter((_, i) => i !== index)
  if (targetDrafts.value.length === 0) addTarget()
}

function buildTargets(): TaskTarget[] {
  return targetDrafts.value
    .filter((item): item is TargetDraft & { class_id: number } => typeof item.class_id === 'number')
    .map((item) => ({
      class_id: item.class_id,
      target_type: item.target_type,
      group_id: item.target_type === 'GROUP' ? item.group_id : null,
    }))
}

async function doPreview(): Promise<void> {
  const targets = buildTargets()
  if (targets.length === 0) {
    ElMessage.warning('请先选择目标班级')
    return
  }
  previewing.value = true
  try {
    const result = await tasks.preview(targets)
    previewCount.value = result.student_count
    ElMessage.success(`这次任务会覆盖 ${result.student_count} 名学生`)
  } catch {
    /* 提示已由请求层给出 */
  } finally {
    previewing.value = false
  }
}

async function loadPublishable(): Promise<void> {
  publishableProjects.value = await fetchPublishableProjects({
    job_ids: taskForm.job_ids.length > 0 ? taskForm.job_ids : undefined,
    project_level: taskForm.project_level === 'ALL' ? undefined : taskForm.project_level,
  })
}

async function openTaskCreate(): Promise<void> {
  editingTaskId.value = null
  previewCount.value = null
  Object.assign(taskForm, {
    title: '',
    description: '',
    project_level: 'ALL',
    job_ids: [],
    project_ids: [],
    publish_mode: 'IMMEDIATE',
    scheduled_at: '',
    deadline_at: '',
    remark: '',
  })
  targetDrafts.value = [
    { class_id: org.classes[0]?.class_id ?? null, target_type: 'CLASS', group_id: null },
  ]
  await loadPublishable()
  taskDialogVisible.value = true
}

async function openTaskEdit(row: (typeof tasks.list)[number]): Promise<void> {
  editingTaskId.value = row.id
  editingTaskStatus.value = row.status
  previewCount.value = null
  Object.assign(taskForm, {
    title: row.title,
    description: row.description ?? '',
    project_level: (row.project_level ?? 'ALL') as 'ALL' | 'BASIC' | 'ADVANCED' | 'EXPANDED',
    job_ids: (row.jobs ?? []).map((item) => item.job_id),
    project_ids: (row.projects ?? []).map((item) => item.project_id),
    publish_mode: row.publish_mode,
    scheduled_at: row.scheduled_at ?? '',
    deadline_at: row.deadline_at ?? '',
    remark: row.remark ?? '',
  })
  targetDrafts.value = (row.targets ?? []).map((item) => ({
    class_id: item.class_id,
    target_type: item.target_type,
    group_id: item.group_id ?? null,
  }))
  if (targetDrafts.value.length === 0) {
    targetDrafts.value = [{ class_id: null, target_type: 'CLASS', group_id: null }]
  }
  await loadPublishable()
  taskDialogVisible.value = true
}

async function submitTask(): Promise<void> {
  const valid = await taskFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const targets = buildTargets()
  if (!lockedTask.value && targets.length === 0) {
    ElMessage.warning('请至少选择一个目标班级')
    return
  }
  if (
    !lockedTask.value &&
    targets.some((item) => item.target_type === 'GROUP' && !item.group_id)
  ) {
    ElMessage.warning('选择「指定分组」的目标需要选中具体分组')
    return
  }
  if (!lockedTask.value && taskForm.publish_mode === 'SCHEDULED' && !taskForm.scheduled_at) {
    ElMessage.warning('定时发布需要选择发布时间')
    return
  }

  taskSaving.value = true
  try {
    if (editingTaskId.value) {
      // 已发布任务只能改这三个字段，未发布任务可改标题与发布方式
      const payload = lockedTask.value
        ? {
            description: taskForm.description.trim() || null,
            deadline_at: taskForm.deadline_at || null,
            remark: taskForm.remark.trim() || null,
          }
        : {
            title: taskForm.title.trim(),
            description: taskForm.description.trim() || null,
            publish_mode: taskForm.publish_mode,
            scheduled_at: taskForm.publish_mode === 'SCHEDULED' ? taskForm.scheduled_at : null,
            deadline_at: taskForm.deadline_at || null,
            remark: taskForm.remark.trim() || null,
          }
      await tasks.update(editingTaskId.value, payload)
      ElMessage.success('任务已更新')
    } else {
      await tasks.create({
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        project_level: taskForm.project_level === 'ALL' ? null : taskForm.project_level,
        job_ids: taskForm.job_ids,
        project_ids: taskForm.project_ids,
        targets,
        publish_mode: taskForm.publish_mode,
        scheduled_at: taskForm.publish_mode === 'SCHEDULED' ? taskForm.scheduled_at : null,
        deadline_at: taskForm.deadline_at || null,
        remark: taskForm.remark.trim() || null,
      })
      ElMessage.success('任务已下发')
    }
    taskDialogVisible.value = false
  } catch {
    /* 提示已由请求层给出（如：草稿项目不能发布任务、权重未调整等） */
  } finally {
    taskSaving.value = false
  }
}

async function publishNow(row: (typeof tasks.list)[number]): Promise<void> {
  try {
    await tasks.publish(row.id)
    ElMessage.success(`《${row.title}》已发布，目标学生现在可以看到`)
  } catch {
    /* 提示已由请求层给出 */
  }
}

async function cancelRow(row: (typeof tasks.list)[number]): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '撤回后目标学生立刻看不到这些项目，已产生的闯关记录保留；撤回不可逆，要重发需新建任务。确认撤回？',
      '撤回任务',
      { confirmButtonText: '撤回', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await tasks.cancel(row.id)
    ElMessage.success('任务已撤回')
  } catch {
    /* 提示已由请求层给出 */
  }
}

async function removeTaskRow(row: (typeof tasks.list)[number]): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `只有从没发布过的任务可以删除。确认删除《${row.title}》？`,
      '删除任务',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await tasks.remove(row.id)
    ElMessage.success('任务已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

/* -------------------------------------------------------------------------- */

const { page: taskPage, pageSize: taskPageSize, total: taskTotal, paged: taskPaged } = usePaging(
  () => taskRows.value,
)

onMounted(async () => {
  await Promise.all([org.loadOverview(), tasks.load(), fetchJobs({ status: 'ENABLED' }).then((r) => {
    jobs.value = r.items
  })])
})
</script>

<template>
  <div class="class-task">
    <PanelBlock :padded="false">
      <el-tabs v-model="activeTab" class="tabs">
        <!-- ① 班级管理 -->
        <el-tab-pane name="class">
          <template #label><span class="tab-label">班级管理</span></template>

          <div class="toolbar">
            <div class="toolbar__filters">
              <el-input
                v-model="classKeyword"
                class="toolbar__search"
                placeholder="搜索班级 / 备注"
                clearable
              />
              <el-select v-model="statusFilter" class="filter-select">
                <el-option label="全部状态" value="ALL" />
                <el-option label="在读" value="ACTIVE" />
                <el-option label="归档" value="ARCHIVED" />
              </el-select>
            </div>
            <el-button type="primary" round @click="openClassCreate">＋ 新建班级</el-button>
          </div>

          <el-table :data="classRows" v-loading="org.loading" style="width: 100%">
            <el-table-column label="班级" min-width="180">
              <template #default="{ row }">
                <div class="cell-main">
                  <p class="cell-main__title">{{ row.class_name }}</p>
                  <p v-if="row.remark" class="cell-main__desc">{{ row.remark }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="年级" width="90">
              <template #default="{ row }">
                <span class="num">{{ row.grade_year ?? '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="学生数" width="100">
              <template #default="{ row }">
                <span class="num">{{ row.student_count }}</span><span class="muted"> 人</span>
              </template>
            </el-table-column>
            <el-table-column label="分组" width="150">
              <template #default="{ row }">
                <span class="num">{{ row.group_count }}</span><span class="muted"> 组</span>
                <span v-if="row.ungrouped_count > 0" class="cell-warn">
                  · 未分组 <span class="num">{{ row.ungrouped_count }}</span>
                </span>
                <span v-else class="muted"> · 已全部分组</span>
              </template>
            </el-table-column>
            <el-table-column label="分组人数" width="110">
              <template #default="{ row }">
                <span class="num">{{ groupMemberCount(row) }}</span>
                <span class="muted"> / {{ row.student_count }}</span>
              </template>
            </el-table-column>
            <el-table-column label="任务进度" width="130">
              <template #default="{ row }">
                <span class="num">{{ row.task_count }}</span><span class="muted"> 个任务</span>
              </template>
            </el-table-column>
            <el-table-column label="平均完成率" width="120">
              <template #default="{ row }">
                <StatusPill
                  :tone="row.average_completion_rate >= 80 ? 'done' : row.average_completion_rate >= 60 ? 'wip' : 'danger'"
                  :text="`${row.average_completion_rate}%`"
                />
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <StatusPill
                  :tone="row.status === 'ACTIVE' ? 'done' : 'lock'"
                  :text="CLASS_STATUS_LABEL[row.status] ?? row.status"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <div class="ops">
                  <el-button type="primary" size="small" round @click="openRoster(row)">
                    学生与分组
                  </el-button>
                  <el-button size="small" round @click="openClassEdit(row)">编辑</el-button>
                  <el-button class="btn-danger" size="small" round @click="removeClass(row)">
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <EmptyState
            v-if="!classRows.length && !org.loading"
            title="还没有任教班级"
            description="点击「新建班级」建立班级后，可导入名单、分组并下发任务。"
          />
        </el-tab-pane>

        <!-- ② 任务下发 -->
        <el-tab-pane name="task">
          <template #label><span class="tab-label">任务下发</span></template>

          <div class="toolbar">
            <div class="toolbar__filters">
              <el-select v-model="taskClassFilter" class="filter-select filter-select--wide">
                <el-option label="全部班级" value="ALL" />
                <el-option
                  v-for="item in org.classes"
                  :key="item.class_id"
                  :label="item.class_name"
                  :value="item.class_id"
                />
              </el-select>
              <el-select v-model="taskGroupFilter" class="filter-select filter-select--wide">
                <el-option label="全部分组" value="ALL" />
                <el-option
                  v-for="item in groupOptions"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                />
              </el-select>
              <el-select v-model="taskStatusFilter" class="filter-select">
                <el-option label="全部状态" value="ALL" />
                <el-option label="待发布" value="PENDING" />
                <el-option label="已发布" value="PUBLISHED" />
                <el-option label="已撤回" value="CANCELLED" />
              </el-select>
              <el-input
                v-model="taskKeyword"
                class="toolbar__search"
                placeholder="搜索任务名称 / 说明"
                clearable
              />
            </div>
            <el-button type="primary" round @click="openTaskCreate">＋ 下发任务</el-button>
          </div>

          <el-table :data="taskPaged" v-loading="tasks.loading" style="width: 100%">
            <el-table-column label="任务名称" min-width="170">
              <template #default="{ row }">
                <div class="cell-main">
                  <p class="cell-main__title">{{ row.title }}</p>
                  <p v-if="row.description" class="cell-main__desc">{{ row.description }}</p>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="目标班级 / 分组" min-width="180">
              <template #default="{ row }">
                <span>{{ tasks.targetText(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="层级" width="76">
              <template #default="{ row }">
                <span v-if="row.project_level">{{ LEVEL_LABEL[row.project_level] }}</span>
                <span v-else class="muted">不限</span>
              </template>
            </el-table-column>
            <el-table-column label="项目 / 覆盖学生" width="130">
              <template #default="{ row }">
                <span class="num">{{ row.project_count }}</span><span class="muted"> 个项目 · </span>
                <span class="num">{{ row.student_count }}</span><span class="muted"> 人</span>
              </template>
            </el-table-column>
            <el-table-column label="发布方式" width="110">
              <template #default="{ row }">
                {{ PUBLISH_MODE_LABEL[row.publish_mode] ?? row.publish_mode }}
              </template>
            </el-table-column>
            <el-table-column label="发布时间" width="130">
              <template #default="{ row }">
                <span class="num muted">
                  {{
                    formatDateTime(
                      row.status === 'PUBLISHED' ? row.published_at : row.scheduled_at,
                    )
                  }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="截止时间" width="130">
              <template #default="{ row }">
                <span class="num muted">{{ formatDateTime(row.deadline_at) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="96">
              <template #default="{ row }">
                <StatusPill
                  :tone="row.status === 'PUBLISHED' ? 'done' : row.status === 'CANCELLED' ? 'lock' : 'wip'"
                  :text="TASK_STATUS_LABEL[row.status] ?? row.status"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <div class="ops">
                  <el-button size="small" round @click="openTaskEdit(row)">编辑</el-button>
                  <el-button
                    v-if="row.status === 'PENDING'"
                    type="primary"
                    size="small"
                    round
                    @click="publishNow(row)"
                  >
                    立即发布
                  </el-button>
                  <el-button
                    v-if="row.status === 'PUBLISHED'"
                    size="small"
                    round
                    @click="cancelRow(row)"
                  >
                    撤回
                  </el-button>
                  <el-button
                    v-if="row.status !== 'PUBLISHED'"
                    class="btn-danger"
                    size="small"
                    round
                    @click="removeTaskRow(row)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <ListPagination
            v-model:page="taskPage"
            v-model:page-size="taskPageSize"
            :total="taskTotal"
          />

          <EmptyState
            v-if="!taskPaged.length && !tasks.loading"
            title="没有匹配的任务"
            description="点「＋ 下发任务」把已发布的项目发给班级或分组；项目必须先发布才能被任务引用。"
          />
        </el-tab-pane>
      </el-tabs>
    </PanelBlock>

    <!-- 新建 / 编辑班级 -->
    <el-dialog
      v-model="classDialogVisible"
      :title="editingClassId ? '编辑班级' : '新建班级'"
      width="520px"
      align-center
    >
      <el-form ref="classFormRef" :model="classForm" :rules="classRules" label-position="top">
        <el-form-item label="班级名称" prop="class_name">
          <el-input v-model="classForm.class_name" placeholder="如：人工智能2401班" />
        </el-form-item>

        <div class="form-row">
          <el-form-item label="年级 / 届">
            <el-input-number v-model="classForm.grade_year" :min="2000" :max="2100" :controls="false" class="full" />
          </el-form-item>
          <el-form-item label="分组数量（仅列表展示）">
            <el-input-number v-model="classForm.group_count" :min="0" :max="20" :controls="false" class="full" />
          </el-form-item>
        </div>

        <el-form-item label="状态">
          <el-select v-model="classForm.status" class="full">
            <el-option label="在读" value="ACTIVE" />
            <el-option label="归档" value="ARCHIVED" />
          </el-select>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="classForm.remark"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="如：按项目小组分组，共 4 组"
          />
        </el-form-item>

        <p class="dialog-hint">
          负责教师默认是当前登录教师；分组需要在上方「学生与分组」里单独建立。
        </p>
      </el-form>
      <template #footer>
        <el-button round @click="classDialogVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitClass">保存</el-button>
      </template>
    </el-dialog>

    <!-- 学生与分组 -->
    <el-dialog
      v-model="rosterVisible"
      :title="`学生与分组 · ${activeClass?.class_name ?? ''}`"
      width="980px"
      align-center
      top="5vh"
    >
      <div class="roster">
        <!-- 左：分组 -->
        <section class="groups">
          <header class="groups__head">
            <p class="groups__title">分组</p>
            <div class="groups__tools">
              <el-button size="small" round @click="addGroupPrompt">＋ 新建分组</el-button>
              <el-button
                size="small"
                type="primary"
                round
                :loading="grouping"
                @click="randomGrouping"
              >
                随机分组
              </el-button>
            </div>
          </header>

          <p class="groups__hint">
            随机分组会把「未分组学生」打散后按人数均衡塞进现有分组；
            下方花名册里也能逐个调整分组。
          </p>

          <ul v-if="classGroups.length" class="group-list">
            <li v-for="group in classGroups" :key="group.id" class="group">
              <div class="group__head">
                <span class="group__name">{{ group.group_name }}</span>
                <span class="group__count num">{{ group.student_count }} 人</span>
                <el-button text class="btn-danger" @click="removeGroup(group.id, group.group_name)">
                  删除
                </el-button>
              </div>
              <p class="group__members">
                <span v-if="group.student_count === 0" class="muted">暂无成员</span>
                <template v-else>
                  {{ (group.students ?? []).map((item) => item.real_name).join('、') }}
                </template>
              </p>
            </li>
          </ul>
          <EmptyState
            v-else
            title="该班级还没有分组"
            description="先「新建分组」，再用「随机分组」或逐个调整把学生分进去。"
          />

          <div class="ungrouped">
            <p class="groups__title">未分组学生（{{ ungroupedStudents.length }}）</p>
            <p v-if="ungroupedStudents.length === 0" class="muted">全部学生都已分组</p>
            <p v-else class="group__members">
              {{ ungroupedStudents.map((item) => item.real_name).join('、') }}
            </p>
          </div>
        </section>

        <!-- 右：花名册 -->
        <section class="roster-list">
          <header class="roster-list__head">
            <el-input
              v-model="rosterKeyword"
              class="toolbar__search"
              placeholder="搜索姓名 / 学号"
              clearable
              @keyup.enter="refreshRoster"
              @clear="refreshRoster"
            />
            <el-checkbox v-model="rosterUngroupedOnly" @change="refreshRoster">
              只看未分组
            </el-checkbox>
            <div class="roster-list__tools">
              <el-button size="small" round @click="openImportTemplate">下载模板</el-button>
              <el-button size="small" round @click="importVisible = true">导入名单</el-button>
              <el-button size="small" round @click="addStudentVisible = true">＋ 加学生</el-button>
              <el-button size="small" round @click="resetPassword">重置密码</el-button>
            </div>
          </header>

          <el-table :data="rosterRows" v-loading="org.rosterLoading" style="width: 100%" max-height="420">
            <el-table-column prop="user_no" label="学号" width="120" />
            <el-table-column prop="real_name" label="姓名" width="100" />
            <el-table-column label="分组" width="150">
              <template #default="{ row }">
                <el-select
                  :model-value="row.group_id"
                  class="full"
                  placeholder="未分组"
                  clearable
                  @change="onStudentGroupChange(row, Number($event))"
                >
                  <el-option
                    v-for="group in classGroups"
                    :key="group.id"
                    :label="group.group_name"
                    :value="group.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="在班状态" width="110">
              <template #default="{ row }">
                <StatusPill
                  :tone="row.status === 'ENROLLED' ? 'done' : 'lock'"
                  :text="row.status === 'ENROLLED' ? '在班' : '已离班'"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button class="btn-danger" size="small" round @click="removeRosterStudent(row)">
                  离班
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <ListPagination
            v-model:page="rosterPage"
            v-model:page-size="rosterPageSize"
            :total="rosterTotal"
          />
        </section>
      </div>
    </el-dialog>

    <!-- 导入名单 -->
    <el-dialog v-model="importVisible" title="导入学生名单" width="520px" align-center>
      <p class="dialog-hint">
        仅支持按模板填写的 xlsx：学号、姓名必填，专业 / 手机号 / 邮箱 / 分组序号选填。
        学号在文件内重复或库里已存在会**整批拒绝**，可以先「预校验」看结果。
      </p>
      <el-upload :auto-upload="false" :show-file-list="true" :limit="1" :on-change="pickImportFile" accept=".xlsx">
        <el-button round>选择 xlsx 文件</el-button>
      </el-upload>
      <el-checkbox v-model="importDryRun" class="import__dry">
        预校验（只校验不落库）
      </el-checkbox>
      <template #footer>
        <el-button round @click="importVisible = false">取消</el-button>
        <el-button type="primary" round :loading="importing" @click="submitImport">
          {{ importDryRun ? '开始预校验' : '正式导入' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 单个加学生 -->
    <el-dialog v-model="addStudentVisible" title="加学生" width="480px" align-center>
      <el-form label-position="top">
        <el-form-item label="学号（已存在则复用账号）">
          <el-input v-model="addStudentForm.user_no" placeholder="如：2024010101" />
        </el-form-item>
        <el-form-item label="姓名（新建账号时必填）">
          <el-input v-model="addStudentForm.real_name" placeholder="如：张一鸣" />
        </el-form-item>
        <el-form-item label="直接分到第几组（可留空）">
          <el-input-number v-model="addStudentForm.group_no" :min="1" :max="99" :controls="false" class="full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="addStudentVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitAddStudent">加入班级</el-button>
      </template>
    </el-dialog>

    <!-- 新建 / 编辑任务 -->
    <el-dialog
      v-model="taskDialogVisible"
      :title="editingTaskId ? '编辑任务' : '下发实训任务'"
      width="880px"
      align-center
      top="5vh"
      class="task-dialog"
    >
      <el-alert
        v-if="lockedTask"
        class="task-alert"
        type="warning"
        :closable="false"
        title="任务已发布或已撤回，目标 / 项目 / 岗位 / 层级已锁定"
        description="已发布任务只能修改说明、截止时间与备注；要改目标或项目，请「撤回 + 新建」一条任务。"
      />

      <el-form ref="taskFormRef" :model="taskForm" :rules="taskRules" label-position="top">
        <!-- 基本信息 -->
        <section class="block block--plain">
          <header class="block__head">
            <div>
              <p class="block__title">基本信息</p>
              <p class="block__hint">任务名与说明都会展示在学生端</p>
            </div>
          </header>

          <div class="grid-2">
            <el-form-item label="任务名称" prop="title">
              <el-input
                v-model="taskForm.title"
                :disabled="lockedTask"
                placeholder="如：第 3 周 · 基础实训"
              />
            </el-form-item>
            <el-form-item label="项目层级">
              <el-select v-model="taskForm.project_level" class="full" :disabled="lockedTask">
                <el-option label="不限层级" value="ALL" />
                <el-option label="基础" value="BASIC" />
                <el-option label="进阶" value="ADVANCED" />
                <el-option label="拓展" value="EXPANDED" />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item label="任务说明（学生端可见）" class="form-item--last">
            <el-input
              v-model="taskForm.description"
              type="textarea"
              :rows="2"
              resize="none"
              placeholder="如：完成 1 个基础项目并提交实训报告"
            />
          </el-form-item>
        </section>

        <!-- 目标：班级 / 分组 -->
        <section class="block">
          <header class="block__head">
            <div>
              <p class="block__title">目标班级 / 分组</p>
              <p class="block__hint">默认发给全班；需要只发给某个分组时把类型切成「指定分组」</p>
            </div>
            <button class="icon-op" type="button" :disabled="lockedTask" @click="addTarget">
              ＋ 添加目标
            </button>
          </header>

          <div class="targets">
            <div v-for="(target, index) in targetDrafts" :key="index" class="target-row">
              <el-select
                v-model="target.class_id"
                placeholder="选择班级"
                :disabled="lockedTask"
              >
                <el-option
                  v-for="item in org.classes"
                  :key="item.class_id"
                  :label="item.class_name"
                  :value="item.class_id"
                />
              </el-select>
              <el-select v-model="target.target_type" :disabled="lockedTask">
                <el-option label="全班" value="CLASS" />
                <el-option label="指定分组" value="GROUP" />
              </el-select>
              <el-select
                v-if="target.target_type === 'GROUP'"
                v-model="target.group_id"
                placeholder="选择分组"
                :disabled="lockedTask"
              >
                <el-option
                  v-for="group in classGroupsOf(target.class_id)"
                  :key="group.group_id"
                  :label="group.group_name"
                  :value="group.group_id"
                />
              </el-select>
              <span v-else class="target-row__note">该班全部在班学生</span>
              <button
                class="icon-op icon-op--danger"
                type="button"
                :disabled="lockedTask"
                @click="removeTarget(index)"
              >
                移除
              </button>
            </div>
          </div>

          <div class="targets__foot">
            <button class="icon-op" type="button" :disabled="previewing" @click="doPreview">
              {{ previewing ? '预览中…' : '预览覆盖学生数' }}
            </button>
            <span v-if="previewCount !== null" class="targets__count">
              将覆盖 <b class="num">{{ previewCount }}</b> 名学生（跨目标去重）
            </span>
            <span v-else class="muted">发之前可以先看一眼覆盖人数</span>
          </div>
        </section>

        <!-- 项目与岗位范围 -->
        <section class="block">
          <header class="block__head">
            <div>
              <p class="block__title">项目范围</p>
              <p class="block__hint">
                留空 = 按「岗位 × 层级」自动带上全部已发布项目；建议显式勾选，避免多发
              </p>
            </div>
            <button class="icon-op" type="button" :disabled="lockedTask" @click="loadPublishable">
              按岗位 / 层级刷新可选项目
            </button>
          </header>

          <div class="grid-3">
            <el-form-item label="岗位范围（只筛项目，不筛学生）">
              <el-select
                v-model="taskForm.job_ids"
                class="full"
                multiple
                clearable
                :disabled="lockedTask"
                placeholder="全部岗位"
              >
                <el-option v-for="item in jobs" :key="item.id" :label="item.job_name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="项目层级">
              <span class="form-static">
                当前可选已发布项目 <b class="num">{{ publishableProjects.length }}</b> 个
              </span>
            </el-form-item>
          </div>

          <el-form-item label="指定项目（留空 = 自动带全部符合条件的已发布项目）" class="form-item--last">
            <el-select
              v-model="taskForm.project_ids"
              class="full"
              multiple
              clearable
              :disabled="lockedTask"
              placeholder="选择项目"
            >
              <el-option
                v-for="item in publishableProjects"
                :key="item.id"
                :label="`${item.project_name}（${LEVEL_LABEL[item.project_level] ?? item.project_level}${item.job_name ? ' · ' + item.job_name : ''}）`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </section>

        <!-- 发布与截止 -->
        <section class="block">
          <header class="block__head">
            <div>
              <p class="block__title">发布与截止</p>
              <p class="block__hint">定时发布依赖后端调度脚本，到点才会生效</p>
            </div>
          </header>

          <div class="grid-3">
            <el-form-item label="发布方式">
              <el-select v-model="taskForm.publish_mode" class="full" :disabled="lockedTask">
                <el-option label="即时发布" value="IMMEDIATE" />
                <el-option label="定时发布" value="SCHEDULED" />
              </el-select>
            </el-form-item>
            <el-form-item label="定时发布时间">
              <el-date-picker
                v-model="taskForm.scheduled_at"
                class="full"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                placeholder="定时发布时必填"
                :disabled="lockedTask || taskForm.publish_mode !== 'SCHEDULED'"
              />
            </el-form-item>
            <el-form-item label="截止时间">
              <el-date-picker
                v-model="taskForm.deadline_at"
                class="full"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                placeholder="可留空"
              />
            </el-form-item>
          </div>

          <el-form-item label="备注（仅教师可见）" class="form-item--last">
            <el-input v-model="taskForm.remark" placeholder="如：与课堂进度对齐" />
          </el-form-item>
        </section>
      </el-form>

      <template #footer>
        <el-button round @click="taskDialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="taskSaving" @click="submitTask">
          {{ editingTaskId ? '保存' : '下发任务' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.class-task {
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

.toolbar__search {
  width: 220px;
}

.filter-select {
  width: 130px;
}

.filter-select--wide {
  width: 180px;
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

.cell-warn {
  color: var(--wip);
  font-size: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.full {
  width: 100%;
}

.dialog-hint {
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.8;
}

.import__dry {
  margin-top: 10px;
}

/* —— 学生与分组面板 —— */
.roster {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-md);
  background: var(--surface-2);
}

.groups__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.groups__title {
  font-size: 13.5px;
  font-weight: 700;
}

.groups__tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.groups__hint {
  color: var(--ink-3);
  font-size: 11.5px;
  line-height: 1.7;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface);
}

.group__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group__name {
  font-size: 13px;
  font-weight: 700;
}

.group__count {
  color: var(--ink-3);
  font-size: 12px;
}

.group__members {
  margin-top: 4px;
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.7;
}

.ungrouped {
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}

.roster-list {
  min-width: 0;
}

.roster-list__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.roster-list__tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.targets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 一行一个目标：班级 | 全班 · 指定分组 | 分组 | 移除 */
.target-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) 132px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.target-row__note {
  padding-left: 2px;
  color: var(--ink-3);
  font-size: 12.5px;
}

.targets__foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}

.targets__count {
  color: var(--ink-2);
  font-size: 12.5px;
}

.targets__count b {
  color: var(--brand-600);
  font-size: 15px;
}

.task-alert {
  margin-bottom: 16px;
}

.form-static {
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.9;
}

.form-static b {
  color: var(--ink-1);
  font-size: 14px;
}

@media (max-width: 1280px) {
  .roster,
  .form-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .target-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<!--
  el-dialog 会被 teleport 到 body，根节点不带组件作用域属性，
  「弹窗本体」的高度约束必须写成非 scoped 样式（自定义类限定，避免外溢）。
-->
<style>
.task-dialog {
  display: flex;
  flex-direction: column;
  max-height: 92vh;
}

.task-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px;
}
</style>
