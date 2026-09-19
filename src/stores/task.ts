import { ref } from 'vue'
import { defineStore } from 'pinia'
import { createTask, fetchTasks, revokeTask } from '@/api/tasks'
import type { CreateTaskPayload, TrainTask } from '@/types'

export const useTaskStore = defineStore('task', () => {
  const list = ref<TrainTask[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const filterClassId = ref('')
  const filterGroup = ref('')

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const result = await fetchTasks({
        classId: filterClassId.value,
        group: filterGroup.value,
        pageSize: 100,
      })
      list.value = result.list
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function applyFilter(classId: string, group: string): Promise<void> {
    filterClassId.value = classId
    filterGroup.value = group
    await load(true)
  }

  async function create(payload: CreateTaskPayload): Promise<void> {
    await createTask(payload)
    await load(true)
  }

  async function revoke(id: string): Promise<void> {
    await revokeTask(id)
    await load(true)
  }

  return { list, loading, filterClassId, filterGroup, load, applyFilter, create, revoke }
})
