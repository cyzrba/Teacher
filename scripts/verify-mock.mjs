/**
 * 第一批修复的数据层验收脚本。
 * 用 Vite 的 SSR 能力在 Node 里加载 Mock 服务端，直接调用其适配器，
 * 验证：任务指定项目、复核状态与留痕、新建项目待发布、证书有效期/班级/达标。
 */
import { createServer } from 'vite'

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  logLevel: 'error',
  appType: 'custom',
})

// —— 浏览器全局垫片（Mock 层依赖 window.setTimeout 与 localStorage） ——
const store = new Map([['teacher.token', 'test-token']])
globalThis.window = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  location: { pathname: '/', search: '', assign() {} },
}

const { mockAdapter } = await server.ssrLoadModule('/src/mock/server.ts')

async function call(method, url, options = {}) {
  const response = await mockAdapter({
    method,
    url,
    params: options.params,
    data: options.data ? JSON.stringify(options.data) : undefined,
    headers: {},
  })
  return response.data
}

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${name}\n   ${detail}`)
}

/* ---------- 1) 问题1：任务下发支持指定项目 ---------- */
const projects = await call('get', '/projects', { params: { pageSize: 100 } })
const pcb = projects.list.find((p) => p.name === 'PCB板缺陷检测' && p.positionId === 'pos-defect')
  ?? projects.list.find((p) => p.name === 'PCB板缺陷检测')

const created = await call('post', '/tasks', {
  data: {
    classIds: ['cls-2102'],
    group: 'B组',
    positionId: pcb.positionId,
    tier: pcb.tier,
    projectIds: [pcb.id],
    publishMode: 'scheduled',
    publishAt: '2026-09-20 08:00',
  },
})
const newTask = created[0]
check(
  '#1 任务可指定项目',
  newTask.projectIds.length === 1 && newTask.projectNames[0] === pcb.name,
  `新建任务 projectIds=${JSON.stringify(newTask.projectIds)} projectNames=${JSON.stringify(newTask.projectNames)}`,
)

/* ---------- 2) 问题4/5：复核状态流转 + AI 原分保留 + 留痕 ---------- */
const before = await call('get', '/reviews/rev-001')
const changedModules = before.moduleScores.map((m, i) =>
  i === 0 ? { ...m, score: 15, comment: '复核意见：方案对比依据不足' } : { ...m },
)
const updated = await call('put', '/reviews/rev-001', {
  data: { moduleScores: changedModules, score: 89 },
})
check(
  '#4 复核后状态流转为「已复核」',
  updated.status === 'rechecked' && before.status === 'approved',
  `复核前 status=${before.status} → 复核后 status=${updated.status}`,
)
check(
  '#5 AI 原分保留、复核分单独记录、有复核人与时间',
  updated.aiTotalScore === 92 &&
    updated.score === 89 &&
    Boolean(updated.recheck.reviewedBy) &&
    Boolean(updated.recheck.reviewedAt),
  `AI原分=${updated.aiTotalScore} 当前分=${updated.score} 复核人=${updated.recheck.reviewedBy} 复核时间=${updated.recheck.reviewedAt}`,
)

/* ---------- 3) 问题2：新建项目默认「待发布」 ---------- */
const createdProject = await call('post', '/projects', {
  data: {
    name: '验收用-新建项目',
    tier: 'basic',
    difficulty: 2,
    positionId: 'pos-defect',
    description: '验收脚本创建',
    modules: [],
    skillTagIds: [],
    knowledgePoints: [],
    materials: [],
    scoreStandard: [],
  },
})
check(
  '#2 新建项目默认待发布且发布信息为空',
  createdProject.status === 'pending' &&
    createdProject.publishTarget === '--' &&
    createdProject.publishAt === '--',
  `status=${createdProject.status} 发布对象=${createdProject.publishTarget} 发布时间=${createdProject.publishAt}`,
)

/* ---------- 4) 问题9/11/12：证书有效期 / 班级 / 达标 ---------- */
const rules = await call('get', '/cert-rules')
const defectRule = rules.find((r) => r.positionId === 'pos-defect')
const certificates = await call('post', '/certificates', {
  data: {
    studentName: '刘芳',
    positionId: 'pos-defect',
    certNo: 'SM-2024-VI-00019',
    issuer: '深圳思谋信息科技有限公司',
  },
})
const expectedYear = new Date()
expectedYear.setMonth(expectedYear.getMonth() + (defectRule?.validMonths ?? 12))
const expected = expectedYear.toISOString().slice(0, 10)
check(
  '#9 证书有效期按证书规则月数计算',
  certificates.validUntil === expected && defectRule.validMonths === 36,
  `规则有效期=${defectRule?.validMonths} 个月，生成有效期至=${certificates.validUntil}（期望 ${expected}）`,
)
check(
  '#11 证书班级随学生联动',
  certificates.className === '21级3班',
  `刘芳的证书班级=${certificates.className}（期望 21级3班）`,
)

const roster = await call('get', '/students')
const liufang = roster.find((s) => s.name === '刘芳')
const unmet = []
if (liufang.skillRate < defectRule.minSkillRate) unmet.push(`技能点亮率 ${liufang.skillRate}% < ${defectRule.minSkillRate}%`)
if (liufang.projectRate < defectRule.minProjectRate) unmet.push(`项目完成率 ${liufang.projectRate}% < ${defectRule.minProjectRate}%`)
if (liufang.avgScore < defectRule.minAvgScore) unmet.push(`平均分 ${liufang.avgScore} < ${defectRule.minAvgScore}`)
check(
  '#12 不达标可被识别（前端据此弹二次确认）',
  unmet.length > 0,
  unmet.length > 0 ? `未达标项：${unmet.join('；')}` : '该学生完全达标（未触发校验场景）',
)

/* ---------- 5) 问题6/7：数据总览实时 + 任务完成情况 ---------- */
const overview = await call('get', '/stats/overview')
check(
  '#6 数据总览指标随数据实时变化',
  overview.metrics[0].value === String(projects.total + 1),
  `新建项目前总数=${projects.total}，新建 1 个后总览显示=${overview.metrics[0].value}`,
)

const completion = await call('get', `/stats/task/${newTask.id}`)
check(
  '#7 可按单次任务查看完成情况',
  completion !== null && completion.projectNames.length > 0 && completion.studentTotal > 0,
  `任务内容=${JSON.stringify(completion?.projectNames)} 应完成人数=${completion?.studentTotal} 已完成=${completion?.doneCount} 未完成=${completion?.undoneCount}`,
)

/* ---------- 6) 班级/分组人数由名册派生（问题14 的数据基础） ---------- */
const classes = await call('get', '/classes')
const c2 = classes.list.find((c) => c.name === '21级2班')
const members = await call('get', `/classes/${c2.id}/students`)
const groupSum = c2.groups.reduce((sum, g) => sum + g.studentCount, 0)
check(
  '#14 班级人数与分组人数据名册派生',
  c2.studentCount === members.length && groupSum === c2.studentCount,
  `21级2班 人数=${c2.studentCount} 名单=${members.length} 分组人数合计=${groupSum} 分组=${c2.groups.map((g) => `${g.name}:${g.studentCount}`).join(' ')}`,
)

/* ---------- 7) 修复#3：同层级项目重名被阻止 ---------- */
let duplicateBlocked = false
let duplicateMessage = ''
try {
  await call('post', '/projects', {
    data: {
      name: pcb.name,
      tier: pcb.tier,
      difficulty: 2,
      positionId: 'pos-defect',
      modules: [],
      skillTagIds: [],
      knowledgePoints: [],
      materials: [],
      scoreStandard: [],
    },
  })
} catch (error) {
  duplicateBlocked = true
  duplicateMessage = error?.message ?? ''
}
check(
  '#3 同层级项目重名被阻止',
  duplicateBlocked,
  duplicateBlocked ? `服务端返回：${duplicateMessage}` : '未阻止，允许创建了同名同层级项目',
)

/* ---------- 8) 修复#6：数据总览支持按层级筛选 ---------- */
const basicOnly = await call('get', '/stats/overview', { params: { tier: 'basic' } })
const advancedOnly = await call('get', '/stats/overview', { params: { tier: 'advanced' } })
check(
  '#6 数据总览支持按层级筛选',
  basicOnly.completionRank.length > 0 &&
    basicOnly.completionRank.length !== advancedOnly.completionRank.length,
  `基础层级排行 ${basicOnly.completionRank.length} 项，进阶层级排行 ${advancedOnly.completionRank.length} 项`,
)

const classScoped = await call('get', '/stats/overview', { params: { classId: 'cls-2102' } })
const c2Count = String(c2.studentCount)
check(
  '#6 数据总览支持按班级筛选',
  classScoped.metrics.find((m) => m.key === 'students')?.value === c2Count,
  `筛选 21级2班 后「在读学生」=${classScoped.metrics.find((m) => m.key === 'students')?.value}（该班实际 ${c2Count} 人）`,
)

/* ---------- 9) 修复#13：批量导入真实写入名册 ---------- */
const beforeImport = (await call('get', '/classes')).list.find((c) => c.name === '21级3班')
const importResult = await call('post', `/classes/${beforeImport.id}/import`, {
  data: {
    students: [
      { name: '导入测试甲', studentNo: '20219901' },
      { name: '导入测试乙', studentNo: '20219902', group: 'B组' },
      { name: '导入测试甲', studentNo: '20219901' },
    ],
    defaultGroup: 'A组',
  },
})
const afterImport = (await call('get', '/classes')).list.find((c) => c.name === '21级3班')
check(
  '#13 批量导入真实写入并跳过重复',
  importResult.imported === 2 &&
    importResult.skipped === 1 &&
    afterImport.studentCount === beforeImport.studentCount + 2,
  `导入 ${importResult.imported} 名、跳过重复 ${importResult.skipped} 名；班级人数 ${beforeImport.studentCount} → ${afterImport.studentCount}`,
)

/* ---------- 10) 修复#15：岗位→项目反查数据可用 ---------- */
const defectProjects = projects.list.filter((p) => p.positionId === 'pos-defect')
check(
  '#15 岗位可反查已关联项目',
  defectProjects.length > 0,
  `缺陷检测工程师 已关联项目：${defectProjects.map((p) => p.name).join('、')}`,
)

/* ---------- 11) 修复#22：审核列表可按班级筛选 ---------- */
const reviewByClass = await call('get', '/reviews', { params: { classId: 'cls-2102', pageSize: 100 } })
const allSameClass = reviewByClass.list.every((item) => item.className === '21级2班')
const reviewAll = await call('get', '/reviews', { params: { pageSize: 100 } })
check(
  '#22 审核列表可按班级筛选',
  allSameClass && reviewByClass.total > 0 && reviewByClass.total < reviewAll.total,
  `21级2班 ${reviewByClass.total} 条 / 全部 ${reviewAll.total} 条，结果均为 21级2班：${allSameClass}`,
)

/* ---------- 12) 修复#20：已驳回记录可重新判定为通过 ---------- */
const rejected = await call('get', '/reviews/rev-006')
const reinstated = await call('put', '/reviews/rev-006', { data: { status: 'approved' } })
check(
  '#20 已驳回可重新判定为通过',
  rejected.status === 'rejected' && reinstated.status === 'approved',
  `原状态=${rejected.status} → 重新判定后=${reinstated.status}`,
)

/* ---------- 13) 修复#21：学习统计支持学生检索与班级筛选 ---------- */
const byKeyword = await call('get', '/stats/learning', { params: { keyword: '李明远' } })
const byClass = await call('get', '/stats/learning', { params: { classId: 'cls-2102' } })
const allLearning = await call('get', '/stats/learning')
const rosterTotal = (await call('get', '/students')).length
check(
  '#21 学习统计支持学生检索',
  byKeyword.students.length === 1 && byKeyword.students[0].name === '李明远',
  `搜索「李明远」返回 ${byKeyword.students.length} 条：${byKeyword.students.map((s) => s.name).join('、')}`,
)
check(
  '#21 学习统计支持班级筛选',
  byClass.students.length === 41 &&
    allLearning.students.length === rosterTotal &&
    allLearning.students.length > byClass.students.length,
  `21级2班 ${byClass.students.length} 人；未筛选返回 ${allLearning.students.length} 条，与名册总数 ${rosterTotal} 一致`,
)

/* ---------- 14) 技能管理：技能点增删改与引用保护 ---------- */
const tagsBefore = await call('get', '/skill-tags')
const createdTag = await call('post', '/skill-tags', {
  data: {
    name: '技能管理验收点',
    systemId: 'deeplearning',
    level: 'advanced',
    passScore: 90,
    requiredHits: 2,
    description: '验收脚本创建',
    enabled: true,
  },
})
const afterCreate = await call('get', '/skill-tags')
check(
  '技能管理：新增技能点（含体系 / 层级 / 点亮口径）',
  afterCreate.length === tagsBefore.length + 1 &&
    createdTag.passScore === 90 &&
    createdTag.requiredHits === 2 &&
    createdTag.systemId === 'deeplearning',
  `技能点 ${tagsBefore.length} → ${afterCreate.length}；新点：${createdTag.name} · ${createdTag.systemId} · ≥${createdTag.passScore} 分 × ${createdTag.requiredHits} 次`,
)

const updatedTag = await call('put', `/skill-tags/${createdTag.id}`, {
  data: {
    name: '技能管理验收点（已改名）',
    systemId: 'algorithm',
    level: 'extended',
    passScore: 85,
    requiredHits: 3,
    enabled: false,
  },
})
check(
  '技能管理：编辑技能点（改名 / 换体系 / 改口径 / 停用）',
  updatedTag.name === '技能管理验收点（已改名）' &&
    updatedTag.systemId === 'algorithm' &&
    updatedTag.level === 'extended' &&
    updatedTag.requiredHits === 3 &&
    updatedTag.enabled === false,
  `${updatedTag.name} · ${updatedTag.systemId} · ${updatedTag.level} · ≥${updatedTag.passScore} 分 × ${updatedTag.requiredHits} 次 · ${updatedTag.enabled ? '启用' : '停用'}`,
)

const removedTag = await call('delete', `/skill-tags/${createdTag.id}`)
const afterDelete = await call('get', '/skill-tags')
check(
  '技能管理：删除未被引用的技能点',
  removedTag.ok === true && afterDelete.length === tagsBefore.length,
  `删除后技能点回到 ${afterDelete.length} 条`,
)

let guardMessage = ''
try {
  await call('delete', '/skill-tags/sk-defect-feature')
} catch (error) {
  guardMessage = error.message
}
const referencedAlive = (await call('get', '/skill-tags')).some(
  (item) => item.id === 'sk-defect-feature',
)
check(
  '技能管理：被岗位 / 项目引用的技能点不可删除',
  guardMessage.length > 0 && referencedAlive,
  guardMessage || '未被拦截（异常）',
)

console.log('\n===== 汇总 =====')
const failed = results.filter((r) => !r.pass)
console.log(`通过 ${results.length - failed.length}/${results.length}`)
if (failed.length > 0) console.log('未通过：' + failed.map((r) => r.name).join('、'))

await server.close()
