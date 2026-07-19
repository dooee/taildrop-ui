import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useT } from '../i18n.js';
export const MIN_WIDTH = 28;
const MARGIN = 2;
const DEFAULT_COLUMNS = 80;
function currentColumns() {
    return process.stdout.columns || DEFAULT_COLUMNS;
}
function frameWidth(columns) {
    return Math.min(columns, Math.max(MIN_WIDTH, columns - MARGIN));
}
function useFrameWidth() {
    const [columns, setColumns] = useState(currentColumns);
    useEffect(() => {
        const onResize = () => setColumns(currentColumns());
        process.stdout.on('resize', onResize);
        return () => {
            process.stdout.off('resize', onResize);
        };
    }, []);
    return frameWidth(columns);
}
export default function Frame({ screen, footer, children }) {
    const t = useT();
    const width = useFrameWidth();
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { width: width },
            React.createElement(Text, { backgroundColor: "cyan", color: "black", bold: true }, ' 🚀 Tailtoss '),
            React.createElement(Text, { color: "cyan" }, ' ' + t('app.subtitle')),
            screen ? React.createElement(Text, { dimColor: true }, '  › ' + screen) : null),
        React.createElement(Box, { flexDirection: "column", width: width, borderStyle: "single", borderColor: "gray", borderTop: true, borderBottom: true, borderLeft: false, borderRight: false, paddingY: 0 }, children),
        footer ? (React.createElement(Box, { width: width },
            React.createElement(Text, { dimColor: true }, footer))) : null));
}
