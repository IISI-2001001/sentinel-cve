export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CVSSv3Metrics {
  baseScore: number;
  severity: SeverityLevel;
  vectorString: string;
  attackVector?: 'NETWORK' | 'ADJACENT' | 'LOCAL' | 'PHYSICAL';
  attackComplexity?: 'LOW' | 'HIGH';
  privilegesRequired?: 'NONE' | 'LOW' | 'HIGH';
  userInteraction?: 'NONE' | 'REQUIRED';
  scope?: 'UNCHANGED' | 'CHANGED';
  confidentialityImpact?: 'NONE' | 'LOW' | 'HIGH';
  integrityImpact?: 'NONE' | 'LOW' | 'HIGH';
  availabilityImpact?: 'NONE' | 'LOW' | 'HIGH';
}

export interface CVEItem {
  id: string; // e.g. CVE-2024-3094
  title: string;
  description: string;
  publishedDate: string;
  lastModifiedDate: string;
  productName: string;
  vendorName: string;
  cvss: CVSSv3Metrics;
  epssScore?: number; // Exploit Prediction Scoring System e.g. 0.85 (85%)
  cisaKev: boolean; // Is in CISA Known Exploited Vulnerabilities catalog
  cisaKevDueDate?: string;
  affectedVersions: string[];
  cpe: string[];
  references: Array<{ name: string; url: string }>;
  dataSources?: Array<{ type: string; url: string; retrievedAt: string }>;
  matchConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedBy?: string;
}

export interface MonitoredProduct {
  id: string;
  name: string; // e.g., "Linux Kernel"
  vendor: string; // e.g., "Linux"
  category: 'Operating System' | 'Web Server' | 'Database' | 'Framework/Library' | 'Container/Cloud' | 'Security/Network' | 'Application';
  cpeKeyword: string; // e.g., "linux:linux_kernel"
  autoScanEnabled: boolean;
  scanIntervalMinutes: number; // e.g. 5, 15, 60
  lastScannedAt?: string;
  detectedCveCount: number;
  activeAlertCount: number;
  // Version Monitoring & Security Updates
  currentVersion?: string; // e.g., "6.5.0" or "1.24.0"
  latestVersion?: string; // e.g., "6.8.2" or "1.26.1"
  latestSecureVersion?: string; // e.g., "6.8.2" (Patch fixing known CVEs)
  hasUpdateAvailable?: boolean;
  latestReleaseDate?: string;
  updateNotes?: string;
  sourceType?: 'auto' | 'postgresql' | 'github' | 'npm' | 'pypi' | 'vendor';
  ecosystem?: string;
  packageName?: string;
  purl?: string;
  cpe?: string;
  repository?: string;
  vendorReleaseUrl?: string;
  releaseChannel?: 'stable' | 'lts' | 'prerelease';
  versionSourceUrl?: string;
  versionCheckedAt?: string;
  versionConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  minCvssScore: number; // e.g. 7.0
  onlyCisaKev: boolean;
  targetProductIds: string[]; // empty array = all products
  notifyChannels: ('in_app' | 'webhook' | 'email')[];
  createdAt: string;
}

export interface AlertNotification {
  id: string;
  cveId: string;
  cveTitle: string;
  productName: string;
  cvssScore: number;
  severity: SeverityLevel;
  cisaKev: boolean;
  message: string;
  ruleName: string;
  status: 'UNREAD' | 'ACKNOWLEDGED' | 'RESOLVED';
  timestamp: string;
  channelDispatched: string[];
}

export interface WebhookConfig {
  id: string;
  name: string;
  type: 'slack' | 'teams' | 'discord' | 'custom';
  url: string;
  enabled: boolean;
  secretKey?: string;
  lastTestedAt?: string;
  lastStatus?: 'SUCCESS' | 'FAILED';
}

export interface ScanLog {
  id: string;
  timestamp: string;
  type: 'AUTO_SCAN' | 'MANUAL_SCAN' | 'ALERT_TRIGGER' | 'WEBHOOK_DISPATCH' | 'SYSTEM_INFO';
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  productName?: string;
  message: string;
  details?: string;
}



export type NotificationFrequency = 'REALTIME' | 'EVERY_15_MIN' | 'HOURLY' | 'DAILY' | 'WEEKLY';

