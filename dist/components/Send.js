import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import FileBrowser from './FileBrowser.js';
import TargetPicker from './TargetPicker.js';
import Frame from './Frame.js';
import { sendPaths } from '../tailscale.js';
import { archiverInstallHint } from '../zip.js';
import { useT } from '../i18n.js';
/** Error codes whose UI is one sentence plus the raw detail underneath.
 *  archiver-missing is absent on purpose: what goes under it is an install
 *  command, not raw text.
 *  "문장 한 줄 + 아래에 원문"으로 끝나는 에러 코드들. archiver-missing 은 일부러
 *  빠져 있다 — 그 아래에 붙는 것은 원문이 아니라 설치 명령이다. */
const ERR_KEY = {
    'archive-failed': 'send.err.archiveFailed',
    'symlink-path': 'send.err.symlinkPath',
    'special-path': 'send.err.specialPath',
    'missing-path': 'send.err.missingPath',
    'duplicate-name': 'send.err.duplicateName',
    empty: 'send.err.empty',
};
/** NameIssue → the short reason shown per file in the name-problem list.
 *  Spelled out so check-i18n sees the keys used, and both sides stay greppable.
 *  NameIssue 를 이름 문제 목록의 파일별 짧은 사유로 옮긴다. check-i18n 이 키가
 *  쓰인 것을 보도록, 그리고 양쪽 다 grep 되도록 적어 둔다. */
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
    // Turns the code strings tailscale.ts emits into localized prose.
    // tailscale.ts 가 넘기는 로그 코드를 현재 언어 문구로 변환.
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
        return (React.createElement(FileBrowser, { mode: "files", title: t('browser.filesTitle'), bundleMultiple: bundleMultiple, onSubmit: (selected) => {
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
    // done · 완료
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
                React.createElement(Text, { dimColor: true }, archiverInstallHint()))) : result?.nameProblems ? (
            /* One line per refused name, each with its own reason. The header
             * counts them; the list is what spares a fix-and-retry loop.
             * 거부된 이름마다 한 줄, 각자의 사유와 함께. 헤더가 개수를 세고, 목록이
             * 고치고-다시-보내는 반복을 덜어준다. */
            React.createElement(React.Fragment, null,
                React.createElement(Text, null, t('send.err.nameListHeader', {
                    n: result.nameProblems.length,
                })),
                result.nameProblems.map((p, i) => (
                // Key by index, not name: two picks from different folders can
                // share a basename, and the name alone would collide.
                // 이름이 아니라 인덱스로 키를 준다. 서로 다른 폴더의 두 선택이 같은
                // basename 을 가질 수 있어, 이름만으로는 충돌한다.
                React.createElement(Text, { key: i },
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
