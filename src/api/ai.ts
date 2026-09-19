import { http, unwrap } from './http'

/**
 * AI 答辩 / AI 面试：一期仅保留接口占位（P0），页面入口置为「敬请期待」。
 * 后端就绪后实现 POST /api/v1/ai/defense 与 /api/v1/ai/interview 即可。
 */
export function callAiDefense(payload: { projectId: string; studentId: string }): Promise<unknown> {
  return unwrap<unknown>(http.post('/ai/defense', payload))
}

export function callAiInterview(payload: { positionId: string; studentId: string }): Promise<unknown> {
  return unwrap<unknown>(http.post('/ai/interview', payload))
}
