/**
 * 闯关轮次（接口文档 §9.3）
 *
 * 教师审核时用它补全「关卡信息」：提交详情里的 stages 只有作答内容，
 * 关卡序号 / 名称 / 权重 / 引导子标题 / 附件数要去 `GET /attempts/{id}` 拿。
 */

import { get } from './client'

/** 作答附件（文件台账条目）：下载走 `/api/file-assets/{id}/download`（文件流） */
export interface StageFile {
  id: number
  uploader_id: number | null
  original_name: string
  content_type: string | null
  size_bytes: number
  biz_type: string | null
  status: string
  created_at: string
}

export interface AttemptStageDetail {
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

export interface AttemptDetail {
  id: number
  student_id: number
  project_id: number
  project_name: string | null
  student_project_id: number
  attempt_no: number
  status: string
  filled_stage_count: number
  total_score: string | null
  created_at: string
  updated_at: string
  stages: AttemptStageDetail[]
}

export function fetchAttempt(attemptId: number): Promise<AttemptDetail> {
  return get<AttemptDetail>(`/attempts/${attemptId}`)
}

/** 某个关卡的作答附件列表（§9.3） */
export function fetchStageFiles(attemptId: number, stageId: number): Promise<StageFile[]> {
  return get<StageFile[]>(`/attempts/${attemptId}/stages/${stageId}/files`)
}

/** 附件下载地址（相对路径，浏览器直接打开即可下载） */
export function fileDownloadUrl(assetId: number): string {
  return `/api/file-assets/${assetId}/download`
}
