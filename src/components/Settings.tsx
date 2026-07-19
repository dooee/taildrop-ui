import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import FileBrowser from './FileBrowser.js';
import Frame from './Frame.js';
import { type Config, saveConfig, configPath } from '../config.js';
import { dirIssueOf } from '../paths.js';
import {
  archiverKind,
  resetArchiverCache,
  archiverInstallHint,
  type ArchiverKind,
} from '../zip.js';
import { useT } from '../i18n.js';
import type { Lang } from '../i18n.js';

interface Props {
  config: Config;
  /** Archiver found at startup, or null. / 시작 시 찾은 압축 도구, 없으면 null. */
  archiver: ArchiverKind | null;
  /** Reports a re-check result up so the menu warning stays in sync.
   *  재확인 결과를 위로 알려 메뉴 경고와 상태를 맞춘다. */
  onArchiverChange: (kind: ArchiverKind | null) => void;
  onChange: (config: Config) => void;
  onDone: () => void;
}

type Stage = 'menu' | 'pickDir' | 'pickLang' | 'pickMulti' | 'saved' | 'zip';

function Indicator({ isSelected }: { isSelected?: boolean }) {
  return (
    <Box marginRight={1}>
      <Text color="cyan">{isSelected ? '❯' : ' '}</Text>
    </Box>
  );
}
function Item({ isSelected, label }: { isSelected?: boolean; label: string }) {
  return (
    <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
      {label}
    </Text>
  );
}

