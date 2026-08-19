import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  UserCheck,
  ShieldAlert,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Send,
  Sliders,
  X,
  Search,
  Building2,
  Zap,
  Clock,
  ExternalLink,
  ChevronRight,
  Server,
  Lock,
  Sparkles,
  FileText,
  Bot,
  RefreshCw,
  Filter,
  Bell,
  MessageSquare,
  ArrowLeft,
  Check,
  Layers,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Hash,
  Tag,
  CheckSquare,
  User,
} from 'lucide-react';
import { Project, MonitoredProduct, EmailNotificationConfig, Ticket, TicketStatus, TicketPriority, TicketCveInfo, ActionStep, ProjectProductBinding, CVEItem } from '../types';
import { TicketDetailModal } from './TicketDetailModal';

interface ProjectManagerProps {
  projects: Project[];
  products: MonitoredProduct[];
  emailConfig: EmailNotificationConfig;
  cves?: CVEItem[];
  onRefreshData: () => void;
  onSelectCve?: (cveId: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  products,
  emailConfig,
  cves: propsCves,
  onRefreshData,
  onSelectCve,
}) => {
  // Navigation level state: null = Level 1 (Summary List), Project = Level 2 (Project Detail & Settings)
  const [activeProjectDetail, setActiveProjectDetail] = useState<Project | null>(null);
  const [activeDetailSubTab, setActiveDetailSubTab] = useState<
    'general' | 'notifications' | 'products' | 'version-matrix' | 'vulnerabilities' | 'tickets'
  >('general');

  // CVE List State
  const [allCves, setAllCves] = useState<CVEItem[]>(propsCves || []);

  useEffect(() => {
    if (propsCves && propsCves.length > 0) {
      setAllCves(propsCves);
    } else {
      fetch('/api/cves')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setAllCves(data);
        })
        .catch((err) => console.warn('Failed to fetch CVEs:', err));
    }
  }, [propsCves]);

  // Vulnerability Tab Search & Filter States
  const [vulnSearchTerm, setVulnSearchTerm] = useState('');
  const [vulnSeverityFilter, setVulnSeverityFilter] = useState<
    'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CISA_KEV'
  >('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Ticket States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [generatingTicketPrjId, setGeneratingTicketPrjId] = useState<string | null>(null);
  const [ticketFilterStatus, setTicketFilterStatus] = useState<string>('ALL');
  const [manualNotifyKind, setManualNotifyKind] = useState<'VERSION' | 'CVE' | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [resolvingTicket, setResolvingTicket] = useState<Ticket | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');

  // Waive Ticket Modal State
  const [waivingTicket, setWaivingTicket] = useState<Ticket | null>(null);
  const [waiveReasonInput, setWaiveReasonInput] = useState('');
  const [waivedByInput, setWaivedByInput] = useState('');

  // Ignored Product Upgrade IDs & Ignored CVE IDs state per project
  const [ignoredProductIds, setIgnoredProductIds] = useState<string[]>([]);
  const [ignoredCveIds, setIgnoredCveIds] = useState<string[]>([]);

  // Assign Ticket Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{
    type: 'PRODUCT' | 'CVE';
    product?: MonitoredProduct;
    currentVer?: string;
    recommendedVer?: string;
    cve?: CVEItem;
  } | null>(null);

  const [assigneeName, setAssigneeName] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [assigneeType, setAssigneeType] = useState<'OWNER' | 'CUSTOM'>('OWNER');
  const [assignSlaHours, setAssignSlaHours] = useState<number>(72);
  const [assignPriority, setAssignPriority] = useState<TicketPriority>('HIGH');
  const [assignCustomTitle, setAssignCustomTitle] = useState('');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);

  const toggleIgnoreProduct = (productId: string) => {
    setIgnoredProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const toggleIgnoreCve = (cveId: string) => {
    setIgnoredCveIds((prev) =>
      prev.includes(cveId) ? prev.filter((id) => id !== cveId) : [...prev, cveId]
    );
  };

  const openAssignProductModal = (product: MonitoredProduct, currentVer: string, recommendedVer: string) => {
    if (!activeProjectDetail) return;
    setAssignTarget({
      type: 'PRODUCT',
      product,
      currentVer,
      recommendedVer,
    });
    setAssigneeType('OWNER');
    setAssigneeName(activeProjectDetail.ownerName || '專案負責人');
    setAssigneeEmail('');
    setAssignPriority(product.detectedCveCount > 0 ? 'HIGH' : 'MEDIUM');
    setAssignSlaHours(72);
    setAssignCustomTitle(`[套件升級] ${product.name} 版本升級 (${currentVer} ➜ ${recommendedVer})`);
    setAssignModalOpen(true);
  };

  const openAssignCveModal = (cve: CVEItem) => {
    if (!activeProjectDetail) return;
    const severity = cve.cvss?.severity || 'HIGH';
    let defaultSla = 72;
    if (severity === 'CRITICAL') defaultSla = 24;
    else if (severity === 'HIGH') defaultSla = 72;
    else if (severity === 'MEDIUM') defaultSla = 168;
    else defaultSla = 360;

    setAssignTarget({
      type: 'CVE',
      cve,
    });
    setAssigneeType('OWNER');
    setAssigneeName(activeProjectDetail.ownerName || '專案負責人');
    setAssigneeEmail('');
    setAssignPriority(severity);
    setAssignSlaHours(defaultSla);
    setAssignCustomTitle(`[CVE 弱點處置] ${cve.id} - ${cve.productName} 漏洞修補`);
    setAssignModalOpen(true);
  };

  const handleConfirmAssignTicket = async () => {
    if (!activeProjectDetail || !assignTarget) return;
    setIsCreatingTicket(true);
    try {
      let affectedProducts: string[] = [];
      let cveCount = 1;
      let cveList: TicketCveInfo[] = [];
      let executiveSummary = '';
      let rootCauseAnalysis = '';
      let actionSteps: ActionStep[] = [];
      let mitigationPlan = '';
      let verificationMethod = '';

      if (assignTarget.type === 'PRODUCT' && assignTarget.product) {
        const p = assignTarget.product;
        affectedProducts = [p.name];
        cveCount = p.detectedCveCount || 1;
        executiveSummary = `專案【${activeProjectDetail.name}】套件「${p.name}」升級修補工單。建議將當前套用版本 (${assignTarget.currentVer}) 升級至安全版本 (${assignTarget.recommendedVer})，防範相關系統安全威脅。`;
        rootCauseAnalysis = `套件 ${p.name} 目前版本 (${assignTarget.currentVer}) 存在已知風險，建議執行版號升級以確保系統符合合規安全要求。`;
        actionSteps = [
          {
            stepNumber: 1,
            title: '環境備份與升級測試',
            detail: `於 Staging/Testing 環境預先測試 ${p.name} 由 ${assignTarget.currentVer} 升級至 ${assignTarget.recommendedVer} 之相容性。`,
            commandSnippet: `# 範例升級檢驗命令\ncheck-dependency-upgrade --package=${p.name} --target=${assignTarget.recommendedVer}`,
          },
          {
            stepNumber: 2,
            title: '生產環境版號套用',
            detail: `更新專案設定與部署檔案，將套件部署為 ${assignTarget.recommendedVer}。`,
          },
          {
            stepNumber: 3,
            title: '自動化 CVE 複測與狀態確認',
            detail: '觸發 SentinelCVE 重新掃描，確認升級後相關漏洞已解決並結案。',
          },
        ];
        mitigationPlan = `更新套件 ${p.name} 至版號 ${assignTarget.recommendedVer}，並配合存取控制原則減少攻擊面。`;
        verificationMethod = '重新執行 SentinelCVE 資產弱點掃描驗證。';
      } else if (assignTarget.type === 'CVE' && assignTarget.cve) {
        const cve = assignTarget.cve;
        affectedProducts = [cve.productName];
        cveCount = 1;
        cveList = [
          {
            cveId: cve.id,
            title: cve.title || cve.description.slice(0, 80),
            cvss: cve.cvss?.baseScore || 0,
            severity: cve.cvss?.severity || 'HIGH',
            cisaKev: Boolean(cve.cisaKev),
            productName: cve.productName,
          },
        ];
        executiveSummary = `專案【${activeProjectDetail.name}】資產 [${cve.productName}] 存在安全性漏洞 [${cve.id}] (CVSS ${cve.cvss?.baseScore || 0})，需指派專人執行安全處置。`;
        rootCauseAnalysis = cve.description || `受影響元件 ${cve.productName} 存在已知 CVE 弱點，可能遭受攻擊者未授權利用。`;

        if (cve.aiAnalysis?.mitigationSteps && cve.aiAnalysis.mitigationSteps.length > 0) {
          actionSteps = cve.aiAnalysis.mitigationSteps.map((step, idx) => ({
            stepNumber: idx + 1,
            title: `修補步驟 ${idx + 1}`,
            detail: step,
          }));
        } else {
          actionSteps = [
            {
              stepNumber: 1,
              title: '受影響套件版本清查與隔離',
              detail: `確認專案中 ${cve.productName} 之部署範圍與漏洞影響層面。`,
            },
            {
              stepNumber: 2,
              title: '套用官方修補檔或升級版本',
              detail: `依官方資安通報將 ${cve.productName} 更新至免受 ${cve.id} 影響之安全版本。`,
            },
            {
              stepNumber: 3,
              title: '執行資安複測與防衛驗證',
              detail: '重新掃描該資產並檢查系統 Log 異常紀錄。',
            },
          ];
        }

        mitigationPlan = cve.aiAnalysis?.workaround || `套用 ${cve.id} 官方安全修補檔，並於 WAF/網關層設定防禦規則。`;
        verificationMethod = '執行 SentinelCVE CVE 自動掃描複測與 Log 檢核。';
      }

      const newTicketPayload = {
        projectId: activeProjectDetail.id,
        projectCode: activeProjectDetail.code,
        projectName: activeProjectDetail.name,
        department: activeProjectDetail.department,
        title: assignCustomTitle,
        priority: assignPriority,
        status: 'OPEN',
        assigneeName: assigneeName || activeProjectDetail.ownerName,
        assigneeEmail: assigneeEmail,
        affectedProducts,
        cveCount,
        cveList,
        slaHours: assignSlaHours,
        executiveSummary,
        rootCauseAnalysis,
        actionSteps,
        mitigationPlan,
        verificationMethod,
      };

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicketPayload),
      });

      if (res.ok) {
        const createdTicket = await res.json();
        setTickets((prev) => [createdTicket, ...prev]);
        setAssignModalOpen(false);
        setSelectedTicket(createdTicket);
      } else {
        const err = await res.json();
        alert(`派發工單失敗: ${err.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error('Failed to assign ticket:', err);
      alert('派發工單時發生網路錯誤');
    } finally {
      setIsCreatingTicket(false);
    }
  };

  // Fetch Tickets on Load
  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.warn('Failed to fetch tickets:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Sync active project with最新 props
  useEffect(() => {
    if (activeProjectDetail) {
      const current = projects.find((p) => p.id === activeProjectDetail.id);
      if (current) {
        setActiveProjectDetail(current);
      }
    }
  }, [projects]);

  const handleGenerateProjectTicket = async (prj: Project) => {
    setGeneratingTicketPrjId(prj.id);
    try {
      const res = await fetch(`/api/projects/${prj.id}/generate-ticket`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setTickets((prev) => [data, ...prev.filter((t) => t.id !== data.id)]);
        setSelectedTicket(data); // Open modal immediately
      } else {
        alert(`工單產出失敗: ${data.error || '無法連線至 AI 引擎'}`);
      }
    } catch (err) {
      console.error('Failed to generate ticket:', err);
      alert('產出專案工單時發生網路錯誤');
    } finally {
      setGeneratingTicketPrjId(null);
    }
  };

  const handleUpdateTicketStatus = async (
    ticketId: string,
    newStatus: TicketStatus,
    extraFields?: Partial<Ticket>
  ) => {
    try {
      if (newStatus === 'RESOLVED' && !extraFields?.resolutionNote?.trim()) {
        const ticket = tickets.find((item) => item.id === ticketId) || selectedTicket;
        if (ticket) {
          setResolvingTicket(ticket);
          setResolutionNoteInput(ticket.resolutionNote || '');
        }
        return;
      }
      const targetTicket = tickets.find((t) => t.id === ticketId);
      const prevStatus = targetTicket ? targetTicket.status : 'OPEN';

      const updatePayload = {
        status: newStatus,
        ...extraFields,
      };

      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (res.ok) {
        const updated = await res.json();
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket(updated);
        }
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.error || '工單更新失敗');
      }
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const submitResolveTicket = async () => {
    if (!resolvingTicket) return;
    if (!resolutionNoteInput.trim()) {
      alert('請填寫處理說明後再確認已解決。');
      return;
    }
    const ticket = resolvingTicket;
    await handleUpdateTicketStatus(ticket.id, 'RESOLVED', {
      resolutionNote: resolutionNoteInput.trim(),
      resolvedAt: new Date().toISOString(),
    });
    setResolvingTicket(null);
    setResolutionNoteInput('');
  };

  const handleSaveTicket = async () => {
    if (!editingTicket || !editingTicket.title.trim() || !editingTicket.assigneeName.trim()) {
      alert('工單標題與負責人為必填欄位。');
      return;
    }
    const res = await fetch(`/api/tickets/${editingTicket.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingTicket),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || '儲存工單失敗');
    setTickets((prev) => prev.map((ticket) => ticket.id === data.id ? data : ticket));
    if (selectedTicket?.id === data.id) setSelectedTicket(data);
    setEditingTicket(null);
  };

  const handleDeleteTicket = async (ticket: Ticket) => {
    if (!window.confirm(`確定刪除工單 ${ticket.ticketNo}？此操作無法復原。`)) return;
    const res = await fetch(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
    if (!res.ok) return alert('刪除工單失敗');
    setTickets((prev) => prev.filter((item) => item.id !== ticket.id));
    if (selectedTicket?.id === ticket.id) setSelectedTicket(null);
  };

  const submitWaiveTicket = async () => {
    if (!waivingTicket) return;
    if (!waiveReasonInput.trim()) {
      alert('請填寫資安豁免申請原因！');
      return;
    }

    await handleUpdateTicketStatus(waivingTicket.id, 'WAIVED', {
      waiveReason: waiveReasonInput,
      waivedBy: waivedByInput || '資安長/預防應變小組',
      waivedAt: new Date().toISOString(),
    });

    setWaivingTicket(null);
    setWaiveReasonInput('');
    setWaivedByInput('');
  };

  const handleSendTicketEmail = async (ticketId: string, recipientEmail?: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail }),
    });
    if (!res.ok) {
      throw new Error('Failed to send email');
    }
  };

  // Modal & Edit Form States
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);

  // Form State for Create/Edit Project
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formOwnerEmail, setFormOwnerEmail] = useState('');
  const [formSecondary, setFormSecondary] = useState('');
  const [formSelectedProducts, setFormSelectedProducts] = useState<string[]>([]);
  const [formNotifyEmail, setFormNotifyEmail] = useState(true);
  const [formNotifyMinCvss, setFormNotifyMinCvss] = useState(7.0);
  const [formNotifyCisaKevOnly, setFormNotifyCisaKevOnly] = useState(false);
  const [formNotifyFrequency, setFormNotifyFrequency] = useState<
    'REALTIME' | 'EVERY_15_MIN' | 'HOURLY' | 'DAILY' | 'WEEKLY'
  >('REALTIME');
  const [formTeamsWebhookUrl, setFormTeamsWebhookUrl] = useState('');
  const [formHandlerName, setFormHandlerName] = useState('');
  const [formHandlerTeamsWebhookUrl, setFormHandlerTeamsWebhookUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product Binding Form State (For level 2 detail page)
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [bindProductId, setBindProductId] = useState('');
  const [bindTargetVersion, setBindTargetVersion] = useState('');
  const [bindEnvironment, setBindEnvironment] = useState<'Production' | 'Staging' | 'Testing' | 'Development'>('Production');
  const [bindCustomNotes, setBindCustomNotes] = useState('');

  // Email Config Form State
  const [smtpServer, setSmtpServer] = useState(emailConfig.smtpServer || '');
  const [smtpPort, setSmtpPort] = useState(emailConfig.smtpPort || 587);
  const [senderName, setSenderName] = useState(emailConfig.senderName || '');
  const [senderEmail, setSenderEmail] = useState(emailConfig.senderEmail || '');
  const [smtpUser, setSmtpUser] = useState(emailConfig.username || '');
  const [smtpPass, setSmtpPass] = useState(emailConfig.password || '');
  const [defaultRecipients, setDefaultRecipients] = useState(emailConfig.defaultRecipients?.join(', ') || '');
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);

  // Test Dispatches
  const [testingProjectId, setTestingProjectId] = useState<string | null>(null);
  const [testingTeamsPrjId, setTestingTeamsPrjId] = useState<string | null>(null);
  const [dispatchResult, setDispatchResult] = useState<{
    success: boolean;
    recipient: string;
    message: string;
  } | null>(null);

  // Email Test State
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<string | null>(null);

  // Filtered Departments
  const departments = Array.from(new Set(projects.map((p) => p.department || '未分類')));

  // Filtered Projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || p.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const openCreateModal = () => {
    setEditingProject(null);
    setFormCode(`PRJ-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormDescription('');
    setFormDepartment('數位金融事業群');
    setFormOwnerName('');
    setFormOwnerEmail('');
    setFormSecondary('');
    setFormSelectedProducts(products.slice(0, 2).map((p) => p.id));
    setFormNotifyEmail(true);
    setFormNotifyMinCvss(7.0);
    setFormNotifyCisaKevOnly(false);
    setFormNotifyFrequency('REALTIME');
    setFormTeamsWebhookUrl('');
    setFormHandlerName('');
    setFormHandlerTeamsWebhookUrl('');
    setIsCreating(true);
  };

  const openEditModal = (prj: Project) => {
    setEditingProject(prj);
    setFormCode(prj.code);
    setFormName(prj.name);
    setFormDescription(prj.description || '');
    setFormDepartment(prj.department || '內部事業群');
    setFormOwnerName(prj.ownerName);
    setFormOwnerEmail('');
    setFormSecondary('');
    setFormSelectedProducts(prj.productIds || []);
    setFormNotifyEmail(prj.notifyEmail);
    setFormNotifyMinCvss(prj.notifyMinCvss || 7.0);
    setFormNotifyCisaKevOnly(prj.notifyCisaKevOnly || false);
    setFormNotifyFrequency(prj.notifyFrequency || 'REALTIME');
    setFormTeamsWebhookUrl(prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl || '');
    setFormHandlerName(prj.handlerName || '');
    setFormHandlerTeamsWebhookUrl(prj.handlerTeamsWebhookUrl || '');
    setIsCreating(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('請填寫專案名稱！');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      code: formCode,
      name: formName,
      description: formDescription,
      department: formDepartment,
      ownerName: formOwnerName || '未指定負責人',
      ownerEmail: '',
      secondaryContacts: [],
      productIds: formSelectedProducts,
      notifyEmail: formNotifyEmail,
      notifyMinCvss: formNotifyMinCvss,
      notifyCisaKevOnly: formNotifyCisaKevOnly,
      notifyFrequency: formNotifyFrequency,
      teamsWebhookUrl: formTeamsWebhookUrl,
      ownerTeamsWebhookUrl: formTeamsWebhookUrl,
      handlerName: formHandlerName,
      handlerTeamsWebhookUrl: formHandlerTeamsWebhookUrl,
    };

    try {
      if (editingProject) {
        const res = await fetch(`/api/projects/${editingProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          if (activeProjectDetail?.id === updated.id) {
            setActiveProjectDetail(updated);
          }
        }
      } else {
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setIsCreating(false);
      setEditingProject(null);
      onRefreshData();
    } catch (err) {
      console.error('Failed to save project:', err);
      alert('儲存專案資訊時發生錯誤。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`確定要刪除專案【${name}】嗎？此操作無法復原。`)) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeProjectDetail?.id === id) {
          setActiveProjectDetail(null);
        }
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  // Add / Update Product Version Binding in Level 2 Detail Page
  const handleAddProductBinding = async () => {
    if (!activeProjectDetail) return;
    if (!bindProductId) {
      alert('請選擇要套用的產品！');
      return;
    }

    const prodObj = products.find((p) => p.id === bindProductId);
    if (!prodObj) return;

    const existingBindings = activeProjectDetail.productBindings || [];
    const newBinding: ProjectProductBinding = {
      productId: prodObj.id,
      productName: prodObj.name,
      vendor: prodObj.vendor,
      cpeKeyword: prodObj.cpeKeyword,
      targetVersion: bindTargetVersion || prodObj.currentVersion || '1.0.0',
      environment: bindEnvironment,
      customNotes: bindCustomNotes,
      boundAt: new Date().toISOString(),
    };

    const updatedProductIds = Array.from(new Set([...activeProjectDetail.productIds, prodObj.id]));
    const updatedBindings = [
      ...existingBindings.filter((b) => b.productId !== prodObj.id),
      newBinding,
    ];

    try {
      const res = await fetch(`/api/projects/${activeProjectDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: updatedProductIds,
          productBindings: updatedBindings,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setActiveProjectDetail(updated);
        setBindingModalOpen(false);
        setBindProductId('');
        setBindTargetVersion('');
        setBindCustomNotes('');
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to add product binding:', err);
      alert('新增套用產品失敗');
    }
  };

  const handleRemoveProductBinding = async (productId: string) => {
    if (!activeProjectDetail) return;
    if (!confirm('確定要自此專案解除該產品及版本的套用設定嗎？')) return;

    const updatedProductIds = activeProjectDetail.productIds.filter((id) => id !== productId);
    const updatedBindings = (activeProjectDetail.productBindings || []).filter(
      (b) => b.productId !== productId
    );

    try {
      const res = await fetch(`/api/projects/${activeProjectDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: updatedProductIds,
          productBindings: updatedBindings,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setActiveProjectDetail(updated);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to remove product binding:', err);
    }
  };

  const handleTestEmailDispatch = async (prj: Project) => {
    setTestingProjectId(prj.id);
    setDispatchResult(null);
    try {
      const res = await fetch(`/api/projects/${prj.id}/notify-test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchResult({
          success: true,
          recipient: `${prj.ownerName} <${prj.ownerEmail}>`,
          message: data.message || `測試 Email 已派送給 ${prj.ownerName}`,
        });
      } else {
        setDispatchResult({
          success: false,
          recipient: prj.ownerEmail,
          message: data.error || '測試郵件派送失敗，請檢查 Email 設定。',
        });
      }
    } catch (err: any) {
      setDispatchResult({
        success: false,
        recipient: prj.ownerEmail,
        message: err?.message || '無法連線至郵件派送伺服器',
      });
    } finally {
      setTestingProjectId(null);
    }
  };

  const handleTestTeamsDispatch = async (prj: Project, webhookType: 'owner' | 'handler' = 'owner') => {
    const webhookUrl = webhookType === 'handler' ? (prj.handlerTeamsWebhookUrl || formHandlerTeamsWebhookUrl) : (prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl || formTeamsWebhookUrl);
    if (!webhookUrl) {
      alert('請先填寫專案的 Teams Webhook URL');
      return;
    }
    setTestingTeamsPrjId(prj.id);
    setDispatchResult(null);
    try {
      const res = await fetch(`/api/projects/${prj.id}/notify-teams-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, webhookType }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchResult({
          success: true,
          recipient: 'Teams Webhook 頻道',
          message: data.message || `測試通報已成功推送至【${prj.name}】Teams 頻道`,
        });
      } else {
        setDispatchResult({
          success: false,
          recipient: 'Teams Webhook 頻道',
          message: data.error || 'Teams 測試推送失敗，請檢查 Webhook URL 是否正確',
        });
      }
    } catch (err: any) {
      setDispatchResult({
        success: false,
        recipient: 'Teams Webhook 頻道',
        message: err?.message || '無法連線至 Teams Webhook 伺服器',
      });
    } finally {
      setTestingTeamsPrjId(null);
    }
  };

  const handleManualProjectNotify = async (prj: Project, kind: 'VERSION' | 'CVE') => {
    setManualNotifyKind(kind);
    try {
      const endpoint = kind === 'VERSION' ? 'notify-version-now' : 'notify-cve-now';
      const res = await fetch(`/api/projects/${prj.id}/${endpoint}`, { method: 'POST' });
      const data = await res.json();
      alert(data.message || data.error || (res.ok ? 'Teams 通知已送出。' : 'Teams 通知發送失敗。'));
    } catch (err: any) { alert(err?.message || '無法連線至通知服務。'); }
    finally { setManualNotifyKind(null); }
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailConfig(true);
    const recipientsArray = defaultRecipients
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const payload: Partial<EmailNotificationConfig> = {
      smtpServer,
      smtpPort: Number(smtpPort),
      senderName,
      senderEmail,
      username: smtpUser,
      password: smtpPass,
      defaultRecipients: recipientsArray,
    };

    try {
      const res = await fetch('/api/email/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowEmailConfigModal(false);
        onRefreshData();
      }
    } catch (err) {
      console.error('Failed to save email config:', err);
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail: senderEmail || 'security-lead@company.com',
          recipientName: senderName || '資安長',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSmtpTestResult(`✅ SMTP 測試成功！通報訊息已派送至 ${data.sentTo}`);
      } else {
        setSmtpTestResult(`❌ 測試失敗: ${data.error || '伺服器拒絕連線'}`);
      }
    } catch (err: any) {
      setSmtpTestResult(`❌ 連線錯誤: ${err?.message || '網路異常'}`);
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Helper for status badge
  const getFrequencyLabel = (freq?: string) => {
    switch (freq) {
      case 'EVERY_15_MIN':
        return { label: '⏱️ 每 15 分鐘彙整', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'HOURLY':
        return { label: '🕐 每小時摘要', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'DAILY':
        return { label: '📅 每日總結日報', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'WEEKLY':
        return { label: '📆 每週安全週報', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'REALTIME':
      default:
        return { label: '⚡ 即時觸發 (當下發送)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  const getTicketStatusMeta = (status: TicketStatus) => ({
    OPEN: { label: '已派單／待處理', className: 'bg-amber-50 text-amber-800 border-amber-300' },
    IN_PROGRESS: { label: '處理中', className: 'bg-blue-50 text-blue-800 border-blue-300' },
    RESOLVED: { label: '已解決', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
    CLOSED: { label: '已結案', className: 'bg-slate-100 text-slate-700 border-slate-300' },
    WAIVED: { label: '已豁免', className: 'bg-purple-50 text-purple-800 border-purple-300' },
  }[status]);

  // =========================================================================
  // RENDER LEVEL 2: PROJECT DETAIL & SETTINGS PAGE
  // =========================================================================
  if (activeProjectDetail) {
    const prj = activeProjectDetail;
    const prjProducts = products.filter((p) => prj.productIds?.includes(p.id));
    const prjTickets = tickets.filter((t) => t.projectId === prj.id);
    const activeTicketsCount = prjTickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
    const resolvedTicketsCount = prjTickets.filter((t) => t.status === 'RESOLVED').length;
    const closedTicketsCount = prjTickets.filter((t) => t.status === 'CLOSED').length;
    const waivedTicketsCount = prjTickets.filter((t) => t.status === 'WAIVED').length;

    const effectiveCves = propsCves && propsCves.length > 0 ? propsCves : allCves;
    const prjCves = effectiveCves.filter((cve) => {
      const cveProdName = (cve.productName || '').toLowerCase();
      const cveVendor = (cve.vendorName || '').toLowerCase();

      return prjProducts.some((p) => {
        const pName = p.name.toLowerCase();
        const pVendor = (p.vendor || '').toLowerCase();
        const pCpe = p.cpeKeyword ? p.cpeKeyword.toLowerCase() : '';

        return (
          cveProdName.includes(pName) ||
          pName.includes(cveProdName) ||
          (pCpe && cve.cpe?.some((c) => c.toLowerCase().includes(pCpe))) ||
          (pVendor && cveVendor.includes(pVendor) && cveProdName.includes(pName))
        );
      });
    });
    const maxProjectCvss = prjCves.reduce((max, cve) => Math.max(max, Number(cve.cvss?.baseScore) || 0), 0);

    const filteredPrjCves = prjCves.filter((cve) => {
      const q = vulnSearchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        cve.id.toLowerCase().includes(q) ||
        (cve.title && cve.title.toLowerCase().includes(q)) ||
        (cve.description && cve.description.toLowerCase().includes(q)) ||
        (cve.productName && cve.productName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (vulnSeverityFilter === 'ALL') return true;
      if (vulnSeverityFilter === 'CISA_KEV') return cve.cisaKev;
      return cve.cvss?.severity === vulnSeverityFilter;
    });
    const closedVersionProducts = prjProducts.filter((product) => prjTickets.some((ticket) =>
      ticket.status === 'CLOSED' &&
      (!ticket.cveList || ticket.cveList.length === 0) &&
      ticket.affectedProducts.some((name) => name.toLowerCase() === product.name.toLowerCase())
    ));
    const activeVersionProducts = prjProducts.filter((product) => !closedVersionProducts.some((closed) => closed.id === product.id));
    const closedCves = filteredPrjCves.filter((cve) => prjTickets.some((ticket) => ticket.status === 'CLOSED' && ticket.cveList?.some((item) => item.cveId === cve.id)));
    const activeFilteredPrjCves = filteredPrjCves.filter((cve) => !closedCves.some((closed) => closed.id === cve.id));

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Level 2 Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <button
                onClick={() => setActiveProjectDetail(null)}
                className="hover:text-blue-600 font-bold flex items-center space-x-1 text-slate-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回專案清單</span>
              </button>
              <span>/</span>
              <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold border border-blue-200">
                {prj.code}
              </span>
              <span>/</span>
              <span className="font-semibold text-slate-900">{prj.name}</span>
            </div>

            <h1 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2 pt-1">
              <FolderKanban className="w-6 h-6 text-blue-600" />
              <span>{prj.name} (專案詳細資訊與個別設定)</span>
            </h1>
          </div>
        </div>

        {/* Dispatch Result Toast */}
        {dispatchResult && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
              dispatchResult.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 shrink-0" />
              <span>
                【{dispatchResult.recipient}】: {dispatchResult.message}
              </span>
            </div>
            <button onClick={() => setDispatchResult(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Project KPI & Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>綁定監控產品</span>
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">{prjProducts.length} 個套件資產</div>
            <p className="text-[11px] text-slate-400 mt-0.5">具備特定版號套用記錄</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>待處置工單 (OPEN)</span>
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-amber-600">{activeTicketsCount} 件待解決</div>
            <p className="text-[11px] text-slate-400 mt-0.5">需於 SLA 期限內矯正</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>資安豁免狀態 (WAIVED)</span>
              <CheckSquare className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-extrabold text-purple-700">{waivedTicketsCount} 件特許豁免</div>
            <p className="text-[11px] text-slate-400 mt-0.5">含補償控制與核准紀錄</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>通知管道與頻率</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xs font-bold text-emerald-700 truncate pt-1">
              版本 {getFrequencyLabel(prj.versionNotifyFrequency || 'DAILY').label} / CVE {getFrequencyLabel(prj.cveNotifyFrequency || prj.notifyFrequency).label}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {(prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl) ? '負責人 Teams 已設定' : '負責人 Teams 未設定'} / {prj.handlerTeamsWebhookUrl ? '處理人 Teams 已設定' : '處理人 Teams 未設定'}
            </p>
          </div>
        </div>

        {/* Level 2 Sub-Tabs Navigation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex items-center space-x-1 overflow-x-auto no-scrollbar shadow-2xs">
          <button
            onClick={() => setActiveDetailSubTab('general')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeDetailSubTab === 'general'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>1. 專案基本與成員負責人</span>
          </button>

          <button
            onClick={() => setActiveDetailSubTab('notifications')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeDetailSubTab === 'notifications'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>2. 通知管道與頻率設定</span>
          </button>

          <button
            onClick={() => setActiveDetailSubTab('products')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeDetailSubTab === 'products'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. 產品與特定版本套用 ({prjProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveDetailSubTab('version-matrix')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeDetailSubTab === 'version-matrix'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>4. 產品版本與升級對照 ({prjProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveDetailSubTab('vulnerabilities')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeDetailSubTab === 'vulnerabilities'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>5. 專案資產弱點列表 ({prjCves.length})</span>
          </button>

          <button
            onClick={() => setActiveDetailSubTab('tickets')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeDetailSubTab === 'tickets'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>6. 專案工單與執行狀況 ({prjTickets.length})</span>
          </button>
        </div>

        {/* SUB TAB 1: General Info */}
        {activeDetailSubTab === 'general' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>專案基本架構與聯繫人員</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">定義專案邊界、歸屬部門以及責任承擔團隊</p>
              </div>

              <button
                onClick={() => openEditModal(prj)}
                className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs flex items-center space-x-1 transition-colors border border-blue-200"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>編輯基本資訊</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-500">專案名稱與代號</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded border border-blue-200">
                      {prj.code}
                    </span>
                    <span className="text-base font-extrabold text-slate-900">{prj.name}</span>
                  </div>
                  <p className="text-xs text-slate-600">{prj.description || '無描述'}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-500">隸屬部門與事業群</span>
                  <div className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span>{prj.department || '未定義部門'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-500 flex items-center space-x-1">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>主要 Responsible Owner</span>
                  </span>

                  <div className="text-sm font-extrabold text-slate-900">{prj.ownerName || '未指定負責人'}</div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div className="rounded-lg bg-white border border-slate-200 p-2">
                      <div className="text-[10px] font-bold text-slate-500">CVE 通知門檻</div>
                      <div className="text-sm font-extrabold text-amber-700">CVSS ≥ {prj.notifyMinCvss ?? 7}</div>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2">
                      <div className="text-[10px] font-bold text-slate-500">最高已知分數</div>
                      <div className="text-sm font-extrabold text-rose-700">{maxProjectCvss > 0 ? maxProjectCvss.toFixed(1) : '無資料'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 2: Notifications & Frequency Settings */}
        {activeDetailSubTab === 'notifications' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                <span>專案個別通知頻道與發送頻率設定</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                分別設定產品版本與 CVE 通知頻率，並由專案負責人及處理人的 Teams Webhook 接收通報
              </p>
            </div>

            <div className="space-y-6">
              {/* Independent Version / CVE notification schedules */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {([
                  { kind: 'version', title: '產品版本更新通知', enabled: prj.versionNotifyEnabled !== false, frequency: prj.versionNotifyFrequency || 'DAILY', color: 'blue' },
                  { kind: 'cve', title: 'CVE 漏洞通知', enabled: prj.cveNotifyEnabled !== false, frequency: prj.cveNotifyFrequency || prj.notifyFrequency || 'REALTIME', color: 'rose' },
                ] as const).map((setting) => (
                  <div key={setting.kind} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        {setting.kind === 'version' ? <RefreshCw className="w-4 h-4 text-blue-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                        {setting.title}
                      </span>
                      <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={setting.enabled} onChange={async (e) => {
                          const field = setting.kind === 'version' ? 'versionNotifyEnabled' : 'cveNotifyEnabled';
                          const res = await fetch(`/api/projects/${prj.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: e.target.checked }) });
                          if (res.ok) { const updated = await res.json(); setActiveProjectDetail(updated); onRefreshData(); }
                        }} className="rounded border-slate-300" />啟用
                      </label>
                    </div>
                    <select value={setting.frequency} disabled={!setting.enabled} onChange={async (e) => {
                      const field = setting.kind === 'version' ? 'versionNotifyFrequency' : 'cveNotifyFrequency';
                      const nextField = setting.kind === 'version' ? 'versionNotifyNextRunAt' : 'cveNotifyNextRunAt';
                      const res = await fetch(`/api/projects/${prj.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: e.target.value, [nextField]: new Date().toISOString() }) });
                      if (res.ok) { const updated = await res.json(); setActiveProjectDetail(updated); onRefreshData(); }
                    }} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 disabled:opacity-50">
                      <option value="REALTIME">⚡ 即時</option>
                      <option value="EVERY_15_MIN">⏱️ 每 15 分鐘</option>
                      <option value="HOURLY">🕐 每小時</option>
                      <option value="DAILY">📅 每日</option>
                      <option value="WEEKLY">📆 每週</option>
                    </select>
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div>上次執行：{(setting.kind === 'version' ? prj.versionNotifyLastRunAt : prj.cveNotifyLastRunAt) ? new Date((setting.kind === 'version' ? prj.versionNotifyLastRunAt : prj.cveNotifyLastRunAt)!).toLocaleString('zh-TW') : '尚未執行'}</div>
                      <div>下次執行：{(setting.kind === 'version' ? prj.versionNotifyNextRunAt : prj.cveNotifyNextRunAt) ? new Date((setting.kind === 'version' ? prj.versionNotifyNextRunAt : prj.cveNotifyNextRunAt)!).toLocaleString('zh-TW') : '等待排程計算'}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Teams Webhook Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    <span>專案負責人／處理人 Teams Webhook</span>
                  </span>

                  <button
                    onClick={() => handleTestTeamsDispatch(prj, 'owner')}
                    disabled={testingTeamsPrjId === prj.id}
                    className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center space-x-1 border border-indigo-200 transition-colors"
                  >
                    <Send className={`w-3 h-3 ${testingTeamsPrjId === prj.id ? 'animate-bounce' : ''}`} />
                    <span>{testingTeamsPrjId === prj.id ? '推播中...' : '測試負責人 Webhook'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-slate-600">負責人 Webhook URL</label>
                  <input
                    type="url"
                    defaultValue={prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl || ''}
                    onBlur={async (e) => {
                      const newUrl = e.target.value.trim();
                      if (newUrl !== (prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl || '')) {
                        const res = await fetch(`/api/projects/${prj.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ownerTeamsWebhookUrl: newUrl, teamsWebhookUrl: newUrl }),
                        });
                        if (res.ok) {
                          const updated = await res.json();
                          setActiveProjectDetail(updated);
                          onRefreshData();
                        }
                      }
                    }}
                    placeholder="https://company.webhook.office.com/webhookb2/..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-end">
                    <label className="text-[11px] font-bold text-slate-600">處理人姓名
                      <input defaultValue={prj.handlerName || ''} onBlur={async (e) => { const res = await fetch(`/api/projects/${prj.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handlerName: e.target.value.trim() }) }); if (res.ok) setActiveProjectDetail(await res.json()); }} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal" />
                    </label>
                    <label className="text-[11px] font-bold text-slate-600">處理人 Webhook URL
                      <input type="url" defaultValue={prj.handlerTeamsWebhookUrl || ''} onBlur={async (e) => { const res = await fetch(`/api/projects/${prj.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handlerTeamsWebhookUrl: e.target.value.trim() }) }); if (res.ok) { setActiveProjectDetail(await res.json()); onRefreshData(); } }} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" />
                    </label>
                    <button onClick={() => handleTestTeamsDispatch(prj, 'handler')} disabled={testingTeamsPrjId === prj.id || !prj.handlerTeamsWebhookUrl} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs disabled:opacity-40">測試處理人</button>
                  </div>
                </div>
              </div>

              {/* CVE Thresholds Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>CVE Teams 通報條件與門檻</span>
                  </span>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      最低觸發 CVSS 評分: <span className="text-blue-600 font-bold">{prj.notifyMinCvss || 7.0}</span>
                    </label>
                    <input
                      type="range"
                      min="0.0"
                      max="10.0"
                      step="0.5"
                      defaultValue={prj.notifyMinCvss || 7.0}
                      onChange={async (e) => {
                        const val = parseFloat(e.target.value);
                        const res = await fetch(`/api/projects/${prj.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notifyMinCvss: val }),
                        });
                        if (res.ok) {
                          const updated = await res.json();
                          setActiveProjectDetail(updated);
                        }
                      }}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="flex items-center pt-3">
                    <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={prj.notifyCisaKevOnly || false}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          const res = await fetch(`/api/projects/${prj.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ notifyCisaKevOnly: checked }),
                          });
                          if (res.ok) {
                            const updated = await res.json();
                            setActiveProjectDetail(updated);
                          }
                        }}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>僅限 CISA KEV (已遭網路利誘攻擊漏洞)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 3: Products & Target Version Bindings */}
        {activeDetailSubTab === 'products' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>套用到此專案之資產產品與特定版本</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  可為不同專案個別指定產品的「目標套用版本號」、「部署環境」與「自訂備註」
                </p>
              </div>

              <button
                onClick={() => {
                  setBindProductId(products[0]?.id || '');
                  setBindTargetVersion(products[0]?.currentVersion || '1.0.0');
                  setBindingModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>新增產品與特定版本套用</span>
              </button>
            </div>

            {prjProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">該專案尚未綁定任何監控產品</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  點擊上方【新增產品與特定版本套用】選取產品與指定版號
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prjProducts.map((p) => {
                  const binding = (prj.productBindings || []).find((b) => b.productId === p.id);
                  const effectiveVersion = binding?.targetVersion || p.currentVersion || '未指定版本';

                  return (
                    <div
                      key={p.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {p.vendor || '通用供應商'}
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-900">{p.name}</h4>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => {
                              setBindProductId(p.id);
                              setBindTargetVersion(binding?.targetVersion || p.currentVersion || '1.0.0');
                              setBindEnvironment((binding?.environment as any) || 'Production');
                              setBindCustomNotes(binding?.customNotes || '');
                              setBindingModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center space-x-1 transition-colors"
                            title="編輯套用版本與部署環境"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>編輯版本</span>
                          </button>

                          <button
                            onClick={() => handleRemoveProductBinding(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="解除專案套用"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">專案特定套用版本</span>
                          <span className="font-mono font-bold text-blue-700 text-xs">{effectiveVersion}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 block font-semibold">部署環境</span>
                          <span className="font-bold text-slate-800 text-xs">
                            {binding?.environment || 'Production'}
                          </span>
                        </div>
                      </div>

                      {binding?.customNotes && (
                        <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-500">備註:</span> {binding.customNotes}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span>CPE 關鍵字: {p.cpeKeyword}</span>
                        <span>偵測漏洞: {p.detectedCveCount} 個</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB TAB 4: Version Matrix & Upgrade Recommendations */}
        {activeDetailSubTab === 'version-matrix' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-indigo-600" />
                  <span>專案所有產品版本資訊、最新版本與建議升級版本對照</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  列出此專案套用之資產套件版本、官方最新發行版號及建議修補安全版本對照表
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button onClick={() => handleManualProjectNotify(prj, 'VERSION')} disabled={manualNotifyKind !== null} className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Send className={`w-3.5 h-3.5 ${manualNotifyKind === 'VERSION' ? 'animate-pulse' : ''}`} />
                  {manualNotifyKind === 'VERSION' ? '發送中...' : '手動發送版本通知'}
                </button>
                <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                  專案綁定產品: {prjProducts.length} 個
                </span>
              </div>
            </div>

            {prjProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">該專案尚未綁定任何監控產品</p>
                <p className="text-[11px] text-slate-400 mt-1">請至「3. 產品與特定版本套用」分頁新增產品並設定套用版號。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Metric summary banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="hidden">
                      <span className="text-xs font-bold text-emerald-800 block">已是最新安全版本</span>
                      <span className="text-xs text-emerald-600">無修補升級需求</span>
                    </div>
                    <span className="text-xl font-black text-emerald-700">
                      {prjProducts.filter((p) => {
                        const binding = (prj.productBindings || []).find((b) => b.productId === p.id);
                        const current = binding?.targetVersion || p.currentVersion || '1.0.0';
                        const secure = p.latestSecureVersion || p.latestVersion || current;
                        return current === secure;
                      }).length}
                    </span>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-800 block">建議升級安全版本</span>
                      <span className="text-xs text-amber-600">包含已知漏洞修補</span>
                    </div>
                    <span className="text-xl font-black text-amber-700">
                      {prjProducts.filter((p) => {
                        const binding = (prj.productBindings || []).find((b) => b.productId === p.id);
                        const current = binding?.targetVersion || p.currentVersion || '1.0.0';
                        const secure = p.latestSecureVersion || p.latestVersion || current;
                        return current !== secure;
                      }).length}
                    </span>
                  </div>

                  <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-blue-800 block">偵測弱點總計</span>
                      <span className="text-xs text-blue-600">產品對應 CVE 數量</span>
                    </div>
                    <span className="text-xl font-black text-blue-700">
                      {prjProducts.reduce((acc, p) => acc + (p.detectedCveCount || 0), 0)} 個
                    </span>
                  </div>
                </div>

                {/* Detailed Version Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">產品名稱與供應商</th>
                        <th className="px-4 py-3">專案套用版本</th>
                        <th className="px-4 py-3">最新發行版本</th>
                        <th className="px-4 py-3">建議升級版本</th>
                        <th className="px-4 py-3">升級狀態與說明</th>
                        <th className="px-4 py-3 text-right">處置與派單</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {activeVersionProducts.map((p) => {
                        const binding = (prj.productBindings || []).find((b) => b.productId === p.id);
                        const currentVer = binding?.targetVersion || p.currentVersion || '1.0.0';
                        const latestVer = p.latestVersion || p.currentVersion || '1.0.0';
                        const recommendedVer = p.latestSecureVersion || p.latestVersion || currentVer;
                        const needsUpgrade = currentVer !== recommendedVer;
                        const isIgnored = ignoredProductIds.includes(p.id);
                        const linkedTicket = prjTickets.find((ticket) =>
                          ticket.affectedProducts.some((name) => name.toLowerCase() === p.name.toLowerCase()) &&
                          (!ticket.cveList || ticket.cveList.length === 0)
                        );
                        const ticketStatus = linkedTicket ? getTicketStatusMeta(linkedTicket.status) : null;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-extrabold text-slate-900 text-sm">{p.name}</div>
                              <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                                <span className="font-semibold">{p.vendor || '通用'}</span>
                                <span>•</span>
                                <span>{p.category}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 font-mono font-bold text-blue-700 text-xs">
                              <div className="inline-flex items-center space-x-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                                <span>{currentVer}</span>
                                {binding?.environment && (
                                  <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded font-sans">
                                    {binding.environment}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3.5 font-mono text-slate-700 font-semibold">
                              {latestVer}
                            </td>

                            <td className="px-4 py-3.5 font-mono">
                              <span className={`font-bold px-2.5 py-1 rounded-lg border ${
                                needsUpgrade
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              }`}>
                                {recommendedVer}
                              </span>
                            </td>

                            <td className="px-4 py-3.5">
                              {needsUpgrade ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    <span>建議升級修補 ({p.detectedCveCount} 個已知 CVE)</span>
                                  </span>
                                  {p.updateNotes && (
                                    <p className="text-[11px] text-slate-500 line-clamp-1">{p.updateNotes}</p>
                                  )}
                                  {linkedTicket && ticketStatus && (
                                    <button onClick={() => setSelectedTicket(linkedTicket)} className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-bold ${ticketStatus.className}`}>
                                      工單 {linkedTicket.ticketNo}：{ticketStatus.label}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>已為最新安全版本</span>
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                {isIgnored ? (
                                  <>
                                    <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold text-[11px]">
                                      已忽略修補
                                    </span>
                                    <button
                                      onClick={() => toggleIgnoreProduct(p.id)}
                                      className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] transition-colors"
                                    >
                                      取消忽略
                                    </button>
                                  </>
                                ) : linkedTicket && ticketStatus ? (
                                  <>
                                    <span className={`px-2 py-1 rounded-lg border font-bold text-[11px] ${ticketStatus.className}`}>
                                      {ticketStatus.label}
                                    </span>
                                    <button onClick={() => setSelectedTicket(linkedTicket)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px]">
                                      查看工單
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => toggleIgnoreProduct(p.id)}
                                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] transition-colors"
                                      title="忽略此升級"
                                    >
                                      忽略
                                    </button>
                                    <button
                                      onClick={() => openAssignProductModal(p, currentVer, recommendedVer)}
                                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center space-x-1 shadow-2xs transition-colors"
                                      title="彈出指派視窗派發修補工單"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>派單</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {closedVersionProducts.length > 0 && (
                  <div className="rounded-2xl border border-slate-300 bg-slate-100/70 p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800">已結案版本項目（不再通知）</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">對應工單已結案，自動、排程與手動版本通知均會排除這些項目。</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {closedVersionProducts.map((product) => {
                        const ticket = prjTickets.find((item) => item.status === 'CLOSED' && (!item.cveList || item.cveList.length === 0) && item.affectedProducts.some((name) => name.toLowerCase() === product.name.toLowerCase()));
                        return <button key={product.id} onClick={() => ticket && setSelectedTicket(ticket)} className="text-left rounded-xl bg-white border border-slate-300 p-3 hover:border-slate-500">
                          <div className="font-bold text-slate-800 text-xs">{product.name}</div>
                          <div className="text-[11px] text-slate-500 mt-1">{ticket?.ticketNo || '工單'} · 已結案 · 不再通知</div>
                        </button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SUB TAB 5: Project Asset Vulnerabilities List */}
        {activeDetailSubTab === 'vulnerabilities' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>專案產品關聯弱點情報列表 (Vulnerabilities List)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  彙整此專案套用之 {prjProducts.length} 個資產產品所涵蓋之所有 CVE 弱點、CVSS 評分與處置建議
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button onClick={() => handleManualProjectNotify(prj, 'CVE')} disabled={manualNotifyKind !== null} className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Send className={`w-3.5 h-3.5 ${manualNotifyKind === 'CVE' ? 'animate-pulse' : ''}`} />
                  {manualNotifyKind === 'CVE' ? '發送中...' : '手動發送 CVE 通知'}
                </button>
                <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200">
                  偵測到弱點: {prjCves.length} 個
                </span>
              </div>
            </div>

            {/* Search & Severity Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={vulnSearchTerm}
                  onChange={(e) => setVulnSearchTerm(e.target.value)}
                  placeholder="搜尋 CVE 編號、漏洞名稱或關鍵字..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-xs">
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CISA_KEV'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setVulnSeverityFilter(sev as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                      vulnSeverityFilter === sev
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {sev === 'ALL' && `全部弱點 (${prjCves.length})`}
                    {sev === 'CRITICAL' && '🔴 嚴重 (Critical)'}
                    {sev === 'HIGH' && '🟠 高風險 (High)'}
                    {sev === 'MEDIUM' && '🟡 中風險 (Medium)'}
                    {sev === 'LOW' && '🟢 低風險 (Low)'}
                    {sev === 'CISA_KEV' && '🚨 CISA KEV (已遭攻擊)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered CVE list */}
            {activeFilteredPrjCves.length === 0 ? (
              <div className="p-10 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl space-y-2">
                <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">目前專案產品未發現符合條件之 CVE 弱點</p>
                <p className="text-xs text-slate-400">專案綁定之產品在目前的篩選條目下無相關漏洞威脅。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeFilteredPrjCves.map((cve) => {
                  const cvssScore = cve.cvss?.baseScore || 0;
                  const severity = cve.cvss?.severity || 'LOW';
                  const isCveIgnored = ignoredCveIds.includes(cve.id);
                  const linkedTicket = prjTickets.find((ticket) => ticket.cveList?.some((item) => item.cveId === cve.id));
                  const ticketStatus = linkedTicket ? getTicketStatusMeta(linkedTicket.status) : null;

                  let sevColor = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (severity === 'CRITICAL') sevColor = 'bg-rose-50 text-rose-800 border-rose-300';
                  else if (severity === 'HIGH') sevColor = 'bg-amber-50 text-amber-800 border-amber-300';
                  else if (severity === 'MEDIUM') sevColor = 'bg-yellow-50 text-yellow-800 border-yellow-300';

                  return (
                    <div
                      key={cve.id}
                      className={`border rounded-2xl p-4 shadow-2xs transition-all space-y-3 ${
                        isCveIgnored
                          ? 'bg-slate-100/60 border-slate-300 opacity-75'
                          : 'bg-slate-50/70 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <button
                            onClick={() => onSelectCve && onSelectCve(cve.id)}
                            className="font-mono text-sm font-black text-blue-700 hover:text-blue-900 hover:underline flex items-center space-x-1"
                          >
                            <span>{cve.id}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                          </button>

                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${sevColor}`}>
                            CVSS {cvssScore} ({severity})
                          </span>

                          {cve.cisaKev && (
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center space-x-1">
                              <Zap className="w-3 h-3 text-purple-600" />
                              <span>CISA KEV 已遭威脅者利用</span>
                            </span>
                          )}

                          {isCveIgnored && (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                              已忽略弱點處置
                            </span>
                          )}
                          {linkedTicket && ticketStatus && (
                            <button onClick={() => setSelectedTicket(linkedTicket)} className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${ticketStatus.className}`}>
                              工單 {linkedTicket.ticketNo}：{ticketStatus.label}
                            </button>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          發布日期: {cve.publishedDate || '最近'}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            受影響產品: {cve.productName}
                          </span>
                          {cve.vendorName && (
                            <span className="text-slate-500 font-semibold">({cve.vendorName})</span>
                          )}
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">{cve.description}</p>
                      </div>

                      {/* AI mitigation steps */}
                      {cve.aiAnalysis?.mitigationSteps && cve.aiAnalysis.mitigationSteps.length > 0 && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                          <span className="font-bold text-slate-800 flex items-center space-x-1 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>AI 建議修補與減緩措施:</span>
                          </span>
                          <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5">
                            {cve.aiAnalysis.mitigationSteps.slice(0, 3).map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Ignore / Assign Action Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                        <div className="flex items-center space-x-2">
                          {isCveIgnored ? (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              <CheckCircle2 className="w-3 h-3 text-slate-400" />
                              <span>此弱點項目已設定為忽略</span>
                            </span>
                          ) : linkedTicket && ticketStatus ? (
                            <button onClick={() => setSelectedTicket(linkedTicket)} className="px-3.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center space-x-1">
                              <FileText className="w-3 h-3" />
                              <span>查看工單（{ticketStatus.label}）</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              可指派成員生成修補工單，自動帶入 AI 處置建議
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {isCveIgnored ? (
                            <button
                              onClick={() => toggleIgnoreCve(cve.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
                            >
                              取消忽略
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleIgnoreCve(cve.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
                              >
                                忽略弱點
                              </button>
                              <button
                                onClick={() => openAssignCveModal(cve)}
                                className="px-3.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1 shadow-2xs transition-colors"
                              >
                                <Send className="w-3 h-3" />
                                <span>派發處置工單</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {closedCves.length > 0 && (
              <div className="rounded-2xl border border-slate-300 bg-slate-100/70 p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">已結案 CVE（不再通知）</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">對應工單已結案，後續即時、排程與手動 CVE 通知均會排除。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {closedCves.map((cve) => {
                    const ticket = prjTickets.find((item) => item.status === 'CLOSED' && item.cveList?.some((entry) => entry.cveId === cve.id));
                    return <button key={cve.id} onClick={() => ticket && setSelectedTicket(ticket)} className="text-left rounded-xl bg-white border border-slate-300 p-3 hover:border-slate-500">
                      <div className="flex items-center justify-between gap-2"><span className="font-mono font-bold text-slate-800 text-xs">{cve.id}</span><span className="text-[10px] font-bold text-slate-600">CVSS {cve.cvss?.baseScore || 0}</span></div>
                      <div className="text-[11px] text-slate-500 mt-1">{ticket?.ticketNo || '工單'} · 已結案 · 不再通知</div>
                    </button>;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB TAB 6: Project Tickets & Execution Status Log */}
        {activeDetailSubTab === 'tickets' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  <span>專案修補工單與執行狀況 (待解決 / 已解決 / 已結案 / 資安豁免)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  個別紀錄專案工單執行狀況，支援標記豁免 (Waived) 並追蹤審核歷程與處置日誌
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleGenerateProjectTicket(prj)}
                  disabled={generatingTicketPrjId === prj.id}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
                  title="由 AI 分析本專案威脅與產品資產，自動生成完整處置工單"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${generatingTicketPrjId === prj.id ? 'animate-spin' : ''}`} />
                  <span>{generatingTicketPrjId === prj.id ? 'AI 分析產出中...' : '⚡ AI 產出專案修補工單'}</span>
                </button>

                {/* Status Filter */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setTicketFilterStatus('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      ticketFilterStatus === 'ALL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    全部 ({prjTickets.length})
                  </button>
                  <button
                    onClick={() => setTicketFilterStatus('OPEN')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      ticketFilterStatus === 'OPEN'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    待解決 ({activeTicketsCount})
                  </button>
                  <button
                    onClick={() => setTicketFilterStatus('RESOLVED')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      ticketFilterStatus === 'RESOLVED'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    已解決 ({resolvedTicketsCount})
                  </button>
                  <button
                    onClick={() => setTicketFilterStatus('WAIVED')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      ticketFilterStatus === 'WAIVED'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    已豁免 ({waivedTicketsCount})
                  </button>
                  <button
                    onClick={() => setTicketFilterStatus('CLOSED')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      ticketFilterStatus === 'CLOSED'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    已結案 ({closedTicketsCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Filtered Tickets List */}
            {prjTickets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">目前此專案尚無安全處置工單</p>
                <p className="text-[11px] text-slate-400">點擊下方按鈕或至【產品版本與升級對照】/【專案資產弱點列表】進行指派派單</p>
                <button
                  onClick={() => handleGenerateProjectTicket(prj)}
                  disabled={generatingTicketPrjId === prj.id}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${generatingTicketPrjId === prj.id ? 'animate-spin' : ''}`} />
                  <span>{generatingTicketPrjId === prj.id ? 'AI 產出中...' : '一鍵由 AI 產出全專案綜合修補工單'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {prjTickets
                  .filter((t) => {
                    if (ticketFilterStatus === 'OPEN') return t.status === 'OPEN' || t.status === 'IN_PROGRESS';
                    if (ticketFilterStatus === 'RESOLVED') return t.status === 'RESOLVED';
                    if (ticketFilterStatus === 'CLOSED') return t.status === 'CLOSED';
                    if (ticketFilterStatus === 'WAIVED') return t.status === 'WAIVED';
                    return true;
                  })
                  .map((t) => (
                    <div
                      key={t.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-blue-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                            {t.ticketNo}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.status === 'RESOLVED' || t.status === 'CLOSED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : t.status === 'WAIVED'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {t.status === 'OPEN' && '待解決 (OPEN)'}
                            {t.status === 'IN_PROGRESS' && '處理中 (IN_PROGRESS)'}
                            {t.status === 'RESOLVED' && '已解決 (RESOLVED)'}
                            {t.status === 'WAIVED' && '已豁免 (WAIVED)'}
                            {t.status === 'CLOSED' && '已結案 (CLOSED)'}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.priority === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : t.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        <h4
                          onClick={() => setSelectedTicket(t)}
                          className="text-sm font-extrabold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                        >
                          {t.title}
                        </h4>

                        <p className="text-xs text-slate-500 line-clamp-1">{t.executiveSummary}</p>

                        {/* If Waived, show reason */}
                        {t.status === 'WAIVED' && t.waiveReason && (
                          <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 text-xs text-purple-900 mt-2 space-y-0.5">
                            <span className="font-bold flex items-center space-x-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                              <span>資安豁免核准紀錄:</span>
                            </span>
                            <p className="text-purple-800 pl-4">{t.waiveReason}</p>
                            <p className="text-[10px] text-purple-600 pl-4">
                              審核者: {t.waivedBy || '安全委員會'} | 核准時間: {t.waivedAt ? new Date(t.waivedAt).toLocaleString() : '最近'}
                            </p>
                          </div>
                        )}
                        {(t.status === 'RESOLVED' || t.status === 'CLOSED') && t.resolutionNote && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900 mt-2">
                            <span className="font-bold">處理說明：</span> {t.resolutionNote}
                          </div>
                        )}
                      </div>

                      {/* Ticket Action Status Switcher */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-semibold block">設定執行狀況:</span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleUpdateTicketStatus(t.id, 'OPEN')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                t.status === 'OPEN' || t.status === 'IN_PROGRESS'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              待解決
                            </button>

                            <button
                              onClick={() => handleUpdateTicketStatus(t.id, 'RESOLVED')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                t.status === 'RESOLVED' || t.status === 'CLOSED'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              已解決
                            </button>

                            <button
                              onClick={() => handleUpdateTicketStatus(t.id, 'CLOSED')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${t.status === 'CLOSED' ? 'bg-slate-700 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                              {t.status === 'CLOSED' ? '已結案' : '結案'}
                            </button>

                            <button
                              onClick={() => {
                                setWaivingTicket(t);
                                setWaiveReasonInput(t.waiveReason || '');
                                setWaivedByInput(t.waivedBy || '專案資安長');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                t.status === 'WAIVED'
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              }`}
                            >
                              申請豁免
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedTicket(t)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>詳細情報</span>
                        </button>
                        <button
                          onClick={() => setEditingTicket({ ...t })}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center space-x-1 border border-blue-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>編輯</span>
                        </button>
                        <button
                          onClick={() => handleDeleteTicket(t)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center space-x-1 border border-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>刪除</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Resolve Ticket Modal */}
        {resolvingTicket && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto">
              <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-emerald-600/30 border border-emerald-400/30 rounded-2xl text-emerald-300">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="hidden">
                    <div className="font-mono text-xs font-bold text-emerald-300">{resolvingTicket.ticketNo}</div>
                    <h3 className="text-lg font-bold mt-0.5">填寫處理說明並標記為已解決</h3>
                  </div>
                </div>
                <button onClick={() => { setResolvingTicket(null); setResolutionNoteInput(''); }} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1">
                  <div className="text-[11px] font-bold text-slate-500">工單主題</div>
                  <div className="text-sm font-extrabold text-slate-900">{resolvingTicket.title}</div>
                  <div className="text-xs text-slate-500">專案：{resolvingTicket.projectName}　負責人：{resolvingTicket.assigneeName}</div>
                </div>

                <label className="block text-sm font-bold text-slate-800">
                  處理說明 <span className="text-rose-600">*</span>
                  <textarea
                    autoFocus
                    rows={7}
                    value={resolutionNoteInput}
                    onChange={(e) => setResolutionNoteInput(e.target.value)}
                    placeholder={'請完整記錄實際處置內容，例如：\n1. 已升級至安全版本\n2. 已套用安全修補或調整設定\n3. 已完成服務與弱點複測\n4. 複測結果及相關佐證'}
                    className="mt-2 w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm font-normal leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y"
                  />
                  <span className="mt-1.5 block text-[11px] font-normal text-slate-500">此說明將顯示於工單列表與詳細資訊，並保留作為結案稽核紀錄。</span>
                </label>

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                  確認後，工單狀態將變更為「已解決」，並記錄完成時間。後續仍可於工單外層執行結案、編輯或查看詳細資訊。
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button onClick={() => { setResolvingTicket(null); setResolutionNoteInput(''); }} className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100">取消</button>
                <button onClick={submitResolveTicket} disabled={!resolutionNoteInput.trim()} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  確認已解決
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Ticket Modal */}
        {editingTicket && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600" />編輯修補工單 {editingTicket.ticketNo}</h3>
                <button onClick={() => setEditingTicket(null)}><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <label className="block text-xs font-bold text-slate-700">工單標題 *
                <input value={editingTicket.title} onChange={(e) => setEditingTicket({ ...editingTicket, title: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 font-normal" />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-700">優先級
                  <select value={editingTicket.priority} onChange={(e) => setEditingTicket({ ...editingTicket, priority: e.target.value as TicketPriority })} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 font-normal">
                    <option value="CRITICAL">CRITICAL</option><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-700">SLA（小時）
                  <input type="number" min="1" value={editingTicket.slaHours} onChange={(e) => setEditingTicket({ ...editingTicket, slaHours: Number(e.target.value) })} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 font-normal" />
                </label>
                <label className="text-xs font-bold text-slate-700">負責人 *
                  <input value={editingTicket.assigneeName} onChange={(e) => setEditingTicket({ ...editingTicket, assigneeName: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 font-normal" />
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-700">威脅摘要
                <textarea rows={3} value={editingTicket.executiveSummary} onChange={(e) => setEditingTicket({ ...editingTicket, executiveSummary: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 font-normal" />
              </label>
              <label className="block text-xs font-bold text-slate-700">處置／權宜方案
                <textarea rows={3} value={editingTicket.mitigationPlan} onChange={(e) => setEditingTicket({ ...editingTicket, mitigationPlan: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 font-normal" />
              </label>
              {(editingTicket.status === 'RESOLVED' || editingTicket.status === 'CLOSED') && (
                <label className="block text-xs font-bold text-slate-700">處理說明 *
                  <textarea rows={3} value={editingTicket.resolutionNote || ''} onChange={(e) => setEditingTicket({ ...editingTicket, resolutionNote: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 font-normal" />
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditingTicket(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">取消</button>
                <button onClick={handleSaveTicket} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs">儲存變更</button>
              </div>
            </div>
          </div>
        )}

        {/* Waive Ticket Modal */}
        {waivingTicket && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  <span>專案資安工單「豁免 (WAIVED)」申請記錄</span>
                </h3>
                <button onClick={() => setWaivingTicket(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block">工單編號與主題:</span>
                  <span className="font-bold text-slate-900">
                    [{waivingTicket.ticketNo}] {waivingTicket.title}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    豁免原因說明 <span className="text-rose-500">*</span> (如隔離網路環境、部署補償控制)
                  </label>
                  <textarea
                    rows={3}
                    value={waiveReasonInput}
                    onChange={(e) => setWaiveReasonInput(e.target.value)}
                    placeholder="例：該系統位於實體隔離網路 (Air-gapped network)，並已於 WAF 前端套用特殊檢視規則，無直接被利用風險。"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">審核核准人員/單位</label>
                  <input
                    type="text"
                    value={waivedByInput}
                    onChange={(e) => setWaivedByInput(e.target.value)}
                    placeholder="例：資訊安全委員會 / 專案資安官"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setWaivingTicket(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  onClick={submitWaiveTicket}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm"
                >
                  確認標記為豁免
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Binding Modal */}
        {bindingModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  <span>套用產品與特定版本至【{prj.name}】</span>
                </h3>
                <button onClick={() => setBindingModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">選擇監控產品</label>
                  <select
                    value={bindProductId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setBindProductId(pid);
                      const selectedProd = products.find((p) => p.id === pid);
                      if (selectedProd) {
                        setBindTargetVersion(selectedProd.currentVersion || '1.0.0');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.vendor || '通用'}) - 預設版號: {p.currentVersion || '1.0.0'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    此專案特定套用版本號 (Target Version) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bindTargetVersion}
                    onChange={(e) => setBindTargetVersion(e.target.value)}
                    placeholder="例：6.5.0-generic 或 3.0.12"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    獨立設定此專案在生產/測試環境所實施之明確套件版號。
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">部署環境 (Environment)</label>
                  <select
                    value={bindEnvironment}
                    onChange={(e: any) => setBindEnvironment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="Production">Production (正式營運環境)</option>
                    <option value="Staging">Staging (預發布環境)</option>
                    <option value="Testing">Testing (測試環境)</option>
                    <option value="Development">Development (開發環境)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">自訂備註 / 資產註記</label>
                  <input
                    type="text"
                    value={bindCustomNotes}
                    onChange={(e) => setBindCustomNotes(e.target.value)}
                    placeholder="例：API Gateway 核心 Kernel 或 負載平衡器"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setBindingModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  onClick={handleAddProductBinding}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
                >
                  確認套用到專案
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Work Order Detail Modal */}
        {selectedTicket && (
          <TicketDetailModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdateStatus={handleUpdateTicketStatus}
          />
        )}

        {/* ASSIGN TICKET MODAL (指派安全性修補工單彈窗) */}
        {assignModalOpen && assignTarget && activeProjectDetail && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 my-8">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                    <Send className="w-5 h-5 text-indigo-600" />
                    <span>安全性修補指派與工單生成 (Assign Ticket)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    目標專案：<span className="font-bold text-slate-800">{activeProjectDetail.name} ({activeProjectDetail.code})</span>
                  </p>
                </div>
                <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Target Item Summary Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                {assignTarget.type === 'PRODUCT' && assignTarget.product && (
                  <div>
                    <div className="flex items-center justify-between font-bold text-slate-900 text-sm">
                      <span>修補標的產品：{assignTarget.product.name}</span>
                      <span className="text-xs text-indigo-600 font-mono bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
                        {assignTarget.currentVer} ➜ {assignTarget.recommendedVer}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-1 flex items-center space-x-3">
                      <span>供應商: {assignTarget.product.vendor || '通用'}</span>
                      <span>•</span>
                      <span>涵蓋 CVE 漏洞數: {assignTarget.product.detectedCveCount} 個</span>
                    </div>
                  </div>
                )}

                {assignTarget.type === 'CVE' && assignTarget.cve && (
                  <div>
                    <div className="flex items-center justify-between font-bold text-slate-900 text-sm">
                      <span className="font-mono text-rose-700">{assignTarget.cve.id}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                        CVSS {assignTarget.cve.cvss?.baseScore || 0} ({assignTarget.cve.cvss?.severity || 'HIGH'})
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs mt-1 line-clamp-2">{assignTarget.cve.description}</p>
                    <div className="text-slate-500 text-[11px] mt-1">
                      受影響軟體資產：<span className="font-semibold text-slate-800">{assignTarget.cve.productName}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleConfirmAssignTicket(); }} className="space-y-4 text-xs">
                {/* Ticket Title */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">修補工單主旨 (Title)</label>
                  <input
                    type="text"
                    required
                    value={assignCustomTitle}
                    onChange={(e) => setAssignCustomTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Assignee Selection (選擇專案成員或自訂指派對象) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs block">選擇指派對象 (Assignee)</label>
                    <span className="text-[11px] text-slate-500">快速選取專案主要負責人或輸入自訂成員</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeType('OWNER');
                        setAssigneeName(activeProjectDetail.ownerName || '專案負責人');
                        setAssigneeEmail('');
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                        assigneeType === 'OWNER'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs">{activeProjectDetail.ownerName || '專案負責人'} (主要負責人)</div>
                        <div className="text-[10px] text-slate-500 truncate">使用專案 Teams Webhook 通知</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeType('CUSTOM');
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                        assigneeType === 'CUSTOM'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <User className="w-4 h-4 text-slate-600 shrink-0" />
                      <div>
                        <div className="text-xs">自訂指派人員</div>
                        <div className="text-[10px] text-slate-500">自行填寫負責人員姓名</div>
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-1">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">指派人員姓名</label>
                      <input
                        type="text"
                        required
                        value={assigneeName}
                        onChange={(e) => setAssigneeName(e.target.value)}
                        placeholder="例：張工程師"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Priority & SLA Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">工單優先等級 (Priority)</label>
                    <select
                      value={assignPriority}
                      onChange={(e) => setAssignPriority(e.target.value as TicketPriority)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    >
                      <option value="CRITICAL">🔴 CRITICAL (緊急 - 24 小時內)</option>
                      <option value="HIGH">🟠 HIGH (高風險 - 72 小時內)</option>
                      <option value="MEDIUM">🟡 MEDIUM (中風險 - 7 天內)</option>
                      <option value="LOW">🟢 LOW (低風險 - 15 天內)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">SLA 處理期限 (小時)</label>
                    <input
                      type="number"
                      min={1}
                      value={assignSlaHours}
                      onChange={(e) => setAssignSlaHours(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* AI Suggestions Info Box */}
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-900">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>AI 自動注入修補處置建議與步驟</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    系統隨即將該修補項目寫入專案工單，並自動帶入 AI 生成之執行摘要、根因分析、修補處置步驟、緩和措施與資安掃描複測核驗方式。
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTicket}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${isCreatingTicket ? 'animate-spin' : ''}`} />
                    <span>{isCreatingTicket ? '寫入工單中...' : '確認派發工單 (含 AI 建議)'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Project Edit Modal in Level 2 */}
        {isCreating && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5 border border-slate-200 my-8">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <FolderKanban className="w-5 h-5 text-blue-600" />
                  <span>{editingProject ? '編輯專案邊界與通報設定' : '建立全新企業專案邊界'}</span>
                </h3>
                <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      專案代號 (Code) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="例：PRJ-PAY"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">隸屬事業群/部門</label>
                    <input
                      type="text"
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      placeholder="例：數位金融事業群"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    專案完整名稱 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例：行動支付 API 網關服務"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">專案功能簡述</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="說明此專案的核心技術架構與風險衝擊..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Responsible Owner Block */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                  <span className="font-bold text-slate-800 block text-xs">專案成員與 Responsible Owner 設定</span>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">負責人姓名</label>
                      <input
                        type="text"
                        value={formOwnerName}
                        onChange={(e) => setFormOwnerName(e.target.value)}
                        placeholder="陳冠豪"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                  </div>
                </div>

                {/* Project Teams notification recipients */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                  <span className="font-bold text-slate-800 block text-xs">Teams 通知對象設定</span>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">負責人 Teams Webhook URL</label>
                    <input
                      type="url"
                      value={formTeamsWebhookUrl}
                      onChange={(e) => setFormTeamsWebhookUrl(e.target.value)}
                      placeholder="https://company.webhook.office.com/webhookb2/..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block font-semibold text-slate-700">處理人姓名
                      <input type="text" value={formHandlerName} onChange={(e) => setFormHandlerName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900" />
                    </label>
                    <label className="block font-semibold text-slate-700">處理人 Teams Webhook URL
                      <input type="url" value={formHandlerTeamsWebhookUrl} onChange={(e) => setFormHandlerTeamsWebhookUrl(e.target.value)} placeholder="https://...logic.azure.com/..." className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900" />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
                  >
                    {isSubmitting ? '儲存中...' : '確認儲存專案'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER LEVEL 1: PROJECTS SUMMARY LIST PAGE (專案摘要清單第一頁)
  // =========================================================================
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Level 1 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2 text-xs font-extrabold text-blue-600 uppercase tracking-wider mb-1">
            <FolderKanban className="w-4 h-4" />
            <span>企業資安專案管理系統</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">專案清單與安全邊界總覽</h1>
          <p className="text-xs text-slate-500 mt-1">
            第一頁展示各專案名稱、負責人、套用產品、通知方式與通知頻率摘要。點選專案名稱即可進入詳細情報與設定。
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>新增專案邊界</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center justify-between">
            <span>納管專案總數</span>
            <FolderKanban className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{projects.length} 個專案</div>
          <p className="text-[11px] text-slate-400 mt-1">涵蓋 {departments.length} 個事業群部門</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center justify-between">
            <span>產品套用綁定總數</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {projects.reduce((sum, p) => sum + (p.productIds?.length || 0), 0)} 次套用
          </div>
          <p className="text-[11px] text-slate-400 mt-1">具備獨立特定版本號套用</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center justify-between">
            <span>即時觸發通報專案</span>
            <Zap className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {projects.filter((p) => !p.notifyFrequency || p.notifyFrequency === 'REALTIME').length} 個專案
          </div>
          <p className="text-[11px] text-slate-400 mt-1">發現高危漏洞當下立即推送</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center justify-between">
            <span>Teams 頻道串接率</span>
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">
            {projects.filter((p) => Boolean(p.teamsWebhookUrl)).length} / {projects.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">已設定專屬 Teams Webhook</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋專案名稱、代號或負責人..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto no-scrollbar">
          <span className="text-xs font-bold text-slate-500 shrink-0">部門篩選:</span>
          <button
            onClick={() => setSelectedDept('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
              selectedDept === 'ALL'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            全部部門 ({projects.length})
          </button>

          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                selectedDept === dept
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Level 1 Summary Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3">
          <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">未找到符合條件的專案</p>
          <p className="text-xs text-slate-400">點擊【新增專案邊界】按鈕即可開始建立。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredProjects.map((prj) => {
            const prjProducts = products.filter((p) => prj.productIds?.includes(p.id));
            const freqBadge = getFrequencyLabel(prj.notifyFrequency);

            return (
              <div
                key={prj.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header Section */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {prj.code}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 flex items-center space-x-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{prj.department || '內部事業群'}</span>
                        </span>
                      </div>

                      {/* Click Project Name to Enter Level 2 Page */}
                      <button
                        onClick={() => {
                          setActiveProjectDetail(prj);
                          setActiveDetailSubTab('general');
                        }}
                        className="text-left group flex items-center space-x-1.5 focus:outline-none"
                      >
                        <h3 className="text-base font-extrabold text-blue-700 group-hover:text-blue-900 group-hover:underline transition-all">
                          {prj.name}
                        </h3>
                        <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleDeleteProject(prj.id, prj.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                        title="刪除專案"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{prj.description || '無描述'}</p>

                  {/* Summary Block 1: 負責人 */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-700 border-b border-slate-200 pb-1.5">
                      <span className="flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>專案負責人 (Owner)</span>
                      </span>
                      <span className="font-extrabold text-slate-900">{prj.ownerName}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">CVE 通知門檻:</span>
                      <span className="font-bold text-amber-700">CVSS ≥ {prj.notifyMinCvss ?? 7}</span>
                    </div>
                  </div>

                  {/* Summary Block 2: 套用產品與特定版本 */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700 font-semibold border-b border-slate-200 pb-1.5">
                      <span className="flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>套用產品 (特定版本)</span>
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        共 {prjProducts.length} 個套用
                      </span>
                    </div>

                    {prjProducts.length === 0 ? (
                      <span className="text-[11px] text-slate-400">未綁定產品</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {prjProducts.map((p) => {
                          const binding = (prj.productBindings || []).find((b) => b.productId === p.id);
                          const versionTag = binding?.targetVersion || p.currentVersion;
                          return (
                            <span
                              key={p.id}
                              className="px-2 py-1 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800 flex items-center space-x-1 shadow-2xs"
                            >
                              <span>{p.name}</span>
                              {versionTag && <span className="text-blue-600 font-semibold">({versionTag})</span>}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Summary Block 3: 通知方式 & 通知頻率 */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-500" />
                        <span>通知管道與門檻</span>
                      </span>

                      <div className="flex items-center space-x-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            (prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl)
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {(prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl) ? '負責人 Teams' : '負責人未設'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${prj.handlerTeamsWebhookUrl ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-400'}`}>
                          {prj.handlerTeamsWebhookUrl ? '處理人 Teams' : '處理人未設'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">通知頻率:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-md border ${freqBadge.bg}`}>
                        {freqBadge.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom CTA */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">建立時間: {new Date(prj.createdAt).toLocaleDateString()}</span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateProjectTicket(prj);
                      }}
                      disabled={generatingTicketPrjId === prj.id}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center space-x-1 transition-all border border-indigo-200 disabled:opacity-50"
                      title="由 AI 自動分析生成此專案之修補處置工單"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${generatingTicketPrjId === prj.id ? 'animate-spin' : ''}`} />
                      <span>{generatingTicketPrjId === prj.id ? '產出中...' : '一鍵派發 AI 工單'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveProjectDetail(prj);
                        setActiveDetailSubTab('general');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center space-x-1 transition-all border border-blue-200"
                    >
                      <span>進入專案詳細頁</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PROJECT MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5 border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <FolderKanban className="w-5 h-5 text-blue-600" />
                <span>{editingProject ? '編輯專案邊界與通報設定' : '建立全新企業專案邊界'}</span>
              </h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    專案代號 (Code) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="例：PRJ-PAY"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">隸屬事業群/部門</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="例：數位金融事業群"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  專案完整名稱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例：行動支付 API 網關服務"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">專案功能簡述</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="說明此專案的核心技術架構與風險衝擊..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Responsible Owner Block */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <span className="font-bold text-slate-800 block text-xs">專案成員與 Responsible Owner 設定</span>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">負責人姓名</label>
                    <input
                      type="text"
                      value={formOwnerName}
                      onChange={(e) => setFormOwnerName(e.target.value)}
                      placeholder="陳冠豪"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                </div>
              </div>

              {/* Project Teams notification recipients */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <span className="font-bold text-slate-800 block text-xs">Teams 通知對象設定</span>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Microsoft Teams Webhook URL</label>
                  <input
                    type="url"
                    value={formTeamsWebhookUrl}
                    onChange={(e) => setFormTeamsWebhookUrl(e.target.value)}
                    placeholder="https://company.webhook.office.com/webhookb2/..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
                >
                  {isSubmitting ? '儲存中...' : '確認儲存專案'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WORK ORDER DETAIL MODAL */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdateStatus={handleUpdateTicketStatus}
        />
      )}
    </div>
  );
};
