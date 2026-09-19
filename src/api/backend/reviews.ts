/**
 * 实训结果审核（接口文档 §9.4–9.8）：提交 / 评审 / 认领复核 / AI 评审。
 *
 * 关键口径：
 * - **定稿（`status=FINAL`）是唯一的结算触发点**：后端按项目层级及格线判结论，
 *   写提交状态、项目完成与技能进度，所以前端不自己算 PASS/FAIL；
 * - AI 评审是 `FINAL` 的评审记录（`review_kind=AI`），教师评审是另一条 `TEACHER` 记录；
 * - `total_score` / 维度分都是 Decimal，字符串数字，统一用 `num()` 转。
 */

import { del, get, patch, post } from './client'
import type { ApiPage } from './client'

export type SubmissionStatus =
  | 'PENDING_AI'
  | 'AI_PASSED'
  | 'AI_FAILED'
  | 'PENDING_REVIEW'
  | 'REVIEWING'
  | 'REVIEWED'
  | 'WITHDRAWN'

export interface DimensionScore {
  name: string
  score?: number | string | null
  weight?: number | string | null
  reason?: string | null
}

export interface ReviewRecord {
  id: number
  submission_id: number
  review_kind: 'AI' | 'TEACHER'
  version_no: number
  status: 'DRAFT' | 'FINAL'
  reviewer_id: number | null
  total_score: string | null
  conclusion: 'PASS' | 'FAIL' | null
  comment: string | null
  dimension_json: DimensionScore[]
  ai_model: string | null
  raw_json: Record<string, unknown>
  finished_at: string | null
  created_at: string
}

/** 提交列表项：带学生 / 项目 / 轮次信息（教师看板用） */
export interface SubmissionListItem {
  id: number
  attempt_id: number
  submit_no: number
  status: SubmissionStatus
  final_conclusion: 'PASS' | 'FAIL' | null
  total_score: string | null
  objection_reason: string | null
  is_starred: boolean
  submitted_at: string
  withdrawn_at: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  student_id: number | null
  project_id: number | null
  project_name: string | null
  attempt_no: number | null
}

/** 提交详情里的关卡作答 */
export interface SubmissionStage {
  id: number
  attempt_id: number
  project_module_id: number
  stage_no: number
  stage_key: string | null
  stage_name: string | null
  required: boolean
  weight: string
  is_filled: boolean
  answer_text: string | null
  filled_at: string | null
  items_json: { title?: string; prompt?: string }[]
  file_count: number
}

export interface SubmissionDetail extends SubmissionListItem {
  attempt: {
    id: number
    attempt_no: number
    status: string
    filled_stage_count: number
    total_score: string | null
    submitted_at: string | null
  } | null
  stages: SubmissionStage[]
  reviews: ReviewRecord[]
}

export interface ReviewPayload {
  review_kind?: 'AI' | 'TEACHER'
  status?: 'DRAFT' | 'FINAL'
  reviewer_id?: number | null
  total_score?: number | string | null
  comment?: string | null
  dimension_json?: DimensionScore[]
  ai_model?: string | null
}

export interface AiReviewResult {
  review: ReviewRecord
  criteria_doc_ids: number[]
  recalled_chunks: number
  model: string
  warnings: string[]
}

export function fetchSubmissions(params: {
  status?: string
  is_starred?: boolean
  student_id?: number
  project_id?: number
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<SubmissionListItem>> {
  return get<ApiPage<SubmissionListItem>>('/submissions', { page_size: 100, ...params })
}

/** 提交详情：作答（逐关卡）+ 全部评审记录 */
export function fetchSubmission(submissionId: number): Promise<SubmissionDetail> {
  return get<SubmissionDetail>(`/submissions/${submissionId}`)
}

export function fetchSubmissionReviews(submissionId: number): Promise<ReviewRecord[]> {
  return get<ReviewRecord[]>(`/submissions/${submissionId}/reviews`)
}

/** 新增评审；`status=FINAL` 即定稿并结算（会写项目完成与技能进度） */
export function createReview(submissionId: number, payload: ReviewPayload): Promise<ReviewRecord> {
  return post<ReviewRecord>(`/submissions/${submissionId}/reviews`, payload)
}

/** 更新评审；改成 FINAL 即定稿结算（已定稿不能改回草稿） */
export function updateReview(reviewId: number, payload: ReviewPayload): Promise<ReviewRecord> {
  return patch<ReviewRecord>(`/reviews/${reviewId}`, payload)
}

export function deleteReview(reviewId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/reviews/${reviewId}`)
}

/** 教师认领复核：状态转 REVIEWING（AI 还没出结果时会被拒） */
export function claimSubmission(submissionId: number): Promise<SubmissionListItem> {
  return post<SubmissionListItem>(`/submissions/${submissionId}/claim`)
}

/** 教师标记：标星 / 异议说明 / 状态 */
export function markSubmission(
  submissionId: number,
  payload: Partial<{
    is_starred: boolean
    objection_reason: string | null
    status: string
  }>,
): Promise<SubmissionListItem> {
  return patch<SubmissionListItem>(`/submissions/${submissionId}`, payload)
}

/** 触发一次完整 AI 评审（同步，几秒）：RAG 召回评分标准 → 大模型打分 → 落库结算 */
export function runAiReview(submissionId: number): Promise<AiReviewResult> {
  return post<AiReviewResult>(`/submissions/${submissionId}/ai-review`)
}
