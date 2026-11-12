/*
 * Ultime Cord, a Discord client mod
 * Copyright (c) 2026 Sei and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { Card } from "@components/Card";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

// PlatformSpoofer rewrites the same line of Discord's code, so only one of the two can apply
const spooferIsOn = () => isPluginEnabled("PlatformSpoofer");

export default definePlugin({
    name: "VRMod",
    description: "Shows you as connected from a VR headset: the headset icon replaces the dot of your status for everyone.",
    tags: ["Appearance", "Fun"],
    searchTerms: ["vr", "quest", "headset", "status", "platform"],
    authors: [Devs.Sei],

    settingsAboutComponent: () => (
        <Card variant="warning" defaultPadding>
            {spooferIsOn()
                ? "PlatformSpoofer is on and decides your platform. Turn it off (or pick VR in it) for VRMod to apply."
                : "Restart Discord after turning this on or off. Discord sees a VR client, which we can't guarantee is risk-free for your account."}
        </Card>
    ),

    patches: [
        {
            find: "_doIdentify(){",
            predicate: () => !spooferIsOn(),
            replacement: [
                {
                    // A resumed session keeps the platform it was opened with, so the first connection is a fresh one
                    match: /window._ws=null,null!=\i/,
                    replace: "false"
                },
                {
                    match: /(?<="GatewaySocket"\)\}\),properties:)(\i)/,
                    replace: "{...$1,browser:\"Discord VR\"}"
                }
            ]
        }
    ]
});
