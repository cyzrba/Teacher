<script setup lang="ts">
/** 状态药丸：tone 决定配色，与原型截图一致（浅底 + 同色字） */
withDefaults(
  defineProps<{
    tone?: 'done' | 'todo' | 'wip' | 'lock' | 'danger' | 'violet' | 'orange'
    text: string
    icon?: string
  }>(),
  { tone: 'lock', icon: '' },
)
</script>

<template>
  <span class="pill" :class="`pill--${tone}`">
    <span v-if="icon" aria-hidden="true">{{ icon }}</span>
    {{ text }}
  </span>
</template>
