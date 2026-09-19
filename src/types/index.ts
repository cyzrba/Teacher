/**
 * 全局数据契约 · 教师端
 *
 * 字段口径以《需求确认书0706》内嵌原型截图为准（截图优先），
 * 文字需求作为补充；两者不一致处见 README「文字-截图差异清单」。
 */

/* -------------------------------------------------------------------------- */
/* 通用                                                                        */
/* -------------------------------------------------------------------------- */

export interface PageQuery {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 发布方式：即时发布 / 定时发布 / 班级定向（原型截图三种并存） */
export type PublishMode = 'immediate' | 'scheduled' | 'class_targeted'

/** 项目层级：基础 / 进阶 / 拓展（原文“普通实训”按笔误订正） */
export type ProjectTier = 'basic' | 'advanced' | 'extended'

export const TIER_LABEL: Record<ProjectTier, string> = {
  basic: '基础',
  advanced: '进阶',
  extended: '拓展',
}

export const TIER_FULL_LABEL: Record<ProjectTier, string> = {
  basic: '基础实训',
  advanced: '进阶实训',
  extended: '拓展实训',
}

export const PUBLISH_MODE_LABEL: Record<PublishMode, string> = {
  immediate: '即时发布',
  scheduled: '定时发布',
  class_targeted: '班级定向',
}

/* -------------------------------------------------------------------------- */
/* 身份                                                                        */
/* -------------------------------------------------------------------------- */

export type UserRole = 'student' | 'teacher'

export interface TeacherProfile {
  id: string
  /** 工号（脱敏展示） */
  jobNo: string
  name: string
  /** 所属学院 */
  college: string
  /** 任教班级数 */
  classCount: number
  /** 负责学生数 */
  studentCount: number
}

export interface LoginResult {
  token: string
  role: UserRole
  profile: TeacherProfile | null
}

/* -------------------------------------------------------------------------- */
/* 班级与任务                                                                  */
/* -------------------------------------------------------------------------- */

export interface ClassGroup {
  id: string
  name: string
  studentCount: number
}

export interface SchoolClass {
  id: string
  /** 班级名称，如 21级1班 */
  name: string
  studentCount: number
  teacher: string
  groups: ClassGroup[]
  /** 任务进度：已完成任务数 / 已下发任务数 */
  taskDone: number
  taskTotal: number
  /** 平均完成率 0-100 */
  avgCompletion: number
  remark: string
}

export type TaskStatus = 'published' | 'pending' | 'revoked'

/**
 * 班级学生（学生名册）。
 * 分组人数、班级人数、任务完成情况、证书发放的班级字段，
 * 全部由这份名册派生，避免"分组人数"变成一个可以随便改的孤立数字（修复#14）。
 */
export interface ClassStudent {
  id: string
  studentNo: string
  name: string
  className: string
  /** 所在分组，如 A组 */
  group: string
  positionId: string
  positionName: string
  /** 技能点亮率 % */
  skillRate: number
  /** 项目完成率 % */
  projectRate: number
  /** 平均分（由审核记录派生，保证与审核列表口径一致） */
  avgScore: number
  /** 累计在线时长（小时） */
  onlineHours: number
  /** 已完成的项目 id 列表，用于按任务统计完成情况 */
  doneProjectIds: string[]
}

/** 某次任务下单个学生的完成情况（修复#7） */
export interface TaskCompletionStudent {
  id: string
  name: string
  group: string
  /** 是否完成该任务要求的全部项目 */
  done: boolean
  finished: number
  total: number
}

/** 某次任务的完成情况汇总（修复#7） */
export interface TaskCompletion {
  taskId: string
  className: string
  group: string
  positionName: string
  projectNames: string[]
  studentTotal: number
  doneCount: number
  undoneCount: number
  students: TaskCompletionStudent[]
}

export interface TrainTask {
  id: string
  classId: string
  className: string
  /** 目标分组，全班时为「全班」 */
  group: string
  positionId: string
  positionName: string
  /** 全部岗位时为 'all' */
  tier: ProjectTier | 'all'
  /**
   * 指定项目（修复#1）。留空表示按「岗位 + 层级」批量下发；
   * 有值时任务只覆盖这些项目。
   */
  projectIds: string[]
  /** 项目名称快照，便于列表直接展示与悬浮查看 */
  projectNames: string[]
  publishMode: PublishMode
  publishAt: string
  status: TaskStatus
}

export interface CreateTaskPayload {
  classIds: string[]
  group: string
  positionId: string
  tier: ProjectTier | 'all'
  /** 指定项目（可选）：不传或空数组 = 按岗位 + 层级批量下发 */
  projectIds?: string[]
  publishMode: PublishMode
  publishAt?: string
}

export interface DataExportCard {
  id: string
  name: string
  description: string
  formats: string
}

/* -------------------------------------------------------------------------- */
/* 实训项目与模块                                                              */
/* -------------------------------------------------------------------------- */

/**
 * 标准化实训模块。
 * 默认七大模块，教师可增删、改名、调整必填 / 分值占比 / 作答要求，
 * 并支持扩展字段（extended）而不改结构。
 */
export interface TrainModule {
  id: string
  name: string
  description: string
  /** 是否启用该模块 */
  enabled: boolean
  /** 是否必填 */
  required: boolean
  /** 分值占比（0-100，七大模块合计 100） */
  weight: number
  /** 该模块评分上限（分模块评分页的分母，如 18/20 中的 20） */
  maxScore: number
  /** 作答要求，如「不少于500字」 */
  answerRequirement: string
  /** 扩展字段：预留给后续自定义模块 */
  extended?: Record<string, string>
}

export type ProjectStatus = 'published' | 'pending' | 'offline'

export interface UploadedDoc {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
}

export interface ImportedStudent {
  id: string
  name: string
  studentNo: string
  className: string
  group: string
}

export interface Project {
  id: string
  name: string
  tier: ProjectTier
  /** 难度 1-5，列表以星标展示 */
  difficulty: number
  positionId: string
  positionName: string
  status: ProjectStatus
  publishMode: PublishMode
  /** 发布对象文案，如「全部班级」「21级1班、21级2班」 */
  publishTarget: string
  publishAt: string
  description: string
  modules: TrainModule[]
  skillTagIds: string[]
  knowledgePoints: string[]
  materials: UploadedDoc[]
  scoreStandard: UploadedDoc[]
  imports: ImportedStudent[]
  createdAt: string
}

export interface CreateProjectPayload {
  name: string
  tier: ProjectTier
  positionId: string
  publishMode: PublishMode
  publishAt?: string
  description: string
  modules: TrainModule[]
  skillTagIds: string[]
  knowledgePoints: string[]
  materials: UploadedDoc[]
  scoreStandard: UploadedDoc[]
}

export interface PublishRecord {
  id: string
  projectId: string
  projectName: string
  /** 由项目派生，用于列表按「层级 → 难度 → 名称」排序 */
  tier?: ProjectTier
  difficulty?: number
  publishMode: PublishMode
  publishTarget: string
  publishAt: string
  status: ProjectStatus
}

/* -------------------------------------------------------------------------- */
/* 岗位与技能体系                                                              */
/* -------------------------------------------------------------------------- */

export type SkillSystemId = 'optical' | 'algorithm' | 'deeplearning' | 'deployment'

export interface SkillTag {
  id: string
  name: string
  systemId: SkillSystemId
  /** 技能点难度层级，与项目层级同口径（基础 / 进阶 / 拓展） */
  level?: ProjectTier
  /** 达标分数：单次评分达到该分数，记一次达标 */
  passScore?: number
  /** 点亮所需达标次数：1 = 一次达标即点亮；>1 = 需多次达标（点亮进度按次数展示） */
  requiredHits?: number
  /** 技能点说明：学生在技能树里看到的解锁说明 */
  description?: string
  /** 是否启用：停用后不再出现在新建岗位 / 项目的可选技能标签里 */
  enabled?: boolean
}

export interface SkillSystem {
  id: SkillSystemId
  name: string
  color: string
}

export interface Position {
  id: string
  name: string
  /** 推荐学习等级 */
  level: ProjectTier
  /** 适配实训场景 */
  scenario: string
  enabled: boolean
  summary: string
  skillTagIds: string[]
  /** 关联班级数（数据总览热度用） */
  studentCount: number
}

export interface GrowthRule {
  tier: ProjectTier
  /** 解锁条件 */
  unlockCondition: string
  /** 技能树满级标准 */
  masteryStandard: string
  /** 最大等级 */
  maxLevel: number
  /** 通过分数 */
  passScore: number
  /** 等级说明 */
  levelDescription: string
  /** 技能匹配数量（岗位↔项目匹配度计算） */
  matchCount: number
  /** 关联度阈值 0-100 */
  relevance: number
}

/* -------------------------------------------------------------------------- */
/* 实训结果审核                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 审核状态（截图三态）。
 *
 * 数据模型扩展点：文字需求另有一套「已通过 → 待复审 → 复审中 → 已复审」状态机。
 * 一期不实现第二套状态机，仅把「学生异议触发复审」作为可选字段保留，
 * 后端就绪后可直接置位，无需改动列表结构。详见 README「文字-截图差异清单」第 1 条。
 */
/**
 * 审核状态。
 *
 * 截图三态（已通过 / 已驳回 / 待审核）+ 本轮新增「已复核」（修复#4）：
 * 教师修改任一模块分数并保存后，记录由「已通过」流转为「已复核」，并保留 AI 原分。
 * 文字需求里的「待复审 / 复审中」仍不作为独立状态（见 README 差异清单第 1 条）。
 */
export type ReviewStatus = 'approved' | 'rejected' | 'pending' | 'rechecked'

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  approved: '已通过',
  rejected: '已驳回',
  pending: '待审核',
  rechecked: '已复核',
}

