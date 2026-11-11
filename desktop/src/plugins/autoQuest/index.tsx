/*
 * Ultime Cord, a Discord client mod
 * Copyright (c) 2026 Sei and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps } from "@webpack";
import {
    ApplicationStreamingStore,
    Button,
    ChannelStore,
    FluxDispatcher,
    GuildChannelStore,
    RunningGameStore,
    showToast,
    Toasts,
} from "@webpack/common";

const logger = new Logger("AutoQuest");

interface QuestTaskData {
    target: number;
    applications?: { id: string; }[];
}
interface QuestTaskConfig {
    tasks: Record<string, QuestTaskData>;
}
interface Quest {
    id: string;
    userStatus?: { enrolledAt?: string; completedAt?: string; progress?: Record<string, { value: number; }>; };
    config: {
        expiresAt: string;
        configVersion: number;
        application?: { id: string; };
        messages: { questName: string; };
        taskConfig?: QuestTaskConfig;
        taskConfigV2?: QuestTaskConfig;
    };
}

const SUPPORTED_TASKS = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];

const QuestsStore = findByProps("getQuest", "quests") as { quests: Map<string, Quest>; };
const Api = findByProps("getAPIBaseURL", "get", "post") as {
    get(opts: { url: string; }): Promise<{ body: any; }>;
    post(opts: { url: string; body: any; }): Promise<{ body: any; }>;
};

function getEligibleQuests(): Quest[] {
    if (!QuestsStore?.quests) return [];
    const now = Date.now();
    return [...QuestsStore.quests.values()].filter(q => {
        if (!q.userStatus?.enrolledAt || q.userStatus.completedAt) return false;
        if (new Date(q.config.expiresAt).getTime() <= now) return false;
        const taskConfig = q.config.taskConfig ?? q.config.taskConfigV2;
        return !!taskConfig && SUPPORTED_TASKS.some(t => t in taskConfig.tasks);
    });
}

let running = false;
let stopRequested = false;

async function runVideoQuest(quest: Quest, taskName: string, taskData: QuestTaskData, log: (s: string) => void) {
    const SPEED = 7;
    let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
    const secondsNeeded = taskData.target;
    let completed = false;

    while (!stopRequested) {
        const remaining = Math.min(SPEED, secondsNeeded - secondsDone);
        await new Promise(r => setTimeout(r, remaining * 1000));

        const timestamp = secondsDone + SPEED;
        const res = await Api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) } });
        completed = res.body.completed_at != null;
        secondsDone = Math.min(secondsNeeded, timestamp);
        log(`${quest.config.messages.questName}: ${Math.round(secondsDone)}/${secondsNeeded}s`);

        if (timestamp >= secondsNeeded) break;
    }
    if (!completed && !stopRequested) await Api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
}

async function runDesktopPlayQuest(quest: Quest, taskData: QuestTaskData, log: (s: string) => void) {
    const applicationId = quest.config.application?.id ?? taskData.applications?.[0]?.id;
    if (!applicationId) return;
    const secondsNeeded = taskData.target;

    const res = await Api.get({ url: `/applications/public?application_ids=${applicationId}` });
    const appData = res.body[0];
    const exeName = appData.executables?.find((x: any) => x.os === "win32")?.name?.replace(">", "") ?? appData.name.replace(/[/\\:*?"<>|]/g, "");
    const pid = Math.floor(Math.random() * 30000) + 1000;

    const fakeGame = {
        cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
        exeName,
        exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
        hidden: false,
        isLauncher: false,
        id: applicationId,
        name: appData.name,
        pid,
        pidPath: [pid],
        processName: appData.name,
        start: Date.now(),
    };

    const realGames = RunningGameStore.getRunningGames();
    const realGetRunningGames = RunningGameStore.getRunningGames;
    const realGetGameForPID = RunningGameStore.getGameForPID;
    (RunningGameStore as any).getRunningGames = () => [fakeGame];
    (RunningGameStore as any).getGameForPID = (p: number) => (p === pid ? fakeGame : null);
    FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: [fakeGame] } as any);

    log(`Spoofing ${appData.name} for ${quest.config.messages.questName} (~${Math.ceil(secondsNeeded / 60)} min)`);

    await new Promise<void>(resolve => {
        const onHeartbeat = (data: any) => {
            const progress = quest.config.configVersion === 1
                ? data.userStatus.streamProgressSeconds
                : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
            log(`${quest.config.messages.questName}: ${progress}/${secondsNeeded}s`);
            if (progress >= secondsNeeded || stopRequested) {
                RunningGameStore.getRunningGames = realGetRunningGames;
                RunningGameStore.getGameForPID = realGetGameForPID;
                FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] } as any);
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
                resolve();
            }
        };
        FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
    });
}

async function runStreamQuest(quest: Quest, taskData: QuestTaskData, log: (s: string) => void) {
    const applicationId = quest.config.application?.id ?? taskData.applications?.[0]?.id;
    const secondsNeeded = taskData.target;
    const pid = Math.floor(Math.random() * 30000) + 1000;

    const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
    (ApplicationStreamingStore as any).getStreamerActiveStreamMetadata = () => ({ id: applicationId, pid, sourceName: null });

    log(`Spoofed stream for ${quest.config.messages.questName}. Stream any window in a voice channel with someone else present (~${Math.ceil(secondsNeeded / 60)} min).`);

    await new Promise<void>(resolve => {
        const onHeartbeat = (data: any) => {
            const progress = quest.config.configVersion === 1
                ? data.userStatus.streamProgressSeconds
                : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
            log(`${quest.config.messages.questName}: ${progress}/${secondsNeeded}s`);
            if (progress >= secondsNeeded || stopRequested) {
                (ApplicationStreamingStore as any).getStreamerActiveStreamMetadata = realFunc;
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
                resolve();
            }
        };
        FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
    });
}

async function runActivityQuest(quest: Quest, taskData: QuestTaskData, log: (s: string) => void) {
    const secondsNeeded = taskData.target;
    const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id
        ?? Object.values(GuildChannelStore.getAllGuilds()).find((g: any) => g?.VOCAL?.length > 0)?.VOCAL[0]?.channel.id;
    if (!channelId) {
        log("Need a DM or a voice channel to spoof this one, skipping.");
        return;
    }
    const streamKey = `call:${channelId}:1`;

    while (!stopRequested) {
        const res = await Api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
        const progress = res.body.progress.PLAY_ACTIVITY.value;
        log(`${quest.config.messages.questName}: ${progress}/${secondsNeeded}s`);

        if (progress >= secondsNeeded) {
            await Api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
            break;
        }
        await new Promise(r => setTimeout(r, 20_000));
    }
}

async function runAll(log: (s: string) => void) {
    if (running) {
        showToast("AutoQuest is already running", Toasts.Type.MESSAGE);
        return;
    }
    const quests = getEligibleQuests();
    if (!quests.length) {
        showToast("No eligible quests to complete", Toasts.Type.MESSAGE);
        return;
    }
    if (!QuestsStore || !Api) {
        showToast("AutoQuest couldn't find Discord's internal quest modules (client updated?)", Toasts.Type.FAILURE);
        return;
    }

    running = true;
    stopRequested = false;
    try {
        for (const quest of quests) {
            if (stopRequested) break;
            const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2!;
            const taskName = SUPPORTED_TASKS.find(t => t in taskConfig.tasks)!;
            const taskData = taskConfig.tasks[taskName];

            try {
                if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
                    await runVideoQuest(quest, taskName, taskData, log);
                } else if (taskName === "PLAY_ON_DESKTOP") {
                    await runDesktopPlayQuest(quest, taskData, log);
                } else if (taskName === "STREAM_ON_DESKTOP") {
                    await runStreamQuest(quest, taskData, log);
                } else if (taskName === "PLAY_ACTIVITY") {
                    await runActivityQuest(quest, taskData, log);
                }
                log(`Done: ${quest.config.messages.questName}`);
            } catch (e) {
                logger.error(`Failed quest ${quest.config.messages.questName}`, e);
                log(`Error on ${quest.config.messages.questName}, moving on.`);
            }
        }
        if (!stopRequested) showToast("AutoQuest finished", Toasts.Type.SUCCESS);
    } finally {
        running = false;
    }
}

function RunButton() {
    return (
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <Button onClick={() => runAll(s => logger.info(s))}>
                Complete eligible quests
            </Button>
            <Button color={Button.Colors.RED} onClick={() => { stopRequested = true; }}>
                Stop
            </Button>
        </div>
    );
}

export const settings = definePluginSettings({
    runButton: {
        type: OptionType.COMPONENT,
        component: RunButton,
    },
});

export default definePlugin({
    name: "AutoQuest",
    description: "Spoofs game, stream, activity or video progress to complete your eligible Discord Quests without actually playing them. Reward is still Discord's own, nothing is taken from anyone else.",
    authors: [Devs.Sei],
    settings,
    start() {
        stopRequested = false;
    },
    stop() {
        stopRequested = true;
    },
});
