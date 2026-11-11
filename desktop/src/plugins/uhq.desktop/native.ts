/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Writes UHQ's effects to EqualizerAPO\config\ultimecord-uhq.txt and adds one Include line to config.txt
// (a copy of the original is kept once as config.ultimecord-backup.txt).

import { execFile } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { existsSync } from "fs";
import { copyFile, readFile, writeFile } from "fs/promises";
import { join } from "path";

const FILE = "ultimecord-uhq.txt";
const INCLUDE = `Include: ${FILE}`;
const BACKUP = "config.ultimecord-backup.txt";
const REG = join(process.env.SystemRoot ?? "C:/Windows", "System32", "reg.exe");

function regInstallPath(): Promise<string | null> {
    return new Promise(resolve => {
        execFile(REG, ["query", "HKLM\\SOFTWARE\\EqualizerAPO", "/v", "InstallPath"], { windowsHide: true, timeout: 3000 }, (err, out) => {
            if (err) return resolve(null);
            const m = /InstallPath\s+REG_SZ\s+(.+)/.exec(out);
            resolve(m ? m[1].trim() : null);
        });
    });
}

async function configDir(): Promise<string | null> {
    if (process.platform !== "win32") return null;
    for (const d of [await regInstallPath(), join(process.env.ProgramFiles ?? "C:/Program Files", "EqualizerAPO")])
        if (d && existsSync(join(d, "config"))) return join(d, "config");
    return null;
}

export async function status(_: IpcMainInvokeEvent) {
    return { installed: (await configDir()) != null };
}

export async function apply(_: IpcMainInvokeEvent, text: string) {
    const dir = await configDir();
    if (!dir) throw new Error("Equalizer APO n'est pas installé");
    await writeFile(join(dir, FILE), text, "utf8");
    const path = join(dir, "config.txt");
    const cfg = await readFile(path, "utf8").catch(() => "");
    if (!cfg.split(/\r?\n/).some(l => l.trim() === INCLUDE)) {
        if (cfg && !existsSync(join(dir, BACKUP))) await copyFile(path, join(dir, BACKUP));
        await writeFile(path, `${cfg.replace(/\s*$/, "")}${cfg ? "\r\n" : ""}${INCLUDE}\r\n`, "utf8");
    }
}

export async function disable(_: IpcMainInvokeEvent) {
    const dir = await configDir();
    if (!dir) return;
    const path = join(dir, "config.txt");
    const cfg = await readFile(path, "utf8").catch(() => null);
    if (cfg != null) await writeFile(path, cfg.split(/\r?\n/).filter(l => l.trim() !== INCLUDE).join("\r\n"), "utf8");
}
