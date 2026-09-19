<script setup lang="ts">
/**
 * 实训结果审核 · 查阅全部作答（对接真实后端，接口文档 §9）
 *
 * 从报告列表点进来，一屏看完：逐关「学生作答 + 附件 → AI 该维度分数与评语 → 教师该维度分数与评语」，
 * 最后一关之后是「评分合计」：前端按各关权重算总分（关卡满分 = 该关权重）。
 *
 * 关键口径（都来自接口文档）：
 * - 定稿（`status=FINAL`）是唯一结算点：后端按项目层级及格线判 PASS/FAIL，写提交状态、项目完成与技能进度；
 * - 及格判定：`final_conclusion` 只由「定稿」的评审写入，PASS 即及格；
 * - AI 的 `dimension_json` 就是「每关一维」（`{name: 关卡名, score, weight, reason}`），
 *   教师用同一形状存每关分数与评语，总分取各关得分之和；
 * - **只有学生申请复审的提交才开放教师评分与评语**，其余状态只读展示作答与 AI 结果。
 */

import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PanelBlock from '@/components/PanelBlock.vue'
import StatusPill from '@/components/StatusPill.vue'
import EmptyState from '@/components/EmptyState.vue'
import { num, formatDateTime } from '@/api/backend/client'
import { useSubmissionsStore } from '@/stores/submissions'
import { fileDownloadUrl } from '@/api/backend/attempts'
import {
  answerBlocksOf,
  formatSize,
  reviewStateOf,
  stateLabelOf,
  stateToneOf,
} from '@/utils/reviewState'
import type {
  DimensionScore,
  ReviewRecord,
  SubmissionListItem,
  SubmissionStage,
} from '@/api/backend/reviews'

const route = useRoute()
const router = useRouter()
const store = useSubmissionsStore()

const submissionId = computed(() => Number(route.params.submissionId ?? 0))

function goBack(): void {
  void router.push('/teacher/reviews')
}

/** 只有「学生申请复审」的提交才开放教师评分与评语 */
const canTeacherScore = computed(
  () => Boolean(store.current) && reviewStateOf(store.current as SubmissionListItem) === 'OBJECTION',
)

/* -------------------------------------------------------------------------- */
/* 逐关数据：学生作答 + AI 维度 + 教师维度                                      */
/* -------------------------------------------------------------------------- */

