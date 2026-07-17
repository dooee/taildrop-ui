#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.js';
import { hasTailscale } from './tailscale.js';
import { loadConfig } from './config.js';
async function main() {
    const { lang } = loadConfig();
    const ko = lang === 'ko';
    // Hard dependency: the tailscale CLI. This runs before render(), so there
    // is no React context and no useT() — the hint below is inlined on purpose.
    // 필수 종속성: tailscale CLI. render() 이전이라 React 컨텍스트가 없어
    // useT() 를 쓸 수 없다 — 아래 안내문은 의도적으로 인라인이다.
    if (!(await hasTailscale())) {
        const installHint = process.platform === 'darwin'
            ? 'brew install tailscale'
            : process.platform === 'win32'
                ? 'https://tailscale.com/download/windows'
                : 'https://tailscale.com/download/linux';
        const msg = ko
            ? [
                '',
                '  ⚠  tailscale CLI를 찾을 수 없습니다.',
                '',
                '  이 도구는 tailscale 명령이 필요합니다. 먼저 설치하세요:',
                `    ${installHint}`,
                '',
                '  설치 후 `tailscale status`가 동작하는지 확인하세요.',
                '',
            ]
            : [
                '',
                '  ⚠  The tailscale CLI was not found.',
                '',
                '  This tool requires the tailscale command. Install it first:',
                `    ${installHint}`,
                '',
                '  After installing, verify `tailscale status` works.',
                '',
            ];
        process.stderr.write(msg.join('\n') + '\n');
        process.exit(1);
    }
    render(React.createElement(App, null));
}
main().catch((err) => {
    process.stderr.write(String(err?.stack || err) + '\n');
    process.exit(1);
});
