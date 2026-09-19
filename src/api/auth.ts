import { http, unwrap } from './http'
import type { LoginResult } from '@/types'

/** POST /api/v1/auth/sso/callback —— Key 换 JWT */
export function ssoCallback(key: string): Promise<LoginResult> {
  return unwrap<LoginResult>(http.post('/auth/sso/callback', { key }))
}

/** POST /api/v1/auth/refresh —— Token 刷新（P1，占位实现） */
export function refreshToken(): Promise<{ token: string }> {
  return unwrap<{ token: string }>(http.post('/auth/refresh'))
}
