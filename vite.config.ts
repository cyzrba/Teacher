import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    /**
     * 真实后端代理：`/api/**` 转发到 FastAPI（默认 127.0.0.1:8000）。
     * 用代理而不是写死绝对地址，前端在开发环境同源，免掉 CORS 与端口硬编码。
     */
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
