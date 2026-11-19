// Opt-in (CPU_PROBE=1) production CPU sampler. It runs the V8 profiler for a
// short window and logs only function names, file paths and time shares, so we
// can see which code is using the 0.15 CPU quota. No message or key data is read.
import inspector from 'node:inspector';
import path from 'node:path';

export function shortenUrl(url = '', cwd = process.cwd()) {
    if (!url) return '(native)';
    let value = url.replace(/^file:\/\//, '');
    const nm = value.lastIndexOf('node_modules/');
    if (nm >= 0) {
        const parts = value.slice(nm + 'node_modules/'.length).split('/');
        const pkg = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
        return 'pkg:' + pkg;
    }
    if (value.startsWith('node:')) return value;
    return path.relative(cwd, value) || value;
}

export function summarizeProfile(profile, { topFunctions = 15, topFiles = 10, cwd } = {}) {
    const nodes = new Map(profile.nodes.map(node => [node.id, node]));
    const selfUs = new Map();
    let totalUs = 0;
    const samples = profile.samples || [];
    const deltas = profile.timeDeltas || [];
    for (let i = 0; i < samples.length; i++) {
        const us = deltas[i] || 0;
        totalUs += us;
        selfUs.set(samples[i], (selfUs.get(samples[i]) || 0) + us);
    }
    const byFunction = new Map();
    const byFile = new Map();
    for (const [id, us] of selfUs) {
        const frame = nodes.get(id)?.callFrame;
        if (!frame) continue;
        const file = shortenUrl(frame.url, cwd);
        const name = frame.functionName || '(anonymous)';
        const key = frame.url ? `${name} ${file}:${(frame.lineNumber || 0) + 1}` : name;
        byFunction.set(key, (byFunction.get(key) || 0) + us);
        const fileKey = frame.url ? file : name;
        byFile.set(fileKey, (byFile.get(fileKey) || 0) + us);
    }
    const rank = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([label, us]) => ({ label, ms: Math.round(us / 1000), pct: totalUs ? +(us * 100 / totalUs).toFixed(1) : 0 }));
    return { totalMs: Math.round(totalUs / 1000), functions: rank(byFunction, topFunctions), files: rank(byFile, topFiles) };
}

function post(session, method, params) {
    return new Promise((resolve, reject) => session.post(method, params, (err, result) => err ? reject(err) : resolve(result)));
}

export async function runCpuProbe({ durationMs = 30000, intervalUs = 2000, log = console.log } = {}) {
    const session = new inspector.Session();
    session.connect();
    try {
        await post(session, 'Profiler.enable');
        await post(session, 'Profiler.setSamplingInterval', { interval: intervalUs });
        await post(session, 'Profiler.start');
        await new Promise(resolve => setTimeout(resolve, durationMs));
        const { profile } = await post(session, 'Profiler.stop');
        const summary = summarizeProfile(profile);
        log(`[CPU-probe] window=${durationMs}ms sampled=${summary.totalMs}ms`);
        for (const f of summary.files) log(`[CPU-probe] file ${f.pct}% (${f.ms}ms) ${f.label}`);
        for (const f of summary.functions) log(`[CPU-probe] fn ${f.pct}% (${f.ms}ms) ${f.label}`);
        return summary;
    } finally {
        try { await post(session, 'Profiler.disable'); } catch { }
        session.disconnect();
    }
}

export function startCpuProbe({ firstDelayMs = 120000, repeatMs = 600000, runs = 2, log = console.log } = {}) {
    let done = 0;
    const tick = () => {
        runCpuProbe({ log }).catch(err => log(`[CPU-probe] failed: ${err.message}`)).finally(() => {
            if (++done < runs) setTimeout(tick, repeatMs).unref?.();
        });
    };
    setTimeout(tick, firstDelayMs).unref?.();
}
