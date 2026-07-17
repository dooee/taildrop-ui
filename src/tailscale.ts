import path from 'node:path';
import fs from 'node:fs';
import { execa } from 'execa';
import { zipFolder, zipPaths, cleanupZip, ArchiveError } from './zip.js';
import {
  rejectOf,
  nameIssueOf,
  nameBudgetFor,
  DEFAULT_NAME_BUDGET,
  dirIssueOf,
  type DirIssue,
  type NameIssue,
} from './paths.js';

export interface Target {
  ip: string;
  name: string;
}

/**
 * Wraps a string in single quotes for a POSIX shell, escaping any single quote
 * within by closing, adding an escaped quote, and reopening ('\'').
 *
 * Only for building command strings shown to a human to paste (sudoCmd). This
 * tool never runs these; execa calls pass argv arrays, which are not shell-
 * parsed and need no quoting.
 *
 * 문자열을 POSIX 셸용 작은따옴표로 감싼다. 안에 든 작은따옴표는 인용을 닫고
 * 이스케이프된 따옴표를 넣은 뒤 다시 여는('\'') 방식으로 처리한다.
 *
 * 사람이 붙여넣도록 보여주는 명령 문자열(sudoCmd)을 만들 때만 쓴다. 이 도구는
 * 그것을 직접 실행하지 않는다. execa 호출은 argv 배열을 넘기며, 그건 셸 파싱을
 * 거치지 않아 인용이 필요 없다.
 */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

let cachedBin: string | null = null;

/** Resolves the tailscale binary path; throws if not found.
 *  tailscale 실행 파일 경로를 찾는다. 없으면 예외. */
export async function resolveTailscale(): Promise<string> {
  if (cachedBin) return cachedBin;

  const candidates = [
    '/opt/homebrew/bin/tailscale', // macOS (Apple Silicon Homebrew)
    '/usr/local/bin/tailscale', // macOS (Intel Homebrew) / Linux
    '/usr/bin/tailscale', // Linux package · Linux 패키지
    '/Applications/Tailscale.app/Contents/MacOS/Tailscale', // macOS GUI app · macOS GUI 앱
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedBin = c;
      return c;
    }
  }

  // Fall back to a PATH lookup.
  // PATH 에서 탐색.
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execa(finder, ['tailscale']);
    const found = stdout.split('\n')[0]?.trim();
    if (found) {
      cachedBin = found;
      return found;
    }
  } catch {
    // fallthrough · 아래로 진행
  }

  throw new Error('tailscale CLI not found');
}

/** Whether the tailscale CLI is installed (drives the install hint).
 *  tailscale CLI 가 설치되어 있는지 (설치 안내용). */
export async function hasTailscale(): Promise<boolean> {
  try {
    await resolveTailscale();
    return true;
  } catch {
    return false;
  }
}

let cachedBudget: number | null = null;

/**
 * How many bytes a name this device sends may take up.
 *
 * The budget is the sender's to know: the receiver spends part of its own
 * 255-byte ceiling on this node's ID (see paths.ts), so the answer is a
 * property of us, not of the file or the target. Read once and kept — a node
 * ID does not change while the process runs, and every send would otherwise
 * pay for a subprocess to learn the same number.
 *
 * Falls back to the assumed budget rather than failing: a send that is refused
 * with an explanation beats a send refused because we could not ask.
 *
 * 이 기기가 보내는 이름이 쓸 수 있는 바이트 수.
 *
 * 예산은 보내는 쪽이 알아야 하는 값이다. 받는 쪽은 자기 255 상한의 일부를 이 노드의
 * ID 에 쓰므로(paths.ts 참고), 답은 파일이나 대상이 아니라 우리의 성질이다. 한 번만
 * 읽고 보관한다 — 프로세스가 도는 동안 노드 ID 는 변하지 않고, 그러지 않으면 전송할
 * 때마다 같은 숫자를 알아내려 서브프로세스를 띄우게 된다.
 *
 * 실패하지 않고 가정값으로 물러선다. 물어보지 못해서 거부하는 것보다, 이유를 설명하며
 * 거부하는 편이 낫다.
 */
