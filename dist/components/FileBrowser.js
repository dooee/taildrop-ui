import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Frame from './Frame.js';
import { useT } from '../i18n.js';
import { rejectOf, nameIssueOf, DEFAULT_NAME_BUDGET, } from '../paths.js';
const VIEWPORT = 10;
/** NameIssue → i18n key. Spelled out so check-i18n can see the keys are used,
 *  and so both sides stay greppable.
 *  NameIssue 를 i18n 키로 옮긴다. check-i18n 이 키가 쓰인 것을 볼 수 있도록, 그리고
 *  양쪽 다 grep 으로 찾을 수 있도록 적어 둔다. */
const NAME_BLOCK_KEY = {
    space: 'browser.blocked.nameSpace',
    char: 'browser.blocked.nameChar',
    long: 'browser.blocked.nameLong',
    reserved: 'browser.blocked.nameReserved',
};
/**
 * Reads one directory. Dirent already carries lstat semantics, so judging links
 * and special files costs no extra syscall. Only symlinks pay for a statSync,
 * and only to learn whether → can enter them — sending a link is refused no
 * matter what it points at.
 *
 * 디렉터리 하나를 읽는다. Dirent 는 이미 lstat 시맨틱이라 링크·특수 파일 판정에
 * 추가 syscall 이 들지 않는다. 심볼릭 링크만 statSync 비용을 내며, 그것도 → 로
 * 진입 가능한지 알기 위해서일 뿐이다. 링크 전송은 대상이 무엇이든 거부된다.
 */
