/**
 * A tiny, dependency-free ANSI styler for the non-interactive CLI output. No
 * chalk: the whole surface is a handful of SGR codes, and adding a dependency
 * that the published package would carry is not worth it. The one rule that
 * matters is graceful degradation — when color is off every helper is the
 * identity function, so the emitted bytes are exactly what they were before any
 * styling existed. That is what keeps piped/redirected output and NO_COLOR
 * clean, and lets the render functions default to plain.
 *
 * 비대화형 CLI 출력을 위한 아주 작은, 의존성 없는 ANSI styler. chalk 를 쓰지
 * 않는다 — 표면 전체가 SGR 코드 몇 개뿐이고, 배포 패키지가 짊어질 의존성을 더할
 * 값어치가 없다. 중요한 규칙은 우아한 저하 하나다 — 색이 꺼지면 모든 헬퍼가
 * 항등 함수라, 내보내는 바이트가 스타일이 없던 때와 정확히 같다. 이것이
 * 파이프·리다이렉트 출력과 NO_COLOR 를 깨끗하게 지키고, 렌더 함수가 평문으로
 * 폴백하게 한다.
 */

/** The three facts the color decision rests on, passed in rather than read so
 *  the predicate stays pure and unit-testable while the shell supplies the real
 *  process values.
 *  색 결정이 기대는 세 가지 사실. 읽지 않고 인자로 받아 술어는 순수·단위검사
 *  가능하게 두고, 껍데기가 실제 process 값을 넘긴다. */
export interface ColorEnv {
  /** Whether the target stream is a terminal (stream.isTTY). / 대상 스트림이 터미널인지. */
  isTTY: boolean;
  /** Whether NO_COLOR is present in the environment (any value counts, even
   *  ''). / 환경에 NO_COLOR 가 있는지(빈 문자열 포함 어떤 값이든 해당). */
  noColor: boolean;
  /** Whether FORCE_COLOR asks for color on a non-TTY. Optional. / 비 TTY 에서도
   *  색을 요구하는 FORCE_COLOR 여부. 선택. */
  forceColor?: boolean;
}

/**
 * The color decision. NO_COLOR always wins (the spec: any value disables
 * color), then FORCE_COLOR can turn it on off a TTY, otherwise color follows
 * the stream being a terminal.
 *
 * 색 결정. NO_COLOR 가 항상 이긴다(규약: 어떤 값이든 색을 끈다). 그다음
 * FORCE_COLOR 가 비 TTY 에서도 켤 수 있고, 아니면 색은 스트림이 터미널인지를
 * 따른다.
 */
export function shouldColor({ isTTY, noColor, forceColor = false }: ColorEnv): boolean {
  if (noColor) return false;
  if (forceColor) return true;
  return isTTY === true;
}

/** A set of named styling helpers. Each takes a string and returns it styled,
 *  or unchanged when color is off. Semantic names, not raw colors, so the
 *  render functions read as intent.
 *  이름 붙은 스타일 헬퍼 모음. 각자 문자열을 받아 스타일을 입혀 돌려주고, 색이
 *  꺼지면 그대로 둔다. 원색이 아니라 의미 이름이라 렌더 함수가 의도로 읽힌다. */
export interface Styler {
  /** The product badge — background fill, like the UI's ` 🚀 Tailtoss `.
   *  제품 배지 — 배경 채움, UI 의 ` 🚀 Tailtoss ` 처럼. */
  banner(s: string): string;
  cyan(s: string): string;
  bold(s: string): string;
  dim(s: string): string;
  green(s: string): string;
  yellow(s: string): string;
  red(s: string): string;
}

const RESET = '\x1b[0m';

/** Wraps text in an SGR sequence and a reset, so styling never bleeds past it.
 *  텍스트를 SGR 시퀀스와 reset 으로 감싸 스타일이 뒤로 새지 않게 한다. */
function sgr(code: string, s: string): string {
  return `\x1b[${code}m${s}${RESET}`;
}

/** The identity: color off collapses every helper to this.
 *  항등: 색이 꺼지면 모든 헬퍼가 이걸로 접힌다. */
const identity = (s: string): string => s;

/**
 * Builds a styler for the given color decision. Color on wraps each helper in
 * its SGR code; color off returns identity for all of them, guaranteeing plain,
 * byte-identical output.
 *
 * 주어진 색 결정에 맞는 styler 를 만든다. 색이 켜지면 각 헬퍼를 SGR 코드로 감싸고,
 * 꺼지면 모두 항등을 돌려줘 평문·바이트 동일 출력을 보장한다.
 */
export function makeStyle(color: boolean): Styler {
  if (!color) {
    return {
      banner: identity,
      cyan: identity,
      bold: identity,
      dim: identity,
      green: identity,
      yellow: identity,
      red: identity,
    };
  }
  return {
    // Bold black on a cyan fill — echoes the interactive header's badge.
    // 시안 채움 위 굵은 검정 — 대화형 헤더의 배지를 반영한다.
    banner: (s) => sgr('1;30;46', s),
    cyan: (s) => sgr('36', s),
    bold: (s) => sgr('1', s),
    dim: (s) => sgr('2', s),
    green: (s) => sgr('32', s),
    yellow: (s) => sgr('33', s),
    red: (s) => sgr('31', s),
  };
}

/** The color-off styler, reused as the default so render functions stay plain
 *  unless a caller opts into color.
 *  색 꺼짐 styler. 기본값으로 재사용해 호출자가 색을 택하지 않는 한 렌더 함수가
 *  평문을 유지한다. */
export const plainStyle: Styler = makeStyle(false);
