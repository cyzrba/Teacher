/**
 * 岗位与技能字典（接口文档 §6.1 / §6.2）：
 * 建项目时要选「绑定岗位」与「关联技能点」，这里提供两者的可选项。
 */

import { del, get, patch, post, put } from './client'
import type { ApiPage } from './client'
import type { JobRead, SkillBindingStatus, SkillTreeNode, SkillTreeRead } from './types'

export interface JobPayload {
  job_name: string
  direction_tag?: string | null
  recommended_level?: 'BASIC' | 'ADVANCED' | 'EXPANDED' | null
  scene?: string | null
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
  created_by?: number | null
}

export interface SkillTreePayload {
  tree_name: string
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
}

export interface SkillNodePayload {
  node_name?: string
  description?: string | null
  unlock_note?: string | null
  unlock_rule_json?: Record<string, unknown> | null
  status?: 'ENABLED' | 'DISABLED'
}

/** 岗位列表（状态、推荐层级、方向标签都可筛） */
export function fetchJobs(params: {
  keyword?: string
  status?: string
  recommended_level?: string
  direction_tag?: string
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<JobRead>> {
  return get<ApiPage<JobRead>>('/jobs', { page_size: 200, ...params })
}

/** 技能树（四大体系） */
export function fetchSkillTrees(params: { page?: number; page_size?: number } = {}): Promise<
  ApiPage<SkillTreeRead>
> {
  return get<ApiPage<SkillTreeRead>>('/skill-trees', { page_size: 200, ...params })
}

/* -------------------------------------------------------------------------- */
/* §6.1 岗位：增删改查 + 岗位技能关联                                            */
/* -------------------------------------------------------------------------- */

export function fetchJob(jobId: number): Promise<JobRead> {
  return get<JobRead>(`/jobs/${jobId}`)
}

export function createJob(payload: JobPayload): Promise<JobRead> {
  return post<JobRead>('/jobs', payload)
}

export function updateJob(jobId: number, payload: Partial<JobPayload>): Promise<JobRead> {
  return patch<JobRead>(`/jobs/${jobId}`, payload)
}

/** 软删岗位；重名 / 被引用时的失败原因由后端给出 */
export function deleteJob(jobId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/jobs/${jobId}`)
}

export function fetchJobSkills(jobId: number): Promise<SkillTreeNode[]> {
  return get<SkillTreeNode[]>(`/jobs/${jobId}/skills`)
}

/** 覆盖式设置岗位技能（传空数组即清空） */
export function setJobSkills(jobId: number, skillNodeIds: number[]): Promise<SkillTreeNode[]> {
  return put<SkillTreeNode[]>(`/jobs/${jobId}/skills`, { skill_node_ids: skillNodeIds })
}

/* -------------------------------------------------------------------------- */
/* §6.2 技能树：增删改查                                                        */
/* -------------------------------------------------------------------------- */

export function createSkillTree(payload: SkillTreePayload): Promise<SkillTreeRead> {
  return post<SkillTreeRead>('/skill-trees', payload)
}

export function updateSkillTree(
  treeId: number,
  payload: Partial<SkillTreePayload>,
): Promise<SkillTreeRead> {
  return patch<SkillTreeRead>(`/skill-trees/${treeId}`, payload)
}

export function deleteSkillTree(treeId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/skill-trees/${treeId}`)
}

/* -------------------------------------------------------------------------- */
/* §6.2 技能点（节点）：增删改查 + 前置技能                                      */
/* -------------------------------------------------------------------------- */

export function createSkillNode(treeId: number, payload: SkillNodePayload): Promise<SkillTreeNode> {
  return post<SkillTreeNode>(`/skill-trees/${treeId}/nodes`, payload)
}

export function updateSkillNode(
  nodeId: number,
  payload: SkillNodePayload,
): Promise<SkillTreeNode> {
  return patch<SkillTreeNode>(`/skill-nodes/${nodeId}`, payload)
}

export function deleteSkillNode(nodeId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/skill-nodes/${nodeId}`)
}

export function fetchNodeDependencies(nodeId: number): Promise<SkillTreeNode[]> {
  return get<SkillTreeNode[]>(`/skill-nodes/${nodeId}/dependencies`)
}

/** 覆盖式设置前置技能（禁止自环与环路，由后端校验） */
export function setNodeDependencies(
  nodeId: number,
  prerequisiteNodeIds: number[],
): Promise<SkillTreeNode[]> {
  return put<SkillTreeNode[]>(`/skill-nodes/${nodeId}/dependencies`, {
    prerequisite_node_ids: prerequisiteNodeIds,
  })
}

/** 某棵技能树下的节点 */
export function fetchSkillNodes(treeId: number): Promise<SkillTreeNode[]> {
  return get<SkillTreeNode[]>(`/skill-trees/${treeId}/nodes`)
}

/**
 * 一次取回「技能树 + 节点」的分组结构，供技能点选择器直接渲染。
 * 技能树只有四棵、节点总共二十来个，直接并发拉全量更省事。
 */
export async function fetchSkillCatalog(): Promise<
  { tree: SkillTreeRead; nodes: SkillTreeNode[] }[]
> {
  const trees = await fetchSkillTrees()
  const groups = await Promise.all(
    trees.items.map(async (tree) => {
      const nodes = await fetchSkillNodes(tree.id)
      return { tree, nodes }
    }),
  )
  return groups.filter((group) => group.nodes.length > 0)
}

/** 技能点绑定情况：缺岗位 / 缺项目 / 两端都缺（不传 missing = 缺任意一端） */
export function fetchSkillBindings(
  missing?: 'job' | 'project' | 'both',
): Promise<SkillBindingStatus[]> {
  return get<SkillBindingStatus[]>('/skill-node-bindings', missing ? { missing } : undefined)
}
