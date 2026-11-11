/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "DisconnectUser",
    description: "Adds a context menu entry to auto-disconnect a user when they join voice",
    authors: [{ name: "FCord", id: 0n }],
    patches: [],
    start() {},
    stop() {},
});
