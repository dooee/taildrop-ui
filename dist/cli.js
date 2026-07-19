#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.js';
import { checkTailscale, receive } from './tailscale.js';
import { loadConfig } from './config.js';
import { makeT } from './i18n.js';
import { parseArgs, runDown, renderHelp, renderUsage, renderUnknownCommand, } from './cli-core.js';
import { makeStyle, shouldColor } from './cli-style.js';
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
function commandsFor(platform) {
    return platform === 'darwin' || platform === 'win32'
        ? SETUP_COMMANDS[platform]
        : SETUP_COMMANDS.linux;
}
function guidanceLines(t, platform, needsInstall, style) {
    const cmds = commandsFor(platform);
    const steps = [];
    if (needsInstall) {
        steps.push({ label: t('setup.step.install'), body: cmds.install });
    }
    steps.push({
        label: t('setup.step.startDaemon'),
        body: cmds.startDaemon ?? t('setup.win.daemonNote'),
    });
    steps.push({ label: t('setup.step.login'), body: cmds.login });
    const lines = [];
    steps.forEach((step, i) => {
        lines.push(`  ${style.bold(`${i + 1}) ${step.label}`)}`);
        lines.push(`     ${style.cyan(step.body)}`);
        lines.push('');
    });
    return lines;
}
async function ensureReadyOrExit(t, platform, style) {
    const status = await checkTailscale();
    if (status.kind === 'ok')
        return;
    const needsInstall = status.kind === 'no-cli';
    const title = t(needsInstall ? 'setup.noCli.title' : 'setup.daemonDown.title');
    const intro = t(needsInstall ? 'setup.noCli.intro' : 'setup.daemonDown.intro');
    const msg = [
        '',
        `  ${style.yellow(title)}`,
        '',
        `  ${intro}`,
        '',
        ...guidanceLines(t, platform, needsInstall, style),
        `  ${style.dim(t('setup.verify'))}`,
        '',
    ];
    process.stderr.write(msg.join('\n') + '\n');
    process.exit(1);
}
async function main() {
    const config = loadConfig();
    const t = makeT(config.lang);
    const platform = process.platform;
    const noColor = 'NO_COLOR' in process.env;
    const forceColor = 'FORCE_COLOR' in process.env && process.env.FORCE_COLOR !== '0';
    const styleFor = (isTTY) => makeStyle(shouldColor({ isTTY, noColor, forceColor }));
    const stdoutStyle = styleFor(Boolean(process.stdout.isTTY));
    const stderrStyle = styleFor(Boolean(process.stderr.isTTY));
    const downStyle = styleFor(Boolean(process.stdout.isTTY) && Boolean(process.stderr.isTTY));
    const route = parseArgs(process.argv.slice(2));
    switch (route.kind) {
        case 'help':
            process.stdout.write(renderHelp(t, stdoutStyle).join('\n') + '\n');
            return;
        case 'usage':
            process.stderr.write(renderUsage(t, route.command, stderrStyle).join('\n') + '\n');
            process.exit(1);
            return;
        case 'unknown':
            process.stderr.write(renderUnknownCommand(t, route.command, stderrStyle).join('\n') + '\n');
            process.exit(1);
            return;
        case 'down': {
            await ensureReadyOrExit(t, platform, stderrStyle);
            const outcome = await runDown(route.path, {
                receive,
                configDownloadDir: config.downloadDir,
                cwd: process.cwd(),
                t,
                style: downStyle,
            });
            const out = outcome.exitCode === 0 ? process.stdout : process.stderr;
            out.write(outcome.lines.join('\n') + '\n');
            process.exit(outcome.exitCode);
            return;
        }
        case 'ui':
            await ensureReadyOrExit(t, platform, stderrStyle);
            render(React.createElement(App, null));
            return;
    }
}
main().catch((err) => {
    process.stderr.write(String(err?.stack || err) + '\n');
    process.exit(1);
});
