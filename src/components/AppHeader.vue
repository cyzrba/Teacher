<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useReviewStore } from '@/stores/review'
import { platformInfo } from '@/config/nav'
import logoImage from '@/assets/images/logo.png'

const router = useRouter()
const user = useUserStore()
const review = useReviewStore()

const profile = computed(() => user.profile)
const initial = computed(() => profile.value?.name.slice(0, 1) ?? '师')

/**
 * 三项指标：与学生端顶栏同一个位置、同一种读法。
 * 「待复核」取审核列表里状态为待复核的条数，点击直接进实训结果审核。
 */
const metrics = computed(() => [
  {
    key: 'classes',
    label: '任教班级',
    value: String(profile.value?.classCount ?? 0),
    unit: '个',
    to: '/teacher/classes',
  },
  {
    key: 'students',
    label: '负责学生',
    value: String(profile.value?.studentCount ?? 0),
    unit: '人',
    to: '/teacher/stats',
  },
  {
    key: 'pending',
    label: '待复核',
    value: String(review.pendingCount),
    unit: '份',
    to: '/teacher/reviews',
  },
])

function go(to: string): void {
  void router.push(to)
}

/** 退出登录：回到统一身份认证入口 */
async function logout(): Promise<void> {
  try {
    await ElMessageBox.confirm('退出后需要重新通过统一身份认证才能进入教师端。确认退出登录？', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  user.logout()
  await router.replace({ path: '/login' })
}

onMounted(() => {
  // 顶栏的「待复核」读数与审核页同源，失败不影响其它页面
  void review.load()
})
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <!-- 校徽 + 校名：与学生端顶栏同一块门牌 -->
      <div class="brand">
        <img class="brand__logo" :src="logoImage" :alt="platformInfo.school" />
        <span class="brand__college">
          {{ platformInfo.college }} · {{ platformInfo.portal }}
        </span>
      </div>

      <!-- 教师身份 -->
      <div class="teacher">
        <span class="teacher__avatar">{{ initial }}</span>
        <span class="teacher__meta">
          <span class="teacher__line">
            <span class="teacher__name">{{ profile?.name ?? '—' }}</span>
            <span class="teacher__no num">{{ profile?.jobNo }}</span>
          </span>
          <span class="teacher__sub">当前身份：教师 · {{ platformInfo.college }}</span>
        </span>
      </div>

      <!-- 三项指标 -->
      <div class="metrics">
        <button
          v-for="metric in metrics"
          :key="metric.key"
          class="metric"
          type="button"
          @click="go(metric.to)"
        >
          <span class="metric__label">{{ metric.label }}</span>
          <span class="metric__value">
            <span class="num">{{ metric.value }}</span>
            <span class="metric__unit">{{ metric.unit }}</span>
          </span>
        </button>
      </div>

      <!-- 环境提示 / 待办 / 退出 -->
      <div class="actions">
        <el-tooltip
          placement="bottom"
          content="当前为演示环境：数据保存在内存中，刷新页面或重新进入会重置为初始状态。"
        >
          <span class="action action--icon" role="img" aria-label="演示环境说明">
            <el-icon :size="15"><InfoFilled /></el-icon>
          </span>
        </el-tooltip>

        <button class="action" type="button" title="待复核报告" @click="go('/teacher/reviews')">
          待办
          <span v-if="review.pendingCount > 0" class="action__badge num">
            {{ review.pendingCount }}
          </span>
        </button>

        <span class="actions__split" aria-hidden="true" />

        <!-- 账号浮层用点击触发：hover 触发在触控板 / 触屏上常常点不开 -->
        <el-popover placement="bottom-end" :width="252" trigger="click">
          <template #reference>
            <button class="action" type="button">账号</button>
          </template>

          <div class="profile">
            <p class="profile__name">{{ profile?.name ?? '教师' }}</p>
            <p class="profile__row">工号 <span class="num">{{ profile?.jobNo ?? '—' }}</span></p>
            <p class="profile__row">{{ profile?.college ?? platformInfo.college }}</p>
            <p class="profile__row">
              任教班级 <span class="num">{{ profile?.classCount ?? 0 }}</span> 个 ·
              负责学生 <span class="num">{{ profile?.studentCount ?? 0 }}</span> 人
            </p>
            <el-button class="profile__logout" size="small" round @click="logout">退出登录</el-button>
          </div>
        </el-popover>

        <button class="action" type="button" title="退出登录" @click="logout">退出</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
/**
 * 顶栏：学生端同款蓝色渐变，承载「校徽 + 身份 + 指标 + 操作」。
 * 顶栏不再显示页面名，内容区直接以卡片开头（浏览器标签标题仍来自路由 meta.title）。
 */
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  width: 100%;
  height: var(--header-h);
  color: var(--ink-inv);
  background:
    radial-gradient(120% 180% at 8% -40%, rgba(255, 255, 255, 0.34), transparent 60%),
    linear-gradient(120deg, var(--brand-600) 0%, var(--brand-500) 58%, #2f8bef 100%);
  box-shadow: 0 8px 24px rgba(18, 82, 160, 0.18);
}

.app-header::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.24);
}

