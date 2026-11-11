/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Every launch checks the license key ultimecord.exe saved: right signature, not expired, made for this PC (code PC)
// and not in revoked.json on GitHub. If it fails, Discord shows the key screen. Sei's account never needs a key, and
// only Sei's account sees the owner panel that makes and revokes keys.

import "./styles.css";

import * as DataStore from "@api/DataStore";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";
import { AuthenticationStore, createRoot, FluxDispatcher, UserStore, useEffect, useState } from "@webpack/common";

import type { LicensePayload } from "./native";

const Native = EndcordNative.pluginHelpers.UltimeLicense as PluginNative<typeof import("./native")>;

export const OWNER_ID = "1564763248484425800";
const HISTORY_KEY = "ultimecord_owner_keys";
const REVOKED_KEY = "ultimecord_owner_revoked";
const ENTRY = "ultimecord_owner_panel";
const REPO_URL = "https://github.com/lyzral/ultimecord-licenses";

const isOwner = () => {
    try { return UserStore.getCurrentUser()?.id === OWNER_ID || AuthenticationStore.getId?.() === OWNER_ID; } catch { return false; }
};
const loggedIn = () => {
    try { return !!(UserStore.getCurrentUser()?.id ?? AuthenticationStore.getId?.()); } catch { return false; }
};

const fmtDate = (ms: number) => ms ? new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "à vie";
const copy = (text: string) => navigator.clipboard.writeText(text);

// ---------- key screen ----------

let gateHost: HTMLDivElement | null = null;
let gateRoot: ReturnType<typeof createRoot> | null = null;

function closeGate() {
    gateRoot?.unmount();
    gateHost?.remove();
    gateRoot = null;
    gateHost = null;
}

function openGate(reason: string, hw: string) {
    if (gateHost) return;
    gateHost = document.createElement("div");
    gateHost.className = "ucl-gate-root";
    document.body.appendChild(gateHost);
    gateRoot = createRoot(gateHost);
    gateRoot.render(<Gate reason={reason} hw={hw} />);
}

