[English](README.md) · **한국어**

# Tailtoss

**Tailscale Taildrop을 위한 깔끔한 터미널 UI (TUI).**
GUI 클라이언트 없이 오픈소스 `tailscale` CLI로 파일을 주고받는 환경을 위해 만들었습니다.
파일 선택·대상 기기 선택·받기를 키보드만으로 처리합니다.

> A simple TUI for Tailscale's Taildrop. Send/receive files over your tailnet from
> the terminal — file browser, device picker. Command: **`tailtoss`**.

```
 🚀 Tailtoss  tailscale 파일 송수신  › 메뉴
──────────────────────────────────────────────
무엇을 할까요?
받기 폴더: /Users/you/Downloads

❯ 📤  파일 보내기
  📥  파일 받기
  ⚙️  설정
  ❔  도움말
  🚪  종료
──────────────────────────────────────────────
↑↓ 이동 · Enter 선택 · Ctrl+C 종료
```

---

## 왜 Tailtoss 인가

Taildrop은 Tailscale이 기본 제공하는, 내 기기들 사이에서 클라우드도 계정도 없이 파일을 주고받는
기능입니다. Tailtoss는 그 Taildrop을 **실제로 편하게** 쓰게 하려고 만들었습니다 — `tailscale`
CLI 위에 얹은 키보드 중심 터미널 UI라, `tailscale file cp` 옵션을 외우거나 기기 이름을 찾아 헤맬
필요가 없습니다. 설치도 가볍습니다 — Node와, 이미 쓰고 있는 `tailscale` CLI면 충분합니다.

기본기 위에, 공식 CLI에도 GUI에도 없는 것들을 더합니다:

- **폴더 전송** — 폴더는 전송 전에 자동으로 zip 압축 (CLI는 파일만 보냅니다)
- **자유로운 다중 선택** — 파일과 폴더를 원하는 대로 한 번에 선택
- **전송 전 이름 검사** — 받는 쪽이 거부할 이름(앞뒤 공백·길이 초과·금지 문자)을 **보내기 전에**
  잡아, 어느 파일이 왜 문제인지 알려줍니다 — 공식 도구가 주는 "전송 실패" 한 줄과 다릅니다

## 주요 기능

- **파일 보내기** — 내장 파일 브라우저에서 선택 → 온라인 기기 선택 → 전송
  - 파일 1개 → 그대로 전송
  - 여러 파일 → **각각 전송** 또는 **하나의 zip으로 압축** (설정에서 선택)
  - 폴더 → 항상 `.zip`으로 압축 후 전송
  - 대상 목록은 `tailscale file cp --targets`로 **자동 표시** (온라인·수신 가능 기기만)
- **파일 받기** — 스테이징 인박스의 파일을 다운로드 폴더로 저장
  - macOS(Homebrew tailscaled): 보통 **sudo·인증 없이** 사용자 소유로 저장 — 단, 권한 오류가 나면 화면에 안내되는 `sudo` 명령을 실행
  - Linux 등 권한이 필요한 환경: 실행할 `sudo` 명령을 화면에 안내
  - 같은 이름은 `--conflict=rename`으로 번호가 자동으로 붙음
- **설정** — 다운로드 폴더 · 언어 · 여러 파일 전송 방식 (모두 저장되어 다음 실행에 유지)
- **도움말** — 사용법을 화면에서 바로 확인

## 지원 플랫폼

| 플랫폼 | 상태 | 비고 |
| --- | --- | --- |
| **macOS** | ✅ 완전 지원 | 받기에 보통 sudo 불필요 (Homebrew tailscaled 기준) · 권한 오류 시 `sudo` 명령 안내 |
| **Linux** | ✅ 지원 | 받기 시 root 소유 인박스 접근을 위해 `sudo`가 필요할 수 있음(명령 안내) |
| **Windows** | ⚠️ 실험적 | 경로/명령은 대응되어 있으나 검증은 macOS·Linux 중심. 폴더·묶음 전송은 내장 `tar.exe`(Windows 10 1803+)에 의존하며, 이 경로는 실제 장비에서 검증되지 않았습니다 |

## 요구 사항

