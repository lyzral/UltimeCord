/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// License keys are signed offline with Sei's ECDSA P-256 private key, which only lives on Sei's PC
// (%APPDATA%\UltimeCord\owner\license-ec-private.pem). A key is locked to one PC (its "code PC", hw) and can be
// revoked through revoked.json on GitHub. ultimecord.exe and this plugin read the same %APPDATA%\UltimeCord\license.key.
// Format: UC2.<base64url payload>.<base64url r||s signature>

import { execFileSync } from "child_process";
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from "crypto";
import { app, IpcMainInvokeEvent, net } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const PUBLIC_KEY = createPublicKey(`-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAExaCi140nyu0aCVqcLQzv/LYpcyVw
vrzgtkwn3gW2j8+r2xXPbCy7ND9gUg5ee+gUCeZd14rvB4KmXVFYAXfEeA==
-----END PUBLIC KEY-----`);

const REVOKED_URL = "https://raw.githubusercontent.com/lyzral/ultimecord-licenses/main/revoked.json";

const appDataDir = () => process.env.APPDATA ?? app.getPath("appData");
const LICENSE_PATH = () => join(appDataDir(), "UltimeCord", "license.key");

// Looked up on every call: Discord can move its own paths around while it starts
function privateKeyPath(): string | null {
    const candidates = [
        process.env.DATA_DIR && join(process.env.DATA_DIR, "owner", "license-ec-private.pem"),
        process.env.APPDATA && join(process.env.APPDATA, "UltimeCord", "owner", "license-ec-private.pem"),
        join(app.getPath("appData"), "UltimeCord", "owner", "license-ec-private.pem"),
        join(app.getPath("home"), "AppData", "Roaming", "UltimeCord", "owner", "license-ec-private.pem"),
    ].filter(Boolean) as string[];
    return candidates.find(p => existsSync(p)) ?? null;
}

export interface LicensePayload {
    /** short random id, to tell keys apart (and revoke them) */
    id: string;
    /** issued at, ms */
    iat: number;
    /** expires at, ms; 0 = never */
    exp: number;
    /** code PC the key is locked to; empty = any PC */
    hw: string;
    note: string;
}

const b64u = (b: Buffer) => b.toString("base64url");

// ---------- code PC (same algorithm in ultimecord.exe and install.sh) ----------

function machineId(): string {
    try {
        if (process.platform === "win32") {
            const reg = join(process.env.SystemRoot ?? "C:/Windows", "System32", "reg.exe");
            const out = execFileSync(reg, ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid", "/reg:64"], { windowsHide: true, timeout: 3000 }).toString();
            const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(out);
            if (m) return m[1].toLowerCase();
        } else {
            for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"])
                if (existsSync(p)) return readFileSync(p, "utf8").trim().toLowerCase();
        }
    } catch { }
    return "";
}

function hwidOf(id: string) {
    const h = createHash("sha256").update(`UC-HW:${id}`).digest("hex").slice(0, 16).toUpperCase();
    return h.match(/.{4}/g)!.join("-");
}

let cachedHw = "";
export function getHwid(_?: IpcMainInvokeEvent) {
    if (!cachedHw) { const id = machineId(); cachedHw = id ? hwidOf(id) : ""; }
    return cachedHw;
}

// ---------- revocation list ----------

export async function fetchRevoked(_?: IpcMainInvokeEvent): Promise<{ ok: boolean; ids: string[]; }> {
    try {
        const res = await net.fetch(`${REVOKED_URL}?t=${Date.now()}`, { signal: AbortSignal.timeout(5000) as any });
        if (res.status === 404) return { ok: true, ids: [] };
        if (!res.ok) return { ok: false, ids: [] };
        const j = await res.json();
        return { ok: true, ids: Array.isArray(j?.revoked) ? j.revoked.map(String) : [] };
    } catch {
        return { ok: false, ids: [] };
    }
}

// ---------- checking ----------

export type Check = { ok: true; payload: LicensePayload; } | { ok: false; error: string; };

function verifyKey(key: string, hw: string, revoked: string[]): Check {
    try {
        const parts = String(key || "").trim().split(".");
        if (parts.length !== 3 || parts[0] !== "UC2") return { ok: false, error: "Clé invalide" };
        const body = Buffer.from(parts[1], "base64url");
        const sig = Buffer.from(parts[2], "base64url");
        if (!verify("sha256", body, { key: PUBLIC_KEY, dsaEncoding: "ieee-p1363" }, sig)) return { ok: false, error: "Clé invalide" };
        const payload = JSON.parse(body.toString("utf8")) as LicensePayload;
        if (payload.exp && Date.now() > payload.exp) return { ok: false, error: "Clé expirée" };
        if (payload.hw && payload.hw !== hw) return { ok: false, error: "Cette clé est liée à un autre PC" };
        if (revoked.includes(payload.id)) return { ok: false, error: "Cette clé a été révoquée" };
        return { ok: true, payload };
    } catch {
        return { ok: false, error: "Clé invalide" };
    }
}

export async function checkKey(_: IpcMainInvokeEvent, key: string): Promise<Check> {
    const rev = await fetchRevoked();
    return verifyKey(key, getHwid(), rev.ids);
}

/** The key saved by ultimecord.exe or by Discord's key screen, checked on this PC */
export async function checkSaved(_: IpcMainInvokeEvent): Promise<Check & { hw: string; }> {
    const hw = getHwid();
    let key = "";
    try { key = readFileSync(LICENSE_PATH(), "utf8"); } catch { }
    if (!key.trim()) return { ok: false, error: "", hw };
    const rev = await fetchRevoked();
    return { ...verifyKey(key, hw, rev.ids), hw };
}

export function saveKey(_: IpcMainInvokeEvent, key: string) {
    const p = LICENSE_PATH();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, String(key).trim());
}

// ---------- owner ----------

export function canSign(_: IpcMainInvokeEvent) {
    return privateKeyPath() != null;
}

export function makeKeys(_: IpcMainInvokeEvent, count: number, days: number, hw: string, note: string) {
    const path = privateKeyPath();
    if (!path) throw new Error("Clé privée introuvable sur ce PC");
    const priv = createPrivateKey(readFileSync(path, "utf8"));
    const n = Math.max(1, Math.min(50, Math.floor(count) || 1));
    const code = String(hw || "").trim().toUpperCase();
    const out: { key: string; payload: LicensePayload; }[] = [];
    for (let i = 0; i < n; i++) {
        const payload: LicensePayload = {
            id: b64u(randomBytes(6)),
            iat: Date.now(),
            exp: days > 0 ? Date.now() + days * 86400000 : 0,
            hw: /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(code) ? code : "",
            note: String(note || "").slice(0, 80)
        };
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        out.push({ key: `UC2.${b64u(body)}.${b64u(sign("sha256", body, { key: priv, dsaEncoding: "ieee-p1363" }))}`, payload });
    }
    return out;
}
