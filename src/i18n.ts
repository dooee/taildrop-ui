import React, { createContext, useContext } from 'react';

export type Lang = 'ko' | 'en';

type Params = Record<string, string | number>;

const ko: Record<string, string> = {
  'app.subtitle': 'tailscale 파일 송수신',

  'menu.screen': '메뉴',
  'menu.prompt': '무엇을 할까요?',
  'menu.downloadLabel': '받기 폴더:',
  'menu.send': '📤  파일 보내기',
  'menu.receive': '📥  파일 받기',
  'menu.settings': '⚙️   설정',
  'menu.help': '❔  도움말',
  'menu.quit': '🚪  종료',
  'menu.footer': '↑↓ 이동 · Enter 선택 · Ctrl+C 종료',
  'menu.zipWarn': '⚠ 압축 도구가 없어 폴더·묶음 전송을 할 수 없습니다. [설정]에서 확인하세요.',
  'menu.dirWarn': '⚠ 다운로드 폴더를 쓸 수 없습니다. [설정]에서 다운로드 경로를 지정해주세요.',

  'browser.filesTitle': '보내기 · 파일 선택',
  'browser.folderTitle': '설정 · 폴더 선택',
  'browser.help.files': 'Space 선택 · Enter 전송 · → 진입 · ← 상위 · . 숨김 · Esc 취소',
  'browser.help.folder': '↑↓ 이동 · → 진입 · ← 상위 · Enter 이 폴더 선택 · Esc 취소',
  'browser.empty': '(빈 폴더)',
  'browser.readError': '읽기 오류: {msg}',
  'browser.selected': '선택: {n}개',
  'browser.hintNoSel': ' (선택 없이 Enter 시 커서의 항목 전송)',
  'browser.moreAbove': '⋯ 위로 더 있음',
  'browser.moreBelow': '⋯ 아래로 더 있음',
  'browser.sendRuleTitle': '보내는 방법',
  'browser.sendRule.select': '· Space 로 여러 개 선택(다시 누르면 해제)',
  'browser.sendRule.single': '· 파일 1개 = 그대로 전송',
  'browser.sendRule.multiFiles': '· 여러 파일 = 각각 전송',
  'browser.sendRule.multiZip': '· 여러 파일 = 하나의 zip 으로 압축',
  'browser.sendRule.folder': '· 폴더 = zip 으로 압축 후 전송',
  'browser.sendRule.folderMix': '· 폴더를 함께 고르면 = 전부 하나의 zip 으로 압축',
  'browser.sendRule.change': '· 여러 파일 처리 방식은 [설정]에서 변경할 수 있어요',
  'browser.blocked.symlink': '🔗 심볼릭 링크는 보낼 수 없습니다.',
  'browser.blocked.special': '🔌 특수 파일(파이프·소켓·장치)은 보낼 수 없습니다.',
  'browser.blocked.enterHint': '→ 로 들어가 안의 항목을 고르세요.',
  'browser.blocked.nameSpace': '✕ 이름 앞뒤에 공백이 있어 받는 쪽이 거부합니다. 공백을 지우면 보낼 수 있어요.',
  'browser.blocked.nameChar': '✕ 이름에 쓸 수 없는 문자가 있어 받는 쪽이 거부합니다 (\\ : * " < > | 와 보이지 않는 문자).',
  'browser.blocked.nameLong': '✕ 이름이 너무 깁니다 ({bytes}/{budget} 바이트). 받는 쪽 한계이며 한글은 글자당 3바이트입니다.',
  'browser.blocked.nameReserved': '✕ .partial · .deleted 로 끝나는 이름은 Taildrop 이 내부용으로 쓰므로 보낼 수 없습니다.',

  'target.screen': '보내기 · 대상 선택',
  'target.prompt': '전송할 기기를 선택하세요',
  'target.none': '전송 가능한 온라인 기기가 없습니다.',
  'target.noneHint': '대상 기기가 켜져 있고 Taildrop을 허용하는지 확인하세요.',
  'target.error': '대상 목록을 불러오지 못했습니다:',
  'target.footer': '↑↓ 이동 · Enter 전송 · Esc 뒤로',

  'send.sendingScreen': '보내기 · 전송 중',
  'send.sending': '전송 중...',
  'send.zipping': '압축 중: {name}',
  'send.bundling': '{n}개 항목을 하나의 zip 으로 압축 중...',
  'send.cpProgress': '{target} 으로 전송 중... ({n}개)',
  'send.doneScreen': '보내기 · 완료',
  'send.ok': '전송 완료 ({n}개)',
  'send.fail': '전송 실패',
  'send.err.archiverMissing': '압축 도구를 찾을 수 없습니다. 폴더·묶음 전송에는 zip 또는 bsdtar 가 필요합니다.',
  'send.err.archiveFailed': '압축에 실패했습니다.',
  'send.err.empty': '보낼 항목이 없습니다.',
  'send.err.symlinkPath': '심볼릭 링크는 보낼 수 없습니다. 링크가 아니라 원본을 고르세요.',
  'send.err.specialPath': '특수 파일(파이프·소켓·장치)은 보낼 수 없습니다.',
  'send.err.missingPath': '고른 뒤에 사라진 항목이 있습니다. 삭제되었거나 이름이 바뀌었습니다. 아무것도 보내지 않았습니다.',
  'send.err.duplicateName': '하나의 zip 으로 묶는 항목 중에 같은 이름이 있습니다. zip 안에서 하나가 덮여 사라지므로, 이름을 바꾸거나 따로 보내세요. 아무것도 보내지 않았습니다.',
  'send.err.nameListHeader': '{n}개 이름을 받는 쪽이 거부합니다. 아래를 고치고 다시 시도하세요 — 아무것도 보내지 않았습니다:',
  'send.err.nameReason.space': '이름 앞뒤 공백',
  'send.err.nameReason.char': '쓸 수 없는 문자 (\\ : * " < > | 또는 보이지 않는 문자)',
  'send.err.nameReason.long': '이름이 너무 김 ({bytes}/{budget} 바이트)',
  'send.err.nameReason.reserved': '.partial · .deleted 로 끝남',

  'recv.screen': '받기',
  'recv.doneScreen': '받기 · 완료',
  'recv.receiving': '파일을 받는 중...',
  'recv.receivingHint': '인박스에서 파일을 꺼내 다운로드 폴더로 옮깁니다.',
  'recv.saved': '{n}개 파일을 저장했습니다.',
  'recv.none': '받을 파일이 없습니다.',
  'recv.fail': '받기 실패',
  'recv.needSudoTitle': '이 환경에서는 관리자 권한이 필요합니다.',
  'recv.needSudoHint': '터미널에서 아래 명령을 실행해 받으세요:',
  'recv.needDirTitle': '다운로드 경로를 지정해주세요.',
  'recv.needDirHint': '설정 › 다운로드 폴더 변경 에서 지정할 수 있습니다.',
  'recv.err.dirMissing': '폴더가 없습니다.',
  'recv.err.dirNotDir': '폴더가 아닙니다.',
  'recv.err.dirNoWrite': '이 폴더에 저장할 권한이 없습니다.',

  'set.screen': '설정',
  'set.currentDir': '현재 다운로드 폴더:',
  'set.currentLang': '현재 언어:',
  'set.currentMulti': '여러 파일 전송:',
  'set.currentZip': '압축 도구:',
  'set.zip.ok': '사용 가능 ({kind})',
  'set.zip.missing': '없음 — 폴더·묶음 전송 불가',
  'set.recheckZip': '🔄  압축 도구 설치 확인',
  'set.zipScreen': '설정 · 압축 도구',
  'set.zipChecking': '확인하는 중...',
  'set.zipFoundTitle': '압축 도구를 찾았습니다: {kind}',
  'set.zipFoundHint': '이제 폴더와 묶음 전송을 쓸 수 있습니다.',
  'set.zipMissingTitle': '아직 압축 도구를 찾지 못했습니다.',
  'set.zipMissingHint': '아래를 설치한 뒤 다시 확인하세요:',
  'set.zipWhy': '폴더 전송과 여러 파일 묶기에만 필요합니다. 파일 1개 전송은 압축 도구 없이도 됩니다.',
  'set.zipRecheck': '다시 확인',
  'set.multi.zip': '하나의 zip 으로 압축',
  'set.multi.files': '그대로 각각 전송',
  'set.configFile': '설정 파일:',
  'set.changeDir': '📂  다운로드 폴더 변경',
  'set.changeLang': '🌐  언어 / Language',
  'set.changeMulti': '🗜   여러 파일 전송 방식',
  'set.back': '↩   뒤로',
  'set.savedScreen': '설정 · 저장됨',
  'set.savedDir': '다운로드 폴더를 변경했습니다.',
  'set.savedLang': '언어를 변경했습니다.',
  'set.savedMulti': '여러 파일 전송 방식을 변경했습니다.',
  'set.confirm': '확인',
  'set.langScreen': '설정 · 언어',
  'set.multiScreen': '설정 · 여러 파일 전송',
  'set.footer': '↑↓ 이동 · Enter 선택',

  'help.screen': '도움말',
  'help.footer': 'Enter/Esc 메뉴로',

  'common.escBack': 'Esc 뒤로',
  'common.enterMenu': 'Enter 메뉴로',
  'common.loadingDevices': '◇ 대상 기기 목록을 불러오는 중...',

  // Setup guidance shown by cli.tsx before render() — see the note there and in
  // scripts/check-i18n.mts on why these live in the dictionary yet are used
  // outside the React tree.
  // cli.tsx 가 render() 이전에 보여주는 셋업 안내 — 이 키들이 사전에 있으면서 React
  // 트리 밖에서 쓰이는 이유는 cli.tsx 와 scripts/check-i18n.mts 의 설명 참고.
  'setup.noCli.title': '⚠  tailscale CLI를 찾을 수 없습니다.',
  'setup.daemonDown.title': '⚠  Tailscale 이 아직 준비되지 않았습니다.',
  'setup.noCli.intro': 'Taildrop 을 쓰려면 아래 단계를 순서대로 따르세요:',
  // "status" not reporting a running tailnet covers both a stopped daemon and a
  // logged-out one, so the wording names both rather than asserting one.
  // "status" 가 실행 중인 tailnet 을 못 알리는 건 데몬 정지와 로그아웃 둘 다 해당하므로,
  // 하나로 단정하지 않고 둘 다 언급한다.
  'setup.daemonDown.intro': 'CLI 는 있지만 Tailscale 이 실행 중이 아닙니다 — 데몬이 멈췄거나 로그인되지 않았습니다. 아래 단계를 따르세요:',
  'setup.step.install': 'tailscale 설치:',
  'setup.step.startDaemon': '데몬 시작:',
  'setup.step.login': '로그인:',
  'setup.win.daemonNote': '(Windows 서비스로 설치되어 설치 후 자동으로 시작됩니다.)',
  'setup.verify': '그런 다음 `tailscale status` 가 동작하는지 확인하세요.',

  // CLI help / usage / errors, used by src/cli-core.ts (via makeT) — outside
  // the React tree, like the setup.* keys above.
  // src/cli-core.ts 가 makeT 로 쓰는 CLI 도움말·usage·오류. 위 setup.* 키처럼
  // React 트리 밖에서 쓰인다.
  'cli.help.tagline': 'tailnet 위에서 Taildrop 으로 파일을 주고받습니다.',
  'cli.help.usage': '사용법:',
  'cli.desc.ui': '대화형 UI 실행 (명령을 주지 않으면 기본).',
  'cli.desc.down': 'UI 없이 이 기기의 대기 파일을 받습니다.',
  'cli.desc.help': '이 도움말을 표시합니다.',
  'cli.down.pathNote':
    '[path] 를 생략하면 설정된 다운로드 폴더로 받습니다. "." 은 현재 디렉터리입니다.',
  'cli.unknownCommand': '존재하지 않는 명령어입니다: {command}',
  'cli.down.received': '{n}개 파일을 받았습니다:',
  'cli.down.none': '받을 대기 파일이 없습니다.',
  'cli.down.location': '저장 위치: {dir}',
};

