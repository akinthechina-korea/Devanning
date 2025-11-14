import { build } from 'esbuild';

build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  // pg와 관련 패키지는 번들에 포함, 나머지는 external
  external: [
    // pg는 번들에 포함시키지 않고 external로 처리
    'pg',
    '@neondatabase/serverless', // 혹시 남아있을 수 있으므로
  ],
  packages: 'external',
  target: 'node22',
  // pg 모듈을 올바르게 처리하기 위한 설정
  mainFields: ['module', 'main'],
  resolveExtensions: ['.ts', '.js', '.mjs', '.cjs'],
}).catch(() => process.exit(1));

