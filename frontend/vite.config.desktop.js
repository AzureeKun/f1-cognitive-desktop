import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build configuration for the desktop app.
// Output goes to '../../f1-cognitive-desktop/frontend_build'
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../f1-cognitive-desktop/frontend_build',
    emptyOutDir: true,
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:5050'),
  },
})
