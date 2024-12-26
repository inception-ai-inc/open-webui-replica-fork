import { recordLatencyMetric } from '$lib/apis/performance';
import { getToken } from '$lib/utils/auth';

interface TimingData {
    questionTime: number;
    responseStartTime?: number;
    responseEndTime?: number;
    modelId: string;
    userId?: string;
    chatContext?: string;
}

class LatencyTracker {
    private timings: Map<string, TimingData> = new Map();
    private currentQuestions: Map<string, {
        startTime: number;
        modelId?: string;
    }> = new Map();

    startQuestion(messageId: string, modelId: string, userId?: string, chatContext?: string) {
        this.timings.set(messageId, {
            questionTime: Date.now(),
            modelId,
            userId,
            chatContext
        });
    }

    recordResponseStart(messageId: string) {
        const timing = this.timings.get(messageId);
        if (timing) {
            timing.responseStartTime = Date.now();
        }
    }

    async recordResponseEnd(messageId: string, chatId: string, totalTokens?: number, additionalInfo?: {
        userId?: string;
        timestamp?: number;
        chatContext?: string;
    }) {
        const timing = this.timings.get(messageId);
        if (timing) {
            timing.responseEndTime = Date.now();
            
            // Update user info and chat context if provided in additionalInfo
            if (additionalInfo?.userId) {
                timing.userId = additionalInfo.userId;
            }
            if (additionalInfo?.chatContext) {
                timing.chatContext = additionalInfo.chatContext;
            }
            
            const token = getToken();
            if (token) {
                await recordLatencyMetric(token, {
                    chat_id: chatId,
                    message_id: messageId,
                    question_time: timing.questionTime,
                    response_start_time: timing.responseStartTime || timing.questionTime,
                    response_end_time: timing.responseEndTime,
                    llm_id: timing.modelId,
                    total_tokens: totalTokens,
                    user_id: timing.userId || additionalInfo?.userId,
                    chat_context: timing.chatContext || additionalInfo?.chatContext
                }).catch(console.error);
            }

            this.timings.delete(messageId);
        }
    }

    reset() {
        this.currentQuestions.clear();
        this.timings.clear();
    }
}

export const latencyTracker = new LatencyTracker(); 