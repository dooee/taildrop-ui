import React from 'react';
import { Box, Text } from 'ink';
import { useT } from '../i18n.js';

interface Props {
  /** Screen title, shown at the right of the header.
   *  화면 제목 (헤더 우측에 표시). */
  screen?: string;
  /** Hint line below the body. / 하단 도움말 문구. */
  footer?: string;
  children: React.ReactNode;
}

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
export default function Frame({ screen, footer, children }: Props) {
  const t = useT();
  const columns = process.stdout.columns || 80;
  const width = Math.max(28, Math.min(columns - 2, 66));

  return (
    <Box flexDirection="column">
      {/* Title bar · 타이틀 바 */}
      <Box width={width}>
        <Text backgroundColor="cyan" color="black" bold>
          {' 🚀 Taildrop '}
        </Text>
        <Text color="cyan">{' ' + t('app.subtitle')}</Text>
        {screen ? <Text dimColor>{'  › ' + screen}</Text> : null}
      </Box>

      {/* Body: horizontal rules only · 본문: 위/아래 가로줄만 */}
      <Box
        flexDirection="column"
        width={width}
        borderStyle="single"
        borderColor="gray"
        borderTop
        borderBottom
        borderLeft={false}
        borderRight={false}
        paddingY={0}
      >
        {children}
      </Box>

      {/* Hint line · 하단 도움말 */}
      {footer ? (
        <Box width={width}>
          <Text dimColor>{footer}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
