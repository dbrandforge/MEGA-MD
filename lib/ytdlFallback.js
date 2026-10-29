// Direct-from-YouTube fallback for the .song/.music, .play and .video
// downloaders. The third-party wrapper APIs those plugins normally use
// (api.qasimdev.dpdns.org, api.siputzx.my.id, api.lolhuman.xyz) are free,
// unofficial services that go down or change endpoints without notice.
// @distube/ytdl-core talks to YouTube directly - no third-party server in
// the middle - so it keeps working even when every wrapper API is dead.
// It's still subject to YouTube occasionally changing things that need a
// package update, so it's used as a fallback, not a replacement, for the
// existing attempts.
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';

function tmpFile(ext) {
    const dir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `ytdl_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}

// Downloads audio-only and returns a local file path + basic info.
export async function ytdlDownloadAudio(youtubeUrl) {
    const info = await ytdl.getInfo(youtubeUrl);
    const filePath = tmpFile('mp3');
    await new Promise((resolve, reject) => {
        ytdl
            .downloadFromInfo(info, { filter: 'audioonly', quality: 'highestaudio' })
            .on('error', reject)
            .pipe(fs.createWriteStream(filePath))
            .on('finish', resolve)
            .on('error', reject);
    });
    return {
        filePath,
        title: info.videoDetails?.title,
        thumbnail: info.videoDetails?.thumbnails?.pop()?.url
    };
}

// Downloads video+audio (progressive, up to 360p is the usual cap for
// combined-stream YouTube formats) and returns a local file path + info.
export async function ytdlDownloadVideo(youtubeUrl) {
    const info = await ytdl.getInfo(youtubeUrl);
    const filePath = tmpFile('mp4');
    await new Promise((resolve, reject) => {
        ytdl
            .downloadFromInfo(info, { filter: 'videoandaudio', quality: 'highest' })
            .on('error', reject)
            .pipe(fs.createWriteStream(filePath))
            .on('finish', resolve)
            .on('error', reject);
    });
    return {
        filePath,
        title: info.videoDetails?.title,
        thumbnail: info.videoDetails?.thumbnails?.pop()?.url
    };
}

export function cleanupTmpFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }
    catch { /* ignore */ }
}