async function nameBudget(): Promise<number> {
  if (cachedBudget !== null) return cachedBudget;
  try {
    const bin = await resolveTailscale();
    const { stdout } = await execa(bin, ['status', '--json']);
    const id: unknown = JSON.parse(stdout)?.Self?.ID;
    cachedBudget =
      typeof id === 'string' && id.length > 0
        ? nameBudgetFor(id.length)
        : DEFAULT_NAME_BUDGET;
  } catch {
    cachedBudget = DEFAULT_NAME_BUDGET;
  }
  return cachedBudget;
}

/** Lists online Taildrop targets that can receive files.
 *  전송 가능한(온라인) Taildrop 대상 기기 목록을 가져온다. */
export async function listTargets(): Promise<Target[]> {
  const bin = await resolveTailscale();
  const { stdout } = await execa(bin, ['file', 'cp', '--targets']);
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [ip, name] = line.split('\t');
      return { ip: ip ?? '', name: (name ?? ip ?? '').trim() };
    })
    .filter((t) => t.name);
}

export interface SendResult {
  ok: boolean;
  sentNames: string[];
  error?: string;
  /**
   * A machine-readable cause the UI can translate, when one is known.
   * Raw `error` text stays untranslated, so prefer this for anything the user
   * is meant to act on.
   *
   * UI 가 번역할 수 있는 실패 원인 코드. `error` 원문은 번역되지 않으므로,
   * 사용자가 대응해야 하는 실패는 이 코드로 전달한다.
   */
  errorCode?:
    | 'archiver-missing'
    | 'archive-failed'
    | 'empty'
    | 'symlink-path'
    | 'special-path'
    | 'missing-path'
    | 'duplicate-name'
    | 'name-invalid';
  /**
   * Every name the receiver would refuse, judged before anything is sent. Set
   * only with errorCode 'name-invalid'. It is a list, not a single cause,
   * because fixing one and retrying only to hit the next is the failure this is
   * meant to spare the user — one pass names them all.
   *
   * 받는 쪽이 거부할 이름 전부. 아무것도 보내기 전에 판정한다. errorCode 가
   * 'name-invalid' 일 때만 채워진다. 하나의 원인이 아니라 목록인 이유는, 하나 고쳐
   * 다시 보냈더니 다음 것에서 또 막히는 그 실패를 덜어주려는 것이기 때문이다 —
   * 한 번에 전부 알려준다.
   */
  nameProblems?: NameProblem[];
  /** The name-byte budget in force, so the UI can show "{bytes}/{budget}".
   *  적용된 이름 바이트 예산. UI 가 "{bytes}/{budget}" 을 보여줄 수 있게 한다. */
  nameBudget?: number;
}

/** One name the receiver would refuse, and why.
 *  받는 쪽이 거부할 이름 하나와 그 사유. */
export interface NameProblem {
  name: string;
  issue: NameIssue;
  /** UTF-8 byte length, for the 'long' reason's "{bytes}/{budget}".
   *  UTF-8 바이트 길이. 'long' 사유의 "{bytes}/{budget}" 표시용. */
  bytes: number;
}

