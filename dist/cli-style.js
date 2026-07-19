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
/**
 * The color decision. NO_COLOR always wins (the spec: any value disables
 * color), then FORCE_COLOR can turn it on off a TTY, otherwise color follows
 * the stream being a terminal.
 *
 * 색 결정. NO_COLOR 가 항상 이긴다(규약: 어떤 값이든 색을 끈다). 그다음
 * FORCE_COLOR 가 비 TTY 에서도 켤 수 있고, 아니면 색은 스트림이 터미널인지를
 * 따른다.
 */
export function shouldColor({ isTTY, noColor, forceColor = false }) {
    if (noColor)
        return false;
    if (forceColor)
        return true;
    return isTTY === true;
}
const RESET = '\x1b[0m';
/** Wraps text in an SGR sequence and a reset, so styling never bleeds past it.
 *  텍스트를 SGR 시퀀스와 reset 으로 감싸 스타일이 뒤로 새지 않게 한다. */
function sgr(code, s) {
    return `\x1b[${code}m${s}${RESET}`;
}
/** The identity: color off collapses every helper to this.
 *  항등: 색이 꺼지면 모든 헬퍼가 이걸로 접힌다. */
const identity = (s) => s;
/**
 * Builds a styler for the given color decision. Color on wraps each helper in
 * its SGR code; color off returns identity for all of them, guaranteeing plain,
 * byte-identical output.
 *
 * 주어진 색 결정에 맞는 styler 를 만든다. 색이 켜지면 각 헬퍼를 SGR 코드로 감싸고,
 * 꺼지면 모두 항등을 돌려줘 평문·바이트 동일 출력을 보장한다.
 */
export function makeStyle(color) {
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
export const plainStyle = makeStyle(false);
