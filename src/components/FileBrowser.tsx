import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Frame from './Frame.js';
import { useT } from '../i18n.js';
import {
  rejectOf,
  nameIssueOf,
  DEFAULT_NAME_BUDGET,
  type Reject,
  type NameIssue,
} from '../paths.js';

export type BrowserMode = 'files' | 'folder';

interface Entry {
  name: string;
  path: string;
  /** Whether → can enter it. Follows symlinks, so a link to a folder is true.
   *  → 로 진입할 수 있는지. 링크를 따라가므로 폴더 링크도 true. */
  isDir: boolean;
  /** Why it cannot be sent, or null when it can. Only files mode acts on it —
   *  folder mode may legitimately pick a symlinked folder.
   *  보낼 수 없는 사유. 보낼 수 있으면 null. files 모드만 이를 근거로 막는다 —
   *  folder 모드는 심링크 폴더를 고르는 것이 정상이다. */
  reject: Reject | null;
  /**
   * Why the receiver would refuse this name, or null when it would not. Files
   * only: a folder is zipped before it goes, and whether its name rides along
   * depends on the bundle setting, which this screen does not decide. sendPaths
   * judges the name that actually gets sent — see its note.
   *
   * 받는 쪽이 이 이름을 거부할 사유. 거부하지 않으면 null. 파일만 판정한다. 폴더는
   * 압축되어 나가고, 그 이름이 딸려 가는지는 묶음 설정에 달렸는데 그 결정은 이
   * 화면의 몫이 아니다. sendPaths 가 실제로 전송되는 이름을 판정한다 — 그쪽 설명 참고.
   */
  nameIssue: NameIssue | null;
}

interface Props {
  mode: BrowserMode;
  /** Screen name shown in the Frame header.
   *  Frame 헤더에 표시할 화면 이름. */
  title?: string;
  initialDir?: string;
  /** Whether multi-file selections get zipped; affects the hint text only.
   *  files 모드에서 여러 파일을 zip 으로 묶는 설정인지 (설명 문구용). */
  bundleMultiple?: boolean;
  /** files mode: the selected paths · folder mode: [the chosen folder]
   *  files 모드: 선택한 파일/폴더 경로들 · folder 모드: [선택한 폴더] */
  onSubmit: (paths: string[]) => void;
  onCancel: () => void;
}

const VIEWPORT = 10;

/** NameIssue → i18n key. Spelled out so check-i18n can see the keys are used,
 *  and so both sides stay greppable.
 *  NameIssue 를 i18n 키로 옮긴다. check-i18n 이 키가 쓰인 것을 볼 수 있도록, 그리고
 *  양쪽 다 grep 으로 찾을 수 있도록 적어 둔다. */
const NAME_BLOCK_KEY: Record<NameIssue, string> = {
  space: 'browser.blocked.nameSpace',
  char: 'browser.blocked.nameChar',
  long: 'browser.blocked.nameLong',
  reserved: 'browser.blocked.nameReserved',
};

/**
 * Reads one directory. Dirent already carries lstat semantics, so judging links
 * and special files costs no extra syscall. Only symlinks pay for a statSync,
 * and only to learn whether → can enter them — sending a link is refused no
 * matter what it points at.
 *
 * 디렉터리 하나를 읽는다. Dirent 는 이미 lstat 시맨틱이라 링크·특수 파일 판정에
 * 추가 syscall 이 들지 않는다. 심볼릭 링크만 statSync 비용을 내며, 그것도 → 로
 * 진입 가능한지 알기 위해서일 뿐이다. 링크 전송은 대상이 무엇이든 거부된다.
 */
