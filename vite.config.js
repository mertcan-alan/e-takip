import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'
import { fileURLToPath } from 'url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(() => {
  const rendererOnly = process.env.RENDERER_ONLY === 'true'

  return {
    plugins: [
      react(),
      ...(!rendererOnly
        ? [electron({
          main: {
            entry: path.resolve(projectRoot, 'src/main/index.js'),
            vite: {
              root: projectRoot,
              build: {
                outDir: path.resolve(projectRoot, 'dist-electron/main'),
              },
            },
          },
          preload: {
            input: {
              preload: path.resolve(projectRoot, 'src/main/preload.js'),
            },
            vite: {
              root: projectRoot,
              build: {
                outDir: path.resolve(projectRoot, 'dist-electron/preload'),
                rolldownOptions: {
                  output: {
                    format: 'cjs',
                    codeSplitting: false,
                    entryFileNames: 'preload.cjs',
                    chunkFileNames: '[name].cjs',
                  },
                },
              },
            },
          },
        })]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, 'src/renderer'),
        '@main': path.resolve(projectRoot, 'src/main'),
      },
    },
    root: path.resolve(projectRoot, 'src/renderer'),
    publicDir: path.resolve(projectRoot, 'public'),
    build: {
      outDir: path.resolve(projectRoot, 'dist'),
      emptyOutDir: true,
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
  }
})
