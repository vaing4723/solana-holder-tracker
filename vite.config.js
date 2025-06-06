import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 监听所有地址，包括局域网和公网地址
    port: 3000, // 明确指定端口
  },
}) 