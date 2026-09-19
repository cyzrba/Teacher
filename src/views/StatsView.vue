<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EChartsOption } from 'echarts'
import EmptyState from '@/components/EmptyState.vue'
import EChart from '@/components/EChart.vue'
import ListPagination from '@/components/ListPagination.vue'
import PanelBlock from '@/components/PanelBlock.vue'
import { usePaging } from '@/composables/usePaging'
import { useStatsStore } from '@/stores/stats'
import { useClassroomStore } from '@/stores/classroom'
import { useTaskStore } from '@/stores/task'
import { progressTone } from '@/utils/format'

const stats = useStatsStore()
const taskStore = useTaskStore()
const classroom = useClassroomStore()
const route = useRoute()
const router = useRouter()

/**
 * 页内 Tab：进度与时长 / 按任务查看完成情况 / 学生学习进度。
 * 用 ?tab=xxx 承载，便于分享与回退（与其它页面同一套写法）。
 */
const activeTab = ref<string>(typeof route.query.tab === 'string' ? route.query.tab : 'overview')
watch(activeTab, (value) => {
  void router.replace({ query: { ...route.query, tab: value } })
})

/** 修复#21：学生检索与班级筛选（此前 122 名学生无检索入口） */
const studentKeyword = ref('')
const studentClassId = ref('all')

async function reloadStudents(): Promise<void> {
  await stats.loadLearning(
    { keyword: studentKeyword.value, classId: studentClassId.value },
    true,
  )
  studentPage.value = 1
}

/** 修复#7：按某次任务下发查看完成情况 */
const taskId = ref('')

async function onTaskChange(): Promise<void> {
  if (!taskId.value) {
    stats.clearTaskCompletion()
    return
  }
  await stats.loadTaskCompletion(taskId.value)
}

const completion = computed(() => stats.taskCompletion)
const completionRate = computed(() => {
  const item = completion.value
  if (!item || item.studentTotal === 0) return 0
  return Math.round((item.doneCount / item.studentTotal) * 100)
})

const buckets = computed(() => stats.learning?.progressBuckets ?? [])
const daily = computed(() => stats.learning?.dailyOnline ?? [])
const students = computed(() => stats.learning?.students ?? [])

const {
  page: studentPage,
  pageSize: studentPageSize,
  total: studentTotal,
  paged: studentRows,
} = usePaging(() => students.value)

/** 学生实训进度分布：柱状图（原型截图 image21 左侧） */
const bucketOption = computed<EChartsOption>(() => ({
  grid: { left: 12, right: 16, top: 36, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: {
    type: 'category',
    data: buckets.value.map((item) => item.label),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#E5E9F0' } },
    axisLabel: { color: '#646A73', fontSize: 11.5 },
  },
  yAxis: { type: 'value', show: false },
  series: [
    {
      type: 'bar',
      name: '学生人数',
      data: buckets.value.map((item) => item.count),
      barWidth: '46%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: '#1677FF' },
            { offset: 1, color: '#9CC6FB' },
          ],
        },
      },
      label: {
        show: true,
        position: 'top',
        formatter: '{c}人',
        color: '#1E7BE8',
        fontSize: 11.5,
      },
    },
  ],
}))

