/**
 * 实训结果审核的展示口径（列表页与详情页共用）。
 *
 * 审核状态只保留「流程里的三步」，不把后端的 7 个内部状态直接摊给老师看：
 * ① AI 已审阅（AI 出结果即进入，AI 评审生成即定稿）
 * ② 学生申请复审（**只有学生提异议时状态才会变**）
 * ③ 教师已复审（教师定稿结算后）
 * 另外两个是流程之外的边角：还没跑 AI、学生撤回了提交。
 */

import type { SubmissionListItem } from '@/api/backend/reviews'

export type ReviewState =
  | 'AI_REVIEWED'
  | 'OBJECTION'
  | 'TEACHER_REVIEWED'
  | 'PENDING_AI'
  | 'WITHDRAWN'

export const STATE_META: Record<
  ReviewState,
  { label: string; tone: 'done' | 'todo' | 'wip' | 'lock' }
> = {
  AI_REVIEWED: { label: 'AI 已审阅', tone: 'todo' },
  OBJECTION: { label: '学生申请复审', tone: 'wip' },
  TEACHER_REVIEWED: { label: '教师已复审', tone: 'done' },
  PENDING_AI: { label: '待 AI 评审', tone: 'lock' },
  WITHDRAWN: { label: '学生已撤回', tone: 'lock' },
}

export const STATUS_OPTIONS: { value: ReviewState | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部状态' },
  { value: 'AI_REVIEWED', label: 'AI 已审阅' },
  { value: 'OBJECTION', label: '学生申请复审' },
  { value: 'TEACHER_REVIEWED', label: '教师已复审' },
  { value: 'PENDING_AI', label: '待 AI 评审' },
  { value: 'WITHDRAWN', label: '学生已撤回' },
]

/** 由提交数据推出流程状态：教师定稿 > 学生异议 > AI 出结果 > 待 AI / 已撤回 */
export function reviewStateOf(row: SubmissionListItem): ReviewState {
  if (row.status === 'REVIEWED') return 'TEACHER_REVIEWED'
  if (row.objection_reason || row.status === 'PENDING_REVIEW' || row.status === 'REVIEWING') {
    return 'OBJECTION'
  }
  if (row.status === 'AI_PASSED' || row.status === 'AI_FAILED') return 'AI_REVIEWED'
  if (row.status === 'WITHDRAWN') return 'WITHDRAWN'
  return 'PENDING_AI'
}

export function stateLabelOf(row: SubmissionListItem): string {
  return STATE_META[reviewStateOf(row)].label
}

export function stateToneOf(row: SubmissionListItem): 'done' | 'todo' | 'wip' | 'lock' {
  return STATE_META[reviewStateOf(row)].tone
}

/**
 * 及格标记：`final_conclusion` 只由「定稿」的评审写入（AI 定稿或教师定稿），PASS 即及格；
 * 还没有定稿评审时是「待判定」，不能显示成未及格。
 */
export function passMark(row: SubmissionListItem): {
  text: string
  tone: 'good' | 'bad' | 'wait'
} {
  const passed = row.final_conclusion === 'PASS'
  if (row.status === 'REVIEWED') {
    return {
      text: passed ? '已复审 · 及格' : '已复审 · 未及格',
      tone: passed ? 'good' : 'bad',
    }
  }
  if (row.status === 'WITHDRAWN') return { text: '已撤回', tone: 'wait' }
  if (!row.final_conclusion) return { text: '待判定', tone: 'wait' }
  if (row.status === 'PENDING_REVIEW' || row.status === 'REVIEWING') {
    return {
      text: passed ? '及格 · 待复审' : '未及格 · 待复审',
      tone: passed ? 'good' : 'bad',
    }
  }
  return { text: passed ? '及格' : '未及格', tone: passed ? 'good' : 'bad' }
}

export interface AnswerBlock {
  heading: string
  body: string
}

/** 把作答按 Markdown 小标题（`### 标题`）切块，便于标题与内容分色展示 */
export function answerBlocksOf(text: string | null | undefined): AnswerBlock[] {
  const raw = (text ?? '').trim()
  if (!raw) return []

  const blocks: AnswerBlock[] = []
  let current: AnswerBlock | null = null

  for (const line of raw.split('\n')) {
    const matched = /^\s*#{1,4}\s*(.+?)\s*$/.exec(line)
    if (matched) {
      current = { heading: matched[1] ?? '', body: '' }
      blocks.push(current)
      continue
    }
    if (!current) {
      current = { heading: '', body: line }
      blocks.push(current)
    } else {
      current.body += (current.body ? '\n' : '') + line
    }
  }

  return blocks
    .map((block) => ({ heading: block.heading, body: block.body.trim() }))
    .filter((block) => block.heading || block.body)
}

/** 附件体积：不足 1KB 直接显示 B，避免出现「0 KB」 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
