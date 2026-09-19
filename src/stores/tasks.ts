/**
 * 任务下发 store（真实后端，接口文档 §8）。
 *
 * 列表接口不带 targets / jobs / projects，而「按班级 / 分组筛选」要用到 targets，
 * 因此在 load() 里对当前页的每条任务补一次详情（任务量不大，N+1 可接受）。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  cancelTask,
  createTask,
  deleteTask,
  fetchPublishableProjects,
  fetchTask,
  fetchTasks,
  previewStudents,
  publishTask,
  updateTask,
} from '@/api/backend/tasks'
import type { TaskPayload } from '@/api/backend/tasks'
import type {
  PublishableProject,
  PublishTask,
  StudentPreview,
  TaskTarget,
} from '@/api/backend/types'
import { CURRENT_TEACHER_ID } from '@/config/backend'

export const useTasksStore = defineStore('tasksApi', () => {
  const list = ref<PublishTask[]>([])
  const total = ref(0)
  const loading = ref(false)
  const publishable = ref<PublishableProject[]>([])

  /** 任务里的「班级 / 分组」文案，用于列表展示与筛选 */
  function targetText(task: PublishTask): string {
    const targets = task.targets ?? []
    if (targets.length === 0) return '--'
    return targets
      .map((item) =>
        item.target_type === 'GROUP'
          ? `${item.class_name ?? item.class_id} · ${item.group_name ?? '分组'}`
          : `${item.class_name ?? item.class_id} · 全班`,
      )
      .join('，')
  }

  function targetClassIds(task: PublishTask): number[] {
    return [...new Set((task.targets ?? []).map((item) => item.class_id))]
  }

  function targetGroupIds(task: PublishTask): number[] {
    return [
      ...new Set(
        (task.targets ?? [])
          .map((item) => item.group_id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ]
  }

  async function load(params: { keyword?: string; status?: string; page_size?: number } = {}): Promise<void> {
    loading.value = true
    try {
      const result = await fetchTasks({ page_size: 100, ...params })
      // 列表不带目标明细，逐条补详情（含 targets / projects / jobs）
      const details = await Promise.all(
        result.items.map((item) => fetchTask(item.id).catch(() => item)),
      )
      list.value = details
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  async function loadPublishable(params: {
    job_ids?: number[]
    project_level?: string
    keyword?: string
  } = {}): Promise<void> {
    publishable.value = await fetchPublishableProjects(params)
  }

  async function create(payload: TaskPayload): Promise<PublishTask> {
    const created = await createTask({ creator_id: CURRENT_TEACHER_ID, ...payload })
    await load()
    return created
  }

  async function update(taskId: number, payload: Partial<TaskPayload>): Promise<void> {
    await updateTask(taskId, payload)
    await load()
  }

  async function publish(taskId: number): Promise<void> {
    await publishTask(taskId, CURRENT_TEACHER_ID)
    await load()
  }

  async function cancel(taskId: number): Promise<void> {
    await cancelTask(taskId)
    await load()
  }

  async function remove(taskId: number): Promise<void> {
    await deleteTask(taskId)
    await load()
  }

  async function preview(targets: TaskTarget[]): Promise<StudentPreview> {
    return previewStudents(targets)
  }

  const published = computed(() => list.value.filter((item) => item.status === 'PUBLISHED'))

  return {
    list,
    total,
    loading,
    publishable,
    published,
    targetText,
    targetClassIds,
    targetGroupIds,
    load,
    loadPublishable,
    create,
    update,
    publish,
    cancel,
    remove,
    preview,
  }
})
