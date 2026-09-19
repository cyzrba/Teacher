/**
 * 教学组织：班级 / 花名册 / 分组（接口文档 §4、§5）
 */

import { del, get, patch, post, put, upload } from './client'
import type { ApiPage } from './client'
import type {
  ClassGroup,
  ClassInfo,
  ClassStudent,
  StudentImportResult,
  TeacherClassOverview,
} from './types'

export interface ClassPayload {
  class_name: string
  grade_year?: number | null
  head_teacher_id?: number | null
  group_count?: number
  remark?: string | null
  status?: 'ACTIVE' | 'ARCHIVED'
}

/** §5 教师工作台：一次拿到我任教的班级 + 分组明细 + 任务进度 */
export function fetchTeacherClasses(
  teacherId: number,
  withTaskStudents = false,
): Promise<TeacherClassOverview> {
  return get<TeacherClassOverview>(`/teachers/${teacherId}/classes`, {
    with_task_students: withTaskStudents,
  })
}

/** §4.1 班级分页列表 */
export function fetchClasses(params: {
  keyword?: string
  status?: string
  head_teacher_id?: number
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<ClassInfo>> {
  return get<ApiPage<ClassInfo>>('/classes', params)
}

/** §4.2 / §4.4 新建与编辑班级 */
export function createClass(payload: ClassPayload): Promise<ClassInfo> {
  return post<ClassInfo>('/classes', payload)
}

export function updateClass(classId: number, payload: Partial<ClassPayload>): Promise<ClassInfo> {
  return patch<ClassInfo>(`/classes/${classId}`, payload)
}

/** §4.5 删除班级（软删） */
export function deleteClass(classId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/classes/${classId}`)
}

/** §4.1 花名册（`ungrouped=true` 只看未分组） */
export function fetchClassStudents(
  classId: number,
  params: { page?: number; page_size?: number; keyword?: string; ungrouped?: boolean } = {},
): Promise<ApiPage<ClassStudent>> {
  return get<ApiPage<ClassStudent>>(`/classes/${classId}/students`, params)
}

/** §4.3 批量导入学生名单（xlsx）；先 dry_run 预校验，再正式导入 */
export function importClassStudents(
  classId: number,
  file: File,
  options: { dryRun?: boolean; reuseExisting?: boolean } = {},
): Promise<StudentImportResult> {
  return upload<StudentImportResult>(`/classes/${classId}/students/import`, file, {
    dry_run: options.dryRun ?? false,
    reuse_existing: options.reuseExisting ?? false,
  })
}

/** §4.3.1 单个加人（学号已存在时复用账号） */
export function addClassStudent(
  classId: number,
  payload: { user_no: string; real_name?: string; group_no?: number },
): Promise<ClassStudent> {
  return post<ClassStudent>(`/classes/${classId}/students`, payload)
}

/** §4.6.2 分组列表（带组内学生） */
export function fetchGroups(classId: number, withStudents = true): Promise<ClassGroup[]> {
  return get<ClassGroup[]>(`/classes/${classId}/groups`, { with_students: withStudents })
}

/** §4.6.1 新建分组 */
export function createGroup(
  classId: number,
  payload: { group_name: string; group_no?: number },
): Promise<ClassGroup> {
  return post<ClassGroup>(`/classes/${classId}/groups`, payload)
}

export function updateGroup(
  groupId: number,
  payload: { group_name?: string; group_no?: number },
): Promise<ClassGroup> {
  return patch<ClassGroup>(`/groups/${groupId}`, payload)
}

export function deleteGroup(groupId: number): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/groups/${groupId}`)
}

/** §4.6.3 批量把学生塞进某个分组（已在别组会自动调整过来） */
export function assignStudentsToGroup(
  groupId: number,
  classStudentIds: number[],
): Promise<{ group_id: number; added: number; member_total: number }> {
  return post<{ group_id: number; added: number; member_total: number }>(
    `/groups/${groupId}/students`,
    { class_student_ids: classStudentIds },
  )
}

/** §4.6.4 单个学生调整分组 */
export function setStudentGroup(
  classStudentId: number,
  groupId: number | null,
): Promise<unknown> {
  return put(`/class-students/${classStudentId}/group`, { group_id: groupId })
}

/** §4.6.5 移出分组 */
export function removeStudentFromGroup(
  groupId: number,
  classStudentId: number,
): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(
    `/groups/${groupId}/students/${classStudentId}`,
  )
}

/** §4.7 学生离班 */
export function removeClassStudent(
  classStudentId: number,
): Promise<{ success: boolean; message: string }> {
  return del<{ success: boolean; message: string }>(`/class-students/${classStudentId}`)
}

/** §4.8 批量重置本班学生密码 */
export function resetClassStudentPassword(
  classId: number,
  newPassword?: string,
): Promise<{ updated: number; user_ids: number[] }> {
  return post<{ updated: number; user_ids: number[] }>(
    `/classes/${classId}/students/password/reset`,
    newPassword ? { new_password: newPassword } : {},
  )
}

/** 名单导入模板下载地址（xlsx 文件流，交给浏览器直接打开） */
export function importTemplateUrl(): string {
  return '/api/classes/students/import-template'
}
