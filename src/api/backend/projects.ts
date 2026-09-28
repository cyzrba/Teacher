/**
 * 实训项目：模块库（关卡模板）/ 项目 / 关卡组成 / 附件 / 关联技能（接口文档 §7）
 */

import { del, get, patch, post, put, upload } from './client'
import type { ApiPage } from './client'
import type {
  ProjectFile,
  ProjectModule,
  ProjectRead,
  SkillTreeNode,
  StageItem,
  StageTemplate,
} from './types'

/* -------------------------------------------------------------------------- */
/* §7.2 模块库（关卡模板）                                                      */
/* -------------------------------------------------------------------------- */

export interface StageTemplatePayload {
  stage_name: string
  description?: string | null
  default_required?: boolean
  default_weight?: string | number
  default_requirement?: string | null
  default_accept_standard?: string | null
  sort_no?: number
}

export function fetchStageTemplates(params: {
  keyword?: string
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<StageTemplate>> {
  return get<ApiPage<StageTemplate>>('/stage-templates', params)
}

export function createStageTemplate(payload: StageTemplatePayload): Promise<StageTemplate> {
  return post<StageTemplate>('/stage-templates', payload)
}

export function updateStageTemplate(
  templateId: number,
  payload: Partial<StageTemplatePayload>,
): Promise<StageTemplate> {
  return patch<StageTemplate>(`/stage-templates/${templateId}`, payload)
}

export function deleteStageTemplate(templateId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/stage-templates/${templateId}`)
}

/* -------------------------------------------------------------------------- */
/* §7.3 项目主数据                                                              */
/* -------------------------------------------------------------------------- */

export interface ProjectPayload {
  project_name: string
  project_level: 'BASIC' | 'ADVANCED' | 'EXPANDED'
  difficulty?: number
  job_id?: number | null
  description?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'OFF_SHELF'
  creator_id?: number | null
}

export function fetchProjects(params: {
  keyword?: string
  project_level?: string
  status?: string
  job_id?: number
  creator_id?: number
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<ProjectRead>> {
  return get<ApiPage<ProjectRead>>('/projects', params)
}

/** 详情：项目 + 关卡组成 + 附件 + 权重合计 */
export function fetchProject(projectId: number): Promise<ProjectRead> {
  return get<ProjectRead>(`/projects/${projectId}`)
}

export function createProject(payload: ProjectPayload): Promise<ProjectRead> {
  return post<ProjectRead>('/projects', payload)
}

export function updateProject(
  projectId: number,
  payload: Partial<ProjectPayload>,
): Promise<ProjectRead> {
  return patch<ProjectRead>(`/projects/${projectId}`, payload)
}

export function deleteProject(projectId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/projects/${projectId}`)
}

/* -------------------------------------------------------------------------- */
/* §7.4 项目的关卡组成                                                          */
/* -------------------------------------------------------------------------- */

export function fetchProjectModules(projectId: number): Promise<ProjectModule[]> {
  return get<ProjectModule[]>(`/projects/${projectId}/modules`)
}

export function addProjectModule(
  projectId: number,
  payload: {
    template_id: number
    stage_no?: number
    requirement?: string | null
    accept_standard?: string | null
    required?: boolean
    weight?: string | number
    items_json?: StageItem[]
  },
): Promise<ProjectModule> {
  return post<ProjectModule>(`/projects/${projectId}/modules`, payload)
}

export function updateProjectModule(
  projectId: number,
  moduleId: number,
  payload: Partial<{
    stage_no: number
    requirement: string | null
    accept_standard: string | null
    required: boolean
    weight: string | number
    items_json: StageItem[]
  }>,
): Promise<ProjectModule> {
  return patch<ProjectModule>(`/projects/${projectId}/modules/${moduleId}`, payload)
}

/** 整体重排：module_ids 必须刚好覆盖该项目下的全部关卡 */
export function reorderProjectModules(
  projectId: number,
  moduleIds: number[],
): Promise<ProjectModule[]> {
  return put<ProjectModule[]>(`/projects/${projectId}/modules/order`, { module_ids: moduleIds })
}

export function removeProjectModule(
  projectId: number,
  moduleId: number,
): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/projects/${projectId}/modules/${moduleId}`)
}

/* -------------------------------------------------------------------------- */
/* §7.5 项目附件                                                                */
/* -------------------------------------------------------------------------- */

export function fetchProjectFiles(projectId: number, fileKind?: string): Promise<ProjectFile[]> {
  return get<ProjectFile[]>(`/projects/${projectId}/files`, fileKind ? { file_kind: fileKind } : {})
}

/** 上传 + 挂载一步到位（评分标准上传即入库，供 AI 评审召回） */
export function uploadProjectFile(
  projectId: number,
  file: File,
  fileKind: string,
  title?: string,
): Promise<ProjectFile> {
  return upload<ProjectFile>(`/projects/${projectId}/files/upload`, file, {
    file_kind: fileKind,
    ...(title ? { title } : {}),
  })
}

/** 解除关联（文件台账与磁盘文件都保留） */
export function removeProjectFile(
  projectId: number,
  projectFileId: number,
): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(
    `/projects/${projectId}/files/${projectFileId}`,
  )
}

/* -------------------------------------------------------------------------- */
/* §7.6 项目所需技能                                                            */
/* -------------------------------------------------------------------------- */

export function fetchProjectSkills(projectId: number): Promise<SkillTreeNode[]> {
  return get<SkillTreeNode[]>(`/projects/${projectId}/skills`)
}

/** 覆盖式设置 */
export function setProjectSkills(
  projectId: number,
  skillNodeIds: number[],
): Promise<SkillTreeNode[]> {
  return put<SkillTreeNode[]>(`/projects/${projectId}/skills`, { skill_node_ids: skillNodeIds })
}

/* -------------------------------------------------------------------------- */
/* §7.6.1 关卡所需技能（技能点亮的权威绑定）                                     */
/* -------------------------------------------------------------------------- */

export function fetchModuleSkills(projectId: number, moduleId: number): Promise<SkillTreeNode[]> {
  return get<SkillTreeNode[]>(`/projects/${projectId}/modules/${moduleId}/skills`)
}

/** 覆盖式设置某个关卡的技能点 */
export function setModuleSkills(
  projectId: number,
  moduleId: number,
  skillNodeIds: number[],
): Promise<SkillTreeNode[]> {
  return put<SkillTreeNode[]>(`/projects/${projectId}/modules/${moduleId}/skills`, {
    skill_node_ids: skillNodeIds,
  })
}
