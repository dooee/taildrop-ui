/**
 * Path verdicts, shared by the boundary that enforces them and the UI that
 * prevents them reaching it. Three questions live here:
 *
 * - rejectOf     can this path be sent as-is?
 * - nameIssueOf  will the receiver accept this name?
 * - dirIssueOf   can received files be saved into this folder?
 *
 * All three are shared because a boundary and a UI must reach the same verdict,
 * and all follow zip.ts's contract: no i18n, a code rather than prose, and the
 * UI decides the wording.
 *
 * 경로 판정. 강제하는 경계와, 거기까지 가지 않게 예방하는 UI 가 함께 쓴다. 세 가지
 * 질문이 여기 있다.
 *
 * - rejectOf     이 경로를 그대로 보낼 수 있는가?
 * - nameIssueOf  받는 쪽이 이 이름을 받아주는가?
 * - dirIssueOf   받은 파일을 이 폴더에 저장할 수 있는가?
 *
 * 셋 다 경계와 UI 가 같은 결론에 도달해야 해서 공유하며, zip.ts 의 규약을 따른다.
 * i18n 에 의존하지 않고, 문장이 아니라 코드를 돌려주며, 문구는 UI 가 정한다.
 */
import fs from 'node:fs';

/**
 * Why a top-level pick cannot be sent.
 * - 'symlink' a symbolic link, resolved no further on purpose. `tailscale file
 *   cp` follows it and sends the target's bytes under the link's name, so what
 *   the user picked and what arrives disagree; a dangling one just fails.
 * - 'special' a FIFO, socket, or block/character device. `tailscale file cp
 *   /dev/zero <device>:` never returns — it reads a stream that has no end.
 *
 * 최상위(사용자가 직접 고른) 항목을 보낼 수 없는 사유.
 * - 'symlink' 심볼릭 링크. 일부러 대상까지 해석하지 않는다. `tailscale file cp` 는
 *   링크를 따라가 대상의 내용을 링크의 이름으로 보내므로 고른 것과 도착하는 것이
 *   달라진다. 깨진 링크는 그냥 실패한다.
 * - 'special' FIFO·소켓·블록/문자 장치. `tailscale file cp /dev/zero <기기>:` 는
 *   끝이 없는 스트림을 읽으려 해 영원히 돌아오지 않는다.
 */
export type Reject = 'symlink' | 'special';

/** The lstat-semantics surface this module needs. fs.Stats and fs.Dirent both
 *  satisfy it, so one predicate serves both callers.
 *  이 모듈이 쓰는 lstat 시맨틱 공통부. fs.Stats 와 fs.Dirent 가 모두 만족하므로
 *  판정 함수 하나로 양쪽 호출자를 처리한다. */
