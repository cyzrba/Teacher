import type { SkillSystem, SkillTag } from '@/types'

/**
 * 技能库（四大体系）· 产品配置
 *
 * 这里是**教师端的技能库数据源**：新建岗位、新建实训项目时的技能标签都取自这里，
 * 岗位与项目通过标签 id 互通，也是后续「匹配度计算」的依据。
 *
 * 体系名称与《学生端》技能树保持一致（光学成像系 / 传统算法系 / 深度学习系 / 项目部署系），
 * 保证两端引用同一套技能口径；两端联调时只需要对齐这一个文件。
 *
 * 维护方式：
 * - 教师端「岗位与技能体系 → 技能管理」里新增 / 编辑 / 删除的技能点会写入 Mock 数据层；
 * - 正式上线后技能库由后端下发（GET /skill-tags），本文件退化为初始种子数据。
 *
 * 技能体系是平台级字典（需求：保留由超级管理员创建新体系的接口），
 * 因此这里只定义四个内置体系，教师端不提供新增 / 删除体系的入口。
 */

export const skillSystems: SkillSystem[] = [
  { id: 'optical', name: '光学成像系', color: '#35C2FF' },
  { id: 'algorithm', name: '传统算法系', color: '#5B8FF9' },
  { id: 'deeplearning', name: '深度学习系', color: '#FF7BA8' },
  { id: 'deployment', name: '项目部署系', color: '#52D3A8' },
]

/** 技能点原始列表：沿用学生端技能树节点名 */
const seedTags: { id: string; name: string; systemId: SkillTag['systemId'] }[] = [
  // 光学成像系
  { id: 'sk-optical-base', name: '光学基础', systemId: 'optical' },
  { id: 'sk-lens', name: '镜头选型', systemId: 'optical' },
  { id: 'sk-light', name: '光源方案设计', systemId: 'optical' },
  { id: 'sk-camera-param', name: '相机参数调试', systemId: 'optical' },
  { id: 'sk-image-quality', name: '成像质量评估', systemId: 'optical' },
  { id: 'sk-reflective', name: '高反光与透明件成像', systemId: 'optical' },
  // 传统算法系
  { id: 'sk-preprocess', name: '图像预处理', systemId: 'algorithm' },
  { id: 'sk-edge', name: '边缘与轮廓提取', systemId: 'algorithm' },
  { id: 'sk-blob', name: 'Blob 分析', systemId: 'algorithm' },
  { id: 'sk-template', name: '模板匹配', systemId: 'algorithm' },
  { id: 'sk-measure', name: '几何测量与标定', systemId: 'algorithm' },
  { id: 'sk-defect-feature', name: '缺陷特征工程', systemId: 'algorithm' },
  { id: 'sk-multi-camera', name: '多相机标定', systemId: 'algorithm' },
  // 深度学习系
  { id: 'sk-dataset', name: '数据集构建', systemId: 'deeplearning' },
  { id: 'sk-annotation', name: '标注规范制定', systemId: 'deeplearning' },
  { id: 'sk-classify', name: '分类模型训练', systemId: 'deeplearning' },
  { id: 'sk-detect', name: '目标检测训练', systemId: 'deeplearning' },
  { id: 'sk-eval', name: '模型评估与调参', systemId: 'deeplearning' },
  { id: 'sk-augment', name: '数据增强策略', systemId: 'deeplearning' },
  { id: 'sk-segmentation', name: '缺陷分割', systemId: 'deeplearning' },
  // 项目部署系
  { id: 'sk-inference', name: '推理加速', systemId: 'deployment' },
  { id: 'sk-edge-deploy', name: '边缘设备部署', systemId: 'deployment' },
  { id: 'sk-device-link', name: '相机与设备联调', systemId: 'deployment' },
  { id: 'sk-tact', name: '产线节拍优化', systemId: 'deployment' },
  { id: 'sk-stability', name: '系统稳定性测试', systemId: 'deployment' },
  { id: 'sk-deliver-doc', name: '部署文档交付', systemId: 'deployment' },
  // 以下为教师端原型截图（image15）岗位核心技能中出现的标签，纳入同一标签库
  { id: 'sk-camera-pick', name: '相机选型', systemId: 'optical' },
  { id: 'sk-lens-debug', name: '镜头调试', systemId: 'optical' },
  { id: 'sk-interface', name: '接口开发', systemId: 'deployment' },
  { id: 'sk-image-capture', name: '图像采集', systemId: 'optical' },
  { id: 'sk-sys-debug', name: '系统调试', systemId: 'deployment' },
  { id: 'sk-param-opt', name: '参数优化', systemId: 'algorithm' },
  { id: 'sk-troubleshoot', name: '故障排查', systemId: 'deployment' },
  { id: 'sk-site-deploy', name: '现场部署', systemId: 'deployment' },
  { id: 'sk-perf-test', name: '性能测试', systemId: 'deployment' },
]

/**
 * 技能点的默认判定口径：
 * 单次评分达到 80 分记一次达标，一次达标即点亮，默认启用。
 * 少数「重点技能」需要多次达标或更高分数才点亮，见下表覆盖值。
 */
const SKILL_OVERRIDES: Record<string, Partial<SkillTag>> = {
  'sk-defect-feature': {
    level: 'advanced',
    requiredHits: 2,
    description: '缺陷特征的定义、提取与量化描述，需要在两个以上项目中稳定达标',
  },
  'sk-detect': {
    level: 'advanced',
    requiredHits: 2,
    description: '目标检测模型的训练与调参，要求两次达标以确认稳定性',
  },
  'sk-eval': { level: 'advanced', passScore: 85 },
  'sk-measure': { level: 'advanced', description: '几何测量与标定：含测量精度与重复性要求' },
  'sk-inference': { level: 'advanced', passScore: 85, requiredHits: 2 },
  'sk-segmentation': {
    level: 'extended',
    requiredHits: 3,
    description: '像素级缺陷分割，精度要求高，需三次达标才点亮',
  },
  'sk-multi-camera': { level: 'extended', requiredHits: 2 },
  'sk-tact': { level: 'extended', requiredHits: 3, description: '产线节拍优化：需在整线场景下多次达标' },
  'sk-edge-deploy': { level: 'extended', requiredHits: 2 },
  'sk-site-deploy': { level: 'extended' },
  'sk-troubleshoot': { level: 'extended', description: '现场故障排查：含异常定位与恢复流程' },
  'sk-stability': { level: 'advanced' },
  'sk-sys-debug': { level: 'advanced' },
  'sk-annotation': { description: '标注规范的制定与质检口径' },
}

export const skillTags: SkillTag[] = seedTags.map((tag) => ({
  level: 'basic',
  passScore: 80,
  requiredHits: 1,
  enabled: true,
  ...SKILL_OVERRIDES[tag.id],
  ...tag,
}))
