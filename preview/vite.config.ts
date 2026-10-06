import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url));
export default defineConfig({
  root: path('./'),
  publicDir: path('../public'),
  plugins: [react()],
  resolve: { alias: {
    'next/link': path('./link.tsx'),
    'next/navigation': path('./navigation.ts'),
    '@': path('../'),
  } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: path('../outputs/vercel-preview/.vercel/output/static'), emptyOutDir: true, sourcemap: false },
});
