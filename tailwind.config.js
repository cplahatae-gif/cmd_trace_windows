/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Flex-inspired 브랜드 컬러 (모던 인디고/퍼플)
        brand: {
          50:  '#f0eeff',
          100: '#e0ddff',
          200: '#c4bfff',
          300: '#a099fc',
          400: '#7e74f9',
          500: '#635bff',
          600: '#5147e0',
          700: '#4038c0',
          800: '#312e99',
          900: '#24237a',
        },
        // 배경 레이어 (CSS 변수 — 다크/라이트 자동 전환)
        surface: {
          base:   'var(--surface-base)',
          soft:   'var(--surface-soft)',
          subtle: 'var(--surface-subtle)',
        },
        // 텍스트 계층
        ink: {
          primary:   'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          muted:     'var(--ink-muted)',
          faint:     'var(--ink-faint)',
        },
        // 보더
        border: 'var(--border-color)',
      },
      borderColor: {
        DEFAULT: 'var(--border-color)',
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        panel: '0 2px 8px rgba(0,0,0,0.06)',
        modal: '0 8px 32px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
}
