import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ssoCallback } from '@/api/auth'
import { clearAuth, getProfile, getRole, getToken, setProfile, setRole, setToken } from '@/utils/storage'
import type { LoginResult, TeacherProfile, UserRole } from '@/types'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken() ?? '')
  const role = ref<UserRole>((getRole() as UserRole | null) ?? 'teacher')
  const profile = ref<TeacherProfile | null>(getProfile<TeacherProfile>())
  const loading = ref(false)

  const isLoggedIn = computed(() => token.value.length > 0)
  /** 角色分流：只有教师能进入 /teacher 前缀路由 */
  const isTeacher = computed(() => role.value === 'teacher')

  function apply(result: LoginResult): LoginResult {
    token.value = result.token
    role.value = result.role
    profile.value = result.profile
    setToken(result.token)
    setRole(result.role)
    if (result.profile) setProfile(result.profile)
    return result
  }

  /** SSO 回调：?key=xxx → 身份查询 → 签发 JWT */
  async function loginByKey(key: string): Promise<LoginResult> {
    loading.value = true
    try {
      return apply(await ssoCallback(key))
    } finally {
      loading.value = false
    }
  }

  /** 演示入口：直接以教师身份登录（对应原型截图「当前身份：教师」） */
  async function loginAsTeacher(): Promise<LoginResult> {
    return loginByKey('teacher-demo-key')
  }

  /** 演示入口：学生身份（用于演示角色分流拦截） */
  async function loginAsStudent(): Promise<LoginResult> {
    return loginByKey('student-demo-key')
  }

  function logout(): void {
    token.value = ''
    profile.value = null
    clearAuth()
  }

  return {
    token,
    role,
    profile,
    loading,
    isLoggedIn,
    isTeacher,
    loginByKey,
    loginAsTeacher,
    loginAsStudent,
    logout,
  }
})
