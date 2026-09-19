import type { TrainModule } from '@/types'

/**
 * 标准化实训模块的默认配置（原型截图 image13：七大模块）。
 *
 * 放在 config 而不是 mock 里：它是产品配置，不是假数据。
 * 教师可以在「实训项目管理」页调整这套标准配置，新建项目时默认继承。
 */
export const defaultModules: TrainModule[] = [
  {
    id: 'm-requirement',
    name: '需求分析',
    description: '明确项目需求、目标与约束条件',
    enabled: true,
    required: true,
    weight: 15,
    maxScore: 20,
    answerRequirement: '不少于500字',
  },
  {
    id: 'm-design',
    name: '方案设计',
    description: '设计技术方案与实施路径',
    enabled: true,
    required: true,
    weight: 15,
    maxScore: 20,
    answerRequirement: '不少于500字',
  },
  {
    id: 'm-data',
    name: '数据处理',
    description: '数据采集、清洗、标注与增强',
    enabled: true,
    required: true,
    weight: 15,
    maxScore: 20,
    answerRequirement: '不少于500字',
  },
  {
    id: 'm-train',
    name: '模型训练',
    description: '选择算法、训练模型、调参优化',
    enabled: true,
    required: true,
    weight: 20,
    maxScore: 20,
    answerRequirement: '不少于500字',
  },
  {
    id: 'm-optimize',
    name: '模型优化',
    description: '模型压缩、加速与精度提升',
    enabled: true,
    required: false,
    weight: 15,
    maxScore: 15,
    answerRequirement: '不少于500字',
  },
  {
    id: 'm-test',
    name: '模型测试',
    description: '功能测试、性能测试与边界验证',
    enabled: true,
    required: true,
    weight: 10,
    maxScore: 15,
    answerRequirement: '不少于500字',
  },
  {
    id: 'm-report',
    name: '实训报告上传',
    description: '撰写实训总结报告并上传',
    enabled: true,
    required: true,
    weight: 10,
    maxScore: 10,
    answerRequirement: '不少于500字',
  },
]

/** 深拷贝模块数组（含 extended 字段），用于编辑前隔离，避免改动引用 */
export function cloneModules(source: TrainModule[]): TrainModule[] {
  return source.map((item) => ({
    ...item,
    ...(item.extended ? { extended: { ...item.extended } } : {}),
  }))
}

export function cloneDefaultModules(): TrainModule[] {
  return cloneModules(defaultModules)
}
