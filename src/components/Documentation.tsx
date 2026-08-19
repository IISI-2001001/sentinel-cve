import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Search,
  ShieldAlert,
  Layers,
  Database,
  Bell,
  Sparkles,
  Settings,
  FolderKanban,
  Clock,
  MessageSquare,
  Terminal,
  Sliders,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Cpu,
  Zap,
  ExternalLink,
  ShieldCheck,
  Info,
  Key,
  Ticket,
  Send,
  RefreshCw,
  LayoutGrid,
  Activity,
} from 'lucide-react';

export const Documentation: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'glossary' | 'sources' | 'sop' | 'workflow' | 'faq'>('glossary');

  // Term Glossary Data
  const terms = [
    {
      term: 'CVE (Common Vulnerabilities and Exposures)',
      zhName: '國際通用漏洞與曝露編號',
      tag: '漏洞識別標籤',
      summary: '由 MITRE 協會與美國國家標準暨技術研究院 (NIST) 共同維護的全球唯一漏洞命名標準。',
      detail:
        '例如「CVE-2024-3094」。CVE Program 為每個公開揭露的弱點建立一筆 CVE Record，使人員與工具能以同一識別碼協作排序與處置；CVE 本身不等於完整風險分析或修補建議。',
    },
    {
      term: 'CPE (Common Platform Enumeration)',
      zhName: '通用平台列舉標示語法',
      tag: '資產比對規範',
      summary: '用於結構化標示作業系統、應用軟體或硬體設備名稱與版本號的標準格式。',
      detail:
        '格式範例：cpe:2.3:a:nginx:nginx:1.24.0。系統結合 CPE、產品別名、供應商與版本資訊進行關聯；比對結果仍應依官方公告與實際部署版本複核。',
    },
    {
      term: 'CVSS (Common Vulnerability Scoring System)',
      zhName: '通用漏洞風險評分系統',
      tag: '風險評量標準',
      summary: '國際公認的漏洞嚴重程度量化標準，分數介於 0.0 至 10.0 分之間。',
      detail:
        '分為四個主要區間：極危 Critical (9.0 - 10.0)、高危 High (7.0 - 8.9)、中危 Medium (4.0 - 6.9)、低危 Low (0.1 - 3.9)。評分綜合考量攻擊複雜度、存取特權、機密性/完整性/可用性 (CIA) 之影響。',
    },
    {
      term: 'CISA KEV (Known Exploited Vulnerabilities)',
      zhName: '已知遭積極網路攻擊利用之漏洞目錄',
      tag: '實戰威脅指標',
      summary: '由美國網路安全暨基礎設施安全局 (CISA) 發布的「已於真實網路中遭駭客積極攻擊利用」之漏洞清單。',
      detail:
        '只要漏洞列入 CISA KEV，代表網路上已有攻擊行動或武器化漏洞利用工具 (Exploit)。SentinelCVE 會以 ⚠️ 警告標籤高亮提示，建議最高優先權進行 24 小時內緊急修補。',
    },
    {
      term: 'EPSS (Exploit Prediction Scoring System)',
      zhName: '漏洞攻擊預測評分系統',
      tag: '預測型 AI 指標',
      summary: '基於機器學習演算法預測該漏洞在未來 30 天內「實際被駭客攻擊利用」之機率百分比 (0% - 100%)。',
      detail:
        '傳統 CVSS 僅評估漏洞潛在破壞力，而 EPSS 則評估「被攻擊的即時可能性」。結合 CVSS + EPSS 能協助資安人員優先處理最有可能發生實體入侵的漏洞。',
    },
    {
      term: 'POC (Proof of Concept)',
      zhName: '概念驗證攻擊程式碼',
      tag: '攻擊工具釋出',
      summary: '資安研究人員或攻擊者公開發布之說明如何觸發該漏洞的示範性 Code 或腳本。',
      detail:
        '當 CVE 具備公開 POC 時，門檻低之「腳本小子」亦能輕易進行自動化掃描與入侵，修補緊迫性顯著提升。',
    },
    {
      term: 'Remediation Ticket (資安處置工單)',
      zhName: '安全性修補工單與處置流程',
      tag: '營運處置核心',
      summary: '針對特定專案、產品資產或個別 CVE 漏洞所派發之追蹤任務卡片。',
      detail:
        '包含指派負責人員、優先等級 (CRITICAL, HIGH, MEDIUM, LOW)、SLA 處理期限、AI 產出的執行摘要、根因分析、修補步驟、臨時緩和措施與資安掃描複測指令。',
    },
    {
      term: 'Product Upgrade Matrix (產品版本升級對照)',
      zhName: '產品現行版本與升級修補對照表',
      tag: '資產版本矩陣',
      summary: '專案內部比對受監控資產現有版本 (Current Version) 與推薦修補版本 (Recommended Version) 之對照清單。',
      detail:
        '系統自動分析最新升級版號（如 nginx 1.22.0 ➜ 1.26.1）能消除多少個已有 CVE 漏洞，並支援一鍵指派產品修補工單或啟動 AI 產出專案綜合處置工單。',
    },
    {
      term: 'SLA (Service Level Agreement)',
      zhName: '資安漏洞修補服務等級協定',
      tag: '營運處置時效',
      summary: '企業內部訂定之漏洞處置應變時效 SLA 規範。',
      detail:
        '系統標準預設處置規範：CRITICAL 極危漏洞限時 ≤ 24 小時修補完成；HIGH 高危漏洞限時 ≤ 72 小時修補完成；MEDIUM 中危限時 ≤ 7 天；LOW 低危限時 ≤ 15 天。',
    },
    {
      term: 'Incoming Webhook & MessageCard',
      zhName: '即時訊息鉤子與互動式卡片',
      tag: '自動通報機制',
      summary: '利用 HTTP POST JSON 將結構化 MessageCard 通知發送至 Microsoft Teams 工作流程或頻道。',
      detail:
        '本系統由各專案分別設定負責人與處理人 Webhook，版本與 CVE 可使用不同頻率，並支援連線測試及手動發送。',
    },
    {
      term: 'Multi-LLM Security Engine',
      zhName: '多模型 AI 威脅處置與修補推演引擎',
      tag: '生成式資安 AI',
      summary: '支援 Google Gemini、Amazon Bedrock、OpenAI、Anthropic Claude、Ollama 與 OpenAI 相容端點的多模型切換。',
      detail:
        '可協助產生根因分析、影響摘要、處置步驟、減緩措施與複測方法。AI 輸出是建議草案，應由技術人員核對官方公告、環境與指令後再執行。',
    },
    {
      term: 'Notification Deduplication',
      zhName: '通知去重與變更觸發',
      tag: '通知控制',
      summary: '自動通知僅在版本狀態或符合條件的 CVE 出現新變化時再發送，避免重複洗版。',
      detail: '手動發送可略過一般去重並重送當前內容；但已結案工單對應的版本與 CVE 會永久從即時、排程與手動通知排除。',
    },
    {
      term: 'Ticket Lifecycle',
      zhName: '資安修補工單生命週期',
      tag: '狀態管理',
      summary: 'OPEN 待處理、IN_PROGRESS 處理中、RESOLVED 已解決、CLOSED 已結案、WAIVED 已豁免。',
      detail: '已解決必須填寫處理說明，仍可進行複測與審核；已結案代表流程正式完成，對應項目會移入「已結案／不再通知」區域。',
    },
  ];

  const filteredTerms = terms.filter(
    (item) =>
      item.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.zhName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.detail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              系統說明與專業名詞手冊 (System Documentation & Glossary)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            依目前系統實際邏輯整理的資安名詞、資料來源、操作 SOP、通知與工單狀態流程及 FAQ。
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'glossary'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📚 專業名詞解釋
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'sources'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🌐 資料來源與弱點查找
          </button>
          <button
            onClick={() => setActiveTab('sop')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'sop'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🛠️ 系統頁面與模組 SOP
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'workflow'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔄 通知與處置流程
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'faq'
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ❓ 常見問答 FAQ
          </button>
        </div>
      </div>

      {/* View 1: Glossary */}
      {activeTab === 'glossary' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋專業資安名詞 (如: CVE, CPE, CVSS, CISA KEV, EPSS, Ticket, SLA, Multi-LLM...)"
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTerms.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {item.tag}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5 flex items-center space-x-2">
                      <span>{item.term}</span>
                    </h3>
                    <p className="text-xs font-bold text-slate-600">{item.zhName}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-800 font-semibold leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  💡 {item.summary}
                </p>

                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 2: Data Sources & Product/CVE Finding Guide */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          {/* Section 1: Official Security Data Sources */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  <span>SentinelCVE 權威資安數據資料來源 (Data Sources)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  本系統透過自動化排程 API 與 AI 威脅推演模型，即時同步全球最權威的國際資安資料庫。
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 flex items-center space-x-1 shrink-0 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>依排程或手動掃描更新</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Source 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-blue-300 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    NIST 官方授權
                  </span>
                  <a
                    href="https://nvd.nist.gov/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-blue-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h3 className="text-sm font-bold text-slate-900">NVD (National Vulnerability Database)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  美國國家標準暨技術研究院 (NIST) 維護的全球權威 CVE 漏洞庫。提供完整漏洞描述、CVSS v3/v4 評分、CPE 影響設備與原廠修補參考連結。
                </p>
                <div className="pt-1 text-[11px] text-blue-600 font-mono font-semibold">API v2.0 RESTful 串接</div>
              </div>

              {/* Source 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-rose-300 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    CISA 美國國安局
                  </span>
                  <a
                    href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h3 className="text-sm font-bold text-slate-900">CISA KEV Catalog</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  美國網路安全暨基礎設施安全局 (CISA) 發布之已知遭駭客活躍利用 (Known Exploited) 漏洞清單。是 SOC 評估緊急修補順序的最高標準。
                </p>
                <div className="pt-1 text-[11px] text-rose-600 font-mono font-semibold">即時實戰威脅高亮標示</div>
              </div>

              {/* Source 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-purple-300 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    FIRST 國際組織
                  </span>
                  <a
                    href="https://www.first.org/epss/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-purple-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h3 className="text-sm font-bold text-slate-900">FIRST EPSS (Exploit Prediction)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  基於 AI 與歷史大數據評估未來 30 天內漏洞被「武器化攻擊利用」之機率百分比 (0-100%)，協助資安團隊預防性修補。
                </p>
                <div className="pt-1 text-[11px] text-purple-600 font-mono font-semibold">每日動態機器學習模型</div>
              </div>

              {/* Source 4 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-amber-300 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    MITRE CVE Org
                  </span>
                  <a
                    href="https://cve.mitre.org/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-amber-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h3 className="text-sm font-bold text-slate-900">MITRE CVE List</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  全球 CVE 國際標準命名與編號核發機構，確保每一筆軟體漏洞都有唯一的 CVE-YYYY-NNNN 識別碼。
                </p>
                <div className="pt-1 text-[11px] text-amber-600 font-mono font-semibold">全球資安共通標準語法</div>
              </div>

              {/* Source 5 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-emerald-300 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Google Open Source
                  </span>
                  <a
                    href="https://osv.dev/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-emerald-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h3 className="text-sm font-bold text-slate-900">OSV.dev (Open Source Vulnerabilities)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  涵蓋 npm、PyPI、Go、Maven、Cargo 等開源生態圈套件漏洞資料庫，協助準確判斷程式庫依賴項風險。
                </p>
                <div className="pt-1 text-[11px] text-emerald-600 font-mono font-semibold">開源專案依賴項防護</div>
              </div>

              {/* Source 6 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-sky-300 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                    Multi-LLM Engine
                  </span>
                  <a
                    href="https://ai.google.dev/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-sky-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h3 className="text-sm font-bold text-slate-900">AI 多模型威脅解讀引擎</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  結合已設定的 Gemini、Bedrock、OpenAI、Claude、Ollama 或相容模型對 CVE 文字進行分析，產生「處置工單與修補建議」草案；執行前必須人工複核。
                </p>
                <div className="pt-1 text-[11px] text-sky-600 font-mono font-semibold">生成式 AI 工單與修補推演</div>
              </div>
            </div>
          </div>

          {/* Section 2: Platform Logic & How to Search Products / Find Corresponding Vulnerabilities */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <Search className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    本平台產品 (Product / CPE) 與安全弱點之查找與派單實作方法
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    說明 SentinelCVE 平台最新頁面架構下，如何精準進行資產監控、點擊 CVE 彈窗查看詳細分析與發起 AI 修補工單。
                  </p>
                </div>
              </div>
            </div>

            {/* Architecture Logic Diagram / Steps */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 text-indigo-300">
                <Cpu className="w-4 h-4" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  平台核心弱點比對與關聯運算邏輯 (Platform Matching Engine Architecture)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 space-y-1.5">
                  <div className="text-[10px] font-bold text-indigo-300">STEP 1</div>
                  <div className="text-xs font-bold text-white">資產 CPE 特徵化</div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    系統將輸入的產品名稱或 CPE 語法解析為結構化 Key-Value 標籤，或由上傳之 .txt 檔提取軟體關鍵字。
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 space-y-1.5">
                  <div className="text-[10px] font-bold text-indigo-300">STEP 2</div>
                  <div className="text-xs font-bold text-white">跨庫即時檢索</div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    掃描引擎調用 NIST NVD REST API v2.0、OSV.dev 及本地快取庫，撈取匹配該 CPE/關鍵字的所有公開 CVE。
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 space-y-1.5">
                  <div className="text-[10px] font-bold text-indigo-300">STEP 3</div>
                  <div className="text-xs font-bold text-white">版本衝擊範圍比對</div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    將資產登記之當前版本與 CVE 的規則比對，精準判定是否受到影響並計算專案風險指數。
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 space-y-1.5">
                  <div className="text-[10px] font-bold text-indigo-300">STEP 4</div>
                  <div className="text-xs font-bold text-white">告警與工單派發</div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    依專案 CVSS/KEV 條件觸發 Teams Webhook 通知，並可透過 AI 輔助生成包含 Workaround 與複測步驟的修補工單。
                  </p>
                </div>
              </div>
            </div>

            {/* Methods Guide */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>平台提供的 4 種產品與弱點查找與派單實作方法</span>
              </h3>

              {/* Method 1 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      方法一
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">建置「受監控資產產品 (Monitored Products)」與自動定時比對</h4>
                      <p className="text-xs text-slate-500">適合情境：企業內部常駐維運之系統、伺服器與套件庫的長效資產防護。</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg shrink-0 self-start sm:self-auto">
                    主選單：系統管理 &gt; 監控資產產品
                  </span>
                </div>
                <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                  <ol className="list-decimal list-inside pl-2 space-y-1.5">
                    <li>進入<strong>「系統管理」</strong>主頁面，切換至<strong>「📦 監控資產產品」</strong>子頁籤，點擊<strong>「新增受監控產品」</strong>。</li>
                    <li>
                      在 CPE / 關鍵字欄位填入國際標準 CPE 語法（例如 <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">cpe:2.3:a:nginx:nginx</code>）或軟體通用名稱（例如 <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">redis</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">fortios</code>）。
                    </li>
                    <li>輸入當前部署版本號並指派所屬專案與負責人。</li>
                    <li>
                      <strong>平台運作邏輯：</strong>系統排程（或手動掃描）會查詢該產品適用的官方版本來源、NVD 及 OSV 等弱點資料。新增且符合專案條件的弱點才會透過 Teams Webhook 通知。
                    </li>
                  </ol>
                </div>
              </div>

              {/* Method 2 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      方法二
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">點擊任意 CVE 編號開啟「CVE 漏洞威脅剖析 Modal」與 AI 深度解析</h4>
                      <p className="text-xs text-slate-500">適合情境：資安人員從儀表板、專案弱點表或 Notifications 即時調閱特定 CVE 詳情。</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg shrink-0 self-start sm:self-auto">
                    彈窗互動剖析
                  </span>
                </div>
                <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                  <ol className="list-decimal list-inside pl-2 space-y-1.5">
                    <li>在<strong>「總覽儀表板」</strong>或<strong>「專案管理」</strong>中，點擊任何 CVE 編號（例如 <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600">CVE-2024-3094</code>）。</li>
                    <li>系統會隨即從右側拉出/彈出<strong>「CVE 漏洞威脅剖析 Drawer / Modal」</strong>。</li>
                    <li>
                       Modal 中直觀呈現場景描述、CVSS 評分細節、CISA KEV 攻擊狀態與 NVD 官方連結；點擊右上角<strong>「啟動 AI 深度剖析」</strong>按鈕，即可調用配置好的 AI 語言模型產出包含 Workaround 修補指令與掃描複測步驟的分析報告。
                    </li>
                  </ol>
                </div>
              </div>

              {/* Method 3 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      方法三
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">使用 .txt / SBOM 資產盤點表進行自動化整批解析帶入</h4>
                      <p className="text-xs text-slate-500">適合情境：企業進行大量資產盤點，手上有文字檔或軟體物料清單 (SBOM)。</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg shrink-0 self-start sm:self-auto">
                    主選單：系統管理 &gt; 監控資產產品
                  </span>
                </div>
                <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                  <ol className="list-decimal list-inside pl-2 space-y-1.5">
                    <li>在「系統管理 &gt; 監控資產產品」新增或編輯產品對話框中，定位至 CPE 欄位右上角的<strong>「📄 上傳 .txt 檔」</strong>按鈕。</li>
                    <li>選擇包含資產 CPE 語法、套件清單或逗號/換行分隔關鍵字之文字檔案。</li>
                    <li>
                      <strong>平台運作邏輯：</strong>平台前端檔案解析模組會自動提取合法 CPE 標籤與產品特徵，一次性匯入至系統資產數據庫並觸發弱點比對。
                    </li>
                  </ol>
                </div>
              </div>

              {/* Method 4 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      方法四
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">專案產品版本升級對照表 &amp; ⚡ AI 一鍵產出專案修補工單</h4>
                      <p className="text-xs text-slate-500">適合情境：專案經理與 DevSecOps 團隊快速評估整體專案升級版本與生成跨資產綜合修補工單。</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 self-start sm:self-auto">
                    主選單：專案管理
                  </span>
                </div>
                <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                  <ol className="list-decimal list-inside pl-2 space-y-1.5">
                    <li>進入<strong>「專案管理」</strong>，選擇特定專案切換至<strong>「產品版本與升級對照」</strong>或<strong>「資安處置工單」</strong>頁籤。</li>
                    <li>
                      檢視受影響產品之現有版本與推薦升級版本（如 <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">1.22.0 ➜ 1.26.1</code>），點擊產品旁之<strong>「指派升級修補工單」</strong>。
                    </li>
                    <li>
                      或直接點擊專案內的<strong>「⚡ AI 產出專案修補工單」</strong>，系統會將當前專案資產與弱點送交已設定的 AI 模型，產生綜合工單草案並寫入工單看板。
                    </li>
                  </ol>
                </div>
              </div>

              {/* Extra Tip: How to get valid CPEs */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center space-x-1.5 text-amber-950">
                  <Key className="w-4 h-4 text-amber-700" />
                  <span>如何尋找精準的 CPE 關鍵字？ (Tip for Precision CPE Matching)</span>
                </div>
                <p className="leading-relaxed">
                  您可以透過 NIST 官方的 <a href="https://nvd.nist.gov/products/cpe/search" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900 hover:text-amber-700">NVD CPE Search 字典</a> 查詢標準 CPE 2.3 語法（格式如 <code className="bg-white/80 px-1 py-0.5 rounded font-mono">cpe:2.3:a:vendor:product:version</code>）；或者直接在 SentinelCVE 填寫通用軟體名稱與版本，平台後端之模糊匹配演算法亦能順利關聯絕大多數的全球漏洞！
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 3: Module SOP Operations */}
      {activeTab === 'sop' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-8">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>SentinelCVE 系統四大頁面與模組操作指南 (SOP)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              引導您熟悉系統四大主功能選單的使用情境、快捷按鈕與最佳實踐步驟。
            </p>
          </div>

          <div className="space-y-6">
            {/* Page 1 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  01
                </span>
                <h3 className="text-sm font-bold text-slate-900">總覽儀表板 (Dashboard)</h3>
              </div>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside pl-2 leading-relaxed">
                <li><strong>資安態勢全景：</strong>即時統計受監控總資產數、待處置威脅警報數、CISA KEV 攻擊數與 CVE 資料庫總分析數。</li>
                <li><strong>頂部全站即時掃描：</strong>點擊右上角「即時掃描」按鈕，觸發全站資產與最新 NVD 漏洞數據比對。</li>
                <li><strong>🔔 警報通知下拉選單：</strong>點擊頂部鈴鐺圖示，可快速檢視與標記未處置高危警報，點擊 CVE 編號直接彈出分析 Drawer。</li>
                <li><strong>圖表分析與最新 Feed：</strong>提供 CVSS 評分分佈圓餅圖，與即時監控到的最新 CVE Feed 列表。</li>
              </ul>
            </div>

            {/* Page 2 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  02
                </span>
                <h3 className="text-sm font-bold text-slate-900">專案管理 (Project Manager &amp; Ticket Center)</h3>
              </div>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside pl-2 leading-relaxed">
                <li><strong>專案建立與團隊成員：</strong>管理專案代碼、名稱、負責人、處理人與各自 Teams Webhook。</li>
                <li><strong>版本/CVE 獨立通知：</strong>分別啟用並設定即時、15 分鐘、每小時、每日或每週頻率；兩個頁籤均可手動發送。</li>
                <li><strong>產品版本與升級對照 (Upgrade Matrix)：</strong>顯示受監控資產現有版本與推薦安全版本（如 nginx 1.22.0 ➜ 1.26.1），點擊可快速指派升級工單。</li>
                <li><strong>資安處置工單看板：</strong>集中管理 OPEN、IN_PROGRESS、RESOLVED、CLOSED 與 WAIVED；RESOLVED 必須填寫處理說明。</li>
                <li><strong>結案排除：</strong>CLOSED 工單對應的版本/CVE 另行顯示，並不再納入即時、排程或手動通知。</li>
                <li><strong>⚡ AI 一鍵產出專案修補工單：</strong>點擊專案內的「⚡ AI 產出專案修補工單」，由 AI 自動彙整專案內所有弱點，生成綜合性處置工單寫入工單庫。</li>
              </ul>
            </div>

            {/* Page 3 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  03
                </span>
                <h3 className="text-sm font-bold text-slate-900">系統管理 (System Manager - 4 大核心子頁籤)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-xs text-blue-700 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>⏱️ 自動排程與觸發機制</span>
                  </div>
                  <p className="text-[11px] text-slate-600">設定定時掃描週期（每幾小時/每日）與高危自動 AI 剖析及 Teams 通報開關。</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-xs text-blue-700 flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>📦 監控資產產品</span>
                  </div>
                  <p className="text-[11px] text-slate-600">維護受監控技術組件，支援 .txt 檔批次匯入 CPE、AI 檢查最新版本與一鍵弱點比對。</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-xs text-blue-700 flex items-center space-x-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>📋 系統操作與稽核日誌</span>
                  </div>
                  <p className="text-[11px] text-slate-600">即時紀錄全站系統設定變更、掃描觸發、工單建立與 Webhook 派送軌跡 Audit Log。</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-xs text-blue-700 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>🤖 AI 工具與 LLM 引擎設定</span>
                  </div>
                  <p className="text-[11px] text-slate-600">支援 Gemini、Amazon Bedrock、OpenAI、Claude、Ollama 與自訂相容端點，並可測試 API 連線。</p>
                </div>
              </div>
            </div>

            {/* Page 4 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  04
                </span>
                <h3 className="text-sm font-bold text-slate-900">系統說明與專業名詞 (System Documentation)</h3>
              </div>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside pl-2 leading-relaxed">
                <li><strong>專業名詞解釋：</strong>收錄 CVE、CPE、CVSS、CISA KEV、EPSS、SLA 與 Ticket 名詞繁體中文對照。</li>
                <li><strong>資料來源與查找：</strong>詳列 NIST NVD、CISA KEV、OSV.dev 等權威數據來源與 4 種實作查找方法。</li>
                <li><strong>通知與處置流程與 FAQ：</strong>說明掃描、篩選、Teams 通知、派單、解決、結案及停止通知的實際運作。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* View 4: Workflow & Architecture */}
      {activeTab === 'workflow' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>SentinelCVE 自動化聯防管道 (Closed-Loop Automation Architecture)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              系統如何實現從「資產清單」&rarr;「官方版本與弱點檢索」&rarr;「風險篩選與 AI 輔助」&rarr;「Teams 通知與工單追蹤」的處置閉環。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
              <span className="text-[10px] font-extrabold text-blue-700 uppercase bg-blue-100 px-2 py-0.5 rounded">
                Stage 1: 資產與 Cron 排程
              </span>
              <h3 className="text-xs font-bold text-slate-900">1. 常駐排程自動發起</h3>
              <p className="text-[11px] text-slate-600 leading-snug">
                系統排程器 (Scheduler) 定時讀取「系統管理 &gt; 監控資產產品」清單中的 CPE 關鍵字。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">
              <span className="text-[10px] font-extrabold text-indigo-700 uppercase bg-indigo-100 px-2 py-0.5 rounded">
                Stage 2: 漏洞匹配
              </span>
              <h3 className="text-xs font-bold text-slate-900">2. NVD / OSV 資料庫比對</h3>
              <p className="text-[11px] text-slate-600 leading-snug">
                系統自動向全球漏洞庫發起查詢，取得最新發布之 CVE、CVSS 分數與 CISA KEV 攻擊標籤。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
              <span className="text-[10px] font-extrabold text-purple-700 uppercase bg-purple-100 px-2 py-0.5 rounded">
                Stage 3: AI 智力與工單生成
              </span>
              <h3 className="text-xs font-bold text-slate-900">3. AI 生成處置工單</h3>
              <p className="text-[11px] text-slate-600 leading-snug">
                系統依專案 CVSS 門檻與 CISA KEV 條件篩選；使用者可由 AI 輔助產生處置計畫、Workaround 與複測建議，再由人員確認派單。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded">
                Stage 4: 即時團隊聯防
              </span>
              <h3 className="text-xs font-bold text-slate-900">4. Teams 通知與狀態閉環</h3>
              <p className="text-[11px] text-slate-600 leading-snug">
                依版本/CVE 獨立頻率發送易讀 MessageCard，並將工單狀態回映至對應項目；正式結案後停止後續通知。
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              <span>自動化設定控制集中管理</span>
            </div>
            <p>
              「系統管理」負責掃描排程、監控產品、稽核日誌與 AI 工具；Teams Webhook、CVSS/KEV 條件及版本/CVE 通知頻率均由各專案獨立管理。
            </p>
          </div>
        </div>
      )}

      {/* View 5: FAQ */}
      {activeTab === 'faq' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              <span>常見問答與疑難排解 (FAQ &amp; Troubleshooting)</span>
            </h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="text-blue-600 font-extrabold">Q1.</span>
                <span>系統目前有哪些主要的頂部功能選單？</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-5">
                系統為 4 大主要頁面：<strong>「總覽儀表板」</strong>、<strong>「專案管理」</strong>、<strong>「系統管理」</strong>（排程/產品/日誌/AI）與<strong>「系統說明與專業名詞」</strong>。專案 Webhook 與通知條件請在「專案管理」設定。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="text-blue-600 font-extrabold">Q2.</span>
                <span>要如何檢索個別 CVE 漏洞詳細資料與 AI 修補建議？</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-5">
                在「總覽儀表板」或「專案管理」中，點擊任何一個 CVE ID（例如 <code className="bg-white px-1 border border-slate-200 font-mono text-blue-600">CVE-2024-3094</code>），系統會隨即拉出「CVE 漏洞威脅剖析 Drawer / Modal」，顯示完整的 CVSS 評分、CISA KEV 狀態與 NVD 參照連結，並可點擊「啟動 AI 深度剖析」生成 AI 修補建議。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="text-blue-600 font-extrabold">Q3.</span>
                <span>如何整批導入大量的軟體 CPE 關鍵字？</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-5">
                進入「系統管理」主頁面，切換至「📦 監控資產產品」頁籤，點擊「新增受監控產品」或卡片上的編輯按鈕。在 CPE 欄位右上角點擊「📄 上傳 .txt 檔」，即可讀取包含文字關鍵字或以逗號/換行分隔的 .txt 檔案自動整批帶入。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="text-blue-600 font-extrabold">Q4.</span>
                <span>如何對特定產品或全專案進行資安修補工單派發？</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-5">
                您可以在「專案管理」中，選擇專案並切換至「產品版本與升級對照」或「資安處置工單」，點擊個別產品旁的「指派升級修補工單」；或直接點擊專案標題旁的「⚡ AI 產出專案修補工單」，由 AI 自動分析全專案資產與弱點，生成一筆包含處置與升級建議的綜合工單寫入工單看板。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="text-blue-600 font-extrabold">Q5.</span>
                <span>為何 Microsoft Teams 沒有收到通知？</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-5">
                請進入該專案的「通知與頻率」頁籤，確認負責人或處理人 Teams Webhook 已設定並通過測試。再檢查版本/CVE 開關、頻率、CVSS 門檻與 KEV-only 條件。自動通知會去重；無變化時不重送，可使用頁籤上的「手動發送」驗證。已結案項目不會再通知。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <span className="text-blue-600 font-extrabold">Q6.</span>
                <span>如何連接自訂的 AI 語言模型或地端私有化 Ollama？</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-5">
                進入「系統管理」，選擇「🤖 AI 工具與 LLM 引擎設定」頁籤，選單切換「Ollama / 本地 LLM」或「Google Gemini / OpenAI / Claude」，填入對應的 API Key 或 Base Endpoint（如 <code className="font-mono bg-white px-1 border border-slate-200">http://localhost:11434/v1</code>），最後點擊「測試 AI API 連線」確認回傳成功。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
