/**
 * Tests for the `tailtoss --down [path]` command core (src/cli-core.ts).
 * Issue #3: receive pending files without opening the UI.
 *
 * The pieces under test are pure/injectable so no real subprocess or tailscale
 * install is needed: resolveDownDir picks the target folder from the argument,
 * the configured folder, or the cwd; runDown drives a stubbed receive() (the
 * one src/tailscale.ts function that shells out) and renders a localized
 * summary. Judging an invalid folder is receive()'s job (via dirIssueOf), so
 * here the stub returns that verdict and we assert the summary.
 *
 * `tailtoss --down [path]` 명령 코어(src/cli-core.ts) 테스트. 이슈 #3: UI 없이 대기
 * 파일 받기. 검사 대상은 순수하거나 주입 가능해 실제 서브프로세스·tailscale 설치가
 * 필요 없다. resolveDownDir 은 인자·설정 폴더·cwd 중에서 대상 폴더를 고르고,
 * runDown 은 스텁된 receive()(shell 을 타는 유일한 src/tailscale.ts 함수)를 몰아
 * 지역화된 요약을 만든다. 유효하지 않은 폴더 판정은 receive() 의 몫(dirIssueOf 경유)
 * 이라, 여기서는 스텁이 그 판정을 돌려주고 요약을 확인한다.
 */
import { describe, it, expect, vi } from 'vitest';
import { resolveDownDir, runDown } from '../src/cli-core.js';
import { makeT } from '../src/i18n.js';
import type { ReceiveResult } from '../src/tailscale.js';

const t = makeT('en');

describe('resolveDownDir', () => {
  it('uses the configured download folder when no path is given', () => {
    expect(resolveDownDir(undefined, '/cfg/Downloads', '/work')).toBe(
      '/cfg/Downloads',
    );
  });

  it('uses the given path when one is provided', () => {
    expect(resolveDownDir('/explicit/dir', '/cfg/Downloads', '/work')).toBe(
      '/explicit/dir',
    );
  });

  it('resolves "." to the current working directory', () => {
    expect(resolveDownDir('.', '/cfg/Downloads', '/work')).toBe('/work');
  });
});

describe('runDown', () => {
  const deps = (receive: (dir: string) => Promise<ReceiveResult>, over = {}) => ({
    receive: vi.fn(receive),
    configDownloadDir: '/cfg/Downloads',
    cwd: '/work',
    t,
    ...over,
  });

  it('passes the resolved directory to receive (". " → cwd)', async () => {
    const d = deps(async () => ({ ok: true, savedNames: [] }));
    await runDown('.', d);
    expect(d.receive).toHaveBeenCalledWith('/work');
  });

  it('passes the configured folder to receive when no path is given', async () => {
    const d = deps(async () => ({ ok: true, savedNames: [] }));
    await runDown(undefined, d);
    expect(d.receive).toHaveBeenCalledWith('/cfg/Downloads');
  });

  it('reports "nothing waiting" and exits 0 when no files are pending', async () => {
    const d = deps(async () => ({ ok: true, savedNames: [] }));
    const out = await runDown(undefined, d);
    expect(out.exitCode).toBe(0);
    expect(out.lines.join('\n')).toContain(t('cli.down.none'));
  });

  it('lists saved files, their count and the location on success', async () => {
    const d = deps(async () => ({
      ok: true,
      savedNames: ['report.pdf', 'notes.txt'],
    }));
    const out = await runDown('/explicit/dir', d);
    expect(out.exitCode).toBe(0);
    const text = out.lines.join('\n');
    expect(text).toContain('report.pdf');
    expect(text).toContain('notes.txt');
    // Count and destination folder both surface.
    // 개수와 저장 위치가 모두 드러난다.
    expect(text).toContain(t('cli.down.received', { n: 2 }));
    expect(text).toContain('/explicit/dir');
  });

  it('reports an invalid folder as an error and exits 1 (never auto-creates)', async () => {
    // receive() judges the folder via dirIssueOf and returns the verdict; the
    // command must surface it, not fall through to "saved 0".
    // receive() 가 dirIssueOf 로 폴더를 판정해 결과를 돌려주고, 명령은 그것을
    // 드러내야 한다 — "0개 저장"으로 흘려선 안 된다.
    const d = deps(async () => ({
      ok: false,
      savedNames: [],
      error: '/no/such/dir',
      errorCode: 'dir-missing',
    }));
    const out = await runDown('/no/such/dir', d);
    expect(out.exitCode).toBe(1);
    expect(out.lines.join('\n')).toContain(t('recv.err.dirMissing'));
  });

  it('surfaces the sudo command when receive needs elevated permission', async () => {
    const d = deps(async () => ({
      ok: false,
      savedNames: [],
      needsSudo: true,
      sudoCmd: 'sudo tailscale file get --conflict=rename /work',
      error: 'permission denied',
    }));
    const out = await runDown(undefined, d);
    expect(out.exitCode).toBe(1);
    const text = out.lines.join('\n');
    expect(text).toContain('sudo tailscale file get');
    expect(text).toContain(t('recv.needSudoTitle'));
  });
});
