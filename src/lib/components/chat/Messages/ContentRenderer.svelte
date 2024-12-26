<script>
	import { onDestroy, onMount, tick, getContext, createEventDispatcher } from 'svelte';
	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();

	import Markdown from './Markdown.svelte';
	import LightBlub from '$lib/components/icons/LightBlub.svelte';
	import DecodingText from './DecodingText.svelte';
	import { chatId, mobile, showArtifacts, showControls, showOverview } from '$lib/stores';
	import ChatBubble from '$lib/components/icons/ChatBubble.svelte';
	import { stringify } from 'postcss';
	import { fade } from 'svelte/transition';

	export let id;
	export let content;
	export let history;
	export let model = null;
	export let sources = null;

	export let save = false;
	export let floatingButtons = true;

	export let onSourceClick = () => {};
	export let onAddMessages = () => {};

	let contentContainerElement;
	let buttonsContainerElement;
	let decodingComplete = false;

	let floatingButtonsElement;

	let completeContent = '';
	let decodingStatus = new Map();
	let paragraphs = [];

	$: if (content) {
		if (content !== completeContent) {
			// Reset state if this is a new message
			if (completeContent === '') {
				paragraphs = [];
				decodingStatus = new Map();
			}

			// Split entire content into paragraphs
			paragraphs = content
				.split(/\n\n+/)
				.map(p => p.trim())
				.filter(p => p.length > 0);
			
			// Start decoding all paragraphs immediately
			paragraphs.forEach(paragraph => {
				if (!decodingStatus.has(paragraph)) {
					decodingStatus.set(paragraph, false);
				}
			});
			
			completeContent = content;
		}
	}

	$: decodingComplete = paragraphs.length > 0 && 
		paragraphs.every(p => decodingStatus.get(p) === true);

	const handleChunkComplete = (chunk) => {
		decodingStatus.set(chunk, true);
		decodingStatus = decodingStatus;
	};

	const updateButtonPosition = (event) => {
		const buttonsContainerElement = document.getElementById(`floating-buttons-${id}`);
		if (
			!contentContainerElement?.contains(event.target) &&
			!buttonsContainerElement?.contains(event.target)
		) {
			closeFloatingButtons();
			return;
		}

		setTimeout(async () => {
			await tick();

			if (!contentContainerElement?.contains(event.target)) return;

			let selection = window.getSelection();

			if (selection.toString().trim().length > 0) {
				const range = selection.getRangeAt(0);
				const rect = range.getBoundingClientRect();

				const parentRect = contentContainerElement.getBoundingClientRect();

				// Adjust based on parent rect
				const top = rect.bottom - parentRect.top;
				const left = rect.left - parentRect.left;

				if (buttonsContainerElement) {
					buttonsContainerElement.style.display = 'block';

					// Calculate space available on the right
					const spaceOnRight = parentRect.width - left;
					let halfScreenWidth = $mobile ? window.innerWidth / 2 : window.innerWidth / 3;

					if (spaceOnRight < halfScreenWidth) {
						const right = parentRect.right - rect.right;
						buttonsContainerElement.style.right = `${right}px`;
						buttonsContainerElement.style.left = 'auto'; // Reset left
					} else {
						// Enough space, position using 'left'
						buttonsContainerElement.style.left = `${left}px`;
						buttonsContainerElement.style.right = 'auto'; // Reset right
					}
					buttonsContainerElement.style.top = `${top + 5}px`; // +5 to add some spacing
				}
			} else {
				closeFloatingButtons();
			}
		}, 0);
	};

	const closeFloatingButtons = () => {
		const buttonsContainerElement = document.getElementById(`floating-buttons-${id}`);
		if (buttonsContainerElement) {
			buttonsContainerElement.style.display = 'none';
		}

		if (floatingButtonsElement) {
			floatingButtonsElement.closeHandler();
		}
	};

	const keydownHandler = (e) => {
		if (e.key === 'Escape') {
			closeFloatingButtons();
		}
	};

	onMount(() => {
		if (floatingButtons) {
			contentContainerElement?.addEventListener('mouseup', updateButtonPosition);
			document.addEventListener('mouseup', updateButtonPosition);
			document.addEventListener('keydown', keydownHandler);
		}
	});

	onDestroy(() => {
		if (floatingButtons) {
			contentContainerElement?.removeEventListener('mouseup', updateButtonPosition);
			document.removeEventListener('mouseup', updateButtonPosition);
			document.removeEventListener('keydown', keydownHandler);
		}
	});
</script>

<div bind:this={contentContainerElement}>
	{#if !decodingComplete}
		<div class="flex flex-col gap-4">
			{#each paragraphs as paragraph}
				<DecodingText
					text={paragraph}
					speed={1}
					duration={1500}
					done={decodingStatus.get(paragraph)}
					on:complete={() => handleChunkComplete(paragraph)}
				/>
			{/each}
		</div>
	{:else}
		<div>
			<Markdown
				{id}
				content={completeContent}
				{model}
				{save}
				sourceIds={(sources ?? []).reduce((acc, s) => {
					let ids = [];
					s.document.forEach((document, index) => {
						const metadata = s.metadata?.[index];
						const id = metadata?.source ?? 'N/A';

						if (metadata?.name) {
							ids.push(metadata.name);
							return ids;
						}

						if (id.startsWith('http://') || id.startsWith('https://')) {
							ids.push(id);
						} else {
							ids.push(s?.source?.name ?? id);
						}

						return ids;
					});

					acc = [...acc, ...ids];

					// remove duplicates
					return acc.filter((item, index) => acc.indexOf(item) === index);
				}, [])}
				{onSourceClick}
				on:update={(e) => {
					dispatch('update', e.detail);
				}}
				on:code={(e) => {
					const { lang, code } = e.detail;

					if (
						(['html', 'svg'].includes(lang) || (lang === 'xml' && code.includes('svg'))) &&
						!$mobile &&
						$chatId
					) {
						showArtifacts.set(true);
						showControls.set(true);
					}
				}}
			/>
		</div>
	{/if}
</div>

{#if floatingButtons && model}
	<FloatingButtons
		bind:this={floatingButtonsElement}
		{id}
		model={model?.id}
		messages={createMessagesList(history, id)}
		onAdd={({ modelId, parentId, messages }) => {
			console.log(modelId, parentId, messages);
			onAddMessages({ modelId, parentId, messages });
			closeFloatingButtons();
		}}
	/>
{/if}
