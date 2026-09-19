/**
 * 实训项目 store（真实后端）：模块库 / 项目 / 关卡组成 / 附件 / 关联技能。
 *
 * 面向「实训项目管理」页；旧的 `stores/project.ts`（Mock）仍服务于尚未迁移的页面。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createProject,
  createStageTemplate,
  deleteProject,
  deleteStageTemplate,
  fetchProject,
  fetchProjects,
  fetchStageTemplates,
  removeProjectFile,
  removeProjectModule,
  reorderProjectModules,
  setProjectSkills,
  updateProject,
  updateProjectModule,
  updateStageTemplate,
  uploadProjectFile,
  addProjectModule,
} from '@/api/backend/projects'
import type { ProjectPayload, StageTemplatePayload } from '@/api/backend/projects'
import type {
  ProjectModule,
  ProjectRead,
  SkillTreeNode,
  StageItem,
  StageTemplate,
} from '@/api/backend/types'
import { CURRENT_TEACHER_ID } from '@/config/backend'

export const useProjectsStore = defineStore('projectsApi', () => {
  const list = ref<ProjectRead[]>([])
  const total = ref(0)
  const loading = ref(false)
  const detail = ref<ProjectRead | null>(null)
  const templates = ref<StageTemplate[]>([])
  const templatesLoading = ref(false)

  const modules = computed<ProjectModule[]>(() => detail.value?.modules ?? [])
  const weightTotal = computed(() =>
    modules.value.reduce((sum, item) => sum + Number.parseFloat(item.weight || '0'), 0),
  )

  async function load(params: {
    keyword?: string
    project_level?: string
    status?: string
    job_id?: number
    page?: number
    page_size?: number
  } = {}): Promise<void> {
    loading.value = true
    try {
      const result = await fetchProjects({ page_size: 100, ...params })
      list.value = result.items
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(projectId: number): Promise<ProjectRead> {
    const result = await fetchProject(projectId)
    detail.value = result
    return result
  }

  async function loadTemplates(keyword = ''): Promise<void> {
    templatesLoading.value = true
    try {
      const result = await fetchStageTemplates({ page_size: 200, keyword })
      templates.value = result.items
    } finally {
      templatesLoading.value = false
    }
  }

  /* —— 项目 —— */

  async function create(payload: ProjectPayload): Promise<ProjectRead> {
    const created = await createProject({ creator_id: CURRENT_TEACHER_ID, ...payload })
    await load()
    return created
  }

  async function update(projectId: number, payload: Partial<ProjectPayload>): Promise<void> {
    await updateProject(projectId, payload)
    await load()
  }

  /** 发布 / 下架（发布前后端会校验关卡与权重合计） */
  async function setStatus(
    projectId: number,
    status: 'PUBLISHED' | 'OFF_SHELF' | 'DRAFT',
  ): Promise<void> {
    await updateProject(projectId, { status })
    await load()
    if (detail.value?.id === projectId) await loadDetail(projectId)
  }

  async function remove(projectId: number): Promise<void> {
    await deleteProject(projectId)
    await load()
  }

  /* —— 关卡组成 —— */

  async function addModule(
    projectId: number,
    templateId: number,
    payload: Partial<{
      requirement: string | null
      accept_standard: string | null
      required: boolean
      weight: string | number
      items_json: StageItem[]
    }> = {},
  ): Promise<void> {
    await addProjectModule(projectId, { template_id: templateId, ...payload })
    await loadDetail(projectId)
  }

  async function patchModule(
    projectId: number,
    moduleId: number,
    payload: Partial<{
      requirement: string | null
      accept_standard: string | null
      required: boolean
      weight: string | number
      items_json: StageItem[]
    }>,
  ): Promise<void> {
    await updateProjectModule(projectId, moduleId, payload)
    await loadDetail(projectId)
  }

  async function removeModule(projectId: number, moduleId: number): Promise<void> {
    await removeProjectModule(projectId, moduleId)
    await loadDetail(projectId)
  }

  /** 整体重排（拖拽 / 上移下移后调用） */
  async function reorderModules(projectId: number, moduleIds: number[]): Promise<void> {
    await reorderProjectModules(projectId, moduleIds)
    await loadDetail(projectId)
  }

  /* —— 附件 —— */

  async function uploadFile(
    projectId: number,
    file: File,
    fileKind: string,
    title?: string,
  ): Promise<void> {
    await uploadProjectFile(projectId, file, fileKind, title)
    await loadDetail(projectId)
  }

  async function removeFile(projectId: number, projectFileId: number): Promise<void> {
    await removeProjectFile(projectId, projectFileId)
    await loadDetail(projectId)
  }

  /* —— 关联技能 —— */

  async function setSkills(projectId: number, skillNodeIds: number[]): Promise<SkillTreeNode[]> {
    const result = await setProjectSkills(projectId, skillNodeIds)
    await loadDetail(projectId)
    return result
  }

  /* —— 模块库 —— */

  async function createTemplate(payload: StageTemplatePayload): Promise<void> {
    await createStageTemplate(payload)
    await loadTemplates()
  }

  async function updateTemplate(
    templateId: number,
    payload: Partial<StageTemplatePayload>,
  ): Promise<void> {
    await updateStageTemplate(templateId, payload)
    await loadTemplates()
  }

  async function removeTemplate(templateId: number): Promise<void> {
    await deleteStageTemplate(templateId)
    await loadTemplates()
  }

  return {
    list,
    total,
    loading,
    detail,
    modules,
    weightTotal,
    templates,
    templatesLoading,
    load,
    loadDetail,
    loadTemplates,
    create,
    update,
    setStatus,
    remove,
    addModule,
    patchModule,
    removeModule,
    reorderModules,
    uploadFile,
    removeFile,
    setSkills,
    createTemplate,
    updateTemplate,
    removeTemplate,
  }
})
