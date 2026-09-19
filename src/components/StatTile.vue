<script setup lang="ts">
/**
 * 指标读数：大号数字 + 说明文字。
 *
 * 这一版不再有左侧色条、也没有图标：
 * 一格读数就是「数字 + 说明」，格子之间的 1px 细线由外层指标栏（DashboardView）
 * 统一画出来，所以这里不设边框、圆角与投影，避免出现「卡片套卡片」。
 * 颜色只作为反馈出现：鼠标移上去时整格铺一层极浅的品牌底色、数字转主色。
 */
defineProps<{
  label: string
  value: string
}>()
</script>

<template>
  <article class="stat-tile">
    <p class="stat-tile__value num">{{ value }}</p>
    <p class="stat-tile__label">{{ label }}</p>
  </article>
</template>

<style scoped>
.stat-tile {
  padding: 18px 20px 16px;
  background: var(--surface);
  transition: background 0.2s ease;
}

.stat-tile:hover {
  background: var(--brand-050);
}

.stat-tile__value {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--ink-1);
  transition: color 0.2s ease;
}

.stat-tile:hover .stat-tile__value {
  color: var(--brand-600);
}

.stat-tile__label {
  margin-top: 3px;
  color: var(--ink-2);
  font-size: 12.5px;
}
</style>
