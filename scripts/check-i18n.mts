/**
 * i18n consistency check. Run with `npm run check:i18n`.
 *
 * Background: Frame.tsx hardcoded the header subtitle in Korean, so switching
 * the language to English still left every screen's header in Korean. The
 * app.subtitle key existed in both dictionaries but nothing referenced it — an
 * orphan. Hardcoding and orphan keys are two faces of the same mistake, so the
 * three checks below look for both.
 *
 * i18n 정합성 검사. `npm run check:i18n` 으로 실행한다.
 *
 * 배경: Frame.tsx 가 헤더 부제를 한글로 하드코딩해, 언어를 English 로 바꿔도
 * 모든 화면 상단이 한국어로 남는 버그가 있었다. app.subtitle 키는 사전 양쪽에
 * 있었지만 아무도 쓰지 않는 고아 키였다. 아래 세 검사가 그 유형을 잡는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { dicts } from '../src/i18n.js';
import { loadConfig } from '../src/config.js';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

/**
 * This tool's own messages. They are kept here rather than in src/i18n.ts on
 * purpose: the orphan check only scans UI_FILES, so keys used solely by this
 * script would be reported as orphans.
 *
 * The language follows the app's setting — the project already has exactly one
 * notion of "the language", so there is no second one to configure. It
 * defaults to en, which is what a fresh clone or CI gets.
 *
 * 이 도구 자신의 출력 문구. src/i18n.ts 가 아니라 여기 두는 이유는, 고아 검사가
 * UI_FILES 만 훑기 때문에 이 스크립트만 쓰는 키는 고아로 잡히기 때문이다.
 *
 * 언어는 앱 설정을 따른다. 이 프로젝트에는 "언어" 개념이 이미 하나뿐이라 새로
 * 만들 이유가 없다. 기본값은 en 이며, 갓 clone 한 환경이나 CI 가 이에 해당한다.
 */
const MSG = {
  ko: {
    failed: '✘ i18n 검사 실패',
    missing: (dict: string, key: string) => `${dict} 사전에 키 누락: '${key}'`,
    orphan: (key: string) => `고아 키(사전에만 있고 미사용): '${key}'`,
    hardcoded: (at: string, code: string) => `하드코딩 한글, t() 를 쓸 것\n      ${at}: ${code}`,
    summary: (n: number) => `총 ${n}건.`,
    passed: (keys: number, files: number) => `✔ i18n 검사 통과 (키 ${keys}개, 파일 ${files}개)`,
  },
  en: {
    failed: '✘ i18n check failed',
    missing: (dict: string, key: string) => `Missing from the ${dict} dictionary: '${key}'`,
    orphan: (key: string) => `Orphan key, defined but never used: '${key}'`,
    hardcoded: (at: string, code: string) => `Hardcoded Hangul, use t()\n      ${at}: ${code}`,
    summary: (n: number) => `${n} problem(s).`,
    passed: (keys: number, files: number) =>
      `✔ i18n check passed (${keys} keys, ${files} files)`,
  },
} as const;

const m = MSG[loadConfig().lang] ?? MSG.en;

/** Hangul syllables. / 한글 음절. */
const HANGUL = /[가-힣]/;

/** A whole-line comment (// · JSDoc * · /* · JSX {&#47;*).
 *  주석으로만 이루어진 줄. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*|\{\/\*)/;

/**
 * Strips comments that trail code on the same line, so a bilingual
 * `// English · 한국어` note is not mistaken for a hardcoded UI string.
 * Requires whitespace before `//` so URLs inside strings survive.
 *
 * 코드 뒤에 붙은 주석을 떼어낸다. `// English · 한국어` 병기 주석이
 * 하드코딩된 UI 문자열로 오인되지 않게 하기 위함. `//` 앞의 공백을
 * 요구하므로 문자열 안의 URL(`https://…`)은 살아남는다.
 */
function stripTrailingComment(line: string): string {
  return line.replace(/\{\/\*.*?\*\/\}/g, '').replace(/\s+\/\/.*$/, '');
}

/**
 * Where a Hangul literal is legitimate.
 * - Settings.tsx language labels: a language name belongs in its own language.
 * - cli.tsx: runs before the React context exists, so useT() is unavailable
 *   (excluded from the scan entirely, see UI_FILES).
 *
 * 한글 리터럴이 허용되는 예외.
 * - Settings.tsx 언어 라벨: 언어 이름은 각자의 언어로 쓰는 것이 올바르다.
 * - cli.tsx: React 컨텍스트 이전에 실행되어 useT() 를 못 쓴다 (검사 대상에서 제외).
 */
const ALLOWED_HANGUL = ['한국어 (KO)'];

/** Files scanned for hardcoding; cli.tsx is excluded for the reason above.
 *  하드코딩 검사 대상. cli.tsx 는 위 이유로 제외한다. */
const UI_FILES = [
  'src/app.tsx',
  ...fs
    .readdirSync(path.join(ROOT, 'src/components'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `src/components/${f}`),
];

/**
 * Files scanned for key *references* (the orphan check). This is a superset of
 * UI_FILES: cli.tsx is skipped by the hardcoding scan because it runs before
 * the React context (so a Hangul literal there is legitimate), but it still
 * pulls its setup-guidance strings from the dictionary via makeT — so its keys
 * must count as used, or they would read as orphans.
 *
 * 키 *참조* 검사(고아 검사) 대상 파일. UI_FILES 의 상위집합이다. cli.tsx 는 React
 * 컨텍스트 이전에 돌아 하드코딩 스캔에서 빠지지만(그곳의 한글 리터럴은 정당하다),
 * makeT 로 사전에서 셋업 안내 문구를 가져다 쓴다 — 그 키들이 사용된 것으로
 * 집계되지 않으면 고아로 읽히기 때문이다.
 */
const REF_FILES = [...UI_FILES, 'src/cli.tsx'];

const problems: string[] = [];

// 1. ko/en key parity. makeT falls back to ko silently, so a missing en key
//    surfaces Korean with no error at all.
// 1. ko/en 키 패리티 — makeT 가 ko 로 조용히 폴백하므로 en 누락은 에러 없이
//    한국어가 노출된다.
const koKeys = Object.keys(dicts.ko);
const enKeys = Object.keys(dicts.en);
for (const k of koKeys) {
  if (!(k in dicts.en)) problems.push(m.missing('en', k));
}
for (const k of enKeys) {
  if (!(k in dicts.ko)) problems.push(m.missing('ko', k));
}

// 2. Orphan keys: defined but never referenced. A signal someone hardcoded it.
// 2. 고아 키 — 사전에만 있고 코드가 안 쓰는 키. 하드코딩의 신호다.
const sources = REF_FILES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
for (const k of koKeys) {
  if (!sources.includes(`'${k}'`)) {
    problems.push(m.orphan(k));
  }
}

// 3. Hardcoded Hangul in UI code, comments and allowed exceptions aside.
// 3. 하드코딩 한글 — 주석과 허용 예외를 제외한 UI 코드 안의 한글.
for (const file of UI_FILES) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (COMMENT_LINE.test(line)) return;
    const code = stripTrailingComment(line);
    if (!HANGUL.test(code)) return;
    if (ALLOWED_HANGUL.some((a) => code.includes(a))) return;
    problems.push(m.hardcoded(`${file}:${i + 1}`, line.trim()));
  });
}

if (problems.length > 0) {
  console.error(m.failed + '\n');
  for (const p of problems) console.error(`  · ${p}`);
  console.error(`\n${m.summary(problems.length)}`);
  process.exit(1);
}

console.log(m.passed(koKeys.length, UI_FILES.length));
