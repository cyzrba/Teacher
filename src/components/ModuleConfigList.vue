<script setup lang="ts">
/**
 * 标准化实训模块配置。
 *
 * 需求要点（对应原型截图 image12 / image13）：
 * - 默认七大模块，但模块数量不写死：可添加模块、可自定义命名、预留扩展字段；
 * - 每个模块可设置：是否启用、是否必填、分值占比、作答要求；
 * - 新建实训项目时默认继承标准配置，可在此微调。
 */
import { computed } from 'vue'
import type { TrainModule } from '@/types'
import { localId } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    modules: TrainModule[]
    /** 弹窗内使用时压缩纵向留白 */
    compact?: boolean
    /** 是否允许增删模块（项目级微调时开放） */
    editable?: boolean
  }>(),
  { compact: false, editable: true },
)

const emit = defineEmits<{ 'update:modules': [TrainModule[]] }>()

const totalWeight = computed(() => props.modules.reduce((sum, item) => sum + item.weight, 0))
const totalScore = computed(() =>
  props.modules.reduce((sum, item) => sum + (item.enabled ? item.maxScore : 0), 0),
)

function patch(index: number, value: Partial<TrainModule>): void {
  emit(
    'update:modules',
    props.modules.map((item, i) => (i === index ? { ...item, ...value } : item)),
  )
}

function addModule(): void {
  const created: TrainModule = {
    id: localId('m'),
    name: '自定义模块',
    description: '自定义模块说明（预留扩展字段）',
    enabled: true,
    required: false,
    weight: 0,
    maxScore: 10,
    answerRequirement: '不少于300字',
    extended: { source: 'teacher-custom' },
  }
  emit('update:modules', [...props.modules, created])
}

function removeModule(index: number): void {
  emit(
    'update:modules',
    props.modules.filter((_, i) => i !== index),
  )
}

/**
 * 修复#23：分值占比合计不为 100% 时，可按比例归一化。
 * 四舍五入产生的差额补到权重最大的模块上，保证合计正好 100。
 */
function normalizeWeights(): void {
  const total = totalWeight.value
  if (total <= 0) return
  const scaled = props.modules.map((item) => ({
    ...item,
    weight: Math.round((item.weight / total) * 100),
  }))
  const diff = 100 - scaled.reduce((sum, item) => sum + item.weight, 0)
  if (diff !== 0) {
    let maxIndex = 0
    scaled.forEach((item, index) => {
      if (item.weight > (scaled[maxIndex]?.weight ?? 0)) maxIndex = index
    })
    const target = scaled[maxIndex]
    if (target) target.weight += diff
  }
  emit('update:modules', scaled)
}
</script>

