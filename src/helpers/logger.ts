let isEnabled = false;
export function enable() {
    isEnabled = true;
}
export function log(level: 'log' | 'warn' | 'error', context: string, message: string, ...optionalParams: any[]) {
    if (isEnabled) {
        console[level](`KIV [${level}] ${context ? `[${context}]` : ''} : ${message}`, ...optionalParams);
    }
}