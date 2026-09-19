import type {
  CertificateApplyStatus,
  ProjectStatus,
  ProjectTier,
  ReviewStatus,
  TaskStatus,
} from '@/types'

/** 生成一个足够唯一的本地 id（Mock 环境） */
export function localId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`
}

/** 解析 'YYYY-MM-DD HH:mm'（替换连字符，兼容弱解析的浏览器） */
export function parseDateTime(value: string): number {
  if (!value) return 0
  return new Date(value.replace(/-/g, '/')).getTime()
}

/** 定时发布时间必须晚于当前时间（修复#19） */
export function isFutureDateTime(value: string): boolean {
  const time = parseDateTime(value)
  return time > Date.now()
}

/** 日期选择器：禁用今天之前的日期（修复#19） */
export function disablePastDate(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* -------------------------------------------------------------------------- */
/* 枚举 → 文案 / 配色                                                          */
/* -------------------------------------------------------------------------- */

export const projectStatusLabel: Record<ProjectStatus, string> = {
  published: '已发布',
  pending: '待发布',
  offline: '未发布',
}

export const projectStatusTone: Record<ProjectStatus, 'done' | 'wip' | 'lock'> = {
  published: 'done',
  pending: 'wip',
  offline: 'lock',
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  published: '已发布',
  pending: '待发布',
  revoked: '已撤回',
}

export const taskStatusTone: Record<TaskStatus, 'done' | 'wip' | 'lock'> = {
  published: 'done',
  pending: 'wip',
  revoked: 'lock',
}

export const tierTone: Record<ProjectTier, 'todo' | 'orange' | 'violet'> = {
  basic: 'todo',
  advanced: 'orange',
  extended: 'violet',
}

/** 层级先后顺序：基础 → 进阶 → 拓展 */
export const tierOrder: ProjectTier[] = ['basic', 'advanced', 'extended']

/** 中文按拼音排序（zh-Hans-CN 排序规则，数字按数值比较） */
const zhCollator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })

/**
 * 实训项目排序规则：
 * 1) 层级 基础 → 进阶 → 拓展；
 * 2) 同层级按难度星数升序；
 * 3) 同星数按项目名称拼音排序。
 */
export function compareByTierAndDifficulty(
  a: { tier?: ProjectTier; difficulty?: number; name: string },
  b: { tier?: ProjectTier; difficulty?: number; name: string },
): number {
  const ta = a.tier ? tierOrder.indexOf(a.tier) : 99
  const tb = b.tier ? tierOrder.indexOf(b.tier) : 99
  if (ta !== tb) return ta - tb

  const da = a.difficulty ?? 0
  const db = b.difficulty ?? 0
  if (da !== db) return da - db

  return zhCollator.compare(a.name, b.name)
}

export const reviewStatusTone: Record<ReviewStatus, 'done' | 'danger' | 'wip' | 'todo'> = {
  approved: 'done',
  rejected: 'danger',
  pending: 'wip',
  // 「已复核」用蓝色，与「已通过」的绿色区分开（修复#4）
  rechecked: 'todo',
}

export const certApplyStatusLabel: Record<CertificateApplyStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

export const certApplyStatusTone: Record<CertificateApplyStatus, 'wip' | 'done' | 'danger'> = {
  pending: 'wip',
  approved: 'done',
  rejected: 'danger',
}

/** 分数配色：≥80 绿 / 60-79 橙 / <60 红（原型截图 image18） */
export function scoreClass(score: number): string {
  if (score >= 80) return 'score--good'
  if (score >= 60) return 'score--mid'
  return 'score--bad'
}

/** 技能进度配色：≥60% 绿，否则橙（原型截图 image21） */
export function progressTone(value: number): 'done' | 'wip' {
  return value >= 60 ? 'done' : 'wip'
}

/** 难度星级：1-5 → ★ 串 */
export function difficultyStars(level: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(level)))
  return '★'.repeat(filled)
}

/**
 * 总分计算：各模块按「得分 / 上限 × 分值占比」加权后求和。
 * 与原型截图 image18（总分 92）与 image19（模块分 18/20、16/20…）口径一致。
 */
export function computeTotalScore(
  modules: { score: number; maxScore: number; weight: number }[],
): number {
  let total = 0
  for (const item of modules) {
    if (item.maxScore <= 0) continue
    total += (item.score / item.maxScore) * item.weight
  }
  return Math.round(total)
}

/** 证书编号递增：SM-2024-VI-00018 → SM-2024-VI-00019 */
export function nextCertNo(prefix: string, existing: string[]): string {
  let max = 0
  for (const no of existing) {
    const tail = no.slice(prefix.length)
    const value = Number.parseInt(tail, 10)
    if (!Number.isNaN(value) && value > max) max = value
  }
  return `${prefix}${String(max + 1).padStart(5, '0')}`
}
