import { createEventDispatcher } from 'svelte';

interface LatencyEvent {
    id: string;
}

export const createLatencyDispatcher = () => {
    const dispatch = createEventDispatcher<{
        'chat:start': LatencyEvent;
        'chat:finish': LatencyEvent;
    }>();

    return {
        dispatchStart: (id: string) => dispatch('chat:start', { id }),
        dispatchFinish: (id: string) => dispatch('chat:finish', { id })
    };
}; 