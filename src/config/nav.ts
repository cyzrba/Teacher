import type { NavItem } from '@/types'

/**
 * 教师端主导航（一个平铺列表，不再分组）。
 *
 * 顺序严格按《需求确认书0706》原型截图（image2 / image4 / image15 / image18 等，
 * 各教师端页面侧边栏一致）：数据总览 → 实训项目管理 → 岗位与技能体系 →
 * 实训结果审核 → 学习过程统计 → 班级与任务管理 → 企业认证证书。
 * 特别注意「班级与任务管理」在原型中位于倒数第二，而非按常规业务习惯放在第二位。
 *
 * AI 答辩 / AI 面试为原型截图之后文字补充的预留能力（不做一级菜单），
 * 入口挂在「企业认证证书」页底部，仅占位不实现。
 */
export const navItems: NavItem[] = [
  { key: 'dashboard', label: '数据总览', path: '/teacher/dashboard' },
  { key: 'projects', label: '实训项目管理', path: '/teacher/projects' },
  { key: 'positions', label: '岗位与技能体系', path: '/teacher/positions' },
  { key: 'reviews', label: '实训结果审核', path: '/teacher/reviews' },
  { key: 'stats', label: '学习过程统计', path: '/teacher/stats' },
  { key: 'classes', label: '班级与任务管理', path: '/teacher/classes' },
  { key: 'certs', label: '企业认证证书', path: '/teacher/certs' },
  { key: 'settings', label: '系统配置', path: '/teacher/settings' },
]

/** 平台信息：登录页、侧栏页脚与电子证书展示 */
export const platformInfo = {
  school: '深圳职业技术大学',
  college: '人工智能本科学院',
  platform: '岗位闯关式实训平台',
  portal: '教学管理后台',
  version: 'v1.0',
  /** 电子证书默认发证机构（原型截图 image26） */
  defaultIssuer: '深圳思谋信息科技有限公司',
  /** 证书编号默认前缀（原型截图 image26） */
  certNoPrefix: 'SM-2024-VI-',
  /** 列表默认分页大小 */
  pageSize: 10,
}
