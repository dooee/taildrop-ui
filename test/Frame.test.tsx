/**
 * Component test for the common Frame wrapper, via ink-testing-library. Proves
 * the .tsx + Ink render pipeline works and covers Frame's contract: title bar,
 * screen label, body, and the optional footer. useT() falls back to ko without
 * a LangContext provider (see i18n.ts), so no provider scaffolding is needed.
 *
 * 공통 Frame 래퍼의 컴포넌트 테스트(ink-testing-library). .tsx + Ink 렌더
 * 파이프라인이 도는지 증명하고 Frame 의 규약(타이틀 바·화면 라벨·본문·선택적
 * 푸터)을 덮는다. useT() 는 프로바이더 없이 ko 로 폴백하므로 별도 스캐폴딩 불필요.
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { describe, it, expect, afterEach } from 'vitest';
import Frame, { MIN_WIDTH } from '../src/components/Frame.js';

/** Longest run of the horizontal-rule glyph in a rendered frame. Frame draws
 *  its top/bottom rules across the full box width, so this equals the width
 *  Frame chose. 프레임이 고른 폭과 같은, 렌더된 가로 구분선의 최대 길이. */
function ruleWidth(out: string): number {
  const lens = out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^─+$/.test(line))
    .map((line) => line.length);
  return lens.length ? Math.max(...lens) : 0;
}

/** Render a Frame with process.stdout.columns temporarily stubbed. */
function widthAtColumns(cols: number): number {
  Object.defineProperty(process.stdout, 'columns', {
    value: cols,
    configurable: true,
  });
  const out =
    render(
      <Frame footer="f">
        <Text>body</Text>
      </Frame>,
    ).lastFrame() ?? '';
  return ruleWidth(out);
}

const originalColumns = Object.getOwnPropertyDescriptor(
  process.stdout,
  'columns',
);

describe('Frame', () => {
  afterEach(() => {
    if (originalColumns) {
      Object.defineProperty(process.stdout, 'columns', originalColumns);
    } else {
      delete (process.stdout as unknown as { columns?: number }).columns;
    }
  });

  it('widens to fill a wide terminal instead of capping at a fixed width', () => {
    // A wide terminal was the complaint (issue #7): the frame looked "too
    // small" because width was clamped to 66. It must now grow past that.
    expect(widthAtColumns(200)).toBeGreaterThan(66);
  });

  it('grows the frame as the terminal gets wider', () => {
    expect(widthAtColumns(120)).toBeGreaterThan(widthAtColumns(60));
  });

  it('keeps a minimum width once the terminal is wide enough', () => {
    // Just below the floor + margin, the frame is held at MIN_WIDTH.
    expect(widthAtColumns(MIN_WIDTH + 1)).toBe(MIN_WIDTH);
  });

  it('never overflows a terminal narrower than the minimum width', () => {
    // On a very narrow terminal we fit the terminal rather than force the
    // floor and overflow — the frame must never be wider than what's there.
    for (const cols of [10, 20]) {
      const width = widthAtColumns(cols);
      expect(width).toBeGreaterThan(0); // still renders, no crash
      expect(width).toBeLessThanOrEqual(cols); // no overflow
    }
  });

  it('reacts to a live terminal resize', async () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 60,
      configurable: true,
    });
    const app = render(
      <Frame footer="f">
        <Text>body</Text>
      </Frame>,
    );
    const before = ruleWidth(app.lastFrame() ?? '');
    // Let Frame's effect attach its 'resize' listener (passive effects run
    // after commit). 프레임의 'resize' 리스너가 붙을 틈을 준다.
    await new Promise((resolve) => setTimeout(resolve, 0));

    Object.defineProperty(process.stdout, 'columns', {
      value: 200,
      configurable: true,
    });
    process.stdout.emit('resize');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ruleWidth(app.lastFrame() ?? '')).toBeGreaterThan(before);
  });

  it('renders the product title, the default (ko) subtitle, and the body', () => {
    const out = render(
      <Frame>
        <Text>body-here</Text>
      </Frame>,
    ).lastFrame() ?? '';
    expect(out).toContain('Tailtoss');
    expect(out).toContain('tailscale 파일 송수신'); // default ko subtitle
    expect(out).toContain('body-here');
  });

  it('shows the screen label when one is given', () => {
    const out = render(
      <Frame screen="설정">
        <Text>x</Text>
      </Frame>,
    ).lastFrame() ?? '';
    expect(out).toContain('설정');
  });

  it('shows the footer only when provided', () => {
    const without = render(
      <Frame>
        <Text>x</Text>
      </Frame>,
    ).lastFrame() ?? '';
    const withFooter = render(
      <Frame footer="Esc: back">
        <Text>x</Text>
      </Frame>,
    ).lastFrame() ?? '';
    expect(withFooter).toContain('Esc: back');
    expect(without).not.toContain('Esc: back');
  });
});
