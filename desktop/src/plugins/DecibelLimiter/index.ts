/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "DecibelLimiter",
    description: "Automatically cuts off audio peaks that are too loud in voice calls",
    authors: [{ name: "FCord", id: 0n }],
    patches: [],
    start() {},
    stop() {},
});