export default function Settings({
  config,
  archiver,
  onArchiverChange,
  onChange,
  onDone,
}: Props) {
  const t = useT();
  const [stage, setStage] = useState<Stage>('menu');
  const [savedKey, setSavedKey] = useState<string>('set.savedDir');
  const [checking, setChecking] = useState(false);

  /**
   * ESC returns each submenu to the Settings menu, as the footer hint
   * promises. pickDir is excluded — FileBrowser owns ESC via onCancel there,
   * and a second handler would fire alongside it.
   *
   * ESC 는 푸터 안내대로 각 서브메뉴에서 설정 메뉴로 돌아간다. pickDir 은
   * 제외 — 그 화면은 FileBrowser 가 onCancel 로 ESC 를 직접 처리하며,
   * 여기서도 받으면 핸들러가 이중으로 동작한다.
   */
  useInput((_input, key) => {
    if (
      key.escape &&
      (stage === 'pickLang' || stage === 'pickMulti' || stage === 'zip')
    ) {
      setStage('menu');
    }
  });

  const commit = (next: Config, msgKey: string) => {
    saveConfig(next);
    onChange(next);
    setSavedKey(msgKey);
    setStage('saved');
  };

  /**
   * Drops the cached lookup and detects again, so a tool the user installed
   * while the app was open is picked up without a restart.
   *
   * 캐시를 버리고 다시 감지한다. 앱을 켜 둔 채 설치한 도구도 재시작 없이 잡힌다.
   */
  const recheck = async () => {
    setChecking(true);
    resetArchiverCache();
    const kind = await archiverKind();
    onArchiverChange(kind);
    setChecking(false);
  };

  if (stage === 'pickDir') {
    return (
      <FileBrowser
        mode="folder"
        title={t('browser.folderTitle')}
        /* A folder that is not there cannot be browsed: listDir would throw and
         * open on browser.readError with an empty list — at the exact moment
         * the user came here to fix that folder. Fall through to the browser's
         * own default (home) instead.
         * 없는 폴더는 열 수 없다. listDir 이 던져서 빈 목록과 browser.readError 로
         * 열리는데, 하필 사용자가 그 폴더를 고치러 온 순간이다. 대신 브라우저
         * 자신의 기본값(홈)으로 넘긴다. */
        initialDir={
          dirIssueOf(config.downloadDir) ? undefined : config.downloadDir
        }
        onSubmit={([dir]) => commit({ ...config, downloadDir: dir }, 'set.savedDir')}
        onCancel={() => setStage('menu')}
      />
    );
  }

  if (stage === 'pickLang') {
    return (
      <Frame screen={t('set.langScreen')} footer={t('common.escBack')}>
        <SelectInput
          items={[
            { key: 'ko', label: '한국어 (KO)', value: 'ko' as Lang },
            { key: 'en', label: 'English (EN)', value: 'en' as Lang },
          ]}
          indicatorComponent={Indicator}
          itemComponent={Item}
          initialIndex={config.lang === 'en' ? 1 : 0}
          onSelect={(item) => commit({ ...config, lang: item.value }, 'set.savedLang')}
        />
      </Frame>
    );
  }

  if (stage === 'pickMulti') {
    return (
      <Frame screen={t('set.multiScreen')} footer={t('common.escBack')}>
        <SelectInput
          items={[
            { key: 'files', label: t('set.multi.files'), value: false },
            { key: 'zip', label: t('set.multi.zip'), value: true },
          ]}
          indicatorComponent={Indicator}
          itemComponent={Item}
          initialIndex={config.bundleMultiple ? 1 : 0}
          onSelect={(item) =>
            commit({ ...config, bundleMultiple: item.value }, 'set.savedMulti')
          }
        />
      </Frame>
    );
  }

  if (stage === 'zip') {
    return (
      <Frame screen={t('set.zipScreen')} footer={t('common.escBack')}>
        <Box flexDirection="column">
          {checking ? (
            <Text color="cyan">◇ {t('set.zipChecking')}</Text>
          ) : archiver ? (
            <>
              <Text color="green">✔ {t('set.zipFoundTitle', { kind: archiver })}</Text>
              <Text dimColor>{t('set.zipFoundHint')}</Text>
            </>
          ) : (
            <>
              <Text color="yellow">⚠ {t('set.zipMissingTitle')}</Text>
              <Text dimColor>{t('set.zipMissingHint')}</Text>
              <Text color="cyan">{'  ' + archiverInstallHint()}</Text>
            </>
          )}

          <Box marginTop={1}>
            <Text dimColor>{t('set.zipWhy')}</Text>
          </Box>

          <Box marginTop={1}>
            <SelectInput
              items={[
                { key: 'recheck', label: t('set.zipRecheck'), value: 'recheck' },
                { key: 'back', label: t('set.back'), value: 'back' },
              ]}
              indicatorComponent={Indicator}
              itemComponent={Item}
              onSelect={(item) => {
                if (item.value === 'recheck') void recheck();
                else setStage('menu');
              }}
            />
          </Box>
        </Box>
      </Frame>
    );
  }

  if (stage === 'saved') {
    return (
      <Frame screen={t('set.savedScreen')} footer={t('common.enterMenu')}>
        <Box flexDirection="column">
          <Text color="green">✔ {t(savedKey)}</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[{ key: 'ok', label: t('set.confirm'), value: 'ok' }]}
              indicatorComponent={Indicator}
              itemComponent={Item}
              onSelect={() => onDone()}
            />
          </Box>
        </Box>
      </Frame>
    );
  }

  // menu · 메뉴
  const multiLabel = config.bundleMultiple ? t('set.multi.zip') : t('set.multi.files');
  const langLabel = config.lang === 'en' ? 'English (EN)' : '한국어 (KO)';

  return (
    <Frame screen={t('set.screen')} footer={t('set.footer')}>
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>
            {t('set.currentDir')} <Text color="green">{config.downloadDir}</Text>
          </Text>
          <Text dimColor>
            {t('set.currentLang')} <Text color="green">{langLabel}</Text>
          </Text>
          <Text dimColor>
            {t('set.currentMulti')} <Text color="green">{multiLabel}</Text>
          </Text>
          <Text dimColor>
            {t('set.currentZip')}{' '}
            {archiver ? (
              <Text color="green">{t('set.zip.ok', { kind: archiver })}</Text>
            ) : (
              <Text color="yellow">{t('set.zip.missing')}</Text>
            )}
          </Text>
          <Text dimColor>
            {t('set.configFile')} {configPath()}
          </Text>
        </Box>
        <SelectInput
          items={[
            { key: 'dir', label: t('set.changeDir'), value: 'dir' },
            { key: 'lang', label: t('set.changeLang'), value: 'lang' },
            { key: 'multi', label: t('set.changeMulti'), value: 'multi' },
            { key: 'zip', label: t('set.recheckZip'), value: 'zip' },
            { key: 'back', label: t('set.back'), value: 'back' },
          ]}
          indicatorComponent={Indicator}
          itemComponent={Item}
          onSelect={(item) => {
            if (item.value === 'dir') setStage('pickDir');
            else if (item.value === 'lang') setStage('pickLang');
            else if (item.value === 'multi') setStage('pickMulti');
            else if (item.value === 'zip') setStage('zip');
            else onDone();
          }}
        />
      </Box>
    </Frame>
  );
}
