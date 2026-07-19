import fs from 'node:fs';
export function rejectOf(s) {
    if (s.isSymbolicLink())
        return 'symlink';
    if (s.isFIFO() || s.isSocket() || s.isBlockDevice() || s.isCharacterDevice())
        return 'special';
    return null;
}
const SUFFIX_OVERHEAD = '.partial'.length + 1;
const RECEIVER_MAX_BYTES = 255;
export function nameBudgetFor(idLen) {
    return RECEIVER_MAX_BYTES - SUFFIX_OVERHEAD - idLen;
}
export const DEFAULT_NAME_BUDGET = nameBudgetFor(17);
const BAD_CHARS = /[/\\:*"<>|]/;
const GRAPHIC_ONLY = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}]*$/u;
export function nameIssueOf(name, budget = DEFAULT_NAME_BUDGET) {
    if (name.trim() !== name)
        return 'space';
    if (Buffer.byteLength(name, 'utf8') > budget)
        return 'long';
    if (name.endsWith('.partial') || name.endsWith('.deleted'))
        return 'reserved';
    if (BAD_CHARS.test(name) || !GRAPHIC_ONLY.test(name))
        return 'char';
    return null;
}
export function dirIssueOf(dir) {
    if (typeof dir !== 'string' || dir.trim() === '')
        return 'missing';
    let stat;
    try {
        stat = fs.statSync(dir);
    }
    catch {
        return 'missing';
    }
    if (!stat.isDirectory())
        return 'not-dir';
    try {
        fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
    }
    catch {
        return 'no-write';
    }
    return null;
}