/** 学生异议 / 教师复审：一期只落数据，不驱动 UI 状态机 */
export interface ReviewRecheckExtension {
  /** 学生是否已就不通过结果提出异议 */
  objectionRaised: boolean
  /** 异议说明 */
  objectionNote?: string
  /** 教师复审草稿是否已保存 */
  draftSaved: boolean
  /** 教师最终复审分数 */
  recheckScore?: number
  /** 复核人（教师姓名，修复#5） */
  reviewedBy?: string
  /** 复核时间（修复#5） */
  reviewedAt?: string
}

export interface ModuleScore {
  moduleId: string
  moduleName: string
  /** 教师评分 */
  score: number
  /** 评分上限，如 20 */
  maxScore: number
  /** 分值占比（%），总分 = Σ(score / maxScore × weight) */
  weight: number
  /** 教师批注 */
  comment: string
  /** AI 给出的维度得分 */
  aiScore: number
  /** AI 评审理由 */
  aiReason: string
}

export interface ReviewItem {
  id: string
  studentName: string
  className: string
  projectId: string
  projectName: string
  /** 当前生效总分（0-100）：未复核时为 AI 分，复核后为教师分 */
  score: number
  /**
   * AI 原始总分（修复#5）。
   * 与 score 分开存储，复核后两者同时展示，AI 原分不被覆盖。
   */
  aiTotalScore: number
  submittedAt: string
  status: ReviewStatus
  /** 标星：标星后自动置顶加入审核列表 */
  starred: boolean
  /** 分模块评分与批注 */
  moduleScores: ModuleScore[]
  /** 评价反馈（对学生的整体评语） */
  feedback: string
  /** 驳回原因，列表操作列展示 */
  rejectReason?: string
  /** 报告全文（复审详情展示） */
  report: string
  /** 可选扩展：学生异议 / 教师复审 */
  recheck: ReviewRecheckExtension
}

