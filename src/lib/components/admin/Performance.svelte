<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getLatencyMetrics } from '$lib/apis/performance';
	import type { i18n as i18nType } from 'i18next';
	import { Chart } from 'chart.js/auto';
	
	interface LatencyMetric {
		id: string;
		chat_id: string;
		message_id: string;
		question_time: number;
		response_start_time: number;
		response_end_time: number;
		total_tokens?: number;
		llm_id: string;
		created_at: number;
		user_id?: string;
		chat_context?: string;
	}

	interface Stats {
		tpt: {
			avg: number;
			p95: number;
		};
		ttc: {
			avg: number;
			p95: number;
		};
		total: {
			avg: number;
			p95: number;
		};
		tps: {
			avg: number;
			p95: number;
		};
	}
	
	const i18n = getContext<i18nType>('i18n');
	const t = (key: string) => i18n?.t?.(key) ?? key;
	
	let selectedTab = 'latency';
	let loaded = false;
	let metrics: LatencyMetric[] = [];
	let chart: Chart | null = null;
	let selectedMetricContext: string | null = null;
	let currentPage = 1;
	let itemsPerPage = 10;
	let isTestRunning = false;
	let testProgress = 0;
	let selectedModel = '';
	let numberOfPrompts = 5;
	let tpsChart: Chart | null = null;

	$: totalPages = Math.ceil(metrics.length / itemsPerPage);
	$: paginatedMetrics = metrics
		.sort((a, b) => b.created_at - a.created_at)
		.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	const MODEL_COLORS = [
		{ border: 'rgb(59, 130, 246)', background: 'rgba(59, 130, 246, 0.1)' }, // Blue
		{ border: 'rgb(16, 185, 129)', background: 'rgba(16, 185, 129, 0.1)' }, // Green
		{ border: 'rgb(249, 115, 22)', background: 'rgba(249, 115, 22, 0.1)' }, // Orange
		{ border: 'rgb(168, 85, 247)', background: 'rgba(168, 85, 247, 0.1)' }, // Purple
		{ border: 'rgb(236, 72, 153)', background: 'rgba(236, 72, 153, 0.1)' }, // Pink
	];
	
	function getDailyStats(metrics: LatencyMetric[]) {
		// First, group metrics by date and model
		const dailyModelMetrics: Record<string, Record<string, number[]>> = {};
		const modelSet = new Set<string>();
		
		metrics.forEach(metric => {
			const date = new Date(metric.created_at * 1000).toISOString().split('T')[0];
			if (!dailyModelMetrics[date]) {
				dailyModelMetrics[date] = {};
			}
			if (!dailyModelMetrics[date][metric.llm_id]) {
				dailyModelMetrics[date][metric.llm_id] = [];
			}
			dailyModelMetrics[date][metric.llm_id].push(metric.response_end_time - metric.question_time);
			modelSet.add(metric.llm_id);
		});

		const sortedDates = Object.keys(dailyModelMetrics).sort();
		const models = Array.from(modelSet);
		
		// Calculate average for each model per day
		const modelData = models.map(model => {
			const data = sortedDates.map(date => {
				const metrics = dailyModelMetrics[date][model] || [];
				return metrics.length > 0 
					? metrics.reduce((a, b) => a + b, 0) / metrics.length 
					: null;
			});
			return {
				model,
				data
			};
		});

		return {
			dates: sortedDates,
			modelData
		};
	}

	function createChart(metrics: LatencyMetric[]) {
		const dailyModelMetrics: Record<string, Record<string, number[]>> = {};
		const modelSet = new Set<string>();
		
		// Only consider metrics with valid token counts for TPT calculation
		metrics.filter(m => m.total_tokens && m.total_tokens > 0).forEach(metric => {
			const date = new Date(metric.created_at * 1000).toISOString().split('T')[0];
			if (!dailyModelMetrics[date]) {
				dailyModelMetrics[date] = {};
			}
			if (!dailyModelMetrics[date][metric.llm_id]) {
				dailyModelMetrics[date][metric.llm_id] = [];
			}
			dailyModelMetrics[date][metric.llm_id].push((metric.response_end_time - metric.response_start_time) / metric.total_tokens!);
			modelSet.add(metric.llm_id);
		});

		const sortedDates = Object.keys(dailyModelMetrics).sort();
		const models = Array.from(modelSet);
		const modelData = models.map(model => {
			const data = sortedDates.map(date => {
				const metrics = dailyModelMetrics[date][model] || [];
				return metrics.length > 0 
					? metrics.reduce((a, b) => a + b, 0) / metrics.length 
					: null;
			});
			return {
				model,
				data
			};
		});
		
		if (chart) {
			chart.destroy();
		}

		const ctx = document.getElementById('latencyChart') as HTMLCanvasElement;
		if (!ctx) return;

		chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: sortedDates,
				datasets: modelData.map((model, index) => ({
					label: model.model,
					data: model.data,
					borderColor: MODEL_COLORS[index % MODEL_COLORS.length].border,
					backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length].background,
					tension: 0.1,
					fill: true,
					spanGaps: true
				}))
			},
			options: {
				responsive: true,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				plugins: {
					legend: {
						position: 'top',
						labels: {
							padding: 20,
							usePointStyle: true,
							pointStyle: 'circle'
						}
					},
					title: {
						display: true,
						text: t('Daily Average Time per Token by Model'),
						padding: {
							bottom: 30
						}
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								if (context.parsed.y === null) return `${context.dataset.label}: No data`;
								return `${context.dataset.label}: ${formatDuration(context.parsed.y)}`;
							}
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: t('Time per Token (ms)')
						},
						ticks: {
							callback: (value) => formatDuration(value as number)
						}
					},
					x: {
						title: {
							display: true,
							text: t('Date')
						}
					}
				}
			}
		});
	}

	function getDailyCallVolume(metrics: LatencyMetric[]) {
		const dailyModelCalls: Record<string, Record<string, number>> = {};
		const modelSet = new Set<string>();
		
		metrics.forEach(metric => {
			const date = new Date(metric.created_at * 1000).toISOString().split('T')[0];
			if (!dailyModelCalls[date]) {
				dailyModelCalls[date] = {};
			}
			if (!dailyModelCalls[date][metric.llm_id]) {
				dailyModelCalls[date][metric.llm_id] = 0;
			}
			dailyModelCalls[date][metric.llm_id]++;
			modelSet.add(metric.llm_id);
		});

		const sortedDates = Object.keys(dailyModelCalls).sort();
		const models = Array.from(modelSet);
		
		const modelData = models.map(model => {
			const data = sortedDates.map(date => {
				return dailyModelCalls[date][model] || 0;
			});
			return {
				model,
				data
			};
		});

		return {
			dates: sortedDates,
			modelData
		};
	}

	let volumeChart: Chart | null = null;

	function createVolumeChart(metrics: LatencyMetric[]) {
		const { dates, modelData } = getDailyCallVolume(metrics);
		
		if (volumeChart) {
			volumeChart.destroy();
		}

		const ctx = document.getElementById('volumeChart') as HTMLCanvasElement;
		if (!ctx) return;

		volumeChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: dates,
				datasets: modelData.map((model, index) => ({
					label: model.model,
					data: model.data,
					backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length].border,
					borderColor: MODEL_COLORS[index % MODEL_COLORS.length].border,
					borderWidth: 1
				}))
			},
			options: {
				responsive: true,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				plugins: {
					legend: {
						position: 'top',
						labels: {
							padding: 20,
							usePointStyle: true,
							pointStyle: 'circle'
						}
					},
					title: {
						display: true,
						text: t('Daily Call Volume by Model'),
						padding: {
							bottom: 30
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: t('Number of Calls')
						},
						ticks: {
							stepSize: 1
						}
					},
					x: {
						title: {
							display: true,
							text: t('Date')
						}
					}
				}
			}
		});
	}

	function getDailyTPS(metrics: LatencyMetric[]) {
		const dailyModelMetrics: Record<string, Record<string, number[]>> = {};
		const modelSet = new Set<string>();
		
		// Only consider metrics with valid token counts for TPS calculation
		metrics.filter(m => m.total_tokens && m.total_tokens > 0).forEach(metric => {
			const date = new Date(metric.created_at * 1000).toISOString().split('T')[0];
			if (!dailyModelMetrics[date]) {
				dailyModelMetrics[date] = {};
			}
			if (!dailyModelMetrics[date][metric.llm_id]) {
				dailyModelMetrics[date][metric.llm_id] = [];
			}
			dailyModelMetrics[date][metric.llm_id].push(
				metric.total_tokens! / ((metric.response_end_time - metric.response_start_time) / 1000)
			);
			modelSet.add(metric.llm_id);
		});

		const sortedDates = Object.keys(dailyModelMetrics).sort();
		const models = Array.from(modelSet);
		
		const modelData = models.map(model => {
			const data = sortedDates.map(date => {
				const metrics = dailyModelMetrics[date][model] || [];
				return metrics.length > 0 
					? metrics.reduce((a, b) => a + b, 0) / metrics.length 
					: null;
			});
			return {
				model,
				data
			};
		});

		return {
			dates: sortedDates,
			modelData
		};
	}

	function createTPSChart(metrics: LatencyMetric[]) {
		const { dates, modelData } = getDailyTPS(metrics);
		
		if (tpsChart) {
			tpsChart.destroy();
		}

		const ctx = document.getElementById('tpsChart') as HTMLCanvasElement;
		if (!ctx) return;

		tpsChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: dates,
				datasets: modelData.map((model, index) => ({
					label: model.model,
					data: model.data,
					borderColor: MODEL_COLORS[index % MODEL_COLORS.length].border,
					backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length].background,
					tension: 0.1,
					fill: true,
					spanGaps: true
				}))
			},
			options: {
				responsive: true,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				plugins: {
					legend: {
						position: 'top',
						labels: {
							padding: 20,
							usePointStyle: true,
							pointStyle: 'circle'
						}
					},
					title: {
						display: true,
						text: t('Daily Average Tokens per Second by Model'),
						padding: {
							bottom: 30
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: t('Tokens per Second')
						}
					},
					x: {
						title: {
							display: true,
							text: t('Date')
						}
					}
				}
			}
		});
	}

	onMount(async () => {
		const response = await getLatencyMetrics(localStorage.token).catch((err) => {
			toast.error(err);
			return null;
		});
		console.log('response', response);
		
		if (response) {
			metrics = response.metrics;
		}
		loaded = true;
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
		if (volumeChart) {
			volumeChart.destroy();
		}
		if (tpsChart) {
			tpsChart.destroy();
		}
	});

	$: if (selectedTab === 'graphs' && metrics.length > 0) {
		// Use setTimeout to ensure the canvas is rendered before creating the charts
		setTimeout(() => {
			createChart(metrics);
			createVolumeChart(metrics);
			createTPSChart(metrics);
		}, 0);
	}

	function formatDuration(ms: number): string {
		return `${ms.toFixed(2)}ms`;
	}

	function calculateStats(metrics: LatencyMetric[]): Stats | null {
		if (!metrics || metrics.length === 0) return null;

		// Filter out metrics with no tokens or zero tokens for time per token calculation
		const validTokenMetrics = metrics.filter(m => m.total_tokens && m.total_tokens > 0);
		const tpts = validTokenMetrics.length > 0
			? validTokenMetrics.map(m => (m.response_end_time - m.response_start_time) / m.total_tokens!)
			: [0]; // Default to 0 if no valid metrics

		const ttcs = metrics.map(m => m.response_end_time - m.response_start_time); // Time to complete
		const totals = metrics.map(m => m.response_end_time - m.question_time); // Total time
		
		// Calculate tokens per second
		const tps = validTokenMetrics.length > 0
			? validTokenMetrics.map(m => m.total_tokens! / ((m.response_end_time - m.response_start_time) / 1000))
			: [0];

		const avg = (arr: number[]): number => arr.reduce((a, b) => a + b, 0) / arr.length;
		const p95 = (arr: number[]): number => {
			const sorted = [...arr].sort((a, b) => a - b);
			const pos = Math.floor(sorted.length * 0.95);
			return sorted[pos];
		};

		return {
			tpt: {
				avg: avg(tpts),
				p95: p95(tpts)
			},
			ttc: {
				avg: avg(ttcs),
				p95: p95(ttcs)
			},
			total: {
				avg: avg(totals),
				p95: p95(totals)
			},
			tps: {
				avg: avg(tps),
				p95: p95(tps)
			}
		};
	}

	function formatTimestamp(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleString();
	}

	function getModelStats(metrics: LatencyMetric[]): Record<string, Stats> {
		const modelMetrics: Record<string, LatencyMetric[]> = {};
		
		// Group metrics by model
		metrics.forEach(metric => {
			if (!modelMetrics[metric.llm_id]) {
				modelMetrics[metric.llm_id] = [];
			}
			modelMetrics[metric.llm_id].push(metric);
		});

		// Calculate stats for each model
		const modelStats: Record<string, Stats> = {};
		Object.entries(modelMetrics).forEach(([modelId, modelMetrics]) => {
			const stats = calculateStats(modelMetrics);
			if (stats) {
				modelStats[modelId] = stats;
			}
		});

		return modelStats;
	}

	function getLastMessage(context: string | null | undefined): string {
		if (!context) return '';
		const messages = context.match(/(?:^|\n)(user|assistant):[\s\S]*?(?=(?:\n(?:user|assistant):|$))/g) || [];
		const lastMessage = messages[messages.length - 1] || '';
		return lastMessage.replace(/^(?:user|assistant):\s*/m, '').trim();
	}

	function formatContext(context: string | null | undefined): string {
		if (!context) return '';
		
		const messages = (context.match(/(?:^|\n)(user|assistant):[\s\S]*?(?=(?:\n(?:user|assistant):|$))/g) || [])
			.map(msg => {
				const isUser = msg.trim().startsWith('user:');
				const role = isUser ? 'user' : 'assistant';
				const content = msg.replace(/^(?:user|assistant):\s*/m, '').trim();
				return { role, content };
			})
			.filter(msg => msg.content);

		return JSON.stringify(messages);
	}

	$: stats = calculateStats(metrics);
	$: modelStats = getModelStats(metrics);
