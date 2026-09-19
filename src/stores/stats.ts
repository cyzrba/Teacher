import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchLearning, fetchOverview, fetchTaskCompletion } from '@/api/stats'
import type { OverviewQuery } from '@/api/stats'
import type { LearningStats, OverviewStats, TaskCompletion } from '@/types'

export const useStatsStore = defineStore('stats', () => {
  const overview = ref<OverviewStats | null>(null)
  const learning = ref<LearningStats | null>(null)
  /** 单次任务的完成情况（修复#7） */
  const taskCompletion = ref<TaskCompletion | null>(null)
  const loading = ref(false)

  async function loadOverview(query: OverviewQuery = {}, force = false): Promise<void> {
    if (overview.value && !force && Object.keys(query).length === 0) return
    loading.value = true
    try {
      overview.value = await fetchOverview(query)
    } finally {
      loading.value = false
    }
  }

  async function loadLearning(params: { keyword?: string; classId?: string } = {}, force = false): Promise<void> {
    if (learning.value && !force && Object.keys(params).length === 0) return
    loading.value = true
    try {
      learning.value = await fetchLearning(params)
    } finally {
      loading.value = false
    }
  }

  async function loadTaskCompletion(taskId: string): Promise<void> {
    loading.value = true
    try {
      taskCompletion.value = await fetchTaskCompletion(taskId)
    } finally {
      loading.value = false
    }
  }

  function clearTaskCompletion(): void {
    taskCompletion.value = null
  }

  return {
    overview,
    learning,
    taskCompletion,
    loading,
    loadOverview,
    loadLearning,
    loadTaskCompletion,
    clearTaskCompletion,
  }
})
