import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { batchReview, fetchReview, fetchReviews, saveReview, toggleStar } from '@/api/reviews'
import type { ReviewItem, ReviewStatus } from '@/types'

export const useReviewStore = defineStore('review', () => {
  const list = ref<ReviewItem[]>([])
  const current = ref<ReviewItem | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const statusFilter = ref<ReviewStatus | 'all'>('all')
  /** 班级筛选（修复#22） */
  const classFilter = ref<string>('all')
  const keyword = ref('')

  const pendingCount = computed(() => list.value.filter((item) => item.status === 'pending').length)

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const result = await fetchReviews({
        status: statusFilter.value,
        classId: classFilter.value,
        keyword: keyword.value,
        pageSize: 100,
      })
      list.value = result.list
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function applyFilter(
    status: ReviewStatus | 'all',
    value = keyword.value,
    classId = classFilter.value,
  ): Promise<void> {
    statusFilter.value = status
    keyword.value = value
    classFilter.value = classId
    await load(true)
  }

  async function loadOne(id: string): Promise<ReviewItem | null> {
    current.value = await fetchReview(id)
    return current.value
  }

  async function persist(payload: Partial<ReviewItem>): Promise<void> {
    const target = current.value
    if (!target) return
    const updated = await saveReview(target.id, {
      status: payload.status,
      moduleScores: payload.moduleScores,
      feedback: payload.feedback,
      score: payload.score,
    })
    if (updated) current.value = updated
    await load(true)
  }

  /** 列表内直接通过 / 驳回，可多选批量 */
  async function decide(
    ids: string[],
    status: Extract<ReviewStatus, 'approved' | 'rejected'>,
    rejectReason?: string,
  ): Promise<void> {
    await batchReview(ids, status, rejectReason)
    await load(true)
  }

  async function star(id: string): Promise<void> {
    await toggleStar(id)
    await load(true)
  }

  return {
    list,
    current,
    loading,
    statusFilter,
    classFilter,
    pendingCount,
    load,
    applyFilter,
    loadOne,
    persist,
    decide,
    star,
  }
})