export interface StatLike {
  isSymbolicLink(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
}

/**
 * Classifies an lstat-semantics stat. Returns null when the path is sendable.
 * Only top-level picks are judged — a folder's contents are the archiver's
 * problem, and the zip it writes is always a regular file.
 *
 * Special files are matched positively rather than as "whatever is left over".
 * On a filesystem that does not report d_type (some NFS/FUSE) every Dirent
 * is*() returns false; the leftover form would read that as special and block a
 * perfectly ordinary file. Matching positively lets such an entry through here
 * and leaves it to sendPaths, whose lstat is never ambiguous — which is exactly
 * why the second layer of defence exists.
 *
 * lstat 시맨틱 stat 을 판정한다. 보낼 수 있으면 null. 최상위 선택 항목만 판정한다 —
 * 폴더 내용물은 압축 도구의 몫이고, 압축 결과물은 언제나 일반 파일이다.
 *
 * 특수 파일은 "나머지 전부"가 아니라 양성으로 판정한다. d_type 을 보고하지 않는
 * 파일시스템(일부 NFS·FUSE)에서는 Dirent 의 모든 is*() 가 false 인데, "나머지 전부"
 * 형태로 잡으면 그걸 특수 파일로 읽어 멀쩡한 파일을 차단한다. 양성 판정은 그런 항목을
 * 여기서 통과시키고 sendPaths 에 맡긴다. 그쪽 lstat 은 모호할 수 없고, 그게 바로
 * 이중 방어의 두 번째 층이 존재하는 이유다.
 *
 * Callers pass lstat semantics, never stat: a link must stay a link here.
 * dirIssueOf below is the opposite on purpose — see its note.
 *
 * 호출자는 stat 이 아니라 lstat 시맨틱을 넘긴다. 여기서는 링크가 링크로 남아야
 * 한다. 아래의 dirIssueOf 는 일부러 반대다 — 그쪽 설명을 볼 것.
 */
export function rejectOf(s: StatLike): Reject | null {
  if (s.isSymbolicLink()) return 'symlink';
  if (s.isFIFO() || s.isSocket() || s.isBlockDevice() || s.isCharacterDevice())
    return 'special';
  return null;
}

/**
 * Why the receiver will refuse a name.
 * - 'space'     leading or trailing whitespace
 * - 'long'      too many bytes — not characters, and the budget is not 255
 * - 'reserved'  ends in a suffix Taildrop uses for its own bookkeeping
 * - 'char'      a character no name may contain
 *
 * 받는 쪽이 이름을 거부하는 사유.
 * - 'space'     이름 앞뒤의 공백
 * - 'long'      바이트 수 초과. 글자가 아니고, 예산은 255 가 아니다
 * - 'reserved'  Taildrop 이 내부 용도로 쓰는 접미사로 끝남
 * - 'char'      어떤 이름에도 들어갈 수 없는 문자
 */
export type NameIssue = 'space' | 'char' | 'long' | 'reserved';

/**
 * Bytes the receiver's bookkeeping steals from every name: `.partial` (8), the
 * dot before the sender's node ID (1), and the ID itself.
 *
 * While a file is arriving the receiver writes it as
 * `<name>.<senderStableID>.partial`, and it length-checks *that* name against
 * 255 — a second check, on top of the one the name itself gets. So the real
 * budget for a name is 255 minus this overhead, and it depends on the *sender*.
 *
 * 받는 쪽의 내부 사정이 모든 이름에서 떼어 가는 바이트. `.partial`(8), 보내는 쪽
 * 노드 ID 앞의 점(1), 그리고 ID 자체.
 *
 * 파일이 도착하는 동안 받는 쪽은 `<이름>.<보내는쪽StableID>.partial` 로 쓰고, 255
 * 검사를 *그 이름에* 건다 — 이름 자체가 받는 검사에 더해 두 번째 검사다. 따라서
 * 이름의 실제 예산은 255 에서 이 몫을 뺀 값이고, *보내는 쪽*에 따라 달라진다.
 */
const SUFFIX_OVERHEAD = '.partial'.length + 1;

/** The receiver's own ceiling, applied to name-plus-bookkeeping.
 *  받는 쪽 자신의 상한. 이름과 내부 접미사를 합친 것에 적용된다. */
const RECEIVER_MAX_BYTES = 255;

/** Name budget for a sender whose node ID is `idLen` characters long.
 *  노드 ID 가 `idLen` 자인 보내는 쪽의 이름 예산. */
export function nameBudgetFor(idLen: number): number {
  return RECEIVER_MAX_BYTES - SUFFIX_OVERHEAD - idLen;
}

/**
 * Budget to assume when the sender's node ID is not at hand.
 *
 * Every StableNodeID observed is 17 characters, which measures out to 229 —
 * confirmed against a real peer, where a 229-byte name arrives and a 230-byte
 * one comes back "400 invalid filename". The UI prevents with this; sendPaths
 * enforces with the real figure, so a longer ID than expected costs a clear
 * message, not a wrong verdict.
 *
 * 보내는 쪽 노드 ID 를 알 수 없을 때 가정하는 예산.
 *
 * 관측된 StableNodeID 는 모두 17자이고, 그러면 229 가 나온다 — 실제 피어로 확인했다.
 * 229바이트 이름은 도착하고 230바이트는 "400 invalid filename" 으로 돌아온다. UI 는
 * 이 값으로 예방하고 sendPaths 는 실제 값으로 강제하므로, ID 가 예상보다 길어도
 * 잘못된 판정이 아니라 안내 문구 하나를 잃을 뿐이다.
 */
export const DEFAULT_NAME_BUDGET = nameBudgetFor(17);

/** Characters Taildrop refuses everywhere. Invalid on Windows, but the rule is
 *  applied on every platform, so a name with one never arrives anywhere.
 *  Taildrop 이 어디서든 거부하는 문자. Windows 에서 못 쓰는 문자들이지만 규칙은 전
 *  플랫폼에 적용되므로, 이런 문자가 든 이름은 어디로도 도착하지 않는다. */
const BAD_CHARS = /[/\\:*"<>|]/;

/** Categories Go's unicode.IsGraphic admits: letters, marks, numbers,
 *  punctuation, symbols, spaces. Anything else — control, format (U+200E and
 *  friends), unpaired surrogates — is not a valid filename rune.
 *  Go 의 unicode.IsGraphic 이 허용하는 카테고리. 문자·결합기호·숫자·구두점·기호·
 *  공백. 그 밖(제어·형식 문자(U+200E 등)·짝 없는 서로게이트)은 파일명에 쓸 수 없다. */
const GRAPHIC_ONLY = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}]*$/u;

