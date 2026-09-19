/**
 * 实训结果审核 store（真实后端，接口文档 §9）
 *
 * 结构是「提交列表 + 当前选中的提交详情」：
 * 列表只返回 student_id / project_id，姓名与项目名要额外补，
 * 所以这里同时维护一份学生名册（id → 姓名）映射。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  claimSubmission,
  createReview,
  fetchSubmission,
  fetchSubmissions,
  markSubmission,
  runAiReview,
  updateReview,
} from '@/api/backend/reviews'
import type {
  AiReviewResult,
  ReviewPayload,
  ReviewRecord,
  SubmissionDetail,
  SubmissionListItem,
} from '@/api/backend/reviews'
import { fetchUsers } from '@/api/backend/users'
import { fetchAttempt, fetchStageFiles } from '@/api/backend/attempts'
import type { StageFile } from '@/api/backend/attempts'
import { CURRENT_TEACHER_ID } from '@/config/backend'

export const useSubmissionsStore = defineStore('submissions', () => {
  const list = ref<SubmissionListItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const detailLoading = ref(false)
  const detail = ref<SubmissionDetail | null>(null)
  const studentNames = ref<Map<number, string>>(new Map())
  /** 当前提交里「关卡 id → 该关的作答附件」 */
  const stageFiles = ref<Map<number, StageFile[]>>(new Map())

  const current = computed(() => detail.value)
  const reviews = computed<ReviewRecord[]>(() => detail.value?.reviews ?? [])

  /** 最新一条 AI 评审（通常是 FINAL） */
  const aiReview = computed<ReviewRecord | null>(
    () => reviews.value.find((item) => item.review_kind === 'AI') ?? null,
  )

  /** 最新一条教师评审（草稿或定稿） */
  const teacherReview = computed<ReviewRecord | null>(
    () => reviews.value.find((item) => item.review_kind === 'TEACHER') ?? null,
  )

  /**
   * 是否及格：**AI 评审判定通过且该评审已定稿**才算及格，其余一律未及格。
   * （教师定稿后由后端按项目层级及格线重新判定，并写进提交的 final_conclusion，
   *  所以「已复审」的提交看 final_conclusion 才是最终结论。）
   */
  const aiPassed = computed(() => {
    const ai = aiReview.value
    return Boolean(ai && ai.status === 'FINAL' && ai.conclusion === 'PASS')
  })

  const finalPassed = computed(() => {
    // final_conclusion 由「定稿」的评审写入：教师定稿后它就是最终结论
    const conclusion = detail.value?.final_conclusion
    if (conclusion) return conclusion === 'PASS'
    return aiPassed.value
  })

  /** 是否已经产生过结论：没有定稿评审时是「待判定」，不能显示成未及格 */
  const judged = computed(
    () => Boolean(detail.value?.final_conclusion) || Boolean(aiReview.value),
  )

  function studentNameOf(studentId: number | null): string {
    if (!studentId) return '--'
    return studentNames.value.get(studentId) ?? `学生 #${studentId}`
  }

  async function loadStudents(): Promise<void> {
    const result = await fetchUsers({ user_type: 'STUDENT' })
    studentNames.value = new Map(result.items.map((item) => [item.id, item.real_name]))
  }

  async function load(params: {
    status?: string
    is_starred?: boolean
    student_id?: number
    project_id?: number
  } = {}): Promise<void> {
    loading.value = true
    try {
      const result = await fetchSubmissions(params)
      list.value = result.items
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(submissionId: number): Promise<void> {
    detailLoading.value = true
    try {
      const result = await fetchSubmission(submissionId)

      /**
       * 两处补数（提交详情接口本身不返回）：
       * 1. 学生 / 项目 / 轮次信息来自列表项（详情只有 attempt_id）；
       * 2. 关卡序号 / 名称 / 权重 / 引导子标题 / 附件数要去 `GET /attempts/{id}` 取，
       *    再和提交里的作答内容按 id 合并。
       */
      const listItem = list.value.find((item) => item.id === submissionId)
      const attempt = result.attempt?.id
        ? await fetchAttempt(result.attempt.id).catch(() => null)
        : null
      const richStages = new Map((attempt?.stages ?? []).map((item) => [item.id, item]))
      const stages = (result.stages ?? []).map((stage) => ({
        ...richStages.get(stage.id),
        ...stage,
      }))

      /**
       * 提交详情接口不带学生 / 项目 / 轮次信息：
       * 有列表项就用列表项补，直接进详情页（列表还没加载）时用轮次接口的字段兜底。
       */
      detail.value = {
        ...(listItem ?? {}),
        ...result,
        stages,
        student_id: listItem?.student_id ?? attempt?.student_id ?? null,
        project_id: listItem?.project_id ?? attempt?.project_id ?? null,
        project_name: listItem?.project_name ?? attempt?.project_name ?? null,
        attempt_no: listItem?.attempt_no ?? attempt?.attempt_no ?? null,
      } as SubmissionDetail

      // 作答附件：只对「附件数 > 0」的关卡发请求
      const files = new Map<number, StageFile[]>()
      if (attempt) {
        await Promise.all(
          stages
            .filter((stage) => (stage.file_count ?? 0) > 0)
            .map(async (stage) => {
              const list = await fetchStageFiles(attempt.id, stage.id).catch(() => [])
              files.set(stage.id, list)
            }),
        )
      }
      stageFiles.value = files
    } finally {
      detailLoading.value = false
    }
  }

  /** 教师保存评审：新增或更新（草稿 / 定稿） */
  async function saveReview(
    payload: ReviewPayload,
    existing?: ReviewRecord | null,
  ): Promise<ReviewRecord> {
    const submissionId = detail.value?.id ?? 0
    const result = existing
      ? await updateReview(existing.id, payload)
      : await createReview(submissionId, { reviewer_id: CURRENT_TEACHER_ID, ...payload })
    await Promise.all([loadDetail(submissionId), loadServiceList()])
    return result
  }

  /** 列表刷新时保留当前筛选条件（调用方传入） */
  const lastQuery = ref<{
    status?: string
    is_starred?: boolean
    student_id?: number
    project_id?: number
  }>({})

  async function loadServiceList(): Promise<void> {
    await load(lastQuery.value)
  }

  async function applyFilter(query: {
    status?: string
    is_starred?: boolean
    student_id?: number
    project_id?: number
  }): Promise<void> {
    lastQuery.value = query
    await load(query)
  }

  async function claim(submissionId: number): Promise<void> {
    await claimSubmission(submissionId)
    await Promise.all([loadDetail(submissionId), loadServiceList()])
  }

  async function star(submissionId: number, starred: boolean): Promise<void> {
    await markSubmission(submissionId, { is_starred: starred })
    await Promise.all([loadDetail(submissionId), loadServiceList()])
  }

  /** 教师手动触发一次 AI 评审（同步接口，几秒） */
  async function rerunAiReview(submissionId: number): Promise<AiReviewResult> {
    const result = await runAiReview(submissionId)
    await Promise.all([loadDetail(submissionId), loadServiceList()])
    return result
  }

  return {
    list,
    total,
    loading,
    detailLoading,
    detail,
    current,
    reviews,
    aiReview,
    teacherReview,
    aiPassed,
    finalPassed,
    judged,
    stageFiles,
    studentNames,
    studentNameOf,
    loadStudents,
    load,
    loadDetail,
    applyFilter,
    saveReview,
    claim,
    star,
    rerunAiReview,
  }
})
