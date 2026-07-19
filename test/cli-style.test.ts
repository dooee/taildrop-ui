/**
 * Tests for the dependency-free ANSI helper (src/cli-style.ts). Issue #8:
 * visually polish the non-interactive CLI output while degrading gracefully.
 *
 * The color decision is a pure predicate so the impure shell (cli.tsx) can feed
 * it real process values and it can still be unit-tested; the styler collapses
 * to identity when color is off, which is what guarantees byte-identical plain
 * output for pipes, redirects and NO_COLOR.
 *
 * 의존성 없는 ANSI 헬퍼(src/cli-style.ts) 테스트. 이슈 #8: 비대화형 CLI 출력을
 * 시각적으로 다듬되 우아하게 저하시킨다. 색 결정은 순수 술어라 불순한 껍데기
 * (cli.tsx)가 실제 process 값을 넣어도 단위 검사가 되고, styler 는 색이 꺼지면
 * 항등으로 접혀 파이프·리다이렉트·NO_COLOR 에서 바이트 동일한 평문을 보장한다.
 */
import { describe, it, expect } from 'vitest';
import { shouldColor, makeStyle, plainStyle } from '../src/cli-style.js';

const ESC = '\x1b[';

describe('shouldColor', () => {
  it('is false when NO_COLOR is set, even on a TTY', () => {
    expect(shouldColor({ isTTY: true, noColor: true })).toBe(false);
  });

  it('is false when the stream is not a TTY', () => {
    expect(shouldColor({ isTTY: false, noColor: false })).toBe(false);
  });

  it('is true on a TTY with NO_COLOR unset', () => {
    expect(shouldColor({ isTTY: true, noColor: false })).toBe(true);
  });

  it('honors FORCE_COLOR on a non-TTY, but NO_COLOR still wins', () => {
    expect(shouldColor({ isTTY: false, noColor: false, forceColor: true })).toBe(
      true,
    );
    expect(shouldColor({ isTTY: false, noColor: true, forceColor: true })).toBe(
      false,
    );
  });
});

describe('makeStyle(false) — color off', () => {
  const s = makeStyle(false);

  it('every helper is the identity (no ANSI, byte-identical input)', () => {
    for (const fn of [
      s.banner,
      s.cyan,
      s.bold,
      s.dim,
      s.green,
      s.yellow,
      s.red,
    ]) {
      expect(fn('hello')).toBe('hello');
      expect(fn('hello')).not.toContain(ESC);
    }
  });

  it('plainStyle is the color-off styler', () => {
    expect(plainStyle.bold('x')).toBe('x');
  });
});

describe('makeStyle(true) — color on', () => {
  const s = makeStyle(true);

  it('wraps text in ANSI escapes while preserving the visible text', () => {
    for (const fn of [s.cyan, s.bold, s.dim, s.green, s.yellow, s.red]) {
      const out = fn('hello');
      expect(out).toContain(ESC);
      expect(out).toContain('hello');
      // Always closes with a reset so styling never bleeds into later output.
      // 항상 reset 으로 닫아 스타일이 뒤 출력으로 새지 않게 한다.
      expect(out.endsWith('\x1b[0m')).toBe(true);
    }
  });

  it('banner carries a background so it reads as the product badge', () => {
    const out = s.banner('tailtoss');
    expect(out).toContain(ESC);
    expect(out).toContain('tailtoss');
    expect(out.endsWith('\x1b[0m')).toBe(true);
  });
});
