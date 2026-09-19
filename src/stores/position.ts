import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createPosition,
  deletePosition,
  fetchPositions,
  updatePosition,
} from '@/api/positions'
import type { PositionPayload } from '@/api/positions'
import type { Position, ProjectTier } from '@/types'

export const usePositionStore = defineStore('position', () => {
  const list = ref<Position[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const levelFilter = ref<ProjectTier | 'all'>('all')
  const keyword = ref('')

  const byId = computed(() => new Map(list.value.map((item) => [item.id, item])))
  const options = computed(() => list.value.map((item) => ({ id: item.id, name: item.name })))

  function get(id: string): Position | undefined {
    return byId.value.get(id)
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const result = await fetchPositions({
        level: levelFilter.value,
        keyword: keyword.value,
        pageSize: 100,
      })
      list.value = result.list
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function applyFilter(level: ProjectTier | 'all', value = keyword.value): Promise<void> {
    levelFilter.value = level
    keyword.value = value
    await load(true)
  }

  async function create(payload: PositionPayload): Promise<void> {
    await createPosition(payload)
    await load(true)
  }

  async function update(id: string, payload: PositionPayload): Promise<void> {
    await updatePosition(id, payload)
    await load(true)
  }

  async function remove(id: string): Promise<void> {
    await deletePosition(id)
    await load(true)
  }

  return {
    list,
    loading,
    options,
    levelFilter,
    keyword,
    get,
    load,
    applyFilter,
    create,
    update,
    remove,
  }
})
