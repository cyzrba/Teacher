<script setup lang="ts">
import { useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <div class="panel">
      <EmptyState
        title="页面不存在"
        description="链接可能已失效，或该功能尚未开放。"
        action-text="返回数据总览"
        @action="router.push('/teacher/dashboard')"
      />
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 40px;
  background: var(--bg);
}

.not-found .panel {
  width: min(560px, 100%);
}
</style>
