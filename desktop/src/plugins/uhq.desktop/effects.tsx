/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// UHQ "Effets": EQ, filters, pan and gain on your own mic. Discord's voice engine reads the mic natively, so this goes
// through Equalizer APO (writes ultimecord-uhq.txt + one Include line in its config.txt).

import { Settings } from "@api/Settings";
import { PluginNative } from "@utils/types";
import { showToast, Toasts, useEffect, useRef, useState } from "@webpack/common";

const Native = EndcordNative.pluginHelpers.UHQ as PluginNative<typeof import("./native")>;

type FilterType = "PK" | "LS" | "HS" | "HP" | "LP";
interface Biquad { type: FilterType; f: number; g?: number; q?: number; }
interface Band { f: number; g: number; q: number; }

const FS = 48000;
const F_MIN = 20, F_MAX = 20000, G_MAX = 15;

interface FxDef { id: string; name: string; desc: string; icon: string; filters?: Biquad[]; haas?: boolean; }

// Everything here is something Equalizer APO does on its own (no VST needed)
const FX: FxDef[] = [
    { id: "hp", name: "Passe-haut", desc: "Coupe le grondement sous 80 Hz", icon: "M3 18 L9 6 L21 6", filters: [{ type: "HP", f: 80 }] },
    { id: "voice", name: "EQ Voix", desc: "Présence 2.8 kHz + air 12 kHz", icon: "M6 4v16M12 8v12M18 4v16", filters: [{ type: "PK", f: 2800, g: 4, q: 1 }, { type: "HS", f: 12000, g: 3 }] },
    { id: "deess", name: "De-esser", desc: "Adoucit les « s » vers 7.5 kHz", icon: "M4 12h4M10 8l4 8M16 12h4", filters: [{ type: "PK", f: 7500, g: -6, q: 3 }] },
    { id: "bass", name: "Bass Boost", desc: "Basses qui vibrent dans le casque", icon: "M3 14c3-8 5 8 8 0s5-8 10 0", filters: [{ type: "LS", f: 120, g: 6 }] },
    { id: "hd", name: "Enhancer HD", desc: "Clarté voix + basses + air", icon: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z", filters: [{ type: "LS", f: 100, g: 2 }, { type: "PK", f: 3000, g: 3, q: 1 }, { type: "HS", f: 10000, g: 3 }] },
    { id: "warm", name: "Chaleur", desc: "Voix plus ronde, aigus adoucis", icon: "M12 3c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10z", filters: [{ type: "LS", f: 220, g: 3 }, { type: "HS", f: 8000, g: -2 }] },
    { id: "hiss", name: "Anti-souffle", desc: "Réduit le souffle au-dessus de 9 kHz", icon: "M4 12h16M8 8h8M10 16h4", filters: [{ type: "HS", f: 9000, g: -6 }] },
    { id: "tel", name: "Téléphone", desc: "Bande étroite 300-3400 Hz", icon: "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2", filters: [{ type: "HP", f: 300 }, { type: "LP", f: 3400 }] },
    { id: "am", name: "Radio AM", desc: "Son de vieille radio", icon: "M4 9h16v11H4zM8 9l8-5M8 15h3", filters: [{ type: "HP", f: 500 }, { type: "LP", f: 4500 }, { type: "PK", f: 1500, g: 5, q: 0.8 }] },
    { id: "mega", name: "Mégaphone", desc: "Annonce métallique haut-parleur", icon: "M3 10v4h4l8 5V5L7 10z", filters: [{ type: "HP", f: 700 }, { type: "LP", f: 4000 }, { type: "PK", f: 2000, g: 8, q: 1.5 }] },
    { id: "lofi", name: "Lo-Fi", desc: "Chaleur vinyle, aigus coupés", icon: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0", filters: [{ type: "HP", f: 150 }, { type: "LP", f: 5000 }] },
    { id: "water", name: "Sous l'eau", desc: "Étouffé, aquatique", icon: "M3 9c3-2 6 2 9 0s6-2 9 0M3 15c3-2 6 2 9 0s6-2 9 0", filters: [{ type: "LP", f: 600 }] },
    { id: "haas", name: "Stéréo Haas", desc: "Élargit la stéréo (retard 12 ms à droite)", icon: "M8 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M16 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0", haas: true },
];

export const EQ_PRESETS: Record<string, Band[]> = {
    "Voix claire": [{ f: 120, g: -3, q: 0.8 }, { f: 3000, g: 4, q: 1 }, { f: 10000, g: 2, q: 0.8 }],
    "Grave +": [{ f: 90, g: 6, q: 0.9 }, { f: 250, g: 2, q: 1 }],
    "Radio FM": [{ f: 100, g: 3, q: 1 }, { f: 2500, g: 5, q: 1.4 }, { f: 6000, g: 2, q: 1 }],
    "Présence": [{ f: 2200, g: 6, q: 1.2 }, { f: 5000, g: 3, q: 1 }],
    "Chaud": [{ f: 180, g: 4, q: 0.9 }, { f: 7000, g: -3, q: 1 }],
};

// ---------- DSP maths (RBJ biquads) ----------

function coeffs({ type, f, g = 0, q = 0.7071 }: Biquad) {
    const A = 10 ** (g / 40), w = 2 * Math.PI * f / FS, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
    switch (type) {
        case "PK": return [1 + al * A, -2 * cw, 1 - al * A, 1 + al / A, -2 * cw, 1 - al / A];
        case "LP": return [(1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + al, -2 * cw, 1 - al];
        case "HP": return [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + al, -2 * cw, 1 - al];
        case "LS": {
            const s = 2 * Math.sqrt(A) * al;
            return [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s),
                (A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s];
        }
        case "HS": {
            const s = 2 * Math.sqrt(A) * al;
            return [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s),
                (A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s];
        }
    }
}

function magDb(filters: Biquad[], f: number) {
    const w = 2 * Math.PI * f / FS;
    let db = 0;
    for (const bq of filters) {
        const [b0, b1, b2, a0, a1, a2] = coeffs(bq);
        const re = (c0: number, c1: number, c2: number) => c0 + c1 * Math.cos(w) + c2 * Math.cos(2 * w);
        const im = (c1: number, c2: number) => -(c1 * Math.sin(w) + c2 * Math.sin(2 * w));
        const num = Math.hypot(re(b0, b1, b2), im(b1, b2)), den = Math.hypot(re(a0, a1, a2), im(a1, a2));
        db += 20 * Math.log10(num / den);
    }
    return db;
}

function chain(bands: Band[], fx: string[]): Biquad[] {
    const out: Biquad[] = bands.map(b => ({ type: "PK", f: b.f, g: b.g, q: b.q }));
    for (const d of FX) if (fx.includes(d.id) && d.filters) out.push(...d.filters);
    return out;
}

const W = 760, H = 300, PAD_B = 22;
const xOf = (f: number) => Math.log10(f / F_MIN) / Math.log10(F_MAX / F_MIN) * W;
const fOf = (x: number) => F_MIN * (F_MAX / F_MIN) ** (Math.min(Math.max(x, 0), W) / W);
const yOf = (g: number) => (H - PAD_B) / 2 - g / G_MAX * ((H - PAD_B) / 2 - 10);
const gOf = (y: number) => Math.max(-G_MAX, Math.min(G_MAX, ((H - PAD_B) / 2 - y) / ((H - PAD_B) / 2 - 10) * G_MAX));
const fmtF = (f: number) => f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`;

function EqGraph({ bands, fx, onChange }: { bands: Band[]; fx: string[]; onChange(b: Band[]): void; }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const [sel, setSel] = useState<number>(-1);
    const drag = useRef<number>(-1);

    useEffect(() => {
        const c = ref.current; if (!c) return;
        const dpr = window.devicePixelRatio || 1;
        c.width = W * dpr; c.height = H * dpr;
        const ctx = c.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        // grid
        ctx.font = "10px sans-serif"; ctx.fillStyle = "rgba(200,190,255,.45)"; ctx.strokeStyle = "rgba(160,140,255,.10)";
        for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
            const x = xOf(f); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - PAD_B); ctx.stroke();
            ctx.fillText(fmtF(f), x - 8, H - 7);
        }
        for (const g of [12, 6, 0, -6, -12]) {
            const y = yOf(g); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            ctx.fillText(g > 0 ? `+${g}` : `${g}`, 6, y - 3);
        }
        // response curve
        const all = chain(bands, fx);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
            const y = yOf(Math.max(-G_MAX, Math.min(G_MAX, magDb(all, fOf(x)))));
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = "#c4b5fd"; ctx.lineWidth = 2.2; ctx.shadowColor = "#8b5cf6"; ctx.shadowBlur = 10; ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineTo(W, yOf(0)); ctx.lineTo(0, yOf(0)); ctx.closePath();
        ctx.fillStyle = "rgba(139,92,246,.12)"; ctx.fill();
        // points
        bands.forEach((b, i) => {
            ctx.beginPath(); ctx.arc(xOf(b.f), yOf(b.g), i === sel ? 7 : 5.5, 0, Math.PI * 2);
            ctx.fillStyle = i === sel ? "#ffffff" : "#c4b5fd"; ctx.fill();
            ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 2; ctx.stroke();
        });
    }, [bands, fx, sel]);

    const pos = (e: React.MouseEvent | React.WheelEvent) => {
        const r = ref.current!.getBoundingClientRect();
        return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };
    const hit = (x: number, y: number) => bands.findIndex(b => Math.hypot(xOf(b.f) - x, yOf(b.g) - y) < 10);

    return (
        <div className="uhq-graph">
            <canvas
                ref={ref}
                style={{ width: "100%", aspectRatio: `${W} / ${H}` }}
                onDoubleClick={e => {
                    const { x, y } = pos(e); const i = hit(x, y);
                    if (i >= 0) { onChange(bands.filter((_, j) => j !== i)); setSel(-1); }
                    else if (bands.length < 12) { onChange([...bands, { f: fOf(x), g: gOf(y), q: 1.2 }]); setSel(bands.length); }
                }}
                onMouseDown={e => { const { x, y } = pos(e); const i = hit(x, y); setSel(i); drag.current = i; }}
                onMouseMove={e => {
                    if (drag.current < 0) return;
                    const { x, y } = pos(e);
                    onChange(bands.map((b, j) => j === drag.current ? { ...b, f: fOf(x), g: gOf(y) } : b));
                }}
                onMouseUp={() => { drag.current = -1; }}
                onMouseLeave={() => { drag.current = -1; }}
                onWheel={e => {
                    if (sel < 0) return;
                    onChange(bands.map((b, j) => j === sel ? { ...b, q: Math.max(0.2, Math.min(10, b.q * (e.deltaY < 0 ? 1.12 : 0.89))) } : b));
                }}
            />
            {bands.length === 0 && <div className="uhq-graph-hint">Double-clique pour ajouter une bande</div>}
            <div className="uhq-band-info">
                {sel >= 0 && bands[sel]
                    ? <>Bande {sel + 1} — <b>{fmtF(bands[sel].f)} Hz</b> · <b>{bands[sel].g > 0 ? "+" : ""}{bands[sel].g.toFixed(1)} dB</b> · Q <b>{bands[sel].q.toFixed(2)}</b></>
                    : "Bande — Hz · dB · Q"}
            </div>
        </div>
    );
}

// ---------- state (kept in UHQ's settings) ----------

export interface FxState { on: boolean; preamp: number; pan: number; bands: Band[]; fx: string[]; }
const DEFAULT: FxState = { on: false, preamp: 0, pan: 0, bands: [], fx: [] };
const store = () => (Settings.plugins.UHQ ??= { enabled: true } as any) as any;
export const readFx = (): FxState => ({ ...DEFAULT, ...(store().effects ?? {}) });

export function buildConfig(s: FxState) {
    const lines = ["# Ultime Cord UHQ - fait par Sei (github.com/lyzral)", `Preamp: ${Math.max(-12, Math.min(12, s.preamp)).toFixed(1)} dB`];
    for (const bq of chain(s.bands, s.fx)) {
        const f = Math.round(bq.f);
        if (bq.type === "PK") lines.push(`Filter: ON PK Fc ${f} Hz Gain ${bq.g!.toFixed(1)} dB Q ${(bq.q ?? 1).toFixed(2)}`);
        else if (bq.type === "LS" || bq.type === "HS") lines.push(`Filter: ON ${bq.type} Fc ${f} Hz Gain ${bq.g!.toFixed(1)} dB`);
        else lines.push(`Filter: ON ${bq.type} Fc ${f} Hz`);
    }
    if (s.fx.includes("haas")) lines.push("Channel: R", "Delay: 12 ms", "Channel: all");
    // pan: only ever turns one side down (no phase flip, no extra gain)
    const p = Math.max(-100, Math.min(100, s.pan)) / 100;
    if (p !== 0) lines.push(`Copy: L=${Math.min(1, 1 - p).toFixed(2)}*L R=${Math.min(1, 1 + p).toFixed(2)}*R`);
    return lines.join("\n") + "\n";
}

let timer: ReturnType<typeof setTimeout> | undefined;
async function push(s: FxState) {
    try {
        if (s.on) await Native.apply(buildConfig(s));
        else await Native.disable();
    } catch (e) { showToast(`UHQ : ${(e as Error).message}`, Toasts.Type.FAILURE); }
}
function save(s: FxState) {
    store().effects = s;
    clearTimeout(timer);
    timer = setTimeout(() => push(s), 200);
}

const Svg = ({ d, size = 18 }: { d: string; size?: number; }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export function EffectsSection() {
    const [s, setS] = useState<FxState>(readFx);
    const [apo, setApo] = useState<boolean | null>(null);
    useEffect(() => { Native.status().then(r => setApo(r.installed)).catch(() => setApo(false)); }, []);
    const set = (patch: Partial<FxState>) => { const next = { ...s, ...patch }; setS(next); save(next); };

    return (
        <div className="uhq-card uhq-fxcard">
            <div className="uhq-card-title">
                <Svg d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" size={15} /> EFFETS SUR TA VOIX
                <button className={`uhq-switch ${s.on ? "on" : ""}`} style={{ marginLeft: "auto" }} onClick={() => set({ on: !s.on })}><i /></button>
            </div>
            {apo === false && <div className="uhq-warn">Equalizer APO n'est pas installé : ces effets passent par lui (c'est lui qui touche ton micro).</div>}

            <EqGraph bands={s.bands} fx={s.fx} onChange={bands => set({ bands })} />
            <div className="uhq-help"><b>Double-clic</b> = ajouter / retirer une bande · <b>glisser</b> = fréquence + gain · <b>molette</b> = largeur</div>

            <div className="uhq-presets">
                {Object.keys(EQ_PRESETS).map(n => <button key={n} className="uhq-preset" onClick={() => set({ bands: EQ_PRESETS[n] })}>{n}</button>)}
                <button className="uhq-preset" onClick={() => set({ bands: [] })}>Vider l'EQ</button>
            </div>

            <div className="uhq-row">
                <span className="uhq-row-label">Gain</span>
                <input className="uhq-slider" type="range" min={-12} max={12} step={0.5} value={s.preamp} style={{ ["--p" as any]: `${(s.preamp + 12) / 24 * 100}%` }} onChange={e => set({ preamp: Number(e.currentTarget.value) })} />
                <b className="uhq-row-val">{s.preamp > 0 ? "+" : ""}{s.preamp.toFixed(1)} dB</b>
            </div>
            <div className="uhq-row">
                <span className="uhq-row-label">Pan de ta voix</span>
                <input className="uhq-slider" type="range" min={-100} max={100} step={5} value={s.pan} style={{ ["--p" as any]: `${(s.pan + 100) / 2}%` }} onChange={e => set({ pan: Number(e.currentTarget.value) })} onDoubleClick={() => set({ pan: 0 })} />
                <b className="uhq-row-val">{s.pan === 0 ? "centre" : s.pan < 0 ? `G ${-s.pan}%` : `D ${s.pan}%`}</b>
            </div>

            <div className="uhq-grid">
                {FX.map(d => {
                    const on = s.fx.includes(d.id);
                    return (
                        <div key={d.id} className={`uhq-fx ${on ? "on" : ""}`} onClick={() => set({ fx: on ? s.fx.filter(x => x !== d.id) : [...s.fx, d.id] })}>
                            <div className="uhq-fx-icon"><Svg d={d.icon} /></div>
                            <div className="uhq-fx-text"><b>{d.name}</b><span>{d.desc}</span></div>
                            <div className={`uhq-switch ${on ? "on" : ""}`}><i /></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function applyFxOnStart() { const s = readFx(); if (s.on) push(s); }
