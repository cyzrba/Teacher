/**
 * 系统配置（接口文档 §3.3）：换模型 / 调阈值不改代码靠这张表。
 *
 * `config_value` 是 JSON 对象，**更新时整体替换**（不是深合并），
 * 所以界面上先把值读出来、改好再整体提交。
 */

import { del, get, patch, post } from './client'
import type { ApiPage } from './client'

export interface SystemConfig {
  id: number
  config_key: string
  config_value: Record<string, unknown>
  description: string | null
  updated_by: number | null
  updated_at: string
}

export interface SystemConfigPayload {
  config_key?: string
  config_value?: Record<string, unknown>
  description?: string | null
  updated_by?: number | null
}

export function fetchSystemConfigs(params: {
  keyword?: string
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<SystemConfig>> {
  return get<ApiPage<SystemConfig>>('/system-configs', { page_size: 200, ...params })
}

export function createSystemConfig(payload: SystemConfigPayload): Promise<SystemConfig> {
  return post<SystemConfig>('/system-configs', payload)
}

export function updateSystemConfig(
  configId: number,
  payload: SystemConfigPayload,
): Promise<SystemConfig> {
  return patch<SystemConfig>(`/system-configs/${configId}`, payload)
}

export function deleteSystemConfig(configId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/system-configs/${configId}`)
}
