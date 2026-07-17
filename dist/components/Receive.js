import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Frame from './Frame.js';
import { receive } from '../tailscale.js';
import { useT } from '../i18n.js';
/**
 * Folder verdicts get one sentence plus the offending path underneath.
 *
 * There is no jump to Settings on purpose. This screen knows only onDone, and
 * teaching it about Settings would leak Screen out of app.tsx, which is the
 * single state machine. menu.zipWarn set the precedent: point at [설정] in
 * prose, do not navigate.
 *
 * 폴더 판정은 "문장 한 줄 + 아래에 문제의 경로"로 보여준다.
 *
 * 설정 화면으로 점프하지 않는 것은 의도다. 이 화면은 onDone 만 알고, Settings 를
 * 알게 하면 Screen 이 단일 상태 머신인 app.tsx 밖으로 샌다. menu.zipWarn 이
 * 선례다 — 문구로 [설정] 을 가리키되 이동하지는 않는다.
 */
const DIR_ERR_KEY = {
    'dir-missing': 'recv.err.dirMissing',
    'dir-not-dir': 'recv.err.dirNotDir',
    'dir-no-write': 'recv.err.dirNoWrite',
};
export default function Receive({ downloadDir, onDone }) {
    const t = useT();
    const [busy, setBusy] = useState(true);
    const [result, setResult] = useState(null);
    useEffect(() => {
        let cancelled = false;
        receive(downloadDir)
            .then((r) => {
            if (!cancelled) {
                setResult(r);
                setBusy(false);
            }
        })
            .catch((e) => {
            if (!cancelled) {
                setResult({
                    ok: false,
                    savedNames: [],
                    error: e instanceof Error ? e.message : String(e),
                });
                setBusy(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [downloadDir]);
    useInput((_input, key) => {
        if (!busy && (key.return || key.escape))
            onDone();
    });
    if (busy) {
        return (React.createElement(Frame, { screen: t('recv.screen') },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, null,
                    React.createElement(Text, { color: "cyan" }, "\u25C7"),
                    " ",
                    t('recv.receiving')),
                React.createElement(Text, { dimColor: true }, t('recv.receivingHint')))));
    }
    return (React.createElement(Frame, { screen: t('recv.doneScreen'), footer: t('common.enterMenu') },
        React.createElement(Box, { flexDirection: "column" }, result?.ok ? (result.savedNames.length > 0 ? (React.createElement(React.Fragment, null,
            React.createElement(Text, { color: "green" },
                "\u2714 ",
                t('recv.saved', { n: result.savedNames.length })),
            React.createElement(Text, { dimColor: true },
                "\u2192 ",
                downloadDir),
            React.createElement(Box, { marginTop: 1, flexDirection: "column" }, result.savedNames.map((n, i) => (React.createElement(Text, { key: i },
                React.createElement(Text, { color: "green" }, '  • '),
                n)))))) : (React.createElement(Text, { color: "yellow" }, t('recv.none')))) : result?.errorCode && DIR_ERR_KEY[result.errorCode] ? (React.createElement(React.Fragment, null,
            React.createElement(Text, { color: "yellow" },
                "\u26A0 ",
                t('recv.needDirTitle')),
            React.createElement(Text, null, t(DIR_ERR_KEY[result.errorCode])),
            React.createElement(Text, { dimColor: true }, result.error),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { dimColor: true }, t('recv.needDirHint'))))) : result?.needsSudo ? (React.createElement(React.Fragment, null,
            React.createElement(Text, { color: "yellow" },
                "\u26A0 ",
                t('recv.needSudoTitle')),
            React.createElement(Text, { dimColor: true }, t('recv.needSudoHint')),
            React.createElement(Box, { marginTop: 1 },
                React.createElement(Text, { color: "cyan" }, result.sudoCmd)))) : (React.createElement(React.Fragment, null,
            React.createElement(Text, { color: "red" },
                "\u2718 ",
                t('recv.fail')),
            React.createElement(Text, { dimColor: true }, result?.error))))));
}
