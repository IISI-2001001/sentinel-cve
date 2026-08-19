import React, { useState, useEffect } from 'react';
import {
  Settings,
  FolderKanban,
  Terminal,
  Sliders,
  Sparkles,
  ShieldCheck,
  Cpu,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Bot,
  UserCheck,
  Clock,
  Play,
  Calendar,
  Send,
  Bell,
  MessageSquare,
  Radio,
  Check,
  Layers,
  Mail,
  Cloud,
} from 'lucide-react';
import {
  Project,
  MonitoredProduct,
  EmailNotificationConfig,
  ScanLog,
  AiConfig,
  AiProvider,
  ScheduleConfig,
  TeamsNotificationConfig,
} from '../types';
import { ProjectManager } from './ProjectManager';
import { ProductManager } from './ProductManager';
import { SystemLogs } from './SystemLogs';

interface SystemManagerProps {
  projects: Project[];
  products: MonitoredProduct[];
  emailConfig: EmailNotificationConfig;
  logs: ScanLog[];
  onRefreshData: () => void;
  onSelectCve: (cveId: string) => void;
  defaultSubTab?: 'schedule' | 'monitored-products' | 'email-smtp' | 'teams-notification' | 'logs' | 'ai-settings';
  onAddProduct?: (product: Partial<MonitoredProduct>) => void;
  onUpdateProduct?: (id: string, updates: Partial<MonitoredProduct>) => void;
  onDeleteProduct?: (id: string) => void;
  onTriggerProductScan?: (productId: string) => void;
}

