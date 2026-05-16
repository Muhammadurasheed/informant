import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const exposeEnv = (env: Record<string, string>) => {
  const keys = [
    'VITE_API_URL',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MEASUREMENT_ID',
  ] as const;

  return Object.fromEntries(
    keys.map((k) => [`import.meta.env.${k}`, JSON.stringify(env[k] ?? '')]),
  );
};

export default defineConfig(({ mode }) => {
  // In this repo, the extension is a subproject; load env from BOTH:
  // - project root (.env)
  // - extension folder (extension/.env)
  const rootEnv = loadEnv(mode, resolve(__dirname, '..'), '');
  const extEnv = loadEnv(mode, __dirname, '');
  const mergedEnv = { ...rootEnv, ...extEnv };

  return {
    plugins: [react()],
    define: {
      ...exposeEnv(mergedEnv),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, 'sidepanel.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
          content: resolve(__dirname, 'src/content/index.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (['background', 'content', 'sidepanel'].includes(chunkInfo.name)) {
              return '[name].js';
            }
            return 'assets/[name]-[hash].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  };
});

