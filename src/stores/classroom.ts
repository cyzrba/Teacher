import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createClass,
  deleteClass,
  fetchClasses,
  updateClass,
} from '@/api/classes'
import {
  assignClassGroups,
  fetchClassStudents,
  importClassStudents,
} from '@/api/students'
import type { ClassStudentRow, ImportStudentRow } from '@/api/students'
import type { ClassPayload } from '@/api/classes'
import type { SchoolClass } from '@/types'

export const useClassroomStore = defineStore('classroom', () => {
  const list = ref<SchoolClass[]>([])
  const total = ref(0)
  const loading = ref(false)
  const loaded = ref(false)
  const keyword = ref('')

  /** 顶部过滤用的班级选项 */
  const options = computed(() => list.value.map((item) => ({ id: item.id, name: item.name })))

  async function load(force = false): Promise<void> {
    if (loaded.value && !force && keyword.value === '') return
    loading.value = true
    try {
      const result = await fetchClasses({ keyword: keyword.value, pageSize: 100 })
      list.value = result.list
      total.value = result.total
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function search(value: string): Promise<void> {
    keyword.value = value
    await load(true)
  }

  async function create(payload: ClassPayload): Promise<void> {
    await createClass(payload)
    await load(true)
  }

  async function update(id: string, payload: ClassPayload): Promise<void> {
    await updateClass(id, payload)
    await load(true)
  }

  async function remove(id: string): Promise<void> {
    await deleteClass(id)
    await load(true)
  }

  /** 分组调整：提交「学生 → 目标分组」的映射，人数由服务端重算（修复#14） */
  async function saveGroups(
    id: string,
    assignments: { studentId: string; group: string }[],
    groupNames?: string[],
  ): Promise<void> {
    await assignClassGroups(id, assignments, groupNames)
    await load(true)
  }

  /** 取某班级的学生名单（分组管理弹窗用） */
  async function fetchMembers(id: string): Promise<ClassStudentRow[]> {
    return fetchClassStudents(id)
  }

  /** 批量导入学生（修复#13） */
  async function importStudents(
    id: string,
    rows: ImportStudentRow[],
    defaultGroup: string,
  ): Promise<{ imported: number; skipped: number }> {
    const result = await importClassStudents(id, rows, defaultGroup)
    await load(true)
    return result
  }

  return {
    list,
    total,
    loading,
    keyword,
    options,
    load,
    search,
    create,
    update,
    remove,
    saveGroups,
    fetchMembers,
    importStudents,
  }
})