function Gate({ reason, hw }: { reason: string; hw: string; }) {
    const [key, setKey] = useState("");
    const [error, setError] = useState(reason);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    const submit = async () => {
        setBusy(true); setError("");
        const r = await Native.checkKey(key);
        if (!r.ok) { setError(r.error); setBusy(false); return; }
        await Native.saveKey(key);
        closeGate();
    };

    return (
        <div className="ucl-gate">
            <div className="ucl-card">
                <div className="ucl-brand">ULTIME CORD</div>
                <h1>Clé de licence</h1>
                <p>Ultime Cord a besoin d'une clé faite pour ce PC. Envoie ton code PC à Sei, puis colle la clé qu'il te donne.</p>
                <div className="ucl-hw">
                    <span>Code PC</span>
                    <code>{hw || "introuvable"}</code>
                    <button onClick={() => { copy(hw); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? "copié" : "copier"}</button>
                </div>
                <input
                    autoFocus
                    value={key}
                    placeholder="UC2.xxxxxxxx.xxxxxxxx"
                    onChange={e => setKey(e.currentTarget.value)}
                    onKeyDown={e => { if (e.key === "Enter" && key.trim()) submit(); }}
                />
                {error && <div className="ucl-error">{error}</div>}
                <button className="ucl-primary" disabled={busy || !key.trim()} onClick={submit}>{busy ? "Vérification…" : "Activer"}</button>
                <div className="ucl-foot">Pas de clé ? Demande à Sei · github.com/lyzral</div>
            </div>
        </div>
    );
}

let checking = false;
async function enforce() {
    if (!loggedIn() || checking) return; // login screen: checked again once logged in
    if (isOwner()) { closeGate(); addOwnerEntry(); return; }
    checking = true;
    try {
        const r = await Native.checkSaved();
        if (r.ok) closeGate(); else openGate(r.error, r.hw);
    } finally { checking = false; }
}

// ---------- owner panel ----------

interface Made { key: string; payload: LicensePayload; }

const DURATIONS = [
    { label: "1 jour", days: 1 }, { label: "7 jours", days: 7 }, { label: "30 jours", days: 30 },
    { label: "90 jours", days: 90 }, { label: "1 an", days: 365 }, { label: "À vie", days: 0 },
];

const revokedJson = (ids: string[]) => JSON.stringify({ revoked: ids }, null, 2) + "\n";

function OwnerPanel() {
    const [canSign, setCanSign] = useState<boolean | null>(null);
    const [days, setDays] = useState(30);
    const [count, setCount] = useState(1);
    const [hw, setHw] = useState("");
    const [note, setNote] = useState("");
    const [made, setMade] = useState<Made[]>([]);
    const [history, setHistory] = useState<Made[]>([]);
    const [revoked, setRevoked] = useState<string[]>([]);
    const [online, setOnline] = useState<{ ok: boolean; ids: string[]; } | null>(null);
    const [copied, setCopied] = useState("");

    useEffect(() => {
        Native.canSign().then(setCanSign);
        DataStore.get<Made[]>(HISTORY_KEY).then(h => setHistory((h ?? []).filter(m => m.key.startsWith("UC2."))));
        DataStore.get<string[]>(REVOKED_KEY).then(r => setRevoked(r ?? []));
        Native.fetchRevoked().then(setOnline);
    }, []);

    if (!isOwner()) return <div className="ucl-panel"><p>Réservé au propriétaire.</p></div>;

    const hwOk = /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(hw.trim().toUpperCase());
    const flash = (t: string) => { setCopied(t); setTimeout(() => setCopied(""), 1200); };

    const generate = async () => {
        const keys = await Native.makeKeys(count, days, hw, note);
        setMade(keys);
        const next = [...keys, ...history].slice(0, 500);
        setHistory(next);
        await DataStore.set(HISTORY_KEY, next);
    };
    const toggleRevoke = async (id: string) => {
        const next = revoked.includes(id) ? revoked.filter(x => x !== id) : [...revoked, id];
        setRevoked(next);
        await DataStore.set(REVOKED_KEY, next);
    };
    const forget = async (id: string) => {
        const next = history.filter(h => h.payload.id !== id);
        setHistory(next);
        await DataStore.set(HISTORY_KEY, next);
    };
    const pending = online?.ok ? revoked.some(id => !online.ids.includes(id)) || online.ids.some(id => !revoked.includes(id)) : true;

    return (
        <div className="ucl-panel">
            <div className="ucl-head">
                <div>
                    <div className="ucl-brand">PANEL OWNER</div>
                    <h2>Clés de licence</h2>
                </div>
                <span className={`ucl-badge ${canSign ? "ok" : ""}`}>{canSign == null ? "…" : canSign ? "clé privée trouvée" : "clé privée absente"}</span>
            </div>

            {canSign === false && <div className="ucl-error">La clé privée n'est pas sur ce PC (%APPDATA%\UltimeCord\owner\license-ec-private.pem) : impossible de générer des clés ici.</div>}

            <div className="ucl-section">Durée</div>
            <div className="ucl-pills">
                {DURATIONS.map(d => <button key={d.days} className={`ucl-pill ${days === d.days ? "on" : ""}`} onClick={() => setDays(d.days)}>{d.label}</button>)}
            </div>

            <div className="ucl-grid">
                <label>Code PC de la personne<input value={hw} placeholder="XXXX-XXXX-XXXX-XXXX" onChange={e => setHw(e.currentTarget.value.toUpperCase())} /></label>
                <label>Note<input value={note} placeholder="pour qui ?" onChange={e => setNote(e.currentTarget.value)} /></label>
                <label>Nombre<input type="number" min={1} max={50} value={count} onChange={e => setCount(Number(e.currentTarget.value) || 1)} /></label>
            </div>
            {!hwOk && <p className="ucl-hint">Sans code PC, la clé marche sur n'importe quel PC. La personne trouve son code PC dans ultimecord.exe (ou sur l'écran de clé de Discord).</p>}

            <button className="ucl-primary" disabled={!canSign} onClick={generate}>Générer {count > 1 ? `${count} clés` : "la clé"}{hwOk ? " pour ce PC" : ""}</button>

            {made.length > 0 && <>
                <div className="ucl-section">Nouvelles clés</div>
                {made.map(m => (
                    <div className="ucl-key new" key={m.payload.id}>
                        <code>{m.key}</code>
                        <button onClick={() => { copy(m.key); flash(m.key); }}>{copied === m.key ? "copié" : "copier"}</button>
                    </div>
                ))}
                {made.length > 1 && <button className="ucl-ghost" onClick={() => copy(made.map(m => m.key).join("\n"))}>Tout copier</button>}
            </>}

            <div className="ucl-section">Historique · {history.length}</div>
            <div className="ucl-table">
                {history.length === 0 && <div className="ucl-empty">Aucune clé générée pour l'instant.</div>}
                {history.map(h => {
                    const isRev = revoked.includes(h.payload.id);
                    return (
                        <div className={`ucl-row ${isRev ? "revoked" : ""}`} key={h.payload.id}>
                            <span className="ucl-id">{h.payload.id}</span>
                            <span>{h.payload.note || "—"}</span>
                            <span>{h.payload.hw || "tout PC"}</span>
                            <span>{isRev ? "révoquée" : h.payload.exp && h.payload.exp < Date.now() ? "expirée" : `jusqu'au ${fmtDate(h.payload.exp)}`}</span>
                            <button onClick={() => { copy(h.key); flash(h.key); }}>{copied === h.key ? "copié" : "copier"}</button>
                            <button onClick={() => toggleRevoke(h.payload.id)}>{isRev ? "rétablir" : "révoquer"}</button>
                            <button onClick={() => forget(h.payload.id)} title="Retirer de l'historique">×</button>
                        </div>
                    );
                })}
            </div>

            <div className="ucl-section">Révocation</div>
            <div className="ucl-revoke">
                <p>
                    {online == null ? "Vérification de la liste en ligne…"
                        : !online.ok ? "La liste en ligne n'est pas joignable (repo pas encore créé ?)."
                            : pending ? `En ligne : ${online.ids.length} clé(s) révoquée(s). Ta liste locale a changé : mets à jour revoked.json sur GitHub.`
                                : `À jour : ${online.ids.length} clé(s) révoquée(s) en ligne.`}
                </p>
                <p className="ucl-hint">Les clés révoquées sont lues dans revoked.json du repo public <b>lyzral/ultimecord-licenses</b> (branche main). Copie le fichier ci-dessous et remplace son contenu sur GitHub.</p>
                <div className="ucl-actions">
                    <button className="ucl-ghost" onClick={() => { copy(revokedJson(revoked)); flash("rev"); }}>{copied === "rev" ? "copié" : "Copier revoked.json"}</button>
                    <button className="ucl-ghost" onClick={() => window.open(`${REPO_URL}/edit/main/revoked.json`, "_blank")}>Ouvrir sur GitHub</button>
                    <button className="ucl-ghost" onClick={() => Native.fetchRevoked().then(setOnline)}>Revérifier</button>
                </div>
            </div>
        </div>
    );
}

function KeyIcon(props: any) {
    return (
        <svg width={props.width ?? 20} height={props.height ?? 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3M17 6l3 3M14 9l2 2" />
        </svg>
    );
}

function addOwnerEntry() {
    if (!isOwner() || SettingsPlugin.customEntries.some(e => e.key === ENTRY)) return;
    SettingsPlugin.customEntries.unshift({ key: ENTRY, title: "Panel Owner", panelTitle: "Panel Owner", Component: OwnerPanel, Icon: KeyIcon });
}

const onAccount = () => { enforce(); };
const ACCOUNT_EVENTS = ["CONNECTION_OPEN", "CURRENT_USER_UPDATE", "LOGIN_SUCCESS"];

export default definePlugin({
    name: "UltimeLicense",
    description: "Vérifie la clé de licence (liée au PC, révocable) à chaque lancement. Panel owner de Sei pour faire et révoquer les clés.",
    authors: [Devs.Sei],
    required: true,
    start() {
        for (const e of ACCOUNT_EVENTS) FluxDispatcher.subscribe(e, onAccount);
        enforce();
    },
    stop() {
        for (const e of ACCOUNT_EVENTS) FluxDispatcher.unsubscribe(e, onAccount);
        closeGate();
        const i = SettingsPlugin.customEntries.findIndex(e => e.key === ENTRY);
        if (i >= 0) SettingsPlugin.customEntries.splice(i, 1);
    },
});
