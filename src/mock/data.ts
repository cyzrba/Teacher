/**
 * Mock 数据 · 教师端
 *
 * 口径说明（重要）：
 * 本文件的字段、枚举与示例数值以《需求确认书0706.docx》内嵌原型截图为准，
 * 逐条对应关系见 README「原型截图对照表」。固定 seed，不使用随机数，
 * 保证同一份数据在多次启动、多个页面之间完全一致。
 */

import type {
  Certificate,
  CertificateApplication,
  CertificateRule,
  ClassStudent,
  GrowthRule,
  ImportedStudent,
  Position,
  Project,
  ReviewItem,
  SchoolClass,
  TeacherProfile,
  TrainTask,
} from '@/types'
import { cloneDefaultModules, defaultModules } from '@/config/modules'
import { skillSystems, skillTags } from '@/config/skills'

/* -------------------------------------------------------------------------- */
/* 教师身份（顶栏「当前身份：教师」+ 头像 T）                                   */
/* -------------------------------------------------------------------------- */

export const teacherProfile: TeacherProfile = {
  id: 'T2021008',
  jobNo: '2021***8',
  name: '王老师',
  college: '人工智能本科学院',
  classCount: 3,
  studentCount: 122,
}

/* -------------------------------------------------------------------------- */
/* 标准化实训模块：定义在 config/modules.ts（产品配置，非假数据），此处转出       */
/* -------------------------------------------------------------------------- */

export { cloneDefaultModules, cloneModules, defaultModules } from '@/config/modules'

/* -------------------------------------------------------------------------- */
/* 技能库（四大体系）：定义在 config/skills.ts（产品配置），此处转出               */
/* -------------------------------------------------------------------------- */

export { skillSystems, skillTags } from '@/config/skills'

/* -------------------------------------------------------------------------- */
/* 岗位（原型截图 image15 / image22 / image20）                                 */
/* -------------------------------------------------------------------------- */

export const positions: Position[] = [
  {
    id: 'pos-camera-app',
    name: '工业相机应用工程师',
    level: 'basic',
    scenario: '自动化产线',
    enabled: true,
    summary: '负责工业相机的选型、架设与成像参数调试，保障产线成像质量稳定。',
    skillTagIds: ['sk-camera-pick', 'sk-lens-debug', 'sk-light', 'sk-interface', 'sk-image-capture'],
    studentCount: 85,
  },
  {
    id: 'pos-mv-debug',
    name: '机器视觉调试工程师',
    level: 'basic',
    scenario: '现场部署',
    enabled: true,
    summary: '负责视觉系统的现场调试、参数优化与故障排查，保证设备按期投产。',
    skillTagIds: ['sk-sys-debug', 'sk-param-opt', 'sk-troubleshoot', 'sk-site-deploy', 'sk-perf-test'],
    studentCount: 90,
  },
  {
    id: 'pos-vision-algo',
    name: '视觉检测算法工程师',
    level: 'advanced',
    scenario: '工业质检算法研发',
    enabled: true,
    summary: '面向工业质检场景设计检测算法，完成从成像方案到模型落地的全链路开发。',
    skillTagIds: ['sk-preprocess', 'sk-defect-feature', 'sk-detect', 'sk-eval', 'sk-inference'],
    studentCount: 98,
  },
  {
    id: 'pos-defect',
    name: '缺陷检测工程师',
    level: 'advanced',
    scenario: '表面缺陷检测',
    enabled: true,
    summary: '负责表面缺陷类项目的方案设计、样本治理与判定标准制定。',
    skillTagIds: ['sk-defect-feature', 'sk-segmentation', 'sk-augment', 'sk-measure'],
    studentCount: 88,
  },
  {
    id: 'pos-line-integration',
    name: '产线视觉集成工程师',
    level: 'extended',
    scenario: '整线集成与交付',
    enabled: true,
    summary: '面向整线交付，负责多相机协同、节拍优化与系统稳定性保障。',
    skillTagIds: ['sk-multi-camera', 'sk-tact', 'sk-stability', 'sk-edge-deploy', 'sk-deliver-doc'],
    studentCount: 82,
  },
  {
    id: 'pos-ai-trainer',
    name: '人工智能训练师',
    level: 'basic',
    scenario: '数据标注与模型训练',
    enabled: true,
    summary: '负责数据集构建、标注规范制定与模型训练调参，是算法落地的上游关键角色。',
    skillTagIds: ['sk-dataset', 'sk-annotation', 'sk-classify', 'sk-augment'],
    studentCount: 95,
  },
]

/* -------------------------------------------------------------------------- */
/* 班级（原型截图 image4）                                                      */
/* -------------------------------------------------------------------------- */

