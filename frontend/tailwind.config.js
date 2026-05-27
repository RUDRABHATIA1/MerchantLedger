/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#080e1a',
        'bg-surface': '#0d1526',
        'bg-card': '#111e35',
        'bg-card-hover': '#162440',
        'bg-input': '#0a1322',
        'border-color': '#1e3052',
        'border-light': '#243a5e',
        'blue-primary': '#2563eb',
        'blue-light': '#3b82f6',
        'gold': '#f59e0b',
        'gold-light': '#fbbf24',
        'green-primary': '#10b981',
        'green-light': '#34d399',
        'red-primary': '#ef4444',
        'red-light': '#f87171',
        'purple-primary': '#8b5cf6',
        'orange-primary': '#f97316',
        'text-primary': '#f0f6ff',
        'text-secondary': '#8ba3c7',
        'text-muted': '#4d6b9a',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 16px rgba(37,99,235,0.25)',
        'glow-lg': '0 0 24px rgba(37,99,235,0.4)',
        'float': '0 8px 32px rgba(0,0,0,0.5)',
        'modal': '0 8px 40px rgba(0,0,0,0.6)',
      },
      width: {
        'sidebar': '240px',
      },
      height: {
        'topbar': '64px',
      },
      spacing: {
        'sidebar': '240px',
        'topbar': '64px',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'bg-pan': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'bg-pan': 'bg-pan 15s ease infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
}
