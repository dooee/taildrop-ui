import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execa } from 'execa';

/**
 * Which archiver backend is in use.
 * - 'zip'    Info-ZIP, the usual tool on macOS and most Linux distros
 * - 'bsdtar' libarchive's tar, which writes .zip via -a. Ships with macOS and
 *            with Windows 10 1803+ as tar.exe, so Windows needs no install.
 *
 * GNU tar is deliberately NOT accepted: it can compress with gzip/xz but
 * cannot write the zip container at all, so a Linux box with only GNU tar
 * counts as having no archiver.
 *
 * 어떤 압축 백엔드를 쓰는지.
 * - 'zip'    Info-ZIP. macOS 와 대부분의 Linux 배포판의 기본 도구
 * - 'bsdtar' libarchive 의 tar. -a 로 .zip 을 쓴다. macOS 기본 탑재이고
 *            Windows 10 1803+ 에 tar.exe 로 포함되어 Windows 는 추가 설치 불필요
 *
 * GNU tar 는 일부러 제외한다. gzip/xz 압축은 되지만 zip 컨테이너 자체를 만들 수
 * 없어서, GNU tar 만 있는 Linux 는 압축 도구가 없는 것으로 친다.
 */
export type ArchiverKind = 'zip' | 'bsdtar';

/**
 * Failure raised by this module. Carries a code, never prose — like
 * tailscale.ts this module stays free of i18n and the UI does the wording.
 *
 * 이 모듈이 던지는 실패. 번역된 문장이 아니라 코드를 담는다. tailscale.ts 와
 * 마찬가지로 이 모듈은 i18n 에 의존하지 않고, 문구는 UI 가 정한다.
 */
export class ArchiveError extends Error {
  constructor(readonly code: 'archiver-missing' | 'archive-failed', message?: string) {
    super(message ?? code);
    this.name = 'ArchiveError';
  }
}

let cached: ArchiverKind | null = null;

/**
 * Finds a usable archiver, preferring Info-ZIP and falling back to bsdtar.
 * The result is cached; call resetArchiverCache() after the user installs one.
 *
 * 쓸 수 있는 압축 도구를 찾는다. Info-ZIP 우선, 없으면 bsdtar 로 폴백.
 * 결과는 캐싱되므로, 사용자가 새로 설치한 뒤에는 resetArchiverCache() 를 부를 것.
 *
 * @throws ArchiveError('archiver-missing') when neither is available.
 *         둘 다 없으면 ArchiveError('archiver-missing').
 */
export async function resolveArchiver(): Promise<ArchiverKind> {
  if (cached) return cached;

  try {
    await execa('zip', ['-v']);
    cached = 'zip';
    return cached;
  } catch {
    // Not installed, or not on PATH. Try tar next.
    // 미설치이거나 PATH 에 없음. 다음으로 tar 를 본다.
  }

  try {
    const { stdout } = await execa('tar', ['--version']);
    // Only libarchive's tar can write zip. GNU tar reports "tar (GNU tar)".
    // libarchive 의 tar 만 zip 을 쓸 수 있다. GNU tar 는 "tar (GNU tar)" 로 나온다.
    if (/bsdtar|libarchive/i.test(stdout)) {
      cached = 'bsdtar';
      return cached;
    }
  } catch {
    // No tar either. / tar 도 없음.
  }

  throw new ArchiveError('archiver-missing');
}

/**
 * Whether any archiver is available. Used for the startup warning and the
 * Settings screen; never throws.
 *
 * 압축 도구가 하나라도 있는지. 시작 시 경고와 설정 화면에서 쓴다. 예외를 던지지 않는다.
 */
export async function hasArchiver(): Promise<boolean> {
  try {
    await resolveArchiver();
    return true;
  } catch {
    return false;
  }
}

/**
 * Same as hasArchiver but reports which backend was found, for display.
 * hasArchiver 와 같되 어떤 백엔드인지 함께 알려준다 (표시용).
 */
export async function archiverKind(): Promise<ArchiverKind | null> {
  try {
    return await resolveArchiver();
  } catch {
    return null;
  }
}

/**
 * Forgets the cached lookup so the next call re-detects. This is what the
 * "re-check" action in Settings calls after the user installs a tool.
 *
 * 캐시된 탐색 결과를 지워 다음 호출이 다시 감지하게 한다. 사용자가 도구를 설치한
 * 뒤 설정 화면의 "재확인" 동작이 이걸 부른다.
 */
export function resetArchiverCache(): void {
  cached = null;
}

/**
 * Platform-specific hint for installing an archiver. Returns a shell command
 * or URL, not a sentence — the surrounding prose comes from i18n.
 *
 * 압축 도구 설치 안내 (플랫폼별). 문장이 아니라 명령이나 URL 만 돌려준다 —
 * 감싸는 설명은 i18n 이 맡는다.
 */
export function archiverInstallHint(): string {
  if (process.platform === 'linux') return 'sudo apt install zip  ·  sudo dnf install zip';
  if (process.platform === 'win32') return 'https://learn.microsoft.com/windows/tar/';
  return 'brew install zip';
}

