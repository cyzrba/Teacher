import type { DataExportCard } from '@/types'

/** 数据导出项（原型截图 image9 的四张卡片） */
export const exportCards: DataExportCard[] = [
  {
    id: 'exp-score',
    name: '学生成绩报表',
    description: '导出各班级学生实训成绩汇总，含各模块得分与总分排名',
    formats: 'Excel / PDF / CSV',
  },
  {
    id: 'exp-report',
    name: '实训报告汇总',
    description: '批量导出学生提交的实训报告，含教师批注与评分',
    formats: 'ZIP 打包 PDF',
  },
  {
    id: 'exp-process',
    name: '学习过程数据',
    description: '导出学生在线学习时长、操作记录、提交时间等过程数据',
    formats: 'Excel / CSV',
  },
  {
    id: 'exp-skill',
    name: '技能成长报表',
    description: '导出各岗位技能树进度、等级变化、成长趋势分析',
    formats: 'Excel / PDF',
  },
]
