import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import 'element-plus/dist/index.css'
import '@/assets/styles/tokens.css'
import '@/assets/styles/base.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

/** 兜底：任何未捕获的组件异常都给出可见反馈，而不是白屏 */
app.config.errorHandler = (err, _instance, info) => {
  console.error('[app error]', err, info)
  ElMessage.error('页面出现异常，请刷新后重试')
}

app.mount('#app')
