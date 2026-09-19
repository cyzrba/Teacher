/**
 * 岗位与技能体系 store（真实后端，接口文档 §6）
 *
 * - 岗位：`/jobs` 的增删改查 + 岗位技能关联（覆盖式）
 * - 技能树：`/skill-trees` 的增删改查
 * - 技能点：`/skill-trees/{id}/nodes`、`/skill-nodes/{id}` 的增删改查 + 前置技能
 *
 * 旧的 `stores/position.ts` / `stores/skill.ts`（Mock）仍服务于尚未迁移的页面。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createJob,
  createSkillNode,
  createSkillTree,
  deleteJob,
  deleteSkillNode,
  deleteSkillTree,
  fetchJobSkills,
  fetchJobs,
  fetchJob,
  fetchNodeDependencies,
  fetchSkillNodes,
  fetchSkillTrees,
  setJobSkills,
  setNodeDependencies,
  updateJob,
  updateSkillNode,
  updateSkillTree,
} from '@/api/backend/catalog'
import type { JobPayload, SkillNodePayload, SkillTreePayload } from '@/api/backend/catalog'
import type { JobRead, SkillTreeNode, SkillTreeRead } from '@/api/backend/types'
import { CURRENT_TEACHER_ID } from '@/config/backend'

export const useCatalogStore = defineStore('catalog', () => {
  const jobs = ref<JobRead[]>([])
  const jobsTotal = ref(0)
  const jobsLoading = ref(false)

  const trees = ref<SkillTreeRead[]>([])
  const treesLoading = ref(false)

  const nodes = ref<SkillTreeNode[]>([])
  const nodesLoading = ref(false)

  const treeNameMap = computed(() => new Map(trees.value.map((item) => [item.id, item.tree_name])))
  const nodeNameMap = computed(() => new Map(nodes.value.map((item) => [item.id, item.node_name])))

  function nodeNameOf(id: number): string {
    return nodeNameMap.value.get(id) ?? `技能点 #${id}`
  }

  /* —— 岗位 —— */

  const jobSkills = ref<SkillTreeNode[]>([])

  async function loadJobs(params: {
    keyword?: string
    status?: string
    recommended_level?: string
    page?: number
    page_size?: number
  } = {}): Promise<void> {
    jobsLoading.value = true
    try {
      const result = await fetchJobs({ page_size: 200, ...params })
      // 列表接口不带 skill_count（只有岗位详情才有），逐条补一次详情，用于「关联技能」列
      jobs.value = await Promise.all(
        result.items.map((item) => fetchJob(item.id).catch(() => item)),
      )
      jobsTotal.value = result.total
    } finally {
      jobsLoading.value = false
    }
  }

  async function create(payload: JobPayload): Promise<JobRead> {
    const created = await createJob({ created_by: CURRENT_TEACHER_ID, ...payload })
    await loadJobs()
    return created
  }

  async function update(jobId: number, payload: Partial<JobPayload>): Promise<JobRead> {
    const updated = await updateJob(jobId, payload)
    await loadJobs()
    return updated
  }

  async function remove(jobId: number): Promise<void> {
    await deleteJob(jobId)
    await loadJobs()
  }

  async function loadJobSkills(jobId: number): Promise<SkillTreeNode[]> {
    jobSkills.value = await fetchJobSkills(jobId)
    return jobSkills.value
  }

  /** 覆盖式设置岗位技能（新建岗位要先建岗位，再调它） */
  async function saveJobSkills(jobId: number, skillNodeIds: number[]): Promise<void> {
    await setJobSkills(jobId, skillNodeIds)
    await loadJobs()
  }

  /* —— 技能树 —— */

  async function loadTrees(): Promise<void> {
    treesLoading.value = true
    try {
      const result = await fetchSkillTrees()
      trees.value = result.items
    } finally {
      treesLoading.value = false
    }
  }

  async function createTree(payload: SkillTreePayload): Promise<SkillTreeRead> {
    const created = await createSkillTree(payload)
    await loadTrees()
    return created
  }

  async function updateTree(
    treeId: number,
    payload: Partial<SkillTreePayload>,
  ): Promise<SkillTreeRead> {
    const updated = await updateSkillTree(treeId, payload)
    await loadTrees()
    return updated
  }

  async function removeTree(treeId: number): Promise<void> {
    await deleteSkillTree(treeId)
    await loadTrees()
  }

  /* —— 技能点 —— */

  async function loadNodes(treeId: number): Promise<void> {
    nodesLoading.value = true
    try {
      const list = await fetchSkillNodes(treeId)
      /**
       * 后端已知不一致：`GET /skill-trees/{id}/nodes` **没有过滤软删节点**
       * （同级的 jobs / skill-trees / stage-templates 列表都过滤了），
       * 删掉的技能点仍会返回。这里先在前端兜住，后端修好后可去掉这行过滤。
       */
      nodes.value = list.filter((item) => !item.deleted_at)
    } finally {
      nodesLoading.value = false
    }
  }

  async function createNode(treeId: number, payload: SkillNodePayload): Promise<SkillTreeNode> {
    const created = await createSkillNode(treeId, payload)
    await loadNodes(treeId)
    return created
  }

  async function updateNode(
    treeId: number,
    nodeId: number,
    payload: SkillNodePayload,
  ): Promise<void> {
    await updateSkillNode(nodeId, payload)
    await loadNodes(treeId)
  }

  async function removeNode(treeId: number, nodeId: number): Promise<void> {
    await deleteSkillNode(nodeId)
    await loadNodes(treeId)
  }

  async function loadDependencies(nodeId: number): Promise<number[]> {
    const list = await fetchNodeDependencies(nodeId)
    return list.map((item) => item.id)
  }

  async function saveDependencies(nodeId: number, ids: number[]): Promise<void> {
    await setNodeDependencies(nodeId, ids)
  }

  return {
    jobs,
    jobsTotal,
    jobsLoading,
    jobSkills,
    trees,
    treesLoading,
    nodes,
    nodesLoading,
    treeNameMap,
    nodeNameOf,
    loadJobs,
    create,
    update,
    remove,
    loadJobSkills,
    saveJobSkills,
    loadTrees,
    createTree,
    updateTree,
    removeTree,
    loadNodes,
    createNode,
    updateNode,
    removeNode,
    loadDependencies,
    saveDependencies,
  }
})
