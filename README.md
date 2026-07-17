**English** · [한국어](README.ko.md)

# taildrop-ui

**A clean terminal UI (TUI) for Tailscale's Taildrop.**
Built for people who send/receive files with the open-source `tailscale` CLI instead of a GUI client.
Pick files, choose a target device, and receive — all from the keyboard.

> Send/receive files over your tailnet from the terminal — file browser, device picker.
> Command: **`tdui`**.

```
 🚀 Taildrop  tailscale file transfer  › Menu
──────────────────────────────────────────────
What would you like to do?
Receive folder: /Users/you/Downloads

❯ 📤  Send files
  📥  Receive files
  ⚙️  Settings
  ❔  Help
  🚪  Quit
──────────────────────────────────────────────
↑↓ move · Enter select · Ctrl+C quit
```

---

## Why taildrop-ui

Taildrop is Tailscale's built-in way to move files between your own devices — no cloud, no
accounts. taildrop-ui exists to make it easy to *actually use*: a keyboard-driven terminal
UI over the `tailscale` CLI, so you don't have to memorize `tailscale file cp` flags or dig
up device names. Setup stays light — Node plus the `tailscale` CLI you already run, nothing
more.

On top of the basics, it adds things neither the official CLI nor the GUI offers:

- **Folder sending** — folders are zipped automatically before transfer (the CLI sends only files)
- **Free-form multi-select** — pick any mix of files and folders in one pass
- **Pre-send name checks** — names the receiver would reject (leading/trailing spaces,
over-long names, forbidden characters) are caught *before* sending, telling you which
file and why, instead of the bare "transfer failed" the official tools give you

## Features

- **Send files** — pick from the built-in file browser → choose an online device → transfer
  - Single file → sent as-is
  - Multiple files → **send each separately** or **bundle into one zip** (chosen in settings)
  - Folder → always compressed to `.zip` before sending
  - Target list is **auto-populated** via `tailscale file cp --targets` (online, receivable devices only)
- **Receive files** — save files from the staging inbox into your downloads folder
  - macOS (Homebrew tailscaled): usually saved as your user with **no sudo or auth needed** — but if a permission error occurs, follow the `sudo` command shown on screen
  - Linux and other permission-restricted setups: the required `sudo` command is shown on screen
  - Name collisions are auto-numbered via `--conflict=rename`
- **Settings** — downloads folder · language · multi-file transfer mode (all persisted for next run)
- **Help** — usage instructions available right on screen

## Supported platforms


| Platform    | Status            | Notes                                                                                                                                                                               |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **macOS**   | ✅ Fully supported | Receiving usually needs no sudo (Homebrew tailscaled); if a permission error occurs, the `sudo` command is shown                                                                    |
| **Linux**   | ✅ Supported       | Receiving may need `sudo` to access the root-owned inbox (command is shown)                                                                                                         |
| **Windows** | ⚠️ Experimental   | Paths/commands are handled, but testing focuses on macOS &amp; Linux. Folder/bundle sends rely on the built-in `tar.exe` (Windows 10 1803+); this path is untested on real hardware |


## Requirements

> **This tool targets the open-source `tailscale` / `tailscaled` (CLI + daemon).** It drives
> whatever `tailscale` binary is on your `PATH`, and the primary audience runs `tailscaled`
> themselves — the Homebrew build on macOS (`brew install tailscale`), or a native Linux
> install. The `tailscale` CLI bundled with the official macOS GUI client has also been
> confirmed to work here; that path is **not guaranteed**, and other platforms and
> distributions are untested. **`tailscaled` users are the intended target.**

