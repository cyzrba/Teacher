/**
 * Mock 服务端：以 axios 适配器的方式实现《需求确认书0706》第 8.3 节接口清单。
 *
 * 这样做的好处是「前端调用方式与真实后端完全一致」——
 * 页面 → store → api/*.ts → axios → （当前命中这里 / 后端就绪后命中 FastAPI）。
 * 切换方式：`.env` 中 VITE_USE_MOCK=false。
 */

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosError, AxiosHeaders } from 'axios'
import { getToken } from '@/utils/storage'
import {
  certificateApplications,
  certificateRules,
  certificates,
  classes,
  dailyOnline,
  exportCards,
  growthRules,
  positions,
  projects,
  reviews,
  studentRoster,
  tasks,
  teacherProfile,
} from './data'
import { skillSystems, skillTags as seedSkillTags } from '@/config/skills'
import type { ClassStudent, ProjectTier, SchoolClass, SkillSystemId } from '@/types'

/* -------------------------------------------------------------------------- */
/* 可变的演示数据：增删改都在内存里生效，刷新页面后回到初始 seed                 */
/* -------------------------------------------------------------------------- */

const db = {
  classes: [...classes],
  tasks: [...tasks],
  projects: [...projects],
  positions: [...positions],
  growthRules: [...growthRules],
  reviews: [...reviews],
  certificateRules: [...certificateRules],
  certificateApplications: [...certificateApplications],
  certificates: [...certificates],
  /** 技能库：运行时可新增（新建岗位时把不存在的标签加入技能库） */
  skillTags: [...seedSkillTags],
  /** 学生名册：班级人数、分组、任务完成情况、证书班级都由它派生 */
  students: [...studentRoster],
  /**
   * 班级的分组名称（教师配置，权威来源）。
   * 分组「人数」由名册派生，分组「名称」由教师维护——
   * 此前只用名册推断分组名，导致「编辑班级→改分组数量」不生效。
   */
  classGroups: Object.fromEntries(
    classes.map((item) => [item.id, item.groups.map((group) => group.name)]),
  ) as Record<string, string[]>,
}

export const mockDb = db

/* -------------------------------------------------------------------------- */
/* 派生工具：班级 / 分组 / 学生                                                */
/* -------------------------------------------------------------------------- */

/** 班级列表按名册实时派生人数与分组，避免"分组人数"是可以随便改的孤立数字 */
function deriveClasses(): SchoolClass[] {
  return db.classes.map((cls) => {
    const members = db.students.filter((item) => item.className === cls.name)
    const names = db.classGroups[cls.id] ?? []
    // 名册中出现但配置里没有的分组（如批量导入时指定了新组）自动补进来
    for (const member of members) {
      if (!names.includes(member.group)) names.push(member.group)
    }
    return {
      ...cls,
      studentCount: members.length,
      groups: names.map((name, index) => ({
        id: `g-${cls.id}-${index + 1}`,
        name,
        studentCount: members.filter((item) => item.group === name).length,
      })),
    }
  })
}

/** 分组序号 → 名称：0→A组、1→B组 … */
function groupNameAt(index: number): string {
  return `${String.fromCharCode(65 + (index % 26))}组`
}

/** 学生的平均分以审核记录为准（修复#8）：保证与审核列表口径一致 */
function avgScoreOf(student: ClassStudent): number {
  const mine = db.reviews.filter((item) => item.studentName === student.name)
  if (mine.length === 0) return student.avgScore
  const sum = mine.reduce((total, item) => total + item.score, 0)
  return Math.round(sum / mine.length)
}

/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

interface MockContext {
  params: Record<string, unknown>
  body: Record<string, unknown>
  /** 路径中的 :id 等参数，按名称取值 */
  path: Record<string, string>
  method: string
  url: string
}

