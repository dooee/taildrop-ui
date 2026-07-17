import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Frame from './Frame.js';
import { listTargets } from '../tailscale.js';
import { useT } from '../i18n.js';
function Indicator({ isSelected }) {
    return (React.createElement(Box, { marginRight: 1 },
        React.createElement(Text, { color: "cyan" }, isSelected ? '❯' : ' ')));
}
function Item({ isSelected, label }) {
    return (React.createElement(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected }, label));
}
export default function TargetPicker({ onSelect, onCancel }) {
    const t = useT();
    const [targets, setTargets] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        listTargets()
            .then(setTargets)
            .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, []);
    useInput((_input, key) => {
        if (key.escape)
            onCancel();
    });
    if (error) {
        return (React.createElement(Frame, { screen: t('target.screen'), footer: t('common.escBack') },
            React.createElement(Text, { color: "red" }, t('target.error')),
            React.createElement(Text, { dimColor: true }, error)));
    }
    if (!targets) {
        return (React.createElement(Frame, { screen: t('target.screen'), footer: t('common.escBack') },
            React.createElement(Text, null, t('common.loadingDevices'))));
    }
    if (targets.length === 0) {
        return (React.createElement(Frame, { screen: t('target.screen'), footer: t('common.escBack') },
            React.createElement(Text, { color: "yellow" },
                "\u26A0 ",
                t('target.none')),
            React.createElement(Text, { dimColor: true }, t('target.noneHint'))));
    }
    const items = targets.map((tg) => ({
        key: tg.name,
        label: `${tg.name}   (${tg.ip})`,
        value: tg.name,
    }));
    return (React.createElement(Frame, { screen: t('target.screen'), footer: t('target.footer') },
        React.createElement(Box, { flexDirection: "column" },
            React.createElement(Box, { marginBottom: 1 },
                React.createElement(Text, { dimColor: true }, t('target.prompt'))),
            React.createElement(SelectInput, { items: items, indicatorComponent: Indicator, itemComponent: Item, onSelect: (item) => {
                    const target = targets.find((tg) => tg.name === item.value);
                    onSelect(target);
                } }))));
}
