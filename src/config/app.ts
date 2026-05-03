export const appConfig = {
  name: 'PaperNow',
  version: '0.1.0',

  // 域名配置 - 模式 A：功能优先 (<project>.<domain> / api.<project>.<domain>)
  // 品牌体系: sunnynow → NeighborNow / PaperNow / ...
  domain: 'sunnynow.net',
  projectSubdomain: 'papernow',            // papernow.sunnynow.net
  apiSubdomain: 'api.papernow',            // api.papernow.sunnynow.net

  // 完整 URL（根据环境变量动态生成）
  baseUrl: import.meta.env.VITE_APP_URL || 'https://papernow.sunnynow.net',
  apiBaseUrl: import.meta.env.VITE_API_URL || 'https://api.papernow.sunnynow.net',

  // API 版本控制
  apiVersion: 'v1',

  // 版本层级: 'basic' | 'pro' (将来商业化时扩展)
  // Basic: 原文公开 URL，无 AI API 调用
  // Pro: AI 总结论文、智能推荐等（将来实现，当前仅预留类型）
  tier: 'basic' as 'basic' | 'pro',

  // 业务配置
  searchPageSize: 20,
  maxLoginAttempts: 5,
  loginLockoutMinutes: 15,
  sessionTimeoutHours: 24,
  // 搜索源配置 - 仅保留有稳定免费 API 的来源
  // 1. arXiv      — 官方 API + arxiv-dl CLI，物理/数学/CS
  // 2. PubMed     — NCBI E-utilities REST API，生物医学
  // 3. ChinaRxiv  — REST API /api/v1，中文预印本翻译（含全文/图表/PDF）
  // 4. bioRxiv    — REST API /api/v1，生物学预印本
  // 5. medRxiv    — 与 bioRxiv 共用 API，医学预印本
  supportedSources: ['arXiv', 'PubMed', 'ChinaRxiv', 'bioRxiv', 'medRxiv'] as const,
  readingStatuses: ['unread', 'reading', 'read'] as const,
  sortOptions: ['relevance', 'time', 'citations'] as const,
} as const

export type SupportedSource = typeof appConfig.supportedSources[number]
export type ReadingStatus = typeof appConfig.readingStatuses[number]
export type SortOption = typeof appConfig.sortOptions[number]
