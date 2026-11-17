const SLOW_OPERATION_THRESHOLD_MS = 250;

export async function measureSlowOperation(name, operation, context = {}) {
    const startedAt = process.hrtime.bigint();
    let failed = false;
    try {
        return await operation();
    } catch (error) {
        failed = true;
        throw error;
    } finally {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        if (durationMs >= SLOW_OPERATION_THRESHOLD_MS) {
            // Context is deliberately limited to operation labels and booleans;
            // never log message text, phone numbers, JIDs, or credentials.
            console.warn('[ForgeGuardPerf]', JSON.stringify({
                operation: name,
                duration_ms: Math.round(durationMs * 10) / 10,
                failed,
                ...context
            }));
        }
    }
}
