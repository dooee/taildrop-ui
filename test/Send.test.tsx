/**
 * Component test for the Send screen's browse stage, via ink-testing-library.
 * Pins the issue #5 (part 1) behavior: the upload file browser opens in the
 * directory the command was launched from (process.cwd()), not the user's
 * home. process.cwd() is stubbed to a temp directory holding a marker file;
 * seeing that file in the frame proves the browser really listed the cwd.
 *
 * Send 화면 browse 단계의 컴포넌트 테스트(ink-testing-library). 이슈 #5
 * (part 1) 동작을 고정한다: 업로드 파일 브라우저는 유저 홈이 아니라 명령이
 * 실행된 디렉터리(process.cwd())에서 열린다. process.cwd() 를 마커 파일이 든
 * 임시 디렉터리로 바꿔치기하고, 그 파일이 프레임에 보이면 브라우저가 정말
 * cwd 를 나열한 것이다.
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Send from '../src/components/Send.js';

const MARKER = 'tailtoss-cwd-marker.txt';
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tailtoss-send-'));
  fs.writeFileSync(path.join(tmpDir, MARKER), '');
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Send (browse stage)', () => {
  it('opens the file browser in the launch directory, not the home', () => {
    const out =
      render(<Send bundleMultiple={false} onDone={() => {}} />).lastFrame() ??
      '';
    expect(out).toContain(MARKER);
  });
});