export const classes: SchoolClass[] = [
  {
    id: 'cls-2101',
    name: '21级1班',
    studentCount: 40,
    teacher: '王老师',
    groups: [
      { id: 'g-a', name: 'A组', studentCount: 10 },
      { id: 'g-b', name: 'B组', studentCount: 10 },
      { id: 'g-c', name: 'C组', studentCount: 10 },
      { id: 'g-d', name: 'D组', studentCount: 10 },
    ],
    taskDone: 3,
    taskTotal: 9,
    avgCompletion: 72,
    remark: '人工智能技术应用专业，基础较扎实',
  },
  {
    id: 'cls-2102',
    name: '21级2班',
    studentCount: 41,
    teacher: '李老师',
    groups: [
      { id: 'g-a', name: 'A组', studentCount: 14 },
      { id: 'g-b', name: 'B组', studentCount: 14 },
      { id: 'g-c', name: 'C组', studentCount: 13 },
    ],
    taskDone: 3,
    taskTotal: 9,
    avgCompletion: 65,
    remark: '',
  },
  {
    id: 'cls-2103',
    name: '21级3班',
    studentCount: 41,
    teacher: '张老师',
    groups: [
      { id: 'g-a', name: 'A组', studentCount: 11 },
      { id: 'g-b', name: 'B组', studentCount: 10 },
      { id: 'g-c', name: 'C组', studentCount: 10 },
      { id: 'g-d', name: 'D组', studentCount: 10 },
    ],
    taskDone: 3,
    taskTotal: 9,
    avgCompletion: 58,
    remark: '',
  },
]

/* -------------------------------------------------------------------------- */
/* 任务下发（原型截图 image7）                                                  */
/* -------------------------------------------------------------------------- */

const taskSeed: Omit<TrainTask, 'projectIds' | 'projectNames'>[] = [
  {
    id: 'task-001',
    classId: 'cls-2101',
    className: '21级1班',
    group: '全班',
    positionId: 'pos-vision-algo',
    positionName: '视觉检测算法工程师',
    tier: 'basic',
    publishMode: 'immediate',
    publishAt: '2024-01-02',
    status: 'published',
  },
  {
    id: 'task-002',
    classId: 'cls-2102',
    className: '21级2班',
    group: '全班',
    positionId: 'pos-defect',
    positionName: '缺陷检测工程师',
    tier: 'basic',
    publishMode: 'immediate',
    publishAt: '2024-01-05',
    status: 'published',
  },
  {
    id: 'task-003',
    classId: 'cls-2101',
    className: '21级1班',
    group: 'A组',
    positionId: 'pos-ai-trainer',
    positionName: '人工智能训练师',
    tier: 'advanced',
    publishMode: 'class_targeted',
    publishAt: '2024-01-10',
    status: 'published',
  },
  {
    id: 'task-004',
    classId: 'cls-2102',
    className: '21级2班',
    group: 'B组',
    positionId: 'pos-line-integration',
    positionName: '产线视觉集成工程师',
    tier: 'extended',
    publishMode: 'scheduled',
    publishAt: '2024-02-01',
    status: 'pending',
  },
  {
    id: 'task-005',
    classId: 'cls-2101',
    className: '21级1班',
    group: '全班',
    positionId: 'all',
    positionName: '全部岗位',
    tier: 'all',
    publishMode: 'scheduled',
    publishAt: '2026-06-27',
    status: 'pending',
  },
  {
    id: 'task-006',
    classId: 'cls-2102',
    className: '21级2班',
    group: '全班',
    positionId: 'all',
    positionName: '全部岗位',
    tier: 'all',
    publishMode: 'scheduled',
    publishAt: '2026-06-27',
    status: 'pending',
  },
  {
    id: 'task-007',
    classId: 'cls-2103',
    className: '21级3班',
    group: '全班',
    positionId: 'all',
    positionName: '全部岗位',
    tier: 'all',
    publishMode: 'scheduled',
    publishAt: '2026-06-27',
    status: 'pending',
  },
]

/**
 * 任务（修复#1）：
 * 初始 Mock 任务均为「按岗位 + 层级」下发，因此 projectIds 为空；
 * 教师在任务下发中显式选择项目后，会在列表里展开显示具体项目名。
 */
export const tasks: TrainTask[] = taskSeed.map((item) => ({
  ...item,
  projectIds: [],
  projectNames: [],
}))

/** 数据导出（原型截图 image9）：定义在 config/export.ts，这里转出给 Mock 服务端使用 */
export { exportCards } from '@/config/export'

/* -------------------------------------------------------------------------- */
/* 实训项目（原型截图 image10 / image14）                                       */
/* -------------------------------------------------------------------------- */

function seedImports(className: string, names: string[], group: string): ImportedStudent[] {
  return names.map((name, index) => ({
    id: `imp-${className}-${index + 1}`,
    name,
    studentNo: `2021${String(1000 + index)}`,
    className,
    group,
  }))
}

