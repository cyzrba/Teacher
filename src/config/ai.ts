import type { AiCapability } from '@/types'

/**
 * AI 答辩 / AI 面试：需求确认为 P0「保留接口」，一期不实现页面。
 * 这里登记名称、说明与预留的后端地址，入口以「敬请期待」展示。
 */
export const aiCapabilities: AiCapability[] = [
  {
    id: 'defense',
    name: 'AI 答辩',
    description: '面向实训成果的智能答辩，自动生成提问并给出表现评价。',
    endpoint: 'POST /api/v1/ai/defense',
    available: false,
  },
  {
    id: 'interview',
    name: 'AI 面试',
    description: '面向岗位认证的模拟面试，结合技能树生成面试问题进行演练。',
    endpoint: 'POST /api/v1/ai/interview',
    available: false,
  },
]
