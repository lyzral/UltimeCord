/*
 * Ultime Cord, a Discord client mod
 * Ultime Script — by sei. The terminal script, as a plugin: same pixel scene, same account tools, but it runs on your
 * Discord session (no token to paste) and only ever touches your own account.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore, RestAPI, SelectedChannelStore, UserStore, useEffect, useRef, useState } from "@webpack/common";

import { cfg, Scene } from "./scene";

const THEMES = ["enfer", "braises", "soufre", "cendres", "monochrome", "paradis"];
const WEATHERS = ["orage de feu", "pluie de cendres", "tempête de braises", "cendres et braises", "calme"];

const settings = definePluginSettings({
    theme: { type: OptionType.NUMBER, description: "Thème", default: 0, hidden: true },
    weather: { type: OptionType.NUMBER, description: "Météo", default: 1, hidden: true },
    lightning: { type: OptionType.NUMBER, description: "Éclairs", default: 5, hidden: true },
    look: { type: OptionType.STRING, description: "Affichage", default: "tui", hidden: true },
});

// ---------- Discord API, paced like the script (130 ms between calls, waits on rate limits) ----------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let last = 0;
let stopRequested = false;

async function call<T = any>(method: "get" | "post" | "del", url: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        const gap = 130 - (Date.now() - last);
        if (gap > 0) await sleep(gap);
        last = Date.now();
        try {
            const res = await (RestAPI as any)[method]({ url, body, oldFormErrors: true });
            return res?.body as T;
        } catch (e: any) {
            if (e?.status === 429 && attempt < 8) { await sleep(Math.ceil((e.body?.retry_after ?? 1) * 1000) + 150); continue; }
            if (e?.status >= 500 && attempt < 3) { await sleep(800 * (attempt + 1)); continue; }
            throw e;
        }
    }
}

type Progress = (done: number, total: number, line: string) => void;

async function purgeChannel(id: string, tick: (n: number) => void) {
    const me = UserStore.getCurrentUser().id;
    let n = 0, before: string | null = null;
    for (let guard = 0; guard < 4000 && !stopRequested; guard++) {
        const msgs = await call<any[]>("get", `/channels/${id}/messages?limit=100${before ? `&before=${before}` : ""}`).catch(() => null);
        if (!Array.isArray(msgs) || !msgs.length) break;
        before = msgs[msgs.length - 1].id;
        for (const m of msgs) {
            if (stopRequested) break;
            if (m.author?.id !== me || m.type > 0 && m.type !== 19) continue;
            try { await call("del", `/channels/${id}/messages/${m.id}`); n++; tick(n); } catch { }
        }
        if (msgs.length < 100) break;
    }
    return n;
}

async function purgeGuild(guildId: string, p: Progress) {
    const chans = await call<any[]>("get", `/guilds/${guildId}/channels`);
    const list = chans.filter(c => c.type === 0 || c.type === 5);
    let total = 0;
    for (let i = 0; i < list.length && !stopRequested; i++) {
        const name = `#${list[i].name}`;
        p(i, list.length, name);
        try { total += await purgeChannel(list[i].id, n => p(i, list.length, `${name} — ${n}`)); } catch { }
    }
    return total;
}

async function closeAllDMs(p: Progress) {
    const list = (await call<any[]>("get", "/users/@me/channels")).filter(c => c.type === 1 || c.type === 3);
    let n = 0;
    for (let i = 0; i < list.length && !stopRequested; i++) {
        p(i, list.length, list[i].type === 1 ? "mp" : "groupe");
        try { await call("del", `/channels/${list[i].id}`); n++; } catch { }
    }
    return n;
}

async function removeAllFriends(p: Progress) {
    const list = (await call<any[]>("get", "/users/@me/relationships")).filter(r => r.type === 1);
    let n = 0;
    for (let i = 0; i < list.length && !stopRequested; i++) {
        const u = list[i].user ?? {};
        p(i, list.length, u.username ?? list[i].id);
        try { await call("del", `/users/@me/relationships/${u.id ?? list[i].id}`); n++; } catch { }
    }
    return n;
}

async function leaveAllGuilds(p: Progress) {
    const gs = await call<any[]>("get", "/users/@me/guilds");
    let n = 0;
    for (let i = 0; i < gs.length && !stopRequested; i++) {
        p(i, gs.length, gs[i].name);
        if (gs[i].owner) continue; // you can't leave a server you own
        try { await call("del", `/users/@me/guilds/${gs[i].id}`, { lurking: false }); n++; } catch { }
    }
    return n;
}

async function createGuilds(count: number, pattern: string, p: Progress) {
    const gs = await call<any[]>("get", "/users/@me/guilds");
    const n = Math.min(count, Math.max(0, 100 - gs.length), 75);
    let made = 0;
    for (let i = 0; i < n && !stopRequested; i++) {
        const name = pattern.replace("%d", String(i + 1));
        try { await call("post", "/guilds", { name, channels: [] }); made++; p(made, n, name); }
        catch (e: any) { if (e?.body?.code === 30001) { p(made, n, "limite du compte atteinte"); break; } }
    }
    return made;
}

async function addBotEverywhere(clientId: string, perms: string, p: Progress) {
    const ADMIN = 8n, MANAGE = 32n;
    const has = (v: string, b: bigint) => { try { return (BigInt(v || "0") & b) === b; } catch { return false; } };
    const gs = (await call<any[]>("get", "/users/@me/guilds")).filter(g => g.owner || has(g.permissions, ADMIN) || has(g.permissions, MANAGE));
    let ok = 0;
    const q = `?client_id=${clientId}&response_type=code&scope=${encodeURIComponent("bot applications.commands")}`;
    for (let i = 0; i < gs.length && !stopRequested; i++) {
        p(i, gs.length, gs[i].name);
        try { await call("post", `/oauth2/authorize${q}`, { guild_id: gs[i].id, permissions: perms, authorize: true, integration_type: 0 }); ok++; } catch { }
    }
    return ok;
}

// ---------- the page ----------

function SceneCanvas() {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current!;
        const ctx = canvas.getContext("2d")!;
        cfg.skipIntro = false;
        const scene: any = new Scene();
        let img: ImageData | null = null;
        const fit = () => {
            const r = canvas.getBoundingClientRect();
            const cols = Math.max(90, Math.min(260, Math.round(r.width / 5)));
            const rows = Math.max(36, Math.round(cols * r.height / r.width / 2));
            scene.resize(cols, rows);
            canvas.width = scene.PW; canvas.height = scene.PH;
            img = ctx.createImageData(scene.PW, scene.PH);
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(canvas);
        let raf = 0, prev = performance.now();
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame);
            const dt = Math.min(0.1, (now - prev) / 1000);
            if (dt < 1 / 40) return;
            prev = now;
            cfg.theme = settings.store.theme; cfg.weather = settings.store.weather; cfg.lightning = settings.store.lightning;
            if ((scene as any)._theme !== cfg.theme) { scene.setTheme(cfg.theme); (scene as any)._theme = cfg.theme; }
            scene.update(dt);
            scene.compose();
            const px = scene.pix as Int32Array, d = img!.data;
            for (let i = 0, j = 0; i < px.length; i++, j += 4) {
                const c = px[i];
                d[j] = (c >> 16) & 255; d[j + 1] = (c >> 8) & 255; d[j + 2] = c & 255; d[j + 3] = 255;
            }
            ctx.putImageData(img!, 0, 0);
        };
        raf = requestAnimationFrame(frame);
        return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }, []);
    return <canvas ref={ref} className="enfer-canvas" />;
}

type Job = { title: string; run(p: Progress): Promise<string>; confirm?: string; };

function EnferPage() {
    const s = settings.use(["theme", "weather", "lightning", "look"]);
    const glass = s.look === "glass";
    const [busy, setBusy] = useState(false);
    const [prog, setProg] = useState<{ done: number; total: number; line: string; } | null>(null);
    const [note, setNote] = useState("");
    const [confirm, setConfirm] = useState<Job | null>(null);
    const [typed, setTyped] = useState("");
    const [guild, setGuild] = useState("");
    const [count, setCount] = useState(5);
    const [pattern, setPattern] = useState("serveur %d");
    const [botUrl, setBotUrl] = useState("");

    const guilds = Object.values(GuildStore.getGuilds()).sort((a: any, b: any) => a.name.localeCompare(b.name)) as any[];

    const start = async (job: Job) => {
        setConfirm(null); setTyped(""); stopRequested = false; setBusy(true); setNote("");
        setProg({ done: 0, total: 0, line: job.title });
        try { setNote(await job.run((done, total, line) => setProg({ done, total, line }))); }
        catch (e: any) { setNote(`erreur : ${e?.body?.message ?? e?.message ?? e}`); }
        finally { setBusy(false); setProg(null); }
    };
    const ask = (job: Job) => job.confirm ? setConfirm(job) : start(job);

    const jobs: Job[] = [
        { title: "Purger mes messages ici", run: async p => { const id = SelectedChannelStore.getChannelId(); if (!id) return "ouvre d'abord une conversation"; return `${await purgeChannel(id, n => p(n, 0, `${n} supprimés`))} messages supprimés`; }, confirm: "PURGER" },
        { title: "Fermer toutes les MP", run: async p => `${await closeAllDMs(p)} conversations fermées`, confirm: "FERMER" },
        { title: "Retirer tous les amis", run: async p => `${await removeAllFriends(p)} amis retirés`, confirm: "RETIRER" },
        { title: "Quitter tous les serveurs", run: async p => `${await leaveAllGuilds(p)} serveurs quittés (ceux que tu possèdes restent)`, confirm: "QUITTER" },
    ];

    const pct = prog && prog.total ? Math.round(prog.done / prog.total * 100) : null;

    return (
        <div className={`enfer ${glass ? "glass" : ""} ${s.theme === 5 ? "paradis" : ""}`}>
            {!glass && <SceneCanvas />}
            <div className="enfer-ui">
                <div className="enfer-panel">
                    <div className="enfer-title">{glass ? "Ultime Script" : "U L T I M E   S C R I P T"}</div>
                    <div className="enfer-sub">tout passe par ta session — seul ton compte est touché</div>

                    <div className="enfer-list">
                        {jobs.map(j => <button key={j.title} disabled={busy} className="enfer-row" onClick={() => ask(j)}>{j.title}</button>)}

                        <div className="enfer-group">
                            <select value={guild} disabled={busy} onChange={e => setGuild(e.currentTarget.value)}>
                                <option value="">— choisir un serveur —</option>
                                {guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <button className="enfer-row" disabled={busy || !guild} onClick={() => ask({ title: "Purger mes messages du serveur", confirm: "PURGER", run: async p => `${await purgeGuild(guild, p)} messages supprimés` })}>Purger mes messages du serveur</button>
                        </div>

                        <div className="enfer-group">
                            <input type="number" min={1} max={75} value={count} disabled={busy} onChange={e => setCount(Math.max(1, Math.min(75, Number(e.currentTarget.value) || 1)))} />
                            <input value={pattern} disabled={busy} onChange={e => setPattern(e.currentTarget.value)} placeholder="nom (%d = numéro)" />
                            <button className="enfer-row" disabled={busy} onClick={() => start({ title: "Créer des serveurs", run: async p => `${await createGuilds(count, pattern || "serveur %d", p)} serveurs créés` })}>Créer</button>
                        </div>

                        <div className="enfer-group">
                            <input value={botUrl} disabled={busy} onChange={e => setBotUrl(e.currentTarget.value)} placeholder="lien d'invitation du bot ou son id" />
                            <button className="enfer-row" disabled={busy || !botUrl} onClick={() => {
                                const id = /client_id=(\d{15,25})/.exec(botUrl)?.[1] ?? /^\s*(\d{15,25})\s*$/.exec(botUrl)?.[1];
                                const perms = /permissions=(\d+)/.exec(botUrl)?.[1] ?? "0";
                                if (!id) return setNote("lien de bot invalide");
                                ask({ title: "Inviter le bot partout où tu gères", confirm: "INVITER", run: async p => `bot ajouté sur ${await addBotEverywhere(id, perms, p)} serveurs` });
                            }}>Inviter partout</button>
                        </div>
                    </div>

                    {prog && (
                        <div className="enfer-prog">
                            <div className="enfer-bar"><i style={{ width: pct == null ? "100%" : `${pct}%` }} className={pct == null ? "indet" : ""} /></div>
                            <div className="enfer-line">{prog.line}{pct != null && ` · ${prog.done}/${prog.total}`}</div>
                            <button className="enfer-stop" onClick={() => { stopRequested = true; }}>arrêter</button>
                        </div>
                    )}
                    {note && <div className="enfer-note">{note}</div>}

                    <div className="enfer-opts">
                        <label>affichage<select value={s.look} onChange={e => settings.store.look = e.currentTarget.value}><option value="tui">TUI (décor pixel)</option><option value="glass">Glass Fluid</option></select></label>
                        <label>thème<select value={s.theme} onChange={e => settings.store.theme = Number(e.currentTarget.value)}>{THEMES.map((t, i) => <option key={t} value={i}>{t}</option>)}</select></label>
                        <label>météo<select value={s.weather} onChange={e => settings.store.weather = Number(e.currentTarget.value)}>{WEATHERS.map((w, i) => <option key={w} value={i}>{w}</option>)}</select></label>
                        <label>éclairs<input type="range" min={1} max={10} value={s.lightning} onChange={e => settings.store.lightning = Number(e.currentTarget.value)} /></label>
                    </div>
                </div>
            </div>

            {confirm && (
                <div className="enfer-confirm">
                    <div className="enfer-panel">
                        <div className="enfer-title">{confirm.title.toUpperCase()}</div>
                        <div className="enfer-sub">c'est définitif. tape <b>{confirm.confirm}</b> pour lancer.</div>
                        <input autoFocus value={typed} onChange={e => setTyped(e.currentTarget.value)} />
                        <div className="enfer-actions">
                            <button className="enfer-row" onClick={() => { setConfirm(null); setTyped(""); }}>annuler</button>
                            <button className="enfer-row danger" disabled={typed !== confirm.confirm} onClick={() => start(confirm)}>lancer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const ENTRY = "ultimecord_ultime_script";

function FlameIcon(props: any) {
    return (
        <svg width={props.width ?? 20} height={props.height ?? 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" />
        </svg>
    );
}

export default definePlugin({
    name: "UltimeScript",
    description: "Ultime Script : décor pixel animé (enfer, paradis…) ou panneau Glass Fluid, + outils du compte (purge de tes messages, fermer les MP, retirer les amis, quitter les serveurs, créer des serveurs, inviter un bot). Fait par sei.",
    tags: ["Utility", "Appearance"],
    authors: [Devs.Sei],
    settings,
    enabledByDefault: true,
    start() {
        if (!SettingsPlugin.customEntries.some(e => e.key === ENTRY))
            SettingsPlugin.customEntries.push({ key: ENTRY, title: "Ultime Script", panelTitle: "Ultime Script", Component: EnferPage, Icon: FlameIcon });
    },
    stop() {
        const i = SettingsPlugin.customEntries.findIndex(e => e.key === ENTRY);
        if (i >= 0) SettingsPlugin.customEntries.splice(i, 1);
    },
});
