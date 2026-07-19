import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Frame from './Frame.js';
import { useT } from '../i18n.js';
import { rejectOf, nameIssueOf, DEFAULT_NAME_BUDGET, } from '../paths.js';
const VIEWPORT = 10;
const NAME_BLOCK_KEY = {
    space: 'browser.blocked.nameSpace',
    char: 'browser.blocked.nameChar',
    long: 'browser.blocked.nameLong',
    reserved: 'browser.blocked.nameReserved',
};
function listDir(dir, showHidden) {
    const items = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => showHidden || !d.name.startsWith('.'))
        .map((d) => {
        const full = path.join(dir, d.name);
        let isDir = d.isDirectory();
        if (d.isSymbolicLink()) {
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
                        : '')) : nameIssue ? (React.createElement(Text, { color: "yellow" }, t(NAME_BLOCK_KEY[nameIssue], {
                    bytes: Buffer.byteLength(focusedEntry?.name ?? '', 'utf8'),
                    budget: DEFAULT_NAME_BUDGET,
                }))) : null,
                React.createElement(Text, { color: selected.size > 0 ? 'yellow' : undefined, dimColor: selected.size === 0 },
                    t('browser.selected', { n: selected.size }),
                    selected.size === 0 ? t('browser.hintNoSel') : ''))))));
}