/** 名称归一化：AI 有时会给维度名加「一、」「1.」这类序号前缀 */
function normalizeName(name: string | null | undefined): string {
  return (name ?? '')
    .replace(/^[（(【\[]?\s*[一二三四五六七八九十\d]+\s*[）)】\]]?\s*[、.．·:：-]?\s*/, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

const stageRows = computed(() => {
  const stages = [...(store.current?.stages ?? [])].sort((a, b) => a.stage_no - b.stage_no)
  const aiDims = store.aiReview?.dimension_json ?? []
  const teacherDims = store.teacherReview?.dimension_json ?? []
  // 维度数与关卡数一致时，允许按顺序兜底匹配（有些 AI 评分的维度名与关卡名不完全一致）
  const byIndex = aiDims.length === stages.length

  return stages.map((stage, index) => {
    const key = normalizeName(stage.stage_name ?? stage.stage_key)
    return {
      stage,
      aiDim: aiDims.find((dim) => normalizeName(dim.name) === key) ?? (byIndex ? aiDims[index] : undefined),
      teacherDim: teacherDims.find((dim) => normalizeName(dim.name) === key),
    }
  })
})

/** 关卡权重合计（正常是 100），用于展示「总分 / 满分」 */
const weightTotal = computed(() =>
  stageRows.value.reduce((sum, row) => sum + num(row.stage.weight), 0),
)

/** 这次 AI 评审有没有按关卡给分（有些历史评审只给总分与总评语） */
const aiHasStageDims = computed(() => stageRows.value.some((row) => Boolean(row.aiDim)))

/** AI 逐关得分合计（只读场景展示用） */
const aiStageTotal = computed(
  () =>
    Math.round(stageRows.value.reduce((sum, row) => sum + num(row.aiDim?.score), 0) * 10) / 10,
)

/** 教师总分：前端按各关得分合计（关卡满分 = 该关权重） */
const teacherTotal = computed(
  () =>
    Math.round(
      stageRows.value.reduce((sum, row) => sum + (teacherScores.value[row.stage.id] ?? 0), 0) * 10,
    ) / 10,
)

/** 还没打分的关卡数（定稿前提示用） */
const unscoredCount = computed(
  () => stageRows.value.filter((row) => teacherScores.value[row.stage.id] == null).length,
)

const teacherComment = ref('')
const saving = ref(false)
/** 每关的教师分数与评语，键是关卡作答 id */
const teacherScores = ref<Record<number, number | null>>({})
const teacherReasons = ref<Record<number, string>>({})

/** 把关卡分数限制在 0 ~ 该关权重之间 */
function clampScore(stage: SubmissionStage, value: number | null): number | null {
  if (value == null) return null
  const max = num(stage.weight) || 100
  return Math.min(Math.max(value, 0), max)
}

/**
 * 教师草稿：已有教师评审则回填教师自己的分数与评语，
 * 否则用 AI 的每关分数作为起点（教师只需要微调）。
 */
function loadTeacherDraft(): void {
  const teacher = store.teacherReview
  const scores: Record<number, number | null> = {}
  const reasons: Record<number, string> = {}

  for (const row of stageRows.value) {
    const fromTeacher = row.teacherDim
    const fromAi = row.aiDim
    scores[row.stage.id] = fromTeacher ? num(fromTeacher.score) : fromAi ? num(fromAi.score) : null
    reasons[row.stage.id] = fromTeacher?.reason ?? ''
  }

  teacherScores.value = scores
  teacherReasons.value = reasons
  teacherComment.value = teacher?.comment ?? ''
}

/* -------------------------------------------------------------------------- */
/* 操作：保存评审 / 标星 / 重跑 AI                                               */
/* -------------------------------------------------------------------------- */

async function saveTeacherReview(status: 'DRAFT' | 'FINAL'): Promise<void> {
  if (!store.current) return
  if (status === 'FINAL' && unscoredCount.value > 0) {
    ElMessage.warning(`还有 ${unscoredCount.value} 个关卡没有给分，可以给 0 分但要确认一遍`)
    return
  }
  if (status === 'FINAL') {
    try {
      await ElMessageBox.confirm(
        `定稿后按项目层级及格线自动判定结论，并立即结算：写提交状态、项目完成与技能进度。确认按 ${teacherTotal.value} / ${weightTotal.value} 分定稿？`,
        '定稿并结算',
        { confirmButtonText: '定稿', cancelButtonText: '再看看', type: 'warning' },
      )
    } catch {
      return
    }
  }

  saving.value = true
  try {
    // 每关一条维度：score 为该关得分（满分 = 该关权重），reason 为该关教师评语
    const dimensionJson: DimensionScore[] = stageRows.value.map((row) => ({
      name: row.stage.stage_name ?? row.stage.stage_key ?? `关卡 ${row.stage.stage_no}`,
      score: teacherScores.value[row.stage.id] ?? 0,
      weight: num(row.stage.weight),
      reason: (teacherReasons.value[row.stage.id] ?? '').trim() || null,
    }))

    await store.saveReview(
      {
        status,
        total_score: teacherTotal.value,
        comment: teacherComment.value.trim() || null,
        dimension_json: dimensionJson,
      },
      store.teacherReview,
    )
    ElMessage.success(status === 'FINAL' ? '已定稿并完成结算' : '教师评审草稿已保存')
  } catch {
    /* 失败原因由请求层提示（如已定稿不能改回草稿） */
  } finally {
    saving.value = false
  }
}

async function toggleStar(): Promise<void> {
  if (!store.current) return
  try {
    await store.star(store.current.id, !store.current.is_starred)
    ElMessage.success(store.current.is_starred ? '已取消标星' : '已标星（会留在审核列表）')
  } catch {
    /* 提示已由请求层给出 */
  }
}

const aiRunning = ref(false)

async function rerunAi(): Promise<void> {
  if (!store.current) return
  aiRunning.value = true
  try {
    const result = await store.rerunAiReview(store.current.id)
    loadTeacherDraft()
    ElMessage.success(
      result.warnings.length > 0
        ? `AI 评审完成（${result.model}），有 ${result.warnings.length} 条降级提示`
        : `AI 评审完成：${result.model}，总分 ${result.review.total_score ?? '--'}`,
    )
  } catch {
    /* 提示已由请求层给出 */
  } finally {
    aiRunning.value = false
  }
}

/* -------------------------------------------------------------------------- */

const reviewHistory = computed(() =>
  [...store.reviews].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
)

function reviewKindLabel(kind: string): string {
  return kind === 'AI' ? 'AI 评审' : '教师评审'
}

async function load(): Promise<void> {
  if (!submissionId.value) return
  await store.loadDetail(submissionId.value)
  loadTeacherDraft()
}

onMounted(async () => {
  await store.loadStudents()
  await load()
})

watch(submissionId, () => {
  void load()
})
</script>

<template>
  <div class="detail">
    <header class="detail__bar">
      <button class="back" type="button" @click="goBack">← 返回实训报告列表</button>
      <span v-if="store.current" class="detail__bar-title">
        {{ store.studentNameOf(store.current.student_id) }} ·
        {{ store.current.project_name || '--' }}
      </span>
    </header>

    <!-- 右：审核工作区 -->
    <section v-if="store.current" class="work" v-loading="store.detailLoading">
      <header class="work__head panel">
        <div class="work__title">
          <p class="work__name">
            {{ store.studentNameOf(store.current.student_id) }}
            <span class="work__project">{{ store.current.project_name || '--' }}</span>
          </p>
          <p class="work__sub">
            第 <span class="num">{{ store.current.attempt_no ?? 1 }}</span> 次挑战 ·
            第 <span class="num">{{ store.current.submit_no }}</span> 次提交 ·
            提交于 <span class="num">{{ formatDateTime(store.current.submitted_at) }}</span>
          </p>
        </div>
        <div class="work__ops">
          <StatusPill
            :tone="stateToneOf(store.current)"
            :text="stateLabelOf(store.current)"
          />
          <span class="work__conclusion">
            及格判定
            <template v-if="store.judged">
              <b :class="store.finalPassed ? 'score--good' : 'score--bad'">
                {{ store.finalPassed ? '及格' : '未及格' }}
              </b>
            </template>
            <b v-else class="muted">待判定</b>
            <em class="work__conclusion-note">
              <template v-if="store.current.final_conclusion">
                （依据
                {{ store.current.status === 'REVIEWED' ? '教师' : 'AI' }}
                定稿评审{{
                  store.current.status === 'REVIEWED'
                    ? store.teacherReview?.total_score
                      ? `：${num(store.teacherReview.total_score)} 分`
                      : ''
                    : store.aiReview?.total_score
                      ? `：${num(store.aiReview.total_score)} 分`
                      : ''
                }} · {{ store.current.final_conclusion === 'PASS' ? '通过' : '未通过' }}）
              </template>
              <template v-else>（还没有定稿的评审，结论待 AI 或教师定稿后产生）</template>
            </em>
          </span>
          <button class="icon-op" type="button" @click="toggleStar">
            {{ store.current.is_starred ? '取消标星' : '标星跟进' }}
          </button>
          <button class="icon-op" type="button" :disabled="aiRunning" @click="rerunAi">
            {{ aiRunning ? 'AI 评审中…' : '重跑 AI 评审' }}
          </button>
        </div>
      </header>

      <div class="work__body">
        <!-- ① 逐关：作答 → AI 维度分与评语 → 教师维度分与评语 -->
        <PanelBlock title="逐关作答与评分" :padded="false">
          <template #extra>
            <span class="muted">
              {{ stageRows.length }} 个关卡 · 关卡满分 = 该关权重 ·
              已完成
              <b class="num">{{ store.current.stages.filter((item) => item.is_filled).length }}</b>
              / {{ store.current.stages.length }}
            </span>
          </template>

          <ul v-if="stageRows.length" class="stage-list">
            <li v-for="(row, index) in stageRows" :key="row.stage.id" class="stage-card">
              <!-- 关卡头 -->
              <header class="stage-card__head">
                <span class="stage__no num">{{ row.stage.stage_no }}</span>
                <span class="stage__name">{{ row.stage.stage_name || row.stage.stage_key }}</span>
                <StatusPill
                  :tone="row.stage.is_filled ? 'done' : 'lock'"
                  :text="row.stage.is_filled ? '已填写' : '未填写'"
                />
                <span class="stage__meta num">满分 {{ num(row.stage.weight) }} 分</span>
              </header>

              <!-- 学生作答 -->
              <section class="part part--answer">
                <p class="part__label">学生作答</p>

                <!-- 作答内容：小标题用主色、正文用深色，长文也能扫读 -->
                <div v-if="answerBlocksOf(row.stage.answer_text).length" class="answer">
                  <template
                    v-for="(block, blockIndex) in answerBlocksOf(row.stage.answer_text)"
                    :key="blockIndex"
                  >
                    <p v-if="block.heading" class="answer__heading">{{ block.heading }}</p>
                    <p v-if="block.body" class="answer__text">{{ block.body }}</p>
                  </template>
                </div>
                <p v-else class="muted answer__empty">（该关卡没有作答内容）</p>

                <ul v-if="(store.stageFiles.get(row.stage.id) ?? []).length" class="files">
                  <li v-for="file in store.stageFiles.get(row.stage.id)" :key="file.id" class="file">
                    <span class="file__name">{{ file.original_name }}</span>
                    <span class="file__meta num">
                      {{ formatSize(file.size_bytes) }} · {{ formatDateTime(file.created_at) }}
                    </span>
                    <a
                      class="file__link"
                      :href="fileDownloadUrl(file.id)"
                      target="_blank"
                      rel="noopener"
                    >
                      下载
                    </a>
                  </li>
                </ul>
              </section>

              <!-- AI 评分 -->
              <section class="part part--ai">
                <p class="part__label">
                  AI 评分与评语
                  <span v-if="store.aiReview?.ai_model" class="muted num">
                    {{ store.aiReview.ai_model }}
                  </span>
                </p>
                <template v-if="row.aiDim">
                  <p class="part__score">
                    <b class="num">{{ num(row.aiDim.score) }}</b>
                    <span class="muted"> / {{ num(row.stage.weight) }} 分</span>
                  </p>
                  <p class="part__text">{{ row.aiDim.reason || '—' }}</p>
                </template>
                <p v-else class="muted">
                  这一关 AI 没有给出维度分（这次 AI 评审只给了总分与总评语，见下方「评分合计」）
                </p>
              </section>

              <!-- 教师评分：只有学生申请复审的提交才开放 -->
              <section v-if="canTeacherScore" class="part part--teacher">
                <p class="part__label">教师评分与评语</p>
                <div class="part__row">
                  <el-input-number
                    :model-value="teacherScores[row.stage.id]"
                    :min="0"
                    :max="num(row.stage.weight) || 100"
                    :precision="1"
                    :controls="false"
                    class="part__num"
                    @update:model-value="
                      teacherScores[row.stage.id] = clampScore(row.stage, Number($event))
                    "
                  />
                  <span class="muted">/ {{ num(row.stage.weight) }} 分</span>
                  <button
                    v-if="row.aiDim"
                    class="icon-op"
                    type="button"
                    @click="teacherScores[row.stage.id] = num(row.aiDim.score)"
                  >
                    采用 AI 分
                  </button>
                </div>
                <el-input
                  v-model="teacherReasons[row.stage.id]"
                  type="textarea"
                  :rows="2"
                  resize="none"
                  maxlength="300"
                  show-word-limit
                  placeholder="这一关的教师评语，如：光源对比实验缺量化指标，扣 2 分"
                />
              </section>
              <p v-else class="part part--locked">
                {{
                  reviewStateOf(store.current) === 'TEACHER_REVIEWED'
                    ? '教师已复审：本次分数与评语见下方「复审与评审留痕」。'
                    : '该提交还没有学生复审申请，不需要教师评分；学生提出复审后才开放教师评分与评语。'
                }}
              </p>
            </li>
          </ul>

          <EmptyState v-else title="这次提交没有关卡作答" description="可能学生还没开始填关卡。" />
        </PanelBlock>

        <!-- ② 评分合计：前端按权重算总分 -->
        <PanelBlock title="评分合计（按关卡权重）" :padded="false">
          <template #extra>
            <StatusPill
              v-if="canTeacherScore && store.teacherReview"
              :tone="store.teacherReview.status === 'FINAL' ? 'done' : 'wip'"
              :text="store.teacherReview.status === 'FINAL' ? '已定稿' : '草稿'"
            />
            <span v-else-if="canTeacherScore" class="muted">尚未评分</span>
          </template>

          <div class="total-block">
            <div class="total-head">
              <p class="total-value">
                <b class="num">{{ canTeacherScore ? teacherTotal : aiStageTotal }}</b>
                <span class="total-unit num"> / {{ weightTotal }} 分</span>
              </p>
              <p class="total-formula">
                {{
                  canTeacherScore
                    ? '总分 = 各关教师得分之和（关卡满分 = 该关权重）'
                    : 'AI 逐关得分合计（关卡满分 = 该关权重）'
                }}
                <template v-if="canTeacherScore && unscoredCount > 0">
                  · <span class="total-warn">{{ unscoredCount }} 个关卡还没给分，按 0 分计</span>
                </template>
              </p>
            </div>

            <ul class="total-list">
              <li v-for="row in stageRows" :key="row.stage.id">
                <span class="total-list__name">{{ row.stage.stage_name }}</span>
                <span class="num">
                  {{
                    canTeacherScore
                      ? (teacherScores[row.stage.id] ?? 0)
                      : num(row.aiDim?.score)
                  }}
                </span>
                <span class="muted num">/ {{ num(row.stage.weight) }}</span>
              </li>
            </ul>

            <div v-if="store.aiReview" class="ai-overall">
              <p class="part__label">
                AI 总评语
                <span class="muted num">
                  AI 总分 {{ num(store.aiReview.total_score) }} ·
                  {{ store.aiReview.ai_model ?? '--' }}
                </span>
              </p>
              <p v-if="!aiHasStageDims" class="total-formula">
                这次 AI 评审只给了总分与总评语，没有逐关维度分；需要逐关分数可以点右上「重跑 AI 评审」。
              </p>
              <p class="part__text">{{ store.aiReview.comment || '—' }}</p>
            </div>

            <!-- 教师总评语与定稿只在学生申请复审时出现 -->
            <template v-if="canTeacherScore">
              <p class="part__label">教师总评语（可选，定稿后学生端可见）</p>
              <el-input
                v-model="teacherComment"
                type="textarea"
                :rows="3"
                resize="none"
                maxlength="500"
                show-word-limit
                placeholder="写清整体扣分点与改进建议"
              />

              <div class="teacher-actions">
                <button
                  class="icon-op"
                  type="button"
                  :disabled="saving"
                  @click="saveTeacherReview('DRAFT')"
                >
                  保存草稿
                </button>
                <button
                  class="btn-primary"
                  type="button"
                  :disabled="saving"
                  @click="saveTeacherReview('FINAL')"
                >
                  {{ saving ? '保存中…' : '定稿并结算' }}
                </button>
                <span class="teacher-actions__hint">
                  定稿是唯一结算点：系统按项目层级及格线判定结论，并写项目完成与技能进度
                </span>
              </div>
            </template>
            <p v-else class="total-formula">
              {{
                reviewStateOf(store.current) === 'TEACHER_REVIEWED'
                  ? '本次已由教师复审定稿，教师分数与评语见下方「复审与评审留痕」。'
                  : '该提交没有学生复审申请，这里只展示 AI 评分与评语。'
              }}
            </p>
          </div>
        </PanelBlock>


        <!-- ③ 复审留痕 -->
        <PanelBlock title="复审与评审留痕" :padded="false">
          <div v-if="store.current.objection_reason" class="objection">
            <p class="objection__title">学生复审申请原因</p>
            <p class="objection__text">{{ store.current.objection_reason }}</p>
          </div>
          <p v-else class="objection objection--none">这条提交没有学生复审申请。</p>

          <ul class="history">
            <li v-for="record in reviewHistory" :key="record.id" class="history__item">
              <span class="history__kind">{{ reviewKindLabel(record.review_kind) }}</span>
              <StatusPill
                :tone="record.status === 'FINAL' ? 'done' : 'wip'"
                :text="record.status === 'FINAL' ? '定稿' : '草稿'"
              />
              <span class="history__score num">{{ num(record.total_score) }} 分</span>
              <span
                v-if="record.conclusion"
                class="history__conclusion"
                :class="record.conclusion === 'PASS' ? 'score--good' : 'score--bad'"
              >
                {{ record.conclusion === 'PASS' ? '通过' : '未通过' }}
              </span>
              <span class="history__time num muted">
                {{ formatDateTime(record.finished_at ?? record.created_at) }}
              </span>
              <p class="history__comment">{{ record.comment || '（无评语）' }}</p>
            </li>
          </ul>
        </PanelBlock>
      </div>
    </section>
    <section v-if="!store.current && !store.detailLoading" class="work work--empty panel">
      <EmptyState
        title="找不到这条实训报告"
        description="它可能已被删除，或者链接有误。"
        action-text="返回列表"
        @action="goBack"
      />
    </section>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.back {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-chip);
  background: var(--surface);
  color: var(--ink-2);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.back:hover {
  border-color: var(--brand-300);
  background: var(--brand-050);
  color: var(--brand-600);
}

.detail__bar-title {
  color: var(--ink-3);
  font-size: 12.5px;
}

/* —— 右栏 —— */
.work {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.work--empty {
  padding: 40px 20px;
}

.work__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 18px;
}

.work__name {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
}

.work__project {
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 600;
}

.work__sub {
  margin-top: 3px;
  color: var(--ink-3);
  font-size: 12px;
}

.work__ops {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.work__conclusion {
  color: var(--ink-2);
  font-size: 12.5px;
}

.work__conclusion b {
  font-size: 14px;
}

.work__conclusion-note {
  color: var(--ink-3);
  font-size: 11.5px;
  font-style: normal;
}

.work__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.score-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
}

.score-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.score-total {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-total b {
  color: var(--brand-600);
  font-size: 30px;
  font-weight: 700;
}

.score-total__unit {
  color: var(--ink-3);
  font-size: 13px;
}

.score-time {
  margin-left: auto;
  color: var(--ink-3);
  font-size: 11.5px;
}

/* 维度明细：AI 只读 / 教师可改 */
.dims {
  display: flex;
  flex-direction: column;
  border-top: 1px dashed var(--line);
}

.dim {
  display: grid;
  grid-template-columns: 96px 92px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line-soft);
  font-size: 12.5px;
}

.dim--edit {
  grid-template-columns: 92px 86px 44px minmax(0, 1fr);
  align-items: center;
}

.dim__name {
  color: var(--ink-1);
  font-weight: 600;
}

.dim__score {
  color: var(--brand-600);
  font-weight: 600;
}

.dim__weight {
  color: var(--ink-3);
  font-size: 11.5px;
}

.dim__reason {
  color: var(--ink-2);
  line-height: 1.6;
}

.dim__reason--edit {
  color: var(--ink-3);
  font-size: 11.5px;
}

.dim__input {
  width: 82px;
}

.score-comment {
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
  color: var(--ink-1);
  font-size: 12.5px;
  line-height: 1.8;
}

.score-comment__label {
  margin-right: 6px;
  color: var(--ink-3);
  font-weight: 600;
}

.teacher-total {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.teacher-total__num {
  width: 96px;
}

.teacher-total__hint {
  color: var(--ink-3);
  font-size: 11.5px;
}

.fld__label {
  color: var(--ink-2);
  font-size: 12.5px;
}

.fld__unit {
  color: var(--ink-3);
  font-size: 12.5px;
}

.fld--block {
  display: block;
}

.teacher-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-primary {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--brand-500);
  border-radius: var(--r-chip);
  background: var(--brand-500);
  color: #fff;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  background: var(--brand-400);
  border-color: var(--brand-400);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: wait;
}

.teacher-actions__hint {
  color: var(--ink-3);
  font-size: 11.5px;
}

/* —— 学生作答 —— */
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
}

/* 一个关卡一张卡：作答 → AI → 教师 */
.stage-card {
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-md);
  background: var(--surface);
}