interface MockRoute {
  method: string
  pattern: RegExp
  /** 是否需要登录态，默认 true */
  auth?: boolean
  handler: (ctx: MockContext) => unknown
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** 复核时间戳：YYYY-MM-DD HH:mm */
function stamp(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseBody(data: unknown): Record<string, unknown> {
  if (!data) return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return data as Record<string, unknown>
}

function pageOf<T>(list: T[], params: Record<string, unknown>): { list: T[]; total: number; page: number; pageSize: number } {
  const page = Number(params.page ?? 1)
  const pageSize = Number(params.pageSize ?? 10)
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, page, pageSize }
}

function matchText(source: string, keyword: unknown): boolean {
  if (typeof keyword !== 'string' || keyword.length === 0) return true
  return source.toLowerCase().includes(keyword.toLowerCase())
}

/* -------------------------------------------------------------------------- */
/* 路由表：与第 8.3 节接口清单对应                                              */
/* -------------------------------------------------------------------------- */

const routes: MockRoute[] = [
  /* —— 认证鉴权 —— */
  {
    method: 'post',
    pattern: /^\/auth\/sso\/callback$/,
    auth: false,
    handler: (ctx) => {
      const key = String(ctx.body.key ?? '')
      const role = key.startsWith('teacher') ? 'teacher' : 'student'
      return {
        token: `mock-jwt-${role}-${Date.now().toString(36)}`,
        role,
        profile: role === 'teacher' ? teacherProfile : null,
      }
    },
  },
  {
    method: 'post',
    pattern: /^\/auth\/refresh$/,
    auth: false,
    handler: () => ({ token: `mock-jwt-teacher-${Date.now().toString(36)}` }),
  },

  /* —— 班级 —— */
  {
    method: 'get',
    pattern: /^\/classes$/,
    handler: (ctx) =>
      pageOf(
        deriveClasses().filter((item) => matchText(item.name + item.teacher, ctx.params.keyword)),
        ctx.params,
      ),
  },
  {
    method: 'post',
    pattern: /^\/classes$/,
    handler: (ctx) => {
      const name = String(ctx.body.name ?? '')
      const groupCount = Number(ctx.body.groupCount ?? 0)
      const created = {
        id: `cls-${Date.now().toString(36)}`,
        name,
        studentCount: 0,
        teacher: String(ctx.body.teacher ?? ''),
        groups: [],
        taskDone: 0,
        taskTotal: 0,
        avgCompletion: 0,
        remark: String(ctx.body.remark ?? ''),
      }
      db.classes = [created, ...db.classes]
      // 分组名称存入配置，人数由名册（当前为空）派生
      db.classGroups[created.id] = Array.from({ length: groupCount }, (_, index) =>
        groupNameAt(index),
      )
      return deriveClasses().find((item) => item.id === created.id) ?? created
    },
  },
  {
    method: 'put',
    pattern: /^\/classes\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.classes.find((item) => item.id === id)
      if (!current) return null

      // 分组数量：新增则补组名，减少则把被删分组的学生并到第一组
      const currentNames = [...(db.classGroups[id] ?? [])]
      const groupCount = Number(ctx.body.groupCount ?? currentNames.length)
      const names = currentNames.slice(0, groupCount)
      while (names.length < groupCount) names.push(groupNameAt(names.length))
      const removed = currentNames.slice(groupCount)
      if (removed.length > 0) {
        const fallback = names[0] ?? groupNameAt(0)
        db.students = db.students.map((student) =>
          student.className === current.name && removed.includes(student.group)
            ? { ...student, group: fallback }
            : student,
        )
      }
      db.classGroups[id] = names

      const updated = {
        ...current,
        name: String(ctx.body.name ?? current.name),
        teacher: String(ctx.body.teacher ?? current.teacher),
        remark: String(ctx.body.remark ?? current.remark),
      }
      db.classes = db.classes.map((item) => (item.id === id ? updated : item))
      return deriveClasses().find((item) => item.id === id) ?? updated
    },
  },
  {
    method: 'delete',
    pattern: /^\/classes\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.classes = db.classes.filter((item) => item.id !== id)
      return { ok: true }
    },
  },
  {
    method: 'put',
    pattern: /^\/classes\/([^/]+)\/students$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.classes.find((item) => item.id === id)
      if (!current) return null

      // 分组调整：把学生移动到目标分组（人数据此自动重算，修复#14）
      const assignments = Array.isArray(ctx.body.assignments)
        ? (ctx.body.assignments as { studentId: string; group: string }[])
        : []
      // 分组名称也可随保存一并提交（弹窗内新增的分组）
      if (Array.isArray(ctx.body.groupNames)) {
        const names = (ctx.body.groupNames as string[]).map((item) => String(item).trim()).filter(Boolean)
        if (names.length > 0) db.classGroups[id] = Array.from(new Set(names))
      }
      if (assignments.length > 0) {
        db.students = db.students.map((student) => {
          const target = assignments.find((item) => item.studentId === student.id)
          return target ? { ...student, group: target.group } : student
        })
      }
      return deriveClasses().find((item) => item.id === id) ?? null
    },
  },
  {
    method: 'get',
    pattern: /^\/classes\/([^/]+)\/students$/,
    handler: (ctx) => {
      const cls = db.classes.find((item) => item.id === ctx.path.id)
      if (!cls) return []
      return db.students
        .filter((item) => item.className === cls.name)
        .map((item) => ({
          id: item.id,
          studentNo: item.studentNo,
          name: item.name,
          group: item.group,
        }))
    },
  },
  {
    method: 'post',
    pattern: /^\/classes\/([^/]+)\/import$/,
    handler: (ctx) => {
      const cls = db.classes.find((item) => item.id === ctx.path.id)
      if (!cls) return null
      const incoming = Array.isArray(ctx.body.students)
        ? (ctx.body.students as { name: string; studentNo: string; group?: string }[])
        : []
      const defaultGroup = String(ctx.body.defaultGroup ?? 'A组')
      const existed = new Set(db.students.map((item) => `${item.className}-${item.studentNo}`))

      const created: ClassStudent[] = []
      let skipped = 0
      incoming.forEach((item, index) => {
        const name = String(item.name ?? '').trim()
        const studentNo = String(item.studentNo ?? '').trim() || `2021${9000 + index}`
        if (!name) return
        if (existed.has(`${cls.name}-${studentNo}`)) {
          skipped += 1
          return
        }
        existed.add(`${cls.name}-${studentNo}`)
        created.push({
          id: `stu-${cls.name}-imp-${Date.now().toString(36)}-${index}`,
          studentNo,
          name,
          className: cls.name,
          group: String(item.group ?? '').trim() || defaultGroup,
          positionId: '',
          positionName: '未指定岗位',
          skillRate: 0,
          projectRate: 0,
          avgScore: 0,
          onlineHours: 0,
          doneProjectIds: [],
        })
      })

      db.students = [...db.students, ...created]
      return { imported: created.length, skipped }
    },
  },

  /* —— 任务 —— */
  {
    method: 'get',
    pattern: /^\/tasks$/,
    handler: (ctx) => {
      const classId = String(ctx.params.classId ?? '')
      const group = String(ctx.params.group ?? '')
      const list = db.tasks
        .filter((item) => (classId ? item.classId === classId : true))
        .filter((item) => (group ? item.group === group : true))
        .filter((item) => matchText(item.className + item.positionName, ctx.params.keyword))
      return pageOf(list, ctx.params)
    },
  },
  {
    method: 'post',
    pattern: /^\/tasks$/,
    handler: (ctx) => {
      const classIds = Array.isArray(ctx.body.classIds) ? (ctx.body.classIds as string[]) : []
      const group = String(ctx.body.group || '全班')
      const positionId = String(ctx.body.positionId ?? 'all')
      const tier = (ctx.body.tier ?? 'all') as (typeof db.tasks)[number]['tier']
      const publishMode = (ctx.body.publishMode ?? 'immediate') as (typeof db.tasks)[number]['publishMode']
      const publishAt = String(ctx.body.publishAt ?? new Date().toISOString().slice(0, 10))
      // 指定项目（修复#1）：留空 = 按岗位 + 层级批量下发
      const projectIds = Array.isArray(ctx.body.projectIds)
        ? (ctx.body.projectIds as string[]).filter((id) => db.projects.some((p) => p.id === id))
        : []
      const projectNames = projectIds
        .map((id) => db.projects.find((p) => p.id === id)?.name ?? '')
        .filter(Boolean)
      const created = classIds.map((classId, index) => {
        const target = db.classes.find((item) => item.id === classId)
        const position = db.positions.find((item) => item.id === positionId)
        return {
          id: `task-${Date.now().toString(36)}-${index}`,
          classId,
          className: target?.name ?? classId,
          group,
          positionId,
          positionName: position?.name ?? '全部岗位',
          tier,
          projectIds,
          projectNames,
          publishMode,
          publishAt,
          status: publishMode === 'scheduled' ? ('pending' as const) : ('published' as const),
        }
      })
      db.tasks = [...created, ...db.tasks]
      return created
    },
  },
  {
    method: 'delete',
    pattern: /^\/tasks\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.tasks = db.tasks.map((item) =>
        item.id === id ? { ...item, status: 'revoked' as const } : item,
      )
      return { ok: true }
    },
  },

  /* —— 数据导出 —— */
  {
    method: 'get',
    pattern: /^\/exports\/([^/]+)$/,
    handler: (ctx) => {
      const type = ctx.path.type ?? ''
      const card = exportCards.find((item) => item.id === `exp-${type}`)
      return { file: `${card?.name ?? type}-${new Date().toISOString().slice(0, 10)}.xlsx`, ok: true }
    },
  },

  /* —— 实训项目 —— */
  {
    method: 'get',
    pattern: /^\/projects$/,
    handler: (ctx) => {
      const tier = String(ctx.params.tier ?? '')
      const list = db.projects
        .filter((item) => (tier && tier !== 'all' ? item.tier === tier : true))
        .filter((item) => matchText(item.name + item.positionName, ctx.params.keyword))
      return pageOf(list, ctx.params)
    },
  },
  {
    method: 'get',
    pattern: /^\/projects\/([^/]+)$/,
    handler: (ctx) => db.projects.find((item) => item.id === ctx.path.id) ?? null,
  },
  {
    method: 'post',
    pattern: /^\/projects$/,
    handler: (ctx) => {
      // 修复#3：同层级不允许重名（服务端兜底，前端已先行校验）
      const incomingName = String(ctx.body.name ?? '').trim()
      const incomingTier = (ctx.body.tier ?? 'basic') as (typeof db.projects)[number]['tier']
      if (db.projects.some((item) => item.name.trim() === incomingName && item.tier === incomingTier)) {
        throw new Error(`同层级已存在同名项目「${incomingName}」，请修改名称或更换层级`)
      }
      const positionId = String(ctx.body.positionId ?? '')
      const position = db.positions.find((item) => item.id === positionId)
      const created = {
        id: `prj-${Date.now().toString(36)}`,
        name: String(ctx.body.name ?? ''),
        tier: (ctx.body.tier ?? 'basic') as (typeof db.projects)[number]['tier'],
        difficulty: Number(ctx.body.difficulty ?? 1),
        positionId,
        positionName: position?.name ?? '未绑定岗位',
        // 修复#2：新建项目一律落为「待发布」，发布对象 / 发布方式 / 发布时间为空，
        // 必须由教师在列表操作列显式执行「发布」后才变为「已发布」。
        status: 'pending' as const,
        publishMode: (ctx.body.publishMode ?? 'immediate') as (typeof db.projects)[number]['publishMode'],
        publishTarget: '--',
        publishAt: '--',
        description: String(ctx.body.description ?? ''),
        modules: (ctx.body.modules ?? []) as (typeof db.projects)[number]['modules'],
        skillTagIds: (ctx.body.skillTagIds ?? []) as string[],
        knowledgePoints: (ctx.body.knowledgePoints ?? []) as string[],
        materials: (ctx.body.materials ?? []) as (typeof db.projects)[number]['materials'],
        scoreStandard: (ctx.body.scoreStandard ?? []) as (typeof db.projects)[number]['scoreStandard'],
        imports: (ctx.body.imports ?? []) as (typeof db.projects)[number]['imports'],
        createdAt: new Date().toISOString().slice(0, 10),
      }
      db.projects = [created, ...db.projects]
      return created
    },
  },
  {
    method: 'put',
    pattern: /^\/projects\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.projects.find((item) => item.id === id)
      if (!current) return null
      // 修复#3：同层级不允许重名（排除自身）
      const nextName = String(ctx.body.name ?? current.name).trim()
      const nextTier = (ctx.body.tier ?? current.tier) as typeof current.tier
      if (
        db.projects.some(
          (item) => item.id !== id && item.name.trim() === nextName && item.tier === nextTier,
        )
      ) {
        throw new Error(`同层级已存在同名项目「${nextName}」，请修改名称或更换层级`)
      }
      const positionId = String(ctx.body.positionId ?? current.positionId)
      const position = db.positions.find((item) => item.id === positionId)
      const updated = {
        ...current,
        name: String(ctx.body.name ?? current.name),
        tier: (ctx.body.tier ?? current.tier) as typeof current.tier,
        difficulty: Number(ctx.body.difficulty ?? current.difficulty),
        positionId,
        positionName: position?.name ?? current.positionName,
        description: String(ctx.body.description ?? current.description),
        modules: (ctx.body.modules ?? current.modules) as typeof current.modules,
        skillTagIds: (ctx.body.skillTagIds ?? current.skillTagIds) as string[],
        knowledgePoints: (ctx.body.knowledgePoints ?? current.knowledgePoints) as string[],
      }
      db.projects = db.projects.map((item) => (item.id === id ? updated : item))
      return updated
    },
  },
  {
    method: 'put',
    pattern: /^\/projects\/([^/]+)\/publish$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.projects.find((item) => item.id === id)
      if (!current) return null
      const mode = (ctx.body.publishMode ?? 'immediate') as typeof current.publishMode
      const target = String(ctx.body.publishTarget ?? '全部班级')
      const at = String(ctx.body.publishAt ?? new Date().toISOString().slice(0, 16).replace('T', ' '))
      const updated = {
        ...current,
        publishMode: mode,
        publishTarget: target,
        publishAt: at,
        status: mode === 'scheduled' ? ('pending' as const) : ('published' as const),
      }
      db.projects = db.projects.map((item) => (item.id === id ? updated : item))
      return updated
    },
  },
  {
    method: 'put',
    pattern: /^\/projects\/([^/]+)\/offline$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.projects = db.projects.map((item) =>
        item.id === id ? { ...item, status: 'offline' as const, publishTarget: '--', publishAt: '--' } : item,
      )
      return { ok: true }
    },
  },
  {
    method: 'post',
    pattern: /^\/projects\/batch-offline$/,
    handler: (ctx) => {
      const ids = Array.isArray(ctx.body.ids) ? (ctx.body.ids as string[]) : []
      db.projects = db.projects.map((item) =>
        ids.includes(item.id)
          ? { ...item, status: 'offline' as const, publishTarget: '--', publishAt: '--' }
          : item,
      )
      return { ok: true, count: ids.length }
    },
  },
  {
    method: 'get',
    pattern: /^\/projects\/([^/]+)\/modules$/,
    handler: (ctx) => db.projects.find((item) => item.id === ctx.path.id)?.modules ?? [],
  },
  {
    method: 'put',
    pattern: /^\/projects\/([^/]+)\/modules$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const modules = (ctx.body.modules ?? []) as (typeof db.projects)[number]['modules']
      db.projects = db.projects.map((item) => (item.id === id ? { ...item, modules } : item))
      return modules
    },
  },
  {
    method: 'post',
    pattern: /^\/projects\/([^/]+)\/students$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const imports = (ctx.body.imports ?? []) as (typeof db.projects)[number]['imports']
      db.projects = db.projects.map((item) =>
        item.id === id ? { ...item, imports: [...item.imports, ...imports] } : item,
      )
      return { ok: true, imported: imports.length }
    },
  },
  {
    method: 'get',
    pattern: /^\/publish-records$/,
    handler: (ctx) => {
      const status = String(ctx.params.status ?? '')
      // 与项目列表同源派生，避免两处数据对不上
      const list = db.projects
        .filter((item) => item.status !== 'offline')
        .map((item) => ({
          id: `pub-${item.id}`,
          projectId: item.id,
          projectName: item.name,
          tier: item.tier,
          difficulty: item.difficulty,
          publishMode: item.publishMode,
          publishTarget: item.publishTarget,
          publishAt: item.publishAt,
          status: item.status,
        }))
        .filter((item) => (status ? item.status === status : true))
      return pageOf(list, ctx.params)
    },
  },
  {
    method: 'delete',
    pattern: /^\/projects\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.projects = db.projects.filter((item) => item.id !== id)
      return { ok: true }
    },
  },

  /* —— 岗位与技能 —— */
  {
    method: 'get',
    pattern: /^\/positions$/,
    handler: (ctx) => {
      const level = String(ctx.params.level ?? '')
      const list = db.positions
        .filter((item) => (level && level !== 'all' ? item.level === level : true))
        .filter((item) => matchText(item.name + item.scenario, ctx.params.keyword))
      return pageOf(list, ctx.params)
    },
  },
  {
    method: 'post',
    pattern: /^\/positions$/,
    handler: (ctx) => {
      const created = {
        id: `pos-${Date.now().toString(36)}`,
        name: String(ctx.body.name ?? ''),
        level: (ctx.body.level ?? 'basic') as (typeof db.positions)[number]['level'],
        scenario: String(ctx.body.scenario ?? ''),
        enabled: ctx.body.enabled !== false,
        summary: String(ctx.body.summary ?? ''),
        skillTagIds: (ctx.body.skillTagIds ?? []) as string[],
        studentCount: 0,
      }
      db.positions = [created, ...db.positions]
      return created
    },
  },
  {
    method: 'put',
    pattern: /^\/positions\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.positions.find((item) => item.id === id)
      if (!current) return null
      const updated = {
        ...current,
        name: String(ctx.body.name ?? current.name),
        level: (ctx.body.level ?? current.level) as typeof current.level,
        scenario: String(ctx.body.scenario ?? current.scenario),
        enabled: ctx.body.enabled === undefined ? current.enabled : Boolean(ctx.body.enabled),
        summary: String(ctx.body.summary ?? current.summary),
        skillTagIds: (ctx.body.skillTagIds ?? current.skillTagIds) as string[],
      }
      db.positions = db.positions.map((item) => (item.id === id ? updated : item))
      return updated
    },
  },
  {
    method: 'delete',
    pattern: /^\/positions\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.positions = db.positions.filter((item) => item.id !== id)
      return { ok: true }
    },
  },
  { method: 'get', pattern: /^\/skill-systems$/, handler: () => skillSystems },
  {
    method: 'get',
    pattern: /^\/skill-tags$/,
    handler: (ctx) => {
      const systemId = String(ctx.params.systemId ?? '')
      return db.skillTags
        .filter((item) => (systemId ? item.systemId === systemId : true))
        .filter((item) => matchText(item.name, ctx.params.keyword))
    },
  },
  {
    method: 'post',
    pattern: /^\/skill-tags$/,
    handler: (ctx) => {
      const name = String(ctx.body.name ?? '').trim()
      // 同名标签直接复用，避免技能库里出现重复项
      const existed = db.skillTags.find((item) => item.name === name)
      if (existed) return existed

      const created = {
        id: `sk-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e3).toString(36)}`,
        name,
        systemId: String(ctx.body.systemId ?? 'optical') as SkillSystemId,
        level: (ctx.body.level ?? 'basic') as ProjectTier,
        passScore: Number(ctx.body.passScore ?? 80),
        // 点亮所需达标次数至少为 1
        requiredHits: Math.max(1, Number(ctx.body.requiredHits ?? 1)),
        description: String(ctx.body.description ?? ''),
        enabled: ctx.body.enabled !== false,
      } as (typeof db.skillTags)[number]
      db.skillTags = [...db.skillTags, created]
      return created
    },
  },
  {
    // 技能管理：编辑技能点（名称 / 体系 / 层级 / 点亮口径 / 停启用）
    method: 'put',
    pattern: /^\/skill-tags\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.skillTags.find((item) => item.id === id)
      if (!current) return null

      const nextName = String(ctx.body.name ?? current.name).trim()
      if (db.skillTags.some((item) => item.id !== id && item.name.trim() === nextName)) {
        throw new Error(`技能库中已存在同名技能点「${nextName}」`)
      }

      const updated = {
        ...current,
        name: nextName,
        systemId: String(ctx.body.systemId ?? current.systemId) as SkillSystemId,
        level: (ctx.body.level ?? current.level ?? 'basic') as ProjectTier,
        passScore: Number(ctx.body.passScore ?? current.passScore ?? 80),
        requiredHits: Math.max(1, Number(ctx.body.requiredHits ?? current.requiredHits ?? 1)),
        description: String(ctx.body.description ?? current.description ?? ''),
        enabled: ctx.body.enabled !== false,
      } as (typeof db.skillTags)[number]
      db.skillTags = db.skillTags.map((item) => (item.id === id ? updated : item))
      return updated
    },
  },
  {
    // 技能管理：删除技能点。被岗位或项目引用时不允许删除（与「岗位删除」口径一致）
    method: 'delete',
    pattern: /^\/skill-tags\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.skillTags.find((item) => item.id === id)
      if (!current) return null

      const byPositions = db.positions.filter((item) => item.skillTagIds.includes(id))
      const byProjects = db.projects.filter((item) => item.skillTagIds.includes(id))
      if (byPositions.length > 0 || byProjects.length > 0) {
        throw new Error(
          `「${current.name}」已被 ${byPositions.length} 个岗位、${byProjects.length} 个项目引用，请先解除关联`,
        )
      }

      db.skillTags = db.skillTags.filter((item) => item.id !== id)
      return { ok: true as const }
    },
  },
  {
    method: 'get',
    pattern: /^\/growth-rules$/,
    handler: () => db.growthRules,
  },
  {
    method: 'get',
    pattern: /^\/students$/,
    handler: () =>
      db.students.map((item) => ({
        id: item.id,
        studentNo: item.studentNo,
        name: item.name,
        className: item.className,
        group: item.group,
        positionId: item.positionId,
        positionName: item.positionName,
        skillRate: item.skillRate,
        projectRate: item.projectRate,
        // 平均分以审核记录为准（修复#8）
        avgScore: avgScoreOf(item),
      })),
  },
  {
    method: 'put',
    pattern: /^\/growth-rules$/,
    handler: (ctx) => {
      const incoming = Array.isArray(ctx.body.rules) ? (ctx.body.rules as typeof db.growthRules) : []
      db.growthRules = db.growthRules.map((rule) => incoming.find((item) => item.tier === rule.tier) ?? rule)
      return db.growthRules
    },
  },

  /* —— 实训结果审核 —— */
  {
    method: 'get',
    pattern: /^\/reviews$/,
    handler: (ctx) => {
      const status = String(ctx.params.status ?? 'all')
      // 修复#22：支持按班级筛选（教师默认只关心自己负责的班级）
      const classId = String(ctx.params.classId ?? 'all')
      const className =
        classId === 'all' ? null : (db.classes.find((item) => item.id === classId)?.name ?? null)
      const list = db.reviews
        .filter((item) => (status && status !== 'all' ? item.status === status : true))
        .filter((item) => (className ? item.className === className : true))
        .filter((item) => matchText(item.studentName + item.projectName, ctx.params.keyword))
        .slice()
        // 默认排序：待审核 > 已驳回 > 已通过，同状态按提交时间倒序；标星置顶
        .sort((a, b) => {
          if (a.starred !== b.starred) return a.starred ? -1 : 1
          // 排序：待审核 > 已驳回 > 已复核 > 已通过（修复#4 新增「已复核」）
          const rank: Record<string, number> = { pending: 0, rejected: 1, rechecked: 2, approved: 3 }
          const diff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
          if (diff !== 0) return diff
          return b.submittedAt.localeCompare(a.submittedAt)
        })
      return pageOf(list, ctx.params)
    },
  },
  {
    method: 'get',
    pattern: /^\/reviews\/([^/]+)$/,
    handler: (ctx) => db.reviews.find((item) => item.id === ctx.path.id) ?? null,
  },
  {
    method: 'put',
    pattern: /^\/reviews\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.reviews.find((item) => item.id === id)
      if (!current) return null

      const nextModuleScores = (ctx.body.moduleScores ?? current.moduleScores) as typeof current.moduleScores
      const fingerprint = (list: typeof current.moduleScores) =>
        JSON.stringify(list.map((item) => [item.moduleId, item.score, item.comment]))
      const scoresChanged = fingerprint(nextModuleScores) !== fingerprint(current.moduleScores)
      const nextScore = ctx.body.score === undefined ? current.score : Number(ctx.body.score)

      // 修复#4 / #5：教师改动模块分并保存 → 状态由「已通过」流转为「已复核」，
      // 同时记录复核人与复核时间；AI 原分 aiTotalScore 始终保留，不被覆盖。
      const reviewing =
        scoresChanged && (current.status === 'approved' || current.status === 'rechecked')

      const updated = {
        ...current,
        status: reviewing
          ? ('rechecked' as const)
          : ((ctx.body.status ?? current.status) as typeof current.status),
        moduleScores: nextModuleScores,
        feedback: String(ctx.body.feedback ?? current.feedback),
        score: nextScore,
        rejectReason:
          ctx.body.rejectReason === undefined
            ? current.rejectReason
            : String(ctx.body.rejectReason),
        starred: ctx.body.starred === undefined ? current.starred : Boolean(ctx.body.starred),
        recheck: reviewing
          ? {
              ...current.recheck,
              draftSaved: false,
              recheckScore: nextScore,
              reviewedBy: teacherProfile.name,
              reviewedAt: stamp(),
            }
          : current.recheck,
      }
      db.reviews = db.reviews.map((item) => (item.id === id ? updated : item))
      return updated
    },
  },
  {
    method: 'post',
    pattern: /^\/reviews\/([^/]+)\/star$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.reviews = db.reviews.map((item) => (item.id === id ? { ...item, starred: !item.starred } : item))
      return db.reviews.find((item) => item.id === id) ?? null
    },
  },
  {
    method: 'post',
    pattern: /^\/reviews\/batch-review$/,
    handler: (ctx) => {
      const ids = Array.isArray(ctx.body.ids) ? (ctx.body.ids as string[]) : []
      const status = (ctx.body.status ?? 'approved') as 'approved' | 'rejected'
      const rejectReason = String(ctx.body.rejectReason ?? '')
      db.reviews = db.reviews.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              status,
              rejectReason:
                status === 'rejected' ? rejectReason || item.rejectReason : undefined,
            }
          : item,
      )
      return { ok: true, count: ids.length }
    },
  },

  /* —— 数据总览 / 学习过程统计 —— */
  {
    method: 'get',
    pattern: /^\/stats\/overview$/,
    handler: (ctx) => {
      // 修复#6：指标与图表全部按当前 Mock 数据实时派生（新建项目后总数立即变化）
      const tier = String(ctx.params.tier ?? 'all')
      const classId = String(ctx.params.classId ?? 'all')
      const className =
        classId === 'all' ? null : (db.classes.find((item) => item.id === classId)?.name ?? null)

      const scopeStudents = db.students.filter((item) => !className || item.className === className)
      const denominator = Math.max(1, scopeStudents.length)
      const scopedProjects = db.projects.filter((item) => tier === 'all' || item.tier === tier)

      const rateOf = (projectId: string) =>
        Math.round(
          (scopeStudents.filter((s) => s.doneProjectIds.includes(projectId)).length / denominator) * 100,
        )

      const byTier = (value: string) => db.projects.filter((item) => item.tier === value).length
      const avgOnline =
        scopeStudents.length > 0
          ? (scopeStudents.reduce((sum, item) => sum + item.onlineHours, 0) / scopeStudents.length).toFixed(1)
          : '0.0'

      const shortName = (name: string) => (name.length > 6 ? `${name.slice(0, 6)}…` : name)

      return {
        metrics: [
          { key: 'total', label: '实训项目总数', value: String(db.projects.length), tone: 'brand' },
          { key: 'basic', label: '基础实训项目', value: String(byTier('basic')), tone: 'brand' },
          { key: 'advanced', label: '进阶实训项目', value: String(byTier('advanced')), tone: 'orange' },
          { key: 'extended', label: '拓展实训项目', value: String(byTier('extended')), tone: 'violet' },
          { key: 'time', label: '平均在线时长', value: `${avgOnline}h`, tone: 'ok' },
          // 修复#6：在读学生随班级筛选变化（此前误用了全局人数）
          { key: 'students', label: '在读学生', value: String(scopeStudents.length), tone: 'danger' },
        ],
        completionRank: scopedProjects.map((item) => ({
          shortName: shortName(item.name),
          projectName: item.name,
          rate: rateOf(item.id),
        })),
        positionHeat: db.positions
          .map((item) => ({
            name: item.name,
            value: db.students.filter((s) => s.positionId === item.id).length,
          }))
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value),
        warnings: scopedProjects
          .map((item) => {
            const done = scopeStudents.filter((s) => s.doneProjectIds.includes(item.id))
            return {
              id: item.id,
              projectName: item.name,
              rate: rateOf(item.id),
              avgScore:
                done.length > 0
                  ? Math.round(done.reduce((sum, s) => sum + avgScoreOf(s), 0) / done.length)
                  : null,
              advice: rateOf(item.id) < 40 ? '建议增加辅导课时' : '建议降低难度或增加示例',
            }
          })
          .filter((item) => item.rate < 60)
          .sort((a, b) => a.rate - b.rate),
      }
    },
  },
  {
    method: 'get',
    pattern: /^\/stats\/learning$/,
    handler: (ctx) => {
      const classId = String(ctx.params.classId ?? 'all')
      const className =
        classId === 'all' ? null : (db.classes.find((item) => item.id === classId)?.name ?? null)
      const scope = db.students
        .filter((item) => !className || item.className === className)
        .filter((item) => matchText(item.name + item.className, ctx.params.keyword))

      // 进度分布按「已完成项目 / 项目总数」实时分桶（修复#6）
      const total = Math.max(1, db.projects.length)
      const bucketDefs = [
        { label: '0-20%', min: 0, max: 20 },
        { label: '20-40%', min: 20, max: 40 },
        { label: '40-60%', min: 40, max: 60 },
        { label: '60-80%', min: 60, max: 80 },
        { label: '80-100%', min: 80, max: 101 },
      ]
      const buckets = bucketDefs.map((def) => ({
        label: def.label,
        count: scope.filter((item) => {
          const percent = (item.doneProjectIds.length / total) * 100
          return percent >= def.min && percent < def.max
        }).length,
      }))

      return {
        progressBuckets: buckets,
        dailyOnline,
        // 修复#21：返回全部匹配学生，分页由前端统一处理
        // （此前这里先按 10 条分页，前端又做客户端分页，导致只能看到前 10 名学生）
        students: scope.map((item) => ({
          id: item.id,
          name: item.name,
          className: item.className,
          positionName: item.positionName,
          finishedProjects: item.doneProjectIds.length,
          totalProjects: db.projects.length,
          // 平均分与审核列表同源（修复#8）
          avgScore: avgScoreOf(item),
          onlineHours: item.onlineHours,
          skillProgress: item.skillRate,
        })),
      }
    },
  },
  {
    // 单次任务的完成情况（修复#7）
    method: 'get',
    pattern: /^\/stats\/task\/([^/]+)$/,
    handler: (ctx) => {
      const task = db.tasks.find((item) => item.id === ctx.path.id)
      if (!task) return null

      // 任务覆盖的项目：优先用显式指定的项目，否则按「岗位 + 层级」筛选
      const covered = db.projects.filter((item) => {
        if (task.projectIds.length > 0) return task.projectIds.includes(item.id)
        const byPosition = task.positionId === 'all' || item.positionId === task.positionId
        const byTier = task.tier === 'all' || item.tier === task.tier
        return byPosition && byTier
      })

      const members = db.students.filter(
        (item) =>
          item.className === task.className &&
          (task.group === '全班' || item.group === task.group),
      )

      const totalProjects = Math.max(1, covered.length)
      const students = members.map((item) => {
        const finished = covered.filter((p) => item.doneProjectIds.includes(p.id)).length
        return {
          id: item.id,
          name: item.name,
          group: item.group,
          done: finished >= totalProjects,
          finished,
          total: covered.length,
        }
      })
      const doneCount = students.filter((item) => item.done).length

      return {
        taskId: task.id,
        className: task.className,
        group: task.group,
        positionName: task.positionName,
        projectNames: covered.map((item) => item.name),
        studentTotal: students.length,
        doneCount,
        undoneCount: students.length - doneCount,
        students,
      }
    },
  },

  /* —— 企业认证证书 —— */
  {
    method: 'get',
    pattern: /^\/cert-rules$/,
    handler: () => db.certificateRules,
  },
  {
    method: 'post',
    pattern: /^\/cert-rules$/,
    handler: (ctx) => {
      const positionId = String(ctx.body.positionId ?? '')
      const position = db.positions.find((item) => item.id === positionId)
      const created = {
        id: `rule-${Date.now().toString(36)}`,
        positionId,
        positionName: position?.name ?? '未选择岗位',
        name: String(ctx.body.name ?? ''),
        swatch: '#1677FF',
        minSkillRate: Number(ctx.body.minSkillRate ?? 0),
        minProjectRate: Number(ctx.body.minProjectRate ?? 0),
        minAvgScore: Number(ctx.body.minAvgScore ?? 0),
        basicProjectRule: String(ctx.body.basicProjectRule ?? '全部通关'),
        advancedProjectRule: String(ctx.body.advancedProjectRule ?? '至少一项'),
        validMonths: Number(ctx.body.validMonths ?? 12),
        active: true,
      }
      db.certificateRules = [created, ...db.certificateRules]
      return created
    },
  },
  {
    method: 'put',
    pattern: /^\/cert-rules\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.certificateRules.find((item) => item.id === id)
      if (!current) return null
      const positionId = String(ctx.body.positionId ?? current.positionId)
      const position = db.positions.find((item) => item.id === positionId)
      const updated = {
        ...current,
        positionId,
        positionName: position?.name ?? current.positionName,
        name: String(ctx.body.name ?? current.name),
        minSkillRate: Number(ctx.body.minSkillRate ?? current.minSkillRate),
        minProjectRate: Number(ctx.body.minProjectRate ?? current.minProjectRate),
        minAvgScore: Number(ctx.body.minAvgScore ?? current.minAvgScore),
        basicProjectRule: String(ctx.body.basicProjectRule ?? current.basicProjectRule),
        advancedProjectRule: String(ctx.body.advancedProjectRule ?? current.advancedProjectRule),
        validMonths: Number(ctx.body.validMonths ?? current.validMonths),
      }
      db.certificateRules = db.certificateRules.map((item) => (item.id === id ? updated : item))
      return updated
    },
  },
  {
    method: 'delete',
    pattern: /^\/cert-rules\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.certificateRules = db.certificateRules.filter((item) => item.id !== id)
      return { ok: true }
    },
  },
  {
    method: 'get',
    pattern: /^\/cert-applications$/,
    handler: (ctx) => {
      const status = String(ctx.params.status ?? 'all')
      const list = db.certificateApplications
        .filter((item) => (status && status !== 'all' ? item.status === status : true))
        .filter((item) => matchText(item.studentName + item.positionName, ctx.params.keyword))
      return pageOf(list, ctx.params)
    },
  },
  {
    method: 'put',
    pattern: /^\/cert-applications\/([^/]+)$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const current = db.certificateApplications.find((item) => item.id === id)
      if (!current) return null
      const updated = {
        ...current,
        status: (ctx.body.status ?? current.status) as typeof current.status,
        rejectReason: ctx.body.rejectReason === undefined ? current.rejectReason : String(ctx.body.rejectReason),
      }
      db.certificateApplications = db.certificateApplications.map((item) => (item.id === id ? updated : item))
      return updated
    },
  },
  {
    method: 'post',
    pattern: /^\/cert-applications\/batch-approve$/,
    handler: (ctx) => {
      const ids = Array.isArray(ctx.body.ids) ? (ctx.body.ids as string[]) : []
      db.certificateApplications = db.certificateApplications.map((item) =>
        ids.includes(item.id) ? { ...item, status: 'approved' as const } : item,
      )
      return { ok: true, count: ids.length }
    },
  },
  {
    method: 'get',
    pattern: /^\/certificates$/,
    handler: (ctx) => {
      const list = db.certificates.filter((item) =>
        matchText(item.studentName + item.certNo, ctx.params.keyword),
      )
      return pageOf(list, ctx.params)
    },
  },
  {
    method: 'post',
    pattern: /^\/certificates$/,
    handler: (ctx) => {
      const certNo = String(ctx.body.certNo ?? '')
      const positionId = String(ctx.body.positionId ?? '')
      const position = db.positions.find((item) => item.id === positionId)
      const studentName = String(ctx.body.studentName ?? '')
      // 班级随所选学生联动读取真实班级（修复#11），调用方传入优先
      const roster = db.students.find((item) => item.name === studentName)
      const className = String(ctx.body.className ?? '') || roster?.className || ''

      // 有效期按该岗位在「证书规则配置」里设置的月数计算（修复#9），不再写死 +1 年
      const rule = db.certificateRules.find((item) => item.positionId === positionId)
      const months = rule?.validMonths ?? 12
      const issued = new Date()
      const validUntil = new Date(issued)
      validUntil.setMonth(validUntil.getMonth() + months)
      const toDay = (date: Date) => date.toISOString().slice(0, 10)

      const created = {
        id: `cert-${Date.now().toString(36)}`,
        studentName,
        className,
        positionId,
        positionName: position?.name ?? '',
        certNo,
        issuedAt: toDay(issued),
        validUntil: toDay(validUntil),
        status: 'valid' as const,
        issuer: String(ctx.body.issuer ?? ''),
      }
      db.certificates = [created, ...db.certificates]
      return created
    },
  },
  {
    method: 'put',
    pattern: /^\/certificates\/([^/]+)\/revoke$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      db.certificates = db.certificates.map((item) =>
        item.id === id ? { ...item, status: 'revoked' as const, validUntil: '--' } : item,
      )
      return db.certificates.find((item) => item.id === id) ?? null
    },
  },
  {
    method: 'put',
    pattern: /^\/certificates\/([^/]+)\/reissue$/,
    handler: (ctx) => {
      const id = ctx.path.id ?? ''
      const next = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      db.certificates = db.certificates.map((item) =>
        item.id === id
          ? { ...item, status: 'valid' as const, validUntil: next, issuedAt: new Date().toISOString().slice(0, 10) }
          : item,
      )
      return db.certificates.find((item) => item.id === id) ?? null
    },
  },
  {
    method: 'get',
    pattern: /^\/certificates\/ledger$/,
    handler: (ctx) => {
      const positionId = String(ctx.params.positionId ?? '')
      const list = db.certificates
        .filter((item) => (positionId && positionId !== 'all' ? item.positionId === positionId : true))
        .filter((item) => matchText(item.studentName + item.certNo, ctx.params.keyword))
      return pageOf(list, ctx.params)
    },
  },

  /* —— AI 能力预留 —— */
  {
    method: 'post',
    pattern: /^\/ai\/(defense|interview)$/,
    handler: () => ({ available: false, message: 'AI 答辩 / AI 面试接口为二期能力，一期仅保留接口占位。' }),
  },
]

