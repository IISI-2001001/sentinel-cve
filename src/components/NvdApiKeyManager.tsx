import React, { useEffect, useState } from 'react';
import { Key, Save, RefreshCw, AlertCircle, CheckCircle2, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface NvdApiConfigResponse {
  apiKey: string | null;
  updatedAt?: string | null;
  usingEnvFallback?: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
  usedApiKey?: boolean;
  httpStatus?: number;
  rateLimitLimit?: string;
  rateLimitRemaining?: string;
  testedAt?: string;
}

/**
 * 「NVD API Key」頁面：管理呼叫 NIST NVD REST API（CPE Dictionary / CVE API）時所附帶的
 * apiKey。設定後可提升速率上限（無 Key 約 5 requests/30s，有 Key 約 50 requests/30s），
 * 供「產品管理」CPE 查詢與弱點掃描流程使用。若未設定，系統會嘗試回退使用後端環境變數
 * NVD_API_KEY（若有），否則以匿名方式呼叫。
 */
export const NvdApiKeyManager: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [usingEnvFallback, setUsingEnvFallback] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/nvd/config');
      if (!res.ok) throw new Error(`載入失敗 (HTTP ${res.status})`);
      const data: NvdApiConfigResponse = await res.json();
      setApiKey(data.apiKey || '');
      setUpdatedAt(data.updatedAt || null);
      setUsingEnvFallback(!!data.usingEnvFallback);
    } catch (err: any) {
      setError(err.message || '載入 NVD API Key 設定失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    setTestResult(null);
    try {
      const res = await fetch('/api/nvd/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `儲存失敗 (HTTP ${res.status})`);
      setNotice(apiKey.trim() ? '已儲存 NVD API Key。' : '已清除 NVD API Key，將回退為匿名呼叫（或後端環境變數）。');
      await loadConfig();
    } catch (err: any) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch('/api/nvd/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined }),
      });
      const data: TestResult = await res.json();
      setTestResult(data);
      if (!res.ok && !data.message) {
        setError(`測試失敗 (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || 'NVD 連線測試失敗');
    } finally {
      setTesting(false);
    }
  };

  const maskedPreview = apiKey;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center space-x-2 px-3 py-2.5 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center space-x-2 px-3 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
          <Key className="w-3.5 h-3.5 text-amber-600" />
          <span>NIST NVD REST API Key</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={maskedPreview}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
              placeholder="請輸入您在 NVD 申請的 API Key"
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 shadow-2xs disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 shrink-0"
              title={showKey ? '隱藏' : '顯示'}
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleSave}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? '儲存中...' : '儲存'}</span>
            </button>
            <button
              type="button"
              disabled={testing || loading}
              onClick={handleTest}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? '測試中...' : '測試連線'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            用於呼叫 NVD CPE Dictionary / CVE API（<code className="bg-white px-1 py-0.5 rounded border border-slate-200">services.nvd.nist.gov</code>）。
            設定 Key 後可將速率上限由匿名的 5 requests/30 秒提升至 50 requests/30 秒。尚未申請可至{' '}
            <a
              href="https://nvd.nist.gov/developers/request-an-api-key"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              NVD 官方頁面申請 <ExternalLink className="w-3 h-3" />
            </a>
            。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200">
          <span>
            目前狀態：
            {apiKey ? (
              <span className="text-emerald-700 font-bold ml-1">已設定自訂 Key</span>
            ) : usingEnvFallback ? (
              <span className="text-amber-700 font-bold ml-1">未設定，回退使用後端環境變數 NVD_API_KEY</span>
            ) : (
              <span className="text-slate-600 font-bold ml-1">未設定（匿名呼叫）</span>
            )}
          </span>
          {updatedAt && <span>最後更新：{new Date(updatedAt).toLocaleString('zh-TW')}</span>}
        </div>
      </div>

      {testResult && (
        <div
          className={`flex items-start space-x-2 px-4 py-3 rounded-2xl border text-xs font-bold ${
            testResult.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div>{testResult.message}</div>
            <div className="text-[11px] font-medium text-slate-500 flex flex-wrap gap-x-3">
              {testResult.httpStatus && <span>HTTP {testResult.httpStatus}</span>}
              {testResult.rateLimitLimit && <span>速率上限: {testResult.rateLimitLimit}</span>}
              {testResult.rateLimitRemaining && <span>剩餘額度: {testResult.rateLimitRemaining}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
