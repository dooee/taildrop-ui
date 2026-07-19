/**
 * Tests for CLI argument parsing, routing and help rendering (src/cli-core.ts).
 * Issue #4: --help plus command error handling.
 *
 * parseArgs is a pure router — no args launches the UI, --help/-h asks for help,
 * --down is a known command (with an optional path), anything else is unknown,
 * and a known command used wrongly routes to its own usage. renderHelp and
 * renderUsage produce localized text; the full help must document --down (the
 * coupling with issue #3), and an unknown command shows the same full help
 * after its notice.
 *
 * CLI 인자 파싱·라우팅·도움말 렌더링(src/cli-core.ts) 테스트. 이슈 #4: --help 와
 * 명령어 오류 처리. parseArgs 는 순수 라우터다 — 인자 없음은 UI, --help/-h 는
 * 도움말, --down 은 (선택 경로를 갖는) 알려진 명령, 그 외는 존재하지 않는 명령,
 * 알려진 명령의 잘못된 사용은 그 명령의 usage 로 간다. renderHelp·renderUsage 는
 * 지역화 텍스트를 낸다. 전체 도움말은 --down 을 문서화해야 하고(이슈 #3 과의 커플),
 * 존재하지 않는 명령은 안내 뒤 같은 전체 도움말을 보여준다.
 */
import { describe, it, expect } from 'vitest';
import { parseArgs, renderHelp, renderUsage } from '../src/cli-core.js';
import { makeT } from '../src/i18n.js';

describe('parseArgs', () => {
  it('launches the UI when there are no arguments', () => {
    expect(parseArgs([])).toEqual({ kind: 'ui' });
  });

  it('routes --help and -h to help', () => {
    expect(parseArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseArgs(['-h'])).toEqual({ kind: 'help' });
  });

  it('routes a bare --down to the down command with no path', () => {
    expect(parseArgs(['--down'])).toEqual({ kind: 'down', path: undefined });
  });

  it('routes --down with a path to the down command', () => {
    expect(parseArgs(['--down', '/some/dir'])).toEqual({
      kind: 'down',
      path: '/some/dir',
    });
    expect(parseArgs(['--down', '.'])).toEqual({ kind: 'down', path: '.' });
  });

  it('treats an unrecognized command as unknown', () => {
    expect(parseArgs(['--nope'])).toEqual({
      kind: 'unknown',
      command: '--nope',
    });
    expect(parseArgs(['receive'])).toEqual({
      kind: 'unknown',
      command: 'receive',
    });
  });

  it('routes a misused known command to its own usage', () => {
    // Too many positionals, or a flag where a path is expected: the command is
    // known but used wrongly → usage for that command only.
    // 위치 인자 과다, 또는 경로 자리에 온 플래그: 명령은 알지만 잘못 썼다 → 그
    // 명령의 usage 만.
    expect(parseArgs(['--down', 'a', 'b'])).toEqual({
      kind: 'usage',
      command: 'down',
    });
    expect(parseArgs(['--down', '--help'])).toEqual({
      kind: 'usage',
      command: 'down',
    });
  });
});

describe('renderHelp', () => {
  for (const lang of ['en', 'ko'] as const) {
    it(`documents every command including --down (${lang})`, () => {
      const text = renderHelp(makeT(lang)).join('\n');
      // The full help lists the commands and mentions --down and --help.
      // 전체 도움말은 명령들을 나열하고 --down·--help 를 언급한다.
      expect(text).toContain('--down');
      expect(text).toContain('--help');
      expect(text).toContain(makeT(lang)('cli.desc.down'));
    });
  }
});

describe('renderUsage', () => {
  it("prints only the down command's usage synopsis", () => {
    const text = renderUsage(makeT('en'), 'down').join('\n');
    expect(text).toContain('--down');
    // Usage is a synopsis, not the whole help: the UI-launch line is absent.
    // usage 는 시놉시스라 전체 도움말이 아니다 — UI 실행 줄은 없다.
    expect(text).not.toContain(makeT('en')('cli.desc.ui'));
  });
});
