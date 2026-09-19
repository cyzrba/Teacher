import { http, unwrap } from './http'
import type { LearningStats, OverviewStats, TaskCompletion } from '@/types'

export interface OverviewQuery {
  /** 项目层级筛选：all / basic / advanced / extended（修复#6） */
  tier?: string
  /** 班级筛选（修复#6） */
  classId?: string
}

/** GET /api/v1/stats/overview —— 数据总览（指标按当前数据实时派生） */
export function fetchOverview(query: OverviewQuery = {}): Promise<OverviewStats> {
  return unwrap<OverviewStats>(http.get('/stats/overview', { params: query }))
}

/** GET /api/v1/stats/learning —— 学习过程统计（P1） */
export function fetchLearning(
  params: { keyword?: string; classId?: string } = {},
): Promise<LearningStats> {
  return unwrap<LearningStats>(http.get('/stats/learning', { params }))
}

/** GET /api/v1/stats/task/{id} —— 单次任务的完成情况（修复#7） */
export function fetchTaskCompletion(taskId: string): Promise<TaskCompletion | null> {
  return unwrap<TaskCompletion | null>(http.get(`/stats/task/${taskId}`))
}
