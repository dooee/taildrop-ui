import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Frame from './Frame.js';
import { useT } from '../i18n.js';

export type Screen = 'menu' | 'send' | 'receive' | 'settings' | 'help';

interface Props {
  downloadDir: string;
  /**
   * Whether that folder can actually be saved into. Like a missing archiver
   * this warns rather than blocks: 받기 still runs and explains itself, and
   * sending does not need the folder at all.
   *
   * 그 폴더에 실제로 저장할 수 있는지. 압축 도구가 없을 때처럼 차단하지 않고
   * 경고만 한다. 받기는 그대로 실행되어 스스로 설명하고, 보내기는 이 폴더가
   * 아예 필요 없다.
   */
  downloadDirOk: boolean;
  /**
   * Whether an archiver was found at startup. Only folder and bundle sends
   * need one, so a missing archiver warns rather than blocks.
   *
   * 시작 시 압축 도구를 찾았는지. 폴더·묶음 전송에만 필요하므로, 없더라도
   * 차단하지 않고 경고만 한다.
   */
  hasArchiver: boolean;
  onSelect: (screen: Exclude<Screen, 'menu'> | 'quit') => void;
}

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

export default function MainMenu({
  downloadDir,
  downloadDirOk,
  hasArchiver,
  onSelect,
}: Props) {
  const t = useT();

  const items = [
    { key: 'send', label: t('menu.send'), value: 'send' as const },
    { key: 'receive', label: t('menu.receive'), value: 'receive' as const },
    { key: 'settings', label: t('menu.settings'), value: 'settings' as const },
    { key: 'help', label: t('menu.help'), value: 'help' as const },
    { key: 'quit', label: t('menu.quit'), value: 'quit' as const },
  ];

  return (
    <Frame screen={t('menu.screen')} footer={t('menu.footer')}>
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>{t('menu.prompt')}</Text>
          <Text dimColor>
            {t('menu.downloadLabel')}{' '}
            <Text color={downloadDirOk ? 'green' : 'yellow'}>{downloadDir}</Text>
          </Text>
          {/* One key, no per-cause detail — as menu.zipWarn does not tell
            * "no zip" from "no bsdtar". The menu is ambient ("something is
            * wrong, go to Settings"); Receive is the moment of failure and
            * says exactly what.
            * 사유별로 나누지 않고 키 하나 — menu.zipWarn 이 "zip 없음"과 "bsdtar
            * 없음"을 구분하지 않는 것과 같다. 메뉴는 "뭔가 잘못됐으니 설정으로"고,
            * 정확히 말하는 건 실패의 순간인 받기 화면이다. */}
          {!downloadDirOk && <Text color="yellow">{t('menu.dirWarn')}</Text>}
          {!hasArchiver && <Text color="yellow">{t('menu.zipWarn')}</Text>}
        </Box>
        <SelectInput
          items={items}
          indicatorComponent={Indicator}
          itemComponent={Item}
          onSelect={(item) => onSelect(item.value)}
        />
      </Box>
    </Frame>
  );
}
