import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import FileBrowser from './FileBrowser.js';
import Frame from './Frame.js';
import { saveConfig, configPath } from '../config.js';
import { dirIssueOf } from '../paths.js';
import { archiverKind, resetArchiverCache, archiverInstallHint, } from '../zip.js';
import { useT } from '../i18n.js';
function Indicator({ isSelected }) {
    return (React.createElement(Box, { marginRight: 1 },
        React.createElement(Text, { color: "cyan" }, isSelected ? '❯' : ' ')));
}
function Item({ isSelected, label }) {
    return (React.createElement(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected }, label));
}
export default function Settings({ config, archiver, onArchiverChange, onChange, onDone, }) {
    const t = useT();
    const [stage, setStage] = useState('menu');
    const [savedKey, setSavedKey] = useState('set.savedDir');
    const [checking, setChecking] = useState(false);
    /**
     * ESC returns each submenu to the Settings menu, as the footer hint
     * promises. pickDir is excluded — FileBrowser owns ESC via onCancel there,
     * and a second handler would fire alongside it.
     *
     * ESC 는 푸터 안내대로 각 서브메뉴에서 설정 메뉴로 돌아간다. pickDir 은
     * 제외 — 그 화면은 FileBrowser 가 onCancel 로 ESC 를 직접 처리하며,
     * 여기서도 받으면 핸들러가 이중으로 동작한다.
     */
    useInput((_input, key) => {
        if (key.escape &&
            (stage === 'pickLang' || stage === 'pickMulti' || stage === 'zip')) {
            setStage('menu');
        }
    });
    const commit = (next, msgKey) => {
        saveConfig(next);
        onChange(next);
        setSavedKey(msgKey);
        setStage('saved');
    };
    /**
     * Drops the cached lookup and detects again, so a tool the user installed
     * while the app was open is picked up without a restart.
     *
     * 캐시를 버리고 다시 감지한다. 앱을 켜 둔 채 설치한 도구도 재시작 없이 잡힌다.
     */
    const recheck = async () => {
        setChecking(true);
        resetArchiverCache();
        const kind = await archiverKind();
        onArchiverChange(kind);
        setChecking(false);
    };
    if (stage === 'pickDir') {
        return (React.createElement(FileBrowser, { mode: "folder", title: t('browser.folderTitle'), 
            /* A folder that is not there cannot be browsed: listDir would throw and
             * open on browser.readError with an empty list — at the exact moment
             * the user came here to fix that folder. Fall through to the browser's
             * own default (home) instead.
             * 없는 폴더는 열 수 없다. listDir 이 던져서 빈 목록과 browser.readError 로
             * 열리는데, 하필 사용자가 그 폴더를 고치러 온 순간이다. 대신 브라우저
             * 자신의 기본값(홈)으로 넘긴다. */
            initialDir: dirIssueOf(config.downloadDir) ? undefined : config.downloadDir, onSubmit: ([dir]) => commit({ ...config, downloadDir: dir }, 'set.savedDir'), onCancel: () => setStage('menu') }));
    }
    if (stage === 'pickLang') {
        return (React.createElement(Frame, { screen: t('set.langScreen'), footer: t('common.escBack') },
            React.createElement(SelectInput, { items: [
                    { key: 'ko', label: '한국어 (KO)', value: 'ko' },
                    { key: 'en', label: 'English (EN)', value: 'en' },
                ], indicatorComponent: Indicator, itemComponent: Item, initialIndex: config.lang === 'en' ? 1 : 0, onSelect: (item) => commit({ ...config, lang: item.value }, 'set.savedLang') })));
    }
    if (stage === 'pickMulti') {
        return (React.createElement(Frame, { screen: t('set.multiScreen'), footer: t('common.escBack') },
            React.createElement(SelectInput, { items: [
                    { key: 'files', label: t('set.multi.files'), value: false },
                    { key: 'zip', label: t('set.multi.zip'), value: true },
                ], indicatorComponent: Indicator, itemComponent: Item, initialIndex: config.bundleMultiple ? 1 : 0, onSelect: (item) => commit({ ...config, bundleMultiple: item.value }, 'set.savedMulti') })));
    }
    if (stage === 'zip') {
        return (React.createElement(Frame, { screen: t('set.zipScreen'), footer: t('common.escBack') },
            React.createElement(Box, { flexDirection: "column" },
                checking ? (React.createElement(Text, { color: "cyan" },
                    "\u25C7 ",
                    t('set.zipChecking'))) : archiver ? (React.createElement(React.Fragment, null,
                    React.createElement(Text, { color: "green" },
                        "\u2714 ",
                        t('set.zipFoundTitle', { kind: archiver })),
                    React.createElement(Text, { dimColor: true }, t('set.zipFoundHint')))) : (React.createElement(React.Fragment, null,
                    React.createElement(Text, { color: "yellow" },
                        "\u26A0 ",
                        t('set.zipMissingTitle')),
                    React.createElement(Text, { dimColor: true }, t('set.zipMissingHint')),
                    React.createElement(Text, { color: "cyan" }, '  ' + archiverInstallHint()))),
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(Text, { dimColor: true }, t('set.zipWhy'))),
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(SelectInput, { items: [
                            { key: 'recheck', label: t('set.zipRecheck'), value: 'recheck' },
                            { key: 'back', label: t('set.back'), value: 'back' },
                        ], indicatorComponent: Indicator, itemComponent: Item, onSelect: (item) => {
                            if (item.value === 'recheck')
                                void recheck();
                            else
                                setStage('menu');
                        } })))));
    }
    if (stage === 'saved') {
        return (React.createElement(Frame, { screen: t('set.savedScreen'), footer: t('common.enterMenu') },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { color: "green" },
                    "\u2714 ",
                    t(savedKey)),
                React.createElement(Box, { marginTop: 1 },
                    React.createElement(SelectInput, { items: [{ key: 'ok', label: t('set.confirm'), value: 'ok' }], indicatorComponent: Indicator, itemComponent: Item, onSelect: () => onDone() })))));
    }
    // menu · 메뉴
    const multiLabel = config.bundleMultiple ? t('set.multi.zip') : t('set.multi.files');
    const langLabel = config.lang === 'en' ? 'English (EN)' : '한국어 (KO)';
    return (React.createElement(Frame, { screen: t('set.screen'), footer: t('set.footer') },
        React.createElement(Box, { flexDirection: "column" },
            React.createElement(Box, { marginBottom: 1, flexDirection: "column" },
                React.createElement(Text, { dimColor: true },
                    t('set.currentDir'),
                    " ",
                    React.createElement(Text, { color: "green" }, config.downloadDir)),
                React.createElement(Text, { dimColor: true },
                    t('set.currentLang'),
                    " ",
                    React.createElement(Text, { color: "green" }, langLabel)),
                React.createElement(Text, { dimColor: true },
                    t('set.currentMulti'),
                    " ",
                    React.createElement(Text, { color: "green" }, multiLabel)),
                React.createElement(Text, { dimColor: true },
                    t('set.currentZip'),
                    ' ',
                    archiver ? (React.createElement(Text, { color: "green" }, t('set.zip.ok', { kind: archiver }))) : (React.createElement(Text, { color: "yellow" }, t('set.zip.missing')))),
                React.createElement(Text, { dimColor: true },
                    t('set.configFile'),
                    " ",
                    configPath())),
            React.createElement(SelectInput, { items: [
                    { key: 'dir', label: t('set.changeDir'), value: 'dir' },
                    { key: 'lang', label: t('set.changeLang'), value: 'lang' },
                    { key: 'multi', label: t('set.changeMulti'), value: 'multi' },
                    { key: 'zip', label: t('set.recheckZip'), value: 'zip' },
                    { key: 'back', label: t('set.back'), value: 'back' },
                ], indicatorComponent: Indicator, itemComponent: Item, onSelect: (item) => {
                    if (item.value === 'dir')
                        setStage('pickDir');
                    else if (item.value === 'lang')
                        setStage('pickLang');
                    else if (item.value === 'multi')
                        setStage('pickMulti');
                    else if (item.value === 'zip')
                        setStage('zip');
                    else
                        onDone();
                } }))));
}
