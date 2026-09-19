import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  batchOfflineProjects,
  createProject,
  deleteProject,
  fetchProjects,
  fetchPublishRecords,
  offlineProject,
  publishProject,
  saveModules,
  updateProject,
} from '@/api/projects'
import type {
  CreateProjectPayload,
  Project,
  ProjectTier,
  PublishMode,
  PublishRecord,
  TrainModule,
} from '@/types'
import { cloneDefaultModules, cloneModules } from '@/config/modules'
import { getModuleTemplate, setModuleTemplate } from '@/utils/storage'

export const useProjectStore = defineStore('project', () => {
  const list = ref<Project[]>([])
  const publishList = ref<PublishRecord[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const tierFilter = ref<ProjectTier | 'all'>('all')
  const keyword = ref('')

  /**
   * 标准化实训模块的「标准配置」：
   * 教师在本页调整后保存，新建项目默认继承（需求：创建时默认使用标准配置，可微调）。
   */
  const standardModules = ref<TrainModule[]>(
    getModuleTemplate<TrainModule[]>() ?? cloneDefaultModules(),
  )

  const publishedCount = computed(
    () => publishList.value.filter((item) => item.status === 'published').length,
  )
  const pendingCount = computed(
    () => publishList.value.filter((item) => item.status === 'pending').length,
  )

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const [projectResult, publishResult] = await Promise.all([
        fetchProjects({ tier: tierFilter.value, keyword: keyword.value, pageSize: 100 }),
        fetchPublishRecords({ pageSize: 100 }),
      ])
      list.value = projectResult.list
      publishList.value = publishResult.list
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function setTier(tier: ProjectTier | 'all'): Promise<void> {
    tierFilter.value = tier
    await load(true)
  }

  async function search(value: string): Promise<void> {
    keyword.value = value
    await load(true)
  }

  async function create(payload: CreateProjectPayload): Promise<void> {
    await createProject(payload)
    await load(true)
  }

  async function update(id: string, payload: Partial<CreateProjectPayload>): Promise<void> {
    await updateProject(id, payload)
    await load(true)
  }

  async function publish(
    id: string,
    payload: { publishMode: PublishMode; publishTarget: string; publishAt?: string },
  ): Promise<void> {
    await publishProject(id, payload)
    await load(true)
  }

  async function offline(id: string): Promise<void> {
    await offlineProject(id)
    await load(true)
  }

  async function batchOffline(ids: string[]): Promise<void> {
    await batchOfflineProjects(ids)
    await load(true)
  }

  async function remove(id: string): Promise<void> {
    await deleteProject(id)
    await load(true)
  }

  async function persistModules(id: string, modules: TrainModule[]): Promise<void> {
    await saveModules(id, modules)
    await load(true)
  }

  /** 保存标准配置：落本地 + 回显，新建项目时按它初始化 */
  function saveStandardModules(): void {
    setModuleTemplate(standardModules.value)
  }

  function resetStandardModules(): void {
    standardModules.value = cloneDefaultModules()
    setModuleTemplate(standardModules.value)
  }

  return {
    list,
    publishList,
    loading,
    tierFilter,
    standardModules,
    publishedCount,
    pendingCount,
    load,
    setTier,
    search,
    create,
    update,
    publish,
    offline,
    batchOffline,
    remove,
    persistModules,
    saveStandardModules,
    resetStandardModules,
  }
})

export { cloneModules }
