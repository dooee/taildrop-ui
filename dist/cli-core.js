import path from 'node:path';
import { plainStyle } from './cli-style.js';
export function parseArgs(argv) {
    if (argv.length === 0)
        return { kind: 'ui' };
    const [cmd, ...rest] = argv;
    if (cmd === '--help' || cmd === '-h')
        return { kind: 'help' };
    if (cmd === '--down') {
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
export function resolveDownDir(pathArg, configDownloadDir, cwd) {
    if (pathArg === undefined)
        return configDownloadDir;
    if (pathArg === '.')
        return cwd;
    return pathArg;
}
const DIR_ERR_KEY = {
    'dir-missing': 'recv.err.dirMissing',
    'dir-not-dir': 'recv.err.dirNotDir',
    'dir-no-write': 'recv.err.dirNoWrite',
};
export function renderDownResult(t, result, dir, style = plainStyle) {
    const shown = path.resolve(dir);
    if (result.ok) {
        if (result.savedNames.length === 0) {
            return { lines: [style.dim(t('cli.down.none'))], exitCode: 0 };
        }
        return {
            lines: [
                style.green(t('cli.down.received', { n: result.savedNames.length })),
                ...result.savedNames.map((n) => `  ${style.cyan(n)}`),
                style.dim(t('cli.down.location', { dir: shown })),
            ],
            exitCode: 0,
        };
    }
    if (result.errorCode && DIR_ERR_KEY[result.errorCode]) {
        return {
            lines: [
                style.red(t('recv.fail')),
                t(DIR_ERR_KEY[result.errorCode]),
                `  ${style.dim(result.error ?? shown)}`,
            ],
            exitCode: 1,
        };
    }
    if (result.needsSudo && result.sudoCmd) {
        return {
            lines: [
                style.yellow(t('recv.needSudoTitle')),
                t('recv.needSudoHint'),
                `  ${style.cyan(result.sudoCmd)}`,
            ],
            exitCode: 1,
        };
    }
    return {
        lines: [
            style.red(t('recv.fail')),
            ...(result.error ? [`  ${style.dim(result.error)}`] : []),
        ],
        exitCode: 1,
    };
}
export async function runDown(pathArg, deps) {
    const dir = resolveDownDir(pathArg, deps.configDownloadDir, deps.cwd);
    const result = await deps.receive(dir);
    return renderDownResult(deps.t, result, dir, deps.style ?? plainStyle);
}
const SYNOPSIS = {
    ui: 'tailtoss',
    down: 'tailtoss --down [path]',
    help: 'tailtoss --help',
};
function row(synopsis, desc, style) {
    return `  ${style.cyan(synopsis.padEnd(24))}${style.dim(desc)}`;
}
export function renderHelp(t, style = plainStyle) {
    return [
        `${style.banner('tailtoss')}${style.cyan(` — ${t('cli.help.tagline')}`)}`,
        '',
        style.bold(t('cli.help.usage')),
        row(SYNOPSIS.ui, t('cli.desc.ui'), style),
        row(SYNOPSIS.down, t('cli.desc.down'), style),
        row(SYNOPSIS.help, t('cli.desc.help'), style),
        '',
        `  ${style.dim(t('cli.down.pathNote'))}`,
    ];
}
export function renderUsage(t, command, style = plainStyle) {
    if (command === 'down') {
        return [
            style.bold(t('cli.help.usage')),
            `  ${style.cyan(SYNOPSIS.down)}`,
            '',
            `  ${style.dim(t('cli.down.pathNote'))}`,
        ];
    }
    return renderHelp(t, style);
}
export function renderUnknownCommand(t, command, style = plainStyle) {
    return [
        style.yellow(t('cli.unknownCommand', { command })),
        '',
        ...renderHelp(t, style),
    ];
}
