const { spawn } = require('child_process')
const path = require('path')

const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe')

const proc = spawn(electronExe, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    // ELECTRON_DEV: 'true' → 프로덕션 모드: dist/index.html 로드
  },
})

proc.on('close', (code) => {
  console.log('Electron 종료:', code)
})

proc.on('error', (err) => {
  console.error('실행 오류:', err)
})