/** 日均在线时长趋势：折线图（原型截图 image21 右侧） */
const dailyOption = computed<EChartsOption>(() => ({
  grid: { left: 8, right: 18, top: 26, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', formatter: '{b}：{c} 小时' },
  xAxis: {
    type: 'category',
    data: daily.value.map((item) => item.day),
    boundaryGap: false,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#E5E9F0' } },
    axisLabel: { color: '#646A73', fontSize: 11.5 },
  },
  yAxis: {
    type: 'value',
    max: 4,
    interval: 1,
    axisLabel: { color: '#8F959E', fontSize: 11, formatter: '{value}h' },
    splitLine: { lineStyle: { color: '#EEF2F8' } },
  },
  series: [
    {
      type: 'line',
      name: '日均在线时长',
      data: daily.value.map((item) => item.hours),
      smooth: false,
      symbol: 'circle',
      symbolSize: 7,
      itemStyle: { color: '#1677FF' },
      lineStyle: { width: 2, color: '#1677FF' },
      areaStyle: { color: 'rgba(22,119,255,0.08)' },
    },
  ],
}))

onMounted(() => {
  void stats.loadLearning()
  void taskStore.load()
  void classroom.load()
})
</script>

<template>
  <div class="stats">
    <!-- 页面标题已由外层布局渲染（「学习过程统计」），页内按 Tab 组织 -->
    <PanelBlock :padded="false">
      <el-tabs v-model="activeTab" class="tabs">
        <!-- ① 进度与时长 -->
        <el-tab-pane name="overview">
          <template #label><span class="tab-label">进度与时长</span></template>

          <!-- 两张图同属一个 Tab：只保留一条分隔线，不再各套一层卡片 -->
          <section class="charts">
            <PanelBlock title="学生实训进度分布">
              <EChart v-if="stats.learning" :option="bucketOption" height="300px" />
              <div v-else class="chart-skeleton skeleton" />
            </PanelBlock>

            <PanelBlock title="日均在线时长趋势" class="charts__last">
              <EChart v-if="stats.learning" :option="dailyOption" height="300px" />
              <div v-else class="chart-skeleton skeleton" />
            </PanelBlock>
          </section>
        </el-tab-pane>

        <!-- ② 按任务查看完成情况（修复#7） -->
        <el-tab-pane name="task">
          <template #label><span class="tab-label">按任务查看完成情况</span></template>

          <div class="task-toolbar">
            <p class="task-toolbar__hint">
              选择一次任务下发，可按班级与分组查看应完成人数、已完成与未完成名单。
            </p>
            <el-select
              v-model="taskId"
              class="task-select"
              placeholder="选择一次任务下发"
              clearable
              @change="onTaskChange"
            >
              <el-option
                v-for="item in taskStore.list"
                :key="item.id"
                :label="`${item.className} · ${item.group} · ${item.positionName}（${item.publishAt}）`"
                :value="item.id"
              />
            </el-select>
          </div>

          <div v-if="completion" class="task-view">
            <div class="task-view__head">
              <span class="task-view__scope">
                {{ completion.className }} · {{ completion.group }} ·
                {{ completion.positionName }}
              </span>
              <span class="task-view__projects">
                任务内容：
                <span v-for="name in completion.projectNames" :key="name" class="tag-skill">
                  {{ name }}
                </span>
                <span v-if="completion.projectNames.length === 0" class="muted">暂无覆盖项目</span>
              </span>
            </div>
    
            <div class="task-stats">
              <div class="task-stat">
                <span class="task-stat__value num">{{ completion.studentTotal }}</span>
                <span class="task-stat__label">应完成人数</span>
              </div>
              <div class="task-stat task-stat--done">
                <span class="task-stat__value num">{{ completion.doneCount }}</span>
                <span class="task-stat__label">已完成</span>
              </div>
              <div class="task-stat task-stat--undone">
                <span class="task-stat__value num">{{ completion.undoneCount }}</span>
                <span class="task-stat__label">未完成</span>
              </div>
              <div class="task-stat">
                <span class="task-stat__value num">{{ completionRate }}%</span>
                <span class="task-stat__label">完成率</span>
              </div>
            </div>
    
            <el-table :data="completion.students" row-key="id" style="width: 100%" max-height="320">
              <el-table-column prop="name" label="姓名" width="140" />
              <el-table-column prop="group" label="分组" width="120" />
              <el-table-column label="完成进度" width="140">
                <template #default="{ row }">
                  <span class="num">{{ row.finished }}</span>
                  <span class="muted num">/{{ row.total }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <span class="pill" :class="row.done ? 'pill--done' : 'pill--wip'">
                    {{ row.done ? '已完成' : '未完成' }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <EmptyState
            v-else
            title="选择一次任务下发，查看该任务的完成情况"
            description="可按班级与分组查看应完成人数、已完成与未完成名单。"
          />
        </el-tab-pane>

        <!-- ③ 学生学习进度 -->
        <el-tab-pane name="students">
          <template #label><span class="tab-label">学生学习进度</span></template>

          <div class="list-toolbar">
            <p class="list-toolbar__hint">逐人查看完成项目数、平均分、总在线时长与技能进度。</p>
            <div class="toolbar__right">
              <el-input
                v-model="studentKeyword"
                class="list-search"
                placeholder="搜索姓名 / 班级"
                clearable
                @keyup.enter="reloadStudents"
                @clear="reloadStudents"
              />
              <el-select v-model="studentClassId" class="list-select" @change="reloadStudents">
                <el-option label="全部班级" value="all" />
                <el-option
                  v-for="item in classroom.list"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </div>
          </div>

          <el-table :data="studentRows" row-key="id" style="width: 100%">
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="className" label="班级" width="130" />
            <el-table-column prop="positionName" label="岗位" min-width="220" />
            <el-table-column label="完成项目" width="130">
              <template #default="{ row }">
                <span class="num">{{ row.finishedProjects }}</span>
                <span class="muted num">/{{ row.totalProjects }}</span>
              </template>
            </el-table-column>
            <el-table-column label="平均分" width="110">
              <template #default="{ row }">
                <span class="num">{{ row.avgScore }}</span>
              </template>
            </el-table-column>
            <el-table-column label="总在线时长" width="130">
              <template #default="{ row }">
                <span class="num">{{ row.onlineHours }}h</span>
              </template>
            </el-table-column>
            <el-table-column label="技能进度" width="140">
              <template #default="{ row }">
                <span class="pill" :class="`pill--${progressTone(row.skillProgress)}`">
                  <span class="num">{{ row.skillProgress }}%</span>
                </span>
              </template>
            </el-table-column>
          </el-table>
          <ListPagination
            v-model:page="studentPage"
            v-model:page-size="studentPageSize"
            :total="studentTotal"
          />
        </el-tab-pane>
      </el-tabs>
    </PanelBlock>
  </div>
</template>

<style scoped>
.stats {
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

.task-toolbar,
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 20px 12px;
}

.task-toolbar__hint,
.list-toolbar__hint {
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.7;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/**
 * 两张图并排：外层已经是卡片，内部不再套卡片，
 * 只用一条竖线分隔（窄屏改为横线），标题仍由 PanelBlock 渲染。
 */
.charts {
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(0, 3fr);
  align-items: stretch;
}

.charts :deep(.panel) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.charts__last {
  border-left: 1px solid var(--line-soft);
}

.chart-skeleton {
  height: 300px;
}

/* 按任务查看（修复#7） */
.task-select {
  width: 360px;
}

/* 学生检索（修复#21） */
.list-search {
  width: 200px;
}

.list-select {
  width: 140px;
}

.task-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.task-view__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-view__scope {
  font-size: 14px;
  font-weight: 700;
}

.task-view__projects {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--ink-2);
  font-size: 12.5px;
}

.task-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.task-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface-2);
}

.task-stat--done {
  border-color: var(--ok-line);
  background: var(--ok-bg);
}

.task-stat--undone {
  border-color: var(--wip-line);
  background: var(--wip-bg);
}

.task-stat__value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.task-stat__label {
  color: var(--ink-2);
  font-size: 12px;
}

@media (max-width: 1180px) {
  .charts {
    grid-template-columns: minmax(0, 1fr);
  }

  .charts__last {
    border-left: 0;
    border-top: 1px solid var(--line-soft);
  }
}
</style>
