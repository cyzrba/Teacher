import { http, unwrap } from './http'

/** GET /api/v1/exports/{type} —— 成绩 / 报告汇总 / 学习过程 / 技能成长（P1） */
export function exportData(type: string): Promise<{ file: string; ok: boolean }> {
  return unwrap<{ file: string; ok: boolean }>(http.get(`/exports/${type}`))
}
