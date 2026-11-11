/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { Settings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher, IconUtils, UserStore, useState } from "@webpack/common";

import style from "./glass.css?managed";

// The moving backdrop: your avatar, blown up, blurred and slowly warped (Miragefy does the same with the cover art)
function setFluid(on: boolean) {
    document.getElementById("gf-fluid")?.remove();
    document.getElementById("gf-fluid-veil")?.remove();
    if (!on) return;
    const user = UserStore.getCurrentUser();
    const url = user ? IconUtils.getUserAvatarURL(user, true, 512) : "";
    const fluid = document.createElement("div");
    fluid.id = "gf-fluid";
    fluid.style.backgroundImage = url
        ? `url("${url}")`
        : "radial-gradient(circle at 20% 20%, #4b5272, transparent 60%), radial-gradient(circle at 80% 60%, #3f4560, transparent 60%)";
    const veil = document.createElement("div");
    veil.id = "gf-fluid-veil";
    document.body.prepend(veil);
    document.body.prepend(fluid);
}

function apply(on: boolean) {
    if (on) enableStyle(style); else disableStyle(style);
    setFluid(on);
}

const store = () => Settings.plugins.GlassFluid as any;
const isOn = () => store()?.themeOn === true;
export const isGlassFluidOn = isOn;
export function setGlassFluid(on: boolean) { store().themeOn = on; apply(on); rerender(); }
let rerender = () => { };
const onUser = () => { if (isOn()) setFluid(true); };

function ToggleButton() {
    const [on, setOn] = useState(isOn());
    rerender = () => setOn(isOn());
    return (
        <HeaderBarButton
            tooltip={on ? "Glass Fluid : activé" : "Glass Fluid : désactivé"}
            selected={on}
            icon={() => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2.7c3.3 3.7 6 7 6 10.3a6 6 0 0 1-12 0c0-3.3 2.7-6.6 6-10.3z" />
                    <path d="M9 14a3 3 0 0 0 3 3" opacity="0.6" />
                </svg>
            )}
            onClick={() => {
                const next = !on;
                store().themeOn = next;
                setOn(next);
                apply(next);
            }}
        />
    );
}

export default definePlugin({
    name: "GlassFluid",
    description: "Le look Miragefy pour Discord : noir profond, ta photo de profil en fond fluide animé, panneaux en verre, onglets en pilules. Bouton en haut pour l'allumer ou l'éteindre. Fait par Sei.",
    tags: ["Appearance"],
    authors: [Devs.Sei],
    enabledByDefault: true,
    start() {
        addHeaderBarButton("ultimecord-glassfluid", () => <ToggleButton />, 99);
        apply(isOn());
        FluxDispatcher.subscribe("CURRENT_USER_UPDATE", onUser);
        FluxDispatcher.subscribe("CONNECTION_OPEN", onUser);
    },
    stop() {
        removeHeaderBarButton("ultimecord-glassfluid");
        FluxDispatcher.unsubscribe("CURRENT_USER_UPDATE", onUser);
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", onUser);
        apply(false);
    },
});
