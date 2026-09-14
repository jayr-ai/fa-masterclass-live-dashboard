import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so this build is portable to whatever subpath it's
  // mounted under on the au-fa-dashboard hub (e.g. /marketing-dashboard/).
  base: './',
  plugins: [react()],
})
