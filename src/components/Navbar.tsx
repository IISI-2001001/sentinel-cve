import React, { useState } from 'react';
import {
  ShieldAlert,
  Bell,
  RefreshCw,
  Activity,
  Layers,
  Database,
  FileText,
  Terminal,
  CheckCircle2,
  X,
  ExternalLink,
  Sliders,
  Sparkles,
  FolderKanban,
  Settings,
  BookOpen,
} from 'lucide-react';
import { AlertNotification, MonitoredProduct } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: AlertNotification[];
  products: MonitoredProduct[];
  isScanning: boolean;
  onTriggerScan: () => void;
  onAcknowledgeAlert: (id: string) => void;
  onSelectCve: (cveId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  notifications,
  products,
  isScanning,
  onTriggerScan,
  onAcknowledgeAlert,
  onSelectCve,
}) => {

  const [showBellDropdown, setShowBellDropdown] = useState(false);

  const unreadAlerts = notifications.filter((n) => n.status === 'UNREAD');
  const criticalCount = unreadAlerts.filter((n) => n.severity === 'CRITICAL').length;

  const navItems: Array<{ id: string; label: string; icon: any; badge?: number | string }> = [
    { id: 'dashboard', label: '總覽儀表板', icon: Activity },
    { id: 'projects', label: '專案管理', icon: FolderKanban },
    { id: 'system-management', label: '系統管理', icon: Settings },
    { id: 'documentation', label: '系統說明與專業名詞', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-2xs">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Tier: Branding & Quick Action Controls */}
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
          {/* Logo & App Branding */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="relative p-2 bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 rounded-xl shadow-md shadow-blue-500/20">
              <ShieldAlert className="w-5 h-5 text-white" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  Sentinel<span className="text-blue-600">CVE</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                  v2.5 Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono hidden sm:block">CVE 漏洞即時監控與自動警報系統</p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-2.5">
            {/* Quick Manual Scan Button */}
            <button
              onClick={onTriggerScan}
              disabled={isScanning}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs ${
                isScanning
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-500/30 shadow-blue-500/10'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-white' : ''}`} />
              <span className="hidden sm:inline">{isScanning ? '掃描中...' : '即時掃描'}</span>
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowBellDropdown(!showBellDropdown)}
                className="relative p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-700 transition-colors shadow-2xs"
              >
                <Bell className="w-4 h-4" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadAlerts.length}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {showBellDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-slate-900">未處置漏洞警報 ({unreadAlerts.length})</span>
                    </div>
                    {criticalCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded">
                        {criticalCount} CRITICAL
                      </span>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {unreadAlerts.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        系統安全，目前無未處置高危警報！
                      </div>
                    ) : (
                      unreadAlerts.map((notif) => (
                        <div key={notif.id} className="p-3 hover:bg-slate-50 transition-colors group">
                          <div className="flex items-start justify-between">
                            <span
                              onClick={() => {
                                onSelectCve(notif.cveId);
                                setShowBellDropdown(false);
                              }}
                              className="font-mono text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                              {notif.cveId}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${
                                notif.severity === 'CRITICAL'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              CVSS {notif.cvssScore}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium mt-1 line-clamp-2">{notif.cveTitle}</p>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {notif.productName}
                            </span>
                            <button
                              onClick={() => onAcknowledgeAlert(notif.id)}
                              className="text-slate-500 hover:text-blue-600 underline font-sans"
                            >
                              標記為已讀
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 bg-slate-50 border-t border-slate-200 text-center">
                    <button
                      onClick={() => {
                        setActiveTab('system-management');
                        setShowBellDropdown(false);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      進入系統管理與設定中心 &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Tier: Independent Dedicated Navigation Bar Row */}
        <nav className="py-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.id === 'system-management' && unreadAlerts.length > 0
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
