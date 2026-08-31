import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ProjectManager } from './components/ProjectManager';
import { SystemManager } from './components/SystemManager';
import { Documentation } from './components/Documentation';
import { CveDetailModal } from './components/CveDetailModal';
import {
  MonitoredProduct,
  CVEItem,
  AlertRule,
  AlertNotification,
  WebhookConfig,
  ScanLog,
  Project,
  EmailNotificationConfig,
} from './types';

const EMPTY_EMAIL_CONFIG: EmailNotificationConfig = {
  smtpServer: '',
  smtpPort: 587,
  senderName: '',
  senderEmail: '',
  enableAuth: false,
  username: '',
  password: '',
  defaultRecipients: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [systemSubTab, setSystemSubTab] = useState<
    'schedule' | 'teams-notification' | 'logs' | 'email-smtp' | 'cpe-management'
  >('schedule');

  const [products, setProducts] = useState<MonitoredProduct[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailNotificationConfig>(EMPTY_EMAIL_CONFIG);
  const [cves, setCves] = useState<CVEItem[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);

  const [selectedCveId, setSelectedCveId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [operationNotice, setOperationNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(true);

  const showOperationNotice = (success: boolean, message: string) => {
    setOperationNotice({ success, message });
    window.setTimeout(() => setOperationNotice(null), 6000);
  };

  const requireOk = async (res: Response) => {
    if (res.ok) return res;
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  };

  const reloadServerData = async () => {
    const fetchJson = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
      return res.json();
    };

    try {
      const [resProd, resPrj, resEmail, resCve, resNotif, resRule, resWh, resLogs] = await Promise.all([
        fetchJson('/api/products'),
        fetchJson('/api/projects'),
        fetchJson('/api/email/config'),
        fetchJson('/api/cves'),
        fetchJson('/api/alerts'),
        fetchJson('/api/rules'),
        fetchJson('/api/webhooks'),
        fetchJson('/api/logs'),
      ]);

      if (Array.isArray(resProd)) setProducts(resProd);
      if (Array.isArray(resPrj)) setProjects(resPrj);
      if (resEmail && resEmail.smtpServer) setEmailConfig(resEmail);
      if (Array.isArray(resCve)) setCves(resCve);
      if (Array.isArray(resNotif)) setNotifications(resNotif);
      if (Array.isArray(resRule)) setRules(resRule);
      if (Array.isArray(resWh)) setWebhooks(resWh);
      if (Array.isArray(resLogs)) setLogs(resLogs);
      setDbConnected(true);
    } catch (err) {
      console.warn('Backend API connection failed:', err);
      setDbConnected(false);
    }
  };

  useEffect(() => {
    reloadServerData();
    const interval = setInterval(reloadServerData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/cves/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await requireOk(res);
      const result = await res.json();
      await reloadServerData();
      showOperationNotice(
        !result.errors?.length,
        `掃描完成：成功 ${result.scannedCount} 項、失敗 ${result.errors?.length || 0} 項，新增 ${result.alertsTriggered} 則警報。${result.errors?.[0] ? ` ${result.errors[0].productName}: ${result.errors[0].error}` : ''}`,
      );
    } catch (err: any) {
      console.error('Scan error:', err);
      showOperationNotice(false, `掃描失敗：${err?.message || '未知錯誤'}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'ACKNOWLEDGED' } : n)));
  };

  const handleResolveAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}/resolve`, { method: 'POST' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'RESOLVED' } : n)));
  };

  const selectedCve = cves.find((c) => c.id === selectedCveId) || null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans selection:bg-blue-500 selection:text-white py-3 px-2 sm:px-4">
      <div className="max-w-[1600px] mx-auto bg-slate-50 border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[92vh]">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notifications={notifications}
          products={products}
          isScanning={isScanning}
          onTriggerScan={handleTriggerScan}
          onAcknowledgeAlert={handleAcknowledgeAlert}
          onSelectCve={(cveId) => setSelectedCveId(cveId)}
        />

        {!dbConnected && (
          <div
            role="alert"
            className="mx-4 mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
          >
            ⚠️ 無法連線至後端資料庫，目前顯示的資料可能不完整或為空。請確認後端服務與 PostgreSQL 連線狀態。
          </div>
        )}

        {operationNotice && (
          <div
            role="status"
            className={`mx-4 mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
              operationNotice.success ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'
            }`}
          >
            {operationNotice.message}
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <Dashboard
              products={products}
              cves={cves}
              notifications={notifications}
              isScanning={isScanning}
              onTriggerScan={handleTriggerScan}
              onSelectCve={(cveId) => setSelectedCveId(cveId)}
              onNavigateTab={(tab) => {
                if (tab === 'projects') {
                  setActiveTab('projects');
                } else if (tab === 'logs') {
                  setSystemSubTab('logs');
                  setActiveTab('system-management');
                } else {
                  setActiveTab(tab);
                }
              }}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectManager
              projects={projects}
              products={products}
              emailConfig={emailConfig}
              cves={cves}
              onRefreshData={reloadServerData}
              onSelectCve={(cveId) => setSelectedCveId(cveId)}
            />
          )}

          {activeTab === 'system-management' && (
            <SystemManager
              projects={projects}
              products={products}
              emailConfig={emailConfig}
              logs={logs}
              onRefreshData={reloadServerData}
              onSelectCve={(cveId) => setSelectedCveId(cveId)}
              defaultSubTab={systemSubTab}
            />
          )}

          {activeTab === 'documentation' && <Documentation />}
        </main>
      </div>

      {selectedCveId && <CveDetailModal cve={selectedCve} onClose={() => setSelectedCveId(null)} />}
    </div>
  );
}
