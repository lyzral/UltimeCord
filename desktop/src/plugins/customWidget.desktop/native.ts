/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Custom Widget: fills a Game Stats Widget on your profile through Discord's official Application Identity Profile API
// (https://docs.discord.com/developers/resources/application-identity-profile). Needs your own application, with the
// Social SDK on, the game claimed and the widget laid out in the Developer Portal. The bot token never leaves this PC
// except to discord.com.

import { IpcMainInvokeEvent } from "electron";

const API = "https://discord.com/api/v10";
const SNOWFLAKE = /^\d{17,20}$/;

export interface Result { ok: boolean; status: number; body: any; }

async function call(method: "GET" | "PATCH", appId: string, botToken: string, userId: string, body?: unknown): Promise<Result> {
    if (!SNOWFLAKE.test(appId) || !SNOWFLAKE.test(userId)) return { ok: false, status: 0, body: "ID d'appli ou d'utilisateur invalide" };
    if (!botToken || /\s/.test(botToken.trim())) return { ok: false, status: 0, body: "Token du bot manquant" };

    const res = await fetch(`${API}/applications/${appId}/users/${userId}/identities/${userId}/profile`, {
        method,
        headers: {
            Authorization: `Bot ${botToken.trim().replace(/^Bot\s+/i, "")}`,
            "Content-Type": "application/json",
            "User-Agent": "DiscordBot (https://github.com/lyzral/UltimeCord, 1.0)",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { }
    return { ok: res.ok, status: res.status, body: parsed };
}

export function publish(_: IpcMainInvokeEvent, appId: string, botToken: string, userId: string, payload: unknown) {
    return call("PATCH", appId, botToken, userId, payload);
}

export function read(_: IpcMainInvokeEvent, appId: string, botToken: string, userId: string) {
    return call("GET", appId, botToken, userId);
}

// ---------- account authorization ----------
// Discord only lets the bot write to your profile once your account has authorized the app with the
// application_identities.write scope, and that grant exists once the OAuth2 code is exchanged. A one-shot listener on
// 127.0.0.1 catches the code, swaps it with the app's client secret, and closes.

const REDIRECT_PORT = 53134;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;

let pending: Promise<Result> | null = null;

export function authorize(_: IpcMainInvokeEvent, appId: string, clientSecret: string): Promise<Result> {
    if (!SNOWFLAKE.test(appId)) return Promise.resolve({ ok: false, status: 0, body: "ID d'appli invalide" });
    if (!clientSecret?.trim()) return Promise.resolve({ ok: false, status: 0, body: "Client secret manquant (OAuth2 › Client Secret)" });
    if (pending) return pending;

    const { createServer } = require("http") as typeof import("http");
    const { shell } = require("electron") as typeof import("electron");
    const state = Math.random().toString(36).slice(2);

    pending = new Promise<Result>(resolve => {
        const page = (title: string, text: string) =>
            `<!doctype html><meta charset="utf-8"><body style="background:#0e0e12;color:#eee;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>${title}</h2><p style="color:#999">${text}</p></div>`;
        const finish = (r: Result) => { clearTimeout(timer); server.close(); pending = null; resolve(r); };

        const server = createServer(async (req, res) => {
            const url = new URL(req.url ?? "/", REDIRECT_URI);
            if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
            const code = url.searchParams.get("code");
            if (!code || url.searchParams.get("state") !== state) {
                res.writeHead(400, { "Content-Type": "text/html" }).end(page("Autorisation annulée", "Tu peux fermer cet onglet."));
                return finish({ ok: false, status: 400, body: url.searchParams.get("error_description") ?? "Autorisation annulée" });
            }
            try {
                const tok = await fetch(`${API}/oauth2/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: appId, client_secret: clientSecret.trim() }),
                });
                const body = await tok.json().catch(() => null);
                const ok = tok.ok && !!body?.access_token;
                res.writeHead(200, { "Content-Type": "text/html" }).end(ok
                    ? page("Compte autorisé ✓", "Retourne dans Discord et clique « Publier ».")
                    : page("Échec", body?.error_description ?? "Discord a refusé l'échange."));
                finish({ ok, status: tok.status, body: ok ? { scope: body.scope } : body });
            } catch (e) {
                res.writeHead(500).end();
                finish({ ok: false, status: 0, body: String(e) });
            }
        });
        const timer = setTimeout(() => finish({ ok: false, status: 0, body: "Délai dépassé (5 min)" }), 5 * 60_000);
        server.on("error", e => finish({ ok: false, status: 0, body: `Port ${REDIRECT_PORT} occupé : ${e.message}` }));
        server.listen(REDIRECT_PORT, "127.0.0.1", () => {
            shell.openExternal(`https://discord.com/oauth2/authorize?client_id=${appId}&response_type=code&scope=application_identities.write&prompt=consent&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
        });
    });
    return pending;
}
