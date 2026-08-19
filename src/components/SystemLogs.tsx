import React, { useState } from 'react';
import { Terminal, Filter, RefreshCw, Layers, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { ScanLog } from '../types';

interface SystemLogsProps {
  logs: ScanLog[];
  onRefreshLogs: () => void;
}

export const SystemLogs: React.FC<SystemLogsProps> = ({ logs, onRefreshLogs }) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (selectedType === 'ALL') return true;
    return log.type === selectedType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-blue-600" />
            <span>資安監控系統日誌與 Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            記錄即時 API 檢索、背景定期檢測、警報觸發規則與 Webhook 推播狀態等背景排程日誌。
          </p>
        </div>

        <button
          onClick={onRefreshLogs}
          className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-blue-700 font-bold text-xs flex items-center space-x-1.5 transition-colors border border-slate-200 self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>重新整理紀錄</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
        <span className="text-xs text-slate-500 mr-2">類別篩選:</span>
        {['ALL', 'AUTO_SCAN', 'ALERT_TRIGGER', 'AI_ANALYSIS', 'WEBHOOK_DISPATCH'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedType === type
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            {type === 'ALL'
              ? '全部事件'
              : type === 'AUTO_SCAN'
              ? '背景自動掃描'
              : type === 'ALERT_TRIGGER'
              ? '警報觸發'
              : type === 'AI_ANALYSIS'
              ? 'Gemini AI 分析'
              : 'Webhook 通報'}
          </button>
        ))}
      </div>

      {/* Terminal View */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-hidden shadow-xl space-y-2">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
          <span>EVENT AUDIT TRAIL ({filteredLogs.length} Records)</span>
          <span className="flex items-center space-x-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>REALTIME AUDIT LOG</span>
          </span>
        </div>

        <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500">目前尚無特定類別之日誌事件</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleTimeString('zh-TW')}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        log.level === 'SUCCESS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : log.level === 'WARNING'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : log.level === 'ERROR'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 text-[10px]">
                      [{log.type}]
                    </span>
                  </div>
                  <p className="text-slate-100 font-sans text-xs">{log.message}</p>
                  {log.details && <p className="text-[11px] text-slate-400">{log.details}</p>}
                </div>

                {log.productName && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700 self-start sm:self-auto shrink-0">
                    {log.productName}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
