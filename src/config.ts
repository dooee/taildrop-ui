import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { isLang, type Lang } from './i18n.js';

export interface Config {
  /** Where received files are saved. / 받은 파일을 저장할 폴더. */
  downloadDir: string;
  /** UI language. / UI 언어. */
  lang: Lang;
  /** Bundle a multi-file selection into one zip.
   *  여러 파일 선택 시 하나의 zip 으로 묶어 보낼지 여부. */
  bundleMultiple: boolean;
}

/** $XDG_CONFIG_HOME, or ~/.config. Both our config file and the XDG user-dirs
 *  file hang off it.
 *  $XDG_CONFIG_HOME, 없으면 ~/.config. 우리 설정 파일과 XDG user-dirs 파일이 함께 쓴다. */
function xdgConfigHome(home: string): string {
  return process.env.XDG_CONFIG_HOME || path.join(home, '.config');
}

/** Per-platform config directory (macOS: Application Support, Linux: XDG,
 *  Windows: AppData).
 *  플랫폼별 설정 디렉터리. */
function configDir(): string {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'tailtoss');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
      'tailtoss',
    );
  }
  // linux / others: XDG
  // 리눅스 등: XDG
  return path.join(xdgConfigHome(home), 'tailtoss');
}

/**
 * The Linux download folder, read from ~/.config/user-dirs.dirs.
 *
 * XDG_DOWNLOAD_DIR is not an environment variable. xdg-user-dirs writes it to
 * that file and nothing exports it, so process.env.XDG_DOWNLOAD_DIR is
 * undefined in a normal session. The file is shell-sourced and only two forms
 * are supported -- XDG_DOWNLOAD_DIR="$HOME/yyy" and XDG_DOWNLOAD_DIR="/yyy" --
 * which is why a few lines replace a shell parser, or a native dependency.
 *
 * This matters because on Linux, unlike macOS, the directory itself is
 * translated: the real folder may be ~/Telechargements or ~/Downloads
 * depending on locale. Ignoring the file would create a second, wrong one.
 *
 * Anything unexpected falls back to ~/Downloads, including a value equal to
 * $HOME: `xdg-user-dir DOWNLOAD` answers $HOME when nothing is configured, so
 * a home-equal value means "unset", and taking it at face value would pour
 * every received file into the home directory.
 *
 * Existence is not checked here -- this only proposes a default. Judging it is
 * dirIssueOf's job, at the two places that care.
 *
 * 리눅스의 다운로드 폴더를 ~/.config/user-dirs.dirs 에서 읽는다.
 *
 * XDG_DOWNLOAD_DIR 은 환경변수가 아니다. xdg-user-dirs 가 이 파일에만 쓰고 export
 * 하지 않으므로 일반 세션에서 process.env.XDG_DOWNLOAD_DIR 은 undefined 다. 이
 * 파일은 셸이 source 하는 형식이고 지원되는 형태는 두 가지뿐이라
 * (XDG_DOWNLOAD_DIR="$HOME/yyy" 와 XDG_DOWNLOAD_DIR="/yyy"), 셸 파서도 네이티브
 * 의존성도 없이 몇 줄로 대신할 수 있다.
 *
 * 이게 중요한 이유는 리눅스가 macOS 와 달리 디렉터리 이름 자체를 번역하기
 * 때문이다. 로케일에 따라 실제 폴더가 ~/Telechargements 일 수도 ~/Downloads 일
 * 수도 있다. 파일을 무시하면 틀린 폴더를 하나 더 만들게 된다.
 *
 * 예상 밖의 값은 전부 ~/Downloads 로 폴백한다. $HOME 과 같은 값도 마찬가지다.
 * `xdg-user-dir DOWNLOAD` 는 설정이 없으면 $HOME 을 답하므로, 홈과 같은 값은
 * "미설정"이라는 뜻이고, 곧이곧대로 받으면 받은 파일을 전부 홈에 쏟게 된다.
 *
 * 존재 여부는 여기서 보지 않는다. 이 함수는 기본값을 제안할 뿐이고, 판정은 그것이
 * 필요한 두 곳에서 dirIssueOf 가 한다.
 */
