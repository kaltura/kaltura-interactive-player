export function debounce(func: () => void, wait = 100) {
    let timeoutRef: number | null = null;
    return () => {
        if (timeoutRef) {
            clearTimeout(timeoutRef);
        }
        timeoutRef = setTimeout(() => {
            func();
            timeoutRef = null;
        }, wait);
    };
}
