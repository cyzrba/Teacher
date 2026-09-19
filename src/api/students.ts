import { http, unwrap } from './http'
import type { ClassStudent } from '@/types'

/** 学生名册条目（不含任务完成明细与在线时长） */
export type RosterStudent = Omit<ClassStudent, 'doneProjectIds' | 'onlineHours'>

/** GET /api/v1/students —— 学生名册（证书发放、达标校验都用它） */
export function fetchStudents(): Promise<RosterStudent[]> {
  return unwrap<RosterStudent[]>(http.get('/students'))
}

export interface ClassStudentRow {
  id: string
  studentNo: string
  name: string
  group: string
}

/** GET /api/v1/classes/{id}/students —— 某班级学生名单（分组管理用，修复#14） */
export function fetchClassStudents(classId: string): Promise<ClassStudentRow[]> {
  return unwrap<ClassStudentRow[]>(http.get(`/classes/${classId}/students`))
}

/**
 * PUT /api/v1/classes/{id}/students —— 提交分组调整（修复#14）
 * 只传「学生 → 目标分组」的映射，人数由服务端按实际成员数重算。
 */
export function assignClassGroups(
  classId: string,
  assignments: { studentId: string; group: string }[],
  /** 完整的分组名称列表（含弹窗内新增的分组） */
  groupNames?: string[],
): Promise<unknown> {
  return unwrap<unknown>(http.put(`/classes/${classId}/students`, { assignments, groupNames }))
}

export interface ImportStudentRow {
  name: string
  studentNo: string
  group?: string
}

/** POST /api/v1/classes/{id}/import —— 批量导入学生（修复#13） */
export function importClassStudents(
  classId: string,
  students: ImportStudentRow[],
  defaultGroup: string,
): Promise<{ imported: number; skipped: number }> {
  return unwrap<{ imported: number; skipped: number }>(
    http.post(`/classes/${classId}/import`, { students, defaultGroup }),
  )
}
