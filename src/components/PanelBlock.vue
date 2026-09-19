<script setup lang="ts">
/**
 * 通用卡片面块：标题 + 右侧插槽 + 内容区。
 *
 * 标题不再带图标，也不再用左侧色条做装饰：
 * 层级靠「字重 + 下方一条发丝线」表达，色块只留给真正的状态（药丸、分数档位）。
 */
withDefaults(
  defineProps<{
    title?: string
    hint?: string
    /** 内容区是否自带内边距（表格一般不需要） */
    padded?: boolean
  }>(),
  { title: '', hint: '', padded: true },
)
</script>

<template>
  <section class="panel block">
    <header v-if="title || $slots.extra" class="panel-head">
      <div class="panel-head__title">
        <span class="block__title">{{ title }}</span>
        <span v-if="hint" class="block__hint">{{ hint }}</span>
      </div>
      <div class="panel-head__extra">
        <slot name="extra" />
      </div>
    </header>

    <div :class="padded ? 'panel-body' : ''">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.block__title {
  min-width: 0;
}

.block__hint {
  margin-left: 4px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 400;
}
</style>
