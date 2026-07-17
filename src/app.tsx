import React, { useEffect, useMemo, useState } from 'react';
import { Box, useApp } from 'ink';
import MainMenu, { type Screen } from './components/MainMenu.js';
import Send from './components/Send.js';
import Receive from './components/Receive.js';
import Settings from './components/Settings.js';
import Help from './components/Help.js';
import { loadConfig, type Config } from './config.js';
import { dirIssueOf } from './paths.js';
import { archiverKind, type ArchiverKind } from './zip.js';
import { LangContext, makeT } from './i18n.js';

export default function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('menu');
  const [config, setConfig] = useState<Config>(() => loadConfig());

  // Detected once at startup, then re-run on demand from Settings. Held here
  // so a successful re-check clears the menu warning immediately.
  // 시작 시 한 번 감지하고, 설정 화면에서 요청하면 다시 검사한다. 재확인이
  // 성공하면 메뉴 경고가 바로 사라지도록 여기서 상태를 들고 있는다.
  const [archiver, setArchiver] = useState<ArchiverKind | null>(null);
  useEffect(() => {
    void archiverKind().then(setArchiver);
  }, []);

  /*
   * Derived, not state. The archiver needed state because it is a fact about
   * the world that changes while the app runs (the user installs zip) and
   * costs an async lookup. This is a pure function of config.downloadDir,
   * which this component already owns, and statSync is microseconds — so
   * picking a folder in Settings calls setConfig and the warning clears itself
   * with no re-check button. A folder that disappears while the app is open is
   * caught by receive()'s own check, the same second layer paths.ts has.
   *
   * state 가 아니라 파생값이다. 압축 도구가 state 인 건 앱 실행 중에도 바뀌는 바깥
   * 세계의 사실이고 비동기 조회가 필요해서다. 이건 이 컴포넌트가 이미 들고 있는
   * config.downloadDir 의 순수 함수이고 statSync 는 마이크로초라, 설정에서 폴더를
   * 고르면 setConfig 가 불려 재확인 버튼 없이 경고가 스스로 사라진다. 앱을 켜 둔 채
   * 폴더가 사라지는 경우는 receive() 자신의 검사가 잡는다 — paths.ts 와 같은 두
   * 번째 층이다.
   */
  const downloadDirOk = useMemo(
    () => dirIssueOf(config.downloadDir) === null,
    [config.downloadDir],
  );

  const ctx = useMemo(
    () => ({ lang: config.lang, t: makeT(config.lang) }),
    [config.lang],
  );

  return (
    <LangContext.Provider value={ctx}>
      <Box flexDirection="column" marginTop={1}>
        {screen === 'menu' && (
          <MainMenu
            downloadDir={config.downloadDir}
            downloadDirOk={downloadDirOk}
            hasArchiver={archiver !== null}
            onSelect={(target) => {
              if (target === 'quit') exit();
              else setScreen(target);
            }}
          />
        )}

        {screen === 'send' && (
          <Send
            bundleMultiple={config.bundleMultiple}
            onDone={() => setScreen('menu')}
          />
        )}

        {screen === 'receive' && (
          <Receive
            downloadDir={config.downloadDir}
            onDone={() => setScreen('menu')}
          />
        )}

        {screen === 'settings' && (
          <Settings
            config={config}
            archiver={archiver}
            onArchiverChange={setArchiver}
            onChange={setConfig}
            onDone={() => setScreen('menu')}
          />
        )}

        {screen === 'help' && <Help onDone={() => setScreen('menu')} />}
      </Box>
    </LangContext.Provider>
  );
}
