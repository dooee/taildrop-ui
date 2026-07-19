import React, { useEffect, useMemo, useState } from 'react';
import { Box, useApp } from 'ink';
import MainMenu from './components/MainMenu.js';
import Send from './components/Send.js';
import Receive from './components/Receive.js';
import Settings from './components/Settings.js';
import Help from './components/Help.js';
import { loadConfig } from './config.js';
import { dirIssueOf } from './paths.js';
import { archiverKind } from './zip.js';
import { LangContext, makeT } from './i18n.js';
export default function App() {
    const { exit } = useApp();
    const [screen, setScreen] = useState('menu');
    const [config, setConfig] = useState(() => loadConfig());
    const [archiver, setArchiver] = useState(null);
    useEffect(() => {
        void archiverKind().then(setArchiver);
    }, []);
    const downloadDirOk = useMemo(() => dirIssueOf(config.downloadDir) === null, [config.downloadDir]);
    const ctx = useMemo(() => ({ lang: config.lang, t: makeT(config.lang) }), [config.lang]);
    return (React.createElement(LangContext.Provider, { value: ctx },
        React.createElement(Box, { flexDirection: "column", marginTop: 1 },
            screen === 'menu' && (React.createElement(MainMenu, { downloadDir: config.downloadDir, downloadDirOk: downloadDirOk, hasArchiver: archiver !== null, onSelect: (target) => {
                    if (target === 'quit')
                        exit();
                    else
                        setScreen(target);
                } })),
            screen === 'send' && (React.createElement(Send, { bundleMultiple: config.bundleMultiple, onDone: () => setScreen('menu') })),
            screen === 'receive' && (React.createElement(Receive, { downloadDir: config.downloadDir, onDone: () => setScreen('menu') })),
            screen === 'settings' && (React.createElement(Settings, { config: config, archiver: archiver, onArchiverChange: setArchiver, onChange: setConfig, onDone: () => setScreen('menu') })),
            screen === 'help' && React.createElement(Help, { onDone: () => setScreen('menu') }))));
}
