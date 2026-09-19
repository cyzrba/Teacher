import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchGrowthRules, saveGrowthRules } from '@/api/growth'
import type { GrowthRule, ProjectTier } from '@/types'

export const useGrowthStore = defineStore('growth', () => {
  const rules = ref<GrowthRule[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const tierOrder: ProjectTier[] = ['basic', 'advanced', 'extended']

  const totalMaxLevel = computed(() => rules.value.reduce((sum, rule) => sum + rule.maxLevel, 0))

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    try {
      rules.value = await fetchGrowthRules()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function save(): Promise<void> {
    rules.value = await saveGrowthRules(rules.value)
  }

  return { rules, loading, tierOrder, totalMaxLevel, load, save }
})
