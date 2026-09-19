import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createSkillTag,
  deleteSkillTag,
  fetchSkillSystems,
  fetchSkillTags,
  updateSkillTag,
} from '@/api/skill'
import type { SkillTagPayload } from '@/api/skill'
import type { SkillSystem, SkillTag, SkillSystemId } from '@/types'

export const useSkillStore = defineStore('skill', () => {
  const systems = ref<SkillSystem[]>([])
  const tags = ref<SkillTag[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const tagMap = computed(() => new Map(tags.value.map((item) => [item.id, item])))
  const systemMap = computed(() => new Map(systems.value.map((item) => [item.id, item])))

  function nameOf(id: string): string {
    return tagMap.value.get(id)?.name ?? id
  }

  function systemNameOf(id: string): string {
    const tag = tagMap.value.get(id)
    return tag ? (systemMap.value.get(tag.systemId)?.name ?? '') : ''
  }

  function colorOf(id: string): string {
    const tag = tagMap.value.get(id)
    return tag ? (systemMap.value.get(tag.systemId)?.color ?? '#1677FF') : '#1677FF'
  }

  function groupedTags(): { system: SkillSystem; tags: SkillTag[] }[] {
    return systems.value.map((system) => ({
      system,
      tags: tags.value.filter((tag) => tag.systemId === system.id),
    }))
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const [systemList, tagList] = await Promise.all([fetchSkillSystems(), fetchSkillTags()])
      systems.value = systemList
      tags.value = tagList
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function bySystem(systemId: SkillSystemId): SkillTag[] {
    return tags.value.filter((tag) => tag.systemId === systemId)
  }

  /** 按名称精确匹配（新建岗位时把文本标签关联到技能库） */
  function findByName(name: string): SkillTag | undefined {
    const target = name.trim()
    return tags.value.find((tag) => tag.name === target)
  }

  function get(id: string): SkillTag | undefined {
    return tagMap.value.get(id)
  }

  /** 技能管理：新增 / 编辑 / 删除技能点（判定口径一并落库） */
  async function create(payload: SkillTagPayload): Promise<SkillTag> {
    const created = await createSkillTag(payload)
    await load(true)
    return created
  }

  async function update(id: string, payload: SkillTagPayload): Promise<SkillTag> {
    const updated = await updateSkillTag(id, payload)
    await load(true)
    return updated
  }

  async function remove(id: string): Promise<void> {
    await deleteSkillTag(id)
    await load(true)
  }

  /** 把技能库里没有的标签批量加入技能库（同名标签由接口侧复用） */
  async function createTags(
    items: { name: string; systemId: SkillSystemId }[],
  ): Promise<SkillTag[]> {
    const created: SkillTag[] = []
    for (const item of items) {
      created.push(await createSkillTag({ name: item.name.trim(), systemId: item.systemId }))
    }
    await load(true)
    return created
  }

  return {
    systems,
    tags,
    loading,
    nameOf,
    systemNameOf,
    colorOf,
    groupedTags,
    load,
    bySystem,
    findByName,
    get,
    create,
    update,
    remove,
    createTags,
  }
})