function makeProject(seed: {
  id: string
  name: string
  tier: Project['tier']
  difficulty: number
  positionId: string
  positionName: string
  status: Project['status']
  publishMode: Project['publishMode']
  publishTarget: string
  publishAt: string
  description: string
  skillTagIds: string[]
  knowledgePoints: string[]
}): Project {
  return {
    ...seed,
    modules: cloneDefaultModules(),
    materials: [
      {
        id: `${seed.id}-mat-1`,
        name: `${seed.name}-报告模板.docx`,
        size: 186_432,
        type: 'docx',
        uploadedAt: '2024-01-02 09:00',
      },
      {
        id: `${seed.id}-mat-2`,
        name: `${seed.name}-样例数据.zip`,
        size: 4_812_800,
        type: 'zip',
        uploadedAt: '2024-01-02 09:00',
      },
    ],
    scoreStandard: [
      {
        id: `${seed.id}-std-1`,
        name: `${seed.name}-评分标准.md`,
        size: 24_576,
        type: 'md',
        uploadedAt: '2024-01-02 09:00',
      },
    ],
    imports: seedImports('21级1班', ['李明远', '张伟', '陈晓', '孙静'], 'A组'),
    createdAt: '2024-01-02',
  }
}

export const projects: Project[] = [
  makeProject({
    id: 'prj-acrylic',
    name: '亚克力板划痕检测',
    tier: 'basic',
    difficulty: 2,
    positionId: 'pos-vision-algo',
    positionName: '视觉检测算法工程师',
    status: 'published',
    publishMode: 'immediate',
    publishTarget: '全部班级',
    publishAt: '2024-01-02 09:00',
    description: '针对亚克力板表面划痕的视觉检测入门项目，覆盖成像方案、图像预处理与规则判定。',
    skillTagIds: ['sk-light', 'sk-preprocess', 'sk-defect-feature', 'sk-measure'],
    knowledgePoints: ['划痕成像原理', '光照方案设计', '边缘检测算子'],
  }),
  makeProject({
    id: 'prj-battery',
    name: '电池表面缺陷检测',
    tier: 'basic',
    difficulty: 2,
    positionId: 'pos-defect',
    positionName: '缺陷检测工程师',
    status: 'published',
    publishMode: 'immediate',
    publishTarget: '全部班级',
    publishAt: '2024-01-05 10:00',
    description: '面向电池外观的缺陷分类项目，重点训练缺陷特征提取与判定阈值设计。',
    skillTagIds: ['sk-image-quality', 'sk-defect-feature', 'sk-blob', 'sk-classify'],
    knowledgePoints: ['缺陷类型划分', '阈值分割', '误检与漏检权衡'],
  }),
  makeProject({
    id: 'prj-food',
    name: '散装食品计数',
    tier: 'basic',
    difficulty: 1,
    positionId: 'pos-ai-trainer',
    positionName: '人工智能训练师',
    status: 'published',
    publishMode: 'class_targeted',
    publishTarget: '21级1班、21级2班',
    publishAt: '2024-01-08 14:00',
    description: '基于目标检测的散装食品计数项目，训练数据集构建与模型评估全流程。',
    skillTagIds: ['sk-dataset', 'sk-annotation', 'sk-detect'],
    knowledgePoints: ['标注规范', '目标检测指标 mAP', '过拟合识别'],
  }),
  makeProject({
    id: 'prj-regulator',
    name: '三端稳压管缺陷分类',
    tier: 'basic',
    difficulty: 2,
    positionId: 'pos-defect',
    positionName: '缺陷检测工程师',
    status: 'published',
    publishMode: 'immediate',
    publishTarget: '全部班级',
    publishAt: '2024-01-09 09:00',
    description: '小尺寸电子元件的缺陷分类项目，侧重成像放大倍率与缺陷特征描述。',
    skillTagIds: ['sk-lens', 'sk-preprocess', 'sk-classify', 'sk-eval'],
    knowledgePoints: ['景深与放大倍率', '形态学处理', '分类模型评估'],
  }),
  makeProject({
    id: 'prj-pcb',
    name: 'PCB板缺陷检测',
    tier: 'basic',
    difficulty: 3,
    positionId: 'pos-line-integration',
    positionName: '产线视觉集成工程师',
    status: 'pending',
    publishMode: 'scheduled',
    publishTarget: '全部班级',
    publishAt: '2024-02-01 08:00',
    description: 'PCB 焊点缺陷检测项目，覆盖多类缺陷的检测与产线节拍评估。',
    skillTagIds: ['sk-defect-feature', 'sk-detect', 'sk-tact'],
    knowledgePoints: ['焊点缺陷类型', '检测节拍计算', '产线通信协议'],
  }),
  makeProject({
    id: 'prj-pharma',
    name: '医药包装缺陷检测',
    tier: 'advanced',
    difficulty: 3,
    positionId: 'pos-vision-algo',
    positionName: '视觉检测算法工程师',
    status: 'published',
    publishMode: 'immediate',
    publishTarget: '全部班级',
    publishAt: '2024-01-10 09:00',
    description: '医药泡罩包装的缺粒、破损检测项目，含合规性判定与追溯要求。',
    skillTagIds: ['sk-image-quality', 'sk-segmentation', 'sk-eval', 'sk-stability'],
    knowledgePoints: ['医药行业合规要求', '分割模型调优', '追溯数据设计'],
  }),
  makeProject({
    id: 'prj-textile',
    name: '纺织品表面检测',
    tier: 'advanced',
    difficulty: 3,
    positionId: 'pos-camera-app',
    positionName: '工业相机应用工程师',
    status: 'published',
    publishMode: 'class_targeted',
    publishTarget: '21级3班',
    publishAt: '2024-01-11 15:00',
    description: '高速运动织物表面的瑕疵检测项目，重点解决运动模糊与打光一致性。',
    skillTagIds: ['sk-image-capture', 'sk-camera-param', 'sk-troubleshoot', 'sk-perf-test'],
    knowledgePoints: ['曝光与运动模糊', '线扫相机选型', '现场光源一致性'],
  }),
  makeProject({
    id: 'prj-metal',
    name: '金属零件尺寸测量',
    tier: 'advanced',
    difficulty: 4,
    positionId: 'pos-mv-debug',
    positionName: '机器视觉调试工程师',
    status: 'offline',
    publishMode: 'immediate',
    publishTarget: '--',
    publishAt: '--',
    description: '金属零件的亚像素级尺寸测量项目，覆盖标定、测量与误差分析。',
    skillTagIds: ['sk-measure', 'sk-sys-debug', 'sk-param-opt'],
    knowledgePoints: ['相机标定', '亚像素边缘', '测量不确定度'],
  }),
  makeProject({
    id: 'prj-sorting',
    name: '多品种混合分拣系统',
    tier: 'extended',
    difficulty: 5,
    positionId: 'pos-line-integration',
    positionName: '产线视觉集成工程师',
    status: 'offline',
    publishMode: 'immediate',
    publishTarget: '--',
    publishAt: '--',
    description: '面向整线交付的综合项目，覆盖多相机协同、节拍优化与系统稳定性验证。',
    skillTagIds: ['sk-multi-camera', 'sk-tact', 'sk-stability', 'sk-deliver-doc'],
    knowledgePoints: ['多相机协同标定', '分拣节拍优化', '交付文档规范'],
  }),
]