export interface ReviewQuery extends PageQuery {
  status?: ReviewStatus | 'all'
}

/* -------------------------------------------------------------------------- */
/* 数据总览 & 学习过程统计                                                     */
/* -------------------------------------------------------------------------- */

export interface OverviewMetric {
  key: string
  label: string
  value: string
  tone: 'brand' | 'orange' | 'violet' | 'ok' | 'danger'
}

export interface CompletionRankItem {
  /** 图表横轴短名，如「亚克力板」 */
  shortName: string
  projectName: string
  rate: number
}

export interface PositionHeatItem {
  name: string
  value: number
}

export interface WarningItem {
  id: string
  projectName: string
  rate: number
  avgScore: number | null
  advice: string
}

export interface OverviewStats {
  metrics: OverviewMetric[]
  completionRank: CompletionRankItem[]
  positionHeat: PositionHeatItem[]
  warnings: WarningItem[]
}

export interface ProgressBucket {
  label: string
  count: number
}

export interface DailyOnlineItem {
  day: string
  hours: number
}

export interface StudentProgressRow {
  id: string
  name: string
  className: string
  positionName: string
  finishedProjects: number
  totalProjects: number
  avgScore: number
  onlineHours: number
  skillProgress: number
}

export interface LearningStats {
  progressBuckets: ProgressBucket[]
  dailyOnline: DailyOnlineItem[]
  students: StudentProgressRow[]
}

/* -------------------------------------------------------------------------- */
/* 企业认证证书                                                                */
/* -------------------------------------------------------------------------- */

export type CertificateStatus = 'valid' | 'revoked' | 'expired'

export const CERT_STATUS_LABEL: Record<CertificateStatus, string> = {
  valid: '有效',
  revoked: '已作废',
  expired: '已过期',
}

export interface CertificateRule {
  id: string
  positionId: string
  positionName: string
  /** 证书名称，如「视觉检测算法工程师认证证书」 */
  name: string
  swatch: string
  /** 申领条件 */
  minSkillRate: number
  minProjectRate: number
  minAvgScore: number
  /** 满级标准 */
  basicProjectRule: string
  advancedProjectRule: string
  /** 证书有效期（月） */
  validMonths: number
  active: boolean
}

export type CertificateApplyStatus = 'pending' | 'approved' | 'rejected'

export interface CertificateApplication {
  id: string
  studentName: string
  positionId: string
  positionName: string
  certNo: string
  appliedAt: string
  /** 技能点亮率 % */
  skillRate: number
  /** 项目完成率 % */
  projectRate: number
  avgScore: number
  status: CertificateApplyStatus
  rejectReason?: string
}

export interface Certificate {
  id: string
  studentName: string
  className: string
  positionId: string
  positionName: string
  certNo: string
  issuedAt: string
  /** 有效期至；已作废时为 '--' */
  validUntil: string
  status: CertificateStatus
  issuer: string
}

/* -------------------------------------------------------------------------- */
/* AI 能力预留                                                                 */
/* -------------------------------------------------------------------------- */

export type AiCapabilityId = 'defense' | 'interview'

export interface AiCapability {
  id: AiCapabilityId
  name: string
  description: string
  /** 一期仅预留接口，入口置为「敬请期待」 */
  endpoint: string
  available: boolean
}

/* -------------------------------------------------------------------------- */
/* 导航                                                                        */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  key: string
  label: string
  path: string
}
