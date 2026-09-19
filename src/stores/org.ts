/**
 * 教学组织 store（真实后端）：班级 / 花名册 / 分组。
 *
 * 班级列表主体来自教师工作台总览接口 `GET /teachers/{id}/classes`
 * —— 一次拿到「我任教的班级 + 学生数 + 分组明细 + 任务进度 + 平均完成率」。
 * 旧的 `stores/classroom.ts`（Mock）仍服务于尚未迁移的页面（如学习过程统计）。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  assignStudentsToGroup,
  createClass,
  createGroup,
  deleteClass,
  deleteGroup,
  fetchClassStudents,
  fetchGroups,
  fetchTeacherClasses,
  removeClassStudent,
  removeStudentFromGroup,
  setStudentGroup,
  updateClass,
  updateGroup,
} from '@/api/backend/organization'
import type { ClassPayload } from '@/api/backend/organization'
import type {
  ClassGroup,
  ClassStudent,
  GroupMember,
  TeacherClassOverview,
  TeacherClassSummary,
} from '@/api/backend/types'
import { CURRENT_TEACHER_ID } from '@/config/backend'

export const useOrgStore = defineStore('org', () => {
  const overview = ref<TeacherClassOverview | null>(null)
  const groups = ref<ClassGroup[]>([])
  const roster = ref<ClassStudent[]>([])
  const rosterTotal = ref(0)
  const loading = ref(false)
  const groupsLoading = ref(false)
  const rosterLoading = ref(false)

  const classes = computed<TeacherClassSummary[]>(() => overview.value?.classes ?? [])
  const totalStudents = computed(() => overview.value?.student_count ?? 0)
  const averageRate = computed(() => overview.value?.average_completion_rate ?? 0)

  /** 任教班级总览（班级管理 tab 的数据源） */
  async function loadOverview(withTaskStudents = false): Promise<void> {
    loading.value = true
    try {
      overview.value = await fetchTeacherClasses(CURRENT_TEACHER_ID, withTaskStudents)
    } finally {
      loading.value = false
    }
  }

  async function loadGroups(classId: number): Promise<void> {
    groupsLoading.value = true
    try {
      groups.value = await fetchGroups(classId, true)
    } finally {
      groupsLoading.value = false
    }
  }

  async function loadRoster(
    classId: number,
    params: { page?: number; page_size?: number; keyword?: string; ungrouped?: boolean } = {},
  ): Promise<void> {
    rosterLoading.value = true
    try {
      const result = await fetchClassStudents(classId, params)
      roster.value = result.items
      rosterTotal.value = result.total
    } finally {
      rosterLoading.value = false
    }
  }

  async function create(payload: ClassPayload): Promise<void> {
    await createClass({ ...payload, head_teacher_id: payload.head_teacher_id ?? CURRENT_TEACHER_ID })
    await loadOverview()
  }

  async function update(classId: number, payload: Partial<ClassPayload>): Promise<void> {
    await updateClass(classId, payload)
    await loadOverview()
  }

  async function remove(classId: number): Promise<void> {
    await deleteClass(classId)
    await loadOverview()
  }

  async function addGroup(classId: number, groupName: string): Promise<void> {
    await createGroup(classId, { group_name: groupName })
    await loadGroups(classId)
    await loadOverview()
  }

  async function renameGroup(groupId: number, groupName: string): Promise<void> {
    await updateGroup(groupId, { group_name: groupName })
  }

  async function removeGroup(groupId: number, classId: number): Promise<void> {
    await deleteGroup(groupId)
    await loadGroups(classId)
    await loadOverview()
  }

  /** 批量把学生放进同一组（随机分组就是分批调用它） */
  async function assignToGroup(
    classId: number,
    groupId: number,
    classStudentIds: number[],
  ): Promise<void> {
    if (classStudentIds.length === 0) return
    await assignStudentsToGroup(groupId, classStudentIds)
    await loadGroups(classId)
    await loadOverview()
  }

  async function moveStudent(
    classId: number,
    classStudentId: number,
    groupId: number | null,
    currentGroupId?: number | null,
  ): Promise<void> {
    if (groupId === null && currentGroupId) {
      await removeStudentFromGroup(currentGroupId, classStudentId)
    } else {
      await setStudentGroup(classStudentId, groupId)
    }
    await loadGroups(classId)
    await loadOverview()
  }

  /** 未分组学生（分组面板里直接展示） */
  function ungroupedOf(classId: number): GroupMember[] {
    return classes.value.find((item) => item.class_id === classId)?.ungrouped_students ?? []
  }

  async function removeStudent(classStudentId: number, classId: number): Promise<void> {
    await removeClassStudent(classStudentId)
    await loadRoster(classId)
    await loadOverview()
  }

  return {
    overview,
    classes,
    groups,
    roster,
    rosterTotal,
    loading,
    groupsLoading,
    rosterLoading,
    totalStudents,
    averageRate,
    loadOverview,
    loadGroups,
    loadRoster,
    create,
    update,
    remove,
    addGroup,
    renameGroup,
    removeGroup,
    assignToGroup,
    moveStudent,
    ungroupedOf,
    removeStudent,
  }
})
