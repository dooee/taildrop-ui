import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Frame from './Frame.js';
import { listTargets, type Target } from '../tailscale.js';
import { useT } from '../i18n.js';

interface Props {
  onSelect: (target: Target) => void;
  onCancel: () => void;
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

export default function TargetPicker({ onSelect, onCancel }: Props) {
  const t = useT();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTargets()
      .then(setTargets)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  if (error) {
    return (
      <Frame screen={t('target.screen')} footer={t('common.escBack')}>
        <Text color="red">{t('target.error')}</Text>
        <Text dimColor>{error}</Text>
      </Frame>
    );
  }

  if (!targets) {
    return (
      <Frame screen={t('target.screen')} footer={t('common.escBack')}>
        <Text>{t('common.loadingDevices')}</Text>
      </Frame>
    );
  }

  if (targets.length === 0) {
    return (
      <Frame screen={t('target.screen')} footer={t('common.escBack')}>
        <Text color="yellow">⚠ {t('target.none')}</Text>
        <Text dimColor>{t('target.noneHint')}</Text>
      </Frame>
    );
  }

  const items = targets.map((tg) => ({
    key: tg.name,
    label: `${tg.name}   (${tg.ip})`,
    value: tg.name,
  }));

  return (
    <Frame screen={t('target.screen')} footer={t('target.footer')}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text dimColor>{t('target.prompt')}</Text>
        </Box>
        <SelectInput
          items={items}
          indicatorComponent={Indicator}
          itemComponent={Item}
          onSelect={(item) => {
            const target = targets.find((tg) => tg.name === item.value)!;
            onSelect(target);
          }}
        />
      </Box>
    </Frame>
  );
}
