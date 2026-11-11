/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { Devs } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";
import { createRoot, useEffect, useRef, useState } from "@webpack/common";

import type { Track } from "./native";

const Native = new Proxy({}, { get: (_, k) => (EndcordNative.pluginHelpers.UltimeMusic as any)[k] }) as PluginNative<typeof import("./native")>;

const fmt = (s: number) => !isFinite(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const Svg = ({ d, fill }: { d: string; fill?: boolean; }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={fill ? 0 : 2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I = {
    play: "M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z",
    pause: "M7 4.5a1.5 1.5 0 0 1 3 0v15a1.5 1.5 0 0 1-3 0zM14 4.5a1.5 1.5 0 0 1 3 0v15a1.5 1.5 0 0 1-3 0z",
    next: "M5 6.2v11.6a1 1 0 0 0 1.6.8l8-5.8a1 1 0 0 0 0-1.6l-8-5.8A1 1 0 0 0 5 6.2zM17 5.5a1.5 1.5 0 0 1 3 0v13a1.5 1.5 0 0 1-3 0z",
    prev: "M19 6.2v11.6a1 1 0 0 1-1.6.8l-8-5.8a1 1 0 0 1 0-1.6l8-5.8a1 1 0 0 1 1.6.8zM7 5.5a1.5 1.5 0 0 0-3 0v13a1.5 1.5 0 0 0 3 0z",
};

// Two colours for the card: from the cover when there is one, otherwise from the title so each song has its own
function hashColors(seed: string): [string, string] {
    let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const hsl = (hue: number, s: number, l: number) => {
        s /= 100; l /= 100; const k = (n: number) => (n + hue / 30) % 12, a = s * Math.min(l, 1 - l);
        const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
        return `${f(0)} ${f(8)} ${f(4)}`;
    };
    return [hsl(h % 360, 55, 45), hsl((h / 7 + 140) % 360, 45, 22)];
}

function coverColors(src: string): Promise<[string, string]> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas"); c.width = c.height = 16;
            const x = c.getContext("2d")!; x.drawImage(img, 0, 0, 16, 16);
            const d = x.getImageData(0, 0, 16, 16).data;
            const avg = (y0: number, y1: number) => {
                let r = 0, g = 0, b = 0, n = 0;
                for (let y = y0; y < y1; y++) for (let xx = 0; xx < 16; xx++) { const i = (y * 16 + xx) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
                return `${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)}`;
            };
            resolve([avg(0, 8), avg(8, 16)]);
        };
        img.onerror = () => resolve(hashColors(src));
        img.src = src;
    });
}

function Title({ text }: { text: string; }) {
    const box = useRef<HTMLDivElement>(null);
    const [shift, setShift] = useState(0);
    useEffect(() => {
        const el = box.current; if (!el) return;
        const inner = el.firstElementChild as HTMLElement;
        setShift(Math.max(0, inner.scrollWidth - el.clientWidth));
    }, [text]);
    return (
        <div ref={box} className={`ucm-title ${shift > 0 ? "scroll" : ""}`} title={text}
            style={{ ["--ucm-shift" as any]: `-${shift}px`, ["--ucm-dur" as any]: `${Math.max(6, shift / 18)}s` }}>
            <span>{text}</span>
        </div>
    );
}

