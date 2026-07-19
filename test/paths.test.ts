/**
 * Tests for path verdicts (src/paths.ts). These are pure functions with one
 * documented answer each, so they are the project's first and most valuable
 * unit tests — they lock the receiver-name and download-folder rules the UI and
 * the send boundary both depend on.
 *
 * 경로 판정(src/paths.ts) 테스트. 각각 문서화된 답이 하나뿐인 순수 함수라, 이
 * 프로젝트의 첫·가장 값진 유닛 테스트다 — UI 와 전송 경계가 함께 의존하는 받는쪽
 * 이름 규칙·다운로드 폴더 규칙을 잠근다.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  rejectOf,
  nameIssueOf,
  nameBudgetFor,
  dirIssueOf,
  DEFAULT_NAME_BUDGET,
  type StatLike,
} from '../src/paths.js';

/** A StatLike with everything false; override one flag per case.
 *  전부 false 인 StatLike. 케이스마다 한 플래그만 켠다. */
function fakeStat(over: Partial<Record<keyof StatLike, boolean>> = {}): StatLike {
  return {
    isSymbolicLink: () => over.isSymbolicLink ?? false,
    isFIFO: () => over.isFIFO ?? false,
    isSocket: () => over.isSocket ?? false,
    isBlockDevice: () => over.isBlockDevice ?? false,
    isCharacterDevice: () => over.isCharacterDevice ?? false,
  };
}

describe('rejectOf', () => {
  it('passes an ordinary file', () => {
    expect(rejectOf(fakeStat())).toBeNull();
  });
  it('rejects a symlink', () => {
    expect(rejectOf(fakeStat({ isSymbolicLink: true }))).toBe('symlink');
  });
  it.each(['isFIFO', 'isSocket', 'isBlockDevice', 'isCharacterDevice'] as const)(
    'rejects a special file (%s)',
    (flag) => {
      expect(rejectOf(fakeStat({ [flag]: true }))).toBe('special');
    },
  );
  it('prefers symlink over special when both hold', () => {
    expect(rejectOf(fakeStat({ isSymbolicLink: true, isFIFO: true }))).toBe('symlink');
  });
});

describe('nameBudgetFor / DEFAULT_NAME_BUDGET', () => {
  it('subtracts .partial(8) + dot(1) + id length', () => {
    // 255 - 9 - 17 = 229
    expect(nameBudgetFor(17)).toBe(229);
  });
  it('shrinks as the sender node id grows', () => {
    expect(nameBudgetFor(20)).toBe(nameBudgetFor(17) - 3);
  });
  it('DEFAULT_NAME_BUDGET assumes a 17-char id (229)', () => {
    expect(DEFAULT_NAME_BUDGET).toBe(229);
  });
});

describe('nameIssueOf', () => {
  it('accepts an ordinary name', () => {
    expect(nameIssueOf('photo.jpg')).toBeNull();
  });

  it.each(['  a.txt', 'a.txt ', ' a.txt '])('flags leading/trailing space (%j)', (n) => {
    expect(nameIssueOf(n)).toBe('space');
  });

  it('counts bytes, not characters — Hangul is 3 bytes each', () => {
    // budget 8 bytes: 2 Hangul syllables = 6 bytes (ok), 3 = 9 bytes (long)
    expect(nameIssueOf('한글', 8)).toBeNull();
    expect(nameIssueOf('한글자', 8)).toBe('long');
  });

  it.each(['note.partial', 'note.deleted'])('flags a reserved suffix (%j)', (n) => {
    expect(nameIssueOf(n)).toBe('reserved');
  });

  it.each(['a/b.txt', 'a\\b.txt', 'a:b.txt', 'a*b', 'a<b', 'a>b', 'a|b', 'a"b'])(
    'flags a forbidden character (%j)',
    (n) => {
      expect(nameIssueOf(n)).toBe('char');
    },
  );

  // Characterization: BAD_CHARS omits '?' (present in the other Windows-invalid
  // chars). Currently accepted; flagged as a possible gap in paths.ts, not fixed
  // here. Flip this to 'char' if '?' is added to BAD_CHARS.
  // 특성화: BAD_CHARS 가 '?' 를 빠뜨렸다(다른 Windows 금지 문자는 있음). 지금은
  // 통과 — paths.ts 의 갭 후보로 표시만, 여기서 고치지 않음. '?' 를 BAD_CHARS 에
  // 넣으면 이 기대를 'char' 로 뒤집을 것.
  it("currently accepts '?' (BAD_CHARS gap — see note)", () => {
    expect(nameIssueOf('q?.txt')).toBeNull();
  });

  it('flags a non-graphic rune (U+200E left-to-right mark)', () => {
    expect(nameIssueOf('a‎b.txt')).toBe('char');
  });

  it('checks space before length (leading space on an over-long name)', () => {
    const overLong = ' ' + 'a'.repeat(DEFAULT_NAME_BUDGET + 10);
    expect(nameIssueOf(overLong)).toBe('space');
  });
});

describe('dirIssueOf', () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tailtoss-paths-'));
    file = path.join(dir, 'a-file');
    fs.writeFileSync(file, 'x');
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a real writable directory', () => {
    expect(dirIssueOf(dir)).toBeNull();
  });
  it.each(['', '   '])('treats unset/blank as missing (%j)', (d) => {
    expect(dirIssueOf(d)).toBe('missing');
  });
  it('reports missing for a non-existent path', () => {
    expect(dirIssueOf(path.join(dir, 'nope', 'still-nope'))).toBe('missing');
  });
  it('reports not-dir when the path is a file', () => {
    expect(dirIssueOf(file)).toBe('not-dir');
  });
});
