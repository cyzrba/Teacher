/**
 * 任务下发（接口文档 §8）：把已发布项目发给班级 / 分组。
 */

import { del, get, patch, post } from './client'
import type { ApiPage } from './client'
import type { PublishableProject, PublishTask, StudentPreview, TaskTarget } from './types'

export interface TaskPayload {
  title: string
  description?: string | null
  project_level?: 'BASIC' | 'ADVANCED' | 'EXPANDED' | null
  job_ids?: number[]
  targets: TaskTarget[]
  project_ids?: number[]
  publish_mode?: 'IMMEDIATE' | 'SCHEDULED'
  scheduled_at?: string | null
  deadline_at?: string | null
  creator_id?: number
  remark?: string | null
}

export function fetchTasks(params: {
  keyword?: string
  status?: string
  project_level?: string
  creator_id?: number
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<PublishTask>> {
  return get<ApiPage<PublishTask>>('/publish-tasks', params)
}

/** 详情：比列表多 targets / jobs / projects / can_edit */
export function fetchTask(taskId: number): Promise<PublishTask> {
  return get<PublishTask>(`/publish-tasks/${taskId}`)
}

/** 创建并下发（默认即时生效） */
export function createTask(payload: TaskPayload): Promise<PublishTask> {
  return post<PublishTask>('/publish-tasks', payload)
}

/**
 * 修改任务。
 * ⚠️ 按接口文档 §8.6 的已知问题：已发布任务只能改
 * `description` / `deadline_at` / `remark`；`PENDING` 任务还能改
 * `title` / `publish_mode` / `scheduled_at`。目标 / 岗位 / 项目 / 层级不可改，
 * 需要变更时「撤回 + 新建」。
 */
export function updateTask(taskId: number, payload: Partial<TaskPayload>): Promise<PublishTask> {
  return patch<PublishTask>(`/publish-tasks/${taskId}`, payload)
}

/** 立即发布（定时任务也可以提前发） */
export function publishTask(taskId: number, creatorId?: number): Promise<PublishTask> {
  // creator_id 走 query（审计操作人）
  return post<PublishTask>(
    `/publish-tasks/${taskId}/publish`,
    undefined,
    creatorId ? { creator_id: creatorId } : undefined,
  )
}

/** 撤回：学生端立刻不可见，闯关记录保留；撤回后不能重新发布 */
export function cancelTask(taskId: number): Promise<PublishTask> {
  return post<PublishTask>(`/publish-tasks/${taskId}/cancel`, undefined)
}

/** 删除：只能删从没发布过的任务 */
export function deleteTask(taskId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/publish-tasks/${taskId}`)
}

/** §8.3 覆盖学生数预览（发之前先看发给谁） */
export function previewStudents(targets: TaskTarget[]): Promise<StudentPreview> {
  return post<StudentPreview>('/publish-tasks/preview-students', { targets })
}

/** §8.4 可发布项目列表（只含 PUBLISHED，给前端做勾选） */
export function fetchPublishableProjects(params: {
  job_ids?: number[]
  project_level?: string
  keyword?: string
} = {}): Promise<PublishableProject[]> {
  return get<PublishableProject[]>('/publish-tasks/publishable-projects', params)
}
