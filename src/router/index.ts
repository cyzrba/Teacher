import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useUserStore } from '@/stores/user'

declare module 'vue-router' {
  interface RouteMeta {
    /** 左侧导航高亮项，对应 src/config/nav.ts 的 key */
    nav?: string
    /** 免登录页面 */
    public?: boolean
    title?: string
  }
}

/**
 * 路由表。
 *
 * 说明：原型截图中「班级与任务管理」「实训项目管理」「岗位与技能体系」「实训结果审核」
 * 「企业认证证书」都是以页内 Tab 组织，因此这里只建一级页面路由，
 * Tab 用 ?tab=xxx 承载，便于分享与回退。
 * 参考文档第 9.2 节的子路由建议（/classes/tasks、/projects/create 等）在 README
 * 「路由对照」中给出了映射关系。
 */
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/teacher/dashboard' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '统一身份认证' },
  },
  {
    path: '/teacher',
    component: DefaultLayout,
    children: [
      { path: '', redirect: '/teacher/dashboard' },
      {
        path: 'dashboard',
        name: 'teacher-dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { nav: 'dashboard', title: '数据总览' },
      },
      {
        path: 'projects',
        name: 'teacher-projects',
        component: () => import('@/views/ProjectManageView.vue'),
        meta: { nav: 'projects', title: '实训项目管理' },
      },
      {
        path: 'positions',
        name: 'teacher-positions',
        component: () => import('@/views/PositionSkillView.vue'),
        meta: { nav: 'positions', title: '岗位与技能体系' },
      },
      {
        path: 'reviews',
        name: 'teacher-reviews',
        component: () => import('@/views/ReviewView.vue'),
        meta: { nav: 'reviews', title: '实训结果审核' },
      },
      {
        path: 'reviews/:submissionId',
        name: 'teacher-review-detail',
        component: () => import('@/views/ReviewDetailView.vue'),
        meta: { nav: 'reviews', title: '实训报告详情' },
      },
      {
        path: 'stats',
        name: 'teacher-stats',
        component: () => import('@/views/StatsView.vue'),
        meta: { nav: 'stats', title: '学习过程统计' },
      },
      {
        path: 'classes',
        name: 'teacher-classes',
        component: () => import('@/views/ClassTaskView.vue'),
        meta: { nav: 'classes', title: '班级与任务管理' },
      },
      {
        path: 'certs',
        name: 'teacher-certs',
        component: () => import('@/views/CertificateView.vue'),
        meta: { nav: 'certs', title: '企业认证证书' },
      },
      {
        path: 'settings',
        name: 'teacher-settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { nav: 'settings', title: '系统配置' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true, title: '页面不存在' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * 登录守卫 + 角色分流。
 * 教师角色进入 /teacher 前缀路由；非教师角色访问教师端时退回入口页并带上原因。
 */
router.beforeEach((to) => {
  const user = useUserStore()

  if (!to.meta.public && !user.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!to.meta.public && user.isLoggedIn && !user.isTeacher) {
    return { path: '/login', query: { denied: '1' } }
  }

  if (to.path === '/login' && user.isLoggedIn && user.isTeacher) {
    return { path: '/teacher/dashboard' }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} · 教师端 · 岗位闯关式实训平台`
    : '教师端 · 岗位闯关式实训平台'
})

export default router
