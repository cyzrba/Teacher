/**
 * localStorage 封装：登录态、教师信息、演示数据快照。
 * 真实后端接入后 token 仍走这里，其余可逐步下线。
 */

const TOKEN_KEY = 'teacher.token'
const PROFILE_KEY = 'teacher.profile'
const ROLE_KEY = 'teacher.role'
const MODULE_TPL_KEY = 'teacher.moduleTemplate'
const UI_PREFS_KEY = 'teacher.uiPrefs'

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function getRole(): string | null {
  return window.localStorage.getItem(ROLE_KEY)
}

export function setRole(role: string): void {
  window.localStorage.setItem(ROLE_KEY, role)
}

export function getProfile<T>(): T | null {
  const raw = window.localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setProfile(value: unknown): void {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(value))
}

export function clearAuth(): void {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(PROFILE_KEY)
  window.localStorage.removeItem(ROLE_KEY)
}

/**
 * 标准化实训模块的「标准配置」。
 * 教师在「实训项目管理」页保存后落到本地，新建项目默认继承。
 * 接入后端后改由 GET/PUT /projects/modules-template 承载。
 */
export function getModuleTemplate<T>(): T | null {
  const raw = window.localStorage.getItem(MODULE_TPL_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setModuleTemplate(value: unknown): void {
  window.localStorage.setItem(MODULE_TPL_KEY, JSON.stringify(value))
}

/**
 * 界面偏好：左侧导航是否收起。
 * 与学生端同名同结构（`getUiPrefs` / `setUiPrefs`），便于两端统一处理。
 */
export interface UiPrefs {
  navCollapsed: boolean
}

export function getUiPrefs(): UiPrefs | null {
  const raw = window.localStorage.getItem(UI_PREFS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UiPrefs
  } catch {
    return null
  }
}

export function setUiPrefs(value: UiPrefs): void {
  window.localStorage.setItem(UI_PREFS_KEY, JSON.stringify(value))
}
