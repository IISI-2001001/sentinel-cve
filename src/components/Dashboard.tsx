import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Layers,
  Database,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Clock,
  Zap,
  Server,
  FileCheck,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { MonitoredProduct, CVEItem, AlertNotification } from '../types';

interface DashboardProps {
  products: MonitoredProduct[];
  cves: CVEItem[];
  notifications: AlertNotification[];
  isScanning: boolean;
  onTriggerScan: () => void;
  onSelectCve: (cveId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  products,
  cves,
  notifications,
  isScanning,
  onTriggerScan,
  onSelectCve,
  onNavigateTab,
}) => {
  const activeAlerts = notifications.filter((n) => n.status !== 'RESOLVED');
  const criticalCount = cves.filter((c) => c.cvss.severity === 'CRITICAL').length;
  const highCount = cves.filter((c) => c.cvss.severity === 'HIGH').length;
  const mediumCount = cves.filter((c) => c.cvss.severity === 'MEDIUM').length;
  const lowCount = cves.filter((c) => c.cvss.severity === 'LOW').length;
  const cisaKevCount = cves.filter((c) => c.cisaKev).length;

  const totalCves = cves.length;

  const getProductStatus = (product: MonitoredProduct) => {
    const alertCount = activeAlerts.filter((alert) => alert.productName.toLowerCase() === product.name.toLowerCase()).length;
    if (alertCount > 0) {
      return { label: `${alertCount} 個有效警報`, className: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertCircle };
    }
    if (product.detectedCveCount > 0) {
      return { label: `${product.detectedCveCount} 個已知漏洞`, className: 'bg-orange-50 text-orange-700 border-orange-200', icon: ShieldAlert };
    }
    if (product.hasUpdateAvailable) {
      return { label: '需要更新', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: RefreshCw };
    }
    if (!product.lastScannedAt) {
      return { label: '尚未完成掃描', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock };
    }
    return { label: '未發現已知風險', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle };
  };

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-lg border border-slate-200">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-blue-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SOC 全時自動防護運作中</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              企業資安資產與 CVE 漏洞即時監控中心
            </h1>
            <p className="text-slate-200 text-sm max-w-2xl leading-relaxed">
              SentinelCVE 自動追蹤科技堆棧資產、整合 NIST NVD v2.0 與 CISA KEV 官方資料庫，並調用 AI 進行威脅深度剖析與即時警報。
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monitored Products */}
        <div
          onClick={() => onNavigateTab('products')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">監控資產產品</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{products.length}</span>
            <span className="text-xs text-slate-500 font-mono">個技術組件</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>自動定時掃描: {products.filter((p) => p.autoScanEnabled).length} 個</span>
            <span className="text-blue-600 group-hover:underline flex items-center font-medium">
              管理資產 &rarr;
            </span>
          </div>
        </div>

        {/* Card 2: Active Alerts */}
        <div
          onClick={() => onNavigateTab('system-management')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">待處置威脅警報</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-600">{activeAlerts.length}</span>
            <span className="text-xs text-slate-500 font-mono">則未關閉警報</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span className="text-rose-600 font-semibold">Critical 危機: {activeAlerts.filter(a => a.severity === 'CRITICAL').length}</span>
            <span className="text-rose-600 group-hover:underline flex items-center font-medium">
              開啟系統通報與 Webhook &rarr;
            </span>
          </div>
        </div>

        {/* Card 3: CISA KEV Exploits */}
        <div
          onClick={() => onNavigateTab('projects')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">CISA KEV 在野攻擊</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-amber-600">{cisaKevCount}</span>
            <span className="text-xs text-slate-500 font-mono">項確定遭利用</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>美國資安局警告警訊</span>
            <span className="text-amber-600 group-hover:underline flex items-center font-medium">
              查看專案弱點矩陣 &rarr;
            </span>
          </div>
        </div>

        {/* Card 4: Total Analyzed CVEs */}
        <div
          onClick={() => onNavigateTab('projects')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">CVE 資料庫分析數</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalCves}</span>
            <span className="text-xs text-slate-500 font-mono">條紀錄</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>AI 剖析: {cves.filter(c => c.aiAnalysis).length} 項</span>
            <span className="text-indigo-600 group-hover:underline flex items-center font-medium">
              查看專案弱點 &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Severity Distribution & Monitored Products Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Severity Visual Breakdown */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>CVSS 風險等級分佈</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">Total {totalCves}</span>
          </div>

          {/* Severity Progress Bars */}
          <div className="space-y-4">
            {/* Critical */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-rose-700 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>CRITICAL 極高風險 (CVSS 9.0-10.0)</span>
                </span>
                <span className="text-slate-800 font-mono">{criticalCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalCves > 0 ? (criticalCount / totalCves) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* High */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-700 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>HIGH 高風險 (CVSS 7.0-8.9)</span>
                </span>
                <span className="text-slate-800 font-mono">{highCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalCves > 0 ? (highCount / totalCves) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Medium */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-yellow-700 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>MEDIUM 中度風險 (CVSS 4.0-6.9)</span>
                </span>
                <span className="text-slate-800 font-mono">{mediumCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-yellow-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalCves > 0 ? (mediumCount / totalCves) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Low */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>LOW 低風險 (CVSS 0.1-3.9)</span>
                </span>
                <span className="text-slate-800 font-mono">{lowCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalCves > 0 ? (lowCount / totalCves) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 space-y-2">
            <span className="text-xs font-bold text-blue-700 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5" />
              <span>自動風險分析與通報提示</span>
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              當掃描結果符合已啟用的警報規則並建立新警報後，系統會依設定產生 AI 風險與處置建議，並透過站內警報、Teams、Email 或 Webhook 通報。本功能不會自動封鎖、隔離、升級或修補系統。
            </p>
          </div>
        </div>

        {/* Right Column: Recent Monitored Assets & Live Stream */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monitored Products Quick Matrix */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>重點監控資產狀態</span>
              </h2>
              <button
                onClick={() => onNavigateTab('products')}
                className="text-xs text-blue-600 hover:underline flex items-center space-x-1 font-medium"
              >
                <span>管理全部資產 ({products.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.slice(0, 6).map((product) => {
                const status = getProductStatus(product);
                const StatusIcon = status.icon;
                return (
                  <div
                    key={product.id}
                    onClick={() => onNavigateTab('products')}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">{product.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-mono">
                        {product.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">CPE: {product.cpeKeyword}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      目前 {product.currentVersion || '未設定'}
                      {product.latestSecureVersion ? ` / 最新安全版 ${product.latestSecureVersion}` : ''}
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold border ${status.className}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span>{status.label}</span>
                    </span>
                  </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Recent CVE Stream */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-600" />
                <span>最新監控到之漏洞條目 (Live Feed)</span>
              </h2>
              <button
                onClick={() => onNavigateTab('projects')}
                className="text-xs text-blue-600 hover:underline flex items-center space-x-1 font-medium"
              >
                <span>進入專案查看弱點 &rarr;</span>
              </button>
            </div>

            <div className="space-y-3">
              {cves.slice(0, 4).map((cve) => (
                <div
                  key={cve.id}
                  onClick={() => onSelectCve(cve.id)}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-black text-blue-600 group-hover:underline">
                        {cve.id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-white text-slate-700 border border-slate-200">
                        {cve.productName}
                      </span>
                      {cve.cisaKev && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          CISA KEV 攻擊中
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          cve.cvss.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        CVSS {cve.cvss.baseScore} ({cve.cvss.severity})
                      </span>
                      {cve.aiAnalysis && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>AI 分析完成</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-700 line-clamp-2 leading-relaxed font-medium">
                    {cve.title} - {cve.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
