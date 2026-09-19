/**
 * axios 实例与全局拦截器。
 *
 * 与《需求确认书0706》第 8.3 节接口清单一一对应：
 * 接口层全部走 `http`（baseURL 默认 /api/v1），
 * 后端（FastAPI）就绪后只需把 `.env` 里的 VITE_USE_MOCK 置为 false，
 * 并把 VITE_API_BASE 指向真实网关即可，页面与 store 不用改。
 */

import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'
import { clearAuth, getToken } from '@/utils/storage'
import { mockAdapter } from '@/mock/server'

/** Mock 开关：默认开启；接入真实后端时设为 false */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  // 本地 Mock 阶段用自定义适配器拦截请求；接后端时这个字段自动失效
  adapter: USE_MOCK ? mockAdapter : undefined,
})

/** 请求拦截：注入 JWT */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token) {
    const headers = config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers)
    headers.set('Authorization', `Bearer ${token}`)
    config.headers = headers
  }
  return config
})

/** 响应拦截：401 兜底回登录页；其余错误统一给出可见提示，避免"沉默的空表格" */
http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    const err = error as {
      response?: { status?: number; data?: { detail?: string; message?: string } }
      message?: string
    }
    const status = err.response?.status

    if (status === 401) {
      clearAuth()
      ElMessage.error('登录状态已失效，正在返回统一身份认证入口')
      if (window.location.pathname !== '/login') {
        const target = `${window.location.pathname}${window.location.search}`
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`)
      }
      return Promise.reject(error)
    }

    // 优先使用后端返回的错误描述（FastAPI 默认是 detail）
    const detail = err.response?.data?.detail ?? err.response?.data?.message ?? err.message
    ElMessage.error(
      typeof detail === 'string' && detail.length > 0 && detail.length < 80
        ? detail
        : '请求失败，请稍后重试',
    )
    return Promise.reject(error)
  },
)

/** 统一取出业务数据 */
export async function unwrap<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
  const response = await promise
  return response.data
}
