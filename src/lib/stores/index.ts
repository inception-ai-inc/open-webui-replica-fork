import { writable, type Writable } from 'svelte/store';
import type { GlobalModelConfig, ModelConfig } from '$lib/apis';
import type { Banner } from '$lib/types';
import type { Socket } from 'socket.io-client';
import { APP_NAME } from '$lib/constants';

// Define interfaces first
export interface Settings {
	chatDirection: 'LTR' | 'RTL';
	models?: string[];
	conversationMode?: boolean;
	speechAutoSend?: boolean;
	responseAutoPlayback?: boolean;
	audio?: AudioSettings;
	showUsername?: boolean;
	notificationEnabled?: boolean;
	title?: TitleSettings;
	splitLargeDeltas?: boolean;
	system?: string;
	requestFormat?: string;
	keepAlive?: string;
	seed?: number;
	temperature?: string;
	repeat_penalty?: string;
	top_k?: string;
	top_p?: string;
	num_ctx?: string;
	num_batch?: string;
	num_keep?: string;
	options?: ModelOptions;
	params?: {
		stream_response?: boolean;
		stop?: string[];
		max_tokens?: number;
		frequency_penalty?: number;
	};
	memory?: boolean;
	hapticFeedback?: boolean;
	splitLargeChunks?: boolean;
	responseAutoCopy?: boolean;
	autoTags?: boolean;
	userLocation?: string | { latitude: any; longitude: any };
	richTextInput?: boolean;
	backgroundImageUrl?: string;
	landingPageMode?: string;
}

export interface ModelMeta {
	toolIds?: string[];
	capabilities?: {
		vision?: boolean;
	};
	knowledge?: any[];
}

// Initialize stores with proper types
export const loaded = writable<boolean>(false);
export const eventTarget = writable<EventTarget>(new EventTarget());
export const controlPane = writable<any>(null);
export const controlPaneComponent = writable<any>(null);
export const stopResponseFlag = writable<boolean>(false);
export const autoScroll = writable<boolean>(true);
export const processing = writable<boolean>(false);
export const messagesContainerElement = writable<HTMLElement | null>(null);
export const navbarElement = writable<HTMLElement | null>(null);
export const showEventConfirmation = writable<boolean>(false);
export const eventConfirmationTitle = writable<string>('');
export const eventConfirmationMessage = writable<string>('');
export const eventConfirmationInput = writable<boolean>(false);
export const eventConfirmationInputPlaceholder = writable<string>('');
export const eventConfirmationInputValue = writable<string>('');
export const eventCallback = writable<((value: any) => void) | null>(null);
export const chatIdUnsubscriber = writable<(() => void) | null>(null);
export const selectedModels = writable<string[]>(['']);
export const atSelectedModel = writable<Model | undefined>(undefined);
export const selectedModelIds = writable<string[]>([]);
export const selectedToolIds = writable<string[]>([]);
export const webSearchEnabled = writable<boolean>(false);
export const chat = writable<any>(null);
export const history = writable<{
	messages: Record<string, any>;
	currentId: string | null;
}>({
	messages: {},
	currentId: null
});
export const prompt = writable<string>('');
export const chatFiles = writable<any[]>([]);
export const files = writable<any[]>([]);
export const params = writable<Record<string, any>>({});
export const messageTimings = writable<Record<string, any>>({});

// Backend stores
export const WEBUI_NAME = writable<string>(APP_NAME);
export const config: Writable<Config | undefined> = writable(undefined);
export const user: Writable<SessionUser | undefined> = writable(undefined);

// Frontend stores
export const MODEL_DOWNLOAD_POOL = writable<Record<string, any>>({});
export const mobile = writable<boolean>(false);
export const socket: Writable<Socket | null> = writable(null);
export const activeUserCount: Writable<number | null> = writable(null);
export const USAGE_POOL: Writable<string[] | null> = writable(null);
export const theme = writable<string>('system');
export const chatId = writable<string>('');
export const chatTitle = writable<string>('');
export const chats = writable<any[]>([]);
export const pinnedChats = writable<any[]>([]);
export const tags = writable<any[]>([]);
export const models: Writable<Model[]> = writable([]);
export const prompts: Writable<Prompt[] | null> = writable(null);
export const knowledge: Writable<Document[] | null> = writable(null);
export const tools = writable<any[] | null>(null);
export const functions = writable<any[] | null>(null);
export const banners: Writable<Banner[]> = writable([]);
export const settings: Writable<Settings> = writable({
	chatDirection: 'LTR'
});
export const showSidebar = writable<boolean>(false);
export const showSettings = writable<boolean>(false);
export const showArchivedChats = writable<boolean>(false);
export const showChangelog = writable<boolean>(false);
export const showControls = writable<boolean>(false);
export const showOverview = writable<boolean>(false);
export const showArtifacts = writable<boolean>(false);
export const showCallOverlay = writable<boolean>(false);
export const temporaryChatEnabled = writable<boolean>(false);
export const scrollPaginationEnabled = writable<boolean>(false);
export const currentChatPage = writable<number>(1);

// Type definitions
export type Model = OpenAIModel | OllamaModel;

interface BaseModel {
	id: string;
	name: string;
	info?: ModelConfig;
	owned_by: 'ollama' | 'openai' | 'arena';
}

export interface OpenAIModel extends BaseModel {
	owned_by: 'openai';
	external: boolean;
	source?: string;
}

export interface OllamaModel extends BaseModel {
	owned_by: 'ollama';
	details: OllamaModelDetails;
	size: number;
	description: string;
	model: string;
	modified_at: string;
	digest: string;
	ollama?: {
		name?: string;
		model?: string;
		modified_at: string;
		size?: number;
		digest?: string;
		details?: {
			parent_model?: string;
			format?: string;
			family?: string;
			families?: string[];
			parameter_size?: string;
			quantization_level?: string;
		};
		urls?: number[];
	};
}

interface OllamaModelDetails {
	parent_model: string;
	format: string;
	family: string;
	families: string[] | null;
	parameter_size: string;
	quantization_level: string;
}

interface AudioSettings {
	STTEngine?: string;
	TTSEngine?: string;
	speaker?: string;
	model?: string;
	nonLocalVoices?: boolean;
}

interface TitleSettings {
	auto?: boolean;
	model?: string;
	modelExternal?: string;
	prompt?: string;
}

interface ModelOptions {
	stop?: boolean;
}

interface Prompt {
	command: string;
	user_id: string;
	title: string;
	content: string;
	timestamp: number;
}

interface Document {
	collection_name: string;
	filename: string;
	name: string;
	title: string;
}

interface Config {
	status: boolean;
	name: string;
	version: string;
	default_locale: string;
	default_models: string;
	default_prompt_suggestions: PromptSuggestion[];
	features: {
		auth: boolean;
		auth_trusted_header: boolean;
		enable_api_key: boolean;
		enable_signup: boolean;
		enable_login_form: boolean;
		enable_web_search?: boolean;
		enable_google_drive_integration: boolean;
		enable_image_generation: boolean;
		enable_admin_export: boolean;
		enable_admin_chat_access: boolean;
		enable_community_sharing: boolean;
	};
	oauth: {
		providers: {
			[key: string]: string;
		};
	};
}

interface PromptSuggestion {
	content: string;
	title: [string, string];
}

interface SessionUser {
	id: string;
	email: string;
	name: string;
	role: string;
	profile_image_url: string;
}

// ... rest of the type definitions stay the same ...
