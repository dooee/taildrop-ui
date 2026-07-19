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
import { describe, it, expect } from 'vitest';
import Frame from '../src/components/Frame.js';

describe('Frame', () => {
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
