/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { showToast, Toasts, UserStore, useState } from "@webpack/common";

const Native = new Proxy({}, { get: (_, k) => (EndcordNative.pluginHelpers.CustomWidget as any)[k] }) as PluginNative<typeof import("./native")>;

// ---------- what the widget is made of ----------
// Every field is sent as a "User Data" key. In the Developer Portal's widget editor, set each field's Value Type to
// User Data and type the key shown here: the editor below then drives the real widget.

type Kind = "text" | "number" | "image";
interface FieldDef { key: string; label: string; kind: Kind; hint?: string; }

const TOP: FieldDef[] = [
    { key: "image", label: "Image", kind: "image" },
    { key: "title", label: "Titre", kind: "text" },
    { key: "subtitle_1", label: "Sous-titre 1", kind: "text" },
    { key: "subtitle_2", label: "Sous-titre 2", kind: "text" },
    { key: "subtitle_3", label: "Sous-titre 3", kind: "text" },
];
const STATS: FieldDef[] = [1, 2, 3, 4, 5, 6].flatMap(i => [
    { key: `stat_${i}_value`, label: `Stat ${i} · valeur`, kind: "text" as Kind },
    { key: `stat_${i}_label`, label: `Stat ${i} · libellé`, kind: "text" as Kind },
    { key: `stat_${i}_icon`, label: `Stat ${i} · icône`, kind: "image" as Kind },
]);
const PROGRESS: FieldDef[] = [
    { key: "progress_icon", label: "Icône", kind: "image" },
    { key: "progress_name", label: "Objectif", kind: "text" },
    { key: "progress_desc", label: "Description", kind: "text" },
    { key: "progress_current", label: "Valeur actuelle", kind: "number" },
    { key: "progress_max", label: "Valeur max", kind: "number" },
];
const COLLECTION: FieldDef[] = [1, 2, 3, 4].flatMap(i => [
    { key: `item_${i}_image`, label: `Élément ${i} · image`, kind: "image" as Kind },
    { key: `item_${i}_name`, label: `Élément ${i} · nom`, kind: "text" as Kind },
    { key: `item_${i}_desc`, label: `Élément ${i} · description`, kind: "text" as Kind },
]);

type TopLayout = "hero" | "contained";
type BottomLayout = "stats" | "progress" | "collection";
const BOTTOM_FIELDS: Record<BottomLayout, FieldDef[]> = { stats: STATS, progress: PROGRESS, collection: COLLECTION };

const settings = definePluginSettings({
    editor: { type: OptionType.COMPONENT, component: () => <Studio /> },
}).withPrivateSettings<{
    appId?: string; botToken?: string; clientSecret?: string; redirectUri?: string; appName?: string; appIcon?: string; authorized?: boolean; published?: boolean; guideDone?: boolean;
    top?: TopLayout; bottom?: BottomLayout; values?: Record<string, string>;
}>();

const isUrl = (s?: string) => !!s && /^https:\/\/\S+$/i.test(s.trim());

function buildPayload(values: Record<string, string>, fields: FieldDef[]) {
    const dynamic: any[] = [];
    for (const f of fields) {
        const v = (values[f.key] ?? "").trim();
        if (!v) continue;
        if (f.kind === "image") { if (isUrl(v)) dynamic.push({ type: 3, name: f.key, value: { url: v } }); }
        else if (f.kind === "number" && isFinite(Number(v.replace(",", ".")))) dynamic.push({ type: 2, name: f.key, value: Number(v.replace(",", ".")) });
        else dynamic.push({ type: 1, name: f.key, value: v.slice(0, 256) });
    }
    return { data: { primary: {}, dynamic: dynamic.slice(0, 30) } };
}

function errorText(status: number, body: any) {
    if (status === 0) return String(body);
    if (status === 401) return "Token du bot refusé";
    if (status === 403) return "Discord refuse : ton appli n'a pas encore accès aux widgets (jeu non revendiqué ou Social SDK pas activé)";
    if (status === 404) return "Rien trouvé : autorise d'abord ton compte";
    return `Erreur ${status} : ${typeof body === "string" ? body : body?.message ?? JSON.stringify(body)}`;
}

