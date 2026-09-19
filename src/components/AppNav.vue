<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Aim,
  CircleCheck,
  DataLine,
  FolderOpened,
  Medal,
  Setting,
  TrendCharts,
  UserFilled,
} from '@element-plus/icons-vue'
import { navItems, platformInfo } from '@/config/nav'
import type { NavItem } from '@/types'

const route = useRoute()
const router = useRouter()

const emit = defineEmits<{ collapse: [] }>()

/** 当前高亮项由路由 meta.nav 决定 */
const activeKey = computed(() => route.meta.nav ?? '')

/**
 * 侧栏图标：Element Plus 单色线性图标，颜色由 CSS 变量统一控制
 * （激活为白色、悬停为主色），与学生端侧栏的处理方式一致。
 */
const navIcons: Record<string, Component> = {
  dashboard: DataLine,
  projects: FolderOpened,
  positions: Aim,
  reviews: CircleCheck,
  stats: TrendCharts,
  classes: UserFilled,
  certs: Medal,
  settings: Setting,
}

function iconOf(item: NavItem): Component {
  return navIcons[item.key] ?? DataLine
}

function isActive(key: string): boolean {
  return activeKey.value === key
}

function go(path: string): void {
  if (route.path !== path) void router.push(path)
}
</script>

<template>
  <nav class="app-nav" aria-label="教师端主导航">
    <ul class="app-nav__list">
      <li v-for="item in navItems" :key="item.key">
        <button
          class="nav-item"
          :class="{ 'is-active': isActive(item.key) }"
          type="button"
          :title="item.label"
          :aria-current="isActive(item.key) ? 'page' : undefined"
          @click="go(item.path)"
        >
          <el-icon class="nav-item__icon" :size="18" aria-hidden="true">
            <component :is="iconOf(item)" />
          </el-icon>
          <span class="nav-item__label">{{ item.label }}</span>
        </button>
      </li>
    </ul>

    <div class="app-nav__foot">
      <p class="app-nav__version">
        {{ platformInfo.portal }} · <span class="num">{{ platformInfo.version }}</span>
      </p>
      <button class="nav-collapse" type="button" title="收起左侧导航" @click="emit('collapse')">
        <span class="nav-collapse__glyph" aria-hidden="true">«</span>
        收起导航
      </button>
    </div>
  </nav>
</template>

<style scoped>
/**
 * 侧栏配色统一收在这组变量里（取值来自 tokens.css）：
 * 白底 + 蓝色高亮块 + 左侧 3px 主色竖线，与学生端侧栏同一观感。
 */
.app-nav {
  --side-hairline: var(--line-soft);

  position: sticky;
  top: var(--header-h);
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* 收起时保持自身宽度，由外层裁掉，避免收缩过程中文字换行抖动 */
  min-width: var(--side-w);
  height: calc(100vh - var(--header-h));
  padding: 18px 12px 16px;
  background: var(--side-bg);
  border-right: 1px solid var(--side-line);
  overflow-y: auto;
}

.app-nav__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--side-ink);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.nav-item__icon {
  flex: none;
  color: var(--side-icon);
  line-height: 1;
  transition: color 0.18s ease;
}

.nav-item__label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.nav-item:hover {
  background: var(--side-hover-bg);
  color: var(--side-hover-ink);
}

.nav-item:hover .nav-item__icon {
  color: var(--side-hover-icon);
}

.nav-item.is-active {
  background: var(--side-active-bg);
  color: var(--side-active-ink);
  font-weight: 700;
}

.nav-item.is-active .nav-item__icon {
  color: var(--side-active-ink);
}

.app-nav__foot {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  padding: 14px 0 0;
  border-top: 1px solid var(--side-hairline);
}

.app-nav__version {
  padding: 0 12px;
  color: var(--side-sub);
  font-size: 11px;
  letter-spacing: 0.04em;
}

/* —— 底部：收起导航 —— */
.nav-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface-2);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.nav-collapse:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}

.nav-collapse__glyph {
  font-size: 14px;
  line-height: 1;
}

/* —— 窄屏：侧栏只留图标，靠 title 提示 —— */
@media (max-width: 1200px) {
  .app-nav {
    padding: 16px 10px 14px;
  }

  .nav-item__label,
  .app-nav__version,
  .nav-collapse {
    display: none;
  }

  .nav-item {
    justify-content: center;
    padding: 0;
    height: 44px;
  }
}
</style>
