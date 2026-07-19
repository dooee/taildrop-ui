import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useT } from '../i18n.js';

/** Narrowest frame we aim for; below this the layout stops making sense.
 *  Exported so tests assert against the constant, not a bare literal.
 *  이 아래로는 레이아웃이 무너지므로 지향하는 최소 프레임 폭. 테스트가 리터럴이
 *  아니라 이 상수를 기준으로 검증하도록 export 한다. */
export const MIN_WIDTH = 28;
/** Columns left free at the right edge so the frame never hugs the border.
 *  프레임이 우측 끝에 딱 붙지 않도록 비워 두는 여백 칸 수. */
const MARGIN = 2;
/** Terminal width fallback when stdout reports no size (non-TTY).
 *  stdout 이 크기를 알려주지 않을 때(비 TTY) 쓰는 기본 폭. */
const DEFAULT_COLUMNS = 80;

/** The terminal's current column count, or a sane default off a TTY.
 *  현재 터미널 열 수, TTY 가 아니면 합리적 기본값. */
function currentColumns(): number {
  return process.stdout.columns || DEFAULT_COLUMNS;
}

/** Turn a terminal column count into the frame width: fill the terminal (less
 *  a small margin) and floor at the minimum — but never exceed the terminal
 *  itself, so a terminal narrower than the minimum still fits without overflow.
 *  터미널 열 수를 프레임 폭으로 변환 — 여백만 빼고 채우며 최소 폭은 지키되,
 *  터미널 자체보다 넓히진 않는다. 최소 폭보다 좁은 터미널도 넘치지 않고 맞는다. */
function frameWidth(columns: number): number {
  return Math.min(columns, Math.max(MIN_WIDTH, columns - MARGIN));
}

/**
 * Current frame width, recomputed live as the terminal is resized.
 *
 * Ink re-renders on resize but only re-lays-out the root; a child Box with an
 * explicit `width` keeps its last value unless React re-runs the component.
 * So we track the column count in state and refresh it on stdout 'resize'.
 *
 * 터미널 리사이즈에 맞춰 다시 계산되는 현재 프레임 폭.
 * Ink 은 리사이즈 시 루트만 재배치하므로, 명시적 width 를 가진 자식 Box 는
 * React 가 컴포넌트를 다시 실행하지 않는 한 이전 값을 유지한다. 따라서 열 수를
 * 상태로 들고 stdout 'resize' 마다 갱신한다.
 */
function useFrameWidth(): number {
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
  const width = useFrameWidth();

  return (
    <Box flexDirection="column">
      {/* Title bar · 타이틀 바 */}
      <Box width={width}>
        <Text backgroundColor="cyan" color="black" bold>
          {' 🚀 Tailtoss '}
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
