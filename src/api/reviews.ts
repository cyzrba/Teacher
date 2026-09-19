import { http, unwrap } from './http'
import type { PageQuery, PageResult, ReviewItem, ReviewStatus } from '@/types'

export interface ReviewQuery extends PageQuery {
  status?: ReviewStatus | 'all'
  /** 班级筛选（修复#22） */
  classId?: string
}

export function fetchReviews(query: ReviewQuery = {}): Promise<PageResult<ReviewItem>> {
  return unwrap<PageResult<ReviewItem>>(http.get('/reviews', { params: query }))
}

export function fetchReview(id: string): Promise<ReviewItem | null> {
  return unwrap<ReviewItem | null>(http.get(`/reviews/${id}`))
}

/**
 * 保存审核结果。
 * 截图三态：approved / rejected / pending。
 * 文字需求的「复审中 / 已复审」不在此实现，仅通过 recheck 字段预留（见 README）。
 */
export function saveReview(
  id: string,
  payload: Partial<Pick<ReviewItem, 'status' | 'moduleScores' | 'feedback' | 'score' | 'rejectReason' | 'starred'>>,
): Promise<ReviewItem | null> {
  return unwrap<ReviewItem | null>(http.put(`/reviews/${id}`, payload))
}

export function toggleStar(id: string): Promise<ReviewItem | null> {
  return unwrap<ReviewItem | null>(http.post(`/reviews/${id}/star`))
}

export function batchReview(
  ids: string[],
  status: Extract<ReviewStatus, 'approved' | 'rejected'>,
  rejectReason?: string,
): Promise<{ ok: boolean; count: number }> {
  return unwrap<{ ok: boolean; count: number }>(
    http.post('/reviews/batch-review', { ids, status, rejectReason }),
  )
}
