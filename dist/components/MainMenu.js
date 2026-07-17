import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Frame from './Frame.js';
import { useT } from '../i18n.js';
function Indicator({ isSelected }) {
    return (React.createElement(Box, { marginRight: 1 },
        React.createElement(Text, { color: "cyan" }, isSelected ? '❯' : ' ')));
}
function Item({ isSelected, label }) {
    return (React.createElement(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected }, label));
}
export default function MainMenu({ downloadDir, downloadDirOk, hasArchiver, onSelect, }) {
    const t = useT();
    const items = [
        { key: 'send', label: t('menu.send'), value: 'send' },
        { key: 'receive', label: t('menu.receive'), value: 'receive' },
        { key: 'settings', label: t('menu.settings'), value: 'settings' },
        { key: 'help', label: t('menu.help'), value: 'help' },
        { key: 'quit', label: t('menu.quit'), value: 'quit' },
    ];
    return (React.createElement(Frame, { screen: t('menu.screen'), footer: t('menu.footer') },
        React.createElement(Box, { flexDirection: "column" },
            React.createElement(Box, { marginBottom: 1, flexDirection: "column" },
                React.createElement(Text, { dimColor: true }, t('menu.prompt')),
                React.createElement(Text, { dimColor: true },
                    t('menu.downloadLabel'),
                    ' ',
                    React.createElement(Text, { color: downloadDirOk ? 'green' : 'yellow' }, downloadDir)),
                !downloadDirOk && React.createElement(Text, { color: "yellow" }, t('menu.dirWarn')),
                !hasArchiver && React.createElement(Text, { color: "yellow" }, t('menu.zipWarn'))),
            React.createElement(SelectInput, { items: items, indicatorComponent: Indicator, itemComponent: Item, onSelect: (item) => onSelect(item.value) }))));
}
