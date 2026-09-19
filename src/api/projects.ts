import { http, unwrap } from './http'
import type {
  CreateProjectPayload,
  ImportedStudent,
  PageQuery,
  PageResult,
  Project,
  ProjectTier,
  PublishMode,
  PublishRecord,
  TrainModule,
} from '@/types'

export interface ProjectQuery extends PageQuery {
  tier?: ProjectTier | 'all'
}

export function fetchProjects(query: ProjectQuery = {}): Promise<PageResult<Project>> {
  return unwrap<PageResult<Project>>(http.get('/projects', { params: query }))
}

export function fetchProject(id: string): Promise<Project | null> {
  return unwrap<Project | null>(http.get(`/projects/${id}`))
}

export function createProject(payload: CreateProjectPayload): Promise<Project> {
  return unwrap<Project>(http.post('/projects', payload))
}

export function updateProject(id: string, payload: Partial<CreateProjectPayload>): Promise<Project | null> {
  return unwrap<Project | null>(http.put(`/projects/${id}`, payload))
}

/** 发布：选择发布对象 / 发布方式 / 定时时间 */
export function publishProject(
  id: string,
  payload: { publishMode: PublishMode; publishTarget: string; publishAt?: string },
): Promise<Project | null> {
  return unwrap<Project | null>(http.put(`/projects/${id}/publish`, payload))
}

export function offlineProject(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(http.put(`/projects/${id}/offline`))
}

/** DELETE /api/v1/projects/{id} —— 删除实训项目 */
export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(http.delete(`/projects/${id}`))
}

export function batchOfflineProjects(ids: string[]): Promise<{ ok: boolean; count: number }> {
  return unwrap<{ ok: boolean; count: number }>(http.post('/projects/batch-offline', { ids }))
}

export function fetchModules(id: string): Promise<TrainModule[]> {
  return unwrap<TrainModule[]>(http.get(`/projects/${id}/modules`))
}

export function saveModules(id: string, modules: TrainModule[]): Promise<TrainModule[]> {
  return unwrap<TrainModule[]>(http.put(`/projects/${id}/modules`, { modules }))
}

/** 批量导入学生（CSV） */
export function importProjectStudents(
  id: string,
  imports: ImportedStudent[],
): Promise<{ ok: boolean; imported: number }> {
  return unwrap<{ ok: boolean; imported: number }>(http.post(`/projects/${id}/students`, { imports }))
}

export function fetchPublishRecords(
  query: PageQuery & { status?: string } = {},
): Promise<PageResult<PublishRecord>> {
  return unwrap<PageResult<PublishRecord>>(http.get('/publish-records', { params: query }))
}