/**
 * Judges a base name the way the *receiving* tailscale will. Returns null when
 * the name is acceptable.
 *
 * This mirrors validateBaseName in tailscale's taildrop package, which runs on
 * the receiver while it handles the peerAPI PUT and answers HTTP 400 with the
 * single word "invalid filename". The sender checks nothing and is told
 * nothing, so the reason has to be worked out on this side or not at all — that
 * is the whole point of this function. The rule is the receiver's, not the
 * platform's: every tailscaled enforces it, so the verdict does not depend on
 * which OS is on either end.
 *
 * Judge the name that will actually be sent, not the one that was picked. A
 * folder goes out as "<name>.zip" (see zip.ts), so it inherits any problem its
 * folder's name had.
 *
 * The 'long' rule is the one worth measuring rather than reading: the receiver
 * checks 255 twice, and the check that bites is the one on the name plus its
 * bookkeeping suffix (see DEFAULT_NAME_BUDGET). A macOS filesystem refuses to
 * create a name over 255 bytes in the first place, so the documented-looking
 * 255 can never be what stops a real file — the smaller budget always is.
 *
 * 받는 쪽 tailscale 이 판정하는 대로 base 이름을 판정한다. 받아들여지면 null.
 *
 * tailscale taildrop 패키지의 validateBaseName 을 옮긴 것이다. 그 검증은 받는 쪽이
 * peerAPI PUT 을 처리하며 수행하고 "invalid filename" 한 마디와 함께 HTTP 400 으로
 * 답한다. 보내는 쪽은 아무것도 검사하지 않고 아무것도 듣지 못하므로, 사유는 이쪽에서
 * 알아내지 않으면 알 수 없다 — 이 함수의 존재 이유가 그것이다. 이 규칙은 플랫폼이
 * 아니라 받는 쪽의 것이다. 모든 tailscaled 가 강제하므로 양쪽 OS 조합과 무관하다.
 *
 * 판정 대상은 고른 이름이 아니라 실제로 보낼 이름이다. 폴더는 "<이름>.zip" 으로
 * 나가므로(zip.ts 참고) 폴더 이름의 문제를 그대로 물려받는다.
 */
export function nameIssueOf(
  name: string,
  budget: number = DEFAULT_NAME_BUDGET,
): NameIssue | null {
  // Whitespace first: the common case, and the one no UI ever shows. A name
  // that merely starts with a space looks identical to a valid one.
  // 공백 먼저. 가장 흔하고, 어떤 UI 도 보여주지 않는 문제다. 앞에 공백 하나가 붙은
  // 이름은 멀쩡한 이름과 똑같아 보인다.
  if (name.trim() !== name) return 'space';
  // Bytes, not characters — Go counts a UTF-8 string's bytes. Each Hangul
  // syllable is three, so the ceiling is ~76 characters, not 229.
  // 글자가 아니라 바이트. Go 는 UTF-8 문자열의 바이트를 센다. 한글은 글자당 3바이트라
  // 상한이 229자가 아니라 약 76자다.
  if (Buffer.byteLength(name, 'utf8') > budget) return 'long';
  if (name.endsWith('.partial') || name.endsWith('.deleted')) return 'reserved';
  if (BAD_CHARS.test(name) || !GRAPHIC_ONLY.test(name)) return 'char';
  return null;
}

