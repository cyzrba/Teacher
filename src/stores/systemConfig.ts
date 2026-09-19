/**
 * 系统配置 store（真实后端，接口文档 §3.3）
 * 服务于「系统配置 → 更多设置」：平台参数（AI 模型、检索参数、证书编号规则…）的增删改查。
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createSystemConfig,
  deleteSystemConfig,
  fetchSystemConfigs,
  updateSystemConfig,
} from '@/api/backend/configs'
import type { SystemConfig, SystemConfigPayload } from '@/api/backend/configs'
import { CURRENT_TEACHER_ID } from '@/config/backend'

export const useSystemConfigStore = defineStore('systemConfig', () => {
  const list = ref<SystemConfig[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    try {
      const result = await fetchSystemConfigs()
      list.value = result.items
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  async function create(payload: SystemConfigPayload): Promise<SystemConfig> {
    const created = await createSystemConfig({ updated_by: CURRENT_TEACHER_ID, ...payload })
    await load()
    return created
  }

  async function update(
    configId: number,
    payload: SystemConfigPayload,
  ): Promise<SystemConfig> {
    const updated = await updateSystemConfig(configId, {
      updated_by: CURRENT_TEACHER_ID,
      ...payload,
    })
    await load()
    return updated
  }

  async function remove(configId: number): Promise<void> {
    await deleteSystemConfig(configId)
    await load()
  }

  return { list, total, loading, load, create, update, remove }
})
