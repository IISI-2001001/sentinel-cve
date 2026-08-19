import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Terminal,
  FileText,
  Clock,
  Tag,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CVEItem } from '../types';

interface CveDetailModalProps {
  cve: CVEItem | null;
  onClose: () => void;
  onRunAiAssessment: (cveId: string) => Promise<void>;
}

export const CveDetailModal: React.FC<CveDetailModalProps> = ({
  cve,
  onClose,
  onRunAiAssessment,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!cve) return null;

  const handleRunAi = async () => {
    setIsAnalyzing(true);
    await onRunAiAssessment(cve.id);
    setIsAnalyzing(false);
  };

  const handleCopyMarkdown = () => {
    const md = `# [${cve.id}] ${cve.title}
- **產品**: ${cve.productName} (${cve.vendorName})
- **CVSS Score**: ${cve.cvss.baseScore} (${cve.cvss.severity})
- **CISA KEV 在野利用**: ${cve.cisaKev ? '是' : '否'}
- **發布日期**: ${new Date(cve.publishedDate).toLocaleDateString()}

## 漏洞描述
${cve.description}

${
  cve.aiAnalysis
    ? `## Gemini AI 威脅分析報告
### 核心風險概述
${cve.aiAnalysis.summary}

### 攻擊情境
${cve.aiAnalysis.attackScenario}

### 建議修補步驟
${cve.aiAnalysis.mitigationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### 臨時規避措施 (Workaround)
${cve.aiAnalysis.workaround || '無'}

### SOC 指引
${cve.aiAnalysis.executiveAdvisory}`
    : ''
}`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl my-auto">
        {/* Top Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-lg font-black text-blue-600">{cve.id}</span>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                cve.cvss.severity === 'CRITICAL'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              CVSS {cve.cvss.baseScore} ({cve.cvss.severity})
            </span>
            {cve.cisaKev && (
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                CISA KEV 攻擊中
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-200 shadow-2xs"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已複製 Markdown' : '複製報告'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Overview Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                產品: {cve.productName} ({cve.vendorName})
              </span>
              <span className="text-xs text-slate-500 font-mono">
                發布於 {new Date(cve.publishedDate).toLocaleDateString('zh-TW')}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{cve.title}</h2>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 font-medium">
              {cve.description}
            </p>
          </div>

          {/* CVSS Metrics Breakdown Grid */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1">
              <Terminal className="w-3.5 h-3.5 text-blue-600" />
              <span>NIST CVSS v3.1 指標向量數據</span>
            </h3>

            <div className="p-2 rounded bg-white border border-slate-200 text-xs font-mono text-blue-700 break-all shadow-2xs">
              {cve.cvss.vectorString}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-slate-500 text-[10px] block uppercase font-medium">Attack Vector (AV)</span>
                <span className="font-bold text-slate-900">{cve.cvss.attackVector || 'NETWORK'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-slate-500 text-[10px] block uppercase font-medium">Complexity (AC)</span>
                <span className="font-bold text-slate-900">{cve.cvss.attackComplexity || 'LOW'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-slate-500 text-[10px] block uppercase font-medium">Privileges (PR)</span>
                <span className="font-bold text-slate-900">{cve.cvss.privilegesRequired || 'NONE'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-slate-500 text-[10px] block uppercase font-medium">User Interaction (UI)</span>
                <span className="font-bold text-slate-900">{cve.cvss.userInteraction || 'NONE'}</span>
              </div>
            </div>
          </div>

          {/* Gemini AI Section */}
          <div className="bg-slate-50 rounded-2xl border border-indigo-200 p-5 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Gemini AI 漏洞威脅剖析與處置指南</h3>
                  <p className="text-[11px] text-indigo-600 font-medium">由 Gemini AI 進行威脅分析、攻擊路徑解構與修補步驟推演</p>
                </div>
              </div>

              <button
                onClick={handleRunAi}
                disabled={isAnalyzing}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-500/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'AI 推理分析中...' : cve.aiAnalysis ? '重新調用 AI 分析' : '啟動 AI 深度剖析'}</span>
              </button>
            </div>

            {cve.aiAnalysis ? (
              <div className="space-y-4 text-xs">
                {/* Executive Summary */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                  <span className="font-bold text-indigo-700 uppercase tracking-wider text-[11px] block">
                    📌 核心威脅概述
                  </span>
                  <p className="text-slate-800 text-sm font-medium leading-relaxed">{cve.aiAnalysis.summary}</p>
                </div>

                {/* Attack Scenario */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                  <span className="font-bold text-amber-700 uppercase tracking-wider text-[11px] block">
                    ⚔️ 攻擊情境與可能後果
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium">{cve.aiAnalysis.attackScenario}</p>
                </div>

                {/* Mitigation Steps */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs">
                  <span className="font-bold text-emerald-700 uppercase tracking-wider text-[11px] block">
                    🛠️ 建議處置與修補計劃 (Step-by-Step Mitigation)
                  </span>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-800 font-medium">
                    {cve.aiAnalysis.mitigationSteps.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Workaround */}
                {cve.aiAnalysis.workaround && (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs">
                    <span className="font-bold text-blue-700 uppercase tracking-wider text-[11px] block">
                      🛡️ 臨時規避措施 (Workaround)
                    </span>
                    <p className="text-slate-700 leading-relaxed font-medium">{cve.aiAnalysis.workaround}</p>
                  </div>
                )}

                {/* Executive Advisory */}
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 leading-relaxed font-medium">
                  <span className="font-bold text-indigo-800 block mb-1">給 CISO / 資安營運團隊的應變指引：</span>
                  {cve.aiAnalysis.executiveAdvisory}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 space-y-3">
                <Sparkles className="w-8 h-8 text-indigo-600 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  尚未對 {cve.id} 生成 AI 處置報告。點擊右上角【啟動 AI 深度剖析】按鈕調用 Gemini 取得繁體中文風險解答。
                </p>
              </div>
            )}
          </div>

          {cve.matchedBy && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <div className="font-bold">漏洞適用性依據</div>
              <div className="mt-1 font-mono">{cve.matchedBy} · 可信度 {cve.matchConfidence || 'UNKNOWN'}</div>
              {cve.dataSources?.map((source, idx) => (
                <a key={idx} href={source.url} target="_blank" rel="noreferrer" className="mt-1 block text-blue-700 hover:underline break-all">
                  {source.type} · {new Date(source.retrievedAt).toLocaleString('zh-TW')}
                </a>
              ))}
            </div>
          )}

          {/* References */}
          {cve.references && cve.references.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">官方參考連結與資安通報</h3>
              <div className="flex flex-wrap gap-2">
                {cve.references.map((ref, idx) => (
                  <a
                    key={idx}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-blue-600 font-mono flex items-center space-x-1.5 transition-colors"
                  >
                    <span>{ref.name || 'External Link'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
