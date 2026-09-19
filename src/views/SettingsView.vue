<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import PanelBlock from '@/components/PanelBlock.vue'
import StatusPill from '@/components/StatusPill.vue'
import EmptyState from '@/components/EmptyState.vue'
import ListPagination from '@/components/ListPagination.vue'
import { usePaging } from '@/composables/usePaging'
import { useGrowthStore } from '@/stores/growth'
import { useSystemConfigStore } from '@/stores/systemConfig'
import { TIER_LABEL, TIER_FULL_LABEL } from '@/types'
import { tierTone } from '@/utils/format'
import { formatDateTime } from '@/api/backend/client'
import type { SystemConfig } from '@/api/backend/configs'

const route = useRoute()
const router = useRouter()
const growthStore = useGrowthStore()
const configStore = useSystemConfigStore()

/**
 * 系统配置页按 Tab 组织：
 * ① 成长规则配置（层级解锁 / 满级标准 / 匹配口径，走 Mock 的 growth store）；
 * ② 更多设置 —— 平台参数，即后端 `/api/system-configs` 的增删改查（AI 模型、检索参数、证书编号规则…）。
 */
const activeTab = ref<string>(typeof route.query.tab === 'string' ? route.query.tab : 'growth')
watch(activeTab, (value) => {
  void router.replace({ query: { ...route.query, tab: value } })
})

const saving = ref(false)

async function saveRules(): Promise<void> {
  saving.value = true
  try {
    await growthStore.save()
    ElMessage.success('成长规则已保存（演示数据刷新会重置）')
  } finally {
    saving.value = false
  }
}

/* -------------------------------------------------------------------------- */
/* Tab 2 · 更多设置（平台参数，真实后端 §3.3）                                  */
/* -------------------------------------------------------------------------- */

const configKeyword = ref('')

const filteredConfigs = computed(() => {
  const target = configKeyword.value.trim().toLowerCase()
  if (!target) return configStore.list
  return configStore.list.filter(
    (item) =>
      item.config_key.toLowerCase().includes(target) ||
      (item.description ?? '').toLowerCase().includes(target) ||
      JSON.stringify(item.config_value).toLowerCase().includes(target),
  )
})

const {
  page: configPage,
  pageSize: configPageSize,
  total: configTotal,
  paged: configRows,
  reset: resetConfigPage,
} = usePaging(() => filteredConfigs.value)

watch(configKeyword, () => resetConfigPage())

/** 配置值一行摘要 + 悬浮看完整 JSON */
function valueSummary(config: SystemConfig): string {
  return JSON.stringify(config.config_value ?? {})
}

function valuePretty(config: SystemConfig): string {
  return JSON.stringify(config.config_value ?? {}, null, 2)
}

const configDialogVisible = ref(false)
const editingConfigId = ref<number | null>(null)
const configSaving = ref(false)
const configFormRef = ref<FormInstance>()

const configForm = reactive({
  config_key: '',
  description: '',
  valueText: '{}',
})

const configRules: FormRules = {
  config_key: [{ required: true, message: '请输入配置键', trigger: 'blur' }],
}

function openConfigCreate(): void {
  editingConfigId.value = null
  Object.assign(configForm, { config_key: '', description: '', valueText: '{\n  \n}' })
  configDialogVisible.value = true
}

function openConfigEdit(row: SystemConfig): void {
  editingConfigId.value = row.id
  Object.assign(configForm, {
    config_key: row.config_key,
    description: row.description ?? '',
    valueText: valuePretty(row),
  })
  configDialogVisible.value = true
}

/** 把配置值美化成缩进 JSON，顺手做一次校验 */
function formatConfigValue(): void {
  try {
    configForm.valueText = JSON.stringify(JSON.parse(configForm.valueText), null, 2)
    ElMessage.success('已格式化为缩进 JSON')
  } catch {
    ElMessage.error('配置值不是合法 JSON，请检查括号与引号')
  }
}

async function submitConfig(): Promise<void> {
  const valid = await configFormRef.value?.validate().catch(() => false)
  if (!valid) return

  // 配置值必须是 JSON 对象（后端 schema 也要求 object）
  let parsed: unknown
  try {
    parsed = JSON.parse(configForm.valueText)
  } catch {
    ElMessage.error('配置值不是合法 JSON，请检查括号与引号')
    return
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    ElMessage.error('配置值需要是一个 JSON 对象，例如 {"model": "Kimi 2.6"}')
    return
  }

  const payload = {
    config_key: configForm.config_key.trim(),
    description: configForm.description.trim() || null,
    config_value: parsed as Record<string, unknown>,
  }

  configSaving.value = true
  try {
    if (editingConfigId.value) {
      await configStore.update(editingConfigId.value, payload)
      ElMessage.success('配置已更新（整体替换，不是深合并）')
    } else {
      await configStore.create(payload)
      ElMessage.success('配置已新增')
    }
    configDialogVisible.value = false
  } catch {
    /* 失败原因由请求层给出（如配置键重复） */
  } finally {
    configSaving.value = false
  }
}

