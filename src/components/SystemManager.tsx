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
  Building2,
  Database,
} from 'lucide-react';
import {
  Project,
  EmailNotificationConfig,
  ScanLog,
  ScheduleConfig,
  TeamsNotificationConfig,
} from '../types';
import { ProjectManager } from './ProjectManager';
import { CpeManager } from './CpeManager';
import { OrgDirectoryManager } from './OrgDirectoryManager';
import { NvdApiKeyManager } from './NvdApiKeyManager';
import { DbConnectionManager } from './DbConnectionManager';
import { SystemLogs } from './SystemLogs';

interface SystemManagerProps {
  projects: Project[];
  emailConfig: EmailNotificationConfig;
  logs: ScanLog[];
  onRefreshData: () => void;
  onSelectCve: (cveId: string) => void;
  defaultSubTab?: 'schedule' | 'cpe-management' | 'org-directory' | 'email-smtp' | 'teams-notification' | 'nvd-api' | 'db-config' | 'logs';
}

export const SystemManager: React.FC<SystemManagerProps> = ({
  projects,
  emailConfig,
  logs,
  onRefreshData,
  onSelectCve,
  defaultSubTab = 'schedule',
}) => {
  const [subTab, setSubTab] = useState<
    'schedule' | 'cpe-management' | 'org-directory' | 'email-smtp' | 'teams-notification' | 'nvd-api' | 'db-config' | 'logs'
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


  // Schedule Config State
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    enabled: true,
    intervalMinutes: 30,
    cronExpression: '*/30 * * * *',
    scanScope: 'ALL',
    autoNotifyTeams: true,
    autoNotifyEmail: true,
    lastRunAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + 30 * 60000).toISOString(),
    cpeAutoUpdateEnabled: true,
    cpeUpdateIntervalMinutes: 1440,
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isRunningScheduleNow, setIsRunningScheduleNow] = useState(false);
  const [isCheckingCpeNow, setIsCheckingCpeNow] = useState(false);
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

  const buildCronExpression = (intervalMinutes: number) => {
    switch (intervalMinutes) {
      case 15:
        return '*/15 * * * *';
      case 30:
        return '*/30 * * * *';
      case 60:
        return '0 */1 * * *';
      case 360:
        return '0 */6 * * *';
      case 1440:
        return '0 0 * * *';
      default:
        return `*/${intervalMinutes} * * * *`;
    }
  };

  const parseRecipients = () =>
    defaultRecipients
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  useEffect(() => {
    const cronExpression = buildCronExpression(scheduleConfig.intervalMinutes);
    if (scheduleConfig.cronExpression !== cronExpression) {
      setScheduleConfig((prev) => ({ ...prev, cronExpression }));
    }
  }, [scheduleConfig.intervalMinutes, scheduleConfig.cronExpression]);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const [scheduleRes, emailRes, teamsRes] = await Promise.all([
          fetch('/api/schedule/config'),
          fetch('/api/email/config'),
          fetch('/api/teams/config'),
        ]);

        if (scheduleRes.ok) {
          const data = await scheduleRes.json();
          setScheduleConfig((prev) => ({
            ...prev,
            ...data,
            cronExpression: data.cronExpression || buildCronExpression(data.intervalMinutes || prev.intervalMinutes),
          }));
        }

        if (emailRes.ok) {
          const data = await emailRes.json();
          setSmtpServer(data.smtpServer || '');
          setSmtpPort(data.smtpPort || 587);
          setSenderName(data.senderName || '');
          setSenderEmail(data.senderEmail || '');
          setEnableAuth(data.enableAuth ?? true);
          setSmtpUser(data.username || '');
          setSmtpPass(data.password || '');
          setDefaultRecipients(data.defaultRecipients?.join(', ') || '');
        }

        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setTeamsConfig((prev) => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.warn('Failed to load system configs:', error);
      }
    };

    loadConfigs();
  }, []);

  const handleSaveScheduleConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingSchedule(true);
    setScheduleSuccessNotice(null);
    try {
      const payload = {
        ...scheduleConfig,
        cronExpression: buildCronExpression(scheduleConfig.intervalMinutes),
      };
      const res = await fetch('/api/schedule/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setScheduleConfig((prev) => ({ ...prev, ...data }));
      setScheduleSuccessNotice('已儲存自動排程設定');
      onRefreshData();
    } catch (error: any) {
      setScheduleSuccessNotice(`儲存失敗：${error?.message || '未知錯誤'}`);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleRunScheduleNow = async () => {
    setIsRunningScheduleNow(true);
    setScheduleSuccessNotice(null);
    try {
      const res = await fetch('/api/schedule/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setScheduleConfig((prev) => ({
        ...prev,
        lastRunAt: data.lastRunAt || prev.lastRunAt,
        nextRunAt: data.nextRunAt || prev.nextRunAt,
      }));
      setScheduleSuccessNotice(`排程掃描完成：${data.scannedCount ?? 0} 項資產，新增 ${data.alertsTriggered ?? 0} 則警報`);
      onRefreshData();
    } catch (error: any) {
      setScheduleSuccessNotice(`執行失敗：${error?.message || '未知錯誤'}`);
    } finally {
      setIsRunningScheduleNow(false);
    }
  };

  /** Checks every cached product for new NVD CPE identities right now — this is the exact
   * same backend function the CPE auto-update schedule calls, just triggered manually. */
  const handleCheckCpeUpdatesNow = async () => {
    setIsCheckingCpeNow(true);
    setScheduleSuccessNotice(null);
    try {
      const res = await fetch('/api/cpe-cache/refresh-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const nowIso = new Date().toISOString();
      setScheduleConfig((prev) => ({ ...prev, cpeLastRunAt: nowIso }));
      setScheduleSuccessNotice(
        `CPE 更新檢查完成：共檢查 ${data.checkedCount ?? 0} 項產品，其中 ${data.updatedCount ?? 0} 項發現新 CPE${
          data.errors?.length ? `，${data.errors.length} 項查詢失敗` : ''
        }`
      );
      onRefreshData();
    } catch (error: any) {
      setScheduleSuccessNotice(`執行失敗：${error?.message || '未知錯誤'}`);
    } finally {
      setIsCheckingCpeNow(false);
    }
  };

  const handleSaveEmailConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingEmailConfig(true);
    setEmailNotice(null);
    try {
      const payload = {
        smtpServer,
        smtpPort,
        senderName,
        senderEmail,
        enableAuth,
        username: smtpUser,
        password: smtpPass,
        defaultRecipients: parseRecipients(),
      };
      const res = await fetch('/api/email/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSmtpPass('');
      setEmailNotice({ success: true, message: '已儲存 Email SMTP 設定' });
      onRefreshData();
    } catch (error: any) {
      setEmailNotice({ success: false, message: `儲存失敗：${error?.message || '未知錯誤'}` });
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  const handleTestEmailConfig = async () => {
    setIsTestingEmailConfig(true);
    setEmailNotice(null);
    try {
      const recipients = parseRecipients();
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail: recipients[0] || senderEmail,
          recipientName: senderName || 'SentinelCVE 管理員',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEmailNotice({ success: true, message: data.message || '測試 Email 已送出' });
    } catch (error: any) {
      setEmailNotice({ success: false, message: `測試失敗：${error?.message || '未知錯誤'}` });
    } finally {
      setIsTestingEmailConfig(false);
    }
  };

  const handleSaveTeamsConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingTeams(true);
    setTeamsNotice(null);
    try {
      const res = await fetch('/api/teams/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTeamsConfig((prev) => ({ ...prev, ...data }));
      setTeamsNotice({ success: true, message: '已儲存 Teams 設定' });
      onRefreshData();
    } catch (error: any) {
      setTeamsNotice({ success: false, message: `儲存失敗：${error?.message || '未知錯誤'}` });
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
        body: JSON.stringify({
          webhookUrl: teamsConfig.webhookUrl,
          channelName: teamsConfig.channelName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTeamsNotice({ success: true, message: data.message || 'Teams 測試訊息已送出' });
    } catch (error: any) {
      setTeamsNotice({ success: false, message: `測試失敗：${error?.message || '未知錯誤'}` });
    } finally {
      setIsTestingTeams(false);
    }
  };

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
            管理「自動排程」、「產品管理」與「系統日誌」。Teams Webhook 請於各專案中設定。
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
            onClick={() => setSubTab('cpe-management')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'cpe-management'
                ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>產品管理</span>
          </button>

          <button
            onClick={() => setSubTab('org-directory')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'org-directory'
                ? 'bg-white text-teal-700 shadow-2xs border border-teal-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>組織清單管理</span>
          </button>

          <button
            onClick={() => setSubTab('nvd-api')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'nvd-api'
                ? 'bg-white text-amber-700 shadow-2xs border border-amber-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Key className="w-4 h-4 text-amber-600" />
            <span>NVD API Key</span>
          </button>

          <button
            onClick={() => setSubTab('db-config')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              subTab === 'db-config'
                ? 'bg-white text-cyan-700 shadow-2xs border border-cyan-200 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Database className="w-4 h-4 text-cyan-600" />
            <span>資料庫連線</span>
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

            {/* CPE Auto Update Schedule */}
            <div className="pt-2 border-t border-slate-200 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <span>CPE 對照自動更新排程</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    開啟後系統將依所設定週期，自動檢查「產品管理」頁面已儲存的每個產品是否有 NVD 新增的 CPE 識別碼，並自動更新對照快取。
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!scheduleConfig.cpeAutoUpdateEnabled}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, cpeAutoUpdateEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    CPE 檢查執行週期 Frequency
                  </label>
                  <select
                    value={scheduleConfig.cpeUpdateIntervalMinutes ?? 1440}
                    onChange={(e) =>
                      setScheduleConfig({ ...scheduleConfig, cpeUpdateIntervalMinutes: Number(e.target.value) })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-2xs"
                  >
                    <option value={360}>每 6 小時</option>
                    <option value={720}>每 12 小時</option>
                    <option value={1440}>每 24 小時 / 每日 (預設推薦)</option>
                    <option value={10080}>每 7 天 / 每週</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1 font-mono">
                  <div className="text-indigo-900 font-bold flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>上次檢查時間: {scheduleConfig.cpeLastRunAt ? new Date(scheduleConfig.cpeLastRunAt).toLocaleString('zh-TW') : '尚未執行'}</span>
                  </div>
                  <div className="text-indigo-800 font-medium">
                    下一次預計檢查時間: {scheduleConfig.cpeNextRunAt ? new Date(scheduleConfig.cpeNextRunAt).toLocaleString('zh-TW') : '計算中'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckCpeUpdatesNow}
                  disabled={isCheckingCpeNow}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingCpeNow ? 'animate-spin' : ''}`} />
                  <span>{isCheckingCpeNow ? '檢查中...' : '🔍 立即檢查所有產品的新 CPE'}</span>
                </button>
              </div>
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

      {/* Sub-Tab View: Product Management (CPE mapping cache) */}
      {subTab === 'cpe-management' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <span>產品管理 (Product Management)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                管理各產品名稱對應的 NVD CPE 識別碼（vendor:product，版本以「*」萬用字元表示），供專案資產關聯與弱點比對流程使用。
              </p>
            </div>
          </div>

          <CpeManager />
        </div>
      )}

      {/* Sub-Tab View: Org Directory Management (departments / project managers) */}
      {subTab === 'org-directory' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                <span>組織清單管理 (Org Directory Management)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                維護「所屬部門」與「專案經理」清單，供「專案管理」的「新增專案」表單以下拉選單方式讀取。
              </p>
            </div>
          </div>

          <OrgDirectoryManager />
        </div>
      )}

      {/* Sub-Tab View: NVD API Key Management */}
      {subTab === 'nvd-api' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-600" />
                <span>NVD API Key 管理 (NVD API Key Management)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                設定呼叫 NIST NVD REST API 時所附帶的 API Key，用於「產品管理」CPE 查詢與弱點掃描流程，可提升 NVD 呼叫速率上限。
              </p>
            </div>
          </div>

          <NvdApiKeyManager />
        </div>
      )}

      {/* Sub-Tab View: Database Connection Settings */}
      {subTab === 'db-config' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Database className="w-5 h-5 text-cyan-600" />
                <span>資料庫連線管理 (Database Connection)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                設定後端連線的 PostgreSQL 主機資訊；設定值會寫入後端本機檔案，儲存後需重新啟動後端服務才會套用。
              </p>
            </div>
          </div>

          <DbConnectionManager />
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
    </div>
  );
};
