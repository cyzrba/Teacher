<script setup lang="ts">
/**
 * 实训结果审核 · 报告列表（对接真实后端，接口文档 §9.8）
 *
 * 这里是「一条一条的实训报告」：先按班级 / 学生 / 项目 / 状态筛出报告，
 * 老师点某一条再跳到详情页查阅全部作答（`/teacher/reviews/:submissionId`）。
 */

import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PanelBlock from '@/components/PanelBlock.vue'
import StatusPill from '@/components/StatusPill.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListPagination from '@/components/ListPagination.vue'
import { usePaging } from '@/composables/usePaging'
import { formatDateTime, num } from '@/api/backend/client'
import { useSubmissionsStore } from '@/stores/submissions'
import { useOrgStore } from '@/stores/org'
import {
  STATUS_OPTIONS,
  passMark,
  reviewStateOf,
  stateLabelOf,
  stateToneOf,
} from '@/utils/reviewState'
import type { SubmissionListItem } from '@/api/backend/reviews'

const router = useRouter()
const store = useSubmissionsStore()
const org = useOrgStore()

const classFilter = ref<number | 'ALL'>('ALL')
const studentFilter = ref<number | 'ALL'>('ALL')
const projectFilter = ref<number | 'ALL'>('ALL')
const statusFilter = ref<string>('ALL')
const starredOnly = ref(false)

/** 学生 → 班级：列表要显示班级列，接口不返回，从任教班级总览里派生 */
const classOfStudent = computed(() => {
  const map = new Map<number, string>()
  for (const item of org.classes) {
    for (const group of item.groups) {
      for (const member of group.members) map.set(member.student_id, item.class_name)
    }
    for (const member of item.ungrouped_students) map.set(member.student_id, item.class_name)
  }
  return map
})

/** 班级筛选是客户端做的（接口没有班级维度） */
const classStudentIds = computed<Set<number> | null>(() => {
  if (classFilter.value === 'ALL') return null
  const target = org.classes.find((item) => item.class_id === classFilter.value)
  if (!target) return new Set()
  const ids = new Set<number>()
  for (const group of target.groups) {
    for (const member of group.members) ids.add(member.student_id)
  }
  for (const member of target.ungrouped_students) ids.add(member.student_id)
  return ids
})

/** 学生下拉：选了班级只列该班学生，否则列全部学生 */
const studentOptions = computed(() => {
  const all = [...store.studentNames.entries()].map(([id, name]) => ({ id, name }))
  const scoped = classStudentIds.value ? all.filter((item) => classStudentIds.value?.has(item.id)) : all
  return scoped.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
})

/** 项目下拉：取当前列表里出现过的项目 */
const projectOptions = computed(() => {
  const map = new Map<number, string>()
  for (const item of store.list) {
    if (item.project_id && item.project_name) map.set(item.project_id, item.project_name)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }))
})

const filteredList = computed(() =>
  store.list
    .filter((item) => (statusFilter.value === 'ALL' ? true : reviewStateOf(item) === statusFilter.value))
    .filter((item) => (starredOnly.value ? item.is_starred : true))
    .filter((item) => (classStudentIds.value ? classStudentIds.value.has(item.student_id ?? 0) : true)),
)

const { page, pageSize, total, paged, reset } = usePaging(() => filteredList.value)

/**
 * 学生 / 项目筛选走后端参数（接口支持 `student_id` / `project_id`）；
 * 状态、标星、班级在前端过滤 —— 状态尤其要在前端算，
 * 因为页面上的三步状态与后端的 7 个内部状态不是一一对应。
 */
async function applyServerFilter(): Promise<void> {
  await store.load({
    student_id: studentFilter.value === 'ALL' ? undefined : Number(studentFilter.value),
    project_id: projectFilter.value === 'ALL' ? undefined : Number(projectFilter.value),
  })
  reset()
}

watch(classFilter, () => {
  if (studentFilter.value !== 'ALL' && !classStudentIds.value?.has(Number(studentFilter.value))) {
    studentFilter.value = 'ALL'
    void applyServerFilter()
  }
  reset()
})

function classNameOf(row: SubmissionListItem): string {
  return classMapOf(row) ?? '--'
}

