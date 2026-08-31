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
import {
  INITIAL_PRODUCTS,
  INITIAL_CVES,
  INITIAL_RULES,
  INITIAL_NOTIFICATIONS,
  INITIAL_WEBHOOKS,
  INITIAL_LOGS,
  INITIAL_PROJECTS,
  INITIAL_EMAIL_CONFIG,
} from './data/initialData';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [systemSubTab, setSystemSubTab] = useState<
    'schedule' | 'teams-notification' | 'logs' | 'email-smtp' | 'cpe-management'
  >('schedule');

  const [products, setProducts] = useState<MonitoredProduct[]>(INITIAL_PRODUCTS);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [emailConfig, setEmailConfig] = useState<EmailNotificationConfig>(INITIAL_EMAIL_CONFIG);
  const [cves, setCves] = useState<CVEItem[]>(INITIAL_CVES);
  const [notifications, setNotifications] = useState<AlertNotification[]>(INITIAL_NOTIFICATIONS);
  const [rules, setRules] = useState<AlertRule[]>(INITIAL_RULES);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(INITIAL_WEBHOOKS);
  const [logs, setLogs] = useState<ScanLog[]>(INITIAL_LOGS);

  const [selectedCveId, setSelectedCveId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [operationNotice, setOperationNotice] = useState<{ success: boolean; message: string } | null>(null);

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
    try {
      const [resProd, resPrj, resEmail, resCve, resNotif, resRule, resWh, resLogs] = await Promise.all([
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/projects').then((r) => r.json()),
        fetch('/api/email/config').then((r) => r.json()),
        fetch('/api/cves').then((r) => r.json()),
        fetch('/api/alerts').then((r) => r.json()),
        fetch('/api/rules').then((r) => r.json()),
        fetch('/api/webhooks').then((r) => r.json()),
        fetch('/api/logs').then((r) => r.json()),
      ]);

      if (Array.isArray(resProd)) setProducts(resProd);
      if (Array.isArray(resPrj)) setProjects(resPrj);
      if (resEmail && resEmail.smtpServer) setEmailConfig(resEmail);
      if (Array.isArray(resCve)) setCves(resCve);
      if (Array.isArray(resNotif)) setNotifications(resNotif);
      if (Array.isArray(resRule)) setRules(resRule);
      if (Array.isArray(resWh)) setWebhooks(resWh);
      if (Array.isArray(resLogs)) setLogs(resLogs);
    } catch (err) {
      console.warn('Backend API connection warning, using local state:', err);
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
