import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig(async () => {
  const { default: react } = await (Function(
    'return import("@vitejs/plugin-react")',
  )() as Promise<typeof import('@vitejs/plugin-react')>);

  const { default: tailwindcss } = await (Function(
    'return import("@tailwindcss/vite")',
  )() as Promise<typeof import('@tailwindcss/vite')>);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/renderer'),
      },
    },
  };
});
