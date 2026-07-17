import React from 'react';
import { Box, Text, useInput } from 'ink';
import Frame from './Frame.js';
import { useT, useLang, helpLines } from '../i18n.js';

interface Props {
  onDone: () => void;
}

export default function Help({ onDone }: Props) {
  const t = useT();
  const lang = useLang();
  const lines = helpLines(lang);

  useInput((_input, key) => {
    if (key.return || key.escape) onDone();
  });

  return (
    <Frame screen={t('help.screen')} footer={t('help.footer')}>
      <Box flexDirection="column">
        {lines.map((line, i) => {
          const isHeading = /^[^\s]/.test(line) && line.length > 0;
          return (
            <Text key={i} color={isHeading ? 'cyan' : undefined} dimColor={!isHeading && line.length > 0}>
              {line || ' '}
            </Text>
          );
        })}
      </Box>
    </Frame>
  );
}
