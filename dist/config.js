import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { isLang } from './i18n.js';
function xdgConfigHome(home) {
    return process.env.XDG_CONFIG_HOME || path.join(home, '.config');
}
function configDir() {
    const home = os.homedir();
    if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'tailtoss');
    }
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'tailtoss');
    }
    return path.join(xdgConfigHome(home), 'tailtoss');
}
function linuxDownloadDir(home) {
    const fallback = path.join(home, 'Downloads');
    try {
        const raw = fs.readFileSync(path.join(xdgConfigHome(home), 'user-dirs.dirs'), 'utf8');
        let last = null;
        for (const line of raw.split('\n')) {
            const m = /^\s*XDG_DOWNLOAD_DIR\s*=\s*"(.*)"\s*$/.exec(line);
            if (m?.[1] !== undefined)
                last = m[1];
        }
        if (last === null)
            return fallback;
        const expanded = last.startsWith('$HOME/')
            ? path.join(home, last.slice('$HOME/'.length))
            : last;
        const dir = expanded.replace(/\\(.)/g, '$1');
        if (!path.isAbsolute(dir))
            return fallback;
        if (path.resolve(dir) === path.resolve(home))
            return fallback;
        return dir;
    }
    catch {
        return fallback;
    }
}
const CONFIG_PATH = path.join(configDir(), 'config.json');
export function defaultConfig() {
    const home = os.homedir();
    return {
        downloadDir: process.platform === 'darwin' || process.platform === 'win32'
            ? path.join(home, 'Downloads')
            : linuxDownloadDir(home),
        lang: 'en',
        bundleMultiple: false,
    };
}
export function loadConfig() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        const base = defaultConfig();
        const merged = { ...base, ...parsed };
        if (!isLang(merged.lang))
            merged.lang = base.lang;
        return merged;
    }
    catch {
        return defaultConfig();
    }
}
export function saveConfig(config) {
    fs.mkdirSync(configDir(), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}
export function configPath() {
    return CONFIG_PATH;
}