const en: Record<string, string> = {
  'app.subtitle': 'Tailscale file transfer',

  'menu.screen': 'Menu',
  'menu.prompt': 'What would you like to do?',
  'menu.downloadLabel': 'Download to:',
  'menu.send': '📤  Send files',
  'menu.receive': '📥  Receive files',
  'menu.settings': '⚙️   Settings',
  'menu.help': '❔  Help',
  'menu.quit': '🚪  Quit',
  'menu.footer': '↑↓ Move · Enter Select · Ctrl+C Quit',
  'menu.zipWarn': '⚠ No archiver found — folder and bundle sends are unavailable. See [Settings].',
  'menu.dirWarn': '⚠ The download folder is unusable — choose one in [Settings].',

  'browser.filesTitle': 'Send · Choose files',
  'browser.folderTitle': 'Settings · Choose folder',
  'browser.help.files': 'Space Select · Enter Send · → Enter · ← Up · . Hidden · Esc Cancel',
  'browser.help.folder': '↑↓ Move · → Enter · ← Up · Enter Choose this folder · Esc Cancel',
  'browser.empty': '(empty folder)',
  'browser.readError': 'Read error: {msg}',
  'browser.selected': 'Selected: {n}',
  'browser.hintNoSel': ' (Enter with no selection sends the highlighted item)',
  'browser.moreAbove': '⋯ more above',
  'browser.moreBelow': '⋯ more below',
  'browser.sendRuleTitle': 'How sending works',
  'browser.sendRule.select': '· Space to multi-select (press again to deselect)',
  'browser.sendRule.single': '· 1 file = sent as-is',
  'browser.sendRule.multiFiles': '· Multiple files = sent individually',
  'browser.sendRule.multiZip': '· Multiple files = zipped into one',
  'browser.sendRule.folder': '· Folder = zipped before sending',
  'browser.sendRule.folderMix': '· Pick a folder alongside = all zipped into one',
  'browser.sendRule.change': '· Change multi-file behavior in [Settings]',
  'browser.blocked.symlink': "🔗 Symlinks can't be sent.",
  'browser.blocked.special': "🔌 Special files (pipes, sockets, devices) can't be sent.",
  'browser.blocked.enterHint': 'Press → to enter and pick items inside.',
  'browser.blocked.nameSpace': '✕ The receiver refuses names with leading or trailing spaces. Remove them and it will send.',
  'browser.blocked.nameChar': '✕ The receiver refuses this name: it holds a character no name may have (\\ : * " < > | or an invisible one).',
  'browser.blocked.nameLong': '✕ Name too long ({bytes}/{budget} bytes). This is the receiver\'s ceiling; each Hangul syllable costs three bytes.',
  'browser.blocked.nameReserved': "✕ Names ending in .partial or .deleted can't be sent — Taildrop uses them for its own bookkeeping.",

  'target.screen': 'Send · Choose device',
  'target.prompt': 'Choose a device to send to',
  'target.none': 'No online devices available.',
  'target.noneHint': 'Make sure the device is online and allows Taildrop.',
  'target.error': 'Failed to load devices:',
  'target.footer': '↑↓ Move · Enter Send · Esc Back',

  'send.sendingScreen': 'Send · Sending',
  'send.sending': 'Sending...',
  'send.zipping': 'Zipping: {name}',
  'send.bundling': 'Zipping {n} items into one archive...',
  'send.cpProgress': 'Sending to {target}... ({n})',
  'send.doneScreen': 'Send · Done',
  'send.ok': 'Sent ({n})',
  'send.fail': 'Send failed',
  'send.err.archiverMissing': 'No archiver found. Folder and bundle sends need zip or bsdtar.',
  'send.err.archiveFailed': 'Compression failed.',
  'send.err.empty': 'Nothing to send.',
  'send.err.symlinkPath': "Symlinks can't be sent. Pick the real file, not the link.",
  'send.err.specialPath': "Special files (pipes, sockets, devices) can't be sent.",
  'send.err.missingPath': 'Something you picked is gone — deleted or renamed since. Nothing was sent.',
  'send.err.duplicateName': 'Two items being bundled into one zip share a name. One would overwrite the other inside the zip, so rename one or send them separately. Nothing was sent.',
  'send.err.nameListHeader': 'The receiver refuses {n} name(s). Fix them and try again — nothing was sent:',
  'send.err.nameReason.space': 'leading or trailing spaces',
  'send.err.nameReason.char': 'a forbidden character (\\ : * " < > | or an invisible one)',
  'send.err.nameReason.long': 'name too long ({bytes}/{budget} bytes)',
  'send.err.nameReason.reserved': 'ends in .partial or .deleted',

  'recv.screen': 'Receive',
  'recv.doneScreen': 'Receive · Done',
  'recv.receiving': 'Receiving...',
  'recv.receivingHint': 'Pulling files from the inbox into your download folder.',
  'recv.saved': 'Saved {n} file(s).',
  'recv.none': 'No files to receive.',
  'recv.fail': 'Receive failed',
  'recv.needSudoTitle': 'This system needs elevated permission.',
  'recv.needSudoHint': 'Run the command below in your terminal to receive:',
  'recv.needDirTitle': 'Please choose a download folder.',
  'recv.needDirHint': 'Set it in Settings › Change download folder.',
  'recv.err.dirMissing': 'The folder does not exist.',
  'recv.err.dirNotDir': 'That path is not a folder.',
  'recv.err.dirNoWrite': 'No permission to save into that folder.',

  'set.screen': 'Settings',
  'set.currentDir': 'Current download folder:',
  'set.currentLang': 'Language:',
  'set.currentMulti': 'Multiple files:',
  'set.currentZip': 'Archiver:',
  'set.zip.ok': 'available ({kind})',
  'set.zip.missing': 'missing — folder/bundle sends unavailable',
  'set.recheckZip': '🔄  Check for archiver',
  'set.zipScreen': 'Settings · Archiver',
  'set.zipChecking': 'Checking...',
  'set.zipFoundTitle': 'Archiver found: {kind}',
  'set.zipFoundHint': 'Folder and bundle sends are available now.',
  'set.zipMissingTitle': 'Still no archiver found.',
  'set.zipMissingHint': 'Install one of these, then check again:',
  'set.zipWhy': 'Only needed for folder sends and bundling. Sending a single file works without it.',
  'set.zipRecheck': 'Check again',
  'set.multi.zip': 'zip into one archive',
  'set.multi.files': 'send individually',
  'set.configFile': 'Config file:',
  'set.changeDir': '📂  Change download folder',
  'set.changeLang': '🌐  Language / 언어',
  'set.changeMulti': '🗜   Multiple-file behavior',
  'set.back': '↩   Back',
  'set.savedScreen': 'Settings · Saved',
  'set.savedDir': 'Download folder updated.',
  'set.savedLang': 'Language updated.',
  'set.savedMulti': 'Multiple-file behavior updated.',
  'set.confirm': 'OK',
  'set.langScreen': 'Settings · Language',
  'set.multiScreen': 'Settings · Multiple files',
  'set.footer': '↑↓ Move · Enter Select',

  'help.screen': 'Help',
  'help.footer': 'Enter/Esc to menu',

  'common.escBack': 'Esc Back',
  'common.enterMenu': 'Enter Menu',
  'common.loadingDevices': '◇ Loading devices...',

  // Setup guidance shown by cli.tsx before render() — see the note there and in
  // scripts/check-i18n.mts on why these live in the dictionary yet are used
  // outside the React tree.
  'setup.noCli.title': '⚠  The tailscale CLI was not found.',
  'setup.daemonDown.title': "⚠  Tailscale isn't ready yet.",
  'setup.noCli.intro': 'Follow these steps, in order, to get Taildrop working:',
  // "status" not reporting a running tailnet covers both a stopped daemon and a
  // logged-out one, so the wording names both rather than asserting one.
  'setup.daemonDown.intro': "The CLI is installed but Tailscale isn't up — the daemon may be stopped, or you're not logged in. Follow these steps:",
  'setup.step.install': 'Install tailscale:',
  'setup.step.startDaemon': 'Start the daemon:',
  'setup.step.login': 'Log in:',
  'setup.win.daemonNote': '(Installed as a Windows service — it starts automatically after install.)',
  'setup.verify': 'Then run `tailscale status` to confirm it works.',

  // CLI help / usage / errors, used by src/cli-core.ts (via makeT) — outside
  // the React tree, like the setup.* keys above.
  'cli.help.tagline': 'Send and receive files over Taildrop on your tailnet.',
  'cli.help.usage': 'Usage:',
  'cli.desc.ui': 'Launch the interactive UI (default when no command is given).',
  'cli.desc.down': "Receive this device's pending files without the UI.",
  'cli.desc.help': 'Show this help.',
  'cli.down.pathNote':
    'If [path] is omitted, receives into the configured download folder; "." means the current directory.',
  'cli.unknownCommand': 'Unknown command: {command}',
  'cli.down.received': 'Received {n} file(s):',
  'cli.down.none': 'No files are waiting to be received.',
  'cli.down.location': 'Saved to: {dir}',
};

