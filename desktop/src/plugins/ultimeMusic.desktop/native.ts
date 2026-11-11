/*
 * Ultime Cord, a Discord client mod
 * Made by Sei (github.com/lyzral)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Reads what Windows is playing (Spotify, browsers, Deezer, Apple Music...) through the system media controls
// (GlobalSystemMediaTransportControls) with one long-lived PowerShell, and sends play/pause/next/prev/seek back.

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const CMD_FILE = join(tmpdir(), `ultimecord-music-${process.pid}.cmd`);
const PS =join(process.env.SystemRoot ?? "C:/Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

const SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(4000) | Out-Null; $task.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$lastKey = ''; $art = ''
$cmdFile = $env:UC_MUSIC_CMD
while ($true) {
    if ($cmdFile -and (Test-Path -LiteralPath $cmdFile)) {
        $cmd = (Get-Content -LiteralPath $cmdFile -Raw).Trim(); Remove-Item -LiteralPath $cmdFile -Force
        $s = $mgr.GetCurrentSession()
        if ($s) {
            switch -regex ($cmd) {
                '^toggle$' { $null = $s.TryTogglePlayPauseAsync() }
                '^next$' { $null = $s.TrySkipNextAsync() }
                '^prev$' { $null = $s.TrySkipPreviousAsync() }
                '^seek (\d+)$' { $null = $s.TryChangePlaybackPositionAsync([long]$matches[1] * 10000000) }
            }
        }
        Start-Sleep -Milliseconds 250
    }
    $s = $mgr.GetCurrentSession()
    if (-not $s) { [Console]::Out.WriteLine('{"none":true}'); [Console]::Out.Flush(); Start-Sleep -Milliseconds 1000; continue }
    $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $tl = $s.GetTimelineProperties(); $pb = $s.GetPlaybackInfo()
    $key = "$($p.Title)|$($p.Artist)|$($s.SourceAppUserModelId)"
    if ($key -ne $lastKey) {
        $lastKey = $key; $art = ''
        if ($p.Thumbnail) {
            $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            if ($st -and $st.Size -gt 0 -and $st.Size -lt 3000000) {
                $dr = New-Object Windows.Storage.Streams.DataReader($st.GetInputStreamAt(0))
                $n = Await ($dr.LoadAsync([uint32]$st.Size)) ([uint32])
                $bytes = New-Object byte[] $n; $dr.ReadBytes($bytes)
                $art = "data:$($st.ContentType);base64," + [Convert]::ToBase64String($bytes)
            }
        }
        $artOut = $art
    } else { $artOut = $null }
    $o = [ordered]@{
        title = $p.Title; artist = $p.Artist; album = $p.AlbumTitle; app = $s.SourceAppUserModelId
        playing = ($pb.PlaybackStatus -eq 'Playing')
        pos = [math]::Round($tl.Position.TotalSeconds, 1); end = [math]::Round($tl.EndTime.TotalSeconds, 1)
        at = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() - [math]::Max(0, ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalMilliseconds)
        art = $artOut
    }
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)); [Console]::Out.Flush()
    Start-Sleep -Milliseconds 700
}
`;

export interface Track {
    none?: boolean; title?: string; artist?: string; album?: string; app?: string;
    playing?: boolean; pos?: number; end?: number; at?: number; art?: string | null;
}

let ps: ChildProcessWithoutNullStreams | null = null;
let latest: Track = { none: true };
let art: string | null = null;
let buf = "";

function ensure() {
    if (process.platform !== "win32" || ps) return;
    const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");
    ps = spawn(PS, ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
        { windowsHide: true, env: { ...process.env, UC_MUSIC_CMD: CMD_FILE } });
    ps.stdout.setEncoding("utf8");
    ps.stdout.on("data", (d: string) => {
        buf += d;
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("{")) continue;
            try {
                const t = JSON.parse(line) as Track;
                if (t.none) { latest = t; art = null; continue; }
                if (typeof t.art === "string") art = t.art || null; // null = same track, keep the cover
                latest = { ...t, art: undefined };
            } catch { }
        }
    });
    ps.on("exit", () => { ps = null; latest = { none: true }; });
}

export function poll(_: IpcMainInvokeEvent): Track {
    ensure();
    return latest.none ? latest : { ...latest, art };
}

export function control(_: IpcMainInvokeEvent, cmd: "toggle" | "next" | "prev" | `seek ${number}`) {
    ensure();
    if (!/^(toggle|next|prev|seek \d+)$/.test(cmd)) return;
    try { writeFileSync(CMD_FILE, cmd); } catch { }
}

export function stop(_: IpcMainInvokeEvent) {
    ps?.kill(); ps = null;
}