/*
 * 项目发布管控的数据来源：不再单独维护一份数组，
 * 改由 mock/server.ts 从 db.projects 派生（status !== 'offline'），
 * 保证与项目列表永远同源、不会对不上。
 */

/* -------------------------------------------------------------------------- */
/* 成长规则（原型截图 image17）                                                 */
/* -------------------------------------------------------------------------- */

export const growthRules: GrowthRule[] = [
  {
    tier: 'basic',
    unlockCondition: '注册即可解锁基础项目',
    masteryStandard: '完成全部5个基础技能',
    maxLevel: 5,
    passScore: 60,
    levelDescription: '面向入门学员，涵盖基础操作与简单场景',
    matchCount: 3,
    relevance: 60,
  },
  {
    tier: 'advanced',
    unlockCondition: '基础项目全部达到良好(≥80分)',
    masteryStandard: '完成全部8个进阶技能且基础全精通',
    maxLevel: 8,
    passScore: 75,
    levelDescription: '需基础项目达标后解锁，覆盖复杂场景与综合应用',
    matchCount: 4,
    relevance: 75,
  },
  {
    tier: 'extended',
    unlockCondition: '进阶项目全部达到优秀(≥90分)',
    masteryStandard: '完成全部10个拓展技能且进阶全精通',
    maxLevel: 10,
    passScore: 85,
    levelDescription: '面向产线交付的综合实战，强调工程化与稳定性',
    matchCount: 5,
    relevance: 85,
  },
]

/* -------------------------------------------------------------------------- */
/* 实训结果审核（原型截图 image18 / image19）                                   */
/* -------------------------------------------------------------------------- */

const AI_REASON: Record<string, string> = {
  '需求分析': '需求描述完整，明确了检测目标与精度要求，但缺少对现场约束条件（节拍、环境光）的量化说明。',
  '方案设计': '方案思路清晰，给出了成像与算法两条路径；建议补充方案对比与选型依据。',
  '数据处理': '数据集划分合理，标注规范描述较完整；建议补充难例样本的处理策略。',
  '模型训练': '训练流程完整，超参数设置合理，记录了训练曲线与收敛情况。',
  '模型优化': '给出了量化与剪枝思路，但缺少优化前后的精度对比数据。',
  '模型测试': '测试用例覆盖主要场景，建议增加边界样本与长时间稳定性验证。',
  '实训报告上传': '报告结构完整，结论明确，图表引用规范。',
}

