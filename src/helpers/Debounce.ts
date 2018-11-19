export function debounce(func: () => void, wait = 50) {
	let timeoutRef: number;
	return () => {
		clearTimeout(timeoutRef);
		timeoutRef = setTimeout(() => func(), wait);
	};
}