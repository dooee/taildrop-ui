#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.js';
import { checkTailscale, receive } from './tailscale.js';
import { loadConfig } from './config.js';
import { makeT } from './i18n.js';
import { parseArgs, runDown, renderHelp, renderUsage, renderUnknownCommand, } from './cli-core.js';
const SETUP_COMMANDS = {
    darwin: {
        install: 'brew install tailscale',
        startDaemon: 'sudo brew services start tailscale',
        login: 'sudo tailscale up',
    },
    win32: {
        install: 'https://tailscale.com/download/windows',
        startDaemon: null,
        login: 'tailscale up',
    },
    linux: {
        install: 'curl -fsSL https://tailscale.com/install.sh | sh',
        startDaemon: 'sudo systemctl enable --now tailscaled',
        login: 'sudo tailscale up',
    },
};
/** Everything that is not macOS or Windows gets the Linux commands.
 *  macOS·Windows 가 아니면 리눅스 명령을 쓴다. */
function commandsFor(platform) {
    return platform === 'darwin' || platform === 'win32'
        ? SETUP_COMMANDS[platform]
        : SETUP_COMMANDS.linux;
}
/**
 * Builds the step-by-step guidance for a setup state. `needsInstall` is true
 * only when the CLI is missing; a stopped daemon skips the install step but
 * still needs the daemon started and a login. Steps are numbered here, not in
 * the dictionary, so skipping install renumbers the rest cleanly.
 *
 * 셋업 상태별 단계 안내를 만든다. `needsInstall` 은 CLI 가 없을 때만 참이다. 멈춘
 * 데몬은 설치 단계를 건너뛰되 데몬 시작과 로그인은 여전히 필요하다. 번호는 사전이
 * 아니라 여기서 매기므로, 설치를 건너뛰면 나머지 번호가 깔끔히 다시 매겨진다.
 */
function guidanceLines(t, platform, needsInstall) {
    const cmds = commandsFor(platform);
    const steps = [];
    if (needsInstall) {
        steps.push({ label: t('setup.step.install'), body: cmds.install });
    }
    steps.push({
        label: t('setup.step.startDaemon'),
        // On Windows the service auto-starts, so a note replaces the command.
        // Windows 는 서비스가 자동 시작하므로 명령 대신 안내문을 넣는다.
        body: cmds.startDaemon ?? t('setup.win.daemonNote'),
    });
    steps.push({ label: t('setup.step.login'), body: cmds.login });
    // The command body sits at a shallow indent so selecting it to copy drags
    // little leading whitespace; the label carries the step number.
    // 명령 본문은 얕게 들여써서 복사하려 선택할 때 앞 공백이 거의 딸려오지 않게 한다.
    // 번호는 라벨이 지닌다.
    const lines = [];
    steps.forEach((step, i) => {
        lines.push(`  ${i + 1}) ${step.label}`);
        lines.push(`     ${step.body}`);
        lines.push('');
    });
    return lines;
}
/**
 * Prints the per-platform setup guidance when tailscale is not ready, and exits
 * non-zero. Shared by the UI launch and --down: both need a running daemon, and
 * both should guide the same way when it is missing rather than failing with a
 * raw subprocess error.
 *
 * tailscale 이 준비되지 않았을 때 플랫폼별 셋업 안내를 출력하고 비정상 종료한다. UI
 * 실행과 --down 이 공유한다 — 둘 다 실행 중인 데몬이 필요하고, 없을 때 원시
 * 서브프로세스 오류로 실패하기보다 같은 방식으로 안내해야 한다.
 */
async function ensureReadyOrExit(t, platform) {
    const status = await checkTailscale();
    if (status.kind === 'ok')
        return;
    const needsInstall = status.kind === 'no-cli';
    const title = t(needsInstall ? 'setup.noCli.title' : 'setup.daemonDown.title');
    const intro = t(needsInstall ? 'setup.noCli.intro' : 'setup.daemonDown.intro');
    const msg = [
        '',
        `  ${title}`,
        '',
        `  ${intro}`,
        '',
        ...guidanceLines(t, platform, needsInstall),
        `  ${t('setup.verify')}`,
        '',
    ];
    process.stderr.write(msg.join('\n') + '\n');
    process.exit(1);
}
async function main() {
    const config = loadConfig();
    /*
     * This runs before render(), so there is no React context and useT() is
     * unavailable — build a translator up front with makeT(lang), the same way
     * scripts and other non-React paths do. The i18n checker excludes cli.tsx
     * from its hardcoding scan for this reason (see scripts/check-i18n.mts), but
     * the strings still come from the dictionary so both languages stay in sync.
     *
     * 이 코드는 render() 이전에 돌아 React 컨텍스트가 없고 useT() 를 못 쓴다 —
     * 스크립트나 다른 비-React 경로처럼 makeT(lang) 으로 번역기를 미리 만든다. i18n
     * 검사기는 이 이유로 cli.tsx 를 하드코딩 스캔에서 제외하지만(check-i18n.mts
     * 참고), 문구는 여전히 사전에서 오므로 두 언어가 어긋나지 않는다.
     */
    const t = makeT(config.lang);
    const platform = process.platform;
    // process.argv is [node, script, ...rest]; the router only wants ...rest.
    // process.argv 는 [node, script, ...rest]. 라우터는 ...rest 만 본다.
    const route = parseArgs(process.argv.slice(2));
    switch (route.kind) {
        // Help and command errors need no daemon: they only read argv and print.
        // 도움말과 명령 오류는 데몬이 필요 없다 — argv 를 읽어 출력할 뿐이다.
        case 'help':
            process.stdout.write(renderHelp(t).join('\n') + '\n');
            return;
        case 'usage':
            process.stderr.write(renderUsage(t, route.command).join('\n') + '\n');
            process.exit(1);
            return;
        case 'unknown':
            process.stderr.write(renderUnknownCommand(t, route.command).join('\n') + '\n');
            process.exit(1);
            return;
        case 'down': {
            await ensureReadyOrExit(t, platform);
            const outcome = await runDown(route.path, {
                receive,
                configDownloadDir: config.downloadDir,
                cwd: process.cwd(),
                t,
            });
            const out = outcome.exitCode === 0 ? process.stdout : process.stderr;
            out.write(outcome.lines.join('\n') + '\n');
            process.exit(outcome.exitCode);
            return;
        }
        case 'ui':
            await ensureReadyOrExit(t, platform);
            render(React.createElement(App, null));
            return;
    }
}
main().catch((err) => {
    process.stderr.write(String(err?.stack || err) + '\n');
    process.exit(1);
});
