<script setup lang="ts">
/** 空态：一句结论 + 一句解释（+ 可选按钮），不用插图或图标 */
withDefaults(
  defineProps<{
    title: string
    description?: string
    actionText?: string
  }>(),
  { description: '', actionText: '' },
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty">
    <p class="empty__title">{{ title }}</p>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <el-button v-if="actionText" type="primary" round @click="emit('action')">
      {{ actionText }}
    </el-button>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
}

.empty__title {
  font-size: 14px;
  font-weight: 700;
}

.empty__desc {
  max-width: 460px;
  color: var(--ink-2);
  font-size: 12.5px;
}
</style>