export interface SendOptions {
  /** Bundle multiple selections into a single zip.
   *  여러 파일을 하나의 zip 으로 묶을지 여부. */
  bundleMultiple: boolean;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Sends the selected paths to a target device.
 * - single file: as-is
 * - single folder: zipped, under its own name
 * - several items: one zip when bundleMultiple or when any of them is a
 *   folder, else each file as-is
 *
 * Symlinks and special files are refused, as are names the receiver will not
 * accept (see paths.ts). This is the boundary that enforces it; FileBrowser
 * only prevents it, so do not rely on the UI. The name check lives here alone
 * for folders: the UI cannot know whether a folder's name will be sent, since
 * bundling replaces it.
 *
 * onLog receives code strings (`zip:` · `bundle:` · `cp:`), never prose —
 * this module stays free of i18n. Send.tsx's decodeLog localizes them.
 *
 * 선택한 경로들을 대상 기기로 전송한다.
 * - 파일 1개: 그대로
 * - 폴더 1개: 자기 이름으로 zip 압축 후
 * - 여러 항목: bundleMultiple 이거나 그중 폴더가 있으면 하나의 zip, 아니면 파일 각각 그대로
 *
 * 심볼릭 링크와 특수 파일, 그리고 받는 쪽이 받아주지 않을 이름은 거부한다
 * (paths.ts 참고). 강제하는 곳은 이 경계이고, FileBrowser 는 예방할 뿐이므로 UI 를
 * 믿지 않는다. 폴더의 이름 검사는 여기에만 있다. 묶어 보내면 폴더 이름이 대체되므로
 * UI 는 그 이름이 전송될지 알 수 없기 때문이다.
 *
 * onLog 는 번역된 문장이 아니라 코드 문자열을 받는다. 이 모듈은 i18n 에
 * 의존하지 않으며, 문구 변환은 Send.tsx 의 decodeLog 가 맡는다.
 */
export async function sendPaths(
  paths: string[],
  targetName: string,
  opts: SendOptions,
  onLog?: (msg: string) => void,
): Promise<SendResult> {
  const bin = await resolveTailscale();
  const tempZips: string[] = [];
  const toSend: string[] = [];

  try {
    if (paths.length === 0) {
      return { ok: false, sentNames: [], errorCode: 'empty' };
    }

    /*
     * Validate every pick before branching, so the bundle path is covered too.
     * lstat does not follow links, so a dangling link is classified instead of
     * throwing. Only the picks are judged — a folder's contents are the
     * archiver's problem, and the zip it writes is always a regular file, so
     * the cp below is safe by construction.
     *
     * The stat is kept and reused: re-stat'ing later would only widen the
     * window in which the path changes underneath us.
     *
     * 분기 전에 선택 항목을 전부 검증한다. bundle 경로까지 덮기 위해서다. lstat 은
     * 링크를 따라가지 않으므로 깨진 링크도 예외 없이 분류된다. 판정 대상은 선택
     * 항목뿐이다 — 폴더 내용물은 압축 도구의 몫이고, 압축 결과물은 언제나 일반
     * 파일이므로 아래의 cp 는 구조적으로 안전하다.
     *
     * stat 결과는 보관해 재사용한다. 나중에 다시 stat 하면 그 사이 경로가 바뀔
     * 여지만 넓어진다.
     */
    const picks: { abs: string; isDir: boolean }[] = [];
    for (const p of paths) {
      const abs = path.resolve(p);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(abs);
      } catch (err) {
        /*
         * Gone between the pick and now — deleted, renamed, or unmounted while
         * the user was choosing a target. The race cannot be closed, only
         * narrowed: this lstat is the last look before any work starts, and
         * everything after it fails loudly too (the archiver exits non-zero,
         * and so does `file cp`). What matters is that a vanished file can
         * never pass for a sent one.
         *
         * Only ENOENT earns this verdict. Another lstat error means something
         * else is wrong, and calling that "gone" would be a guess — it falls
         * through to the raw message instead.
         *
         * 고른 시점과 지금 사이에 사라졌다 — 사용자가 대상을 고르는 동안 삭제되거나
         * 이름이 바뀌거나 볼륨이 빠졌다. 이 레이스는 없앨 수 없고 좁힐 수만 있다. 이
         * lstat 은 어떤 작업이 시작되기 전의 마지막 확인이며, 그 뒤도 조용히 넘어가지
         * 않는다(압축 도구도 `file cp` 도 0 이 아닌 코드로 끝난다). 중요한 것은
         * 사라진 파일이 보낸 파일로 둔갑하지 않는다는 것이다.
         *
         * ENOENT 만 이 판정을 받는다. 다른 lstat 오류는 다른 문제이고, 그걸 "사라짐"
         * 이라 부르면 추측이 된다. 그런 경우는 원문 메시지로 흘려보낸다.
         */
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
        return {
          ok: false,
          sentNames: [],
          error: abs,
          errorCode: 'missing-path',
        };
      }
      const reject = rejectOf(stat);
      if (reject) {
        return {
          ok: false,
          sentNames: [],
          error: abs,
          errorCode: reject === 'symlink' ? 'symlink-path' : 'special-path',
        };
      }
      picks.push({ abs, isDir: stat.isDirectory() });
    }

    /*
     * A folder among several picks forces the bundle, whatever the setting
     * says. Otherwise the same selection arrives in two shapes at once — the
     * files bare, the folders as zips — and the user has to hold two rules in
     * their head to predict what lands. The setting answers "how do I want
     * several *files* handled", which is why it still decides when nothing is
     * a folder.
     *
     * A lone folder keeps zipFolder and its own name: nothing is being
     * combined, and "<folder>.zip" says what arrived where taildrop-<time>.zip
     * would not.
     *
     * 여러 항목 중에 폴더가 있으면 설정과 무관하게 묶는다. 그러지 않으면 같은 선택이
     * 두 가지 모양으로 도착한다 — 파일은 그대로, 폴더는 zip 으로. 무엇이 도착할지
     * 예측하려고 사용자가 규칙 두 개를 동시에 들고 있어야 한다. 이 설정이 답하는
     * 질문은 "여러 *파일* 을 어떻게 다룰까"이고, 그래서 폴더가 없을 때는 여전히
     * 설정이 정한다.
     *
     * 폴더 하나만 고른 경우는 zipFolder 와 그 이름을 유지한다. 합칠 것이 없고,
     * "<폴더>.zip" 은 taildrop-<시각>.zip 이 못 하는 말을 한다 — 무엇이 도착했는지.
     */
    const hasFolder = picks.some((x) => x.isDir);
    if (picks.length >= 2 && (opts.bundleMultiple || hasFolder)) {
      /*
       * Refuse a bundle with two same-named items before writing it. Each item
       * is stored under its own basename, so duplicates collide: Info-ZIP keeps
       * only the last, silently dropping the earlier one's bytes. A vanished
       * file must never read as sent — the same principle as missing-path — so
       * this is caught here rather than discovered on extraction.
       *
       * Only the bundle path needs this. Sent individually, each file is its
       * own transfer and the receiver renames on conflict (Foo → Foo (1)).
       *
       * 묶기 전에, 같은 이름 항목 두 개가 든 묶음을 거부한다. 각 항목은 자기
       * basename 으로 저장되므로 중복은 충돌한다. Info-ZIP 은 마지막 것만 남기고
       * 앞선 것의 내용을 조용히 버린다. 사라진 파일이 보낸 것으로 읽혀선 안 된다 —
       * missing-path 와 같은 원칙 — 그래서 추출 시점이 아니라 여기서 잡는다.
       *
       * 묶음 경로만 이게 필요하다. 개별 전송은 각자 하나의 전송이고 받는 쪽이 충돌
       * 시 이름을 바꾼다(Foo → Foo (1)).
       */
      const seen = new Set<string>();
      for (const { abs } of picks) {
        const base = path.basename(abs);
        if (seen.has(base)) {
          return {
            ok: false,
            sentNames: [],
            error: base,
            errorCode: 'duplicate-name',
          };
        }
        seen.add(base);
      }

      // Bundle every item into a single archive.
      // 여러 항목을 하나의 zip 으로.
      onLog?.(`bundle:${picks.length}`);
      const zipPath = await zipPaths(
        picks.map((x) => x.abs),
        `taildrop-${timestamp()}.zip`,
      );
      tempZips.push(zipPath);
      toSend.push(zipPath);
    } else {
      for (const { abs, isDir } of picks) {
        if (isDir) {
          onLog?.(`zip:${path.basename(abs)}`);
          const zipPath = await zipFolder(abs);
          tempZips.push(zipPath);
          toSend.push(zipPath);
        } else {
          toSend.push(abs);
        }
      }
    }

    /*
     * Judge the names last, once toSend is final — these are the names that go
     * on the wire, which is what the receiver judges. Picking them up here
     * rather than beside the lstat above is what covers the zips: zipFolder
     * names its archive after the folder, so " docs" becomes " docs.zip" and
     * fails for the folder's problem, while a bundle's taildrop-<time>.zip is
     * always fine. Judging the picks instead would both miss the first and
     * refuse the second.
     *
     * Judging all of them before sending any is what keeps a batch whole.
     * `tailscale file cp` pushes one file per request and returns on the first
     * refusal, so a bad name midway leaves the files before it delivered and
     * the files after it untouched — a half-send reported as a failure. One
     * refusal here costs nothing and sends nothing.
     *
     * The reported error is the base name, not the path: the name is the
     * problem, and for a zip the path leads to a temp folder that tells the
     * user nothing.
     *
     * 이름은 toSend 가 확정된 마지막에 판정한다. 이게 실제로 전선에 오르는 이름이고,
     * 받는 쪽이 판정하는 것도 이것이다. 위의 lstat 옆이 아니라 여기서 잡는 이유는
     * zip 때문이다. zipFolder 는 폴더 이름으로 압축 파일 이름을 지어서 " docs" 는
     * " docs.zip" 이 되어 폴더의 문제로 실패하지만, bundle 의 taildrop-<시각>.zip 은
     * 언제나 안전하다. 선택 항목을 판정하면 앞은 놓치고 뒤는 막게 된다.
     *
     * 하나라도 보내기 전에 전부 판정하는 것이 배치를 온전하게 지킨다. `tailscale
     * file cp` 는 파일당 요청을 하나씩 보내고 첫 거부에서 그대로 돌아온다. 그래서
     * 중간의 불량 이름 하나가 그 앞의 파일은 도착시키고 뒤의 파일은 시도조차 하지
     * 않게 만든다 — 절반만 보내고 실패라고 보고하는 것이다. 여기서의 거부는 아무것도
     * 보내지 않으므로 잃을 것이 없다.
     *
     * 보고하는 값은 경로가 아니라 base 이름이다. 문제는 이름이고, zip 이라면 경로는
     * 사용자에게 아무 의미 없는 임시 폴더를 가리킨다.
     */
    const budget = await nameBudget();
    const nameProblems: NameProblem[] = [];
    for (const p of toSend) {
      const base = path.basename(p);
      const issue = nameIssueOf(base, budget);
      if (issue)
        nameProblems.push({
          name: base,
          issue,
          bytes: Buffer.byteLength(base, 'utf8'),
        });
    }
    if (nameProblems.length > 0) {
      return {
        ok: false,
        sentNames: [],
        errorCode: 'name-invalid',
        nameProblems,
        nameBudget: budget,
      };
    }

    onLog?.(`cp:${targetName}:${toSend.length}`);
    await execa(bin, ['file', 'cp', ...toSend, `${targetName}:`]);

    return { ok: true, sentNames: toSend.map((p) => path.basename(p)) };
  } catch (err) {
    const message =
      err instanceof Error
        ? (err as { stderr?: string }).stderr || err.message
        : String(err);
    if (err instanceof ArchiveError) {
      return { ok: false, sentNames: [], error: message, errorCode: err.code };
    }
    return { ok: false, sentNames: [], error: message };
  } finally {
    for (const z of tempZips) cleanupZip(z);
  }
}