.app-header__inner {
  display: flex;
  align-items: center;
  gap: 22px;
  max-width: var(--shell-max);
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--shell-pad);
}

/* —— 校徽 + 校名 —— */
.brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
}

.brand__logo {
  display: block;
  height: 38px;
  width: auto;
}

.brand__college {
  font-size: 12px;
  color: var(--ink-inv-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* —— 教师身份 —— */
.teacher {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding-left: 22px;
  border-left: 1px solid rgba(255, 255, 255, 0.22);
}

.teacher__avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  background: #fff;
  color: var(--brand-600);
  font-size: 18px;
  font-weight: 700;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.24);
}

.teacher__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.teacher__line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.teacher__name {
  min-width: 0;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.teacher__no {
  font-size: 12px;
  color: var(--ink-inv-2);
}

.teacher__sub {
  font-size: 12px;
  color: var(--ink-inv-2);
  white-space: nowrap;
}

/* —— 指标读数 —— */
.metrics {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-left: auto;
  padding: 6px 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--r-sm);
  background: rgba(9, 62, 128, 0.16);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 96px;
  padding: 4px 16px;
  border: 0;
  border-radius: var(--r-chip);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease;
}

.metric + .metric {
  border-left: 1px solid rgba(255, 255, 255, 0.18);
}

.metric:hover {
  background: rgba(255, 255, 255, 0.16);
}

.metric__label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-inv-2);
}

.metric__value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.metric__unit {
  margin-left: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-inv-2);
}

/* —— 操作入口 —— */
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: var(--r-chip);
  background: rgba(255, 255, 255, 0.1);
  color: var(--ink-inv);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.action:hover {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.22);
}

.action--icon {
  justify-content: center;
  width: 32px;
  padding: 0;
  cursor: help;
}

.action__badge {
  margin-left: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--r-chip);
  background: #ff4d4f;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.actions__split {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.22);
}

/* —— 账号浮层 —— */
.profile__name {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 700;
}

.profile__row {
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.7;
}

.profile__logout {
  margin-top: 10px;
  width: 100%;
}

@media (max-width: 1500px) {
  .brand__college {
    display: none;
  }
}

@media (max-width: 1320px) {
  .metric {
    min-width: 78px;
    padding: 4px 12px;
  }

  .metric__value {
    font-size: 19px;
  }

  .teacher__sub {
    display: none;
  }
}

/**
 * 窄屏（平板横屏及以下）：指标读数整体让位，避免与教师姓名相互挤压。
 * 管理后台的主要使用场景是桌面端，窄屏优先保证「身份 + 操作」可读可点。
 */
@media (max-width: 1180px) {
  .metrics {
    display: none;
  }

  .actions {
    margin-left: auto;
  }
}
</style>
