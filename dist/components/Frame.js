import React from 'react';
import { Box, Text } from 'ink';
import { useT } from '../i18n.js';
/**
 * The common frame wrapping every screen: title bar, body between two
 * horizontal rules, then a hint line.
 *
 * Vertical borders are intentionally omitted. When a terminal font renders
 * Hangul (width 2) or emoji differently than ink computes, vertical borders
 * drift and the box breaks. Horizontal rules alone always draw straight,
 * whatever the line contents.
 *
 * 모든 화면을 감싸는 공통 프레임.
 * 상단 타이틀 바 + 위/아래 가로 구분선 본문 + 하단 도움말.
 *
 * 좌우 세로 테두리는 일부러 쓰지 않는다. 한글(폭 2)이나 이모지의 폭을
 * 터미널 폰트가 ink 의 계산과 다르게 그리면 세로 테두리가 어긋나 표가 깨지기 때문.
 * 가로줄만 쓰면 줄 내용 폭과 무관하게 항상 반듯하게 그려진다.
 */
export default function Frame({ screen, footer, children }) {
    const t = useT();
    const columns = process.stdout.columns || 80;
    const width = Math.max(28, Math.min(columns - 2, 66));
    return (React.createElement(Box, { flexDirection: "column" },
        React.createElement(Box, { width: width },
            React.createElement(Text, { backgroundColor: "cyan", color: "black", bold: true }, ' 🚀 Taildrop '),
            React.createElement(Text, { color: "cyan" }, ' ' + t('app.subtitle')),
            screen ? React.createElement(Text, { dimColor: true }, '  › ' + screen) : null),
        React.createElement(Box, { flexDirection: "column", width: width, borderStyle: "single", borderColor: "gray", borderTop: true, borderBottom: true, borderLeft: false, borderRight: false, paddingY: 0 }, children),
        footer ? (React.createElement(Box, { width: width },
            React.createElement(Text, { dimColor: true }, footer))) : null));
}
