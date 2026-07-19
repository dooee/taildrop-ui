import path from 'node:path';
import type { ReceiveResult } from './tailscale.js';

/**
 * The CLI surface, kept apart from cli.tsx so it can be exercised without a
 * React render or a real subprocess. cli.tsx is a thin shell: it drives
 * receive() (the one src/tailscale.ts function that shells out) for --down and
 * prints what these functions return. Everything user-facing comes from the
 * dictionary via a translator, so both languages stay in sync.
 *
 * CLI 표면. React 렌더나 실제 서브프로세스 없이 검사할 수 있도록 cli.tsx 와
 * 분리한다. cli.tsx 는 얇은 껍데기다 — --down 은 receive()(shell 을 타는 유일한
 * src/tailscale.ts 함수)를 몰며, 이 함수들이 돌려주는 것을 출력한다. 사용자에게
 * 보이는 문구는 전부 번역기를 거쳐 사전에서 오므로 두 언어가 어긋나지 않는다.
 */

/** A translator, as produced by makeT(lang). Passed in rather than imported so
 *  these functions stay pure and testable in either language.
 *  makeT(lang) 이 만드는 번역기. 순수·양쪽 언어 검사가 가능하도록 임포트가 아니라
 *  인자로 받는다. */
export type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Picks the folder --down should save into: the given path, or the configured
 * download folder when none is given, with "." meaning the current directory.
 * Whether that folder is usable is receive()'s call (via dirIssueOf); this only
 * decides which folder. cwd is passed in, not read, so the choice stays pure.
 *
 * --down 이 저장할 폴더를 고른다: 주어진 경로, 없으면 설정된 다운로드 폴더, "." 은
 * 현재 디렉터리. 그 폴더가 쓸 만한지는 receive() 가 판정한다(dirIssueOf 경유). 이
 * 함수는 어느 폴더인지만 정한다. cwd 는 읽지 않고 인자로 받아 선택이 순수하게
 * 유지된다.
 */
export function resolveDownDir(
  pathArg: string | undefined,
  configDownloadDir: string,
  cwd: string,
): string {
  if (pathArg === undefined) return configDownloadDir;
  if (pathArg === '.') return cwd;
  return pathArg;
}

/** ReceiveResult.errorCode → the recv.err.* key already used by the Receive
 *  screen (src/components/Receive.tsx), so --down speaks the same words. Same
 *  shape as that map on purpose; keep the two in step.
 *  ReceiveResult.errorCode 를 받기 화면(src/components/Receive.tsx)이 이미 쓰는
 *  recv.err.* 키로 옮긴다. --down 이 같은 문구를 쓰게 하기 위함. 그쪽 맵과 일부러
 *  같은 모양이니 함께 맞춘다. */
const DIR_ERR_KEY: Record<string, string> = {
  'dir-missing': 'recv.err.dirMissing',
  'dir-not-dir': 'recv.err.dirNotDir',
  'dir-no-write': 'recv.err.dirNoWrite',
};

/** What cli.tsx should print, and the process exit code. Success (including
 *  "nothing waiting") is 0; any failure is 1.
 *  cli.tsx 가 출력할 내용과 프로세스 종료 코드. 성공(대기 없음 포함)은 0, 실패는 1. */
export interface DownOutcome {
  lines: string[];
  exitCode: number;
}

/** Turns a ReceiveResult into localized summary lines and an exit code. Pure,
 *  so the whole summary is tested with stubbed results.
 *  ReceiveResult 를 지역화된 요약 줄과 종료 코드로 바꾼다. 순수라 스텁 결과로 요약
 *  전체를 검사한다. */
export function renderDownResult(
  t: Translator,
  result: ReceiveResult,
  dir: string,
): DownOutcome {
  const shown = path.resolve(dir);

  if (result.ok) {
    if (result.savedNames.length === 0) {
      return { lines: [t('cli.down.none')], exitCode: 0 };
    }
    return {
      lines: [
        t('cli.down.received', { n: result.savedNames.length }),
        ...result.savedNames.map((n) => `  ${n}`),
        t('cli.down.location', { dir: shown }),
      ],
      exitCode: 0,
    };
  }

  // A folder the receiver won't accept — the same verdict the Receive screen
  // shows, plus the offending path. errorCode is only ever a dir code, so a
  // present one always maps.
  // 받는 쪽이 못 받는 폴더 — 받기 화면과 같은 판정에 문제의 경로를 더한다.
  // errorCode 는 항상 폴더 코드뿐이라, 있으면 언제나 매핑된다.
  if (result.errorCode && DIR_ERR_KEY[result.errorCode]) {
    return {
      lines: [
        t('recv.fail'),
        t(DIR_ERR_KEY[result.errorCode]),
        `  ${result.error ?? shown}`,
      ],
      exitCode: 1,
    };
  }

  // Permission denied (mostly Linux): hand over the sudo command to run.
  // 권한 거부(주로 Linux): 실행할 sudo 명령을 넘긴다.
  if (result.needsSudo && result.sudoCmd) {
    return {
      lines: [
        t('recv.needSudoTitle'),
        t('recv.needSudoHint'),
        `  ${result.sudoCmd}`,
      ],
      exitCode: 1,
    };
  }

  // Anything else: the raw error, untranslated, under a translated heading.
  // 그 밖의 것: 번역된 제목 아래 번역되지 않은 원문 오류.
  return {
    lines: [t('recv.fail'), ...(result.error ? [`  ${result.error}`] : [])],
    exitCode: 1,
  };
}

/** Dependencies for runDown, injected so the command is tested without a real
 *  subprocess or config read.
 *  runDown 의 의존성. 실제 서브프로세스·설정 읽기 없이 검사하도록 주입한다. */
export interface DownDeps {
  receive: (dir: string) => Promise<ReceiveResult>;
  configDownloadDir: string;
  cwd: string;
  t: Translator;
}

/** Runs --down end to end: resolve the folder, receive into it, render the
 *  summary. The only side effect is the injected receive().
 *  --down 을 끝까지 실행한다: 폴더 결정 → 받기 → 요약. 유일한 부수효과는 주입된
 *  receive() 다. */
export async function runDown(
  pathArg: string | undefined,
  deps: DownDeps,
): Promise<DownOutcome> {
  const dir = resolveDownDir(pathArg, deps.configDownloadDir, deps.cwd);
  const result = await deps.receive(dir);
  return renderDownResult(deps.t, result, dir);
}
