import { build } from 'esbuild';

build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: [
    // 모든 node_modules 패키지를 external로 처리
    /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/,
  ],
  packages: 'external',
  target: 'node22',
  banner: {
    js: `
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    `,
  },
}).catch(() => process.exit(1));

