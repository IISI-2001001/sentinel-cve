import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Sliders,
  Server,
  X,
  ExternalLink,
  Tag,
  Power,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  Edit3,
  FileText,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { MonitoredProduct } from '../types';

interface ProductManagerProps {
  products: MonitoredProduct[];
  onAddProduct: (product: Partial<MonitoredProduct>) => void;
  onUpdateProduct: (id: string, updates: Partial<MonitoredProduct>) => void;
  onDeleteProduct: (id: string) => void;
  onTriggerProductScan: (productId: string) => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onTriggerProductScan,
}) => {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MonitoredProduct | null>(null);
  const [checkingVersionId, setCheckingVersionId] = useState<string | null>(null);
  const [checkingAllVersions, setCheckingAllVersions] = useState(false);
  const [fileImportNotice, setFileImportNotice] = useState<string | null>(null);
  const [versionNotice, setVersionNotice] = useState<{ success: boolean; message: string } | null>(null);

  // Hidden File Inputs Refs
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Add Form State
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState<MonitoredProduct['category']>('Application');
  const [cpeKeyword, setCpeKeyword] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');
  const [criticality, setCriticality] = useState<MonitoredProduct['criticality']>('HIGH');
  const [scanIntervalMinutes, setScanIntervalMinutes] = useState(30);
  const [sourceType, setSourceType] = useState<MonitoredProduct['sourceType']>('auto');
  const [ecosystem, setEcosystem] = useState('');
  const [packageName, setPackageName] = useState('');
  const [purl, setPurl] = useState('');
  const [cpe, setCpe] = useState('');
  const [repository, setRepository] = useState('');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editCategory, setEditCategory] = useState<MonitoredProduct['category']>('Application');
  const [editCpeKeyword, setEditCpeKeyword] = useState('');
  const [editCurrentVersion, setEditCurrentVersion] = useState('');
  const [editLatestSecureVersion, setEditLatestSecureVersion] = useState('');
  const [editCriticality, setEditCriticality] = useState<MonitoredProduct['criticality']>('HIGH');
  const [editScanIntervalMinutes, setEditScanIntervalMinutes] = useState(30);
  const [editSourceType, setEditSourceType] = useState<MonitoredProduct['sourceType']>('auto');
  const [editEcosystem, setEditEcosystem] = useState('');
  const [editPackageName, setEditPackageName] = useState('');
  const [editPurl, setEditPurl] = useState('');
  const [editCpe, setEditCpe] = useState('');
  const [editRepository, setEditRepository] = useState('');

  useEffect(() => {
    fetch('/api/product-catalog').then((res) => res.json()).then((data) => Array.isArray(data) && setCatalog(data)).catch(() => undefined);
  }, []);

  const applyCatalogEntry = (value: string, edit = false) => {
    const normalized = value.toLowerCase().trim();
    const entry = catalog.find((item) => item.name.toLowerCase() === normalized || item.aliases?.some((alias: string) => alias.toLowerCase() === normalized));
    if (!entry) return;
    const setters = edit
      ? { name: setEditName, vendor: setEditVendor, category: setEditCategory as any, source: setEditSourceType, ecosystem: setEditEcosystem, packageName: setEditPackageName, cpe: setEditCpe, repository: setEditRepository }
      : { name: setName, vendor: setVendor, category: setCategory as any, source: setSourceType, ecosystem: setEcosystem, packageName: setPackageName, cpe: setCpe, repository: setRepository };
    setters.name(entry.name); setters.vendor(entry.vendor); setters.category(entry.category); setters.source(entry.sourceType);
    setters.ecosystem(entry.ecosystem || ''); setters.packageName(entry.packageName || ''); setters.repository(entry.repository || '');
    const version = edit ? editCurrentVersion : currentVersion;
    setters.cpe(entry.cpeTemplate?.replace('{version}', version || '*') || '');
    if (!edit) setCpeKeyword(entry.id);
    setVersionNotice(entry.note ? { success: false, message: entry.note } : null);
  };

  const categories = [
    'ALL',
    'Operating System',
    'Web Server',
    'Database',
    'Framework/Library',
    'Container/Cloud',
    'Application',
  ];

  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.cpeKeyword.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  // Handle TXT file import for CPE Keywords
  const handleCpeFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      alert('請上傳 .txt 文字檔案！');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        // Clean lines: strip comments (#), empty lines, split by comma or newlines
        const lines = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#'));

        // Extract keywords comma separated or line separated
        const parsedKeywords = lines
          .flatMap((line) => line.split(','))
          .map((k) => k.trim())
          .filter((k) => k.length > 0);

        const joinedKeywords = Array.from(new Set(parsedKeywords)).join(', ');

        if (isEditMode) {
          setEditCpeKeyword((prev) => (prev ? `${prev}, ${joinedKeywords}` : joinedKeywords));
        } else {
          setCpeKeyword((prev) => (prev ? `${prev}, ${joinedKeywords}` : joinedKeywords));
        }

        setFileImportNotice(`已成功從「${file.name}」匯入 ${parsedKeywords.length} 個 CPE 檢索關鍵字！`);
        setTimeout(() => setFileImportNotice(null), 4000);
      }
    };
    reader.readAsText(file, 'UTF-8');
    // reset input
    e.target.value = '';
  };

  const handleOpenEditModal = (prod: MonitoredProduct) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditVendor(prod.vendor || '');
    setEditCategory(prod.category || 'Application');
    setEditCpeKeyword(prod.cpeKeyword || '');
    setEditCurrentVersion(prod.currentVersion || '');
    setEditLatestSecureVersion(prod.latestSecureVersion || prod.latestVersion || '');
    setEditCriticality(prod.criticality || 'HIGH');
    setEditScanIntervalMinutes(prod.scanIntervalMinutes || 30);
    setEditSourceType(prod.sourceType || 'auto');
    setEditEcosystem(prod.ecosystem || '');
    setEditPackageName(prod.packageName || '');
    setEditPurl(prod.purl || '');
    setEditCpe(prod.cpe || '');
    setEditRepository(prod.repository || '');
  };

  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    onUpdateProduct(editingProduct.id, {
      name: editName,
      vendor: editVendor,
      category: editCategory,
      cpeKeyword: editCpeKeyword,
      currentVersion: editCurrentVersion,
      latestSecureVersion: editLatestSecureVersion,
      criticality: editCriticality,
      scanIntervalMinutes: Number(editScanIntervalMinutes),
      sourceType: editSourceType,
      ecosystem: editEcosystem,
      packageName: editPackageName,
      purl: editPurl,
      cpe: editCpe,
      repository: editRepository,
    });

    setEditingProduct(null);
  };

  const handleCheckProductVersion = async (prodId: string) => {
    setCheckingVersionId(prodId);
    try {
      const res = await fetch(`/api/products/${prodId}/check-version`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        onUpdateProduct(prodId, updated);
        setVersionNotice({ success: true, message: `已由官方來源確認最新版本 ${updated.latestVersion}。` });
      } else {
        const data = await res.json().catch(() => ({}));
        setVersionNotice({ success: false, message: data.error || `版本檢查失敗 (HTTP ${res.status})` });
      }
    } catch (err: any) {
      console.error('Failed to check product version:', err);
      setVersionNotice({ success: false, message: err?.message || '版本檢查失敗' });
    } finally {
      setCheckingVersionId(null);
    }
  };

  const handleCheckAllVersions = async () => {
    setCheckingAllVersions(true);
    try {
      const res = await fetch('/api/products/check-all-versions', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        for (const p of data.products || []) onUpdateProduct(p.id, p);
        setVersionNotice({ success: data.errors?.length === 0, message: `批次檢查完成：成功 ${data.count}、失敗 ${data.errors?.length || 0}。` });
      } else {
        const data = await res.json().catch(() => ({}));
        setVersionNotice({ success: false, message: data.error || '批次版本檢查失敗' });
      }
    } catch (err) {
      console.error('Failed to check all versions:', err);
    } finally {
      setCheckingAllVersions(false);
    }
  };

  const handleSubmitNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cpeKeyword.trim()) return;

    onAddProduct({
      name,
      vendor: vendor || 'Generic',
      category,
      cpeKeyword,
      currentVersion: currentVersion || '1.0.0',
      criticality,
      scanIntervalMinutes: Number(scanIntervalMinutes),
      hasUpdateAvailable: false,
      sourceType,
      ecosystem,
      packageName,
      purl,
      cpe,
      repository,
    });

    // Reset Form
    setName('');
    setVendor('');
    setCpeKeyword('');
    setCurrentVersion('');
    setSourceType('auto'); setEcosystem(''); setPackageName(''); setPurl(''); setCpe(''); setRepository('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {versionNotice && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-xs font-bold ${versionNotice.success ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
          {versionNotice.message}
        </div>
      )}
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>受監控科技資產與產品清單 ({products.length})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            透過產品官網、套件 Registry、OSV 與 NVD CPE 查詢版本及適用漏洞；AI 僅整理分析結果。
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleCheckAllVersions}
            disabled={checkingAllVersions}
            className="px-3.5 py-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs disabled:opacity-50"
            title="呼叫 AI 批次清查全資產最新釋出版本與安全 Fix"
          >
            <Sparkles className={`w-4 h-4 text-purple-600 ${checkingAllVersions ? 'animate-spin' : ''}`} />
            <span>{checkingAllVersions ? '全資產清查中...' : '批次檢查官方最新版本'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-blue-500/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>新增受監控產品</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋產品名稱、廠商、或 CPE 關鍵字..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat === 'ALL' ? '全部類別' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:shadow-md transition-all relative group"
          >
            {/* Top Bar */}
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-blue-700 border border-slate-200">
                    {product.category}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1.5 flex items-center space-x-2">
                    <span>{product.name}</span>
                  </h2>
                  <p className="text-xs text-slate-500">{product.vendor}</p>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      product.criticality === 'CRITICAL'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : product.criticality === 'HIGH'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {product.criticality} 重要度
                  </span>

                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEditModal(product)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-200"
                    title="編輯此產品資產設定"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Version Monitoring Box */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 font-semibold">使用中版本:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                      v{product.currentVersion || '6.5.0'}
                    </span>
                  </div>

                  {product.hasUpdateAvailable ? (
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 rounded-full flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>有最新安全版本</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>已為最新版</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">最新安全修補版:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    v{product.latestSecureVersion || product.latestVersion || '6.8.2'}
                  </span>
                </div>

                {product.updateNotes && (
                  <p className="text-[11px] text-slate-600 leading-snug bg-white p-2 rounded-lg border border-slate-200/60 font-mono">
                    💡 {product.updateNotes}
                  </p>
                )}
                {product.versionSourceUrl && (
                  <a href={product.versionSourceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-700 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    官方來源 · {product.versionConfidence || 'UNKNOWN'} · {product.versionCheckedAt ? new Date(product.versionCheckedAt).toLocaleString('zh-TW') : ''}
                  </a>
                )}
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700 flex items-center space-x-2">
                <Tag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">CPE: {product.cpeKeyword}</span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>掃描頻率: 每 {product.scanIntervalMinutes} 分鐘</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500">自動監控</span>
                  <button
                    onClick={() => onUpdateProduct(product.id, { autoScanEnabled: !product.autoScanEnabled })}
                    className={`p-1 rounded-md transition-colors ${
                      product.autoScanEnabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  onClick={() => handleCheckProductVersion(product.id)}
                  disabled={checkingVersionId === product.id}
                  className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center space-x-1.5 transition-colors border border-purple-200 disabled:opacity-50"
                    title="由產品官網或套件 Registry 檢查最新版本"
                >
                    <ExternalLink className={`w-3.5 h-3.5 text-purple-600 ${checkingVersionId === product.id ? 'animate-pulse' : ''}`} />
                    <span>{checkingVersionId === product.id ? '檢查中...' : '官方來源檢查版本'}</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEditModal(product)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center space-x-1 transition-colors border border-blue-200"
                    title="編輯資產參數"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>編輯</span>
                  </button>

                  <button
                    onClick={() => onTriggerProductScan(product.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-700 text-xs font-semibold flex items-center space-x-1 transition-colors border border-slate-200"
                    title="重新進行 CVE 漏洞資料庫掃描"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>掃描 CVE</span>
                  </button>

                  <button
                    onClick={() => onDeleteProduct(product.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="刪除資產"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal 1: Add New Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <span>新增受監控之軟體資產 / 產品</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewProduct} className="p-6 space-y-4">
              {fileImportNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{fileImportNotice}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  產品名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => { setName(e.target.value); applyCatalogEntry(e.target.value); }}
                  onBlur={(e) => applyCatalogEntry(e.target.value)}
                  list="common-product-catalog"
                  placeholder="例如: Apache HTTP Server, Nginx, SonicWall, FortiOS"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <datalist id="common-product-catalog">
                  {catalog.map((entry) => <option key={entry.id} value={entry.name} />)}
                </datalist>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                <p className="text-xs font-bold text-blue-900">官方版本與漏洞識別</p>
                <div className="grid grid-cols-2 gap-3">
                  <select value={sourceType} onChange={(e) => setSourceType(e.target.value as MonitoredProduct['sourceType'])} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <option value="auto">自動識別</option><option value="postgresql">PostgreSQL 官網</option><option value="github">GitHub Releases</option><option value="npm">npm Registry</option><option value="pypi">PyPI</option><option value="vendor">其他原廠</option>
                  </select>
                  <input value={repository} onChange={(e) => setRepository(e.target.value)} placeholder="GitHub: owner/repo" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                  <input value={ecosystem} onChange={(e) => setEcosystem(e.target.value)} placeholder="Ecosystem: npm / PyPI" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                  <input value={packageName} onChange={(e) => setPackageName(e.target.value)} placeholder="Package name" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                </div>
                <input value={purl} onChange={(e) => setPurl(e.target.value)} placeholder="PURL，例如 pkg:npm/express@4.21.2" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                <input value={cpe} onChange={(e) => setCpe(e.target.value)} placeholder="完整 CPE，例如 cpe:2.3:a:postgresql:postgresql:16.1:*:*:*:*:*:*:*" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    發行廠商
                  </label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="例如: Apache, F5"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    目前使用版號 (Current Version)
                  </label>
                  <input
                    type="text"
                    value={currentVersion}
                    onChange={(e) => setCurrentVersion(e.target.value)}
                    placeholder="例如: 1.24.0, 6.5.0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    資產類別
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Operating System">Operating System</option>
                    <option value="Web Server">Web Server</option>
                    <option value="Database">Database</option>
                    <option value="Framework/Library">Framework/Library</option>
                    <option value="Container/Cloud">Container/Cloud</option>
                    <option value="Application">Application</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    關鍵重要程度
                  </label>
                  <select
                    value={criticality}
                    onChange={(e) => setCriticality(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CRITICAL">CRITICAL (極重要/核心)</option>
                    <option value="HIGH">HIGH (重要)</option>
                    <option value="MEDIUM">MEDIUM (一般)</option>
                    <option value="LOW">LOW (次要)</option>
                  </select>
                </div>
              </div>

              {/* CPE Keywords + TXT File Upload Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    CPE 檢索關鍵字 *
                  </label>
                  <button
                    type="button"
                    onClick={() => addFileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center space-x-1 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                    <span>📄 上傳 .txt 檔批次匯入 CPE</span>
                  </button>
                  <input
                    type="file"
                    ref={addFileInputRef}
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={(e) => handleCpeFileUpload(e, false)}
                  />
                </div>

                <textarea
                  required
                  rows={3}
                  value={cpeKeyword}
                  onChange={(e) => setCpeKeyword(e.target.value)}
                  placeholder="例如: nginx, openssl, linux_kernel, postgresql (支援逗號或換行分隔多個 CPE)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 若關鍵字過多，可直接點擊右上方「上傳 .txt 檔」匯入文字文字檔 (內容可為每行一個 CPE 或以逗號分隔)。
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                >
                  確認新增
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Product */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <span>編輯資產產品設定 — {editingProduct.name}</span>
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProduct} className="p-6 space-y-4">
              {fileImportNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{fileImportNotice}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  產品名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); applyCatalogEntry(e.target.value, true); }}
                  onBlur={(e) => applyCatalogEntry(e.target.value, true)}
                  list="common-product-catalog"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                <p className="text-xs font-bold text-blue-900">官方版本與漏洞識別</p>
                <div className="grid grid-cols-2 gap-3">
                  <select value={editSourceType} onChange={(e) => setEditSourceType(e.target.value as MonitoredProduct['sourceType'])} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <option value="auto">自動識別</option><option value="postgresql">PostgreSQL 官網</option><option value="github">GitHub Releases</option><option value="npm">npm Registry</option><option value="pypi">PyPI</option><option value="vendor">其他原廠</option>
                  </select>
                  <input value={editRepository} onChange={(e) => setEditRepository(e.target.value)} placeholder="GitHub: owner/repo" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                  <input value={editEcosystem} onChange={(e) => setEditEcosystem(e.target.value)} placeholder="Ecosystem: npm / PyPI" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                  <input value={editPackageName} onChange={(e) => setEditPackageName(e.target.value)} placeholder="Package name" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                </div>
                <input value={editPurl} onChange={(e) => setEditPurl(e.target.value)} placeholder="PURL" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
                <input value={editCpe} onChange={(e) => setEditCpe(e.target.value)} placeholder="完整 CPE" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    發行廠商
                  </label>
                  <input
                    type="text"
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    資產類別
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Operating System">Operating System</option>
                    <option value="Web Server">Web Server</option>
                    <option value="Database">Database</option>
                    <option value="Framework/Library">Framework/Library</option>
                    <option value="Container/Cloud">Container/Cloud</option>
                    <option value="Application">Application</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    使用中版號 (Current)
                  </label>
                  <input
                    type="text"
                    value={editCurrentVersion}
                    onChange={(e) => setEditCurrentVersion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    最新安全修補版號
                  </label>
                  <input
                    type="text"
                    value={editLatestSecureVersion}
                    onChange={(e) => setEditLatestSecureVersion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    關鍵重要程度
                  </label>
                  <select
                    value={editCriticality}
                    onChange={(e) => setEditCriticality(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CRITICAL">CRITICAL (極重要/核心)</option>
                    <option value="HIGH">HIGH (重要)</option>
                    <option value="MEDIUM">MEDIUM (一般)</option>
                    <option value="LOW">LOW (次要)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    自動掃描頻率 (分鐘)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={editScanIntervalMinutes}
                    onChange={(e) => setEditScanIntervalMinutes(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* CPE Keywords + TXT File Upload Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    CPE 檢索關鍵字 *
                  </label>
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center space-x-1 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                    <span>📄 上傳 .txt 檔匯入 CPE</span>
                  </button>
                  <input
                    type="file"
                    ref={editFileInputRef}
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={(e) => handleCpeFileUpload(e, true)}
                  />
                </div>

                <textarea
                  required
                  rows={3}
                  value={editCpeKeyword}
                  onChange={(e) => setEditCpeKeyword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 若有大量 CPE 關鍵字，點擊右上角按鈕上傳 .txt 文字檔即可快速整批導入。
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                >
                  儲存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