function buildModuleScores(
  scores: number[],
): ReviewItem['moduleScores'] {
  return defaultModules.map((module, index) => {
    const score = scores[index] ?? 0
    return {
      moduleId: module.id,
      moduleName: module.name,
      score,
      maxScore: module.maxScore,
      weight: module.weight,
      comment: '',
      aiScore: Math.max(0, score - 1),
      aiReason: AI_REASON[module.name] ?? 'AI 已完成该模块的自动评审。',
    }
  })
}

const REPORT_TEMPLATE = `一、项目背景
本项目面向亚克力板表面划痕的在线检测需求。产线要求在不影响节拍的前提下，识别长度大于 0.5mm 的划痕，并将误检率控制在 3% 以内。

二、方案设计
成像方案采用同轴光源 + 低角度环形光组合，抑制亚克力表面反光；相机选用 500 万像素面阵相机，镜头放大倍率 0.8x。算法侧先用高斯滤波与形态学处理做预处理，再基于边缘特征与灰度差提取划痕候选区域。

三、数据处理
采集样本 862 张，其中正样本（含划痕）312 张，负样本 550 张。按 7:2:1 划分训练、验证与测试集，并对正样本做了随机旋转与亮度扰动增强。

四、模型训练
基线采用 ResNet18 分类网络，输入尺寸 224×224，batch size 32，学习率 1e-3，训练 60 个 epoch 后收敛。

五、模型优化
通过通道剪枝与 INT8 量化，模型体积由 44MB 降至 11MB，单张推理耗时由 38ms 降至 12ms，精度损失约 0.4%。

六、模型测试
在测试集上取得准确率 96.2%、召回率 94.8%。补充了明暗突变、局部污渍等边界样本的验证。

七、结论
方案满足产线节拍与精度要求，后续将补充长时间运行稳定性测试与现场联调。`

const reviewSeed: Omit<ReviewItem, 'aiTotalScore'>[] = [
  {
    id: 'rev-001',
    studentName: '李明远',
    className: '21级2班',
    projectId: 'prj-acrylic',
    projectName: '亚克力板划痕检测',
    score: 92,
    submittedAt: '2024-01-20',
    status: 'approved',
    starred: false,
    moduleScores: buildModuleScores([18, 16, 17, 20, 14, 14, 10]),
    feedback: '整体完成度高，方案论证与实验记录都很扎实，建议在报告中补充现场约束条件的量化分析。',
    report: REPORT_TEMPLATE,
    recheck: { objectionRaised: false, draftSaved: false },
  },
  {
    id: 'rev-002',
    studentName: '王思琪',
    className: '21级2班',
    projectId: 'prj-pharma',
    projectName: '医药包装缺陷检测',
    score: 85,
    submittedAt: '2024-01-19',
    status: 'rejected',
    starred: false,
    moduleScores: buildModuleScores([16, 15, 14, 18, 12, 12, 9]),
    feedback: '模型训练部分达到要求，但数据处理章节缺少对难例样本的说明，报告结论与实验数据关联不足。',
    rejectReason: '数据处理不达标，需补充难例样本说明',
    report: REPORT_TEMPLATE,
    recheck: { objectionRaised: false, draftSaved: false },
  },
  {
    id: 'rev-003',
    studentName: '张伟',
    className: '21级1班',
    projectId: 'prj-food',
    projectName: '散装食品计数',
    score: 78,
    submittedAt: '2024-01-18',
    status: 'pending',
    starred: false,
    moduleScores: buildModuleScores([15, 14, 12, 16, 10, 8, 8]),
    feedback: '',
    report: REPORT_TEMPLATE,
    recheck: { objectionRaised: false, draftSaved: false },
  },
  {
    id: 'rev-004',
    studentName: '陈晓',
    className: '21级1班',
    projectId: 'prj-battery',
    projectName: '电池表面缺陷检测',
    score: 90,
    submittedAt: '2024-01-17',
    status: 'approved',
    starred: false,
    moduleScores: buildModuleScores([17, 17, 16, 19, 13, 13, 10]),
    feedback: '缺陷特征提取思路清晰，误检分析到位，可直接作为范例。',
    report: REPORT_TEMPLATE,
    recheck: { objectionRaised: false, draftSaved: false },
  },
  {
    id: 'rev-005',
    studentName: '刘芳',
    className: '21级3班',
    projectId: 'prj-textile',
    projectName: '纺织品表面检测',
    score: 88,
    submittedAt: '2024-01-16',
    status: 'approved',
    starred: false,
    moduleScores: buildModuleScores([17, 16, 16, 18, 13, 12, 10]),
    feedback: '运动模糊的处理方案有效，建议补充线扫相机的选型对比。',
    report: REPORT_TEMPLATE,
    recheck: { objectionRaised: false, draftSaved: false },
  },
  {
    id: 'rev-006',
    studentName: '赵鑫',
    className: '21级3班',
    projectId: 'prj-regulator',
    projectName: '三端稳压管缺陷分类',
    score: 52,
    submittedAt: '2024-01-15',
    status: 'rejected',
    starred: false,
    moduleScores: buildModuleScores([10, 9, 8, 10, 6, 6, 5]),
    feedback: '需求与方案章节描述过于简略，训练过程缺少关键参数与曲线记录。',
    rejectReason: '需求与方案不达标，训练过程记录缺失',
    report: REPORT_TEMPLATE,
    recheck: { objectionRaised: true, objectionNote: '已补充训练日志，申请重新评审', draftSaved: false },
  },
]