const PROVIDER_OPTIONS: Array<{
  id: AiProvider;
  name: string;
  badge: string;
  description: string;
  defaultModels: string[];
  defaultBaseUrl?: string;
}> = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: '預設推薦',
    description: 'DeepMind 高效能多模態大語言模型，具備優異資安程式碼與 CVE 分析能力',
    defaultModels: ['gemini-3.6-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  },
  {
    id: 'aws-bedrock',
    name: 'AWS Bedrock',
    badge: 'AWS 雲端 API',
    description: 'Amazon Bedrock 託管生成式 AI 服務，支援 Anthropic Claude 3.5 Sonnet、Amazon Nova 等大型模型',
    defaultModels: [
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'amazon.nova-pro-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'meta.llama3-3-70b-instruct-v1:0',
    ],
    defaultBaseUrl: 'us-east-1',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    badge: 'GPT-4o / o3',
    description: '通用頂級推理語言模型，適合進行複雜資安規範分析與架構處置導引',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4-turbo'],
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    badge: 'Claude 3.7',
    description: '擅長長文本分析、情境邏輯推演與資安合規政策審查',
    defaultModels: ['claude-3-7-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'ollama',
    name: 'Ollama / 本地 LLM',
    badge: '地端私有化',
    description: '於地端資料中心或私有雲部署之開源 LLM，資料完全不外流',
    defaultModels: ['llama3.3', 'deepseek-r1', 'mistral', 'qwen2.5-coder'],
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
  {
    id: 'custom',
    name: '客製化 API Proxy',
    badge: 'OpenAI 相容',
    description: '連線至企業內部私有 AI 轉接層或第三方 OpenAI API 相容轉接服務',
    defaultModels: ['custom-security-model', 'internal-llm-v1'],
    defaultBaseUrl: 'https://ai-proxy.company.internal/v1',
  },
];

const PROMPT_PRESETS = [
  {
    id: 'ciso',
    name: '🛡️ 資深 CISO & SOC 團隊主管 (系統預設)',
    description: '專注於高階資安風險評估、影響範疇與企業營運防禦藍圖。',
  },
  {
    id: 'redteam',
    name: '⚔️ 紅隊攻擊者與滲透測試專家',
    description: '著重解析 POC 攻擊利用路徑、漏洞突破點與實戰滲透情境。',
  },
  {
    id: 'compliance',
    name: '📜 資安合規與內部稽核顧問',
    description: '對標 ISO 27001、NIST CSF、NIST SP 800-53 之合規與監管要求。',
  },
  {
    id: 'custom',
    name: '✍️ 自訂專屬 Persona 指令',
    description: '完全由您自訂專屬之 AI 資安角色 prompt。',
  },
];

export const SystemManager: React.FC<SystemManagerProps> = ({
  projects,
  products,
  emailConfig,
  logs,
  onRefreshData,
  onSelectCve,
  defaultSubTab = 'schedule',
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onTriggerProductScan,
}) => {
  const [subTab, setSubTab] = useState<
    'schedule' | 'monitored-products' | 'email-smtp' | 'teams-notification' | 'logs' | 'ai-settings'
  >(defaultSubTab);

  // Sync defaultSubTab if updated externally
  useEffect(() => {
    if (defaultSubTab) {
      setSubTab(defaultSubTab === 'email-smtp' || defaultSubTab === 'teams-notification' ? 'schedule' : defaultSubTab);
    }
  }, [defaultSubTab]);

  // Email SMTP State
  const [smtpServer, setSmtpServer] = useState(emailConfig?.smtpServer || '');
  const [smtpPort, setSmtpPort] = useState(emailConfig?.smtpPort || 587);
  const [senderName, setSenderName] = useState(emailConfig?.senderName || '');
  const [senderEmail, setSenderEmail] = useState(emailConfig?.senderEmail || '');
  const [enableAuth, setEnableAuth] = useState(emailConfig?.enableAuth ?? true);
  const [smtpUser, setSmtpUser] = useState(emailConfig?.username || '');
  const [smtpPass, setSmtpPass] = useState(emailConfig?.password || '');
  const [defaultRecipients, setDefaultRecipients] = useState(emailConfig?.defaultRecipients?.join(', ') || '');
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);
  const [isTestingEmailConfig, setIsTestingEmailConfig] = useState(false);
  const [emailNotice, setEmailNotice] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (emailConfig) {
      setSmtpServer(emailConfig.smtpServer || '');
      setSmtpPort(emailConfig.smtpPort || 587);
      setSenderName(emailConfig.senderName || '');
      setSenderEmail(emailConfig.senderEmail || '');
      setEnableAuth(emailConfig.enableAuth ?? true);
      setSmtpUser(emailConfig.username || '');
      setSmtpPass(emailConfig.password || '');
      setDefaultRecipients(emailConfig.defaultRecipients?.join(', ') || '');
    }
  }, [emailConfig]);

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    provider: 'gemini',
    model: 'gemini-3.6-flash',
    apiKey: '',
    baseUrl: '',
    temperature: 0.2,
    promptPreset: 'ciso',
    customSystemPrompt: '',
  });

  // Schedule Config State
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    enabled: true,
    intervalMinutes: 30,
    cronExpression: '*/30 * * * *',
    scanScope: 'ALL',
    autoAiAnalysis: true,
    autoNotifyTeams: true,
    autoNotifyEmail: true,
    lastRunAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + 30 * 60000).toISOString(),
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isRunningScheduleNow, setIsRunningScheduleNow] = useState(false);
  const [scheduleSuccessNotice, setScheduleSuccessNotice] = useState<string | null>(null);

  // Teams Config State
  const [teamsConfig, setTeamsConfig] = useState<TeamsNotificationConfig>({
    webhookUrl: 'https://outlook.office.com/webhook/sample-teams-channel',
    channelName: 'DevSecOps 資安緊急通報頻道',
    enabled: true,
    minCvssScore: 7.0,
    notifyCisaKevOnly: false,
    botDisplayName: 'SentinelCVE Bot',
  });
  const [isSavingTeams, setIsSavingTeams] = useState(false);
  const [isTestingTeams, setIsTestingTeams] = useState(false);
  const [teamsNotice, setTeamsNotice] = useState<{ success: boolean; message: string } | null>(null);

  const [isLoadingAiConfig, setIsLoadingAiConfig] = useState(false);
  const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Test Connection State
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
    modelUsed?: string;
  } | null>(null);

  // Load Schedule and Teams Configs
  useEffect(() => {
    fetch('/api/schedule/config')
      .then((res) => res.json())
      .then((data) => data && setScheduleConfig(data))
      .catch((err) => console.warn('Failed to fetch schedule config:', err));

    fetch('/api/teams/config')
      .then((res) => res.json())
      .then((data) => data && setTeamsConfig(data))
      .catch((err) => console.warn('Failed to fetch teams config:', err));
  }, []);

  // Fetch AI Config on subTab change to ai-settings
  useEffect(() => {
    if (subTab === 'ai-settings') {
      setIsLoadingAiConfig(true);
      fetch('/api/ai/config')
        .then((res) => res.json())
        .then((data: AiConfig) => {
          if (data && data.provider) {
            setAiConfig(data);
          }
        })
        .catch((err) => console.warn('Failed to load AI config:', err))
        .finally(() => setIsLoadingAiConfig(false));
    }
  }, [subTab]);

  const handleProviderChange = (provider: AiProvider) => {
    const pOption = PROVIDER_OPTIONS.find((p) => p.id === provider);
    setAiConfig((prev) => ({
      ...prev,
      provider,
      model: pOption ? pOption.defaultModels[0] : 'default-model',
      baseUrl: pOption?.defaultBaseUrl || prev.baseUrl,
    }));
    setTestResult(null);
  };

  const handleSaveScheduleConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);
    setScheduleSuccessNotice(null);
    try {
      const res = await fetch('/api/schedule/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleConfig),
      });
      if (res.ok) {
        const updated = await res.json();
        setScheduleConfig(updated);
        setScheduleSuccessNotice('自動排程設定已成功更新並立即生效！');
        onRefreshData();
        setTimeout(() => setScheduleSuccessNotice(null), 3500);
      }
    } catch (err) {
      console.error('Failed to save schedule config:', err);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleRunScheduleNow = async () => {
    setIsRunningScheduleNow(true);
    setScheduleSuccessNotice(null);
    try {
      const res = await fetch('/api/schedule/run-now', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setScheduleSuccessNotice(`排程掃描執行成功！已完成 ${data.scannedCount} 項資產檢測。`);
        onRefreshData();
        setTimeout(() => setScheduleSuccessNotice(null), 4000);
      }
    } catch (err) {
      console.error('Failed to run schedule:', err);
    } finally {
      setIsRunningScheduleNow(false);
    }
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailConfig(true);
    setEmailNotice(null);
    try {
      const payload: EmailNotificationConfig = {
        smtpServer,
        smtpPort: Number(smtpPort),
        senderName,
        senderEmail,
        enableAuth,
        username: smtpUser,
        password: smtpPass,
        defaultRecipients: defaultRecipients.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch('/api/email/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEmailNotice({ success: true, message: '全域 Email SMTP 設定已成功儲存與套用！' });
        onRefreshData();
        setTimeout(() => setEmailNotice(null), 3500);
      }
    } catch (err) {
      setEmailNotice({ success: false, message: '儲存 Email 設定失敗，請重試。' });
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  const handleTestEmailConfig = async () => {
    setIsTestingEmailConfig(true);
    setEmailNotice(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpServer,
          smtpPort: Number(smtpPort),
          senderName,
          senderEmail,
          testRecipient: defaultRecipients.split(',')[0]?.trim() || senderEmail,
        }),
      });
      const data = await res.json();
      setEmailNotice({
        success: res.ok && data.success,
        message: data.message || '測試 Email 發送回應正常！',
      });
    } catch (err: any) {
      setEmailNotice({
        success: false,
        message: err?.message || '測試 Email 發送連線失敗。',
      });
    } finally {
      setIsTestingEmailConfig(false);
    }
  };

  const handleSaveTeamsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTeams(true);
    setTeamsNotice(null);
    try {
      const res = await fetch('/api/teams/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsConfig),
      });
      if (res.ok) {
        setTeamsNotice({ success: true, message: 'Microsoft Teams 通報設定已成功儲存！' });
        onRefreshData();
        setTimeout(() => setTeamsNotice(null), 3500);
      }
    } catch (err) {
      console.error('Failed to save teams config:', err);
      setTeamsNotice({ success: false, message: '儲存失敗，請重試。' });
    } finally {
      setIsSavingTeams(false);
    }
  };

  const handleTestTeamsWebhook = async () => {
    setIsTestingTeams(true);
    setTeamsNotice(null);
    try {
      const res = await fetch('/api/teams/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsConfig),
      });
      const data = await res.json();
      setTeamsNotice({
        success: data.success,
        message: data.message || 'Teams 測試卡片已成功派送！',
      });
    } catch (err: any) {
      setTeamsNotice({
        success: false,
        message: err?.message || '測試發送失敗，請檢查 URL。',
      });
    } finally {
      setIsTestingTeams(false);
    }
  };

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setTestResult(null);
    try {
      const startTime = Date.now();
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startTime;

      if (res.ok && data.success) {
        setTestResult({
          success: true,
          latencyMs,
          message: data.message || 'AI 模型連線測試成功！',
          modelUsed: data.modelUsed || aiConfig.model,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || data.message || '連線測試失敗，請檢查 API Key 或 Endpoint 設定。',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || '無法連接至伺服器 AI 服務管道。',
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAiConfig(true);
    setSaveSuccessNotice(null);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig),
      });
      if (res.ok) {
        setSaveSuccessNotice('AI 工具設定已成功儲存並套用至全站分析模組！');
        onRefreshData();
        setTimeout(() => setSaveSuccessNotice(null), 3500);
      }
    } catch (err) {
      console.error('Failed to save AI config:', err);
    } finally {
      setIsSavingAiConfig(false);
    }
  };

  const currentProviderOpt = PROVIDER_OPTIONS.find((p) => p.id === aiConfig.provider) || PROVIDER_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              系統管理與設定中心 (System Administration)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            管理「自動排程」、「監控資產產品」、「系統日誌」與「AI 工具設定」。Teams Webhook 請於各專案中設定。
          </p>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSubTab('schedule')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'schedule'
                ? 'bg-white text-emerald-700 shadow-2xs border border-emerald-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>自動排程設定</span>
          </button>

          <button
            onClick={() => setSubTab('monitored-products')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'monitored-products'
                ? 'bg-white text-blue-700 shadow-2xs border border-blue-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span>監控資產產品</span>
          </button>

          <button
            onClick={() => setSubTab('logs')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'logs'
                ? 'bg-white text-slate-800 shadow-2xs border border-slate-200/60 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Terminal className="w-4 h-4 text-slate-600" />
            <span>系統稽核日誌</span>
          </button>

          <button
            onClick={() => setSubTab('ai-settings')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'ai-settings'
                ? 'bg-white text-purple-700 shadow-2xs border border-purple-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-600" />
            <span>AI 工具與 LLM 設定</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab View 2: Auto Scheduler Settings */}
      {subTab === 'schedule' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <span>系統自動排程掃描設定 (Auto Scan Scheduler)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                設定後端背景常駐 Cron 與週期性自動資安檢測管道，第一時間發現潛在 CVE 威脅。
              </p>
            </div>

            {scheduleSuccessNotice && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{scheduleSuccessNotice}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveScheduleConfig} className="space-y-6">
            {/* Global Auto Scan Switch */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-emerald-600" />
                  <span>全域自動定期資安掃描引擎</span>
                </div>
                <p className="text-xs text-slate-500">
                  開啟後系統將依據所設定之週期時間，自動向 NIST NVD 與 OSV 資料庫發起漏洞核驗。
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleConfig.enabled}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Scan Frequency & Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  掃描執行週期 Frequency
                </label>
                <select
                  value={scheduleConfig.intervalMinutes}
                  onChange={(e) =>
                    setScheduleConfig({ ...scheduleConfig, intervalMinutes: Number(e.target.value) })
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                >
                  <option value={15}>每 15 分鐘 (高頻密集監控)</option>
                  <option value={30}>每 30 分鐘 (預設推薦)</option>
                  <option value={60}>每 1 小時 (標準企業規格)</option>
                  <option value={360}>每 6 小時 (日定時檢測)</option>
                  <option value={1440}>每 24 小時 / 每日夜間</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  排程掃描資產範疇 Scan Scope
                </label>
                <select
                  value={scheduleConfig.scanScope}
                  onChange={(e) =>
                    setScheduleConfig({ ...scheduleConfig, scanScope: e.target.value as any })
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                >
                  <option value="ALL">全部受監控科技資產 (All Products)</option>
                  <option value="CRITICAL_HIGH_ONLY">僅限 CRITICAL & HIGH 重要度資產</option>
                </select>
              </div>
            </div>

            {/* Cron Expression Display */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 font-mono text-slate-700">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Cron 表達式: <code className="bg-white px-2 py-0.5 rounded border border-slate-300 font-bold text-emerald-700">{scheduleConfig.cronExpression || '*/30 * * * *'}</code></span>
              </div>
              <span className="text-[11px] text-slate-500">自動由週期轉換</span>
            </div>

            {/* Run Indicator */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1 font-mono">
                <div className="text-emerald-900 font-bold flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>上次執行時間: {scheduleConfig.lastRunAt ? new Date(scheduleConfig.lastRunAt).toLocaleString('zh-TW') : '尚未執行'}</span>
                </div>
                <div className="text-emerald-800 font-medium">
                  下一次預計執行時間: {scheduleConfig.nextRunAt ? new Date(scheduleConfig.nextRunAt).toLocaleString('zh-TW') : '計算中'}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunScheduleNow}
                disabled={isRunningScheduleNow}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0 self-start sm:self-auto"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningScheduleNow ? 'animate-spin' : ''}`} />
                <span>{isRunningScheduleNow ? '執行排程掃描中...' : '🚀 立即手動觸發一次排程掃描'}</span>
              </button>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSavingSchedule}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-2 shadow-md transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingSchedule ? '儲存中...' : '儲存自動排程設定'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-Tab View: Monitored Products */}
      {subTab === 'monitored-products' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>監控資產產品管理 (Monitored Products)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                清單式呈現並管理受監控之軟體產品套件、當前版本、CVE 漏洞數與即時掃描。
              </p>
            </div>
          </div>

          {onAddProduct && onUpdateProduct && onDeleteProduct && onTriggerProductScan ? (
            <ProductManager
              products={products}
              onAddProduct={onAddProduct}
              onUpdateProduct={onUpdateProduct}
              onDeleteProduct={onDeleteProduct}
              onTriggerProductScan={onTriggerProductScan}
            />
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">載入產品管理模組中...</div>
          )}
        </div>
      )}

      {/* Sub-Tab View: Global Email SMTP Settings */}
      {subTab === 'email-smtp' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Mail className="w-5 h-5 text-amber-600" />
                <span>全域 Email SMTP 通報設定 (Global SMTP Server)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                配置企業專用郵件伺服器、寄件人資訊與預設通報收件群組，當專案產生重大 CVE 時發送告警郵件。
              </p>
            </div>

            {emailNotice && (
              <div
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  emailNotice.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {emailNotice.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{emailNotice.message}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveEmailConfig} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  SMTP 伺服器主機 (SMTP Server Host)
                </label>
                <input
                  type="text"
                  required
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                  placeholder="e.g. smtp.office365.com 或 smtp.company.com"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  SMTP 連線埠號 (Port)
                </label>
                <input
                  type="number"
                  required
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  placeholder="587 / 465 / 25"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  寄件人顯示名稱 (Sender Display Name)
                </label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. SentinelCVE 漏洞預警中心"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  寄件人 Email 地址 (Sender Address)
                </label>
                <input
                  type="email"
                  required
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="e.g. cve-alert@company.com"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">SMTP 身分驗證 (Authentication)</span>
                  <span className="text-[11px] text-slate-500 block">大多數企業郵件伺服器與 Cloud SMTP 均需驗證帳密</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAuth}
                    onChange={(e) => setEnableAuth(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {enableAuth && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">驗證帳號 (Username)</label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="e.g. cve-alert@company.com"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">驗證密碼 (Password / App Token)</label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                預設通報 Email 副本群組 (Default Recipients)
              </label>
              <input
                type="text"
                value={defaultRecipients}
                onChange={(e) => setDefaultRecipients(e.target.value)}
                placeholder="secops-team@company.com, ciso-alert@company.com (以逗號分隔)"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
              />
              <p className="text-[10px] text-slate-500">
                若專案未單獨指定通知 Email，系統將預設發送至上述信箱清單。
              </p>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestEmailConfig}
                disabled={isTestingEmailConfig}
                className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition-all disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${isTestingEmailConfig ? 'animate-spin' : ''}`} />
                <span>{isTestingEmailConfig ? '發送測試郵件中...' : '✉️ 發送測試 Email'}</span>
              </button>

              <button
                type="submit"
                disabled={isSavingEmailConfig}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center space-x-2 shadow-md transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingEmailConfig ? '儲存中...' : '儲存 Email SMTP 設定'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-Tab View 3: Teams Notification Settings */}
      {subTab === 'teams-notification' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <span>Microsoft Teams 頻道即時通報設定 (MS Teams Integration)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                配置 Microsoft Teams Incoming Webhook 端點，將資安團隊群組與全系統 CVE 即時通報串接。
              </p>
            </div>

            {teamsNotice && (
              <div
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  teamsNotice.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {teamsNotice.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{teamsNotice.message}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveTeamsConfig} className="space-y-6">
            {/* Enable Teams Switch */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span>啟用 Microsoft Teams 即時漏洞警報推播</span>
                </div>
                <p className="text-xs text-slate-500">
                  當系統偵測到高危 CVE 或專案風險時，自動打包產出 MessageCard 卡片傳送至 Teams 頻道。
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamsConfig.enabled}
                  onChange={(e) => setTeamsConfig({ ...teamsConfig, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Webhook Form Inputs */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Microsoft Teams 通報頻道名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={teamsConfig.channelName}
                  onChange={(e) => setTeamsConfig({ ...teamsConfig, channelName: e.target.value })}
                  placeholder="例如: DevSecOps 資安應變緊急通報頻道"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Incoming Webhook URL *
                </label>
                <input
                  type="url"
                  required
                  value={teamsConfig.webhookUrl}
                  onChange={(e) => setTeamsConfig({ ...teamsConfig, webhookUrl: e.target.value })}
                  placeholder="https://outlook.office.com/webhook/..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  可以在 Microsoft Teams 頻道設定中選擇「Connectors / 連接器」&gt; 新增「Incoming Webhook」取得此 URL。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    最低觸發 CVSS 門檻 ({teamsConfig.minCvssScore})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={teamsConfig.minCvssScore}
                    onChange={(e) => setTeamsConfig({ ...teamsConfig, minCvssScore: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>CVSS 1.0 (全部)</span>
                    <span className="font-bold text-indigo-600">&ge; {teamsConfig.minCvssScore}</span>
                    <span>CVSS 10.0 (僅極危)</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-4">
                  <input
                    type="checkbox"
                    id="teamsOnlyKev"
                    checked={teamsConfig.notifyCisaKevOnly}
                    onChange={(e) => setTeamsConfig({ ...teamsConfig, notifyCisaKevOnly: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="teamsOnlyKev" className="text-xs font-bold text-slate-800">
                    僅當漏洞列於 CISA KEV (已遭積極網路攻擊) 時才推播 Teams
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestTeamsWebhook}
                disabled={isTestingTeams}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 text-indigo-600 ${isTestingTeams ? 'animate-bounce' : ''}`} />
                <span>{isTestingTeams ? '傳送測試中...' : '發送 Teams 測試卡片訊息'}</span>
              </button>

              <button
                type="submit"
                disabled={isSavingTeams}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSavingTeams ? '儲存中...' : '儲存 Teams 設定'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-Tab View 4: System Logs */}
      {subTab === 'logs' && (
        <SystemLogs logs={logs} onRefreshLogs={onRefreshData} />
      )}

      {/* Sub-Tab View 5: AI Tools Settings */}
      {subTab === 'ai-settings' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>AI 大語言模型 (LLM) 與工具提供商配置</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                支援 Google Gemini、OpenAI GPT-4o、Anthropic Claude 3.7 與私有地端 Ollama 等多模型動態切換
              </p>
            </div>

            {saveSuccessNotice && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessNotice}</span>
              </div>
            )}
          </div>

          {isLoadingAiConfig ? (
            <div className="p-16 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold">正在載入 AI 工具配置...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveAiConfig} className="space-y-6">
              {/* 1. Select Provider */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. 選擇 AI 工具 / LLM 提供商 (Provider)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PROVIDER_OPTIONS.map((p) => {
                    const isSelected = aiConfig.provider === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleProviderChange(p.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? 'bg-purple-50/60 border-purple-500 shadow-sm ring-1 ring-purple-500/30'
                            : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">{p.name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {p.badge}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Model & Endpoint Configuration */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <span>2. 模型與 API 端點參數</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Model Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      模型代號 (Model Name)
                    </label>
                    <div className="space-y-1.5">
                      <select
                        value={aiConfig.model}
                        onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
                      >
                        {currentProviderOpt.defaultModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                        <option value="custom">自訂模型名稱...</option>
                      </select>

                      {(!currentProviderOpt.defaultModels.includes(aiConfig.model) || aiConfig.model === 'custom') && (
                        <input
                          type="text"
                          placeholder="請輸入模型代號 (例如: gpt-4o-2024-08-06)"
                          value={aiConfig.model === 'custom' ? '' : aiConfig.model}
                          onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500 mt-1"
                        />
                      )}
                    </div>
                  </div>

                  {/* Base URL / Endpoint */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Base API Endpoint (選填/轉接)</span>
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                    </label>
                    <input
                      type="text"
                      value={aiConfig.baseUrl || ''}
                      onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                      placeholder={currentProviderOpt.defaultBaseUrl || 'https://api.openai.com/v1'}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      如使用地端 Ollama 可設為: <code className="text-purple-600 font-mono">http://localhost:11434/v1</code>
                    </p>
                  </div>
                </div>

                {/* AWS Bedrock Specific Fields */}
                {aiConfig.provider === 'aws-bedrock' && (
                  <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
                    <div className="flex items-center space-x-2 text-xs font-bold text-purple-900">
                      <Cloud className="w-4 h-4 text-purple-600" />
                      <span>AWS Bedrock 認證金鑰與區域設定</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          AWS Region (區域)
                        </label>
                        <select
                          value={aiConfig.awsRegion || 'us-east-1'}
                          onChange={(e) => setAiConfig({ ...aiConfig, awsRegion: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                        >
                          <option value="us-east-1">us-east-1 (N. Virginia)</option>
                          <option value="us-west-2">us-west-2 (Oregon)</option>
                          <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
                          <option value="ap-northeast-2">ap-northeast-2 (Seoul)</option>
                          <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          AWS Access Key ID
                        </label>
                        <input
                          type="text"
                          value={aiConfig.awsAccessKeyId || ''}
                          onChange={(e) => setAiConfig({ ...aiConfig, awsAccessKeyId: e.target.value })}
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          AWS Secret Access Key
                        </label>
                        <input
                          type="password"
                          value={aiConfig.awsSecretAccessKey || ''}
                          onChange={(e) => setAiConfig({ ...aiConfig, awsSecretAccessKey: e.target.value })}
                          placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          AWS Session Token (選填)
                        </label>
                        <input
                          type="password"
                          value={aiConfig.awsSessionToken || ''}
                          onChange={(e) => setAiConfig({ ...aiConfig, awsSessionToken: e.target.value })}
                          placeholder="FwoGZXIvYXdzEAAA... (臨時憑證專用)"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* API Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      <span>API Key 存取金鑰</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[10px] text-purple-600 hover:underline font-normal"
                    >
                      {showApiKey ? '隱藏金鑰' : '顯示內容'}
                    </button>
                  </label>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiConfig.apiKey || ''}
                    onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                    placeholder={
                      aiConfig.provider === 'gemini'
                        ? '預設使用伺服器 GEMINI_API_KEY，或填入獨立 Key 覆蓋'
                        : aiConfig.provider === 'aws-bedrock'
                        ? 'AWS Bedrock 亦可貼上整合 API Key 或 Token'
                        : '請輸入 Provider 的 API Key (如 sk-...)'
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    金鑰僅加密儲存於專屬安全會話，不會被發布或公開於網路。
                  </p>
                </div>

                {/* Temperature Slider */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      推理隨機度 Temperature: <span className="text-purple-600 font-mono font-bold">{aiConfig.temperature}</span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {aiConfig.temperature < 0.3 ? '🎯 精準嚴謹 (資安建議)' : aiConfig.temperature < 0.7 ? '⚖️ 均衡適中' : '🎨 創意發想'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={aiConfig.temperature}
                    onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              </div>

              {/* 3. System Prompt & Persona Presets */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. 資安分析 AI 角色預設 (System Persona)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROMPT_PRESETS.map((preset) => {
                    const isSelected = aiConfig.promptPreset === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => setAiConfig({ ...aiConfig, promptPreset: preset.id as any })}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-50 border-purple-500 shadow-2xs font-semibold text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">{preset.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{preset.description}</div>
                      </div>
                    );
                  })}
                </div>

                {aiConfig.promptPreset === 'custom' && (
                  <div className="mt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">自訂 System Prompt</label>
                    <textarea
                      rows={3}
                      value={aiConfig.customSystemPrompt || ''}
                      onChange={(e) => setAiConfig({ ...aiConfig, customSystemPrompt: e.target.value })}
                      placeholder="請輸入給 AI 的角色設定與指令規範 (例如: 你是一位 PCI-DSS 資安稽核人員...)"
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
              </div>

              {/* Live Connection Test Output Box */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1.5 transition-all ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center space-x-1.5">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>{testResult.success ? '連線成功！' : '連線測試失敗'}</span>
                    </span>
                    {testResult.latencyMs && (
                      <span className="font-mono text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        回應時間: {testResult.latencyMs} ms
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed">{testResult.message}</p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={isTestingAi}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 text-amber-500 ${isTestingAi ? 'animate-bounce' : ''}`} />
                  <span>{isTestingAi ? '測試連線中...' : '測試 AI API 連線'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSavingAiConfig}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-purple-500/20 transition-all disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSavingAiConfig ? '儲存中...' : '儲存 AI 工具設定'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
