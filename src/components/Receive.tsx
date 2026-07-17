import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Frame from './Frame.js';
import { receive, type ReceiveResult } from '../tailscale.js';
import { useT } from '../i18n.js';

interface Props {
  downloadDir: string;
  onDone: () => void;
}

/**
 * Folder verdicts get one sentence plus the offending path underneath.
 *
 * There is no jump to Settings on purpose. This screen knows only onDone, and
 * teaching it about Settings would leak Screen out of app.tsx, which is the
 * single state machine. menu.zipWarn set the precedent: point at [설정] in
 * prose, do not navigate.
 *
 * 폴더 판정은 "문장 한 줄 + 아래에 문제의 경로"로 보여준다.
 *
 * 설정 화면으로 점프하지 않는 것은 의도다. 이 화면은 onDone 만 알고, Settings 를
 * 알게 하면 Screen 이 단일 상태 머신인 app.tsx 밖으로 샌다. menu.zipWarn 이
 * 선례다 — 문구로 [설정] 을 가리키되 이동하지는 않는다.
 */
const DIR_ERR_KEY: Record<string, string> = {
  'dir-missing': 'recv.err.dirMissing',
  'dir-not-dir': 'recv.err.dirNotDir',
  'dir-no-write': 'recv.err.dirNoWrite',
};

export default function Receive({ downloadDir, onDone }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(true);
  const [result, setResult] = useState<ReceiveResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    receive(downloadDir)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setBusy(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setResult({
            ok: false,
            savedNames: [],
            error: e instanceof Error ? e.message : String(e),
          });
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [downloadDir]);

  useInput((_input, key) => {
    if (!busy && (key.return || key.escape)) onDone();
  });

  if (busy) {
    return (
      <Frame screen={t('recv.screen')}>
        <Box flexDirection="column">
          <Text>
            <Text color="cyan">◇</Text> {t('recv.receiving')}
          </Text>
          <Text dimColor>{t('recv.receivingHint')}</Text>
        </Box>
      </Frame>
    );
  }

  return (
    <Frame screen={t('recv.doneScreen')} footer={t('common.enterMenu')}>
      <Box flexDirection="column">
        {result?.ok ? (
          result.savedNames.length > 0 ? (
            <>
              <Text color="green">
                ✔ {t('recv.saved', { n: result.savedNames.length })}
              </Text>
              <Text dimColor>→ {downloadDir}</Text>
              <Box marginTop={1} flexDirection="column">
                {result.savedNames.map((n, i) => (
                  <Text key={i}>
                    <Text color="green">{'  • '}</Text>
                    {n}
                  </Text>
                ))}
              </Box>
            </>
          ) : (
            <Text color="yellow">{t('recv.none')}</Text>
          )
        ) : result?.errorCode && DIR_ERR_KEY[result.errorCode] ? (
          <>
            <Text color="yellow">⚠ {t('recv.needDirTitle')}</Text>
            <Text>{t(DIR_ERR_KEY[result.errorCode]!)}</Text>
            <Text dimColor>{result.error}</Text>
            <Box marginTop={1}>
              <Text dimColor>{t('recv.needDirHint')}</Text>
            </Box>
          </>
        ) : result?.needsSudo ? (
          <>
            <Text color="yellow">⚠ {t('recv.needSudoTitle')}</Text>
            <Text dimColor>{t('recv.needSudoHint')}</Text>
            <Box marginTop={1}>
              <Text color="cyan">{result.sudoCmd}</Text>
            </Box>
          </>
        ) : (
          <>
            <Text color="red">✘ {t('recv.fail')}</Text>
            <Text dimColor>{result?.error}</Text>
          </>
        )}
      </Box>
    </Frame>
  );
}