/**
 * AI 原始总分与当前总分分开存储（修复#5）：
 * 初始两者相同，教师复核后只改 score，aiTotalScore 保留 AI 的原始判定。
 */
export const reviews: ReviewItem[] = reviewSeed.map((item) => ({
  ...item,
  aiTotalScore: item.score,
}))

/* -------------------------------------------------------------------------- */
/* 数据总览（原型截图 image20）                                                 */
/* -------------------------------------------------------------------------- */

/*
 * 数据总览与学习过程统计的指标 / 排行 / 预警 / 进度分布，
 * 已在 mock/server.ts 中按当前数据实时派生（修复#6），此处不再维护静态副本。
 */

/* -------------------------------------------------------------------------- */
/* 学习过程统计：日均在线时长趋势（无逐日数据源，保留趋势形状）                 */
/* -------------------------------------------------------------------------- */

export const dailyOnline = [
  { day: '周一', hours: 2.1 },
  { day: '周二', hours: 2.4 },
  { day: '周三', hours: 2.9 },
  { day: '周四', hours: 3.0 },
  { day: '周五', hours: 2.7 },
  { day: '周六', hours: 3.3 },
  { day: '周日', hours: 3.1 },
]

/* -------------------------------------------------------------------------- */
/* 学生名册（修复#7 / #8 / #11 / #14）                                          */
/*                                                                             */
/* 班级人数、分组人数、任务完成情况、证书发放的班级字段，全部由这份名册派生。    */
/* 名册按确定性规则生成（无随机数），保证多次运行结果一致。                      */
/* -------------------------------------------------------------------------- */

const SURNAMES = [
  '李', '王', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗',
]
const GIVEN_NAMES = [
  '嘉禾', '思琪', '明远', '伟', '晓', '芳', '鑫', '静', '磊', '洋',
  '婷', '浩', '宇', '欣', '博', '琳', '倩', '鹏', '轩', '妍',
]
const ROSTER_CLASSES = ['21级1班', '21级2班', '21级3班']
const ROSTER_GROUPS: Record<string, string[]> = {
  '21级1班': ['A组', 'B组', 'C组', 'D组'],
  '21级2班': ['A组', 'B组', 'C组'],
  '21级3班': ['A组', 'B组', 'C组', 'D组'],
}
const ROSTER_TOTALS: Record<string, number> = { '21级1班': 40, '21级2班': 41, '21级3班': 41 }

/** 有名有姓的代表性学生：数据与审核列表、证书台账保持一致 */
const FEATURED_STUDENTS: {
  name: string
  className: string
  group: string
  positionId: string
  positionName: string
  skillRate: number
  projectRate: number
  doneCount: number
  onlineHours: number
}[] = [
  { name: '张伟', className: '21级1班', group: 'A组', positionId: 'pos-ai-trainer', positionName: '人工智能训练师', skillRate: 78, projectRate: 82, doneCount: 6, onlineHours: 38 },
  { name: '陈晓', className: '21级1班', group: 'B组', positionId: 'pos-camera-app', positionName: '工业相机应用工程师', skillRate: 42, projectRate: 85, doneCount: 3, onlineHours: 22 },
  { name: '孙静', className: '21级1班', group: 'A组', positionId: 'pos-defect', positionName: '缺陷检测工程师', skillRate: 58, projectRate: 62, doneCount: 4, onlineHours: 26 },
  { name: '李明远', className: '21级2班', group: 'B组', positionId: 'pos-vision-algo', positionName: '视觉检测算法工程师', skillRate: 67, projectRate: 90, doneCount: 5, onlineHours: 32 },
  { name: '王思琪', className: '21级2班', group: 'A组', positionId: 'pos-defect', positionName: '缺陷检测工程师', skillRate: 55, projectRate: 65, doneCount: 4, onlineHours: 28 },
  { name: '周洋', className: '21级2班', group: 'C组', positionId: 'pos-vision-algo', positionName: '视觉检测算法工程师', skillRate: 74, projectRate: 79, doneCount: 5, onlineHours: 30 },
  { name: '刘芳', className: '21级3班', group: 'A组', positionId: 'pos-mv-debug', positionName: '机器视觉调试工程师', skillRate: 82, projectRate: 88, doneCount: 7, onlineHours: 40 },
  { name: '赵鑫', className: '21级3班', group: 'C组', positionId: 'pos-line-integration', positionName: '产线视觉集成工程师', skillRate: 30, projectRate: 60, doneCount: 2, onlineHours: 15 },
  { name: '吴磊', className: '21级3班', group: 'B组', positionId: 'pos-ai-trainer', positionName: '人工智能训练师', skillRate: 71, projectRate: 74, doneCount: 4, onlineHours: 29 },
]

