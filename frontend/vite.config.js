import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cesium()],
  // publicDir is relative to the project root (the frontend package),
  // the existing public folder is `frontend/public` on disk but from within
  // this config it should be referenced as 'public'. Leave unspecified
  // to use the default if you prefer.
  publicDir: 'public',
})
