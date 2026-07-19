import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execa } from 'execa';
export class ArchiveError extends Error {
    code;
    constructor(code, message) {
        super(message ?? code);
        this.code = code;
        this.name = 'ArchiveError';
    }
}
let cached = null;
export async function resolveArchiver() {
    if (cached)
        return cached;
    try {
        await execa('zip', ['-v']);
        cached = 'zip';
        return cached;
    }
    catch {
    }
    try {
        const { stdout } = await execa('tar', ['--version']);
        if (/bsdtar|libarchive/i.test(stdout)) {
            cached = 'bsdtar';
            return cached;
        }
    }
    catch {
    }
    throw new ArchiveError('archiver-missing');
}
export async function hasArchiver() {
    try {
        await resolveArchiver();
        return true;
    }
    catch {
        return false;
    }
}
export async function archiverKind() {
    try {
        return await resolveArchiver();
    }
    catch {
        return null;
    }
}
export function resetArchiverCache() {
    cached = null;
}
export function archiverInstallHint() {
    if (process.platform === 'linux')
        return 'sudo apt install zip  ·  sudo dnf install zip';
    if (process.platform === 'win32')
        return 'https://learn.microsoft.com/windows/tar/';
    return 'brew install zip';
}
async function archive(zipPath, items) {
    const kind = await resolveArchiver();
    try {
        if (kind === 'zip') {
            for (const { parent, base } of items) {
                await execa('zip', ['-r', '-y', '-q', zipPath, base], { cwd: parent });
            }
        }
        else {
            const args = ['-a', '-c', '-f', zipPath];
            for (const { parent, base } of items)
                args.push('-C', parent, base);
            await execa('tar', args);
        }
    }
    catch (err) {
        if (err instanceof ArchiveError)
            throw err;
        const message = err instanceof Error ? err.message : String(err);
        throw new ArchiveError('archive-failed', message);
    }
}
export async function zipFolder(folderPath) {
    const abs = path.resolve(folderPath);
    const base = path.basename(abs);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tailtoss-zip-'));
    const zipPath = path.join(tmpDir, `${base}.zip`);
    await archiveOrCleanup(zipPath, tmpDir, [{ parent: path.dirname(abs), base }]);
    return zipPath;
}
export async function zipPaths(paths, zipName) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tailtoss-zip-'));
    const zipPath = path.join(tmpDir, zipName);
    const items = paths.map((p) => {
        const abs = path.resolve(p);
        return { parent: path.dirname(abs), base: path.basename(abs) };
    });
    await archiveOrCleanup(zipPath, tmpDir, items);
    return zipPath;
}
async function archiveOrCleanup(zipPath, tmpDir, items) {
    try {
        await archive(zipPath, items);
    }
    catch (err) {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        catch {
        }
        throw err;
    }
}
export function cleanupZip(zipPath) {
    try {
        fs.rmSync(path.dirname(zipPath), { recursive: true, force: true });
    }
    catch {
    }
}