interface Brand { name: string; color: string; icon: string; fill?: boolean; }
const NOTE = "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z";
const BRANDS: [RegExp, Brand][] = [
    [/spotify/i, { name: "Spotify", color: "30 215 96", icon: "M6 9.5c4-1.3 8.5-1 12 1M6.8 13c3.3-1 7-.7 9.8.9M7.6 16.2c2.6-.7 5.4-.5 7.6.7" }],
    [/youtube|music\.youtube/i, { name: "YouTube Music", color: "255 0 51", icon: "M9.5 8.5v7l6-3.5z", fill: true }],
    [/deezer/i, { name: "Deezer", color: "162 56 255", icon: "M4 17h3M4 14h3M9 17h3M9 14h3M9 11h3M14 17h3M14 14h3M14 11h3M14 8h3M19 17h1M19 14h1M19 11h1M19 8h1M19 5h1" }],
    [/applemusic|apple\.music|itunes/i, { name: "Apple Music", color: "250 45 72", icon: NOTE }],
    [/soundcloud/i, { name: "SoundCloud", color: "255 85 0", icon: "M7 17h11a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5M5 12v5M3 14v3" }],
    [/tidal/i, { name: "Tidal", color: "40 40 48", icon: "M12 6l3 3-3 3-3-3zM6 6l3 3-3 3-3-3zM18 6l3 3-3 3-3-3zM12 12l3 3-3 3-3-3z" }],
    [/chrome/i, { name: "Chrome", color: "66 133 244", icon: NOTE }],
    [/msedge|edge/i, { name: "Edge", color: "0 120 212", icon: NOTE }],
    [/firefox/i, { name: "Firefox", color: "255 113 57", icon: NOTE }],
    [/opera/i, { name: "Opera", color: "255 27 45", icon: NOTE }],
    [/brave/i, { name: "Brave", color: "251 84 43", icon: NOTE }],
    [/vlc/i, { name: "VLC", color: "255 136 0", icon: "M12 3l7 16H5z" }],
];
function brandOf(id = ""): Brand {
    const hit = BRANDS.find(([r]) => r.test(id));
    if (hit) return hit[1];
    const name = (id.split(/[\\/!]/).filter(Boolean).pop() ?? "Lecteur").replace(/\.exe$/i, "").split(".").pop()!;
    return { name: name.charAt(0).toUpperCase() + name.slice(1), color: "70 70 82", icon: NOTE };
}

const Logo = ({ b }: { b: Brand; }) => (
    <span className="ucm-logo" style={{ ["--ucm-brand" as any]: b.color }} title={b.name}>
        <svg viewBox="0 0 24 24" fill={b.fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={b.fill ? 0 : 2.2} strokeLinecap="round" strokeLinejoin="round"><path d={b.icon} /></svg>
    </span>
);

function Player() {
    const [t, setT] = useState<Track>({ none: true });
    const [now, setNow] = useState(Date.now());
    const [drag, setDrag] = useState<number | null>(null);
    const [colors, setColors] = useState<[string, string]>(["110 110 120", "30 30 36"]);
    const bar = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let alive = true;
        const tick = async () => { try { const r = await Native.poll(); if (alive) setT(r); } catch { } };
        tick();
        const a = setInterval(tick, 1000), b = setInterval(() => setNow(Date.now()), 250);
        return () => { alive = false; clearInterval(a); clearInterval(b); };
    }, []);

    useEffect(() => {
        if (!t.title) return;
        if (t.art) coverColors(t.art).then(setColors);
        else setColors(hashColors(`${t.title}|${t.artist}`));
    }, [t.title, t.artist, t.art]);

    if (t.none || !t.title) return (
        <div className="ucm-card">
            <div className="ucm-fluid" />
            <div className="ucm-empty-body">
                <div className="ucm-art"><Svg d={NOTE} /></div>
                <b>Rien ne joue</b>
                <span>Lance un son sur ton PC, il apparaît ici</span>
                <div className="ucm-apps">{[0, 1, 2, 3, 4].map(i => <Logo key={i} b={BRANDS[i][1]} />)}</div>
            </div>
        </div>
    );

    const brand = brandOf(t.app);
    const end = t.end ?? 0;
    const live = Math.min(end || Infinity, (t.pos ?? 0) + (t.playing && t.at ? (now - t.at) / 1000 : 0));
    const shown = drag ?? live;
    const pct = end > 0 ? Math.max(0, Math.min(100, shown / end * 100)) : 0;
    const seekAt = (x: number) => { const r = bar.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * end; };
    const send = (c: Parameters<typeof Native.control>[0]) => Native.control(c).then(() => setTimeout(async () => setT(await Native.poll()), 400));

    return (
        <div className={`ucm-card ${t.playing ? "playing" : ""}`} style={{ ["--ucm-a" as any]: colors[0], ["--ucm-b" as any]: colors[1] }}>
            {t.art ? <div className="ucm-bg" style={{ backgroundImage: `url(${t.art})` }} /> : <div className="ucm-fluid" />}
            <div className="ucm-row">
                <div className="ucm-art">{t.art ? <img src={t.art} alt="" /> : <Svg d={NOTE} />}</div>
                <div className="ucm-meta">
                    <Title text={t.title} />
                    <div className="ucm-artist" title={t.artist}><Logo b={brand} />{t.artist || brand.name}</div>
                </div>
            </div>
            {end > 0 && (
                <div className="ucm-prog">
                    <div ref={bar} className={`ucm-bar ${drag != null ? "drag" : ""}`}
                        onMouseDown={e => {
                            setDrag(seekAt(e.clientX));
                            const move = (ev: MouseEvent) => setDrag(seekAt(ev.clientX));
                            const up = (ev: MouseEvent) => {
                                removeEventListener("mousemove", move); removeEventListener("mouseup", up);
                                send(`seek ${Math.round(seekAt(ev.clientX))}`); setTimeout(() => setDrag(null), 700);
                            };
                            addEventListener("mousemove", move); addEventListener("mouseup", up);
                        }}>
                        <i style={{ width: `${pct}%` }} />
                    </div>
                    <div className="ucm-times"><span>{fmt(shown)}</span><span>{fmt(end)}</span></div>
                </div>
            )}
            <div className="ucm-ctrl">
                <button onClick={() => send("prev")} aria-label="Précédent"><Svg d={I.prev} fill /></button>
                <button className="ucm-main" onClick={() => send("toggle")} aria-label={t.playing ? "Pause" : "Lecture"}><Svg d={t.playing ? I.pause : I.play} fill /></button>
                <button onClick={() => send("next")} aria-label="Suivant"><Svg d={I.next} fill /></button>
            </div>
        </div>
    );
}

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
const listeners = new Set<(open: boolean) => void>();

