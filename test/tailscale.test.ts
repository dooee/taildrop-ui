/**
 * Tests for the three-way setup verdict (src/tailscale.ts checkTailscale).
 * Issue #1: the app must tell "CLI missing" apart from "CLI present but the
 * tailscaled daemon isn't running", so it can guide each case differently.
 *
 * The subprocess (execa) and the binary lookup (fs.existsSync) are stubbed so
 * the three verdicts are pinned without a real tailscale install:
 *   (a) binary cannot be resolved            → no-cli
 *   (b) binary resolves, `status` errors out → daemon-down
 *   (c) binary resolves, `status` succeeds   → ok
 *
 * The module is re-imported per case (resetModules) because resolveTailscale
 * caches the resolved path in a module-level variable — a fresh module means a
 * fresh cache, so one case's resolution never leaks into the next.
 *
 * 세 갈래 셋업 판정(src/tailscale.ts checkTailscale) 테스트. 이슈 #1: 앱은 "CLI
 * 없음"과 "CLI 는 있으나 tailscaled 데몬이 안 돎"을 구분해 각각 다르게 안내해야
 * 한다. 서브프로세스(execa)와 실행 파일 탐색(fs.existsSync)을 스텁해 실제 설치
 * 없이 세 판정을 고정한다. resolveTailscale 이 경로를 모듈 변수에 캐시하므로
 * 케이스마다 모듈을 새로 임포트(resetModules)해 캐시가 새 것이 되게 한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

const execaMock = vi.hoisted(() => vi.fn());
vi.mock('execa', () => ({ execa: execaMock }));

/** Fresh module (and fresh resolveTailscale cache) per case.
 *  케이스마다 새 모듈(과 새 resolveTailscale 캐시). */
async function loadCheckTailscale() {
  vi.resetModules();
  const mod = await import('../src/tailscale.js');
  return mod.checkTailscale;
}

beforeEach(() => {
  execaMock.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkTailscale', () => {
  it('returns no-cli when the binary cannot be resolved', async () => {
    // No candidate path exists, and the PATH lookup (which/where) fails too.
    // 후보 경로도 없고 PATH 탐색(which/where)도 실패한다.
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    execaMock.mockRejectedValue(new Error('not found'));
    const checkTailscale = await loadCheckTailscale();
    expect(await checkTailscale()).toEqual({ kind: 'no-cli' });
  });

  it('returns daemon-down when the CLI resolves but `status` errors', async () => {
    // Binary is found (first candidate), but `tailscale status` exits non-zero
    // — execa rejects, which is exactly how a stopped tailscaled surfaces.
    // 실행 파일은 찾지만 `tailscale status` 가 비정상 종료한다 — execa 가 reject
    // 하며, 멈춘 tailscaled 가 드러나는 방식 그대로다.
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    execaMock.mockRejectedValue(new Error('failed to connect to local tailscaled'));
    const checkTailscale = await loadCheckTailscale();
    expect(await checkTailscale()).toEqual({ kind: 'daemon-down' });
  });

  it('returns ok when the CLI resolves and `status` succeeds', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    execaMock.mockResolvedValue({ stdout: '100.x  device  user@  macOS  -' });
    const checkTailscale = await loadCheckTailscale();
    expect(await checkTailscale()).toEqual({ kind: 'ok' });
  });

  it('runs `status` through the resolved binary', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    execaMock.mockResolvedValue({ stdout: '' });
    const checkTailscale = await loadCheckTailscale();
    await checkTailscale();
    // First (and only) execa call is the status probe, argv ['status'].
    // 첫(유일한) execa 호출은 status 프로브이며 argv 는 ['status'] 다.
    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock.mock.calls[0][1]).toEqual(['status']);
  });
});
