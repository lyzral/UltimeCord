/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// UHQ: Discord's own voice engine, driven from one full-page "audio mode". Nothing outside Discord is needed:
// every control here is one of Discord's own audio actions, and bitrate/stereo come from the VoiceSettings plugin.

import "./styles.css";

import { applyFxOnStart, EffectsSection } from "./effects";

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { isPluginEnabled } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findStoreLazy } from "@webpack";
import {
    ChannelStore, createRoot, FluxDispatcher, IconUtils, MediaEngineStore, SelectedChannelStore, showToast, Toasts,
    UserStore, useEffect, useState, useStateFromStores, VoiceStateStore
} from "@webpack/common";

const RTCConnectionStore = findStoreLazy("RTCConnectionStore") as any;
const SpeakingStore = findStoreLazy("SpeakingStore") as any;
const Engine = () => MediaEngineStore as any;

const LOOPBACK_REASON = "ultimecord_uhq";
const CONTEXT = "default";
const LOCATION = "ultimecord_uhq";

const dispatch = (type: string, data: Record<string, unknown> = {}) => FluxDispatcher.dispatch({ type, ...data } as any);
const call = <T,>(fn: () => T, fallback: T): T => { try { return fn() ?? fallback; } catch { return fallback; } };

// ---------- VoiceSettings (bitrate / stereo) ----------

function voiceSettings() {
    const s = Settings.plugins.VoiceSettings ??= { enabled: false } as any;
    return s as any as { enabled: boolean; voiceBitrateKbps?: number; forceStereo?: boolean; };
}

function setVoice(patch: Partial<{ voiceBitrateKbps: number; forceStereo: boolean; }>) {
    const s = voiceSettings();
    const needsRestart = !isPluginEnabled("VoiceSettings");
    Object.assign(s, patch);
    if (!s.enabled) s.enabled = true;
    if (needsRestart) showToast("UHQ : redémarre Discord une fois pour activer le bitrate / stéréo", Toasts.Type.MESSAGE);
}

// ---------- presets ----------

interface Preset {
    name: string; icon: string; bitrate: number; stereo: boolean;
    krisp: boolean; ns: boolean; echo: boolean; agc: boolean; bypass: boolean;
}

