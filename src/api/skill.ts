import { http, unwrap } from './http'
import type { SkillSystem, SkillTag, SkillSystemId, ProjectTier } from '@/types'

/** 技能点写入载荷：判定口径字段可选，缺省由服务端按平台默认值补齐 */
export interface SkillTagPayload {
  name: string
  systemId: SkillSystemId
  level?: ProjectTier
  passScore?: number
  requiredHits?: number
  description?: string
  enabled?: boolean
}

export function fetchSkillSystems(): Promise<SkillSystem[]> {
  return unwrap<SkillSystem[]>(http.get('/skill-systems'))
}

export function fetchSkillTags(systemId?: SkillSystemId, keyword?: string): Promise<SkillTag[]> {
  return unwrap<SkillTag[]>(http.get('/skill-tags', { params: { systemId, keyword } }))
}

export function createSkillTag(payload: SkillTagPayload): Promise<SkillTag> {
  return unwrap<SkillTag>(http.post('/skill-tags', payload))
}

export function updateSkillTag(id: string, payload: SkillTagPayload): Promise<SkillTag> {
  return unwrap<SkillTag>(http.put(`/skill-tags/${id}`, payload))
}

/**
 * 删除技能点。
 * 已被岗位 / 项目引用的技能点不允许删除（服务端返回具体引用数量），
 * 前端把错误提示直接展示给教师。
 */
export function deleteSkillTag(id: string): Promise<{ ok: true }> {
  return unwrap<{ ok: true }>(http.delete(`/skill-tags/${id}`))
}
