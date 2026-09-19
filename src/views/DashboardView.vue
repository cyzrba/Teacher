<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import EChart from '@/components/EChart.vue'
import PanelBlock from '@/components/PanelBlock.vue'
import StatTile from '@/components/StatTile.vue'
import { useStatsStore } from '@/stores/stats'
import { useClassroomStore } from '@/stores/classroom'
import { scoreClass } from '@/utils/format'
import type { ProjectTier } from '@/types'

const stats = useStatsStore()
const classroom = useClassroomStore()

/** 修复#6：班级 / 层级筛选，指标与图表按筛选条件重新计算 */
const classFilter = ref<string>('all')
const tierFilter = ref<ProjectTier | 'all'>('all')

async function refresh(): Promise<void> {
  await stats.loadOverview({ classId: classFilter.value, tier: tierFilter.value }, true)
}

const metrics = computed(() => stats.overview?.metrics ?? [])
const rank = computed(() => stats.overview?.completionRank ?? [])
const heat = computed(() => stats.overview?.positionHeat ?? [])
const warnings = computed(() => stats.overview?.warnings ?? [])

/** 项目完成率排行：竖向柱状图，柱顶显示百分比（原型截图 image20） */
const rankOption = computed<EChartsOption>(() => ({
  grid: { left: 12, right: 16, top: 34, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: {
    type: 'category',
    data: rank.value.map((item) => item.shortName),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#E5E9F0' } },
    axisLabel: { color: '#646A73', fontSize: 11, interval: 0 },
  },
  yAxis: { type: 'value', max: 100, show: false },
  series: [
    {
      type: 'bar',
      name: '完成率',
      data: rank.value.map((item) => item.rate),
      barWidth: '42%',
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
        formatter: '{c}%',
        color: '#1E7BE8',
        fontSize: 11,
      },
    },
  ],
}))

/** 岗位实训热度：环形图 + 右侧图例带人数（原型截图 image20） */
const heatOption = computed<EChartsOption>(() => {
  // 白蓝主色打头，其余取平台状态色，保证与页面上其它图表的色感一致
  const palette = ['#1677FF', '#13C2C2', '#52C41A', '#FA8C16', '#722ED1', '#EB2F96']
  const lookup = new Map(heat.value.map((item) => [item.name, item.value]))
  return {
    tooltip: { trigger: 'item', formatter: '{b}：{c} 人（{d}%）' },
    legend: {
      orient: 'vertical',
      right: 4,
      top: 'middle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { color: '#646A73', fontSize: 12 },
      formatter: (name: string) => `${name} ${lookup.get(name) ?? 0}`,
    },
    color: palette,
    series: [
      {
        type: 'pie',
        radius: ['50%', '74%'],
        center: ['26%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: heat.value.map((item) => ({ name: item.name, value: item.value })),
      },
    ],
  }
})

onMounted(async () => {
  await classroom.load()
  await refresh()
})
</script>

<template>
  <div class="dashboard">
    <!-- 修复#6：筛选条件 -->
    <section class="filters panel">
      <span class="filters__label">筛选</span>
      <el-select v-model="classFilter" class="filters__select" @change="refresh">
        <el-option label="全部班级" value="all" />
        <el-option
          v-for="item in classroom.list"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
      <el-select v-model="tierFilter" class="filters__select" @change="refresh">
        <el-option label="全部层级" value="all" />
        <el-option label="基础实训" value="basic" />
        <el-option label="进阶实训" value="advanced" />
        <el-option label="拓展实训" value="extended" />
      </el-select>
      <span class="filters__hint">
        指标卡、完成率排行与预警列表都会按筛选条件实时重算（不是静态数据）
      </span>
    </section>

    <!-- 指标读数：六格收进同一块面板，格与格之间只用 1px 细线分隔 -->
    <section class="metrics">
      <template v-if="stats.overview">
        <StatTile v-for="item in metrics" :key="item.key" :label="item.label" :value="item.value" />
      </template>
      <template v-else>
        <div v-for="index in 6" :key="index" class="metric-skeleton skeleton" />
      </template>
    </section>

    <!-- 图表区 -->
    <section class="charts">
      <PanelBlock title="项目完成率排行" class="charts__rank">
        <EChart v-if="stats.overview" :option="rankOption" height="286px" />
        <div v-else class="chart-skeleton skeleton" />
      </PanelBlock>

      <PanelBlock title="岗位实训热度" class="charts__heat">
        <EChart v-if="stats.overview" :option="heatOption" height="286px" />
        <div v-else class="chart-skeleton skeleton" />
      </PanelBlock>
    </section>

    <!-- 预警项目 -->
    <PanelBlock title="预警项目（完成率低于60%）" :padded="false">
      <el-table :data="warnings" style="width: 100%">
        <el-table-column prop="projectName" label="项目名称" min-width="240" />
        <el-table-column label="完成率" width="140">
          <template #default="{ row }">
            <span class="num" :class="scoreClass(row.rate)">{{ row.rate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="平均得分" width="140">
          <template #default="{ row }">
            <span class="num">{{ row.avgScore ?? '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="advice" label="建议" min-width="240" />
      </el-table>
    </PanelBlock>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 筛选条（修复#6） */
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 18px;
}

.filters__label {
  color: var(--ink-3);
  font-size: 12.5px;
  letter-spacing: 0.06em;
}

.filters__select {
  width: 160px;
}

.filters__hint {
  color: var(--ink-3);
  font-size: 12px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  /* gap + 底色 = 格线：换行时横线也会自动出现，不用逐格写 border */
  gap: 1px;
  background: var(--line-soft);
  border: 1px solid var(--line-soft);
  border-radius: var(--r-md);
  box-shadow: var(--sh-1);
  overflow: hidden;
}

.metric-skeleton {
  height: 86px;
  border-radius: 0;
}

.charts {
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(0, 3fr);
  gap: 16px;
  align-items: start;
}

.chart-skeleton {
  height: 286px;
}

@media (max-width: 1440px) {
  .metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
