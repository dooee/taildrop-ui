import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import FileBrowser from './FileBrowser.js';
import TargetPicker from './TargetPicker.js';
import Frame from './Frame.js';
import { sendPaths } from '../tailscale.js';
import { archiverInstallHint } from '../zip.js';
import { useT } from '../i18n.js';
const ERR_KEY = {
    'archive-failed': 'send.err.archiveFailed',
    'symlink-path': 'send.err.symlinkPath',
    'special-path': 'send.err.specialPath',
    'missing-path': 'send.err.missingPath',
    'duplicate-name': 'send.err.duplicateName',
    empty: 'send.err.empty',
};
const NAME_REASON_KEY = {
    space: 'send.err.nameReason.space',
    char: 'send.err.nameReason.char',
    long: 'send.err.nameReason.long',
    reserved: 'send.err.nameReason.reserved',
};
export default function Send({ bundleMultiple, onDone }) {
    const t = useT();
    const [stage, setStage] = useState('browse');
    const [paths, setPaths] = useState([]);
    const [logs, setLogs] = useState([]);
    const [result, setResult] = useState(null);
    useInput((_input, key) => {
        if (stage === 'done' && (key.return || key.escape))
            onDone();
    });
    const decodeLog = (code) => {
        if (code.startsWith('bundle:')) {
            return t('send.bundling', { n: code.slice('bundle:'.length) });
        }
        if (code.startsWith('zip:')) {
            return t('send.zipping', { name: code.slice('zip:'.length) });
        }
        if (code.startsWith('cp:')) {
            const rest = code.slice('cp:'.length);
            const idx = rest.lastIndexOf(':');
            const target = rest.slice(0, idx);
            const n = rest.slice(idx + 1);
            return t('send.cpProgress', { target, n });
        }
        return code;
    };
    const startSend = async (target) => {
        setStage('sending');
        const res = await sendPaths(paths, target.name, { bundleMultiple }, (msg) => setLogs((prev) => [...prev, decodeLog(msg)]));
        setResult(res);
        setStage('done');
    };
    if (stage === 'browse') {
        return (React.createElement(FileBrowser, { mode: "files", title: t('browser.filesTitle'), initialDir: process.cwd(), bundleMultiple: bundleMultiple, onSubmit: (selected) => {
                setPaths(selected);
                setStage('pickTarget');
            }, onCancel: onDone }));
    }
    if (stage === 'pickTarget') {
        return (React.createElement(TargetPicker, { onSelect: startSend, onCancel: () => setStage('browse') }));
    }
    if (stage === 'sending') {
        return (React.createElement(Frame, { screen: t('send.sendingScreen') },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { color: "cyan" },
                    "\u25C7 ",
                    t('send.sending')),
                logs.map((l, i) => (React.createElement(Text, { key: i, dimColor: true },
                    '  ',
                    l))))));
    }
    return (React.createElement(Frame, { screen: t('send.doneScreen'), footer: t('common.enterMenu') },
        React.createElement(Box, { flexDirection: "column" }, result?.ok ? (React.createElement(React.Fragment, null,
            React.createElement(Text, { color: "green" },
                "\u2714 ",
                t('send.ok', { n: result.sentNames.length })),
            result.sentNames.map((n, i) => (React.createElement(Text, { key: i },
                React.createElement(Text, { color: "green" }, '  • '),
                n))))) : (React.createElement(React.Fragment, null,
            React.createElement(Text, { color: "red" },
                "\u2718 ",
                t('send.fail')),
            result?.errorCode === 'archiver-missing' ? (React.createElement(React.Fragment, null,
                React.createElement(Text, null, t('send.err.archiverMissing')),
                React.createElement(Text, { dimColor: true }, archiverInstallHint()))) : result?.nameProblems ? (React.createElement(React.Fragment, null,
                React.createElement(Text, null, t('send.err.nameListHeader', {
                    n: result.nameProblems.length,
                })),
                result.nameProblems.map((p, i) => (React.createElement(Text, { key: i },
                    React.createElement(Text, { color: "yellow" }, '  ✕ '),
                    p.name,
                    React.createElement(Text, { dimColor: true },
                        '  — ',
                        t(NAME_REASON_KEY[p.issue], {
                            bytes: p.bytes,
                            budget: result.nameBudget ?? 0,
                        }))))))) : result?.errorCode && ERR_KEY[result.errorCode] ? (React.createElement(React.Fragment, null,
                React.createElement(Text, null, t(ERR_KEY[result.errorCode])),
                result.error ? React.createElement(Text, { dimColor: true }, result.error) : null)) : (React.createElement(Text, { dimColor: true }, result?.error)))))));
}
