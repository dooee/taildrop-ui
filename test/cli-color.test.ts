/**
 * Tests that the CLI render functions (src/cli-core.ts) apply color when asked
 * and degrade to byte-identical plain text otherwise. Issue #8.
 *
 * The crux: with color OFF the output must equal today's plain output exactly
 * (zero ANSI escapes), so redirected output and scripts stay clean — and the
 * default (no styler argument) must be the color-off path so the existing
 * plain-string tests keep passing unchanged. With color ON each function must
 * emit ANSI at the styled spots while still containing the same visible text.
 *
 * CLI 렌더 함수(src/cli-core.ts)가 요청 시 색을 입히고 아니면 바이트 동일한 평문으로
 * 저하하는지 검사한다(이슈 #8). 핵심: 색이 꺼지면 출력이 오늘의 평문과 정확히 같아야
 * 하고(ANSI 0개) 기본값(styler 인자 없음)이 색 꺼짐 경로여야 기존 평문 테스트가
 * 그대로 통과한다. 색이 켜지면 각 함수가 보이는 텍스트는 유지한 채 스타일 지점에
 * ANSI 를 낸다.
 */
import { describe, it, expect } from 'vitest';
import {
  renderHelp,
  renderUsage,
  renderUnknownCommand,
  renderDownResult,
} from '../src/cli-core.js';
import { makeStyle } from '../src/cli-style.js';
import { makeT } from '../src/i18n.js';
import type { ReceiveResult } from '../src/tailscale.js';

const ESC = '\x1b[';
const off = makeStyle(false);
const on = makeStyle(true);
const t = makeT('en');

/** Each render call as (colorOff, colorOn) pairs for the shared assertions.
 *  각 렌더 호출을 (색 꺼짐, 색 켜짐) 쌍으로 묶어 공통 단언에 쓴다. */
const okResult: ReceiveResult = {
  ok: true,
  savedNames: ['report.pdf', 'notes.txt'],
};

const cases: Array<{
  name: string;
  plain: string[];
  colored: string[];
}> = [
  {
    name: 'renderHelp',
    plain: renderHelp(t, off),
    colored: renderHelp(t, on),
  },
  {
    name: 'renderUsage(down)',
    plain: renderUsage(t, 'down', off),
    colored: renderUsage(t, 'down', on),
  },
  {
    name: 'renderUnknownCommand',
    plain: renderUnknownCommand(t, 'bogus', off),
    colored: renderUnknownCommand(t, 'bogus', on),
  },
  {
    name: 'renderDownResult',
    plain: renderDownResult(t, okResult, '/dl', off).lines,
    colored: renderDownResult(t, okResult, '/dl', on).lines,
  },
];

describe('CLI render functions — color off is byte-identical plain', () => {
  it('renderHelp defaults to plain when no styler is passed', () => {
    // The existing one-argument callers must keep getting plain output.
    // 기존 인자 하나짜리 호출자는 계속 평문을 받아야 한다.
    expect(renderHelp(t)).toEqual(renderHelp(t, off));
  });

  it('renderUsage defaults to plain when no styler is passed', () => {
    expect(renderUsage(t, 'down')).toEqual(renderUsage(t, 'down', off));
  });

  it('renderDownResult defaults to plain when no styler is passed', () => {
    expect(renderDownResult(t, okResult, '/dl')).toEqual(
      renderDownResult(t, okResult, '/dl', off),
    );
  });

  for (const c of cases) {
    it(`${c.name} emits zero ANSI escapes with color off`, () => {
      expect(c.plain.join('\n')).not.toContain(ESC);
    });
  }
});

describe('CLI render functions — color on adds ANSI, keeps text', () => {
  for (const c of cases) {
    it(`${c.name} contains ANSI escapes`, () => {
      expect(c.colored.join('\n')).toContain(ESC);
    });

    it(`${c.name} keeps the same visible text once ANSI is stripped`, () => {
      // Stripping the escapes must recover exactly the plain output — nothing
      // is added or removed, only wrapped.
      // 이스케이프를 벗기면 평문이 정확히 복원돼야 한다 — 감쌀 뿐 더하거나 빼지 않는다.
      // eslint-disable-next-line no-control-regex
      const stripped = c.colored.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe(c.plain.join('\n'));
    });
  }
});

describe('renderDownResult error paths carry color on but not off', () => {
  const failResult: ReceiveResult = {
    ok: false,
    savedNames: [],
    error: '/no/such/dir',
    errorCode: 'dir-missing',
  };

  it('is plain with color off', () => {
    const lines = renderDownResult(t, failResult, '/no/such/dir', off).lines;
    expect(lines.join('\n')).not.toContain(ESC);
    expect(lines.join('\n')).toContain(t('recv.err.dirMissing'));
  });

  it('is colored with color on', () => {
    const lines = renderDownResult(t, failResult, '/no/such/dir', on).lines;
    expect(lines.join('\n')).toContain(ESC);
  });
});
