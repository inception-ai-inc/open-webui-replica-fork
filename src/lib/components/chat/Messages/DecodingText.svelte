<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	const dispatch = createEventDispatcher();

	export let text: string = '';
	export let done: boolean = false;
	export let speed: number = 25;
	export let duration: number = 1500;
	export let decodingMethod: 'sequential' | 'simultaneous' = 'simultaneous';

	const updateInterval = 100;

	let displayText: string = '';
	let animationStarted = false;
	let animationCompleted = false;
	let animationFrameId: number;
	let opacity: number = 0.2;

	// Start animation as soon as we get text
	$: if (text && !animationStarted) {
		if (decodingMethod === 'sequential') {
			startSequentialAnimation();
		} else {
			startSimultaneousAnimation();
		}
	}

	function startSimultaneousAnimation() {
		if (!text || animationStarted || animationCompleted) return;
		animationStarted = true;

		let startTime: number;
		let lastUpdateTime = 0;

		const decode = (timestamp: number) => {
			if (!startTime) startTime = timestamp;
			const progress = timestamp - startTime;

			if (progress >= duration) {
				displayText = text;
				opacity = 1;
				animationCompleted = true;
				dispatch('complete');
				return;
			}

			if (timestamp - lastUpdateTime >= updateInterval) {
				const probability = progress / duration;
				opacity = probability;
				displayText = text
					.split('')
					.map((targetChar) =>
						Math.random() > probability ? getRandomChar(targetChar) : targetChar
					)
					.join('');
				lastUpdateTime = timestamp;
			}

			animationFrameId = requestAnimationFrame(decode);
		};

		animationFrameId = requestAnimationFrame(decode);
	}

	const noiseCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

	function getRandomChar(originalChar: string) {
		if (originalChar === ' ' || originalChar === '\n' || originalChar === '\r') {
			return originalChar;
		}
		return noiseCharacters.charAt(Math.floor(Math.random() * noiseCharacters.length));
	}

	function startSequentialAnimation() {
		if (!text || animationStarted || animationCompleted) return;
		animationStarted = true;

		let currentIndex = 0;
		const totalChars = text.length;
		
		const interval = setInterval(() => {
			if (currentIndex >= totalChars) {
				clearInterval(interval);
				opacity = 1;
				animationCompleted = true;
				dispatch('complete');
				return;
			}

			opacity = currentIndex / totalChars;
			displayText = text
				.split('')
				.map((char, i) => {
					if (i < currentIndex) return char;
					return getRandomChar(char);
				})
				.join('');

			currentIndex++;
		}, 1000 / speed);
	}

	onMount(() => {
		if (done && text) {
			if (decodingMethod === 'sequential') {
				startSequentialAnimation();
			} else {
				startSimultaneousAnimation();
			}
		}
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
	});
</script>

<span 
	class="whitespace-pre-wrap" 
	style="
		color: rgb({Math.floor(20 + opacity * 235)}, {Math.floor(20 + opacity * 235)}, {Math.floor(20 + opacity * 235)});
		transition: color {updateInterval}ms linear;
	"
	out:fade={{ duration: 200 }}
>{displayText || text}</span> 