import React, { useState } from 'react';
import {
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Copy,
  Terminal,
  ShieldCheck,
  Building2,
  ExternalLink,
  Bot,
  RefreshCw,
  Sparkles,
  Download,
  Check,
} from 'lucide-react';
import { Ticket, TicketStatus } from '../types';

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdateStatus: (ticketId: string, newStatus: TicketStatus) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
  onUpdateStatus,
}) => {
  const [copied, setCopied] = useState(false);

  // Priority Badges
  const priorityColors = {
    CRITICAL: 'bg-rose-100 text-rose-800 border-rose-300',
    HIGH: 'bg-amber-100 text-amber-800 border-amber-300',
    MEDIUM: 'bg-blue-100 text-blue-800 border-blue-300',
    LOW: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  const statusColors = {
    OPEN: 'bg-rose-50 text-rose-700 border-rose-200',
    IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const statusLabels = {
    OPEN: '🚨 待處置 (OPEN)',
    IN_PROGRESS: '⚡ 修補中 (IN_PROGRESS)',
    RESOLVED: '✅ 已解決 (RESOLVED)',
    CLOSED: '🔒 已結案 (CLOSED)',
  };

  const handleCopyMarkdown = () => {
    const md = `# [${ticket.ticketNo}] ${ticket.title}
**專案名稱:** ${ticket.projectName} (${ticket.projectCode})
**負責人:** ${ticket.assigneeName}
**優先等級:** ${ticket.priority} | **SLA:** ${ticket.slaHours} 小時內完成修補 (${new Date(ticket.slaDeadline).toLocaleString('zh-TW')})
**使用 AI 模型:** ${ticket.aiModelUsed}

---

## 1. 高階資安威脅摘要 (Executive Summary)
${ticket.executiveSummary}

## 2. 根因剖析 (Root Cause Analysis)
${ticket.rootCauseAnalysis}

## 3. 受影響 CVE 漏洞清單 (共 ${ticket.cveCount} 個)
${ticket.cveList.map((c) => `- **${c.cveId}** (${c.productName}): CVSS ${c.cvss} [${c.severity}] ${c.cisaKev ? '🔥 CISA KEV 攻擊中' : ''} - ${c.title}`).join('\n')}

## 4. 具體修補步驟 (Action Steps)
${ticket.actionSteps.map((s) => `### 步驟 ${s.stepNumber}: ${s.title}\n${s.detail}\n${s.commandSnippet ? '```bash\n' + s.commandSnippet + '\n```' : ''}`).join('\n\n')}

## 5. 權宜防禦規避方案 (Workaround)
${ticket.mitigationPlan}

## 6. 修補驗證指引
${ticket.verificationMethod}
`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-blue-600/30 border border-blue-400/30 rounded-2xl text-blue-400 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-blue-400 tracking-wider">
                  {ticket.ticketNo}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-extrabold border rounded-full ${priorityColors[ticket.priority]}`}>
                  {ticket.priority} 優先級
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded-full flex items-center space-x-1">
                  <Bot className="w-3 h-3" />
                  <span>{ticket.aiModelUsed}</span>
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5 leading-snug">
                {ticket.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Status Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 font-medium text-slate-700">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>專案: <strong className="text-slate-900">{ticket.projectName}</strong> ({ticket.projectCode})</span>
            </div>

            <div className="flex items-center space-x-1.5 text-slate-600">
              <User className="w-4 h-4 text-slate-400" />
              <span>負責人: <strong className="text-slate-900">{ticket.assigneeName}</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-semibold">工單狀態:</span>
            <select
              value={ticket.status}
              onChange={(e) => onUpdateStatus(ticket.id, e.target.value as TicketStatus)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none cursor-pointer ${statusColors[ticket.status]}`}
            >
              <option value="OPEN">{statusLabels.OPEN}</option>
              <option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option>
              <option value="RESOLVED">{statusLabels.RESOLVED}</option>
              <option value="CLOSED">{statusLabels.CLOSED}</option>
            </select>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-slate-800">
          {/* SLA & Time Alert Box */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-900">SLA 修補時限 (Fix Deadline): {ticket.slaHours} 小時內</span>
                <p className="text-xs text-amber-700 font-mono mt-0.5">
                  目標修補截止時間: {new Date(ticket.slaDeadline).toLocaleString('zh-TW')}
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold px-3 py-1 bg-amber-600 text-white rounded-xl shadow-xs">
              SLA 剩餘時間倒數中
            </span>
          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>1. AI 漏洞高階威脅摘要 (Executive Risk Summary)</span>
            </h3>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed font-medium">
              {ticket.executiveSummary}
            </div>
          </div>

          {/* Root Cause Analysis */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>2. 底層技術根因剖析 (Root Cause Analysis)</span>
            </h3>
            <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-sm text-slate-800 leading-relaxed font-mono">
              {ticket.rootCauseAnalysis}
            </div>
          </div>

          {/* Affected CVEs List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>3. 受影響 CVE 漏洞項目 (共 {ticket.cveCount} 項)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ticket.cveList.map((cve) => (
                <div key={cve.cveId} className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600">{cve.cveId}</span>
                    <div className="flex items-center space-x-1">
                      {cve.cisaKev && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-600 text-white rounded">
                          CISA KEV
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                        CVSS {cve.cvss}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{cve.productName}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{cve.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Remediation Action Steps */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              <span>4. AI 指引之具體修補處置步驟 (Actionable Steps)</span>
            </h3>

            <div className="space-y-3">
              {ticket.actionSteps.map((step) => (
                <div key={step.stepNumber} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {step.stepNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{step.title}</h4>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed pl-8">{step.detail}</p>

                  {step.commandSnippet && (
                    <div className="ml-8 mt-2 p-3 bg-slate-950 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto border border-slate-800 shadow-inner">
                      <pre>{step.commandSnippet}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mitigation / Workaround */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              5. 權宜防禦規避方案 (Workaround / WAF Isolation)
            </h3>
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-xs text-slate-800 leading-relaxed">
              {ticket.mitigationPlan}
            </div>
          </div>

          {/* Verification Method */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              6. 修補驗證與複查機制 (Verification Protocol)
            </h3>
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs text-slate-800 leading-relaxed font-mono">
              {ticket.verificationMethod}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? '已複製 Markdown 工單！' : '複製完整 Markdown 格式工單'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
