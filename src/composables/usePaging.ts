import { computed, ref, watch } from 'vue'

/**
 * 列表分页。
 *
 * 当前数据全部来自本地 Mock（一次取全量），因此在视图层做客户端分页；
 * 接入后端后只需把 `paged` 换成服务端返回的 list、把 page/pageSize 传给 store 请求参数，
 * 分页组件与页面结构都不用改。
 */
export function usePaging<T>(source: () => T[], defaultSize = 10) {
  const page = ref(1)
  const pageSize = ref(defaultSize)

  const total = computed(() => source().length)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return source().slice(start, start + pageSize.value)
  })

  // 数据变少时把页码收回到最后一页，避免停在空白页
  watch([total, pageSize], () => {
    if (page.value > pageCount.value) page.value = pageCount.value
  })

  /** 筛选条件变化后调用，回到第一页 */
  function reset(): void {
    page.value = 1
  }

  return { page, pageSize, total, paged, reset }
}
