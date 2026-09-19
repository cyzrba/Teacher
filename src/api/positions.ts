import { http, unwrap } from './http'
import type { PageQuery, PageResult, Position, ProjectTier } from '@/types'

export interface PositionQuery extends PageQuery {
  level?: ProjectTier | 'all'
}

export function fetchPositions(query: PositionQuery = {}): Promise<PageResult<Position>> {
  return unwrap<PageResult<Position>>(http.get('/positions', { params: query }))
}

export interface PositionPayload {
  name: string
  level: ProjectTier
  enabled: boolean
  scenario: string
  summary: string
  skillTagIds: string[]
}

export function createPosition(payload: PositionPayload): Promise<Position> {
  return unwrap<Position>(http.post('/positions', payload))
}

export function updatePosition(id: string, payload: PositionPayload): Promise<Position | null> {
  return unwrap<Position | null>(http.put(`/positions/${id}`, payload))
}

export function deletePosition(id: string): Promise<{ ok: boolean }> {
  return unwrap<{ ok: boolean }>(http.delete(`/positions/${id}`))
}
