import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveApiUrl } from './src/apiConfig.js'

export default defineConfig(({ command, mode, isPreview }) => {
  const localDevServer = command === 'serve' && mode === 'development' && !isPreview
  return {
    plugins: [react(), {
      name: 'validate-api-url',
      configResolved(config) {
        const allowLocalFallback = localDevServer && config.env.DEV === true
        resolveApiUrl(config.env.VITE_API_URL, allowLocalFallback)
        config.define.__ALLOW_LOCAL_API_FALLBACK__ = JSON.stringify(allowLocalFallback)
      },
    }],
    define: { __ALLOW_LOCAL_API_FALLBACK__: JSON.stringify(localDevServer) },
    server: { port: 3000 },
  }
})
