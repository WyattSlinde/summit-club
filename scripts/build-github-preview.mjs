import { build } from 'vite';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'outputs/github-pages');
await build({
  configFile: path.join(root, 'preview/vite.config.ts'),
  base: '/summit-club/',
  build: { outDir: output },
});
for (const route of ['register', 'leadership', 'profile', 'members']) {
  await mkdir(path.join(output, route), { recursive: true });
  await copyFile(path.join(output, 'index.html'), path.join(output, route, 'index.html'));
}
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`GitHub Pages preview ready at ${output}`);