/** One archive member: a name plus the directory it is named relative to.
 *  아카이브에 담을 항목 하나: 이름과, 그 이름의 기준이 되는 디렉터리. */
interface Item {
  parent: string;
  base: string;
}

/**
 * Writes every item into a fresh zip at zipPath.
 *
 * The two backends differ in how they take items from multiple directories.
 * Info-ZIP has no "change directory" flag, so it is invoked once per item with
 * a different cwd, appending each time. bsdtar CANNOT append to a zip (it
 * fails with "Unrecognized archive format"), but it accepts repeated -C, so it
 * gets a single invocation listing every item.
 *
 * 모든 항목을 zipPath 에 새 zip 으로 쓴다.
 *
 * 두 백엔드는 서로 다른 디렉터리의 항목을 다루는 방식이 다르다. Info-ZIP 은
 * 디렉터리 변경 옵션이 없어 cwd 를 바꿔가며 항목마다 한 번씩 호출해 덧붙인다.
 * bsdtar 는 zip 에 덧붙이기가 불가능하지만("Unrecognized archive format")
 * -C 를 여러 번 받으므로, 모든 항목을 나열해 한 번만 호출한다.
 */
async function archive(zipPath: string, items: Item[]): Promise<void> {
  const kind = await resolveArchiver();
  try {
    if (kind === 'zip') {
      for (const { parent, base } of items) {
        // -r recurse · -y keep symlinks as links · -q quiet
        // -r 재귀 · -y 심볼릭 링크 유지 · -q 조용히
        await execa('zip', ['-r', '-y', '-q', zipPath, base], { cwd: parent });
      }
    } else {
      // -a picks the format from the .zip extension.
      // -a 는 .zip 확장자로 포맷을 정한다.
      const args = ['-a', '-c', '-f', zipPath];
      for (const { parent, base } of items) args.push('-C', parent, base);
      await execa('tar', args);
    }
  } catch (err) {
    if (err instanceof ArchiveError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ArchiveError('archive-failed', message);
  }
}

/**
 * Zips a single folder into a temporary file, preserving its structure.
 * 폴더 하나를 임시 zip 파일로 압축한다. (폴더 구조 보존)
 *
 * @returns Absolute path of the created zip. / 생성된 zip 파일의 절대 경로.
 */
export async function zipFolder(folderPath: string): Promise<string> {
  const abs = path.resolve(folderPath);
  const base = path.basename(abs);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taildrop-zip-'));
  const zipPath = path.join(tmpDir, `${base}.zip`);

  await archiveOrCleanup(zipPath, tmpDir, [{ parent: path.dirname(abs), base }]);
  return zipPath;
}

/**
 * Bundles several paths (files and folders mixed) into one zip.
 * Each item is appended relative to its own parent directory, so items from
 * different locations each keep their own top-level name in the archive.
 *
 * 여러 경로(파일/폴더 혼합)를 하나의 zip 으로 묶는다.
 * 각 항목을 자신의 부모 디렉터리를 기준으로 아카이브에 덧붙여, 서로 다른 위치의
 * 항목도 각자의 최상위 이름으로 저장된다.
 *
 * @returns Absolute path of the created zip. / 생성된 zip 파일의 절대 경로.
 */
export async function zipPaths(paths: string[], zipName: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taildrop-zip-'));
  const zipPath = path.join(tmpDir, zipName);

  const items = paths.map((p) => {
    const abs = path.resolve(p);
    return { parent: path.dirname(abs), base: path.basename(abs) };
  });
  await archiveOrCleanup(zipPath, tmpDir, items);
  return zipPath;
}

/**
 * archive, but removes the temp dir if it throws. The caller only learns the
 * zip path on success, so on failure it cannot clean up itself — the mkdtemp
 * dir and any partial archive would leak. This keeps that ownership local.
 *
 * archive 와 같되, 던지면 임시 폴더를 지운다. 호출자는 성공해야만 zip 경로를
 * 알게 되므로, 실패하면 스스로 정리할 수 없다 — mkdtemp 폴더와 미완성 아카이브가
 * 새어 나간다. 그 소유권을 이 안에 둔다.
 */
async function archiveOrCleanup(
  zipPath: string,
  tmpDir: string,
  items: Item[],
): Promise<void> {
  try {
    await archive(zipPath, items);
  } catch (err) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Cleanup failures are not worth surfacing over the original error.
      // 정리 실패를 원래 오류보다 앞세울 이유는 없다.
    }
    throw err;
  }
}

/** Removes a temp zip along with its temp directory.
 *  임시 zip 과 그 임시 폴더를 정리한다. */
export function cleanupZip(zipPath: string): void {
  try {
    fs.rmSync(path.dirname(zipPath), { recursive: true, force: true });
  } catch {
    // Cleanup failures are not worth surfacing.
    // 정리 실패는 무시.
  }
}
