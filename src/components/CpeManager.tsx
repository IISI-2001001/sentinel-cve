import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, Trash2, Plus, Save, X, Cpu, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CpeCandidate {
  cpe: string;
  vendor: string;
  product: string;
  title?: string;
  deprecated: boolean;
}

interface CpeCacheEntry {
  productNameKey: string;
  productName: string;
  candidates: CpeCandidate[];
  updatedAt: string;
}

/**
 * 「產品管理」頁面：管理 product_cpe_cache 資料表 — 每個「產品名稱」對應一組已知的
 * vendor:product CPE 識別碼（版本已萬用字元化，新增產品時再依使用者輸入的版本代換）。
 * 可從 NVD 重新查詢/刷新、手動新增/編輯、或刪除過時項目。
 */
export const CpeManager: React.FC = () => {
  const [entries, setEntries] = useState<CpeCacheEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Refresh-from-NVD form
  const [queryName, setQueryName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);

  // Manual add/edit modal state
  const [editing, setEditing] = useState<CpeCacheEntry | null>(null);
  const [editCandidatesText, setEditCandidatesText] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cpe-cache');
      if (!res.ok) throw new Error(`載入失敗 (HTTP ${res.status})`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err: any) {
      setError(err.message || '載入產品管理清單失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleRefreshFromNvd = async (name: string) => {
    if (!name.trim()) return;
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/cpe-cache/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `NVD 查詢失敗 (HTTP ${res.status})`);
      setNotice(`已從 NVD 更新「${name.trim()}」的 CPE 對照清單（共 ${data.candidates?.length ?? 0} 筆）。`);
      setQueryName('');
      await loadEntries();
    } catch (err: any) {
      setError(err.message || 'NVD 查詢失敗');
    } finally {
      setRefreshing(false);
    }
  };

  /** Re-checks every already-saved product against NVD for newly published CPE identities and
   * updates the cache for any that changed. This is the same function the "自動排程設定 > CPE
   * 對照自動更新排程" schedule calls automatically — this button just runs it on demand. */
  const handleCheckAllForNewCpe = async () => {
    setCheckingAll(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/cpe-cache/refresh-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `檢查失敗 (HTTP ${res.status})`);
      const updatedCount = data.updatedProducts?.length ?? 0;
      const updatedNames = (data.updatedProducts || []).map((u: any) => u.productName).join('、');
      setNotice(
        updatedCount > 0
          ? `已檢查 ${data.checkedCount ?? 0} 項產品，其中 ${updatedCount} 項發現新 CPE：${updatedNames}`
          : `已檢查 ${data.checkedCount ?? 0} 項產品，皆無新增的 CPE。`
      );
      if (data.errors?.length) {
        setError(`${data.errors.length} 項產品查詢失敗：${data.errors.map((e: any) => e.productName).join('、')}`);
      }
      await loadEntries();
    } catch (err: any) {
      setError(err.message || '檢查所有產品 CPE 失敗');
    } finally {
      setCheckingAll(false);
    }
  };

  const handleDelete = async (productName: string) => {
    if (!window.confirm(`確定要刪除「${productName}」的 CPE 對照快取嗎？`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/cpe-cache/${encodeURIComponent(productName)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`刪除失敗 (HTTP ${res.status})`);
      await loadEntries();
    } catch (err: any) {
      setError(err.message || '刪除失敗');
    }
  };

  const openManualEdit = (entry?: CpeCacheEntry) => {
    setEditing(entry || { productNameKey: '', productName: '', candidates: [], updatedAt: '' });
    setEditProductName(entry?.productName || '');
    setEditCandidatesText(
      entry ? entry.candidates.map((c) => c.cpe).join('\n') : 'cpe:2.3:a:vendor:product:*:*:*:*:*:*:*:*'
    );
  };

  const closeManualEdit = () => {
    setEditing(null);
    setEditCandidatesText('');
    setEditProductName('');
  };

  const handleManualSave = async () => {
    if (!editProductName.trim()) {
      setError('請輸入產品名稱。');
      return;
    }
    const lines = editCandidatesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setError('請至少輸入一筆 CPE 內容。');
      return;
    }
    const candidates = lines.map((cpe) => {
      const parts = cpe.split(':');
      return {
        cpe,
        vendor: parts[3] || '',
        product: parts[4] || '',
        deprecated: false,
      };
    });
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/cpe-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: editProductName.trim(), candidates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `儲存失敗 (HTTP ${res.status})`);
      setNotice(`已儲存「${editProductName.trim()}」的 CPE 對照清單。`);
      closeManualEdit();
      await loadEntries();
    } catch (err: any) {
      setError(err.message || '儲存失敗');
    } finally {
      setSaving(false);
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
        <div className="flex items-center space-x-2 px-3 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Query / refresh from NVD */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
          <Search className="w-3.5 h-3.5 text-blue-600" />
          <span>從 NVD 查詢 / 更新產品的 CPE 對照</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            placeholder="輸入產品名稱，例如 vertica"
            className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 shadow-2xs"
          />
          <button
            type="button"
            disabled={refreshing || !queryName.trim()}
            onClick={() => handleRefreshFromNvd(queryName)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? '查詢中...' : '查詢並更新'}</span>
          </button>
          <button
            type="button"
            onClick={() => openManualEdit()}
            className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>手動新增</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          會呼叫 NVD CPE Dictionary API（cpeMatchString 萬用查詢），依 vendor:product 去重複後，將版本欄位改為萬用字元「*」儲存，供專案資產關聯與弱點比對流程使用。
        </p>
      </div>

      {/* Check all cached products for newly published CPEs (same function as the schedule) */}
      <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-indigo-900 uppercase flex items-center space-x-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
            <span>批次檢查已儲存產品的新 CPE</span>
          </div>
          <p className="text-[11px] text-indigo-800">
            對下方清單中「所有」已儲存的產品逐一向 NVD 重新查詢，若發現新的 CPE 對照則自動更新快取（與「自動排程設定」頁面的 CPE 自動更新排程呼叫相同邏輯）。
          </p>
        </div>
        <button
          type="button"
          disabled={checkingAll || entries.length === 0}
          onClick={handleCheckAllForNewCpe}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checkingAll ? 'animate-spin' : ''}`} />
          <span>{checkingAll ? '檢查中...' : '確認所有產品是否有新 CPE'}</span>
        </button>
      </div>

      {/* Cached entries list */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[11px]">
            <tr>
              <th className="px-4 py-2.5 text-left">產品名稱</th>
              <th className="px-4 py-2.5 text-left">CPE 對照（vendor:product，版本已萬用字元化）</th>
              <th className="px-4 py-2.5 text-left whitespace-nowrap">更新時間</th>
              <th className="px-4 py-2.5 text-right whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  載入中...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  尚無任何 CPE 對照快取，請於上方輸入產品名稱查詢。
                </td>
              </tr>
            )}
            {!loading &&
              entries.map((entry) => (
                <tr key={entry.productNameKey} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-bold text-slate-900 align-top whitespace-nowrap">{entry.productName}</td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex flex-col gap-1">
                      {entry.candidates.map((c) => (
                        <span
                          key={c.cpe}
                          className={`font-mono text-[11px] px-2 py-0.5 rounded border w-fit ${
                            c.deprecated
                              ? 'bg-slate-100 text-slate-500 border-slate-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {c.cpe}
                          {c.deprecated ? '（已棄用）' : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-top text-slate-500 whitespace-nowrap">
                    {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('zh-TW') : '-'}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRefreshFromNvd(entry.productName)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                        title="從 NVD 重新查詢並更新"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openManualEdit(entry)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                        title="手動編輯"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.productName)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                        title="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Manual add/edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editing.productNameKey ? '編輯 CPE 對照' : '手動新增 CPE 對照'}
              </h3>
              <button onClick={closeManualEdit} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">產品名稱</label>
              <input
                type="text"
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                disabled={!!editing.productNameKey}
                placeholder="例如 vertica"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 shadow-2xs disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                CPE 對照清單（每行一筆，版本請填「*」）
              </label>
              <textarea
                value={editCandidatesText}
                onChange={(e) => setEditCandidatesText(e.target.value)}
                rows={6}
                placeholder={'cpe:2.3:a:hp:vertica:*:*:*:*:*:*:*:*\ncpe:2.3:a:opentext:vertica:*:*:*:*:*:*:*:*'}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeManualEdit}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleManualSave}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? '儲存中...' : '儲存'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
