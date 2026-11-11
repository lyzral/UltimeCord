/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Devs } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";
import { createRoot, useEffect, useRef, useState } from "@webpack/common";

import type { Track } from "./native";

const Native = new Proxy({}, { get: (_, k) => (EndcordNative.pluginHelpers.UltimeMusic as any)[k] }) as PluginNative<typeof import("./native")>;

const APPS: [RegExp, string][] = [
    [/spotify/i, "Spotify"], [/deezer/i, "Deezer"], [/applemusic|apple\.music|itunes/i, "Apple Music"], [/chrome/i, "Chrome"],
    [/msedge|edge/i, "Edge"], [/firefox/i, "Firefox"], [/opera/i, "Opera"], [/brave/i, "Brave"], [/soundcloud/i, "SoundCloud"],
    [/tidal/i, "Tidal"], [/youtube/i, "YouTube Music"], [/vlc/i, "VLC"], [/zunemusic|media\.player/i, "Lecteur multimédia"],
];
const appName = (id = "") => APPS.find(([r]) => r.test(id))?.[1] ?? (id.split(/[\\/!.]/).filter(Boolean).pop() ?? "").replace(/\.exe$/i, "");
const fmt = (s: number) => !isFinite(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const Svg = ({ d, fill }: { d: string; fill?: boolean; }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={fill ? 0 : 2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I = {
    play: "M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z",
    pause: "M6 4h4v16H6zM14 4h4v16h-4z",
    next: "M5 5v14l10-7zM17 5h2v14h-2z",
    prev: "M19 5v14L9 12zM5 5h2v14H5z",
};

function Player() {
    const [t, setT] = useState<Track>({ none: true });
    const [now, setNow] = useState(Date.now());
    const [drag, setDrag] = useState<number | null>(null);
    const bar = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        const tick = async () => { try { const r = await Native.poll(); if (alive) setT(r); } catch { } };
        tick();
        const a = setInterval(tick, 1000), b = setInterval(() => setNow(Date.now()), 500);
        return () => { alive = false; clearInterval(a); clearInterval(b); };
    }, []);

    if (t.none || !t.title) return null;

    const end = t.end ?? 0;
    const live = Math.min(end || Infinity, (t.pos ?? 0) + (t.playing && t.at ? (now - t.at) / 1000 : 0));
    const shown = drag ?? live;
    const pct = end > 0 ? Math.max(0, Math.min(100, shown / end * 100)) : 0;
    const seekAt = (x: number) => { const r = bar.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * end; };
    const send = (c: Parameters<typeof Native.control>[0]) => Native.control(c).then(() => setTimeout(async () => setT(await Native.poll()), 400));

    return (
        <div className="ucm-card">
            {t.art && <div className="ucm-bg" style={{ backgroundImage: `url(${t.art})` }} />}
            <div className="ucm-top">
                <div className="ucm-art">{t.art ? <img src={t.art} alt="" /> : <Svg d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />}</div>
                <div className="ucm-meta">
                    <b title={t.title}>{t.title}</b>
                    <span title={t.artist}>{t.artist || appName(t.app)}</span>
                    <em>{appName(t.app)}</em>
                </div>
                <div className="ucm-ctrl">
                    <button onClick={() => send("prev")} aria-label="Précédent"><Svg d={I.prev} fill /></button>
                    <button className="ucm-main" onClick={() => send("toggle")} aria-label={t.playing ? "Pause" : "Lecture"}><Svg d={t.playing ? I.pause : I.play} fill /></button>
                    <button onClick={() => send("next")} aria-label="Suivant"><Svg d={I.next} fill /></button>
                </div>
            </div>
            {end > 0 && (
                <div className="ucm-time">
                    <span>{fmt(shown)}</span>
                    <div ref={bar} className="ucm-bar"
                        onMouseDown={e => {
                            setDrag(seekAt(e.clientX));
                            const move = (ev: MouseEvent) => setDrag(seekAt(ev.clientX));
                            const up = (ev: MouseEvent) => {
                                removeEventListener("mousemove", move); removeEventListener("mouseup", up);
                                send(`seek ${Math.round(seekAt(ev.clientX))}`); setTimeout(() => setDrag(null), 600);
                            };
                            addEventListener("mousemove", move); addEventListener("mouseup", up);
                        }}>
                        <i style={{ width: `${pct}%` }} />
                    </div>
                    <span>{fmt(end)}</span>
                </div>
            )}
        </div>
    );
}

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let observer: MutationObserver | null = null;

function mount() {
    const panels = document.querySelector<HTMLElement>('section[class*="panels_"]');
    if (!panels) return;
    if (host && panels.contains(host)) return;
    host?.remove();
    host = document.createElement("div");
    host.className = "ucm-host";
    panels.prepend(host);
    root?.unmount();
    root = createRoot(host);
    root.render(<Player />);
}

export default definePlugin({
    name: "UltimeMusic",
    description: "Lecteur musique en verre au-dessus de ton compte : ce qui joue sur ton PC (Spotify, YouTube, Deezer, Apple Music…), pochette, progression, lecture/pause, suivant, précédent. Fait par Sei.",
    tags: ["Media", "Appearance"],
    authors: [Devs.Sei],
    enabledByDefault: true,
    start() {
        mount();
        observer = new MutationObserver(() => mount());
        observer.observe(document.body, { childList: true, subtree: true });
    },
    stop() {
        observer?.disconnect(); observer = null;
        root?.unmount(); root = null;
        host?.remove(); host = null;
        Native.stop();
    },
});