.stage-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-soft);
}

.part {
  margin-top: 10px;
  padding-left: 12px;
  border-left: 2px solid var(--line);
}

.part--ai {
  border-left-color: var(--brand-300);
}

.part--teacher {
  border-left-color: var(--wip-line);
}

/* 不需要教师评分时的一行说明 */
.part--locked {
  padding-left: 12px;
  margin-top: 10px;
  border-left: 2px solid var(--line);
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.8;
}

.part__label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 600;
}

.part__score {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-bottom: 4px;
}

.part__score b {
  color: var(--brand-600);
  font-size: 20px;
  font-weight: 700;
}

.part__text {
  color: var(--ink-1);
  font-size: 12.5px;
  line-height: 1.8;
}

.part__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.part__num {
  width: 96px;
}

/* —— 评分合计 —— */
.total-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
}

.total-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.total-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.total-value b {
  color: var(--brand-600);
  font-size: 32px;
  font-weight: 700;
}

.total-unit {
  color: var(--ink-3);
  font-size: 13px;
}

.total-formula {
  color: var(--ink-3);
  font-size: 12px;
}

.total-warn {
  color: var(--wip);
  font-weight: 600;
}

.total-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px 14px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
}

.total-list li {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
}

.total-list__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-overall {
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
}

.stages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
}

