import React, { useEffect, useState } from 'react';
import { Building2, UserCheck, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface OrgEntry {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * 「組織清單管理」頁面：維護 departments / project_managers 兩張對照表，
 * 供「專案管理」的「新增專案」表單以下拉選單方式讀取所屬部門與專案經理，取代原本的自由輸入文字。
 * （部署環境不在此維護：各客戶/專案所使用的環境不同，改為於個別專案的「使用產品清單」內自行維護。）
 */
export const OrgDirectoryManager: React.FC = () => {
  const [departments, setDepartments] = useState<OrgEntry[]>([]);
  const [projectManagers, setProjectManagers] = useState<OrgEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newDeptName, setNewDeptName] = useState('');
  const [newPmName, setNewPmName] = useState('');
  const [savingDept, setSavingDept] = useState(false);
  const [savingPm, setSavingPm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/org-directory');
      if (!res.ok) throw new Error(`載入失敗 (HTTP ${res.status})`);
      const data = await res.json();
      setDepartments(data.departments || []);
      setProjectManagers(data.projectManagers || []);
    } catch (err: any) {
      setError(err.message || '載入組織清單失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    setSavingDept(true);
    setError(null);
    try {
      const res = await fetch('/api/org-directory/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `新增失敗 (HTTP ${res.status})`);
      setNotice(`已新增部門「${newDeptName.trim()}」。`);
      setNewDeptName('');
      await load();
    } catch (err: any) {
      setError(err.message || '新增部門失敗');
    } finally {
      setSavingDept(false);
    }
  };

  const handleDeleteDepartment = async (entry: OrgEntry) => {
    if (!window.confirm(`確定要刪除部門「${entry.name}」嗎？`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/org-directory/departments/${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`刪除失敗 (HTTP ${res.status})`);
      await load();
    } catch (err: any) {
      setError(err.message || '刪除部門失敗');
    }
  };

  const handleAddProjectManager = async () => {
    if (!newPmName.trim()) return;
    setSavingPm(true);
    setError(null);
    try {
      const res = await fetch('/api/org-directory/project-managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPmName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `新增失敗 (HTTP ${res.status})`);
      setNotice(`已新增專案經理「${newPmName.trim()}」。`);
      setNewPmName('');
      await load();
    } catch (err: any) {
      setError(err.message || '新增專案經理失敗');
    } finally {
      setSavingPm(false);
    }
  };

  const handleDeleteProjectManager = async (entry: OrgEntry) => {
    if (!window.confirm(`確定要刪除專案經理「${entry.name}」嗎？`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/org-directory/project-managers/${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`刪除失敗 (HTTP ${res.status})`);
      await load();
    } catch (err: any) {
      setError(err.message || '刪除專案經理失敗');
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Departments */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>所屬部門清單</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()}
                placeholder="輸入部門名稱，例如 資訊技術部門"
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              <button
                type="button"
                disabled={savingDept || !newDeptName.trim()}
                onClick={handleAddDepartment}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增</span>
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {loading && <div className="px-4 py-6 text-center text-slate-400 text-xs">載入中...</div>}
            {!loading && departments.length === 0 && (
              <div className="px-4 py-6 text-center text-slate-400 text-xs">尚無部門資料，請於上方新增。</div>
            )}
            {!loading &&
              departments.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60">
                  <span className="text-xs font-bold text-slate-900">{entry.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteDepartment(entry)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Project Managers */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>專案經理清單</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPmName}
                onChange={(e) => setNewPmName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddProjectManager()}
                placeholder="輸入專案經理姓名"
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              <button
                type="button"
                disabled={savingPm || !newPmName.trim()}
                onClick={handleAddProjectManager}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增</span>
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {loading && <div className="px-4 py-6 text-center text-slate-400 text-xs">載入中...</div>}
            {!loading && projectManagers.length === 0 && (
              <div className="px-4 py-6 text-center text-slate-400 text-xs">尚無專案經理資料，請於上方新增。</div>
            )}
            {!loading &&
              projectManagers.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60">
                  <span className="text-xs font-bold text-slate-900">{entry.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteProjectManager(entry)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