function listDir(dir: string, showHidden: boolean): Entry[] {
  const items = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => showHidden || !d.name.startsWith('.'))
    .map((d) => {
      const full = path.join(dir, d.name);
      let isDir = d.isDirectory();
      if (d.isSymbolicLink()) {
        // Follow it for navigation only. A dangling link stays non-enterable.
        // 진입 가능 여부를 위해서만 따라간다. 깨진 링크는 진입 불가로 남는다.
        try {
          isDir = fs.statSync(full).isDirectory();
        } catch {
          isDir = false;
        }
      }
      return {
        name: d.name,
        path: full,
        isDir,
        reject: rejectOf(d),
        nameIssue: d.isDirectory() ? null : nameIssueOf(d.name),
      };
    });
  items.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return items;
}

/** Abbreviates the home directory to ~. / 홈 디렉터리를 ~ 로 축약. */
function prettyPath(p: string): string {
  const home = os.homedir();
  return p === home
    ? '~'
    : p.startsWith(home + path.sep)
      ? '~' + p.slice(home.length)
      : p;
}

export default function FileBrowser({
  mode,
  title,
  initialDir,
  bundleMultiple,
  onSubmit,
  onCancel,
}: Props) {
  const t = useT();
  /*
   * When several picks are bundled, each file goes inside one zip and only the
   * zip's name reaches the receiver, so a file's own bad name is no longer a
   * reason to refuse the pick. Only gate name problems when bundling is off.
   *
   * This is the same logic that already exempts folders (a folder's name never
   * rides along), just applied to files too — without it the browser refuses a
   * pick that sendPaths would happily bundle. The residual case (bundleMultiple
   * off, but a folder is picked alongside, which forces a bundle) cannot be
   * known here mid-selection; sendPaths judges the final names and covers it.
   *
   * 여러 선택 항목이 묶일 때는 각 파일이 하나의 zip 안으로 들어가고 받는 쪽에는
   * zip 이름만 도달하므로, 파일 자신의 나쁜 이름은 더 이상 선택을 거부할 이유가
   * 아니다. 묶기가 꺼져 있을 때만 이름 문제로 막는다.
   *
   * 이건 폴더를 이미 면제하는 것과 같은 논리다(폴더 이름은 딸려가지 않는다). 파일에도
   * 적용할 뿐이다 — 없으면 브라우저가 sendPaths 는 문제없이 묶을 선택을 거부한다.
   * 남는 경우(묶기는 꺼졌지만 폴더를 함께 골라 강제로 묶이는 경우)는 선택 도중 여기서
   * 알 수 없고, sendPaths 가 최종 이름을 판정해 잡는다.
   */
  const nameCanBlock = !bundleMultiple;
  const [currentDir, setCurrentDir] = useState<string>(
    initialDir ?? os.homedir(),
  );
  const [showHidden, setShowHidden] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(() => {
    try {
      setError(null);
      return listDir(currentDir, showHidden);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return [];
    }
  }, [currentDir, showHidden]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, entries.length - 1)));
  }, [entries]);

  const goInto = (entry: Entry) => {
    if (entry.isDir) {
      setCurrentDir(entry.path);
      setCursor(0);
    }
  };
  const goUp = () => {
    const parent = path.dirname(currentDir);
    if (parent !== currentDir) {
      setCurrentDir(parent);
      setCursor(0);
    }
  };

  useInput((input, key) => {
    if (key.escape) return onCancel();
    if (key.upArrow || input === 'k')
      return setCursor((c) => (c > 0 ? c - 1 : c));
    if (key.downArrow || input === 'j')
      return setCursor((c) => (c < entries.length - 1 ? c + 1 : c));
    if (key.leftArrow || input === 'h') return goUp();
    if (key.rightArrow || input === 'l') {
      const e = entries[cursor];
      if (e?.isDir) goInto(e);
      return;
    }
    if (input === '.') return setShowHidden((v) => !v);
    if (input === ' ') {
      if (mode === 'files') {
        const e = entries[cursor];
        // Links, special files, and names the receiver would refuse are all
        // refused right here. The reason is already on screen below the list,
        // so this is not a silent no-op.
        // 링크·특수 파일, 그리고 받는 쪽이 거부할 이름은 여기서 거부한다. 사유가 이미
        // 목록 아래에 떠 있으므로 조용한 무반응이 아니다.
        if (e && !e.reject && !(nameCanBlock && e.nameIssue)) {
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(e.path)) next.delete(e.path);
            else next.add(e.path);
            return next;
          });
        }
      }
      return;
    }
    if (key.return) {
      if (mode === 'folder') return onSubmit([currentDir]);
      if (selected.size > 0) return onSubmit([...selected]);
      const e = entries[cursor];
      if (!e) return;
      // Entering wins over the reject: a symlinked folder cannot be sent as
      // itself, but going inside it is allowed.
      // 진입이 거부보다 우선한다. 심링크 폴더는 자신을 보낼 수는 없어도 안으로
      // 들어가는 것은 허용된다.
      if (e.isDir) return goInto(e);
      if (e.reject || (nameCanBlock && e.nameIssue)) return;
      onSubmit([e.path]);
      return;
    }
  });

  const startIdx = Math.max(
    0,
    Math.min(
      cursor - Math.floor(VIEWPORT / 2),
      Math.max(0, entries.length - VIEWPORT),
    ),
  );
  const visible = entries.slice(startIdx, startIdx + VIEWPORT);
  const moreAbove = startIdx > 0;
  const moreBelow = startIdx + VIEWPORT < entries.length;

  const footer = mode === 'folder' ? t('browser.help.folder') : t('browser.help.files');

  /*
   * Derived from the cursor rather than held in state. State would have to be
   * cleared on every cursor move, directory change and hidden-toggle, and one
   * missed spot leaves a stale reason pinned to the wrong entry. This also puts
   * the reason on screen before the user presses Space, not after.
   *
   * state 로 들고 있지 않고 커서에서 파생한다. state 라면 커서 이동·디렉터리 변경·
   * 숨김 토글마다 지워야 하고, 한 군데만 놓쳐도 엉뚱한 항목에 사유가 남는다. 파생이면
   * 사용자가 Space 를 눌러보기 전에 이미 사유가 화면에 있다.
   */
  const focusedEntry = entries[cursor];
  const blockReason =
    mode === 'files' && focusedEntry?.reject ? focusedEntry.reject : null;
  const nameIssue =
    nameCanBlock && mode === 'files' && focusedEntry?.nameIssue
      ? focusedEntry.nameIssue
      : null;

  return (
    <Frame screen={title ?? ''} footer={footer}>
      <Box flexDirection="column">
        {/* Sending-rules panel, files mode only · 보내기 설명 패널 (files 모드) */}
        {mode === 'files' && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="yellow">{t('browser.sendRuleTitle')}</Text>
            <Text dimColor>{t('browser.sendRule.select')}</Text>
            <Text dimColor>{t('browser.sendRule.single')}</Text>
            <Text dimColor>
              {bundleMultiple
                ? t('browser.sendRule.multiZip')
                : t('browser.sendRule.multiFiles')}
            </Text>
            <Text dimColor>{t('browser.sendRule.folder')}</Text>
            {/* The folder-forces-bundle rule only bites once several items are
              * picked, so it is only worth saying when it can apply.
              * 폴더가 묶음을 강제하는 규칙은 여러 항목을 골랐을 때만 작동하므로,
              * 적용될 수 있을 때만 말한다. */}
            {!bundleMultiple && <Text dimColor>{t('browser.sendRule.folderMix')}</Text>}
            <Text dimColor>{t('browser.sendRule.change')}</Text>
          </Box>
        )}

        <Box marginBottom={1}>
          <Text color="cyan">📁 </Text>
          <Text color="cyan" bold>
            {prettyPath(currentDir)}
          </Text>
        </Box>

        {error ? (
          <Text color="red">{t('browser.readError', { msg: error })}</Text>
        ) : entries.length === 0 ? (
          <Text dimColor>{t('browser.empty')}</Text>
        ) : (
          <Box flexDirection="column">
            <Text dimColor>{moreAbove ? '  ' + t('browser.moreAbove') : ' '}</Text>
            {visible.map((e, i) => {
              const idx = startIdx + i;
              const focused = idx === cursor;
              const isSel = selected.has(e.path);
              // The 🔗 · 🔌 icons show in both modes — they state a fact. Only
              // the ✕ and the dimming, which mean "you cannot pick this", are
              // files-mode only.
              //
              // A name problem earns no icon of its own: the file is an
              // ordinary file, and 📄 is the truth about it. The ✕ carries the
              // "cannot pick", and the line below the list says why.
              //
              // 🔗 · 🔌 아이콘은 두 모드 모두에 나온다 — 사실을 말할 뿐이다. "고를 수
              // 없다"를 뜻하는 ✕ 와 흐림만 files 모드 전용이다.
              //
              // 이름 문제에는 전용 아이콘을 주지 않는다. 그 파일은 평범한 파일이고
              // 📄 가 그에 대한 사실이다. "고를 수 없다"는 ✕ 가 지고, 이유는 목록
              // 아래 줄이 말한다.
              const blocked =
                mode === 'files' &&
                (e.reject !== null || (nameCanBlock && e.nameIssue !== null));
              const checkbox =
                mode !== 'files' ? '' : blocked ? '✕ ' : isSel ? '◉ ' : '◯ ';
              const icon =
                e.reject === 'symlink'
                  ? '🔗 '
                  : e.reject === 'special'
                    ? '🔌 '
                    : e.isDir
                      ? '📂 '
                      : '📄 ';
              return (
                <Box key={e.path}>
                  <Text color={focused ? 'cyan' : undefined} bold={focused}>
                    {focused ? '❯ ' : '  '}
                  </Text>
                  <Text
                    color={isSel ? 'green' : focused && !blocked ? 'cyan' : undefined}
                    dimColor={blocked}
                  >
                    {checkbox}
                  </Text>
                  <Text
                    color={focused && !blocked ? 'cyan' : undefined}
                    bold={focused}
                    dimColor={blocked}
                  >
                    {icon}
                    {e.name}
                    {e.isDir ? '/' : ''}
                  </Text>
                </Box>
              );
            })}
            <Text dimColor>{moreBelow ? '  ' + t('browser.moreBelow') : ' '}</Text>
          </Box>
        )}

        {mode === 'files' && (
          <Box marginTop={1} flexDirection="column">
            {blockReason ? (
              <Text color="yellow">
                {blockReason === 'symlink'
                  ? t('browser.blocked.symlink')
                  : t('browser.blocked.special')}
                {/* Only a folder link can be entered; saying it about a file
                  * link or a dangling one would be a lie.
                  * 진입은 폴더 링크에만 되는 말이다. 파일 링크나 깨진 링크에 이
                  * 말을 하면 거짓말이다. */}
                {blockReason === 'symlink' && focusedEntry?.isDir
                  ? ' ' + t('browser.blocked.enterHint')
                  : ''}
              </Text>
            ) : nameIssue ? (
              /* The byte figures go only to the length message; the others
               * ignore them. Passing them unconditionally keeps this one call.
               * 바이트 수치는 길이 문구에만 쓰이고 나머지는 무시한다. 조건 없이
               * 넘겨서 호출을 하나로 유지한다. */
              <Text color="yellow">
                {t(NAME_BLOCK_KEY[nameIssue], {
                  bytes: Buffer.byteLength(focusedEntry?.name ?? '', 'utf8'),
                  budget: DEFAULT_NAME_BUDGET,
                })}
              </Text>
            ) : null}
            <Text
              color={selected.size > 0 ? 'yellow' : undefined}
              dimColor={selected.size === 0}
            >
              {t('browser.selected', { n: selected.size })}
              {selected.size === 0 ? t('browser.hintNoSel') : ''}
            </Text>
          </Box>
        )}
      </Box>
    </Frame>
  );
}
