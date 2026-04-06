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
    minify: false,
    rollupOptions: {
      maxParallelFileOps: 1,
    },
  },
})