function buildStudentRoster(): ClassStudent[] {
  const list: ClassStudent[] = []
  const used = new Set<string>()
  let seq = 0

  for (const className of ROSTER_CLASSES) {
    const groups = ROSTER_GROUPS[className] ?? ['A组']
    const total = ROSTER_TOTALS[className] ?? 40
    const featured = FEATURED_STUDENTS.filter((item) => item.className === className)

    for (let index = 0; index < total; index += 1) {
      const serial = String(20210000 + ROSTER_CLASSES.indexOf(className) * 100 + index + 1)
      const star = featured[index]

      if (star) {
        used.add(star.name)
        list.push({
          id: `stu-${className}-${index + 1}`,
          studentNo: serial,
          name: star.name,
          className,
          group: star.group,
          positionId: star.positionId,
          positionName: star.positionName,
          skillRate: star.skillRate,
          projectRate: star.projectRate,
          avgScore: 60 + ((index * 7 + ROSTER_CLASSES.indexOf(className) * 3) % 30),
          onlineHours: star.onlineHours,
          doneProjectIds: projects.slice(0, Math.min(star.doneCount, projects.length)).map((p) => p.id),
        })
        continue
      }

      // 姓 + 名按「笛卡尔积」推进，保证组合数足够；并保留跳过重名的兜底
      let name = ''
      let guard = 0
      while (name.length === 0 || used.has(name)) {
        const surname = SURNAMES[seq % Math.max(1, SURNAMES.length)] ?? '李'
        const given =
          GIVEN_NAMES[Math.floor(seq / Math.max(1, SURNAMES.length)) % Math.max(1, GIVEN_NAMES.length)] ??
          '伟'
        name = `${surname}${given}`
        seq += 1
        guard += 1
        if (guard > 2000) {
          name = `学生${seq}`
          break
        }
      }
      used.add(name)

      list.push({
        id: `stu-${className}-${index + 1}`,
        studentNo: serial,
        name,
        className,
        group: groups[index % groups.length] ?? 'A组',
        positionId: 'pos-vision-algo',
        positionName: '视觉检测算法工程师',
        skillRate: 30 + ((index * 11) % 65),
        projectRate: 35 + ((index * 13) % 60),
        avgScore: 60 + ((index * 7) % 30),
        onlineHours: 8 + ((index * 3) % 35),
        doneProjectIds: projects
          .slice(0, index % (projects.length + 1))
          .map((p) => p.id),
      })
    }
  }

  return list
}

export const studentRoster: ClassStudent[] = buildStudentRoster()

/* -------------------------------------------------------------------------- */
/* 企业认证证书（原型截图 image22 / image23 / image24 / image25 / image26 / image27） */
/* -------------------------------------------------------------------------- */

export const certificateRules: CertificateRule[] = [
  {
    id: 'rule-1',
    positionId: 'pos-vision-algo',
    positionName: '视觉检测算法工程师',
    name: '视觉检测算法工程师认证证书',
    swatch: '#1677FF',
    minSkillRate: 80,
    minProjectRate: 75,
    minAvgScore: 70,
    basicProjectRule: '全部通关',
    advancedProjectRule: '至少一项',
    validMonths: 24,
    active: true,
  },
  {
    id: 'rule-2',
    positionId: 'pos-defect',
    positionName: '缺陷检测工程师',
    name: '缺陷检测工程师认证证书',
    swatch: '#F97316',
    minSkillRate: 85,
    minProjectRate: 80,
    minAvgScore: 75,
    basicProjectRule: '全部通关',
    advancedProjectRule: '全部通关',
    validMonths: 36,
    active: true,
  },
  {
    id: 'rule-3',
    positionId: 'pos-ai-trainer',
    positionName: '人工智能训练师',
    name: '人工智能训练师认证证书',
    swatch: '#52C41A',
    minSkillRate: 75,
    minProjectRate: 70,
    minAvgScore: 65,
    basicProjectRule: '至少一项',
    advancedProjectRule: '至少一项',
    validMonths: 24,
    active: true,
  },
  {
    id: 'rule-4',
    positionId: 'pos-camera-app',
    positionName: '工业相机应用工程师',
    name: '工业相机应用工程师认证证书',
    swatch: '#8B5CF6',
    minSkillRate: 80,
    minProjectRate: 75,
    minAvgScore: 70,
    basicProjectRule: '全部通关',
    advancedProjectRule: '至少一项',
    validMonths: 24,
    active: true,
  },
]