<template>
  <div class="modules" :class="{ 'modules--compact': compact }">
    <article
      v-for="(module, index) in modules"
      :key="module.id"
      class="module"
      :class="{ 'is-off': !module.enabled }"
    >
      <div class="module__top">
        <!-- 用序号代替图标：模块本来就是有先后顺序的，编号比图标更有信息量 -->
        <span class="module__index num" aria-hidden="true">{{ index + 1 }}</span>
        <el-input
          :model-value="module.name"
          class="module__name"
          :disabled="!editable"
          @update:model-value="patch(index, { name: String($event) })"
        />
        <el-switch
          :model-value="module.enabled"
          :disabled="!editable"
          @update:model-value="patch(index, { enabled: Boolean($event) })"
        />
      </div>

      <el-input
        :model-value="module.description"
        class="module__desc"
        :disabled="!editable"
        placeholder="模块说明，如：数据采集、清洗、标注与增强"
        @update:model-value="patch(index, { description: String($event) })"
      />

      <div class="module__row">
        <span class="module__field">
          <span class="module__label">必填</span>
          <el-switch
            :model-value="module.required"
            size="small"
            :disabled="!editable"
            @update:model-value="patch(index, { required: Boolean($event) })"
          />
        </span>

        <span class="module__field module__field--weight">
          <span class="module__label">分值占比</span>
          <el-input-number
            :model-value="module.weight"
            :min="0"
            :max="100"
            :controls="false"
            class="module__weight"
            :disabled="!editable"
            @update:model-value="patch(index, { weight: Number($event ?? 0) })"
          />
          <span class="module__unit">%</span>
        </span>

        <span class="module__field module__field--req">
          <span class="module__label">作答要求</span>
          <el-input
            :model-value="module.answerRequirement"
            placeholder="如：不少于500字"
            :disabled="!editable"
            @update:model-value="patch(index, { answerRequirement: String($event) })"
          />
        </span>

        <el-button
          v-if="editable && modules.length > 1"
          class="module__remove"
          text
          type="danger"
          @click="removeModule(index)"
        >
          移除
        </el-button>
      </div>
    </article>

    <footer v-if="editable" class="modules__foot">
      <el-button text type="primary" @click="addModule">＋ 添加模块</el-button>
      <span class="modules__summary">
        <!-- 修复#16：两个合并不是同一件事，补上口径说明 -->
        <span class="modules__metric">
          分值占比合计
          <b class="num" :class="{ 'is-warn': totalWeight !== 100 }">{{ totalWeight }}%</b>
          <em>＝ 各模块在总评分中的权重</em>
          <!-- 修复#23：说明不为 100% 的后果，并提供一键归一化 -->
          <span v-if="totalWeight !== 100" class="modules__warn">
            合计不为 100%，总分将按当前占比加权（可能超过 100 分）
          </span>
          <el-button
            v-if="editable && totalWeight !== 100"
            text
            type="primary"
            size="small"
            @click="normalizeWeights"
          >
            按比例归一化
          </el-button>
        </span>
        <span class="modules__metric">
          模块满分合计
          <b class="num">{{ totalScore }}</b> 分
          <em>＝ 各模块独立打分的分数上限</em>
        </span>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.modules {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.module {
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-md);
  background: var(--surface);
}

.module.is-off {
  background: var(--surface-2);
}

.modules--compact .module {
  padding: 10px 12px 10px 14px;
}

.module__top {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 模块序号：浅蓝底方牌，代替原来的图标 */
.module__index {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 700;
}

/* 模块名内联可编辑：默认看起来像纯文本，聚焦后出现输入框 */
.module__name {
  flex: 1;
  min-width: 0;
}

.module__name :deep(.el-input__wrapper) {
  padding: 0 6px;
  background: transparent;
  box-shadow: none;
}

.module__name :deep(.el-input__inner) {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-1);
}

.module__name :deep(.el-input__wrapper:hover),
.module__name :deep(.el-input__wrapper.is-focus) {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

/* 模块说明与模块名一样是内联可编辑：平时像纯文本，悬浮/聚焦才出现输入框 */
.module__desc {
  margin: 2px 0 10px;
}

.modules--compact .module__desc {
  margin-bottom: 8px;
}

.module__desc :deep(.el-input__wrapper) {
  padding: 0 6px;
  background: transparent;
  box-shadow: none;
}

.module__desc :deep(.el-input__inner) {
  font-size: 12px;
  color: var(--ink-3);
}

.module__desc :deep(.el-input__wrapper:hover),
.module__desc :deep(.el-input__wrapper.is-focus) {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.module__desc :deep(.el-input__inner::placeholder) {
  color: var(--ink-3);
  opacity: 0.75;
}

.module__row {
  display: flex;
  align-items: center;
  gap: 22px;
}

.module__field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.module__field--req {
  flex: 1;
  min-width: 0;
}

.module__label {
  color: var(--ink-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.module__weight {
  width: 84px;
}

.module__unit {
  color: var(--ink-3);
  font-size: 12px;
}

.module__remove {
  flex: none;
}

.modules__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 2px;
}

.modules__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 22px;
  color: var(--ink-2);
  font-size: 12.5px;
}

.modules__metric {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.modules__metric em {
  color: var(--ink-3);
  font-size: 11.5px;
  font-style: normal;
}

.modules__summary b {
  color: var(--brand-600);
  font-size: 14px;
}

.modules__summary b.is-warn {
  color: var(--wip);
}

.modules__warn {
  color: var(--wip);
}

.modules__score {
  margin-left: 14px;
  color: var(--ink-3);
}

@media (max-width: 1280px) {
  .module__row {
    flex-wrap: wrap;
    gap: 12px 18px;
  }
}
</style>