- [Node.js](https://nodejs.org) **18+**
- **`tailscale` CLI** (open-source build, with `tailscaled` running) — if missing, the app shows install guidance and exits
  - macOS: `brew install tailscale`, then `sudo brew services start tailscale` to run
  `tailscaled` as a launchd service (auto-starts at boot — no need to launch it by hand),
  and `sudo tailscale up` to log in.
  See [Tailscaled on macOS](https://github.com/tailscale/tailscale/wiki/Tailscaled-on-macOS).
  - Linux: [https://tailscale.com/download/linux](https://tailscale.com/download/linux)
- **An archiver** — only needed for folder transfers / bundling multiple files into a zip.
Sending a single file never needs one. Either of these works, and the app picks
whichever it finds:
  - **`zip`** (Info-ZIP) — bundled with macOS; on Linux `sudo apt install zip`, etc.
  - **`bsdtar`** — libarchive's `tar`, which writes `.zip` directly. Bundled with macOS,
  and with Windows 10 1803+ / 11 as `tar.exe`. Note that **GNU tar cannot write zip**,
  so a Linux box with only GNU tar still needs `zip`.

  If neither is found the app warns on the menu (it does not block) and Settings ›
  *Check for archiver* re-detects after you install one — no restart needed.

> npm package dependencies (`ink`, `react`, `execa`, etc.) are handled by `npm install`.
> The required runtime tool (`tailscale`) is checked automatically at startup.

## Installation

Install from npm:

```bash
npm install -g taildrop-ui
```

Then run it **from any directory**:

```bash
tdui
```

To update later, run `npm install -g taildrop-ui@latest`.

### From source (for development)

```bash
git clone https://github.com/dooee/taildrop-ui.git
cd taildrop-ui
npm install          # install dependencies
npm run build        # compile to dist/
npm install -g .     # register the global `tdui` command
```

> `npm link` works too and gives you the exact same global `tdui` — only the linking differs:
> `npm install -g .` installs a **copied snapshot** of the build, while `npm link` **symlinks
> this working directory**. So if you plan to edit the source, prefer `npm link`: after
> `npm run build` your changes show up in `tdui` with no reinstall.

## Usage

Run `tdui` → move through the menu with the arrow keys, select with Enter.

### 📤 Send files

File browser controls:


| Key     | Action                                                                   |
| ------- | ------------------------------------------------------------------------ |
| `↑` `↓` | Move between items                                                       |
| `→`     | Enter folder                                                             |
| `←`     | Parent folder                                                            |
| `Space` | Select / deselect (multiple allowed)                                     |
| `Enter` | Start transfer (if nothing is selected, sends the item under the cursor) |
| `.`     | Toggle hidden files                                                      |
| `Esc`   | Cancel                                                                   |


Transfer rules:

- **Single file** → sent as-is
- **Multiple files** → *send each separately* or *bundle into one zip*, per settings
- **Folder** → always compressed to zip before sending

Then pick the target device from the list and it's sent.

### 📥 Receive files

Choosing `Receive files` pulls files from the inbox into your downloads folder.

> In a headless tailscaled setup, incoming files **do not pop up automatically** like the GUI app.
> Run `Receive` when you want them. If a permission error occurs (Linux, or occasionally macOS depending on your setup), the required `sudo` command is shown on screen.

### ⚙️ Settings

- **Change downloads folder** — navigate the folder browser, then `Enter` to select that folder
- **Language** — English / Korean
- **Multi-file transfer mode** — send each separately / bundle into one zip

Settings are saved to the paths below and persist across runs.


| Platform | Config file                                                           |
| -------- | --------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/taildrop-ui/config.json`              |
| Linux    | `$XDG_CONFIG_HOME/taildrop-ui/config.json` (default `~/.config/...`) |
| Windows  | `%APPDATA%\taildrop-ui\config.json`                                  |


## Development

```bash
npm run dev      # run the source directly with tsx
npm run build    # compile to dist/ + set executable bit
npm run start    # run the build output
```

### Project structure

```
src/
├── cli.tsx            # entry point (shebang) · renders after checking the tailscale dependency
├── app.tsx            # screen routing + language context
├── config.ts          # settings load/save (per-platform paths)
├── i18n.ts            # UI strings · help · context
├── tailscale.ts       # listTargets / sendPaths / receive · CLI detection
├── zip.ts             # zip compression (Info-ZIP or bsdtar) for folders / multiple items
└── components/
    ├── Frame.tsx          # shared frame (title bar + horizontal rule + help)
    ├── MainMenu.tsx
    ├── FileBrowser.tsx    # arrow-key navigation + multi-select (files/folder modes)
    ├── TargetPicker.tsx   # pick a target from the --targets list
    ├── Send.tsx · Receive.tsx · Settings.tsx · Help.tsx
```

## Troubleshooting

- **`tailscale CLI not found`** — install tailscale and confirm `tailscale status` works.
It's auto-detected from `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, and `PATH`.
- **Receive fails on Linux (permissions)** — run the `sudo tailscale file get ...` command shown on screen.
- **`No archiver found` on folder/bundle transfers** — install `zip` (or use a system with  
`bsdtar`), then re-detect via Settings › *Check for archiver*. Sending a single file  
works without any archiver.
- **When using nvm** — the global install lives in the current Node version's bin, so after `nvm use`
re-run `npm link` (or `npm install -g .`) on that version.

## Notes

[Tailscale](https://github.com/tailscale/tailscale) is an open-source, WireGuard-based mesh
VPN that links your devices into a private network (a *tailnet*). **Taildrop** is its
built-in device-to-device file transfer feature.

taildrop-ui is an **independent, unofficial** front-end — not affiliated with or endorsed
by Tailscale Inc. It isn't a full CLI wrapper: it drives only the Taildrop file-transfer
commands (`tailscale file cp` / `file get`) behind a TUI, leaving the rest of the CLI
alone. It shells out to a `tailscale` binary you install yourself, so without it the app
cannot run — and it says so at startup.

## License

MIT