export interface ReceiveResult {
  ok: boolean;
  savedNames: string[];
  error?: string;
  /** Permission denied, so sudo is required (mostly Linux).
   *  권한이 없어 sudo 가 필요한 경우(주로 Linux). */
  needsSudo?: boolean;
  /** The sudo command for the user to run themselves.
   *  사용자가 직접 실행할 sudo 명령. */
  sudoCmd?: string;
  /**
   * A machine-readable cause the UI can translate, when one is known.
   * Same contract as SendResult.errorCode.
   *
   * UI 가 번역할 수 있는 실패 원인 코드. SendResult.errorCode 와 같은 규약.
   */
  errorCode?: 'dir-missing' | 'dir-not-dir' | 'dir-no-write';
}

/** DirIssue → ReceiveResult.errorCode. Spelled out rather than built from a
 *  template literal, so both sides stay greppable.
 *  DirIssue 를 결과 코드로 옮긴다. 템플릿 리터럴로 조합하지 않고 적어 두어 양쪽 다
 *  grep 으로 찾을 수 있게 한다. */
const DIR_ERROR_CODE: Record<DirIssue, NonNullable<ReceiveResult['errorCode']>> =
  {
    missing: 'dir-missing',
    'not-dir': 'dir-not-dir',
    'no-write': 'dir-no-write',
  };