const PRESETS: Preset[] = [
    { name: "Studio", icon: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3", bitrate: 510, stereo: true, krisp: false, ns: false, echo: false, agc: false, bypass: true },
    { name: "Podcast clean", icon: "M3 14v-2a9 9 0 0 1 18 0v2M3 14h3v6H3zM18 14h3v6h-3z", bitrate: 192, stereo: false, krisp: true, ns: false, echo: true, agc: false, bypass: false },
    { name: "Gaming", icon: "M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7A4 4 0 0 0 2.7 8.6L2 15a3 3 0 0 0 5.2 2.2L9 15h6l1.8 2.2A3 3 0 0 0 22 15l-.7-6.4A4 4 0 0 0 17.3 5z", bitrate: 128, stereo: false, krisp: true, ns: false, echo: true, agc: true, bypass: false },
    { name: "Musique", icon: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z", bitrate: 510, stereo: true, krisp: false, ns: false, echo: false, agc: false, bypass: true },
    { name: "Discord", icon: "M4 12h16", bitrate: 64, stereo: false, krisp: true, ns: true, echo: true, agc: true, bypass: false },
];

function applyPreset(p: Preset) {
    setVoice({ voiceBitrateKbps: p.bitrate, forceStereo: p.stereo });
    dispatch("AUDIO_SET_NOISE_CANCELLATION", { enabled: p.krisp, location: LOCATION });
    dispatch("AUDIO_SET_NOISE_SUPPRESSION", { enabled: p.ns, location: LOCATION });
    dispatch("AUDIO_SET_ECHO_CANCELLATION", { enabled: p.echo, location: LOCATION });
    dispatch("AUDIO_SET_AUTOMATIC_GAIN_CONTROL", { enabled: p.agc, location: LOCATION });
    showToast(`UHQ : ${p.name} appliqué (rejoins le vocal pour le bitrate)`, Toasts.Type.SUCCESS);
}

// ---------- small pieces ----------

const Svg = ({ d, size = 18 }: { d: string; size?: number; }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export function UhqIcon({ size = 20 }: { size?: number; }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 3v18M12 3v18M19 3v18" opacity="0.45" />
            <rect x="2.5" y="13" width="5" height="3.2" rx="1.2" fill="currentColor" stroke="none" />
            <rect x="9.5" y="6" width="5" height="3.2" rx="1.2" fill="currentColor" stroke="none" />
            <rect x="16.5" y="10" width="5" height="3.2" rx="1.2" fill="currentColor" stroke="none" />
        </svg>
    );
}

function Toggle({ on, onClick }: { on: boolean; onClick(): void; }) {
    return <button className={`uhq-switch ${on ? "on" : ""}`} onClick={onClick}><i /></button>;
}

function Row({ icon, label, value, min, max, step = 1, unit, onChange }: {
    icon: string; label: string; value: number; min: number; max: number; step?: number; unit: string; onChange(v: number): void;
}) {
    const pct = (value - min) / (max - min) * 100;
    return (
        <div className="uhq-row">
            <span className="uhq-row-icon"><Svg d={icon} size={16} /></span>
            <span className="uhq-row-label">{label}</span>
            <input className="uhq-slider" type="range" min={min} max={max} step={step} value={value}
                style={{ ["--p" as any]: `${pct}%` }}
                onChange={e => onChange(Number(e.currentTarget.value))} />
            <b className="uhq-row-val">{Math.round(value)} {unit}</b>
        </div>
    );
}

function Meter({ active }: { active: boolean; }) {
    const [bars, setBars] = useState<number[]>(() => Array(48).fill(0.05));
    useEffect(() => {
        const id = setInterval(() => setBars(prev => prev.map((b, i) => {
            const target = active ? 0.25 + Math.random() * 0.75 * Math.abs(Math.sin(Date.now() / 300 + i / 4)) : 0.04;
            return b + (target - b) * 0.35;
        })), 60);
        return () => clearInterval(id);
    }, [active]);
    return (
        <div className="uhq-meter">
            {bars.map((b, i) => <span key={i} style={{ height: `${Math.max(4, b * 100)}%` }} />)}
        </div>
    );
}

// ---------- the page ----------

function AudioMode({ onClose }: { onClose(): void; }) {
    const me = UserStore.getCurrentUser();
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId());
    const channel = channelId ? ChannelStore.getChannel(channelId) : null;
    const ping = useStateFromStores([RTCConnectionStore], () => call(() => RTCConnectionStore.getAveragePing(), 0));
    const speaking = useStateFromStores([SpeakingStore], () => call(() => SpeakingStore.isCurrentUserSpeaking(), false));
    const voiceStates = useStateFromStores([VoiceStateStore], () => channelId ? Object.values(call(() => (VoiceStateStore as any).getVoiceStatesForChannel(channelId), {})) : []) as any[];

    const audio = useStateFromStores([MediaEngineStore], () => ({
        input: call(() => Engine().getInputVolume(), 100),
        output: call(() => Engine().getOutputVolume(), 100),
        krisp: call(() => Engine().getNoiseCancellation(), false),
        ns: call(() => Engine().getNoiseSuppression(), false),
        echo: call(() => Engine().getEchoCancellation(), true),
        agc: call(() => Engine().getAutomaticGainControl(), true),
        loop: call(() => Engine().getLoopbackReasons().has(LOOPBACK_REASON), false),
        spatial: call(() => Engine().getSpatialAudioEnabled?.(), false),
        sidechain: call(() => Engine().getSidechainCompression(), false),
    }));

    const [vs, setVs] = useState(() => ({ ...voiceSettings() }));
    const bitrate = vs.voiceBitrateKbps ?? 128;

    useEffect(() => () => {
        if (call(() => Engine().getLoopbackReasons().has(LOOPBACK_REASON), false))
            dispatch("AUDIO_SET_LOOPBACK", { loopbackReason: LOOPBACK_REASON, enabled: false });
    }, []);

    const native: { key: keyof typeof audio; label: string; desc: string; icon: string; toggle(on: boolean): void; }[] = [
        { key: "krisp", label: "Krisp IA", desc: "Supprime les bruits de fond", icon: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z", toggle: on => dispatch("AUDIO_SET_NOISE_CANCELLATION", { enabled: on, location: LOCATION }) },
        { key: "ns", label: "Suppression standard", desc: "Réduction de bruit classique", icon: "M4 12h4l3-8 4 16 3-8h2", toggle: on => dispatch("AUDIO_SET_NOISE_SUPPRESSION", { enabled: on, location: LOCATION }) },
        { key: "echo", label: "Anti-écho", desc: "Coupe le retour du casque", icon: "M3 12a9 9 0 0 1 18 0M7 12a5 5 0 0 1 10 0M11 12a1 1 0 0 1 2 0", toggle: on => dispatch("AUDIO_SET_ECHO_CANCELLATION", { enabled: on, location: LOCATION }) },
        { key: "agc", label: "Gain auto", desc: "Garde un volume constant", icon: "M4 18V6M8 16V8M12 20V4M16 16V8M20 18V6", toggle: on => dispatch("AUDIO_SET_AUTOMATIC_GAIN_CONTROL", { enabled: on, location: LOCATION }) },
        { key: "sidechain", label: "Atténuation stream", desc: "Baisse le son d'un stream quand on parle", icon: "M3 17l6-6 4 4 8-8", toggle: on => dispatch("AUDIO_SET_SIDECHAIN_COMPRESSION", { enabled: on }) },
        { key: "spatial", label: "Audio spatial", desc: "Place les voix autour de toi", icon: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0", toggle: on => dispatch("AUDIO_SET_SPATIAL_AUDIO_ENABLED", { enabled: on }) },
    ];

    return (
        <div className="uhq">
            <button className="uhq-close" onClick={onClose} aria-label="Quitter le mode audio" title="Quitter le mode audio (Échap)"><Svg d="M6 6l12 12M18 6L6 18" /></button>

            <div className="uhq-top">
                <div className="uhq-chan">
                    <span className="uhq-chan-icon"><Svg d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></span>
                    <div>
                        <b>{channel?.name ?? "Pas en vocal"}</b>
                        <span className={channel ? "ok" : ""}>{channel ? <>● Connecté <em>{Math.round(ping)} ms</em></> : "Rejoins un salon vocal pour tout voir en direct"}</span>
                    </div>
                </div>
                <div className="uhq-brand"><UhqIcon size={16} /> UHQ <small>par Sei</small></div>
            </div>

            <div className="uhq-card">
                <div className="uhq-card-title"><span className="uhq-dot" /> PIPELINE AUDIO ULTIME CORD <span className={`uhq-live ${speaking ? "on" : ""}`}>{speaking ? "TU PARLES" : "LIVE"}</span></div>
                <Meter active={speaking} />
            </div>

            <div className="uhq-card">
                <div className="uhq-card-title"><Svg d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" size={15} /> Audio</div>
                <Row icon="M2 12h3l3-9 4 18 3-9h7" label="Bitrate" value={bitrate} min={32} max={510} step={1} unit="kbps"
                    onChange={v => { setVs(s => ({ ...s, voiceBitrateKbps: v })); setVoice({ voiceBitrateKbps: v }); }} />
                <Row icon="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0" label="Volume micro" value={audio.input} min={0} max={100} unit="%"
                    onChange={v => dispatch("AUDIO_SET_INPUT_VOLUME", { volume: v })} />
                <Row icon="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7" label="Volume sortie" value={audio.output} min={0} max={200} unit="%"
                    onChange={v => dispatch("AUDIO_SET_OUTPUT_VOLUME", { volume: v })} />
                <div className="uhq-row">
                    <span className="uhq-row-icon"><Svg d="M8 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M16 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0" size={16} /></span>
                    <span className="uhq-row-label">Stéréo</span>
                    <span className="uhq-row-hint">Envoie ta voix en stéréo (rejoins le vocal)</span>
                    <Toggle on={!!vs.forceStereo} onClick={() => { const v = !vs.forceStereo; setVs(s => ({ ...s, forceStereo: v })); setVoice({ forceStereo: v }); }} />
                </div>
            </div>

            <div className="uhq-card uhq-hear">
                <span className="uhq-row-icon big"><Svg d="M3 14v-2a9 9 0 0 1 18 0v2M3 14h3v6H3zM18 14h3v6h-3z" /></span>
                <div><b>S'entendre</b><span>Écoute ta propre voix traitée par Discord</span></div>
                <Toggle on={audio.loop} onClick={() => dispatch("AUDIO_SET_LOOPBACK", { loopbackReason: LOOPBACK_REASON, enabled: !audio.loop })} />
            </div>

            {voiceStates.length > 0 && <>
                <div className="uhq-section">MEMBRES CONNECTÉS</div>
                <div className="uhq-members">
                    {voiceStates.filter(v => v.userId !== me?.id).map(v => {
                        const user = UserStore.getUser(v.userId);
                        const vol = call(() => Engine().getLocalVolume(v.userId, CONTEXT), 100);
                        const pan = call(() => Engine().getLocalPan(v.userId, CONTEXT), { left: 1, right: 1 });
                        const panValue = Math.round((pan.right - pan.left) * 100);
                        return (
                            <div className="uhq-member" key={v.userId}>
                                <img src={user ? IconUtils.getUserAvatarURL(user, false, 40) : ""} alt="" />
                                <span className="uhq-member-name">{user?.globalName ?? user?.username ?? v.userId}</span>
                                <label>Vol<input className="uhq-slider sm" type="range" min={0} max={200} value={vol}
                                    style={{ ["--p" as any]: `${vol / 2}%` }}
                                    onChange={e => dispatch("AUDIO_SET_LOCAL_VOLUME", { context: CONTEXT, userId: v.userId, volume: Number(e.currentTarget.value) })} /></label>
                                <label>Pan<input className="uhq-slider sm" type="range" min={-100} max={100} value={panValue}
                                    style={{ ["--p" as any]: `${(panValue + 100) / 2}%` }}
                                    onChange={e => {
                                        const p = Number(e.currentTarget.value) / 100;
                                        dispatch("AUDIO_SET_LOCAL_PAN", { context: CONTEXT, userId: v.userId, left: Math.min(1, 1 - p), right: Math.min(1, 1 + p) });
                                    }} /></label>
                            </div>
                        );
                    })}
                </div>
            </>}

            <div className="uhq-section">CONFIGURATIONS</div>
            <div className="uhq-presets">
                {PRESETS.map(p => (
                    <button key={p.name} className="uhq-preset" onClick={() => { applyPreset(p); setVs(s => ({ ...s, voiceBitrateKbps: p.bitrate, forceStereo: p.stereo })); }}>
                        <Svg d={p.icon} size={16} /> {p.name}
                    </button>
                ))}
            </div>

            <div className="uhq-section">TRAITEMENT DISCORD · {native.length} réglages</div>
            <div className="uhq-grid">
                {native.map(n => (
                    <div key={n.key} className={`uhq-fx ${audio[n.key] ? "on" : ""}`} onClick={() => n.toggle(!audio[n.key])}>
                        <div className="uhq-fx-icon"><Svg d={n.icon} /></div>
                        <div className="uhq-fx-text"><b>{n.label}</b><span>{n.desc}</span></div>
                        <div className={`uhq-switch ${audio[n.key] ? "on" : ""}`}><i /></div>
                    </div>
                ))}
            </div>

            <EffectsSection />

            <div className="uhq-foot">UHQ par Sei · réglages Discord + effets sur ta voix via Equalizer APO</div>
        </div>
    );
}

// ---------- the whole-app shell ----------

function AppShell({ onClose }: { onClose(): void; }) {
    const me = UserStore.getCurrentUser();
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId());
    const channel = channelId ? ChannelStore.getChannel(channelId) : null;
    const guildId = channel?.guild_id;
    const voiceChannels = useStateFromStores([ChannelStore], () => guildId
        ? Object.values(call(() => (ChannelStore as any).getMutableGuildChannelsForGuild(guildId), {}) as any).filter((c: any) => c.type === 2 || c.type === 13).sort((a: any, b: any) => a.position - b.position)
        : []) as any[];
    const allStates = useStateFromStores([VoiceStateStore], () => guildId ? call(() => (VoiceStateStore as any).getVoiceStates(guildId), {}) : {}) as Record<string, any>;
    const speakingIds = useStateFromStores([SpeakingStore], () => Object.keys(allStates).filter(id => call(() => SpeakingStore.isSpeaking(id), false)));
    const muted = useStateFromStores([MediaEngineStore], () => call(() => Engine().isSelfMute(), false));
    const deaf = useStateFromStores([MediaEngineStore], () => call(() => Engine().isSelfDeaf(), false));

    const byChannel: Record<string, string[]> = {};
    for (const [uid, vs] of Object.entries(allStates)) (byChannel[vs.channelId] ??= []).push(uid);

    const avatar = (uid: string, size = 32) => { const u = UserStore.getUser(uid); return u ? IconUtils.getUserAvatarURL(u, false, size) : ""; };
    const name = (uid: string) => { const u: any = UserStore.getUser(uid); return u?.globalName ?? u?.username ?? uid; };

    return (
        <div className="uhq-app">
            <aside className="uhq-side">
                <div className="uhq-side-brand"><UhqIcon size={18} /> <b>UHQ</b><span>Ultime Cord</span></div>

                <div className="uhq-side-title">SALONS VOCAUX</div>
                <div className="uhq-side-list">
                    {voiceChannels.length === 0 && <div className="uhq-side-empty">Rejoins un salon vocal d'un serveur</div>}
                    {voiceChannels.map(c => (
                        <div key={c.id} className={`uhq-side-chan ${c.id === channelId ? "on" : ""}`}>
                            <div className="uhq-side-chan-name"><Svg d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7" size={15} /> {c.name}</div>
                            {(byChannel[c.id] ?? []).map(uid => (
                                <div key={uid} className={`uhq-side-user ${speakingIds.includes(uid) ? "speaking" : ""}`}>
                                    <img src={avatar(uid, 24)} alt="" /> <span>{name(uid)}</span>
                                    {allStates[uid]?.selfMute && <Svg d="M3 3l18 18M9 9v3a3 3 0 0 0 5 2M15 9V6a3 3 0 0 0-6 0" size={12} />}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="uhq-side-me">
                    <img src={me ? IconUtils.getUserAvatarURL(me, false, 40) : ""} alt="" />
                    <div className="uhq-side-me-name"><b>{(me as any)?.globalName ?? me?.username}</b><span>{channel ? `en vocal · ${channel.name}` : "hors vocal"}</span></div>
                    <button className={`uhq-icon-btn ${muted ? "danger" : ""}`} title={muted ? "Réactiver le micro" : "Couper le micro"} onClick={() => dispatch("AUDIO_TOGGLE_SELF_MUTE", { context: CONTEXT, syncRemote: true, playSoundEffect: true })}>
                        <Svg d={muted ? "M3 3l18 18M9 9v3a3 3 0 0 0 5 2M15 9V6a3 3 0 0 0-6 0M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3" : "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"} size={17} />
                    </button>
                    <button className={`uhq-icon-btn ${deaf ? "danger" : ""}`} title={deaf ? "Réactiver le son" : "Couper le son"} onClick={() => dispatch("AUDIO_TOGGLE_SELF_DEAF", { context: CONTEXT, syncRemote: true })}>
                        <Svg d={deaf ? "M3 3l18 18M3 14v-2a9 9 0 0 1 15-6.7M21 12v2M3 14h3v6H3zM18 14h3v6h-3z" : "M3 14v-2a9 9 0 0 1 18 0v2M3 14h3v6H3zM18 14h3v6h-3z"} size={17} />
                    </button>
                </div>
            </aside>

            <main className="uhq-main">
                <AudioMode onClose={onClose} />
            </main>
        </div>
    );
}

// ---------- audio mode: takes over the whole app ----------

let active = false;
let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let observer: MutationObserver | null = null;
let rerenderButton = () => { };

function mount() {
    if (host && document.body.contains(host)) return;
    root?.unmount();
    const bar = [...document.querySelectorAll<HTMLElement>("[class^=bar_]")].find(e => e.getBoundingClientRect().width > 300);
    host = document.createElement("div");
    host.className = "uhq-app-root";
    host.style.top = `${bar ? Math.round(bar.getBoundingClientRect().bottom) : 32}px`;
    document.body.appendChild(host);
    root = createRoot(host);
    root.render(<AppShell onClose={() => setActive(false)} />);
}

function unmount() {
    root?.unmount();
    host?.remove();
    root = null;
    host = null;
}

let scheduled = false;
function keepMounted() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; if (active) mount(); });
}

const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && active && !document.querySelector("[role=dialog]")) setActive(false); };

function setActive(on: boolean) {
    active = on;
    document.documentElement.classList.toggle("uhq-mode", on);
    if (on) {
        mount();
        observer = new MutationObserver(keepMounted);
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener("keydown", onKey);
    } else {
        observer?.disconnect();
        observer = null;
        document.removeEventListener("keydown", onKey);
        unmount();
    }
    rerenderButton();
}

function UhqButton() {
    const [, force] = useState(0);
    useEffect(() => { rerenderButton = () => force(n => n + 1); return () => { rerenderButton = () => { }; }; }, []);
    return <HeaderBarButton icon={() => <UhqIcon />} tooltip={active ? "Quitter le mode audio" : "UHQ — mode audio"} selected={active} onClick={() => setActive(!active)} />;
}

export default definePlugin({
    name: "UHQ",
    description: "Mode audio plein écran : bitrate jusqu'à 510 kbps, stéréo, volumes, Krisp, anti-écho, volume et pan par membre, s'entendre. Rien à installer. Fait par Sei.",
    tags: ["Voice", "Media"],
    authors: [Devs.Sei],
    required: true,
    start() {
        addHeaderBarButton("ultimecord-uhq", () => <UhqButton />, 100);
        applyFxOnStart();
    },
    stop() {
        setActive(false);
        removeHeaderBarButton("ultimecord-uhq");
    },
});
