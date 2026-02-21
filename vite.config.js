import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/thermodynamics/', // ← GitHubのリポジトリ名に合わせて変更してください
  plugins: [react()],
})
