import path from 'node:path';
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
export function resolveDownDir(pathArg, configDownloadDir, cwd) {
    if (pathArg === undefined)
        return configDownloadDir;
    if (pathArg === '.')
        return cwd;
    return pathArg;
}
/** ReceiveResult.errorCode → the recv.err.* key already used by the Receive
 *  screen (src/components/Receive.tsx), so --down speaks the same words. Same
 *  shape as that map on purpose; keep the two in step.
 *  ReceiveResult.errorCode 를 받기 화면(src/components/Receive.tsx)이 이미 쓰는
 *  recv.err.* 키로 옮긴다. --down 이 같은 문구를 쓰게 하기 위함. 그쪽 맵과 일부러
 *  같은 모양이니 함께 맞춘다. */
const DIR_ERR_KEY = {
    'dir-missing': 'recv.err.dirMissing',
    'dir-not-dir': 'recv.err.dirNotDir',
    'dir-no-write': 'recv.err.dirNoWrite',
};
/** Turns a ReceiveResult into localized summary lines and an exit code. Pure,
 *  so the whole summary is tested with stubbed results.
 *  ReceiveResult 를 지역화된 요약 줄과 종료 코드로 바꾼다. 순수라 스텁 결과로 요약
 *  전체를 검사한다. */
export function renderDownResult(t, result, dir) {
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
/** Runs --down end to end: resolve the folder, receive into it, render the
 *  summary. The only side effect is the injected receive().
 *  --down 을 끝까지 실행한다: 폴더 결정 → 받기 → 요약. 유일한 부수효과는 주입된
 *  receive() 다. */
export async function runDown(pathArg, deps) {
    const dir = resolveDownDir(pathArg, deps.configDownloadDir, deps.cwd);
    const result = await deps.receive(dir);
    return renderDownResult(deps.t, result, dir);
}