export interface ProjectProductBinding {
  productId: string;
  productName: string;
  vendor?: string;
  cpeKeyword?: string;
  targetVersion: string; // 特定套用版本號
  environment?: string;
  customNotes?: string;
  boundAt?: string;
  productCpe?: string; // 從全域產品目錄擷取的基礎 CPE（版本萬用字元），供掃描比對使用
  autoScanEnabled?: boolean;
  scanIntervalMinutes?: number;
  lastScannedAt?: string;
  detectedCveCount?: number;
  activeAlertCount?: number;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  department: string;
  ownerName: string;
  ownerEmail: string;
  secondaryContacts?: string[];
  productIds: string[];
  productBindings?: ProjectProductBinding[]; // 個別套用到專案之產品與特定版本
  deploymentEnvironments?: string[]; // 此專案可用的部署環境清單（各客戶/專案不同，於專案內自行維護，預設 DEV/SIT/UAT/PRD）
  notifyEmail: boolean;
  notifyFrequency?: NotificationFrequency; // 個別專案通知頻率
  versionNotifyEnabled?: boolean;
  versionNotifyFrequency?: NotificationFrequency;
  versionNotifyLastRunAt?: string;
  versionNotifyNextRunAt?: string;
  versionNotifyLastSignature?: string;
  cveNotifyEnabled?: boolean;
  cveNotifyFrequency?: NotificationFrequency;
  cveNotifyLastRunAt?: string;
  cveNotifyNextRunAt?: string;
  cveNotifyLastSignature?: string;
  teamsWebhookUrl?: string; // 個別專案 Webhook 頻道
  ownerTeamsWebhookUrl?: string;
  handlerName?: string;
  handlerTeamsWebhookUrl?: string;
  notifyMinCvss: number;
  notifyCisaKevOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailNotificationConfig {
  smtpServer: string;
  smtpPort: number;
  senderName: string;
  senderEmail: string;
  enableAuth: boolean;
  username?: string;
  password?: string;
  defaultRecipients: string[];
}

export type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WAIVED' | 'CLOSED';

export interface ActionStep {
  stepNumber: number;
  title: string;
  detail: string;
  commandSnippet?: string;
}

export interface TicketCveInfo {
  cveId: string;
  title: string;
  cvss: number;
  severity: string;
  cisaKev: boolean;
  productName: string;
}

export interface TicketHistoryLog {
  id: string;
  timestamp: string;
  operator: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  note?: string;
  actionTitle: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  intervalMinutes: number; // e.g. 15, 30, 60, 360, 1440
  cronExpression: string; // e.g. "0 */1 * * *"
  scanScope: 'ALL';
  autoNotifyTeams: boolean;
  autoNotifyEmail: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  // CPE 對照自動更新排程：獨立於上方的弱點掃描排程，定期檢查「產品管理」頁面已儲存
  // 的每個產品是否有新的 NVD CPE 識別碼。
  cpeAutoUpdateEnabled?: boolean;
  cpeUpdateIntervalMinutes?: number; // e.g. 360, 720, 1440
  cpeLastRunAt?: string;
  cpeNextRunAt?: string;
}

export interface TeamsNotificationConfig {
  webhookUrl: string;
  channelName: string;
  enabled: boolean;
  minCvssScore: number;
  notifyCisaKevOnly: boolean;
  botDisplayName?: string;
}

export interface NvdApiConfig {
  apiKey: string;
  updatedAt?: string;
  usingEnvFallback?: boolean;
}

export interface Ticket {
  id: string;
  ticketNo: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  department: string;
  title: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeName: string;
  assigneeEmail: string;
  affectedProducts: string[];
  cveCount: number;
  cveList: TicketCveInfo[];
  slaHours: number;
  slaDeadline: string;
  executiveSummary: string;
  rootCauseAnalysis: string;
  actionSteps: ActionStep[];
  mitigationPlan: string;
  verificationMethod: string;
  // 豁免與執行狀態紀錄
  waiveReason?: string; // 豁免原因 (如隔離網路或資安資產補償控制)
  waivedBy?: string; // 審核豁免者
  waivedAt?: string; // 豁免核准時間
  resolvedAt?: string; // 解決日期
  resolutionNote?: string; // 解決手段說明
  executionHistory?: TicketHistoryLog[]; // 執行狀態動態紀錄
  createdAt: string;
  updatedAt: string;
}
