/**
 * 真实后端（FastAPI）相关配置。
 *
 * 后端统一响应体是 `{code, data, msg}`，数值型 Decimal 字段在 JSON 里是字符串，
 * 时间是无时区的 ISO 8601 —— 这三条约定集中在 `api/backend/client.ts` 里处理。
 */

/** 接口前缀：开发环境走 Vite 代理（见 vite.config.ts），生产环境由网关转发 */
export const BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE ?? '/api'

/**
 * 当前教师 ID。
 *
 * 接口文档 §0 明确：**当前后端没有鉴权层**，身份靠调用方显式传 `teacher_id`；
 * 接入学校统一身份认证之后，这个值应当从登录态取（`useUserStore().profile`），
 * 这里保留一个演示用常量 —— 对应后端种子数据里的 T2024001 张伟，
 * 他任教「人工智能2401班」（4 个分组）与「人工智能2402班」（未分组）。
 */
export const CURRENT_TEACHER_ID = 2

/** 单文件上传上限（MB），与后端 MAX_UPLOAD_MB 保持一致 */
export const MAX_UPLOAD_MB = 50

/** 项目附件用途：与后端 file_kind 枚举一一对应 */
export const FILE_KIND = {
  /** 报告模板 */
  REPORT_TEMPLATE: 'REPORT_TEMPLATE',
  /** 数据文件 */
  DATASET: 'DATASET',
  /** 说明文档 */
  GUIDE: 'GUIDE',
  /** 评分标准（上传即入库，供 AI 评审召回） */
  SCORING_CRITERIA: 'SCORING_CRITERIA',
  /** 其它 */
  OTHER: 'OTHER',
} as const

export const FILE_KIND_LABEL: Record<string, string> = {
  REPORT_TEMPLATE: '报告模板',
  DATASET: '数据文件',
  GUIDE: '说明文档',
  SCORING_CRITERIA: '评分标准',
  OTHER: '其它',
}

/* -------------------------------------------------------------------------- */
/* 枚举文案：与后端字典（GET /api/enums）同口径                                */
/* -------------------------------------------------------------------------- */

export const LEVEL_LABEL: Record<string, string> = {
  BASIC: '基础',
  ADVANCED: '进阶',
  EXPANDED: '拓展',
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  OFF_SHELF: '已下架',
}

export const TASK_STATUS_LABEL: Record<string, string> = {
  PENDING: '待发布',
  PUBLISHED: '已发布',
  CANCELLED: '已撤回',
}

export const PUBLISH_MODE_LABEL: Record<string, string> = {
  IMMEDIATE: '即时发布',
  SCHEDULED: '定时发布',
}

export const CLASS_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '在读',
  ARCHIVED: '归档',
}

export const JOB_STATUS_LABEL: Record<string, string> = {
  ENABLED: '启用',
  DISABLED: '停用',
}