// ---------- small pieces ----------

const Ico = ({ d, size = 16 }: { d: string; size?: number; }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const IC = {
    img: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1 1 0 1 0 0-.01",
    text: "M5 6h14M12 6v13M9 19h6",
    num: "M5 9h14M5 15h14M10 4L8 20M16 4l-2 16",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    key: "M15 7a4 4 0 1 1-4 4M11 11l-7 7v2h3l1-1v-2h2l1-1",
    link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
    send: "M4 12l16-8-6 16-3-7z",
    down: "M12 4v12M6 10l6 6 6-6M5 20h14",
    code: "M8 7l-5 5 5 5M16 7l5 5-5 5",
    chev: "M6 9l6 6 6-6",
};
const kindIcon = (k: Kind) => k === "image" ? IC.img : k === "number" ? IC.num : IC.text;

function Img({ src, className }: { src?: string; className?: string; }) {
    return isUrl(src) ? <img className={className} src={src!.trim()} alt="" /> : <div className={`${className ?? ""} ucw-ph`} />;
}

function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => showToast("Copié", Toasts.Type.SUCCESS), () => { });
}

// ---------- live preview, drawn like Discord's profile widgets ----------

function Preview({ top, bottom, v, app, sel, onPick }: { top: TopLayout; bottom: BottomLayout; v: Record<string, string>; app: { name: string; icon?: string; }; sel: string; onPick(k: string): void; }) {
    const pick = (k: string) => ({ className: `ucw-hit ${sel === k ? "on" : ""}`, onClick: (e: React.MouseEvent) => { e.stopPropagation(); onPick(k); } });
    const txt = (k: string, fallback: string) => v[k]?.trim() || <span className="ucw-empty">{fallback}</span>;
    const pct = Math.max(0, Math.min(100, (Number(v.progress_current) || 0) / (Number(v.progress_max) || 100) * 100));

    return (
        <div className={`ucw-widget ${top}`}>
            {top === "hero" && <div onClick={pick("image").onClick} className={`ucw-hero-bg ucw-hit ${sel === "image" ? "on" : ""}`}><Img src={v.image} /></div>}
            <div className="ucw-w-head">
                <Img className="ucw-w-appicon" src={app.icon} />
                <b>{app.name || "Mon appli"}</b>
                <span className="ucw-w-dots">•••</span>
            </div>
            <div className="ucw-w-top">
                <div className="ucw-w-text">
                    <div {...pick("title")}><h2>{txt("title", "Titre")}</h2></div>
                    {["subtitle_1", "subtitle_2", "subtitle_3"].map((k, i) => (v[k]?.trim() || sel === k || i === 0) && (
                        <div key={k} {...pick(k)}><p>{txt(k, `Sous-titre ${i + 1}`)}</p></div>
                    ))}
                </div>
                {top === "contained" && <div {...pick("image")}><Img className="ucw-w-cover" src={v.image} /></div>}
            </div>
            <div className="ucw-w-bottom">
                {bottom === "stats" && (
                    <div className="ucw-w-stats">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="ucw-w-stat">
                                <div {...pick(`stat_${i}_icon`)}><Img className="ucw-w-sicon" src={v[`stat_${i}_icon`]} /></div>
                                <div>
                                    <div {...pick(`stat_${i}_value`)}><b>{txt(`stat_${i}_value`, "Valeur")}</b></div>
                                    <div {...pick(`stat_${i}_label`)}><span>{txt(`stat_${i}_label`, "Libellé")}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {bottom === "progress" && (
                    <div className="ucw-w-progress">
                        <div {...pick("progress_icon")}><Img className="ucw-w-picon" src={v.progress_icon} /></div>
                        <div className="ucw-w-pbody">
                            <div {...pick("progress_current")}><div className="ucw-w-pbar"><i style={{ width: `${pct}%` }} /></div></div>
                            <div className="ucw-w-prow">
                                <div {...pick("progress_name")}><b>{txt("progress_name", "Objectif")}</b></div>
                                <div {...pick("progress_max")}><em>{v.progress_current || 0}/{v.progress_max || 100}</em></div>
                            </div>
                            <div {...pick("progress_desc")}><span>{txt("progress_desc", "Description")}</span></div>
                        </div>
                    </div>
                )}
                {bottom === "collection" && (
                    <div className="ucw-w-coll">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="ucw-w-item">
                                <div {...pick(`item_${i}_image`)}><Img className="ucw-w-iimg" src={v[`item_${i}_image`]} /></div>
                                <div>
                                    <div {...pick(`item_${i}_name`)}><b>{txt(`item_${i}_name`, "Nom")}</b></div>
                                    <div {...pick(`item_${i}_desc`)}><span>{txt(`item_${i}_desc`, "Description")}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------- the studio ----------

const LAYOUTS: { id: TopLayout | BottomLayout; zone: "top" | "bottom"; name: string; desc: string; }[] = [
    { id: "hero", zone: "top", name: "Hero", desc: "Image en fond, texte par-dessus" },
    { id: "contained", zone: "top", name: "Contained", desc: "Texte à gauche, image à droite" },
    { id: "stats", zone: "bottom", name: "Stats", desc: "6 cases valeur + libellé" },
    { id: "progress", zone: "bottom", name: "Progression", desc: "Une barre avec objectif" },
    { id: "collection", zone: "bottom", name: "Collection", desc: "4 éléments avec image" },
];

function LayoutThumb({ id }: { id: string; }) {
    return <div className={`ucw-thumb t-${id}`}><i /><i /><i /><i /><i /><i /></div>;
}

const PORTAL = "https://discord.com/developers/applications";
const openUrl = (url: string) => EndcordNative.native.openExternal(url);

interface Step { title: string; done: boolean; body: React.ReactNode; }

function Guide({ s }: { s: Partial<typeof settings.store>; }) {
    const hasId = /^\d{17,20}$/.test(s.appId ?? "");
    const appUrl = hasId ? `${PORTAL}/${s.appId}` : PORTAL;
    const steps: Step[] = [
        { title: "Crée ton appli Discord", done: hasId, body: <>Dans le <a onClick={() => openUrl(PORTAL)}>Developer Portal</a>, clique <b>New Application</b>, donne-lui un nom (il s'affiche en haut du widget) et une icône. Copie l'<b>Application ID</b> (General Information) dans « ID de l'appli ».</> },
        { title: "Récupère le token du bot", done: !!s.botToken, body: <>Onglet <a onClick={() => openUrl(`${appUrl}/bot`)}>Bot</a> › <b>Reset Token</b>, puis colle-le dans « Token du bot ». Ne le donne à personne.</> },
        { title: "Client Secret et redirection", done: !!s.clientSecret, body: <>Onglet <a onClick={() => openUrl(`${appUrl}/oauth2`)}>OAuth2</a> : copie le <b>Client Secret</b> dans le champ du même nom. Dans <b>Redirects</b>, ajoute <code>http://127.0.0.1:53134/callback</code> puis <b>Save Changes</b>.</> },
        { title: "Active le Social SDK et revendique le jeu", done: !!s.authorized || !!s.published, body: <>Menu de ton appli : <b>Social SDK › Getting Started</b>, remplis le formulaire (vraies infos) et accepte les conditions. Puis <b>Games › Game Claiming</b> pour revendiquer l'appli comme jeu. C'est ce qui débloque <b>Games › Widget</b>.</> },
        { title: "Dessine le widget dans le Portal", done: !!s.published, body: <><b>Games › Widget</b> : pour chaque surface (Widget Top, Widget Bottom, Mini Profile…), choisis une mise en page. Pour chaque champ, mets <b>Value Type › User Data</b> et colle la clé que ce studio affiche à droite. Puis <b>Save changes</b> et surtout <b>Publish</b>.</> },
        { title: "Autorise ton compte", done: !!s.authorized, body: <>Ouvre « Connecte ton appli » plus bas et clique <b>Autoriser mon compte</b>. Valide dans le navigateur : la page « Compte autorisé ✓ » doit s'afficher.</> },
        { title: "Remplis et publie", done: !!s.published, body: <>Prends les mêmes mises en page que dans le Portal, remplis les champs dans l'aperçu, puis <b>Publier sur mon profil</b>. Enfin, sur ton profil : <b>Tableau</b>, ajoute ton widget.</> },
    ];
    const doneCount = steps.filter(x => x.done).length;
    const [isOpen, setOpen] = useState(!s.guideDone && doneCount < steps.length);
    const next = steps.findIndex(x => !x.done);
    return (
        <div className={`ucw-guide ${isOpen ? "open" : ""}`}>
            <button className="ucw-conn-head" onClick={() => setOpen(!isOpen)}>
                <span className="ucw-guide-ring" style={{ ["--p" as any]: `${doneCount / steps.length * 100}%` }}><b>{doneCount}/{steps.length}</b></span>
                <b>Guide : ton widget sur ton profil</b>
                <span className="ucw-conn-sub">{next < 0 ? "Tout est prêt" : `Prochaine étape : ${steps[next].title}`}</span>
                <span className="ucw-chev"><Ico d={IC.chev} /></span>
            </button>
            {isOpen && (
                <ol className="ucw-steps">
                    {steps.map((st, i) => (
                        <li key={i} className={`${st.done ? "done" : ""} ${i === next ? "next" : ""}`}>
                            <span className="ucw-step-n">{st.done ? "✓" : i + 1}</span>
                            <div><b>{st.title}</b><p>{st.body}</p></div>
                        </li>
                    ))}
                    <li className="ucw-guide-foot">
                        <span>« Publier » répond <b>403</b> ? Refais l'étape 6, ou vérifie l'étape 4. Le widget n'apparaît dans ton Tableau qu'une fois publié dans le Portal.</span>
                        <button className="ucw-btn ghost" onClick={() => { settings.store.guideDone = true; setOpen(false); }}>Masquer</button>
                    </li>
                </ol>
            )}
        </div>
    );
}

function Studio() {
    const s = settings.use(["authorized", "published", "guideDone", "appId", "botToken", "clientSecret", "redirectUri", "appName", "appIcon", "top", "bottom", "values"]);
    const top = s.top ?? "contained", bottom = s.bottom ?? "stats";
    const values = s.values ?? {};
    const fields = [...TOP, ...BOTTOM_FIELDS[bottom]];
    const [sel, setSel] = useState("title");
    const [conn, setConn] = useState(!s.appId || !s.botToken);
    const [showToken, setShowToken] = useState(false);
    const [json, setJson] = useState(false);
    const [busy, setBusy] = useState(false);
    const me = UserStore.getCurrentUser();
    const ready = /^\d{17,20}$/.test(s.appId ?? "") && !!s.botToken;
    const field = fields.find(f => f.key === sel) ?? fields[1];
    const setVal = (k: string, v: string) => { settings.store.values = { ...values, [k]: v }; };
    const filled = fields.filter(f => values[f.key]?.trim()).length;

    const [authing, setAuthing] = useState(false);
    const authorize = async () => {
        if (!/^\d{17,20}$/.test(s.appId ?? "")) return showToast("Mets d'abord l'ID de ton appli", Toasts.Type.FAILURE);
        if (!s.clientSecret) return showToast("Colle le Client Secret (OAuth2 dans le Portal)", Toasts.Type.FAILURE);
        setAuthing(true);
        showToast("Valide l'autorisation dans ton navigateur", Toasts.Type.MESSAGE);
        try {
            const r = await Native.authorize(s.appId!, s.clientSecret!);
            if (r.ok) settings.store.authorized = true;
            showToast(r.ok ? "Compte autorisé ✓ Tu peux publier" : `Autorisation : ${typeof r.body === "string" ? r.body : r.body?.error_description ?? r.status}`, r.ok ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE);
        } finally { setAuthing(false); }
    };

    const run = async (kind: "publish" | "read") => {
        if (!ready || !me) return;
        setBusy(true);
        try {
            const r = kind === "publish"
                ? await Native.publish(s.appId!, s.botToken!, me.id, buildPayload(values, fields))
                : await Native.read(s.appId!, s.botToken!, me.id);
            if (!r.ok && r.status === 403) settings.store.authorized = false;
            if (!r.ok) return showToast(errorText(r.status, r.body), Toasts.Type.FAILURE);
            if (kind === "publish") { settings.store.published = true; return showToast("Widget publié sur ton profil", Toasts.Type.SUCCESS); }
            const next: Record<string, string> = { ...values };
            for (const d of r.body?.data?.dynamic ?? []) next[d.name] = typeof d.value === "object" ? d.value?.url ?? "" : String(d.value);
            settings.store.values = next;
            showToast("Widget chargé depuis Discord", Toasts.Type.SUCCESS);
        } catch (e) {
            showToast(`Échec : ${(e as Error).message}`, Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="ucw">
            <Guide s={s} />
            {/* connection */}
            <div className={`ucw-conn ${conn ? "open" : ""}`}>
                <button className="ucw-conn-head" onClick={() => setConn(!conn)}>
                    <span className={`ucw-dot ${ready ? "ok" : ""}`} />
                    <b>{ready ? s.appName || "Appli connectée" : "Connecte ton appli Discord"}</b>
                    <span className="ucw-conn-sub">{ready ? `ID ${s.appId}` : "ID + token du bot, une seule fois"}</span>
                    <span className="ucw-chev"><Ico d={IC.chev} /></span>
                </button>
                {conn && (
                    <div className="ucw-conn-body">
                        <p className="ucw-help">Dans le <a onClick={() => EndcordNative.native.openExternal("https://discord.com/developers/applications")}>Developer Portal</a> : Social SDK activé, jeu revendiqué, ajoute la redirection ci-dessous dans <b>OAuth2 › Redirects</b>. Token et secret restent sur ce PC.</p>
                        <div className="ucw-row3">
                            <label className="ucw-in"><span>ID de l'appli</span><input value={s.appId ?? ""} placeholder="123456789012345678" onChange={e => settings.store.appId = e.currentTarget.value.trim()} /></label>
                            <label className="ucw-in"><span>Token du bot</span>
                                <div className="ucw-secret"><input type={showToken ? "text" : "password"} value={s.botToken ?? ""} onChange={e => settings.store.botToken = e.currentTarget.value.trim()} /><button onClick={() => setShowToken(!showToken)}>{showToken ? "Cacher" : "Voir"}</button></div>
                            </label>
                            <label className="ucw-in"><span>Client Secret</span><input type={showToken ? "text" : "password"} value={s.clientSecret ?? ""} onChange={e => settings.store.clientSecret = e.currentTarget.value.trim()} /></label>
                            <label className="ucw-in"><span>Redirect à ajouter (OAuth2)</span>
                                <div className="ucw-secret"><input readOnly value="http://127.0.0.1:53134/callback" /><button onClick={() => copy("http://127.0.0.1:53134/callback")}>Copier</button></div>
                            </label>
                            <label className="ucw-in"><span>Nom affiché (aperçu)</span><input value={s.appName ?? ""} placeholder="Mon appli" onChange={e => settings.store.appName = e.currentTarget.value} /></label>
                            <label className="ucw-in"><span>Icône de l'appli (aperçu)</span><input value={s.appIcon ?? ""} placeholder="https://…" onChange={e => settings.store.appIcon = e.currentTarget.value} /></label>
                        </div>
                        <div className="ucw-btns"><button className="ucw-btn" disabled={authing} onClick={authorize}><Ico d={IC.link} /> {authing ? "En attente du navigateur…" : "Autoriser mon compte"}</button></div>
                    </div>
                )}
            </div>

            <div className="ucw-studio">
                {/* left: layouts + fields */}
                <aside className="ucw-left">
                    <h5>Haut du widget</h5>
                    {LAYOUTS.filter(l => l.zone === "top").map(l => (
                        <button key={l.id} className={`ucw-layout ${top === l.id ? "on" : ""}`} onClick={() => settings.store.top = l.id as TopLayout}>
                            <LayoutThumb id={l.id} /><div><b>{l.name}</b><span>{l.desc}</span></div>
                        </button>
                    ))}
                    <h5>Bas du widget</h5>
                    {LAYOUTS.filter(l => l.zone === "bottom").map(l => (
                        <button key={l.id} className={`ucw-layout ${bottom === l.id ? "on" : ""}`} onClick={() => settings.store.bottom = l.id as BottomLayout}>
                            <LayoutThumb id={l.id} /><div><b>{l.name}</b><span>{l.desc}</span></div>
                        </button>
                    ))}
                    <h5>Champs <em>{filled}/{fields.length}</em></h5>
                    <div className="ucw-fields">
                        {fields.map(f => (
                            <button key={f.key} className={`ucw-fieldbtn ${sel === f.key ? "on" : ""}`} onClick={() => setSel(f.key)}>
                                <Ico d={kindIcon(f.kind)} size={13} /><span>{f.label}</span>{values[f.key]?.trim() && <i />}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* center: preview */}
                <main className="ucw-stage">
                    <div className="ucw-stage-bar"><span>Aperçu en direct</span><em>Clique un élément pour le modifier</em></div>
                    <div className="ucw-stage-canvas">
                        <Preview top={top} bottom={bottom} v={values} app={{ name: s.appName ?? "", icon: s.appIcon }} sel={sel} onPick={setSel} />
                    </div>
                </main>

                {/* right: inspector */}
                <aside className="ucw-right">
                    <div className="ucw-insp-head">
                        <span className="ucw-kind"><Ico d={kindIcon(field.kind)} size={14} /></span>
                        <div><b>{field.label}</b><span>{field.kind === "image" ? "Image" : field.kind === "number" ? "Nombre" : "Texte"}</span></div>
                    </div>
                    <label className="ucw-in">
                        <span>{field.kind === "image" ? "Lien de l'image" : "Contenu"}</span>
                        {field.kind === "text" && field.key.startsWith("subtitle") || field.key.endsWith("desc")
                            ? <textarea rows={3} value={values[field.key] ?? ""} onChange={e => setVal(field.key, e.currentTarget.value)} />
                            : <input type={field.kind === "number" ? "number" : "text"} value={values[field.key] ?? ""} placeholder={field.kind === "image" ? "https://…" : ""} onChange={e => setVal(field.key, e.currentTarget.value)} />}
                    </label>
                    {field.kind === "image" && <div className="ucw-imgprev"><Img src={values[field.key]} /></div>}
                    {field.kind === "image" && values[field.key] && !isUrl(values[field.key]) && <p className="ucw-warn">Il faut un lien https public : Discord va chercher l'image lui-même.</p>}

                    <div className="ucw-keybox">
                        <span>Dans le Portal : <b>Value Type › User Data</b>, Data Field :</span>
                        <button onClick={() => copy(field.key)}><code>{field.key}</code><Ico d={IC.copy} size={13} /></button>
                    </div>
                    {values[field.key] && <button className="ucw-clear" onClick={() => setVal(field.key, "")}>Vider ce champ</button>}
                </aside>
            </div>

            {json && <pre className="ucw-json">{JSON.stringify(buildPayload(values, fields), null, 2)}</pre>}

            <div className="ucw-foot">
                <button className="ucw-btn ghost" onClick={() => setJson(!json)}><Ico d={IC.code} /> {json ? "Cacher le JSON" : "Voir le JSON"}</button>
                <button className="ucw-btn ghost" disabled={!ready || busy} onClick={() => run("read")}><Ico d={IC.down} /> Charger depuis Discord</button>
                <span className="ucw-grow" />
                <button className="ucw-btn primary" disabled={!ready || busy} onClick={() => run("publish")}><Ico d={IC.send} /> {busy ? "Envoi…" : "Publier sur mon profil"}</button>
            </div>
        </div>
    );
}

export default definePlugin({
    name: "CustomWidget",
    description: "Comme Custom RPC, mais pour les widgets du profil : un studio pour remplir le widget de ta propre appli Discord (titre, images, stats, progression, collection) avec un aperçu en direct. Tout le monde le voit sur ton profil. Passe par l'API officielle des Game Stats Widgets. Fait par Sei.",
    tags: ["Customisation"],
    authors: [Devs.Sei],
    settings,
});