.stage {
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
  background: var(--surface);
}

.stage__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stage__no {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--r-chip);
  background: var(--brand-050);
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 700;
}

.stage__name {
  font-size: 14px;
  font-weight: 700;
}

.stage__meta {
  margin-left: auto;
  color: var(--ink-3);
  font-size: 11.5px;
}

/* 作答内容：小标题（主色加粗） + 正文（深色），替代原来整块 pre */
.answer {
  margin-top: 2px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
}

.answer__heading {
  margin-top: 10px;
  color: var(--brand-600);
  font-size: 13px;
  font-weight: 700;
}

.answer__heading:first-child {
  margin-top: 0;
}

.answer__text {
  margin-top: 3px;
  color: var(--ink-1);
  font-size: 12.5px;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
}

.answer__empty {
  margin-top: 8px;
  font-size: 12.5px;
}

/* 作答附件 */
.files {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--surface);
}

.file__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file__meta {
  color: var(--ink-3);
  font-size: 11.5px;
}

.file__link {
  color: var(--brand-600);
  font-size: 12.5px;
  font-weight: 600;
}

.file__link:hover {
  text-decoration: underline;
}

.sub__pass {
  font-size: 11.5px;
  font-weight: 600;
}

/* —— 复审留痕 —— */
.objection {
  margin: 16px 18px 0;
  padding: 12px 14px;
  border: 1px solid var(--wip-line);
  border-radius: var(--r-sm);
  background: var(--wip-bg);
}

.objection--none {
  border-color: var(--line-soft);
  background: var(--surface-2);
  color: var(--ink-3);
  font-size: 12.5px;
}

.objection__title {
  margin-bottom: 4px;
  color: #b35c00;
  font-size: 12.5px;
  font-weight: 700;
}

.objection__text {
  color: #8a4b00;
  font-size: 12.5px;
  line-height: 1.8;
}

.history {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 18px 18px;
}

.history__item {
  display: grid;
  grid-template-columns: 84px auto auto auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
}

.history__kind {
  font-size: 12.5px;
  font-weight: 700;
}

.history__score {
  color: var(--ink-1);
  font-weight: 600;
}

.history__conclusion {
  font-size: 12.5px;
  font-weight: 600;
}

.history__time {
  justify-self: end;
  font-size: 11.5px;
}

.history__comment {
  grid-column: 1 / -1;
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.8;
}
</style>
