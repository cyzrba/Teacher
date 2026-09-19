import { http, unwrap } from './http'
import type { CreateTaskPayload, PageQuery, PageResult, TrainTask } from '@/types'

export interface TaskQuery extends PageQuery {
  classId?: string
  group?: string
}

export function fetchTasks(query: TaskQuery = {}): Promise<PageResult<TrainTask>> {
  return unwrap<PageResult<TrainTask>>(http.get('/tasks', { params: query }))
}

export function createTask(payload: CreateTaskPayload): Promise<TrainTask[]> {
  return unwrap<TrainTask[]>(http.post('/tasks', payload))
}

/** 撤回任务（置为已撤回） */
export function revokeTask(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(http.delete(`/tasks/${id}`))
}
