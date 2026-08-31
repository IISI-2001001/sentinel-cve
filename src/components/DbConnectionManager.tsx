import React, { useEffect, useState } from 'react';
import { Database, Save, RefreshCw, AlertCircle, CheckCircle2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface DbConfigResponse {
  host: string;
  port: number;
  database: string;
  username: string;
  passwordSet: boolean;
  source: 'config-file' | 'env' | 'default';
  updatedAt?: string | null;
}

interface TestResult {
  success: boolean;
  message: string;
  testedAt?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  'config-file': '本機設定檔 (config/db.properties)',
  env: '環境變數 (DATABASE_URL)',
  default: '預設值 (未設定任何來源)',
};

/**
 * 「資料庫連線」頁面：設定後端連線的 PostgreSQL 主機資訊。設定值會寫入後端本機檔案
 * (config/db.properties)，不會存進系統本身的資料庫 —— 避免「資料庫連不上、卻要靠這個
 * 連不上的資料庫來儲存新連線設定」的雞生蛋問題。儲存後一律需要重新啟動後端服務才會套用。
 */
export const DbConnectionManager: React.FC = () => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);
  const [source, setSource] = useState<string>('default');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
      const res = await fetch('/api/system/db-config');
      const data: DbConfigResponse = await res.json();
      if (!res.ok) throw new Error((data as any).message || `載入失敗 (HTTP ${res.status})`);
      setHost(data.host || '');
      setPort(String(data.port || 5432));
      setDatabase(data.database || '');
      setUsername(data.username || '');
      setPasswordSet(!!data.passwordSet);
      setSource(data.source || 'default');
      setUpdatedAt(data.updatedAt || null);
      setPassword('');
    } catch (err: any) {
      setError(err.message || '載入資料庫連線設定失敗');
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
      const res = await fetch('/api/system/db-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: host.trim(), port: Number(port) || 5432, database: database.trim(), username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `儲存失敗 (HTTP ${res.status})`);
      setNotice('已儲存資料庫連線設定，需重新啟動後端服務（重新執行 mvn spring-boot:run 或 docker compose restart）才會套用新連線。');
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
      const res = await fetch('/api/system/db-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim() || undefined,
          port: Number(port) || undefined,
          database: database.trim() || undefined,
          username: username.trim() || undefined,
          password: password || undefined,
        }),
      });
      const data: TestResult = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setError(err.message || '連線測試失敗');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center space-x-2 px-3 py-2.5 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start space-x-2 px-3 py-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
          <Database className="w-3.5 h-3.5 text-cyan-600" />
          <span>PostgreSQL 連線設定</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">主機 (Host)</label>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={loading}
              placeholder="例如 192.168.100.20"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-cyan-500 shadow-2xs disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">連接埠 (Port)</label>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={loading}
              placeholder="5432"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-cyan-500 shadow-2xs disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">資料庫名稱 (Database)</label>
            <input
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              disabled={loading}
              placeholder="sentinel_cve"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-cyan-500 shadow-2xs disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">使用者名稱 (Username)</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="sentinel"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-cyan-500 shadow-2xs disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-500">
              密碼 (Password) {passwordSet && <span className="text-slate-400 font-normal">— 留空則沿用目前已儲存的密碼</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder={passwordSet ? '••••••••（留空以沿用）' : '請輸入密碼'}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-cyan-500 shadow-2xs disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 shrink-0"
                title={showPassword ? '隱藏' : '顯示'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? '儲存中...' : '儲存設定'}</span>
          </button>
          <button
            type="button"
            disabled={testing || loading}
            onClick={handleTest}
            className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? '測試中...' : '測試連線'}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
          此設定會寫入後端伺服器本機檔案（<code className="bg-white px-1 py-0.5 rounded border border-slate-200">config/db.properties</code>），
          優先於 docker-compose 的 <code className="bg-white px-1 py-0.5 rounded border border-slate-200">DATABASE_URL</code> 環境變數。
          <strong className="text-amber-700"> 儲存後請重新啟動後端服務</strong>（本機開發：重新執行 <code className="bg-white px-1 py-0.5 rounded border border-slate-200">mvn spring-boot:run</code>；
          Docker：<code className="bg-white px-1 py-0.5 rounded border border-slate-200">docker compose restart sentinel-cve</code>）才會套用新連線，「測試連線」按鈕不會影響目前正在運作中的連線。
        </p>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
          <span>
            目前來源：<span className="font-bold text-slate-700">{SOURCE_LABEL[source] || source}</span>
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
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
};
