import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['fol_engine'],
  },
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/arest': { target: 'https://api.auto.dev', changeOrigin: true, secure: true, headers: { 'x-api-key': process.env.DEV_API_KEY || '', 'x-user-email': process.env.DEV_USER || '' } },
      '/ai': { target: 'https://api.auto.dev', changeOrigin: true, secure: true, headers: { 'x-api-key': process.env.DEV_API_KEY || '', 'x-user-email': process.env.DEV_USER || '' } },
      '/admin': { target: 'https://api.auto.dev', changeOrigin: true, secure: true, rewrite: (path) => path.replace(/^\/admin/, ''), headers: { 'x-api-key': process.env.DEV_API_KEY || '', 'x-user-email': process.env.DEV_USER || '' } },
      '/account': { target: 'https://api.auto.dev', changeOrigin: true, secure: true, headers: { 'x-api-key': process.env.DEV_API_KEY || '' } },
    },
  },
})