function classMapOf(row: SubmissionListItem): string | undefined {
  return row.student_id ? classOfStudent.value.get(row.student_id) : undefined
}

/** 点某一条报告 → 进详情页查阅全部作答 */
function openDetail(row: SubmissionListItem): void {
  void router.push(`/teacher/reviews/${row.id}`)
}

onMounted(async () => {
  await Promise.all([store.loadStudents(), store.load(), org.loadOverview()])
})
</script>

<template>
  <div class="review-list">
    <PanelBlock title="实训报告" :padded="false">
      <template #extra>
        <span class="muted">共 <b class="num">{{ filteredList.length }}</b> 条报告</span>
      </template>

      <div class="toolbar">
        <div class="toolbar__filters">
          <el-select v-model="classFilter" class="filter-select" placeholder="全部班级">
            <el-option label="全部班级" value="ALL" />
            <el-option
              v-for="item in org.classes"
              :key="item.class_id"
              :label="item.class_name"
              :value="item.class_id"
            />
          </el-select>
          <el-select
            v-model="studentFilter"
            class="filter-select"
            filterable
            placeholder="全部学生"
            @change="applyServerFilter"
          >
            <el-option label="全部学生" value="ALL" />
            <el-option v-for="item in studentOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <el-select
            v-model="projectFilter"
            class="filter-select filter-select--wide"
            filterable
            placeholder="全部项目"
            @change="applyServerFilter"
          >
            <el-option label="全部项目" value="ALL" />
            <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <el-select v-model="statusFilter" class="filter-select filter-select--wide" @change="reset">
            <el-option
              v-for="item in STATUS_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-checkbox v-model="starredOnly" @change="reset">只看标星</el-checkbox>
        </div>
      </div>

      <el-table
        v-if="paged.length > 0 || store.loading"
        :data="paged"
        v-loading="store.loading"
        style="width: 100%"
        @row-click="openDetail"
      >
        <el-table-column label="学生" width="140">
          <template #default="{ row }">
            <span class="student">
              {{ store.studentNameOf(row.student_id) }}
              <span v-if="row.is_starred" class="student__star">已标星</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="班级" width="140">
          <template #default="{ row }">
            <span :class="{ muted: !classMapOf(row) }">{{ classNameOf(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实训项目" min-width="220">
          <template #default="{ row }">
            <div class="cell-main">
              <p class="cell-main__title">{{ row.project_name || '--' }}</p>
              <p class="cell-main__desc">
                第 {{ row.attempt_no ?? 1 }} 次挑战 · 第 {{ row.submit_no }} 次提交
              </p>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="150">
          <template #default="{ row }">
            <span class="num muted">{{ formatDateTime(row.submitted_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="AI 总分" width="110">
          <template #default="{ row }">
            <span v-if="row.total_score" class="num score">{{ num(row.total_score) }}</span>
            <span v-else class="muted">尚未出分</span>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="140">
          <template #default="{ row }">
            <StatusPill :tone="stateToneOf(row)" :text="stateLabelOf(row)" />
          </template>
        </el-table-column>
        <el-table-column label="及格" width="130">
          <template #default="{ row }">
            <span
              :class="{
                'score--good': passMark(row).tone === 'good',
                'score--bad': passMark(row).tone === 'bad',
                muted: passMark(row).tone === 'wait',
              }"
            >
              {{ passMark(row).text }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" round @click.stop="openDetail(row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <ListPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />

      <EmptyState
        v-if="paged.length === 0 && !store.loading"
        title="没有匹配的实训报告"
        description="换个班级 / 学生 / 项目 / 状态筛选条件，或等学生提交后再来看。"
      />
    </PanelBlock>
  </div>
</template>

<style scoped>
.review-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.filter-select {
  width: 140px;
}

.filter-select--wide {
  width: 180px;
}

.student {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 600;
}

.student__star {
  padding: 1px 6px;
  border: 1px solid var(--wip-line);
  border-radius: var(--r-chip);
  background: var(--wip-bg);
  color: #b35c00;
  font-size: 11px;
  font-weight: 600;
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

.score {
  color: var(--brand-600);
  font-size: 15px;
  font-weight: 700;
}

/* 整行可点：给个手型与悬停底色，提示可以进详情 */
.review-list :deep(.el-table__row) {
  cursor: pointer;
}
</style>