async function removeConfig(row: SystemConfig): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后依赖「${row.config_key}」的功能会退回默认值。确认删除？`,
      '删除配置',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await configStore.remove(row.id)
    ElMessage.success('配置已删除')
  } catch {
    /* 提示已由请求层给出 */
  }
}

onMounted(async () => {
  await Promise.all([growthStore.load(), configStore.load()])
})
</script>

<template>
  <div class="settings">
    <!-- 页面标题已由外层布局渲染（「系统配置」） -->
    <PanelBlock :padded="false">
      <el-tabs v-model="activeTab" class="tabs">
        <!-- 成长规则配置（原「岗位与技能体系」页内的 Tab，迁移到这里） -->
        <el-tab-pane name="growth">
          <template #label><span class="tab-label">成长规则配置</span></template>

          <div class="growth">
            <p class="growth__intro">
              配置基础 / 进阶 / 拓展三层项目的解锁条件、技能树满级标准与等级说明；
              匹配设置决定岗位与实训项目的匹配度算法口径。
            </p>

            <article v-for="rule in growthStore.rules" :key="rule.tier" class="rule">
              <header class="rule__head">
                <span class="rule__title">{{ TIER_FULL_LABEL[rule.tier] }}</span>
                <StatusPill
                  class="rule__badge"
                  :tone="tierTone[rule.tier]"
                  :text="`${TIER_FULL_LABEL[rule.tier]}`"
                />
              </header>

              <dl class="rule__body">
                <div class="rule__row">
                  <dt>解锁条件：</dt>
                  <dd><el-input v-model="rule.unlockCondition" /></dd>
                </div>
                <div class="rule__row">
                  <dt>技能树满级标准：</dt>
                  <dd><el-input v-model="rule.masteryStandard" /></dd>
                </div>
                <div class="rule__row">
                  <dt>最大等级：</dt>
                  <dd class="rule__inline">
                    <el-input-number
                      v-model="rule.maxLevel"
                      :min="1"
                      :max="30"
                      :controls="false"
                      class="rule__num"
                    />
                    <span class="rule__unit">级</span>
                  </dd>
                  <dt class="rule__dt-inline">通过分数：</dt>
                  <dd class="rule__inline">
                    <el-input-number
                      v-model="rule.passScore"
                      :min="0"
                      :max="100"
                      :controls="false"
                      class="rule__num"
                    />
                    <span class="rule__unit">分</span>
                  </dd>
                </div>
                <div class="rule__row">
                  <dt>等级说明：</dt>
                  <dd>
                    <el-input v-model="rule.levelDescription" type="textarea" :rows="2" resize="none" />
                  </dd>
                </div>
                <div class="rule__row">
                  <dt>匹配设置：</dt>
                  <dd class="rule__inline">
                    <span class="rule__label">技能匹配数量</span>
                    <el-input-number
                      v-model="rule.matchCount"
                      :min="1"
                      :max="20"
                      :controls="false"
                      class="rule__num"
                    />
                    <span class="rule__unit">项</span>
                    <span class="rule__label rule__label--gap">关联度</span>
                    <el-input-number
                      v-model="rule.relevance"
                      :min="0"
                      :max="100"
                      :controls="false"
                      class="rule__num"
                    />
                    <span class="rule__unit">%</span>
                  </dd>
                </div>
              </dl>

              <footer class="rule__foot">
                <el-button type="primary" round :loading="saving" @click="saveRules">
                  保存{{ TIER_LABEL[rule.tier] }}项目规则
                </el-button>
                <!-- 点亮进度展示位：判定逻辑（多次达标才点亮）按需求标注为二期实现 -->
                <span class="rule__progress-slot">
                  <span class="rule__label">技能点亮进度展示位</span>
                  <span class="tag-plain">当前点亮次数 / 所需次数</span>
                  <span class="rule__tip">判定逻辑（多次评分达标才点亮）标注为可后续完成</span>
                </span>
              </footer>
            </article>
          </div>
        </el-tab-pane>

        <!-- 后续设置项的入口：本页按 Tab 组织，新增设置只需追加一个 Tab -->
        <el-tab-pane name="more">
          <template #label><span class="tab-label">更多设置</span></template>

          <div class="toolbar">
            <p class="toolbar__hint">
              平台参数：AI 模型、检索参数、证书编号规则等都在这张表里，改完立即生效，不需要改代码。
              配置值是 JSON 对象，保存时整体替换。
            </p>
            <div class="toolbar__right">
              <el-input
                v-model="configKeyword"
                class="toolbar__search"
                placeholder="搜索配置键 / 说明 / 值"
                clearable
              />
              <el-button type="primary" round @click="openConfigCreate">＋ 新增配置</el-button>
            </div>
          </div>

          <el-table
            v-if="configRows.length > 0 || configStore.loading"
            :data="configRows"
            v-loading="configStore.loading"
            style="width: 100%"
          >
            <el-table-column label="配置键" width="200">
              <template #default="{ row }">
                <span class="config-key num">{{ row.config_key }}</span>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="240">
              <template #default="{ row }">
                <span :class="{ muted: !row.description }">{{ row.description || '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="配置值（JSON）" min-width="300">
              <template #default="{ row }">
                <el-tooltip placement="top-start" :show-after="200">
                  <template #content>
                    <pre class="config-json-preview">{{ valuePretty(row) }}</pre>
                  </template>
                  <span class="config-value num">{{ valueSummary(row) }}</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="150">
              <template #default="{ row }">
                <span class="num muted">{{ formatDateTime(row.updated_at) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <div class="ops">
                  <el-button type="primary" size="small" round @click="openConfigEdit(row)">编辑</el-button>
                  <el-button class="btn-danger" size="small" round @click="removeConfig(row)">
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <ListPagination
            v-model:page="configPage"
            v-model:page-size="configPageSize"
            :total="configTotal"
          />

          <EmptyState
            v-if="!configRows.length && !configStore.loading"
            title="没有匹配的配置"
            description="换个关键词，或点「新增配置」加一条平台参数。"
          />
        </el-tab-pane>
      </el-tabs>
    </PanelBlock>

    <!-- 新增 / 编辑平台配置 -->
    <el-dialog
      v-model="configDialogVisible"
      :title="editingConfigId ? '编辑配置' : '新增配置'"
      width="600px"
      align-center
    >
      <el-form ref="configFormRef" :model="configForm" :rules="configRules" label-position="top">
        <el-form-item label="配置键" prop="config_key">
          <el-input v-model="configForm.config_key" placeholder="如：qa.limits（全局唯一）" />
        </el-form-item>

        <el-form-item label="说明">
          <el-input
            v-model="configForm.description"
            placeholder="这条配置管什么，便于其他人接手"
          />
        </el-form-item>

        <el-form-item label="配置值（JSON 对象）">
          <el-input
            v-model="configForm.valueText"
            type="textarea"
            :rows="8"
            resize="none"
            spellcheck="false"
            placeholder='{"model": "Kimi 2.6", "context_rounds": 3}'
          />
          <div class="config-tools">
            <el-button text type="primary" @click="formatConfigValue">格式化为缩进 JSON</el-button>
            <span class="config-tools__hint">
              保存时整体替换该配置值（不做深合并），大模型 / 向量集合换版本时记得同步升级版本号
            </span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button round @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="configSaving" @click="submitConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.tabs :deep(.el-tabs__header) {
  padding: 8px 20px 0;
  border-bottom: 1px solid var(--line);
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.growth {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.growth__intro {
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.8;
}

.rule {
  padding: 18px 20px 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-md);
  background: var(--surface);
}

.rule__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.rule__title {
  font-size: 15px;
  font-weight: 700;
}

.rule__badge {
  margin-left: auto;
}

.rule__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule__row dt {
  flex: none;
  width: 128px;
  color: var(--ink-2);
  font-size: 13px;
  text-align: right;
}

.rule__row dd {
  flex: 1;
  min-width: 0;
  margin: 0;
}

.rule__inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule__num {
  width: 130px;
}

.rule__unit {
  color: var(--ink-3);
  font-size: 12.5px;
}

.rule__label {
  color: var(--ink-2);
  font-size: 13px;
}

.rule__label--gap {
  margin-left: 12px;
}

.rule__dt-inline {
  width: auto !important;
  margin-left: 16px;
}

.rule__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.rule__progress-slot {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rule__tip {
  color: var(--ink-3);
  font-size: 11.5px;
}

/* —— Tab 2 · 更多设置（平台参数） —— */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 20px 12px;
}

.toolbar__hint {
  max-width: 620px;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.7;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar__search {
  width: 240px;
}

.ops {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-danger {
  color: var(--danger-ink);
  border-color: var(--danger-line);
  background: #fff;
}

.btn-danger:hover {
  color: var(--danger-ink);
  border-color: var(--danger-line);
  background: var(--danger-bg);
}

.config-key {
  color: var(--brand-600);
  font-weight: 600;
}

.config-value {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--ink-2);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.config-json-preview {
  max-width: 520px;
  max-height: 320px;
  margin: 0;
  overflow: auto;
  font-family: var(--font-num);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre;
}

.config-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.config-tools__hint {
  color: var(--ink-3);
  font-size: 11.5px;
  line-height: 1.7;
}
</style>
