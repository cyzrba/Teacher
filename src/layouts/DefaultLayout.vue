<script setup lang="ts">
import { ref, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'
import { getUiPrefs, setUiPrefs } from '@/utils/storage'

/** 左侧导航是否收起：记住教师的选择（与学生端同一套偏好存储） */
const navCollapsed = ref(getUiPrefs()?.navCollapsed ?? false)

watch(navCollapsed, (value) => setUiPrefs({ ...getUiPrefs(), navCollapsed: value }))
</script>

<template>
  <div class="layout" :class="{ 'is-nav-collapsed': navCollapsed }">
    <AppHeader />

    <div class="layout__body">
      <div class="layout__nav">
        <AppNav @collapse="navCollapsed = true" />
      </div>

      <main class="layout__main">
        <div class="layout__content">
          <router-view v-slot="{ Component }">
            <transition name="rise" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>

    <button
      v-if="navCollapsed"
      class="layout__nav-handle"
      type="button"
      title="展开左侧导航"
      aria-label="展开左侧导航"
      @click="navCollapsed = false"
    >
      <span aria-hidden="true">»</span>
    </button>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.layout__body {
  flex: 1;
  display: grid;
  grid-template-columns: var(--side-w) minmax(0, 1fr);
  align-items: stretch;
  transition: grid-template-columns 0.24s ease;
}

/* 收起导航：列宽归零，内容区自动铺满 */
.layout.is-nav-collapsed .layout__body {
  grid-template-columns: 0 minmax(0, 1fr);
}

/**
 * 导航外层只负责裁剪。
 * 用 overflow: clip 而不是 hidden —— 它不会生成滚动容器，导航栏的吸顶不受影响。
 */
.layout__nav {
  min-width: 0;
  overflow: clip;
}

.layout__main {
  min-width: 0;
  padding: 22px var(--shell-pad) 48px;
}

.layout__content {
  min-width: 0;
}

/* 全部收起后，左侧边缘留一个小手柄用来重新展开 */
.layout__nav-handle {
  position: fixed;
  top: calc(var(--header-h) + 18px);
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 38px;
  border: 1px solid var(--line);
  border-left: 0;
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  background: var(--surface);
  color: var(--brand-600);
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--sh-1);
  transition: width 0.18s ease, background 0.18s ease;
}

.layout__nav-handle:hover {
  width: 32px;
  background: var(--brand-050);
}
</style>