/**
 * Why the download folder cannot be used, or null when it can.
 * - 'missing'   nothing usable is there (also: unset, or a dangling link)
 * - 'not-dir'   something is there, but it is not a directory
 * - 'no-write'  a directory this user cannot save into
 *
 * 다운로드 폴더를 쓸 수 없는 사유. 쓸 수 있으면 null.
 * - 'missing'   쓸 것이 없음 (미설정·깨진 링크 포함)
 * - 'not-dir'   무언가 있지만 디렉터리가 아님
 * - 'no-write'  디렉터리이지만 이 사용자가 저장할 수 없음
 */
export type DirIssue = 'missing' | 'not-dir' | 'no-write';

/**
 * Judges the download folder. Never creates it, never throws.
 *
 * Uses stat, which follows links — the opposite of rejectOf, and deliberately
 * so. A link to a real folder is a fine place to save into, and folder mode has
 * always allowed picking one; a link is only a lie when *sending*, where the
 * name that arrives disagrees with the bytes. A dangling link throws ENOENT and
 * lands on 'missing', which is both the right verdict and the right sentence.
 * Do not "unify" the two functions.
 *
 * R_OK matters as much as W_OK: receive lists the folder before and after to
 * learn what was saved, and needs X_OK to create entries at all. The three are
 * one verdict because the user would not act on them differently.
 *
 * 다운로드 폴더를 판정한다. 만들지 않고, 던지지 않는다.
 *
 * 링크를 따라가는 stat 을 쓴다 — rejectOf 와 반대이며 의도적이다. 실제 폴더를
 * 가리키는 링크는 저장 위치로 아무 문제가 없고, folder 모드는 원래 그걸 고를 수
 * 있었다. 링크가 거짓이 되는 건 *보낼* 때뿐이다 — 도착하는 이름과 내용이 어긋나기
 * 때문. 깨진 링크는 ENOENT 를 던져 'missing' 으로 떨어지는데, 판정도 문구도 그게
 * 맞다. 두 함수를 "통일"하지 말 것.
 *
 * W_OK 만큼 R_OK 도 중요하다. 받기는 저장된 파일을 알아내려고 폴더를 전후로
 * 나열하며, 항목을 만들려면 X_OK 도 필요하다. 사용자가 다르게 대응할 일이 없으므로
 * 셋을 하나의 사유로 묶는다.
 */
export function dirIssueOf(dir: string): DirIssue | null {
  /*
   * loadConfig JSON.parse's a file the user can hand-edit and casts it to
   * Partial<Config>, so "string" is a claim of the type system, not a fact.
   * This must also precede any path.resolve: resolve('') is the cwd, which
   * exists and is writable, so resolving first would launder "unset" into
   * "wherever you happened to launch from".
   *
   * loadConfig 는 사용자가 직접 고칠 수 있는 파일을 파싱해 Partial<Config> 로
   * 캐스팅한다. 즉 "string" 은 타입 시스템의 주장일 뿐 사실이 아니다. 이 검사는
   * 어떤 path.resolve 보다도 앞서야 한다. resolve('') 는 존재하고 쓰기 가능한
   * cwd 라서, 먼저 resolve 하면 "미설정"이 "그저 실행한 곳"으로 둔갑한다.
   */
  if (typeof dir !== 'string' || dir.trim() === '') return 'missing';

  let stat: fs.Stats;
  try {
    stat = fs.statSync(dir);
  } catch {
    // ENOENT, ELOOP, or ENOTDIR on a parent — nothing usable either way.
    // ENOENT·ELOOP·상위 경로의 ENOTDIR — 어느 쪽이든 쓸 것이 없다.
    return 'missing';
  }
  if (!stat.isDirectory()) return 'not-dir';

  try {
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
  } catch {
    return 'no-write';
  }
  return null;
}