function listDir(dir, showHidden) {
    const items = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => showHidden || !d.name.startsWith('.'))
        .map((d) => {
        const full = path.join(dir, d.name);
        let isDir = d.isDirectory();
        if (d.isSymbolicLink()) {
            // Follow it for navigation only. A dangling link stays non-enterable.
            // 진입 가능 여부를 위해서만 따라간다. 깨진 링크는 진입 불가로 남는다.
            try {
                isDir = fs.statSync(full).isDirectory();
            }
            catch {
                isDir = false;
            }
        }
        return {
            name: d.name,
            path: full,
            isDir,
            reject: rejectOf(d),
            nameIssue: d.isDirectory() ? null : nameIssueOf(d.name),
        };
    });
    items.sort((a, b) => {
        if (a.isDir !== b.isDir)
            return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return items;
}
/** Abbreviates the home directory to ~. / 홈 디렉터리를 ~ 로 축약. */
function prettyPath(p) {
    const home = os.homedir();
    return p === home
        ? '~'
        : p.startsWith(home + path.sep)
            ? '~' + p.slice(home.length)
            : p;
}
export default function FileBrowser({ mode, title, initialDir, bundleMultiple, onSubmit, onCancel, }) {
    const t = useT();
    /*
     * When several picks are bundled, each file goes inside one zip and only the
     * zip's name reaches the receiver, so a file's own bad name is no longer a
     * reason to refuse the pick. Only gate name problems when bundling is off.
     *
     * This is the same logic that already exempts folders (a folder's name never
     * rides along), just applied to files too — without it the browser refuses a
     * pick that sendPaths would happily bundle. The residual case (bundleMultiple
     * off, but a folder is picked alongside, which forces a bundle) cannot be
     * known here mid-selection; sendPaths judges the final names and covers it.
     *
     * 여러 선택 항목이 묶일 때는 각 파일이 하나의 zip 안으로 들어가고 받는 쪽에는
     * zip 이름만 도달하므로, 파일 자신의 나쁜 이름은 더 이상 선택을 거부할 이유가
     * 아니다. 묶기가 꺼져 있을 때만 이름 문제로 막는다.
     *
     * 이건 폴더를 이미 면제하는 것과 같은 논리다(폴더 이름은 딸려가지 않는다). 파일에도
     * 적용할 뿐이다 — 없으면 브라우저가 sendPaths 는 문제없이 묶을 선택을 거부한다.
     * 남는 경우(묶기는 꺼졌지만 폴더를 함께 골라 강제로 묶이는 경우)는 선택 도중 여기서
     * 알 수 없고, sendPaths 가 최종 이름을 판정해 잡는다.
     */
    const nameCanBlock = !bundleMultiple;
    const [currentDir, setCurrentDir] = useState(initialDir ?? os.homedir());
    const [showHidden, setShowHidden] = useState(false);
    const [cursor, setCursor] = useState(0);
    const [selected, setSelected] = useState(new Set());
    const [error, setError] = useState(null);
    const entries = useMemo(() => {
        try {
            setError(null);
            return listDir(currentDir, showHidden);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return [];
        }
    }, [currentDir, showHidden]);
    useEffect(() => {
        setCursor((c) => Math.min(c, Math.max(0, entries.length - 1)));
    }, [entries]);
    const goInto = (entry) => {
        if (entry.isDir) {
            setCurrentDir(entry.path);
            setCursor(0);
        }
    };
    const goUp = () => {
        const parent = path.dirname(currentDir);
        if (parent !== currentDir) {
            setCurrentDir(parent);
            setCursor(0);
        }
    };
    useInput((input, key) => {
        if (key.escape)
            return onCancel();
        if (key.upArrow || input === 'k')
            return setCursor((c) => (c > 0 ? c - 1 : c));
        if (key.downArrow || input === 'j')
            return setCursor((c) => (c < entries.length - 1 ? c + 1 : c));
        if (key.leftArrow || input === 'h')
            return goUp();
        if (key.rightArrow || input === 'l') {
            const e = entries[cursor];
            if (e?.isDir)
                goInto(e);
            return;
        }
        if (input === '.')
            return setShowHidden((v) => !v);
        if (input === ' ') {
            if (mode === 'files') {
                const e = entries[cursor];
                // Links, special files, and names the receiver would refuse are all
                // refused right here. The reason is already on screen below the list,
                // so this is not a silent no-op.
                // 링크·특수 파일, 그리고 받는 쪽이 거부할 이름은 여기서 거부한다. 사유가 이미
                // 목록 아래에 떠 있으므로 조용한 무반응이 아니다.
                if (e && !e.reject && !(nameCanBlock && e.nameIssue)) {
                    setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(e.path))
                            next.delete(e.path);
                        else
                            next.add(e.path);
                        return next;
                    });
                }
            }
            return;
        }
        if (key.return) {
            if (mode === 'folder')
                return onSubmit([currentDir]);
            if (selected.size > 0)
                return onSubmit([...selected]);
            const e = entries[cursor];
            if (!e)
                return;
            // Entering wins over the reject: a symlinked folder cannot be sent as
            // itself, but going inside it is allowed.
            // 진입이 거부보다 우선한다. 심링크 폴더는 자신을 보낼 수는 없어도 안으로
            // 들어가는 것은 허용된다.
            if (e.isDir)
                return goInto(e);
            if (e.reject || (nameCanBlock && e.nameIssue))
                return;
            onSubmit([e.path]);
            return;
        }
    });
    const startIdx = Math.max(0, Math.min(cursor - Math.floor(VIEWPORT / 2), Math.max(0, entries.length - VIEWPORT)));
    const visible = entries.slice(startIdx, startIdx + VIEWPORT);
    const moreAbove = startIdx > 0;
    const moreBelow = startIdx + VIEWPORT < entries.length;
    const footer = mode === 'folder' ? t('browser.help.folder') : t('browser.help.files');
    /*
     * Derived from the cursor rather than held in state. State would have to be
     * cleared on every cursor move, directory change and hidden-toggle, and one
     * missed spot leaves a stale reason pinned to the wrong entry. This also puts
     * the reason on screen before the user presses Space, not after.
     *
     * state 로 들고 있지 않고 커서에서 파생한다. state 라면 커서 이동·디렉터리 변경·
     * 숨김 토글마다 지워야 하고, 한 군데만 놓쳐도 엉뚱한 항목에 사유가 남는다. 파생이면
     * 사용자가 Space 를 눌러보기 전에 이미 사유가 화면에 있다.
     */
    const focusedEntry = entries[cursor];
    const blockReason = mode === 'files' && focusedEntry?.reject ? focusedEntry.reject : null;
    const nameIssue = nameCanBlock && mode === 'files' && focusedEntry?.nameIssue
        ? focusedEntry.nameIssue
        : null;
    return (React.createElement(Frame, { screen: title ?? '', footer: footer },
        React.createElement(Box, { flexDirection: "column" },
            mode === 'files' && (React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
                React.createElement(Text, { color: "yellow" }, t('browser.sendRuleTitle')),
                React.createElement(Text, { dimColor: true }, t('browser.sendRule.select')),
                React.createElement(Text, { dimColor: true }, t('browser.sendRule.single')),
                React.createElement(Text, { dimColor: true }, bundleMultiple
                    ? t('browser.sendRule.multiZip')
                    : t('browser.sendRule.multiFiles')),
                React.createElement(Text, { dimColor: true }, t('browser.sendRule.folder')),
                !bundleMultiple && React.createElement(Text, { dimColor: true }, t('browser.sendRule.folderMix')),
                React.createElement(Text, { dimColor: true }, t('browser.sendRule.change')))),
            React.createElement(Box, { marginBottom: 1 },
                React.createElement(Text, { color: "cyan" }, "\uD83D\uDCC1 "),
                React.createElement(Text, { color: "cyan", bold: true }, prettyPath(currentDir))),
            error ? (React.createElement(Text, { color: "red" }, t('browser.readError', { msg: error }))) : entries.length === 0 ? (React.createElement(Text, { dimColor: true }, t('browser.empty'))) : (React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { dimColor: true }, moreAbove ? '  ' + t('browser.moreAbove') : ' '),
                visible.map((e, i) => {
                    const idx = startIdx + i;
                    const focused = idx === cursor;
                    const isSel = selected.has(e.path);
                    // The 🔗 · 🔌 icons show in both modes — they state a fact. Only
                    // the ✕ and the dimming, which mean "you cannot pick this", are
                    // files-mode only.
                    //
                    // A name problem earns no icon of its own: the file is an
                    // ordinary file, and 📄 is the truth about it. The ✕ carries the
                    // "cannot pick", and the line below the list says why.
                    //
                    // 🔗 · 🔌 아이콘은 두 모드 모두에 나온다 — 사실을 말할 뿐이다. "고를 수
                    // 없다"를 뜻하는 ✕ 와 흐림만 files 모드 전용이다.
                    //
                    // 이름 문제에는 전용 아이콘을 주지 않는다. 그 파일은 평범한 파일이고
                    // 📄 가 그에 대한 사실이다. "고를 수 없다"는 ✕ 가 지고, 이유는 목록
                    // 아래 줄이 말한다.
                    const blocked = mode === 'files' &&
                        (e.reject !== null || (nameCanBlock && e.nameIssue !== null));
                    const checkbox = mode !== 'files' ? '' : blocked ? '✕ ' : isSel ? '◉ ' : '◯ ';
                    const icon = e.reject === 'symlink'
                        ? '🔗 '
                        : e.reject === 'special'
                            ? '🔌 '
                            : e.isDir
                                ? '📂 '
                                : '📄 ';
                    return (React.createElement(Box, { key: e.path },
                        React.createElement(Text, { color: focused ? 'cyan' : undefined, bold: focused }, focused ? '❯ ' : '  '),
                        React.createElement(Text, { color: isSel ? 'green' : focused && !blocked ? 'cyan' : undefined, dimColor: blocked }, checkbox),
                        React.createElement(Text, { color: focused && !blocked ? 'cyan' : undefined, bold: focused, dimColor: blocked },
                            icon,
                            e.name,
                            e.isDir ? '/' : '')));
                }),
                React.createElement(Text, { dimColor: true }, moreBelow ? '  ' + t('browser.moreBelow') : ' '))),
            mode === 'files' && (React.createElement(Box, { marginTop: 1, flexDirection: "column" },
                blockReason ? (React.createElement(Text, { color: "yellow" },
                    blockReason === 'symlink'
                        ? t('browser.blocked.symlink')
                        : t('browser.blocked.special'),
                    blockReason === 'symlink' && focusedEntry?.isDir
                        ? ' ' + t('browser.blocked.enterHint')
                        : '')) : nameIssue ? (
                /* The byte figures go only to the length message; the others
                 * ignore them. Passing them unconditionally keeps this one call.
                 * 바이트 수치는 길이 문구에만 쓰이고 나머지는 무시한다. 조건 없이
                 * 넘겨서 호출을 하나로 유지한다. */
                React.createElement(Text, { color: "yellow" }, t(NAME_BLOCK_KEY[nameIssue], {
                    bytes: Buffer.byteLength(focusedEntry?.name ?? '', 'utf8'),
                    budget: DEFAULT_NAME_BUDGET,
                }))) : null,
                React.createElement(Text, { color: selected.size > 0 ? 'yellow' : undefined, dimColor: selected.size === 0 },
                    t('browser.selected', { n: selected.size }),
                    selected.size === 0 ? t('browser.hintNoSel') : ''))))));
}
