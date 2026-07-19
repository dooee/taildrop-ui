import { defineConfig } from 'vitest/config';

/**
 * Vitest runs from source (no build step): Vite resolves the project's `.js`
 * import specifiers back to their `.ts` files, and esbuild handles TSX. Tests
 * live in test/, outside src/, so `tsc` (include: ["src"]) never compiles them
 * into dist.
 *
 * Vitest 는 빌드 없이 소스에서 돈다. Vite 가 이 프로젝트의 `.js` import 지정자를
 * 원본 `.ts` 로 되돌려 해석하고, esbuild 가 TSX 를 처리한다. 테스트는 src/ 밖의
 * test/ 에 두어 `tsc`(include: ["src"]) 가 dist 로 컴파일하지 않는다.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
  },
});
