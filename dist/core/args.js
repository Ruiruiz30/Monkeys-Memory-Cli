export function collectValues(value) {
    if (value === undefined || value === null)
        return [];
    const values = Array.isArray(value) ? value : [value];
    return values
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim())
        .filter(Boolean);
}
export function setIfPresent(target, key, value) {
    if (value !== undefined && value !== null && value !== '')
        target[key] = value;
}
export function parseJson(value, flagName) {
    if (!value)
        return {};
    try {
        const parsed = JSON.parse(String(value));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('must be a JSON object');
        return parsed;
    }
    catch (error) {
        throw new Error(`${flagName} must be a JSON object: ${error.message}`);
    }
}
export function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        const next = argv[i + 1];
        if (token === '--help' || token === '-h')
            args.help = true;
        else if (token.startsWith('--')) {
            const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
            if (['includeSensitive', 'noAutoActions', 'noReport', 'noOpen'].includes(key)) {
                args[key] = true;
            }
            else {
                if (next === undefined)
                    throw new Error(`${token} requires a value`);
                if (['path', 'task', 'entity', 'evidence'].includes(key) && args[key] !== undefined) {
                    args[key] = [...collectValues(args[key]), next];
                }
                else {
                    args[key] = next;
                }
                i += 1;
            }
        }
        else {
            args._.push(token);
        }
    }
    return args;
}
//# sourceMappingURL=args.js.map