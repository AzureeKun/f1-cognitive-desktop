import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This config is used to build the frontend for the desktop app.
// Output goes to ../frontend_build (sibling of python-backend/)
export default defineConfig({
  plugins: [react()],
  root: '../development/frontend',
  build: {
    outDir: '../../f1-cognitive-desktop/frontend_build',
    emptyOutDir: true,
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:5000'),
  },
})
