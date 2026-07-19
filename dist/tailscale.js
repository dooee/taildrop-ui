import path from 'node:path';
import fs from 'node:fs';
import { execa } from 'execa';
import { zipFolder, zipPaths, cleanupZip, ArchiveError } from './zip.js';
import { rejectOf, nameIssueOf, nameBudgetFor, DEFAULT_NAME_BUDGET, dirIssueOf, } from './paths.js';
function shellQuote(s) {
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
let cachedBin = null;
export async function resolveTailscale() {
    if (cachedBin)
        return cachedBin;
    const candidates = [
        '/opt/homebrew/bin/tailscale',
        '/usr/local/bin/tailscale',
        '/usr/bin/tailscale',
        '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            cachedBin = c;
            return c;
        }
    }
    try {
        const finder = process.platform === 'win32' ? 'where' : 'which';
        const { stdout } = await execa(finder, ['tailscale']);
        const found = stdout.split('\n')[0]?.trim();
        if (found) {
            cachedBin = found;
            return found;
        }
    }
    catch {
    }
    throw new Error('tailscale CLI not found');
}
export async function checkTailscale() {
    let bin;
    try {
        bin = await resolveTailscale();
    }
    catch {
        return { kind: 'no-cli' };
    }
    try {
        await execa(bin, ['status']);
        return { kind: 'ok' };
    }
    catch {
        return { kind: 'daemon-down' };
    }
}
let cachedBudget = null;
async function nameBudget() {
    if (cachedBudget !== null)
        return cachedBudget;
    try {
        const bin = await resolveTailscale();
        const { stdout } = await execa(bin, ['status', '--json']);
        const id = JSON.parse(stdout)?.Self?.ID;
        cachedBudget =
            typeof id === 'string' && id.length > 0
                ? nameBudgetFor(id.length)
                : DEFAULT_NAME_BUDGET;
    }
    catch {
        cachedBudget = DEFAULT_NAME_BUDGET;
    }
    return cachedBudget;
}
export async function listTargets() {
    const bin = await resolveTailscale();
    const { stdout } = await execa(bin, ['file', 'cp', '--targets']);
    return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
        const [ip, name] = line.split('\t');
        return { ip: ip ?? '', name: (name ?? ip ?? '').trim() };
    })
        .filter((t) => t.name);
}
function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
export async function sendPaths(paths, targetName, opts, onLog) {
    const bin = await resolveTailscale();
    const tempZips = [];
    const toSend = [];
    try {
        if (paths.length === 0) {
            return { ok: false, sentNames: [], errorCode: 'empty' };
        }
        const picks = [];
        for (const p of paths) {
            const abs = path.resolve(p);
            let stat;
            try {
                stat = fs.lstatSync(abs);
            }
            catch (err) {
                if (err?.code !== 'ENOENT')
                    throw err;
                return {
                    ok: false,
                    sentNames: [],
                    error: abs,
                    errorCode: 'missing-path',
                };
            }
            const reject = rejectOf(stat);
            if (reject) {
                return {
                    ok: false,
                    sentNames: [],
                    error: abs,
                    errorCode: reject === 'symlink' ? 'symlink-path' : 'special-path',
                };
            }
            picks.push({ abs, isDir: stat.isDirectory() });
        }
        const hasFolder = picks.some((x) => x.isDir);
        if (picks.length >= 2 && (opts.bundleMultiple || hasFolder)) {
            const seen = new Set();
            for (const { abs } of picks) {
                const base = path.basename(abs);
                if (seen.has(base)) {
                    return {
                        ok: false,
                        sentNames: [],
                        error: base,
                        errorCode: 'duplicate-name',
                    };
                }
                seen.add(base);
            }
            onLog?.(`bundle:${picks.length}`);
            const zipPath = await zipPaths(picks.map((x) => x.abs), `tailtoss-${timestamp()}.zip`);
            tempZips.push(zipPath);
            toSend.push(zipPath);
        }
        else {
            for (const { abs, isDir } of picks) {
                if (isDir) {
                    onLog?.(`zip:${path.basename(abs)}`);
                    const zipPath = await zipFolder(abs);
                    tempZips.push(zipPath);
                    toSend.push(zipPath);
                }
                else {
                    toSend.push(abs);
                }
            }
        }
        const budget = await nameBudget();
        const nameProblems = [];
        for (const p of toSend) {
            const base = path.basename(p);
            const issue = nameIssueOf(base, budget);
            if (issue)
                nameProblems.push({
                    name: base,
                    issue,
                    bytes: Buffer.byteLength(base, 'utf8'),
                });
        }
        if (nameProblems.length > 0) {
            return {
                ok: false,
                sentNames: [],
                errorCode: 'name-invalid',
                nameProblems,
                nameBudget: budget,
            };
        }
        onLog?.(`cp:${targetName}:${toSend.length}`);
        await execa(bin, ['file', 'cp', ...toSend, `${targetName}:`]);
        return { ok: true, sentNames: toSend.map((p) => path.basename(p)) };
    }
    catch (err) {
        const message = err instanceof Error
            ? err.stderr || err.message
            : String(err);
        if (err instanceof ArchiveError) {
            return { ok: false, sentNames: [], error: message, errorCode: err.code };
        }
        return { ok: false, sentNames: [], error: message };
    }
    finally {
        for (const z of tempZips)
            cleanupZip(z);
    }
}
const DIR_ERROR_CODE = {
    missing: 'dir-missing',
    'not-dir': 'dir-not-dir',
    'no-write': 'dir-no-write',
};
export async function receive(downloadDir) {
    const issue = dirIssueOf(downloadDir);
    if (issue) {
        return {
            ok: false,
            savedNames: [],
            error: downloadDir,
            errorCode: DIR_ERROR_CODE[issue],
        };
    }
    const bin = await resolveTailscale();
    const dir = path.resolve(downloadDir);
    try {
        const before = new Set(fs.readdirSync(dir));
        await execa(bin, ['file', 'get', '--conflict=rename', dir]);
        const after = fs.readdirSync(dir);
        const savedNames = after.filter((n) => !before.has(n)).sort();
        return { ok: true, savedNames };
    }
    catch (err) {
        const message = err instanceof Error
            ? err.stderr || err.message
            : String(err);
        if (/permission denied|not permitted|access is denied|must be run as root|EACCES/i.test(message)) {
            return {
                ok: false,
                savedNames: [],
                needsSudo: true,
                sudoCmd: `sudo ${shellQuote(bin)} file get --conflict=rename ${shellQuote(dir)}`,
                error: message,
            };
        }
        return { ok: false, savedNames: [], error: message };
    }
}
