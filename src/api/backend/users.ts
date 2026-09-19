/**
 * 账户目录（接口文档 §3.1）：这里只用来把 student_id 映射成学生姓名。
 * 提交列表接口只返回 student_id，没有姓名，所以列表页补一次学生名册。
 */

import { get } from './client'
import type { ApiPage } from './client'

export interface SysUser {
  id: number
  user_no: string
  real_name: string
  user_type: 'STUDENT' | 'TEACHER' | 'ADMIN' | string
  major_name: string | null
  status: string
}

export function fetchUsers(params: {
  user_type?: string
  status?: string
  keyword?: string
  page?: number
  page_size?: number
} = {}): Promise<ApiPage<SysUser>> {
  return get<ApiPage<SysUser>>('/users', { page_size: 200, ...params })
}