/**
 * Pulls files from the staging inbox into downloadDir.
 *
 * On macOS (Homebrew tailscaled) this goes through the local API, so files
 * land owned by the user with no sudo. Elsewhere a permission error returns
 * the sudo command to run — this tool never executes sudo itself.
 *
 * The folder is judged first and never created, so a permission error below is
 * the inbox's — see the note inside.
 *
 * Saved names come from a before/after directory diff because
 * `tailscale file get` does not print the filenames it wrote.
 *
 * 스테이징 인박스의 파일을 downloadDir 로 꺼내온다.
 *
 * macOS(Homebrew tailscaled)는 로컬 API 로 동작해 sudo 없이 사용자 소유로
 * 저장된다. 그 외 환경에서 권한 오류가 나면 실행할 sudo 명령을 돌려준다 —
 * 이 도구가 sudo 를 직접 실행하지는 않는다.
 *
 * 폴더를 먼저 판정하고 만들지 않으므로, 아래에서 나는 권한 오류는 인박스의
 * 것이다 — 안쪽 설명 참고.
 *
 * 저장된 파일 목록은 디렉터리 before/after 비교로 구한다. `tailscale file get`
 * 이 기록한 파일명을 출력하지 않기 때문.
 */
export async function receive(downloadDir: string): Promise<ReceiveResult> {
  /*
   * The folder is judged before anything runs, and is never created. Creating
   * it silently turned a stale setting into a new empty folder the user never
   * asked for — a download dir on an unplugged disk got recreated on the
   * internal one, and the screen said "saved". mkdirSync's own EACCES also
   * matched the regex below, so a folder the user could not write to was
   * reported as "run tailscale file get under sudo", which could not have
   * helped. Past this line every permission error is the inbox's, which is
   * exactly what sudoCmd addresses.
   *
   * 폴더는 무엇을 실행하기 전에 판정하며, 만들지 않는다. 조용히 만들면 오래된
   * 설정이 사용자가 요청한 적 없는 빈 폴더가 됐다 — 뽑아둔 디스크의 다운로드
   * 폴더가 내장 디스크에 다시 만들어지고 화면에는 "저장했습니다"가 떴다. 게다가
   * mkdirSync 자신의 EACCES 가 아래 정규식에 걸려, 쓰기 권한 없는 폴더를 "sudo 로
   * tailscale file get 하세요"로 안내했다 — 그 명령으로는 해결될 수 없는
   * 문제였다. 이 줄 아래의 권한 오류는 전부 인박스의 것이고, sudoCmd 가 겨냥하는
   * 것이 바로 그것이다.
   */
  const issue = dirIssueOf(downloadDir);
  if (issue) {
    return {
      ok: false,
      savedNames: [],
      error: downloadDir, // the offending path, as sendPaths does · sendPaths 와 같이 문제의 경로
      errorCode: DIR_ERROR_CODE[issue],
    };
  }

  const bin = await resolveTailscale();
  // Resolved only after the check: resolve('') is the cwd, an existing writable
  // folder, so resolving first would launder "unset" into "here".
  // 검사 뒤에만 resolve 한다. resolve('') 는 존재하고 쓰기 가능한 cwd 라서, 먼저
  // resolve 하면 "미설정"이 "지금 이 폴더"로 둔갑한다.
  const dir = path.resolve(downloadDir);

  try {
    const before = new Set(fs.readdirSync(dir));

    await execa(bin, ['file', 'get', '--conflict=rename', dir]);

    const after = fs.readdirSync(dir);
    const savedNames = after.filter((n) => !before.has(n)).sort();
    return { ok: true, savedNames };
  } catch (err) {
    const message =
      err instanceof Error
        ? (err as { stderr?: string }).stderr || err.message
        : String(err);
    if (/permission denied|not permitted|access is denied|must be run as root|EACCES/i.test(message)) {
      return {
        ok: false,
        savedNames: [],
        needsSudo: true,
        // Shell-quoted: this is prose for a human to paste. A plain space would
        // split it into a different command; a single quote in the path would,
        // left unescaped, close the quoting and turn the rest into shell code,
        // so shellQuote escapes it properly.
        // 셸 인용한다. 사람이 붙여넣을 문구다. 맨 공백은 명령을 갈라놓고, 경로 안의
        // 작은따옴표는 이스케이프하지 않으면 인용을 닫아 나머지를 셸 코드로 만든다.
        // shellQuote 가 이를 제대로 이스케이프한다.
        sudoCmd: `sudo ${shellQuote(bin)} file get --conflict=rename ${shellQuote(dir)}`,
        error: message,
      };
    }
    return { ok: false, savedNames: [], error: message };
  }
}
