<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import gateImage from '@/assets/images/gate.jpg'
import logoImage from '@/assets/images/logo.png'
import { platformInfo } from '@/config/nav'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const pending = ref<'teacher' | 'student' | null>(null)

/** 教师端入口：模拟统一身份认证 → 写入登录态 → 进入数据总览 */
async function enterTeacher(): Promise<void> {
  if (pending.value) return
  pending.value = 'teacher'
  try {
    await user.loginAsTeacher()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/teacher/dashboard'
    ElMessage.success('统一身份认证通过，正在进入教学管理后台')
    await router.replace(redirect)
  } finally {
    pending.value = null
  }
}

/** 学生身份：演示角色分流（学生会拿到学生角色，无法进入教师端） */
async function enterStudent(): Promise<void> {
  if (pending.value) return
  pending.value = 'student'
  try {
    await user.loginAsStudent()
    user.logout()
    ElMessage.warning('该身份为学生，教师端仅对教师角色开放')
  } finally {
    pending.value = null
  }
}

/** SSO 回调：?key=xxx → 查身份 → 存 Token → 按角色分流 */
async function handleCallback(key: string): Promise<void> {
  const result = await user.loginByKey(key)
  if (result.role !== 'teacher') {
    user.logout()
    ElMessage.warning('该身份为学生，教师端仅对教师角色开放')
    return
  }
  ElMessage.success('身份校验通过，正在进入教学管理后台')
  await router.replace('/teacher/dashboard')
}

onMounted(() => {
  if (route.query.denied === '1') {
    ElMessage.warning('当前身份无权访问教师端，请使用教师账号登录')
  }
  const key = route.query.key
  if (typeof key === 'string' && key.length > 0) {
    void handleCallback(key)
  }
})
</script>

<template>
  <div class="gate">
    <img class="gate__photo" :src="gateImage" alt="深圳职业技术大学校园正门" />
    <div class="gate__scrim" aria-hidden="true" />

    <div class="gate__inner">
      <header class="gate__brand">
        <img class="gate__logo" :src="logoImage" :alt="platformInfo.school" />
        <span class="gate__college">{{ platformInfo.college }} · {{ platformInfo.platform }}</span>
      </header>

      <div class="gate__grid">
        <div class="gate__intro">
          <p class="gate__eyebrow">教学管理后台</p>
          <h1 class="gate__headline">把课堂交给你，<br />把流程交给平台。</h1>
          <p class="gate__lede">
            班级与任务、实训项目、岗位与技能体系、结果审核、学习过程统计到企业认证证书，
            教学管理的全流程都在同一个后台里。
          </p>

          <dl class="gate__plaque">
            <div class="plaque-item">
              <dt>平台版本</dt>
              <dd class="num">{{ platformInfo.version }}</dd>
            </div>
            <div class="plaque-item">
              <dt>接入方式</dt>
              <dd>学校统一身份认证</dd>
            </div>
            <div class="plaque-item">
              <dt>服务范围</dt>
              <dd>教师端 · 教学管理</dd>
            </div>
          </dl>
        </div>

        <div class="gate__roles">
          <p class="gate__roles-title">选择你的入口</p>

          <button
            class="role role--teacher"
            type="button"
            :disabled="Boolean(pending)"
            @click="enterTeacher"
          >
            <span class="role__body">
              <span class="role__name">教师端</span>
              <span class="role__desc">班级任务、项目与岗位配置、结果审核、证书发放</span>
            </span>
            <span class="role__foot">
              <span class="role__foot-text">
                {{ pending === 'teacher' ? '正在认证…' : '模拟统一身份认证 · 点击进入' }}
              </span>
              <span class="role__arrow" aria-hidden="true">→</span>
            </span>
          </button>

          <button
            class="role role--student"
            type="button"
            :disabled="Boolean(pending)"
            @click="enterStudent"
          >
            <span class="role__body">
              <span class="role__name">学生端</span>
              <span class="role__desc">查看技能树、闯关实训与认证（请前往学生端入口）</span>
            </span>
            <span class="role__foot">
              <span class="role__foot-text">
                {{ pending === 'student' ? '正在校验…' : '教师端不提供学生功能' }}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gate {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100vh;
  overflow: hidden;
  background: #061529;
}

.gate__photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 38%;
}

.gate__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      104deg,
      rgba(6, 24, 52, 0.9) 0%,
      rgba(8, 36, 74, 0.74) 38%,
      rgba(10, 48, 96, 0.34) 66%,
      rgba(6, 22, 46, 0.78) 100%
    ),
    linear-gradient(180deg, rgba(4, 18, 38, 0.55) 0%, transparent 26%, rgba(4, 18, 38, 0.62) 100%);
}

.gate__inner {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 44px;
  width: 100%;
  max-width: 1200px;
  padding: 44px 24px 52px;
}

.gate__brand {
  display: flex;
  align-items: center;
  gap: 18px;
  color: #fff;
}

.gate__logo {
  display: block;
  height: 48px;
  width: auto;
}

.gate__college {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12.5px;
  letter-spacing: 0.1em;
}

.gate__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 372px;
  gap: 64px;
  align-items: center;
}

.gate__intro {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 560px;
  color: #fff;
}

.gate__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.34em;
  color: rgba(255, 255, 255, 0.76);
}

.gate__headline {
  font-size: 44px;
  font-weight: 700;
  line-height: 1.24;
  letter-spacing: 0.02em;
  text-shadow: 0 4px 24px rgba(0, 20, 48, 0.4);
}

.gate__lede {
  max-width: 480px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 14.5px;
  line-height: 1.85;
}

.gate__plaque {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.plaque-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 14px 26px 0 0;
  margin-right: 26px;
  border-right: 1px solid rgba(255, 255, 255, 0.16);
}

.plaque-item:last-child {
  border-right: 0;
  margin-right: 0;
}

.plaque-item dt {
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  letter-spacing: 0.16em;
}

.plaque-item dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.gate__roles {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 26px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--r-lg);
  background: rgba(9, 30, 62, 0.44);
  backdrop-filter: blur(14px);
  box-shadow: 0 24px 60px rgba(2, 12, 30, 0.42);
}

.gate__roles-title {
  margin-bottom: 2px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.22em;
}

.role {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.role:disabled {
  cursor: wait;
  opacity: 0.75;
}

.role__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role__name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.role__desc {
  color: rgba(255, 255, 255, 0.66);
  font-size: 12.5px;
  line-height: 1.6;
}

.role__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
}

.role__foot-text {
  font-size: 12px;
}

.role__arrow {
  font-size: 15px;
  transition: transform 0.2s ease;
}

.role--teacher {
  background: linear-gradient(140deg, rgba(22, 119, 255, 0.42), rgba(18, 89, 188, 0.18));
  border-color: rgba(140, 200, 255, 0.5);
}

.role--teacher .role__foot-text {
  color: #9cc6fb;
  font-weight: 600;
}

.role--teacher:hover {
  transform: translateY(-2px);
  background: linear-gradient(140deg, rgba(22, 119, 255, 0.62), rgba(18, 89, 188, 0.28));
  border-color: #9cc6fb;
}

.role--teacher:hover .role__arrow {
  transform: translateX(4px);
}

.role--student {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.role--student .role__name,
.role--student .role__desc,
.role--student .role__foot-text {
  opacity: 0.6;
}

.role--student:hover {
  background: rgba(255, 255, 255, 0.07);
}

@media (max-width: 1080px) {
  .gate__grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 34px;
  }

  .gate__headline {
    font-size: 34px;
  }
}
</style>
