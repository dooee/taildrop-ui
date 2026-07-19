export function shouldColor({ isTTY, noColor, forceColor = false }) {
    if (noColor)
        return false;
    if (forceColor)
        return true;
    return isTTY === true;
}
const RESET = '\x1b[0m';
function sgr(code, s) {
    return `\x1b[${code}m${s}${RESET}`;
}
const identity = (s) => s;
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
        banner: (s) => sgr('1;30;46', s),
        cyan: (s) => sgr('36', s),
        bold: (s) => sgr('1', s),
        dim: (s) => sgr('2', s),
        green: (s) => sgr('32', s),
        yellow: (s) => sgr('33', s),
        red: (s) => sgr('31', s),
    };
}
export const plainStyle = makeStyle(false);
