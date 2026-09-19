/**
 * 真实后端的响应结构（与《教师端接口文档》§4 / §6 / §7 / §8 一一对应）。
 *
 * 只声明本端用得到的字段；Decimal 字段按后端原样标成 string，
 * 用 `num()` 转换后再参与计算与展示。
 */

/* -------------------------------------------------------------------------- */
/* §4 教学组织：班级 / 花名册 / 分组                                            */
/* -------------------------------------------------------------------------- */

export interface ClassInfo {
  id: number
  class_name: string
  grade_year: number | null
  head_teacher_id: number | null
  group_count: number
  remark: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  created_at: string
  updated_at: string
  deleted_at: string | null
  /** 仅详情接口返回 */
  student_count?: number
}

export interface ClassStudent {
  id: number
  class_id: number
  student_id: number
  status: string
  enrolled_at: string
  user_no: string
  real_name: string
  major_name: string | null
  class_name: string
  account_status: string | null
  group_id: number | null
  group_name: string | null
}

export interface GroupMember {
  class_student_id: number
  student_id: number
  user_no: string
  real_name: string
  major_name: string | null
}

export interface ClassGroup {
  id: number
  class_id: number
  group_no: number
  group_name: string
  student_count: number
  students?: GroupMember[]
  created_at: string
  updated_at: string
}

/** GET /teachers/{teacher_id}/classes 的班级对象 */
export interface TeacherClassSummary {
  class_id: number
  class_name: string
  grade_year: number | null
  status: 'ACTIVE' | 'ARCHIVED'
  remark: string | null
  student_count: number
  group_count: number
  ungrouped_count: number
  groups: {
    group_id: number
    group_no: number
    group_name: string
    member_count: number
    members: GroupMember[]
  }[]
  ungrouped_students: GroupMember[]
  task_count: number
  average_completion_rate: number
  tasks: TeacherTaskProgress[]
}

export interface TeacherTaskProgress {
  task_id: number
  title: string
  description: string | null
  status: 'PENDING' | 'PUBLISHED' | 'CANCELLED'
  effective: boolean
  publish_mode: string
  published_at: string | null
  scheduled_at: string | null
  deadline_at: string | null
  project_count: number
  project_names: string[]
  student_count: number
  total_count: number
  completed_count: number
  in_progress_count: number
  not_started_count: number
  completion_rate: number
  students: {
    student_id: number
    user_no: string
    real_name: string
    class_student_id: number
    group_id: number | null
    group_name: string | null
    completed_count: number
    total_count: number
    completion_rate: number
    status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'
  }[]
}

export interface TeacherClassOverview {
  teacher_id: number
  teacher_name: string
  class_count: number
  student_count: number
  task_count: number
  average_completion_rate: number
  generated_at: string
  classes: TeacherClassSummary[]
}

export interface StudentImportResult {
  dry_run: boolean
  class_id: number
  total: number
  created_users: number
  reused_users: number
  created_class_students: number
  assigned_groups: number
  ignored_group_hints: number
}

export interface StudentImportError {
  row: number
  user_no: string | null
  reason: string
}

/* -------------------------------------------------------------------------- */
/* §6 岗位与技能                                                               */
/* -------------------------------------------------------------------------- */

export interface JobRead {
  id: number
  job_name: string
  direction_tag: string | null
  recommended_level: 'BASIC' | 'ADVANCED' | 'EXPANDED' | null
  scene: string | null
  description: string | null
  heat: number
  status: 'ENABLED' | 'DISABLED'
  skill_count?: number
}

export interface SkillTreeNode {
  id: number
  tree_id: number
  tree_name?: string
  node_code: string
  node_name: string
  description: string | null
  unlock_note: string | null
  /** 节点详情 / 列表接口会带上前置技能 id（技能树的连线来源） */
  prerequisite_ids?: number[]
  status: 'ENABLED' | 'DISABLED'
  deleted_at?: string | null
}

export interface SkillTreeRead {
  id: number
  tree_code: string
  tree_name: string
  description: string | null
  status: 'ENABLED' | 'DISABLED'
}

/* -------------------------------------------------------------------------- */
/* §7 实训项目：模块库 / 项目 / 关卡组成 / 附件 / 技能                          */
/* -------------------------------------------------------------------------- */

export interface StageTemplate {
  id: number
  stage_key: string
  stage_name: string
  description: string | null
  default_required: boolean
  default_weight: string
  default_requirement: string | null
  default_accept_standard: string | null
  sort_no: number
  used_by_projects?: number
}

/** 关卡里的引导子标题：只做引导，不参与校验与评分 */
export interface StageItem {
  title: string
  prompt: string
}

export interface ProjectModule {
  id: number
  project_id: number
  template_id: number
  stage_no: number
  stage_key: string
  stage_name: string
  items_json: StageItem[]
  requirement: string | null
  accept_standard: string | null
  required: boolean
  weight: string
  default_weight: string
}

export interface ProjectFile {
  id: number
  project_id: number
  file_asset_id: number
  file_kind: string
  title: string | null
  remark: string | null
  sort_no: number
  original_name: string
  content_type: string | null
  size_bytes: number
  download_url: string
  knowledge_doc_id?: number | null
  knowledge_status?: string | null
  chunk_count?: number | null
  knowledge_error?: string | null
}

export interface ProjectRead {
  id: number
  project_name: string
  project_level: 'BASIC' | 'ADVANCED' | 'EXPANDED'
  difficulty: number
  job_id: number | null
  description: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'OFF_SHELF'
  creator_id: number | null
  created_at: string
  updated_at: string
  /** 详情接口才有 */
  modules?: ProjectModule[]
  files?: ProjectFile[]
  weight_total?: string
}

/* -------------------------------------------------------------------------- */
/* §8 任务下发                                                                 */
/* -------------------------------------------------------------------------- */

export interface TaskTarget {
  id?: number
  task_id?: number
  target_type: 'CLASS' | 'GROUP'
  class_id: number
  group_id?: number | null
  class_name?: string | null
  group_name?: string | null
}

export interface PublishTask {
  id: number
  title: string
  description: string | null
  project_level: 'BASIC' | 'ADVANCED' | 'EXPANDED' | null
  publish_mode: 'IMMEDIATE' | 'SCHEDULED'
  scheduled_at: string | null
  deadline_at: string | null
  status: 'PENDING' | 'PUBLISHED' | 'CANCELLED'
  creator_id: number | null
  published_at: string | null
  cancelled_at: string | null
  remark: string | null
  created_at: string
  updated_at: string
  project_count: number
  target_count: number
  student_count: number
  expired: boolean
  /** 详情接口才有 */
  targets?: TaskTarget[]
  jobs?: { job_id: number; job_name: string }[]
  projects?: { project_id: number; project_name: string; project_level: string; status: string }[]
  can_edit?: boolean
}

export interface PublishableProject {
  id: number
  project_name: string
  project_level: 'BASIC' | 'ADVANCED' | 'EXPANDED'
  difficulty: number
  job_id: number | null
  job_name: string | null
  status: string
}

export interface StudentPreview {
  student_count: number
  class_count: number
  group_count: number
  missing_group_ids: number[]
}
