<script setup lang="ts">
/** 列表底部分页条：总条数 + 每页条数 + 页码 */
defineProps<{
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()
</script>

<template>
  <div v-if="total > 0" class="pager">
    <span class="pager__total">
      共 <b class="num">{{ total }}</b> 条
    </span>
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="sizes, prev, pager, next, jumper"
      background
      @update:current-page="emit('update:page', $event)"
      @update:page-size="emit('update:pageSize', $event)"
    />
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px 4px;
  border-top: 1px solid var(--line-soft);
}

.pager__total {
  color: var(--ink-3);
  font-size: 12.5px;
}

.pager__total b {
  color: var(--ink-1);
}
</style>