</script>

{#if loaded}
	<div class="flex flex-col lg:flex-row w-full h-full pb-2 lg:space-x-4">
		<div
			id="performance-tabs-container"
			class="tabs flex flex-row overflow-x-auto gap-2.5 max-w-full lg:gap-1 lg:flex-col lg:flex-none lg:w-40 dark:text-gray-200 text-sm font-medium text-left scrollbar-none"
		>
			<button
				class="px-0.5 py-1 min-w-fit rounded-lg lg:flex-none flex text-right transition {selectedTab ===
				'latency'
					? ''
					: ' text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'}"
				on:click={() => {
					selectedTab = 'latency';
				}}
			>
				<div class="self-center mr-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 16 16"
						fill="currentColor"
						class="size-4"
					>
						<path d="M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14Z" />
						<path d="M8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Z" />
					</svg>
				</div>
				<div class="self-center">{t('Latency')}</div>
			</button>
			<button
				class="px-0.5 py-1 min-w-fit rounded-lg lg:flex-none flex text-right transition {selectedTab ===
				'graphs'
					? ''
					: ' text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'}"
				on:click={() => {
					selectedTab = 'graphs';
				}}
			>
				<div class="self-center mr-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 16 16"
						fill="currentColor"
						class="size-4"
					>
						<path d="M2 12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v8Z" />
						<path d="M12 9a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0V9ZM7 7a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0V7ZM4 10a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0v-1Z" />
					</svg>
				</div>
				<div class="self-center">{t('Graphs')}</div>
			</button>
			<button
				class="px-0.5 py-1 min-w-fit rounded-lg lg:flex-none flex text-right transition {selectedTab ===
				'test'
					? ''
					: ' text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'}"
				on:click={() => {
					selectedTab = 'test';
				}}
			>
				<div class="self-center mr-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 16 16"
						fill="currentColor"
						class="size-4"
					>
						<path d="M9.836 3.244c.963-1.665 3.365-1.665 4.328 0l2.156 3.732c.963 1.666-.241 3.75-2.165 3.75h-4.31c-1.924 0-3.128-2.084-2.165-3.75l2.156-3.732ZM4.5 14.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
					</svg>
				</div>
				<div class="self-center">{t('System Vitals')}</div>
			</button>
		</div>

		<div class="flex-1 mt-1 lg:mt-0 overflow-y-scroll">
			{#if selectedTab === 'latency'}
				<div class="text-sm">
					<div class="text-lg font-medium mb-4">{t('Latency Metrics')}</div>
					{#if stats}
						<!-- Overall Stats -->
						<div class="mb-8">
							<div class="text-base font-medium mb-3">{t('Overall Statistics')}</div>
							<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
								<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
									<div class="text-sm font-medium mb-2">{t('Time per Token')}</div>
									<div class="text-xs text-gray-500">
										<div class="flex justify-between mb-1">
											<span>{t('Average')}:</span>
											<span class="font-medium">{formatDuration(stats.tpt.avg)}</span>
										</div>
										<div class="flex justify-between">
											<span>p95:</span>
											<span class="font-medium">{formatDuration(stats.tpt.p95)}</span>
										</div>
									</div>
								</div>
								<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
									<div class="text-sm font-medium mb-2">{t('Time to Complete')}</div>
									<div class="text-xs text-gray-500">
										<div class="flex justify-between mb-1">
											<span>{t('Average')}:</span>
											<span class="font-medium">{formatDuration(stats.ttc.avg)}</span>
										</div>
										<div class="flex justify-between">
											<span>p95:</span>
											<span class="font-medium">{formatDuration(stats.ttc.p95)}</span>
										</div>
									</div>
								</div>
								<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
									<div class="text-sm font-medium mb-2">{t('Total Latency')}</div>
									<div class="text-xs text-gray-500">
										<div class="flex justify-between mb-1">
											<span>{t('Average')}:</span>
											<span class="font-medium">{formatDuration(stats.total.avg)}</span>
										</div>
										<div class="flex justify-between">
											<span>p95:</span>
											<span class="font-medium">{formatDuration(stats.total.p95)}</span>
										</div>
									</div>
								</div>
								<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
									<div class="text-sm font-medium mb-2">{t('Tokens per Second')}</div>
									<div class="text-xs text-gray-500">
										<div class="flex justify-between mb-1">
											<span>{t('Average')}:</span>
											<span class="font-medium">{stats.tps.avg.toFixed(2)}</span>
										</div>
										<div class="flex justify-between">
											<span>p95:</span>
											<span class="font-medium">{stats.tps.p95.toFixed(2)}</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Per Model Stats -->
						<div class="mb-8">
							<div class="text-base font-medium mb-3">{t('Per Model Statistics')}</div>
							<div class="grid grid-cols-1 gap-4">
								{#each Object.entries(modelStats) as [modelId, stats]}
									<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
										<div class="text-sm font-medium mb-3">{modelId}</div>
										<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
											<div>
												<div class="text-xs font-medium mb-1">{t('Time per Token')}</div>
												<div class="text-xs text-gray-500">
													<div class="flex justify-between">
														<span>{t('Average')}:</span>
														<span>{formatDuration(stats.tpt.avg)}</span>
													</div>
													<div class="flex justify-between">
														<span>p95:</span>
														<span>{formatDuration(stats.tpt.p95)}</span>
													</div>
												</div>
											</div>
											<div>
												<div class="text-xs font-medium mb-1">{t('Time to Complete')}</div>
												<div class="text-xs text-gray-500">
													<div class="flex justify-between">
														<span>{t('Average')}:</span>
														<span>{formatDuration(stats.ttc.avg)}</span>
													</div>
													<div class="flex justify-between">
														<span>p95:</span>
														<span>{formatDuration(stats.ttc.p95)}</span>
													</div>
												</div>
											</div>
											<div>
												<div class="text-xs font-medium mb-1">{t('Total Latency')}</div>
												<div class="text-xs text-gray-500">
													<div class="flex justify-between">
														<span>{t('Average')}:</span>
														<span>{formatDuration(stats.total.avg)}</span>
													</div>
													<div class="flex justify-between">
														<span>p95:</span>
														<span>{formatDuration(stats.total.p95)}</span>
													</div>
												</div>
											</div>
											<div>
												<div class="text-xs font-medium mb-1">{t('Tokens per Second')}</div>
												<div class="text-xs text-gray-500">
													<div class="flex justify-between">
														<span>{t('Average')}:</span>
														<span>{stats.tps.avg.toFixed(2)}</span>
													</div>
													<div class="flex justify-between">
														<span>p95:</span>
														<span>{stats.tps.p95.toFixed(2)}</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Recent Measurements -->
						<div class="mt-8">
							<div class="text-base font-medium mb-4">{t('Recent Measurements')}</div>
							<div class="overflow-x-auto">
								<table class="w-full text-sm text-left">
									<thead class="text-xs uppercase bg-gray-50 dark:bg-gray-850">
										<tr>
											<th class="px-4 py-2">{t('Model')}</th>
											<th class="px-4 py-2">{t('Time per Token')}</th>
											<th class="px-4 py-2">{t('Total')}</th>
											<th class="px-4 py-2">{t('Tokens')}</th>
											<th class="px-4 py-2">{t('Tokens/s')}</th>
											<th class="px-4 py-2">{t('Context')}</th>
											<th class="px-4 py-2">{t('Timestamp')}</th>
										</tr>
									</thead>
									<tbody>
										{#each paginatedMetrics as metric}
											<tr class="border-b dark:border-gray-700">
												<td class="px-4 py-2">{metric.llm_id}</td>
												<td class="px-4 py-2">
													{metric.total_tokens 
														? formatDuration((metric.response_end_time - metric.response_start_time) / metric.total_tokens)
														: '-'}
												</td>
												<td class="px-4 py-2">
													{formatDuration(metric.response_end_time - metric.question_time)}
												</td>
												<td class="px-4 py-2">{metric.total_tokens || '-'}</td>
												<td class="px-4 py-2">
													{metric.total_tokens 
														? (metric.total_tokens / ((metric.response_end_time - metric.response_start_time) / 1000)).toFixed(2)
														: '-'}
												</td>
												<td class="px-4 py-2">
													{#if metric.chat_context}
														<button
															class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
															on:click={() => selectedMetricContext = metric.chat_context || null}
														>
															{t('View History')}
														</button>
													{:else}
														-
													{/if}
												</td>
												<td class="px-4 py-2">{formatTimestamp(metric.created_at)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
								<!-- Pagination Controls -->
								{#if totalPages > 1}
									<div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 mt-4 rounded-lg">
										<div class="flex items-center gap-2">
											<button
												class="px-3 py-1 text-sm bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 dark:border-gray-700"
												on:click={previousPage}
												disabled={currentPage === 1}
											>
												{t('Previous')}
											</button>
											<div class="flex items-center gap-1">
												{#each Array(totalPages) as _, i}
													<button
														class="px-3 py-1 text-sm {currentPage === i + 1 
															? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600' 
															: 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'} 
															rounded-md transition-colors border"
														on:click={() => goToPage(i + 1)}
													>
														{i + 1}
													</button>
												{/each}
											</div>
											<button
												class="px-3 py-1 text-sm bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 dark:border-gray-700"
												on:click={nextPage}
												disabled={currentPage === totalPages}
											>
												{t('Next')}
											</button>
										</div>
										<div class="text-sm text-gray-600 dark:text-gray-400">
											{t('Page')} {currentPage} {t('of')} {totalPages}
										</div>
									</div>
								{/if}
							</div>
						</div>

						<!-- Context Modal -->
						{#if selectedMetricContext}
							<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
								<div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
									<div class="flex flex-col gap-2 mb-4">
										<div class="flex justify-between items-center">
											<h3 class="text-lg font-medium">{t('Conversation Context')}</h3>
											<button
												class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
												on:click={() => selectedMetricContext = null}
											>
												<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										</div>
										<div class="text-sm text-gray-500 dark:text-gray-400">
											{t('Chat ID')}: <span class="font-mono">{metrics.find(m => m.chat_context === selectedMetricContext)?.chat_id || '-'}</span>
										</div>
									</div>
									<div class="space-y-4">
										{#each JSON.parse(formatContext(selectedMetricContext)) as message}
											<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
												<div class="{message.role === 'user' 
													? 'bg-blue-500 text-white rounded-2xl rounded-tr-sm' 
													: 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-tl-sm'} 
													px-4 py-2 max-w-[80%] break-words">
													{message.content}
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					{:else}
						<div class="text-center text-gray-500">
							{t('No latency metrics available yet')}
						</div>
					{/if}
				</div>
			{:else if selectedTab === 'graphs'}
				<div class="text-sm">
					<div class="text-lg font-medium mb-4">{t('Performance Graphs')}</div>
					{#if stats}
						<div class="mb-8">
							<div class="text-base font-medium mb-3">{t('Daily Average Latency')}</div>
							<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
								<canvas id="latencyChart"></canvas>
							</div>
						</div>
						<div class="mb-8">
							<div class="text-base font-medium mb-3">{t('Daily Average Tokens per Second')}</div>
							<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
								<canvas id="tpsChart"></canvas>
							</div>
						</div>
						<div class="mb-8">
							<div class="text-base font-medium mb-3">{t('Daily Call Volume')}</div>
							<div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
								<canvas id="volumeChart"></canvas>
							</div>
						</div>
					{:else}
						<div class="text-center text-gray-500">
							{t('No metrics available yet')}
						</div>
					{/if}
				</div>
			{:else if selectedTab === 'test'}
				<div class="text-sm">
					<div class="text-lg font-medium mb-4">{t('Run Latency Test')}</div>
					<div class="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
						<form class="space-y-6">
							<div>
								<label for="model" class="block text-sm font-medium mb-2">{t('Select Model')}</label>
								<select
									id="model"
									bind:value={selectedModel}
									class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">{t('Choose a model')}</option>
									{#each Object.keys(modelStats || {}) as modelId}
										<option value={modelId}>{modelId}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="prompts" class="block text-sm font-medium mb-2">{t('Number of Test Prompts')}</label>
								<input
									type="number"
									id="prompts"
									bind:value={numberOfPrompts}
									min="1"
									max="50"
									class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<button
								type="button"
								disabled={!selectedModel || isTestRunning}
								class="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								on:click={() => {
									isTestRunning = true;
									// TODO: Implement test running logic
								}}
							>
								{#if isTestRunning}
									<div class="flex items-center justify-center">
										<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										{t('Running Test')} ({testProgress}%)
									</div>
								{:else}
									{t('Start Test')}
								{/if}
							</button>
						</form>

						{#if isTestRunning}
							<div class="mt-8">
								<div class="mb-4">
									<div class="text-sm font-medium mb-2">{t('Test Progress')}</div>
									<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
										<div class="bg-blue-500 h-2.5 rounded-full" style="width: {testProgress}%"></div>
									</div>
								</div>

								<div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
									<div class="text-sm font-medium mb-2">{t('Live Results')}</div>
									<div class="space-y-2 text-sm">
										<div class="flex justify-between">
											<span>{t('Prompts Completed')}:</span>
											<span class="font-medium">0/{numberOfPrompts}</span>
										</div>
										<div class="flex justify-between">
											<span>{t('Average Response Time')}:</span>
											<span class="font-medium">-</span>
										</div>
										<div class="flex justify-between">
											<span>{t('Average Tokens/Second')}:</span>
											<span class="font-medium">-</span>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if} 