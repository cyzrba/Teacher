/**
 * 真实后端（FastAPI）请求层。
 *
 * 与 `api/http.ts`（Mock 适配器，服务于尚未迁移的页面）并存：
 * 本文件只给已对接真实后端的模块使用 —— 实训项目管理、班级与任务管理。
 *
 * 三条约定（来自接口文档 §0）在这里统一处理：
 * 1. 统一响应体 `{code, data, msg}`，**业务失败时 HTTP 状态码可能仍是 200**，
 *    判定看 body 里的 code，所以成功要解出 data、失败要抛 msg；
 * 2. Decimal 字段（权重 / 分数 / 进度）是字符串，调用方用 `num()` 转；
 * 3. 时间是无时区 ISO，不做时区换算。
 */

import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { BACKEND_BASE } from '@/config/backend'

/** 后端统一响应体 */
export interface ApiEnvelope<T> {
  code: number
  data: T
  msg: string
}

/** 后端分页结构 */
export interface ApiPage<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export const backend: AxiosInstance = axios.create({
  baseURL: BACKEND_BASE,
  // 上传大文件（评分标准 / 数据集）时留足时间
  timeout: 60_000,
})

backend.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    const body = response.data

    // 少数接口返回文件流（下载 / SSE），原样透传
    if (!body || typeof body !== 'object' || !('code' in body)) return response

    if (body.code !== 200) {
      const message = body.msg || '请求失败'
      ElMessage.error(message)
      return Promise.reject(new Error(message))
    }

    // 把 data 直接挂在 response 上，调用方拿到的就是业务数据
    response.data = body.data as never
    return response
  },
  (error: unknown) => {
    const err = error as {
      response?: { status?: number; data?: { msg?: string; detail?: string } | string }
      message?: string
    }
    const payload = err.response?.data
    const detail =
      typeof payload === 'string'
        ? payload
        : (payload?.msg ?? payload?.detail ?? err.message ?? '请求失败')

    ElMessage.error(
      typeof detail === 'string' && detail.length > 0 && detail.length < 120
        ? detail
        : `请求失败（HTTP ${err.response?.status ?? '未知'}）`,
    )
    return Promise.reject(error)
  },
)

/** GET / POST / PATCH / PUT / DELETE 的薄封装：返回已解包的业务数据 */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await backend.get<T>(url, { params })
  return response.data
}

export async function post<T>(
  url: string,
  data?: unknown,
  params?: Record<string, unknown>,
): Promise<T> {
  const response = await backend.post<T>(url, data, { params })
  return response.data
}

export async function patch<T>(url: string, data?: unknown): Promise<T> {
  const response = await backend.patch<T>(url, data)
  return response.data
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  const response = await backend.put<T>(url, data)
  return response.data
}

export async function del<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await backend.delete<T>(url, { params })
  return response.data
}

/** 文件上传（multipart/form-data）：项目附件、学生名单导入都用它 */
export async function upload<T>(
  url: string,
  file: File,
  fields: Record<string, string | number | boolean> = {},
): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, typeof value === 'boolean' ? String(value) : String(value))
  }

  const response = await backend.post<T>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * Decimal 字段（后端以字符串返回）转数字。
 * 例：`num('20.0000000000')` → 20
 */
export function num(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** 后端时间（`2026-09-16T10:00:00`）转展示文案 */
export function formatDateTime(value: string | null | undefined, fallback = '--'): string {
  if (!value) return fallback
  return value.replace('T', ' ').slice(0, 16)
}
