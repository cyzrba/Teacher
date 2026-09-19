<script setup lang="ts">
import { useSkillStore } from '@/stores/skill'

const props = withDefaults(defineProps<{ ids: string[]; max?: number }>(), { max: 0 })

const skill = useSkillStore()

function visible(): string[] {
  return props.max > 0 ? props.ids.slice(0, props.max) : props.ids
}
</script>

<template>
  <span class="tags">
    <span v-for="id in visible()" :key="id" class="tag-skill">{{ skill.nameOf(id) }}</span>
    <span v-if="max > 0 && ids.length > max" class="tag-plain">+{{ ids.length - max }}</span>
  </span>
</template>

<style scoped>
.tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
