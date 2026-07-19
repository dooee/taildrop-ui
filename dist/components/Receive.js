import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Frame from './Frame.js';
import { receive } from '../tailscale.js';
import { useT } from '../i18n.js';
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