/* -------------------------------------------------------------------------- */
/* 适配器实现                                                                  */
/* -------------------------------------------------------------------------- */

function buildResponse(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    headers: new AxiosHeaders(),
    config,
  }
}

export const mockAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  const rawUrl = config.url ?? ''
  const url = rawUrl.split('?')[0] ?? ''
  const params = (config.params ?? {}) as Record<string, unknown>
  const body = parseBody(config.data)

  // 模拟网络往返，让骨架屏 / loading 真实可见
  await wait(120 + Math.random() * 260)

  const route = routes.find((item) => item.method === method && item.pattern.test(url))
  if (!route) {
    throw new AxiosError(`Mock 未实现该接口：${method.toUpperCase()} ${url}`, '404', config)
  }

  if (route.auth !== false && !getToken()) {
    throw new AxiosError('登录状态已失效，请重新登录', '401', config, null, buildResponse(config, null, 401))
  }

  const matched = route.pattern.exec(url)
  const path: Record<string, string> = {}
  if (matched) {
    // 具名捕获优先（如 /ai/:kind 未具名时忽略）
    for (let index = 1; index < matched.length; index += 1) {
      path[`p${index}`] = matched[index] ?? ''
    }
  }
  // 单资源路由统一暴露为 path.id：/classes/:id、/projects/:id …
  if (!path.id && path.p1 && /^[^/]+$/.test(path.p1)) path.id = path.p1
  path.type = path.p1 ?? ''
  path.kind = path.p1 ?? ''

  const result = route.handler({ params, body, path, method, url })
  if (result === null) {
    throw new AxiosError(`未找到资源：${url}`, '404', config, null, buildResponse(config, null, 404))
  }
  return buildResponse(config, result)
}