function linuxDownloadDir(home: string): string {
  const fallback = path.join(home, 'Downloads');
  try {
    const raw = fs.readFileSync(
      path.join(xdgConfigHome(home), 'user-dirs.dirs'),
      'utf8',
    );

    // Shell sourcing means the last assignment wins; `#` comments never match.
    // 셸 source 는 마지막 대입이 이긴다. `#` 주석은 애초에 매칭되지 않는다.
    let last: string | null = null;
    for (const line of raw.split('\n')) {
      const m = /^\s*XDG_DOWNLOAD_DIR\s*=\s*"(.*)"\s*$/.exec(line);
      if (m?.[1] !== undefined) last = m[1];
    }
    if (last === null) return fallback;

    // $HOME is expanded before unescaping, never after: an unescaped `$` is the
    // variable, and a literal one is written `\$HOME`.
    // $HOME 치환은 이스케이프 해제보다 먼저다. 이스케이프되지 않은 `$` 가 변수이고,
    // 글자 그대로의 `$HOME` 은 `\$HOME` 으로 적힌다.
    const expanded = last.startsWith('$HOME/')
      ? path.join(home, last.slice('$HOME/'.length))
      : last;
    const dir = expanded.replace(/\\(.)/g, '$1');

    if (!path.isAbsolute(dir)) return fallback;
    if (path.resolve(dir) === path.resolve(home)) return fallback;
    return dir;
  } catch {
    return fallback;
  }
}

const CONFIG_PATH = path.join(configDir(), 'config.json');

export function defaultConfig(): Config {
  const home = os.homedir();
  return {
    /*
     * macOS and Windows have one answer and no file to read. macOS's folder is
     * always literally "Downloads"; Finder only translates it for display via a
     * .localized marker, so there is no locale branch to make. Linux does
     * translate the directory itself, hence the lookup.
     *
     * macOS·Windows 는 답이 하나이고 읽을 파일도 없다. macOS 의 실제 폴더 이름은
     * 언제나 "Downloads" 이고 Finder 가 .localized 마커로 보여줄 때만 번역하므로
     * 로케일 분기가 필요 없다. 리눅스는 디렉터리 이름 자체를 번역해서 조회한다.
     */
    downloadDir:
      process.platform === 'darwin' || process.platform === 'win32'
        ? path.join(home, 'Downloads')
        : linuxDownloadDir(home),
    lang: 'en',
    bundleMultiple: false,
  };
}

/**
 * Reads the saved config, falling back to defaults on any failure (missing
 * file, bad JSON, unreadable). Callers always get a usable Config.
 *
 * 저장된 설정을 읽는다. 어떤 실패든(파일 없음·JSON 오류·읽기 불가) 기본값으로
 * 폴백하므로 호출자는 항상 유효한 Config 를 받는다.
 */
export function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    const base = defaultConfig();
    const merged = { ...base, ...parsed };
    /*
     * parsed is cast, not checked — the file is hand-editable, so its types are
     * a claim. lang is the one field that crashes rather than misbehaves: makeT
     * indexes dicts[lang], so a bogus value throws on the first t() call. Fall
     * back to the default. downloadDir is guarded by dirIssueOf where it's used,
     * and a bad bundleMultiple only reads as falsy.
     *
     * parsed 는 검사가 아니라 캐스팅이다. 파일을 손으로 고칠 수 있어 그 타입은 주장일
     * 뿐이다. lang 은 오작동이 아니라 크래시를 내는 유일한 필드다. makeT 가
     * dicts[lang] 을 인덱싱하므로 엉뚱한 값은 첫 t() 호출에서 던진다. 기본값으로
     * 폴백한다. downloadDir 은 쓰이는 곳에서 dirIssueOf 가 지키고, 잘못된
     * bundleMultiple 은 falsy 로 읽힐 뿐이다.
     */
    if (!isLang(merged.lang)) merged.lang = base.lang;
    return merged;
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export function configPath(): string {
  return CONFIG_PATH;
}