/** Exported because scripts/check-i18n.mts imports it to compare key sets.
 *  scripts/check-i18n.mts 가 키 대조에 사용하므로 export 한다. */
export const dicts: Record<Lang, Record<string, string>> = { ko, en };

/** Whether a value is a language the app has a dictionary for. Guards config
 *  from a hand-edited lang that would make makeT index dicts[undefined].
 *  값이 앱에 사전이 있는 언어인지. 손으로 고친 lang 이 makeT 에서 dicts[undefined]
 *  를 인덱싱하지 않도록 config 를 지킨다. */
export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && x in dicts;
}

export function makeT(lang: Lang) {
  return (key: string, params?: Params): string => {
    let s = dicts[lang][key] ?? dicts.ko[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split(`{${k}}`).join(String(v));
      }
    }
    return s;
  };
}

/**
 * Help screen body as an array of lines per language. Prose paragraphs rather
 * than keyed strings, so check-i18n cannot verify these two stay in sync —
 * edit both languages together.
 *
 * 도움말 화면 본문 (언어별 줄 배열). 키-값이 아니라 문단이라 check-i18n 이
 * 정합성을 못 본다 — 양쪽 언어를 함께 고칠 것.
 */
export function helpLines(lang: Lang): string[] {
  if (lang === 'en') {
    return [
      '📤  Send files',
      '   • In the file browser: ↑↓ move, → enter folder, ← go up.',
      '   • Space selects/deselects multiple items; . toggles hidden files.',
      '   • Enter starts sending (with no selection, sends the highlighted item).',
      '   • 1 file → sent as-is.  Folder → zipped first.',
      '   • Multiple files → sent individually or zipped into one',
      '     (change this in Settings › Multiple-file behavior).',
      '   • Pick a target device from the auto-detected online list.',
      '',
      '📥  Receive files',
      '   • Pulls waiting files from the inbox into your download folder.',
      '   • No popup appears automatically when a file arrives — run Receive.',
      '   • macOS: no sudo needed.  Linux: may require sudo (a command is shown).',
      '',
      '⚙️   Settings',
      '   • Download folder, language (EN/KO), multiple-file behavior.',
      '   • Settings are saved and kept for next time.',
    ];
  }
  return [
    '📤  파일 보내기',
    '   • 파일 브라우저: ↑↓ 이동, → 폴더 진입, ← 상위 폴더.',
    '   • Space 로 여러 개 선택/해제, . 로 숨김 파일 표시.',
    '   • Enter 로 전송 시작(선택이 없으면 커서의 항목을 전송).',
    '   • 파일 1개 → 그대로 전송.  폴더 → zip 압축 후 전송.',
    '   • 여러 파일 → 각각 전송 또는 하나의 zip 으로 압축',
    '     (설정 › 여러 파일 전송 방식에서 변경).',
    '   • 자동 감지된 온라인 기기 목록에서 대상을 고릅니다.',
    '',
    '📥  파일 받기',
    '   • 인박스에 대기 중인 파일을 다운로드 폴더로 가져옵니다.',
    '   • 파일이 도착해도 자동 팝업은 없습니다 — 받기를 실행하세요.',
    '   • macOS: sudo 불필요.  Linux: sudo 필요할 수 있음(명령 안내).',
    '',
    '⚙️   설정',
    '   • 다운로드 폴더, 언어(EN/KO), 여러 파일 전송 방식.',
    '   • 설정은 저장되어 다음 실행에도 유지됩니다.',
  ];
}

export interface LangCtx {
  lang: Lang;
  t: (key: string, params?: Params) => string;
}

export const LangContext = createContext<LangCtx>({
  lang: 'ko',
  t: makeT('ko'),
});

export const useT = () => useContext(LangContext).t;
export const useLang = () => useContext(LangContext).lang;
