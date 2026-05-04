import { defineConfig } from 'vite'
import UniPlugin from '@dcloudio/vite-plugin-uni'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

// UniApp CJS/ESM 互操作：default import 返回模块对象，需取 .default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uni = (UniPlugin as any).default || UniPlugin

export default defineConfig({
  plugins: [
    uni(),
    // Post-build: copy index.html as 404.html for SPA fallback on Cloudflare Pages
    {
      name: 'copy-404-html',
      closeBundle() {
        const outDir = resolve(__dirname, 'dist/build/h5')
        try {
          copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
        } catch {}
      },
    },
  ],

  // 确保 public/ 目录下的静态文件（_redirects, _headers, robots.txt 等）
  // 在构建时被原样复制到 dist/ 根目录
  publicDir: resolve(__dirname, 'public'),

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // Cloudflare Pages 兼容性
    target: 'es2020',
    minify: 'terser',
    sourcemap: false,

    // 构建产物输出到 dist/ 目录（Cloudflare Pages 默认识别）
    outDir: 'dist',

    // 静态资源存放于 dist/assets/ 下，文件名带 hash 以支持永久缓存
    assetsDir: 'assets',

    rollupOptions: {
      output: {
        manualChunks: {
          'supabase': ['@supabase/supabase-js'],
          'vendor': ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },

  server: {
    port: 5173,
    host: '0.0.0.0',
  },
})
