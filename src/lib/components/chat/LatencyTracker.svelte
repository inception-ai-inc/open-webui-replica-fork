<script context="module" lang="ts">
export interface LatencyTracker {
    reset: () => void;
    startQuestion: (messageId: string, modelId: string, userId?: string, chatContext?: string) => void;
    dispatchStart: (messageId: string) => void;
    dispatchFinish: (messageId: string) => void;
}
</script>

<script lang="ts">
import { latencyTracker } from '$lib/utils/latency-tracker';
import { chatId, user } from '$lib/stores';
import { createEventDispatcher } from 'svelte';
import { onMount } from 'svelte';
import { countTokens } from '$lib/utils';

export let history: {
    messages: Record<string, {
        content?: string;
        role?: string;
        info?: {
            total_tokens?: number;
            userId?: string;
            timestamp?: number;
            chatContext?: string;
        };
    }>;
};

interface LatencyEvent {
    id: string;
}

const dispatch = createEventDispatcher<{
    'chat:start': LatencyEvent;
    'chat:finish': LatencyEvent;
}>();

onMount(() => {
    console.log('LatencyTracker mounted');
});

function getConversationHistory(messageId: string): string {
    // Convert messages object to array
    const messages = Object.entries(history.messages)
        .map(([id, msg]) => ({
            id,
            content: msg.content || '',
            role: msg.role || 'assistant',
            timestamp: msg.info?.timestamp || 0
        }));

    // Find the current message index
    const currentIndex = messages.findIndex(msg => msg.id === messageId);
    if (currentIndex === -1) return '';

    // Get all messages up to the current one
    const relevantMessages = messages.slice(0, currentIndex + 1);

    // Group messages by pairs (user + assistant)
    const orderedMessages = [];
    const userMessages = relevantMessages.filter(msg => msg.role === 'user');
    const remainingAssistantMessages = relevantMessages.filter(msg => msg.role === 'assistant');

    // Pair user and assistant messages based on timestamp
    for (let i = 0; i < userMessages.length; i++) {
        const userMsg = userMessages[i];
        orderedMessages.push(userMsg);
        
        // Find the assistant message that corresponds to this user message
        const nextUserTimestamp = userMessages[i + 1]?.timestamp || Infinity;
        const assistantIndex = remainingAssistantMessages.findIndex(msg => 
            msg.timestamp > userMsg.timestamp && msg.timestamp < nextUserTimestamp
        );
        
        if (assistantIndex !== -1) {
            // Add the assistant message and remove it from the pool
            orderedMessages.push(remainingAssistantMessages[assistantIndex]);
            remainingAssistantMessages.splice(assistantIndex, 1);
        }
    }

    // Add the latest assistant message if it exists and wasn't added yet
    const currentMessage = messages[currentIndex];
    if (currentMessage.role === 'assistant' && 
        !orderedMessages.some(msg => msg.id === currentMessage.id)) {
        orderedMessages.push(currentMessage);
    }

    // Format the conversation history
    return orderedMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
}

export function startQuestion(messageId: string, modelId: string) {
    console.log('startQuestion called with:', messageId, modelId);
    const message = history.messages[messageId];
    const chatContext = getConversationHistory(messageId);
    
    latencyTracker.startQuestion(
        messageId, 
        modelId,
        $user?.id,
        chatContext
    );
}

export function dispatchStart(messageId: string) {
    console.log('dispatchStart called with:', messageId);
    latencyTracker.recordResponseStart(messageId);
    dispatch('chat:start', { id: messageId });
}

export function dispatchFinish(messageId: string) {
    console.log('dispatchFinish called with:', messageId);
    const message = history.messages[messageId];
    const content = message?.content || '';
    
    // Compute tokens if not already set
    if (!message?.info?.total_tokens && content) {
        const computedTokens = countTokens(content);
        if (!message.info) message.info = {};
        message.info.total_tokens = computedTokens;
        message.info.timestamp = Date.now();
        message.info.userId = $user?.id;
    }

    const chatContext = getConversationHistory(messageId);
    latencyTracker.recordResponseEnd(
        messageId,
        $chatId,
        message?.info?.total_tokens,
        {
            userId: $user?.id,
            timestamp: message?.info?.timestamp,
            chatContext: chatContext
        }
    );
    dispatch('chat:finish', { id: messageId });
}
</script> 