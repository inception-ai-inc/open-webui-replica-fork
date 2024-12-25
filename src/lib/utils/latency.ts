import { recordLatencyMetric } from '$lib/apis/performance';
import { getToken } from '$lib/utils/auth';

interface TimingData {
    questionTime: number;
    responseStartTime?: number;
    responseEndTime?: number;
    modelId: string;
}

const timings = new Map<string, TimingData>();

export function startQuestion(messageId: string, modelId: string) {
    timings.set(messageId, {
        questionTime: Date.now(),
        modelId
    });
}

export function recordResponseStart(messageId: string) {
    const timing = timings.get(messageId);
    if (timing) {
        timing.responseStartTime = Date.now();
    }
}

export async function recordResponseEnd(messageId: string, chatId: string, totalTokens?: number) {
    const timing = timings.get(messageId);
    if (timing) {
        timing.responseEndTime = Date.now();
        
        const token = getToken();
        if (token) {
            await recordLatencyMetric(token, {
                chat_id: chatId,
                message_id: messageId,
                question_time: timing.questionTime,
                response_start_time: timing.responseStartTime || timing.questionTime,
                response_end_time: timing.responseEndTime,
                model_id: timing.modelId,
                total_tokens: totalTokens
            }).catch(console.error);
        }

        timings.delete(messageId);
    }
} 