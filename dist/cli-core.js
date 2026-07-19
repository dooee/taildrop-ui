import path from 'node:path';
/**
 * Routes argv (without node/script) to a CliRoute. Pure — no I/O, no exit.
 *
 * --down takes at most one positional path; more than one, or a flag where the
 * path belongs, is a known-but-misused command and routes to its usage (issue
 * #4's "known command used incorrectly"). An unrecognized first token is an
 * unknown command.
 *
 * argv(node/script 제외)를 CliRoute 로 라우팅한다. 순수 — I/O·종료 없음.
 * --down 은 위치 경로를 최대 하나 받는다. 둘 이상이거나 경로 자리에 플래그가 오면
 * 알지만 잘못 쓴 명령이라 그 usage 로 간다(이슈 #4 의 "알려진 명령의 잘못된 사용").
 * 알 수 없는 첫 토큰은 존재하지 않는 명령이다.
 */
export function parseArgs(argv) {
    if (argv.length === 0)
        return { kind: 'ui' };
    const [cmd, ...rest] = argv;
    if (cmd === '--help' || cmd === '-h')
        return { kind: 'help' };
    if (cmd === '--down') {
        // One optional path. A second positional, or a flag standing in for the
        // path, is misuse — the command is known, so show its usage, not the notice.
        // 선택 경로 하나. 두 번째 위치 인자나 경로 대신 온 플래그는 잘못된 사용이다 —
        // 명령은 알려져 있으므로 안내가 아니라 usage 를 보여준다.
        if (rest.length > 1)
            return { kind: 'usage', command: 'down' };
        const arg = rest[0];
        if (arg !== undefined && arg.startsWith('-')) {
            return { kind: 'usage', command: 'down' };
        }
        return { kind: 'down', path: arg };
    }
    return { kind: 'unknown', command: cmd };
}
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
/**
 * The synopsis lines are literal commands to type, so they stay out of the
 * dictionary (like the setup commands in cli.tsx); only the descriptions beside
 * them are translated. Two spaces align the descriptions without a table lib.
 *
 * 시놉시스 줄은 그대로 입력하는 명령이라 사전에 두지 않는다(cli.tsx 의 셋업 명령과
 * 같다). 옆의 설명만 번역한다. 표 라이브러리 없이 두 칸으로 설명을 맞춘다.
 */
const SYNOPSIS = {
    ui: 'tailtoss',
    down: 'tailtoss --down [path]',
    help: 'tailtoss --help',
};
/** Pads a synopsis to a shared column so the descriptions line up.
 *  시놉시스를 공통 열까지 채워 설명을 정렬한다. */
function row(synopsis, desc) {
    return `  ${synopsis.padEnd(24)}${desc}`;
}
/**
 * The full help, printed for --help and after an unknown-command notice. Lists
 * every command — including --down (the coupling with issue #3) — with a
 * localized description, then the path rules for --down.
 *
 * 전체 도움말. --help 와 존재하지 않는 명령 안내 뒤에 출력된다. --down 을
 * 포함(이슈 #3 과의 커플)한 모든 명령을 지역화 설명과 함께 나열한 뒤, --down 의
 * 경로 규칙을 덧붙인다.
 */
export function renderHelp(t) {
    return [
        `tailtoss — ${t('cli.help.tagline')}`,
        '',
        t('cli.help.usage'),
        row(SYNOPSIS.ui, t('cli.desc.ui')),
        row(SYNOPSIS.down, t('cli.desc.down')),
        row(SYNOPSIS.help, t('cli.desc.help')),
        '',
        `  ${t('cli.down.pathNote')}`,
    ];
}
/**
 * A single command's usage, printed when a known command is used incorrectly.
 * Only --down has arguments today; an unrecognized name falls back to the full
 * help so the caller never renders an empty usage.
 *
 * 한 명령의 usage. 알려진 명령을 잘못 썼을 때 출력한다. 오늘 인자를 갖는 건
 * --down 뿐이다. 알 수 없는 이름은 전체 도움말로 폴백해 호출자가 빈 usage 를
 * 렌더링하지 않게 한다.
 */
export function renderUsage(t, command) {
    if (command === 'down') {
        return [
            t('cli.help.usage'),
            `  ${SYNOPSIS.down}`,
            '',
            `  ${t('cli.down.pathNote')}`,
        ];
    }
    return renderHelp(t);
}
/**
 * The unknown-command output: a notice naming the offending token, a blank
 * line, then the same full help as --help (issue #4).
 *
 * 존재하지 않는 명령 출력: 문제의 토큰을 짚는 안내, 빈 줄, 그다음 --help 와 같은
 * 전체 도움말(이슈 #4).
 */
export function renderUnknownCommand(t, command) {
    return [t('cli.unknownCommand', { command }), '', ...renderHelp(t)];
}