function onOutside(e: MouseEvent) {
    const t = e.target as Element;
    if (host?.contains(t) || t.closest?.("[data-ucm-toggle]")) return;
    setOpen(false);
}
function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }

function setOpen(open: boolean) {
    if (open && !host) {
        host = document.createElement("div");
        host.className = "ucm-pop";
        const btn = document.querySelector("[data-ucm-toggle]")?.getBoundingClientRect();
        if (btn) {
            host.style.top = `${Math.round(btn.bottom + 8)}px`; host.style.right = "auto";
            host.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - 308, btn.left + btn.width / 2 - 150)))}px`;
        }
        document.body.appendChild(host);
        root = createRoot(host);
        root.render(<Player />);
        setTimeout(() => { addEventListener("mousedown", onOutside, true); addEventListener("keydown", onKey); });
    } else if (!open && host) {
        removeEventListener("mousedown", onOutside, true); removeEventListener("keydown", onKey);
        root?.unmount(); root = null; host.remove(); host = null;
    }
    listeners.forEach(l => l(open));
}

function MusicButton() {
    const [open, set] = useState(!!host);
    useEffect(() => { listeners.add(set); return () => void listeners.delete(set); }, []);
    return (
        <span data-ucm-toggle>
            <HeaderBarButton
                icon={() => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /></svg>}
                tooltip="Lecteur musique"
                selected={open}
                onClick={() => setOpen(!host)}
            />
        </span>
    );
}

export default definePlugin({
    name: "UltimeMusic",
    description: "Bouton en haut de Discord qui ouvre un lecteur : ce qui joue sur ton PC (Spotify, YouTube, Deezer, Apple Music…), pochette, progression, lecture/pause, suivant, précédent. Fait par Sei.",
    tags: ["Media", "Appearance"],
    authors: [Devs.Sei],
    enabledByDefault: true,
    start() {
        addHeaderBarButton("ultimecord-music", () => <MusicButton />, 98);
    },
    stop() {
        setOpen(false);
        removeHeaderBarButton("ultimecord-music");
        Native.stop();
    },
});
