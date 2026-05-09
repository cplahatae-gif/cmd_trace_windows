import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Windows: 한글 경로에서 Rollup 네이티브 바이너리가 행업됨
    // 빌드 시 임시 경로 사용 후 dist/로 복사:
    //   npx vite build --outDir /c/tmp/cmdtrace-build --emptyOutDir
    //   cp -r /c/tmp/cmdtrace-build dist
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      maxParallelFileOps: 1,
      output: {
        manualChunks: {
          // 차트 라이브러리 (Dashboard / InsightsView에서만 사용)
          'vendor-charts': ['recharts'],
          // 마크다운 + 코드 하이라이트 (MessageView에서만 사용)
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'react-syntax-highlighter'],
          // 날짜 포맷 (date-fns + locale)
          'vendor-dates': ['date-fns', 'date-fns/locale'],
        },
      },
    },
  },
})
