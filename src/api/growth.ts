import { http, unwrap } from './http'
import type { GrowthRule } from '@/types'

export function fetchGrowthRules(): Promise<GrowthRule[]> {
  return unwrap<GrowthRule[]>(http.get('/growth-rules'))
}

export function saveGrowthRules(rules: GrowthRule[]): Promise<GrowthRule[]> {
  return unwrap<GrowthRule[]>(http.put('/growth-rules', { rules }))
}
