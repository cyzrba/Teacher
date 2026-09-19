import { http, unwrap } from './http'
import type { ClassGroup, PageQuery, PageResult, SchoolClass } from '@/types'

export interface ClassQuery extends PageQuery {
  pageSize?: number
}

export function fetchClasses(query: ClassQuery = {}): Promise<PageResult<SchoolClass>> {
  return unwrap<PageResult<SchoolClass>>(http.get('/classes', { params: query }))
}

export interface ClassPayload {
  name: string
  teacher: string
  groupCount: number
  remark: string
}

export function createClass(payload: ClassPayload): Promise<SchoolClass> {
  return unwrap<SchoolClass>(http.post('/classes', payload))
}

export function updateClass(id: string, payload: ClassPayload): Promise<SchoolClass | null> {
  return unwrap<SchoolClass | null>(http.put(`/classes/${id}`, payload))
}

export function deleteClass(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(http.delete(`/classes/${id}`))
}

/** PUT /api/v1/classes/{id}/students —— 调整分组 */
export function updateClassStudents(
  id: string,
  groups: ClassGroup[],
): Promise<SchoolClass | null> {
  return unwrap<SchoolClass | null>(http.put(`/classes/${id}/students`, { groups }))
}