export const certificateApplications: CertificateApplication[] = [
  {
    id: 'app-1',
    studentName: '刘芳',
    positionId: 'pos-mv-debug',
    positionName: '机器视觉调试工程师',
    certNo: 'SM-2024-VI-00018',
    appliedAt: '2024-01-18',
    skillRate: 92,
    projectRate: 88,
    avgScore: 90,
    status: 'pending',
  },
  {
    id: 'app-2',
    studentName: '张伟',
    positionId: 'pos-ai-trainer',
    positionName: '人工智能训练师',
    certNo: 'SM-2024-VI-00015',
    appliedAt: '2024-01-15',
    skillRate: 78,
    projectRate: 82,
    avgScore: 85,
    status: 'pending',
  },
  {
    id: 'app-3',
    studentName: '李明远',
    positionId: 'pos-vision-algo',
    positionName: '视觉检测算法工程师',
    certNo: 'SM-2024-VI-00012',
    appliedAt: '2024-01-12',
    skillRate: 85,
    projectRate: 90,
    avgScore: 88,
    status: 'pending',
  },
  {
    id: 'app-4',
    studentName: '赵鑫',
    positionId: 'pos-line-integration',
    positionName: '产线视觉集成工程师',
    certNo: 'SM-2024-VI-00009',
    appliedAt: '2024-01-09',
    skillRate: 55,
    projectRate: 60,
    avgScore: 62,
    status: 'pending',
  },
  {
    id: 'app-5',
    studentName: '陈晓',
    positionId: 'pos-camera-app',
    positionName: '工业相机应用工程师',
    certNo: 'SM-2024-VI-00010',
    appliedAt: '2024-01-10',
    skillRate: 82,
    projectRate: 85,
    avgScore: 76,
    status: 'approved',
  },
  {
    id: 'app-6',
    studentName: '王思琪',
    positionId: 'pos-defect',
    positionName: '缺陷检测工程师',
    certNo: 'SM-2024-VI-00008',
    appliedAt: '2024-01-08',
    skillRate: 60,
    projectRate: 65,
    avgScore: 68,
    status: 'rejected',
    rejectReason: '技能树点亮率未达标',
  },
]

export const certificates: Certificate[] = [
  {
    id: 'cert-1',
    studentName: '陈晓',
    className: '21级1班',
    positionId: 'pos-camera-app',
    positionName: '工业相机应用工程师',
    certNo: 'SM-2024-VI-00010',
    issuedAt: '2024-01-12',
    validUntil: '2025-01-12',
    status: 'valid',
    issuer: '深圳思谋信息科技有限公司',
  },
  {
    id: 'cert-2',
    studentName: '周洋',
    className: '21级2班',
    positionId: 'pos-vision-algo',
    positionName: '视觉检测算法工程师',
    certNo: 'SM-2024-VI-00005',
    issuedAt: '2023-12-20',
    validUntil: '2025-12-20',
    status: 'valid',
    issuer: '深圳思谋信息科技有限公司',
  },
  {
    id: 'cert-3',
    studentName: '孙静',
    className: '21级1班',
    positionId: 'pos-defect',
    positionName: '缺陷检测工程师',
    certNo: 'SM-2024-VI-00003',
    issuedAt: '2023-11-15',
    validUntil: '--',
    status: 'revoked',
    issuer: '深圳思谋信息科技有限公司',
  },
  {
    id: 'cert-4',
    studentName: '吴磊',
    className: '21级3班',
    positionId: 'pos-ai-trainer',
    positionName: '人工智能训练师',
    certNo: 'SM-2024-VI-00007',
    issuedAt: '2023-12-28',
    validUntil: '2025-12-28',
    status: 'valid',
    issuer: '深圳思谋信息科技有限公司',
  },
  {
    id: 'cert-5',
    studentName: '刘芳',
    className: '21级3班',
    positionId: 'pos-mv-debug',
    positionName: '机器视觉调试工程师',
    certNo: 'SM-2024-VI-00018',
    issuedAt: '2024-01-20',
    validUntil: '2026-01-20',
    status: 'valid',
    issuer: '深圳思谋信息科技有限公司',
  },
  {
    id: 'cert-6',
    studentName: '李明远',
    className: '21级2班',
    positionId: 'pos-vision-algo',
    positionName: '视觉检测算法工程师',
    certNo: 'SM-2024-VI-00012',
    issuedAt: '2024-01-14',
    validUntil: '2026-01-14',
    status: 'valid',
    issuer: '深圳思谋信息科技有限公司',
  },
]

/* -------------------------------------------------------------------------- */
/* AI 能力预留（P0 接口占位，不做页面）：定义在 config/ai.ts                    */
/* -------------------------------------------------------------------------- */

export { aiCapabilities } from '@/config/ai'