> **이 도구는 오픈소스 `tailscale` / `tailscaled`(CLI + 데몬)를 대상으로 합니다.** `PATH`에 있는
> `tailscale` 실행 파일을 그대로 사용하며, 주 사용 대상은 `tailscaled`를 직접 운용하는 사용자입니다
> — macOS의 Homebrew 빌드(`brew install tailscale`)나 네이티브 Linux 설치가 이에 해당합니다.
> macOS 정식 GUI 클라이언트에 포함된 `tailscale` CLI로도 동작함을 확인했지만, 그 경로는 **보장하지
> 않으며** 다른 플랫폼·배포 형태는 검증되지 않았습니다. **`tailscaled` 사용자가 주 대상입니다.**

- [Node.js](https://nodejs.org) **18 이상**
- **`tailscale` CLI**(오픈소스 빌드, `tailscaled` 실행 상태) — 미설치 시 실행하면 설치 안내 후 종료합니다
  - macOS: `brew install tailscale` 후 `sudo brew services start tailscale` 로 `tailscaled`
    를 launchd 서비스로 등록하면 부팅 시 자동 실행되어 매번 수동으로 띄울 필요가 없습니다.
    이어서 `sudo tailscale up` 으로 로그인하세요.
    [Tailscaled on macOS](https://github.com/tailscale/tailscale/wiki/Tailscaled-on-macOS) 참고.
  - Linux: https://tailscale.com/download/linux
- **압축 도구** — 폴더 전송 / 여러 파일 zip 묶음에만 필요합니다. 파일 1개 전송에는 필요 없습니다.
  아래 둘 중 아무거나 있으면 되고, 앱이 찾아서 알아서 씁니다:
  - **`zip`**(Info-ZIP) — macOS 기본 포함, Linux는 `sudo apt install zip` 등
  - **`bsdtar`** — libarchive의 `tar`로 `.zip`을 직접 씁니다. macOS 기본 포함이며,
    Windows 10 1803 이상 / 11에는 `tar.exe`로 들어 있습니다. 단 **GNU tar는 zip을 만들지 못하므로**,
    GNU tar만 있는 Linux는 여전히 `zip`이 필요합니다.

  둘 다 없으면 메뉴에 경고가 뜨고(차단하지는 않습니다), 설치한 뒤 설정 › *압축 도구 설치 확인*으로
  재감지하면 재시작 없이 바로 반영됩니다.

> npm 패키지 의존성(`ink`, `react`, `execa` 등)은 `npm install`이 처리합니다.
> 런타임 필수 도구(`tailscale`)는 실행 시 자동으로 점검합니다.

## 설치

npm에서 설치:

```bash
npm install -g tailtoss
```

설치 후 **어느 경로에서든** 실행:

```bash
tailtoss
```

나중에 업데이트하려면 `npm install -g tailtoss@latest` 를 실행하세요.

### 소스에서 설치 (개발용)

```bash
git clone https://github.com/dooee/tailtoss.git
cd tailtoss
npm install          # 의존성 설치
npm run build        # dist/ 로 컴파일
npm install -g .     # 전역 명령 `tailtoss` 등록
```

> `npm link` 로도 되며 결과(전역 `tailtoss`)는 완전히 같습니다 — 차이는 연결 방식뿐입니다.
> `npm install -g .` 은 빌드된 **복사본**을 설치하고, `npm link` 는 이 **작업 폴더를 심볼릭 링크**로
> 연결합니다. 그래서 소스를 직접 고칠 계획이면 `npm link` 가 낫습니다: `npm run build` 만 하면
> 재설치 없이 `tailtoss` 에 바로 반영됩니다.

## 사용법

`tailtoss` 실행 → 메뉴에서 방향키 이동, Enter 선택.

### 📤 파일 보내기

파일 브라우저 조작:

| 키 | 동작 |
| --- | --- |
| `↑` `↓` | 항목 이동 |
| `→` | 폴더 진입 |
| `←` | 상위 폴더 |
| `Space` | 선택 / 해제 (여러 개 가능) |
| `Enter` | 전송 시작 (선택이 없으면 커서의 항목 전송) |
| `.` | 숨김 파일 표시 토글 |
| `Esc` | 취소 |

전송 규칙:

- **파일 1개** → 그대로 전송
- **여러 파일** → 설정에 따라 *각각 전송* 또는 *하나의 zip으로 압축*
- **폴더** → 항상 zip으로 압축 후 전송

이후 대상 기기를 목록에서 고르면 전송됩니다.

### 📥 파일 받기

`파일 받기`를 실행하면 인박스의 파일을 다운로드 폴더로 가져옵니다.

> headless tailscaled 환경에서는 파일이 도착해도 GUI 앱처럼 **자동 팝업이 뜨지 않습니다.**
> 받을 때 `받기`를 실행하세요. 권한 오류가 나면(Linux, 또는 환경에 따라 간혹 macOS) 실행할 `sudo` 명령을 화면에 안내합니다.

### ⚙️ 설정

- **다운로드 폴더 변경** — 폴더 브라우저에서 이동 후 `Enter`로 그 폴더 선택
- **언어 / Language** — 한국어 / English
- **여러 파일 전송 방식** — 각각 전송 / 하나의 zip으로 압축

설정은 아래 경로에 저장되어 다음 실행에도 유지됩니다.

| 플랫폼 | 설정 파일 |
| --- | --- |
| macOS | `~/Library/Application Support/tailtoss/config.json` |
| Linux | `$XDG_CONFIG_HOME/tailtoss/config.json` (기본 `~/.config/...`) |
| Windows | `%APPDATA%\tailtoss\config.json` |

## 개발

```bash
npm run dev      # tsx로 소스 직접 실행
npm run build    # dist/ 로 컴파일 + 실행권한 부여
npm run start    # 빌드 결과 실행
```

### 프로젝트 구조

```
src/
├── cli.tsx            # 진입점(셔뱅) · tailscale 종속성 점검 후 렌더
├── app.tsx            # 화면 라우팅 + 언어 컨텍스트
├── config.ts          # 설정 load/save (플랫폼별 경로)
├── i18n.ts            # UI 문자열 · 도움말 · 컨텍스트
├── tailscale.ts       # listTargets / sendPaths / receive · CLI 탐지
├── zip.ts             # 폴더/여러 항목 zip 압축 (Info-ZIP 또는 bsdtar)
└── components/
    ├── Frame.tsx          # 공통 프레임(타이틀 바 + 가로줄 + 도움말)
    ├── MainMenu.tsx
    ├── FileBrowser.tsx    # 방향키 탐색 + 다중 선택 (files/folder 모드)
    ├── TargetPicker.tsx   # --targets 목록에서 대상 선택
    ├── Send.tsx · Receive.tsx · Settings.tsx · Help.tsx
```

## 문제 해결

- **`tailscale CLI를 찾을 수 없습니다`** — tailscale을 설치하고 `tailscale status`가 동작하는지 확인하세요.
  `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin` 및 `PATH`에서 자동 탐지합니다.
- **Linux에서 받기 실패(권한)** — 화면에 안내된 `sudo tailscale file get ...` 명령을 터미널에서 실행하세요.
- **폴더/묶음 전송 시 `압축 도구를 찾을 수 없습니다`** — `zip`을 설치한 뒤(또는 `bsdtar`가 있는 환경에서)
  설정 › *압축 도구 설치 확인*으로 재감지하세요. 파일 1개 전송은 압축 도구 없이도 됩니다.
- **표(테두리)가 살짝 어긋나 보임** — 세로 테두리 없이 가로줄만 사용해 깨짐을 막았습니다.
  한글(폭 2) 렌더 폭 차이로 오른쪽 끝이 미세하게 다를 수 있으나 기능엔 영향 없습니다.
- **nvm 사용 시** — 전역 설치 위치가 현재 Node 버전의 bin이므로, `nvm use`로 버전을 바꾸면
  해당 버전에서 `npm link`(또는 `npm install -g .`)를 다시 실행하세요.

## 안내사항

[Tailscale](https://github.com/tailscale/tailscale)은 WireGuard 기반의 오픈소스 메시 VPN으로,
기기들을 하나의 사설 네트워크(*tailnet*)로 묶어 줍니다. **Taildrop**은 그 위에서 동작하는 기기 간
파일 전송 기능입니다.

Tailtoss는 **독립적인 비공식** 프런트엔드이며, Tailscale Inc.와 제휴하거나 인증받은 관계가
아닙니다. CLI 전체를 감싸는 도구가 아니라, Taildrop 파일 전송 명령(`tailscale file cp` /
`file get`)만 TUI로 다루고 나머지 CLI 기능은 건드리지 않습니다. 사용자가 직접 설치한 `tailscale`
실행 파일을 호출하므로, 그것이 없으면 동작하지 않으며 시작 시 이를 안내합니다.

## 라이선스

MIT
