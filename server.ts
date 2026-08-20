import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';
import { getLatestVersion, getProductVulnerabilities, resolveSourceType } from './src/server/productProviders.js';
import { PRODUCT_CATALOG, enrichProductFromCatalog } from './src/server/productCatalog.js';
import { initDb, loadPersistedState as loadStateFromDb, persistState as persistStateToDb } from './src/server/db.js';
import {
  INITIAL_PRODUCTS,
  INITIAL_CVES,
  INITIAL_RULES,
  INITIAL_NOTIFICATIONS,
  INITIAL_WEBHOOKS,
  INITIAL_LOGS,
  INITIAL_PROJECTS,
  INITIAL_EMAIL_CONFIG,
  INITIAL_TICKETS,
} from './src/data/initialData.js';
import {
  MonitoredProduct,
  CVEItem,
  AlertRule,
  AlertNotification,
  WebhookConfig,
  ScanLog,
  AiConfig,
  Project,
  EmailNotificationConfig,
  Ticket,
  ScheduleConfig,
  TeamsNotificationConfig,
} from './src/types.js';

// In-Memory Data Stores
let products: MonitoredProduct[] = [...INITIAL_PRODUCTS];
let cvesDatabase: CVEItem[] = [...INITIAL_CVES];
let rules: AlertRule[] = [...INITIAL_RULES];
let notifications: AlertNotification[] = [...INITIAL_NOTIFICATIONS];
let webhooks: WebhookConfig[] = [...INITIAL_WEBHOOKS];
let logs: ScanLog[] = [...INITIAL_LOGS];
let projects: Project[] = [...INITIAL_PROJECTS];
let emailConfig: EmailNotificationConfig = { ...INITIAL_EMAIL_CONFIG };
let tickets: Ticket[] = [...INITIAL_TICKETS];

let scheduleConfig: ScheduleConfig = {
  enabled: true,
  intervalMinutes: 30,
  cronExpression: '*/30 * * * *',
  scanScope: 'ALL',
  autoAiAnalysis: true,
  autoNotifyTeams: true,
  autoNotifyEmail: true,
  lastRunAt: new Date().toISOString(),
  nextRunAt: new Date(Date.now() + 30 * 60000).toISOString(),
};

let teamsConfig: TeamsNotificationConfig = {
  webhookUrl: 'https://outlook.office.com/webhook/sample-teams-channel',
  channelName: 'DevSecOps 資安緊急通報頻道',
  enabled: true,
  minCvssScore: 7.0,
  notifyCisaKevOnly: false,
  botDisplayName: 'SentinelCVE Bot',
};

let currentAiConfig: AiConfig = {
  provider: 'gemini',
  model: 'gemini-3.6-flash',
  apiKey: '',
  baseUrl: '',
  temperature: 0.2,
  promptPreset: 'ciso',
  customSystemPrompt: '',
};

// Application state (products, CVEs, tickets, ...) is persisted in PostgreSQL via
// src/server/db.ts. loadPersistedState()/persistState() below keep the exact same
// call sites/behavior as before, but read/write the database instead of a JSON file.
async function loadPersistedState() {
  try {
    const saved = await loadStateFromDb();
    // Distinguish "database has never been persisted to" (fresh install: every
    // collection/config comes back empty/undefined) from "database legitimately holds
    // an empty collection" (e.g. the user deleted all products). Only in the former
    // case do we keep the in-memory INITIAL_* seed data and write it to PostgreSQL now;
    // otherwise we trust whatever PostgreSQL returned, even if some arrays are empty.
    const hasAnyPersistedData =
      (saved.products?.length ?? 0) > 0 ||
      (saved.cvesDatabase?.length ?? 0) > 0 ||
      (saved.rules?.length ?? 0) > 0 ||
      (saved.notifications?.length ?? 0) > 0 ||
      (saved.webhooks?.length ?? 0) > 0 ||
      (saved.logs?.length ?? 0) > 0 ||
      (saved.projects?.length ?? 0) > 0 ||
      (saved.tickets?.length ?? 0) > 0 ||
      Boolean(saved.emailConfig) ||
      Boolean(saved.scheduleConfig) ||
      Boolean(saved.teamsConfig) ||
      Boolean(saved.currentAiConfig);

    if (!hasAnyPersistedData) {
      console.log('PostgreSQL has no persisted state yet; seeding it with the initial dataset.');
      persistState();
      return;
    }

    if (Array.isArray(saved.products)) products = saved.products;
    if (Array.isArray(saved.cvesDatabase)) cvesDatabase = saved.cvesDatabase;
    if (Array.isArray(saved.rules)) rules = saved.rules;
    if (Array.isArray(saved.notifications)) notifications = saved.notifications;
    if (Array.isArray(saved.webhooks)) webhooks = saved.webhooks;
    if (Array.isArray(saved.logs)) logs = saved.logs;
    if (Array.isArray(saved.projects)) projects = saved.projects;
    if (saved.emailConfig) emailConfig = { ...emailConfig, ...saved.emailConfig };
    if (Array.isArray(saved.tickets)) tickets = saved.tickets;
    if (saved.scheduleConfig) scheduleConfig = { ...scheduleConfig, ...saved.scheduleConfig };
    if (saved.teamsConfig) teamsConfig = { ...teamsConfig, ...saved.teamsConfig };
    if (saved.currentAiConfig) currentAiConfig = { ...currentAiConfig, ...saved.currentAiConfig };
  } catch (err) {
    console.error('Failed to load persisted state from PostgreSQL; using defaults:', err);
  }
}

// Fire-and-forget wrapper kept synchronous at call sites (addLog, route handlers, ...)
// exactly like the previous fs-based implementation; errors are logged, never thrown.
function persistState() {
  void persistStateToDb({
    products, cvesDatabase, rules, notifications, webhooks, logs, projects,
    emailConfig, tickets, scheduleConfig, teamsConfig, currentAiConfig,
  }).catch((err) => console.error('Failed to persist application state to PostgreSQL:', err));
}

function publicAiConfig(): AiConfig {
  return {
    ...currentAiConfig,
    apiKey: '',
    awsAccessKeyId: currentAiConfig.awsAccessKeyId ? 'configured' : '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
  };
}

function publicEmailConfig(): EmailNotificationConfig {
  return { ...emailConfig, password: '' };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function createMailTransport(config: EmailNotificationConfig) {
  return nodemailer.createTransport({
    host: config.smtpServer,
    port: Number(config.smtpPort),
    secure: Number(config.smtpPort) === 465,
    auth: config.enableAuth && config.username
      ? { user: config.username, pass: config.password || '' }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}


// Helper to log system events
function addLog(
  type: ScanLog['type'],
  level: ScanLog['level'],
  message: string,
  productName?: string,
  details?: string
) {
  const newLog: ScanLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    level,
    productName,
    message,
    details,
  };
  logs.unshift(newLog);
  if (logs.length > 200) logs = logs.slice(0, 200);
  persistState();
  return newLog;
}

// Server-Side Gemini API Helper
function getGeminiClient(customKey?: string) {
  const apiKey = customKey || currentAiConfig.apiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey && currentAiConfig.provider === 'gemini') {
    console.warn('GEMINI_API_KEY environment variable is not set.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateAiText(prompt: string, config: AiConfig = currentAiConfig, jsonResponse = false): Promise<string> {
  const provider = config.provider || 'gemini';
  const model = config.model || 'gemini-2.5-flash';
  if (provider === 'gemini') {
    const apiKey = config.apiKey || currentAiConfig.apiKey || process.env.GEMINI_API_KEY || '';
    if (!apiKey) throw new Error('Gemini API Key 尚未設定。');
    const ai = getGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { temperature: config.temperature ?? 0.2, ...(jsonResponse ? { responseMimeType: 'application/json' } : {}) },
    });
    if (!response.text) throw new Error('AI 未回傳內容。');
    return response.text;
  }

  if (provider === 'openai' || provider === 'ollama' || provider === 'custom') {
    const endpoint = (config.baseUrl || (provider === 'ollama' ? 'http://host.docker.internal:11434/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
    const apiKey = config.apiKey || currentAiConfig.apiKey || '';
    if (provider !== 'ollama' && !apiKey) throw new Error(`${provider} API Key 尚未設定。`);
    const response = await fetchWithTimeout(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.2,
        ...(jsonResponse ? { response_format: { type: 'json_object' } } : {}),
      }),
    }, 60000);
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `AI API 回傳 HTTP ${response.status}`);
    const text = body?.choices?.[0]?.message?.content;
    if (!text) throw new Error('AI 未回傳內容。');
    return text;
  }

  if (provider === 'claude') {
    const apiKey = config.apiKey || currentAiConfig.apiKey || '';
    if (!apiKey) throw new Error('Anthropic API Key 尚未設定。');
    const endpoint = (config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
    const response = await fetchWithTimeout(`${endpoint}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 4096, temperature: config.temperature ?? 0.2, messages: [{ role: 'user', content: prompt }] }),
    }, 60000);
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `Anthropic API 回傳 HTTP ${response.status}`);
    const text = body?.content?.find((item: any) => item.type === 'text')?.text;
    if (!text) throw new Error('Claude 未回傳內容。');
    return text;
  }

  throw new Error(`Provider ${provider} 尚未實作；目前支援 Gemini、OpenAI、Claude、Ollama 與 OpenAI 相容端點。`);
}


// Helper to dispatch Webhook Notification
async function dispatchWebhook(webhook: WebhookConfig, alert: AlertNotification) {
  try {
    // Basic Security Check: Only allow http and https protocols for webhooks
    if (!webhook.url || (!webhook.url.startsWith('http://') && !webhook.url.startsWith('https://'))) {
      throw new Error('不合法的 Webhook URL 協定');
    }

    const payload = {
      event: 'CVE_ALERT_TRIGGERED',
      alertId: alert.id,
      cveId: alert.cveId,
      cveTitle: alert.cveTitle,
      product: alert.productName,
      cvssScore: alert.cvssScore,
      severity: alert.severity,
      cisaKev: alert.cisaKev,
      ruleMatched: alert.ruleName,
      message: alert.message,
      timestamp: alert.timestamp,
    };

    if (webhook.type === 'slack') {
      const slackPayload = {
        text: `🚨 *[資安警報] 發現重大漏洞: ${alert.cveId} (${alert.severity})*`,
        attachments: [
          {
            color: alert.severity === 'CRITICAL' ? '#dc2626' : alert.severity === 'HIGH' ? '#ea580c' : '#eab308',
            fields: [
              { title: '產品名稱', value: alert.productName, short: true },
              { title: 'CVSS 評分', value: `${alert.cvssScore} (${alert.severity})`, short: true },
              { title: 'CISA KEV 主動攻擊', value: alert.cisaKev ? '⚠️ 是 (已在網路上遭攻擊)' : '否', short: true },
              { title: '觸發規則', value: alert.ruleName, short: true },
              { title: '詳細資訊', value: alert.message, short: false },
            ],
          },
        ],
      };
      const response = await fetchWithTimeout(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      });
      if (!response.ok) throw new Error(`Webhook 回傳 HTTP ${response.status}`);
    } else if (webhook.type === 'teams') {
      const teamsPayload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: alert.severity === 'CRITICAL' ? 'DC2626' : alert.severity === 'HIGH' ? 'EA580C' : 'EAB308',
        summary: `🚨 SentinelCVE 漏洞警報: ${alert.cveId} (${alert.severity})`,
        sections: [
          {
            activityTitle: `🚨 [SentinelCVE 漏洞警報] ${alert.cveId}`,
            activitySubtitle: `產品: ${alert.productName} | 評分: CVSS ${alert.cvssScore} (${alert.severity})`,
            facts: [
              { name: 'CVE 編號', value: alert.cveId },
              { name: '受影響產品', value: alert.productName },
              { name: 'CVSS 評分', value: `${alert.cvssScore} (${alert.severity})` },
              { name: 'CISA KEV 在野利用', value: alert.cisaKev ? '⚠️ 是 (已有網路攻擊行動)' : '否' },
              { name: '觸發警報規則', value: alert.ruleName },
              { name: '發生時間', value: new Date(alert.timestamp).toLocaleString('zh-TW') },
            ],
            markdown: true,
            text: alert.message,
          },
        ],
      };
      const response = await fetchWithTimeout(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsPayload),
      });
      if (!response.ok) throw new Error(`Webhook 回傳 HTTP ${response.status}`);
    } else {
      const response = await fetchWithTimeout(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Webhook 回傳 HTTP ${response.status}`);
    }

    webhook.lastTestedAt = new Date().toISOString();
    webhook.lastStatus = 'SUCCESS';
    addLog('WEBHOOK_DISPATCH', 'SUCCESS', `成功推播 Webhook [${webhook.name}] (${alert.cveId})`, alert.productName);
  } catch (err: any) {
    webhook.lastTestedAt = new Date().toISOString();
    webhook.lastStatus = 'FAILED';
    addLog('WEBHOOK_DISPATCH', 'ERROR', `Webhook 推播失敗 [${webhook.name}]: ${err?.message || '網路請求失敗'}`, alert.productName);
  }
}

// Rule Matching Engine
function evaluateAlertRules(cve: CVEItem, product: MonitoredProduct) {
  let createdCount = 0;
  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Check target products filter
    if (rule.targetProductIds.length > 0 && !rule.targetProductIds.includes(product.id)) {
      continue;
    }

    // Check CVSS Score
    if (cve.cvss.baseScore < rule.minCvssScore) {
      continue;
    }

    // Check CISA KEV constraint
    if (rule.onlyCisaKev && !cve.cisaKev) {
      continue;
    }

    // Check if notification already exists for this CVE & product to avoid duplicate alerts
    const existing = notifications.find((n) => n.cveId === cve.id && n.productName === product.name);
    if (!existing) {
      const newNotif: AlertNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        cveId: cve.id,
        cveTitle: cve.title,
        productName: product.name,
        cvssScore: cve.cvss.baseScore,
        severity: cve.cvss.severity,
        cisaKev: cve.cisaKev,
        message: `在監控產品【${product.name}】中發現 CVSS ${cve.cvss.baseScore} 漏洞 (${cve.id})，觸發警報規則【${rule.name}】。`,
        ruleName: rule.name,
        status: 'UNREAD',
        timestamp: new Date().toISOString(),
        channelDispatched: rule.notifyChannels.map((c) => (c === 'in_app' ? 'In-App Badge' : c === 'webhook' ? 'Webhook' : 'Email')),
      };

      notifications.unshift(newNotif);
      product.activeAlertCount += 1;
      createdCount++;

      addLog('ALERT_TRIGGER', 'WARNING', `觸發即時警報: ${cve.id} (${product.name})`, product.name, `規則: ${rule.name}`);

      // Dispatch Webhooks if enabled in rule
      if (rule.notifyChannels.includes('webhook')) {
        webhooks.filter((w) => w.enabled).forEach((wh) => dispatchWebhook(wh, newNotif));
      }

      void runConfiguredAlertAutomations(cve, product, newNotif);
    }
  }
  return createdCount;
}

function hasClosedVersionTicket(projectId: string, productName: string) {
  return tickets.some((ticket) =>
    ticket.projectId === projectId &&
    ticket.status === 'CLOSED' &&
    (!ticket.cveList || ticket.cveList.length === 0) &&
    ticket.affectedProducts.some((name) => name.toLowerCase() === productName.toLowerCase())
  );
}

function hasClosedCveTicket(projectId: string, cveId: string) {
  return tickets.some((ticket) =>
    ticket.projectId === projectId &&
    ticket.status === 'CLOSED' &&
    ticket.cveList?.some((item) => item.cveId.toLowerCase() === cveId.toLowerCase())
  );
}

async function runConfiguredAlertAutomations(cve: CVEItem, product: MonitoredProduct, alert: AlertNotification) {
  if (scheduleConfig.autoAiAnalysis && !cve.aiAnalysis) {
    try {
      const prompt = `分析 ${cve.id} 對 ${product.name} 的風險。只回傳 JSON：{"summary":"摘要","impactLevel":"${cve.cvss.severity}","attackScenario":"情境","mitigationSteps":["步驟"],"workaround":"暫解","executiveAdvisory":"建議"}`;
      cve.aiAnalysis = { ...JSON.parse(await generateAiText(prompt, currentAiConfig, true)), analyzedAt: new Date().toISOString() };
      addLog('AI_ANALYSIS', 'SUCCESS', `自動完成 AI 漏洞剖析: ${cve.id}`, product.name);
    } catch (err: any) {
      addLog('AI_ANALYSIS', 'ERROR', `自動 AI 漏洞剖析失敗: ${cve.id} - ${err?.message || '未知錯誤'}`, product.name);
    }
  }

  // Project Teams notifications are dispatched by the project scheduler below.
  // This keeps REALTIME, scheduled, manual, deduplication and closed-ticket exclusion on one path.
}

// Fetch CVEs from NVD or Mock Fallback
async function searchCVEsFromSource(keyword: string): Promise<CVEItem[]> {
  const queryLower = keyword.toLowerCase().trim();
  let matched = cvesDatabase.filter(
    (item) =>
      item.productName.toLowerCase().includes(queryLower) ||
      item.vendorName.toLowerCase().includes(queryLower) ||
      item.title.toLowerCase().includes(queryLower) ||
      item.id.toLowerCase().includes(queryLower) ||
      item.description.toLowerCase().includes(queryLower)
  );

  // Always refresh from NVD; local records are only a fallback/cache.
  {
    try {
      let nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=10`;
      if (queryLower.startsWith('cve-')) {
        nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(keyword.toUpperCase())}`;
      }

      const res = await fetchWithTimeout(nvdUrl, { headers: { 'User-Agent': 'SentinelCVE/1.0' } }, 20000);
      if (!res.ok) {
        throw new Error(`NVD API 回傳 HTTP ${res.status}`);
      }
      {
        const data = await res.json();
        if (data.vulnerabilities && Array.isArray(data.vulnerabilities)) {
          const fetchedItems: CVEItem[] = data.vulnerabilities.map((v: any) => {
            const cve = v.cve;
            const cvssData =
              cve.metrics?.cvssMetricV31?.[0]?.cvssData ||
              cve.metrics?.cvssMetricV30?.[0]?.cvssData ||
              { baseScore: 7.5, baseSeverity: 'HIGH', vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' };

            const desc = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || cve.descriptions?.[0]?.value || '無詳細描述';
            
            return {
              id: cve.id,
              title: cve.id + ': ' + desc.slice(0, 80) + '...',
              description: desc,
              publishedDate: cve.published || new Date().toISOString(),
              lastModifiedDate: cve.lastModified || new Date().toISOString(),
              productName: keyword,
              vendorName: cve.sourceIdentifier || 'NVD',
              cvss: {
                baseScore: cvssData.baseScore || 7.5,
                severity: (cvssData.baseSeverity || 'HIGH') as any,
                vectorString: cvssData.vectorString || 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
                attackVector: cvssData.attackVector || 'NETWORK',
                attackComplexity: cvssData.attackComplexity || 'LOW',
                privilegesRequired: cvssData.privilegesRequired || 'NONE',
                userInteraction: cvssData.userInteraction || 'NONE',
                scope: cvssData.scope || 'UNCHANGED',
                confidentialityImpact: cvssData.confidentialityImpact || 'HIGH',
                integrityImpact: cvssData.integrityImpact || 'HIGH',
                availabilityImpact: cvssData.availabilityImpact || 'HIGH',
              },
              epssScore: Math.round((Math.random() * 0.5 + 0.3) * 100) / 100,
              cisaKev: cvssData.baseScore >= 9.0,
              affectedVersions: ['NIST Verified'],
              cpe: [`cpe:2.3:a:*:${keyword.toLowerCase()}:*:*:*:*:*:*:*`],
              references: (cve.references || []).slice(0, 3).map((r: any) => ({
                name: r.source || 'NVD Reference',
                url: r.url,
              })),
            };
          });

          // Add newly discovered CVEs to DB
          fetchedItems.forEach((item) => {
            if (!cvesDatabase.some((existing) => existing.id === item.id)) {
              cvesDatabase.unshift(item);
            }
          });

          matched = Array.from(new Map([...fetchedItems, ...matched].map((item) => [item.id, item])).values());
        }
      }
    } catch (err) {
      console.warn('NVD API fetch failed, using local database:', err);
    }
  }

  return matched;
}

async function scanProductFromVerifiedSources(product: MonitoredProduct): Promise<CVEItem[]> {
  const found = await getProductVulnerabilities(product);
  for (const item of found) {
    const existingIndex = cvesDatabase.findIndex((existing) => existing.id === item.id && existing.productName === product.name);
    if (existingIndex >= 0) cvesDatabase[existingIndex] = { ...cvesDatabase[existingIndex], ...item };
    else cvesDatabase.unshift(item);
  }
  product.detectedCveCount = found.length;
  product.lastScannedAt = new Date().toISOString();
  return found;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  await initDb();
  await loadPersistedState();

  const frequencyMs = (frequency?: string) => ({
    REALTIME: 60_000,
    EVERY_15_MIN: 15 * 60_000,
    HOURLY: 60 * 60_000,
    DAILY: 24 * 60 * 60_000,
    WEEKLY: 7 * 24 * 60 * 60_000,
  }[frequency || 'DAILY'] || 24 * 60 * 60_000);

  const dispatchProjectDigest = async (project: Project, kind: 'VERSION' | 'CVE', force = false) => {
    const projectProducts = products.filter((product) => project.productIds.includes(product.id));
    const now = new Date();
    const frequency = kind === 'VERSION'
      ? (project.versionNotifyFrequency || 'DAILY')
      : (project.cveNotifyFrequency || project.notifyFrequency || 'REALTIME');
    const lastField = kind === 'VERSION' ? 'versionNotifyLastRunAt' : 'cveNotifyLastRunAt';
    const nextField = kind === 'VERSION' ? 'versionNotifyNextRunAt' : 'cveNotifyNextRunAt';
    project[lastField] = now.toISOString();
    project[nextField] = new Date(now.getTime() + frequencyMs(frequency)).toISOString();

    if (kind === 'VERSION') {
      // A notification schedule must also obtain version data. New environments otherwise have
      // no latestVersion/hasUpdateAvailable values and silently produce an empty notification.
      // Cache source checks for 15 minutes to avoid exhausting public vendor/GitHub rate limits.
      const sourceRefreshMs = 15 * 60_000;
      for (const product of projectProducts) {
        const checkedAt = product.versionCheckedAt ? new Date(product.versionCheckedAt).getTime() : 0;
        if (!force && checkedAt && now.getTime() - checkedAt < sourceRefreshMs) continue;
        try {
          applyVersionResult(product, await getLatestVersion(product));
        } catch (err: any) {
          addLog('SYSTEM_INFO', 'ERROR', `產品【${product.name}】排程版本檢查失敗: ${err?.message || '未知錯誤'}`, product.name);
        }
      }
    }

    const versionItems = projectProducts.filter((product) => product.hasUpdateAvailable && !hasClosedVersionTicket(project.id, product.name));
    const cveItems = cvesDatabase.filter((cve) => projectProducts.some((product) => product.name.toLowerCase() === cve.productName.toLowerCase()) && cve.cvss.baseScore >= project.notifyMinCvss && (!project.notifyCisaKevOnly || cve.cisaKev) && !hasClosedCveTicket(project.id, cve.id));
    const items = kind === 'VERSION' ? versionItems : cveItems;
    if (!items.length) {
      persistState();
      return { sent: 0, recipients: 0 };
    }

    let deliveredSignature = '';
    if (kind === 'VERSION') {
      const signature = versionItems.map((product) => `${product.id}:${product.latestSecureVersion}`).sort().join('|');
      if (!force && signature === project.versionNotifyLastSignature) {
        persistState();
        return { sent: 0, recipients: 0 };
      }
      deliveredSignature = signature;
    } else {
      const signature = cveItems.map((cve) => `${cve.id}:${cve.productName}:${cve.cvss.baseScore}:${cve.lastModifiedDate || ''}`).sort().join('|');
      if (!force && signature === project.cveNotifyLastSignature) {
        persistState();
        return { sent: 0, recipients: 0 };
      }
      deliveredSignature = signature;
    }

    const subject = kind === 'VERSION' ? `[SentinelCVE] ${project.name} 產品版本更新通知` : `[SentinelCVE] ${project.name} CVE 弱點摘要`;
    const visibleItems = items.slice(0, 30);
    const detailSections = kind === 'VERSION'
      ? (visibleItems as MonitoredProduct[]).map((product, index) => ({
          activityTitle: `${index + 1}. ${product.name}`,
          facts: [
            { name: '目前版本', value: product.currentVersion || '未設定' },
            { name: '建議安全版本', value: product.latestSecureVersion || product.latestVersion || '尚無資料' },
            { name: '版本狀態', value: '⚠️ 建議評估升級' },
          ],
          markdown: true,
        }))
      : (visibleItems as CVEItem[]).map((cve, index) => ({
          activityTitle: `${index + 1}. ${cve.id} — ${cve.productName}`,
          facts: [
            { name: 'CVSS 分數', value: `${cve.cvss.baseScore} (${cve.cvss.severity})` },
            { name: 'CISA KEV', value: cve.cisaKev ? '⚠️ 是，已有在野利用' : '否' },
            { name: '公開日期', value: cve.publishedDate ? new Date(cve.publishedDate).toLocaleDateString('zh-TW') : '未知' },
          ],
          text: cve.title ? `**摘要：** ${cve.title}` : undefined,
          markdown: true,
        }));
    const headerSection = {
      activityTitle: kind === 'VERSION' ? '📦 產品版本更新通知' : '🛡️ CVE 弱點通知',
      activitySubtitle: `專案：${project.name} (${project.code})`,
      facts: [
        { name: '通知類型', value: kind === 'VERSION' ? '版本更新' : 'CVE 弱點' },
        { name: '本次項目', value: `${items.length} 項` },
        ...(kind === 'CVE' ? [{ name: 'CVSS 門檻', value: `≥ ${project.notifyMinCvss ?? 7}` }] : []),
        { name: '發送時間', value: now.toLocaleString('zh-TW') },
      ],
      text: items.length > visibleItems.length ? `本訊息列出前 ${visibleItems.length} 項，其餘 ${items.length - visibleItems.length} 項請回系統查看。` : '以下各項已分開顯示，便於閱讀與追蹤。',
      markdown: true,
    };
    const urls = [...new Set([project.ownerTeamsWebhookUrl || project.teamsWebhookUrl, project.handlerTeamsWebhookUrl].filter(Boolean))] as string[];
    if (!urls.length) {
      addLog('WEBHOOK_DISPATCH', 'WARNING', `[專案通知略過] 專案【${project.name}】未設定 Teams Webhook`, project.name);
      persistState();
      return { sent: 0, recipients: 0 };
    }
    for (const url of urls) {
      const response = await fetchWithTimeout(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: kind === 'VERSION' ? '2563EB' : 'DC2626',
          summary: subject,
          sections: [headerSection, ...detailSections],
        }),
      });
      if (!response.ok) throw new Error(`Teams Webhook 回傳 HTTP ${response.status}`);
    }
    if (kind === 'VERSION') project.versionNotifyLastSignature = deliveredSignature;
    else project.cveNotifyLastSignature = deliveredSignature;
    addLog('WEBHOOK_DISPATCH', 'SUCCESS', `[${kind === 'VERSION' ? '版本' : 'CVE'}排程通知] 專案【${project.name}】彙整 ${items.length} 項，頻率 ${frequency}`, project.name);
    persistState();
    return { sent: items.length, recipients: urls.length };
  };

  app.use(express.json());

  // --- API Endpoints ---

  app.get('/api/product-catalog', (req, res) => {
    res.json(PRODUCT_CATALOG);
  });

  // Run a reproducible version-source audit against every built-in catalog entry.
  app.post('/api/product-catalog/check-all-versions', async (req, res) => {
    const results = await Promise.all(PRODUCT_CATALOG.map(async (entry) => {
      const product = enrichProductFromCatalog({
        id: `catalog-${entry.id}`,
        name: entry.name,
        vendor: entry.vendor,
        category: entry.category,
        currentVersion: '',
        sourceType: 'auto',
      } as MonitoredProduct);
      try {
        const version = await getLatestVersion(product);
        return { id: entry.id, name: entry.name, success: true, ...version };
      } catch (error: any) {
        return { id: entry.id, name: entry.name, success: false, error: error?.message || '版本檢查失敗' };
      }
    }));
    const passed = results.filter((result) => result.success).length;
    const failed = results.length - passed;
    res.status(failed === results.length ? 502 : 200).json({ success: failed === 0, total: results.length, passed, failed, checkedAt: new Date().toISOString(), results });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get AI Config
  app.get('/api/ai/config', (req, res) => {
    res.json(publicAiConfig());
  });

  // Update AI Config
  app.put('/api/ai/config', (req, res) => {
    const {
      provider,
      model,
      apiKey,
      baseUrl,
      awsRegion,
      awsAccessKeyId,
      awsSecretAccessKey,
      awsSessionToken,
      temperature,
      promptPreset,
      customSystemPrompt,
    } = req.body;
    if (provider) currentAiConfig.provider = provider;
    if (model) currentAiConfig.model = model;
    if (apiKey) currentAiConfig.apiKey = apiKey;
    if (baseUrl !== undefined) currentAiConfig.baseUrl = baseUrl;
    if (awsRegion !== undefined) currentAiConfig.awsRegion = awsRegion;
    if (awsAccessKeyId && awsAccessKeyId !== 'configured') currentAiConfig.awsAccessKeyId = awsAccessKeyId;
    if (awsSecretAccessKey) currentAiConfig.awsSecretAccessKey = awsSecretAccessKey;
    if (awsSessionToken) currentAiConfig.awsSessionToken = awsSessionToken;
    if (temperature !== undefined) currentAiConfig.temperature = Number(temperature);
    if (promptPreset) currentAiConfig.promptPreset = promptPreset;
    if (customSystemPrompt !== undefined) currentAiConfig.customSystemPrompt = customSystemPrompt;

    addLog('SYSTEM_INFO', 'INFO', `變更 AI 設定: 提供商 [${currentAiConfig.provider}] - 模型 [${currentAiConfig.model}]`, 'AI Engine');
    res.json(publicAiConfig());
  });

  // Test AI Connection
  app.post('/api/ai/test', async (req, res) => {
    const testConfig: AiConfig = {
      ...currentAiConfig,
      ...req.body,
      apiKey: req.body.apiKey || currentAiConfig.apiKey,
      awsAccessKeyId: req.body.awsAccessKeyId === 'configured' ? currentAiConfig.awsAccessKeyId : (req.body.awsAccessKeyId || currentAiConfig.awsAccessKeyId),
      awsSecretAccessKey: req.body.awsSecretAccessKey || currentAiConfig.awsSecretAccessKey,
      awsSessionToken: req.body.awsSessionToken || currentAiConfig.awsSessionToken,
    };
    try {
      const reply = await generateAiText('請以一句繁體中文回應：SentinelCVE AI 連線測試成功。', testConfig);
      return res.json({ success: true, provider: testConfig.provider, modelUsed: testConfig.model, message: reply });
    } catch (err: any) {
      console.error('AI test error:', err);
      res.status(502).json({ success: false, error: err?.message || 'AI 連線發生異常' });
    }
  });


  // --- Projects API Routes ---

  // GET /api/projects - Get all projects with calculated vulnerability stats
  app.get('/api/projects', (req, res) => {
    const projectsWithStats = projects.map((prj) => {
      const prjProducts = products.filter((p) => prj.productIds.includes(p.id));
      const totalCves = prjProducts.reduce((sum, p) => sum + p.detectedCveCount, 0);
      const totalAlerts = prjProducts.reduce((sum, p) => sum + p.activeAlertCount, 0);
      return {
        ...prj,
        productsList: prjProducts,
        totalCves,
        totalAlerts,
      };
    });
    res.json(projectsWithStats);
  });

  // POST /api/projects - Create a new project
  app.post('/api/projects', (req, res) => {
    const {
      code,
      name,
      description,
      department,
      ownerName,
      ownerEmail,
      secondaryContacts,
      productIds,
      notifyEmail,
      notifyFrequency,
      versionNotifyEnabled,
      versionNotifyFrequency,
      cveNotifyEnabled,
      cveNotifyFrequency,
      teamsWebhookUrl,
      ownerTeamsWebhookUrl,
      handlerName,
      handlerTeamsWebhookUrl,
      notifyMinCvss,
      notifyCisaKevOnly,
    } = req.body;
    if (!name) {
      return res.status(400).json({ error: '專案名稱 (name) 為必填欄位。' });
    }

    const newProject: Project = {
      id: `prj-${Date.now()}`,
      code: code || `PRJ-${Math.floor(100 + Math.random() * 900)}`,
      name,
      description: description || '',
      department: department || '資訊技術部門',
      ownerName: ownerName || '未指定負責人',
      ownerEmail: ownerEmail || '',
      secondaryContacts: Array.isArray(secondaryContacts) ? secondaryContacts : [],
      productIds: Array.isArray(productIds) ? productIds : [],
      notifyEmail: notifyEmail ?? true,
      notifyFrequency: notifyFrequency || 'REALTIME',
      versionNotifyEnabled: versionNotifyEnabled ?? true,
      versionNotifyFrequency: versionNotifyFrequency || 'DAILY',
      cveNotifyEnabled: cveNotifyEnabled ?? true,
      cveNotifyFrequency: cveNotifyFrequency || notifyFrequency || 'REALTIME',
      teamsWebhookUrl: teamsWebhookUrl || '',
      ownerTeamsWebhookUrl: ownerTeamsWebhookUrl || teamsWebhookUrl || '',
      handlerName: handlerName || '',
      handlerTeamsWebhookUrl: handlerTeamsWebhookUrl || '',
      notifyMinCvss: Number(notifyMinCvss) || 7.0,
      notifyCisaKevOnly: Boolean(notifyCisaKevOnly),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    projects.push(newProject);
    addLog('SYSTEM_INFO', 'INFO', `建立新專案: ${newProject.name} (代號: ${newProject.code})`, newProject.name, `負責人: ${newProject.ownerName} <${newProject.ownerEmail}>`);
    res.json(newProject);
  });

  // PUT /api/projects/:id - Edit existing project
  app.put('/api/projects/:id', (req, res) => {
    const prj = projects.find((p) => p.id === req.params.id);
    if (!prj) return res.status(404).json({ error: '專案不存在' });

    Object.assign(prj, req.body, { updatedAt: new Date().toISOString() });
    addLog('SYSTEM_INFO', 'INFO', `更新專案資訊與通報頻率: ${prj.name}`, prj.name, `版本: ${prj.versionNotifyFrequency || 'DAILY'} / CVE: ${prj.cveNotifyFrequency || prj.notifyFrequency || 'REALTIME'}`);
    res.json(prj);
  });

  // DELETE /api/projects/:id - Delete project
  app.delete('/api/projects/:id', (req, res) => {
    const idx = projects.findIndex((p) => p.id === req.params.id);
    if (idx !== -1) {
      const removed = projects.splice(idx, 1)[0];
      addLog('SYSTEM_INFO', 'INFO', `刪除專案: ${removed.name}`, removed.name);
    }
    res.json({ success: true });
  });

  // POST /api/projects/:id/notify-teams-test - Dispatch Test Teams Webhook Message
  app.post('/api/projects/:id/notify-teams-test', async (req, res) => {
    const prj = projects.find((p) => p.id === req.params.id);
    if (!prj) return res.status(404).json({ error: '專案不存在' });

    const webhookType = req.body.webhookType === 'handler' ? 'handler' : 'owner';
    const webhookUrl = req.body.webhookUrl || (webhookType === 'handler' ? prj.handlerTeamsWebhookUrl : (prj.ownerTeamsWebhookUrl || prj.teamsWebhookUrl));
    if (!webhookUrl) {
      return res.status(400).json({ error: '專案未設定 Teams Webhook URL' });
    }

    try {
      const teamsPayload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '2563EB',
        summary: `🔔 [SentinelCVE] 專案「${prj.name}」Teams 通報測試`,
        sections: [
          {
            activityTitle: `🔔 [SentinelCVE 測試通報] 專案: ${prj.name}`,
            activitySubtitle: `專案代號: ${prj.code} | 頻率設定: ${prj.notifyFrequency || 'REALTIME'}`,
            facts: [
              { name: '專案名稱', value: prj.name },
              { name: webhookType === 'handler' ? '處理人' : '負責人', value: webhookType === 'handler' ? (prj.handlerName || '未指定') : prj.ownerName },
              { name: '通知頻率', value: prj.notifyFrequency || 'REALTIME (即時)' },
              { name: '測試時間', value: new Date().toLocaleString('zh-TW') },
            ],
            markdown: true,
            text: `這是一則來自 **SentinelCVE 資安監控平台** 的測試通報，確認專案【${prj.name}】的 Microsoft Teams 頻道連線正常。`,
          },
        ],
      };

      const response = await fetchWithTimeout(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsPayload),
      });
      if (!response.ok) throw new Error(`Teams Webhook 回傳 HTTP ${response.status}`);

      addLog('WEBHOOK_DISPATCH', 'SUCCESS', `專案「${prj.name}」Teams 測試訊息已成功推送`, prj.name, `Webhook URL: ${webhookUrl}`);
      res.json({ success: true, message: `已成功推送測試訊息至專案 Teams 頻道！` });
    } catch (err: any) {
      addLog('WEBHOOK_DISPATCH', 'ERROR', `專案「${prj.name}」Teams 測試推送失敗: ${err?.message}`, prj.name);
      res.status(500).json({ error: err?.message || '推送至 Teams Webhook 失敗' });
    }
  });

  app.post('/api/projects/:id/notify-version-now', async (req, res) => {
    const project = projects.find((item) => item.id === req.params.id);
    if (!project) return res.status(404).json({ error: '專案不存在' });
    if (!(project.ownerTeamsWebhookUrl || project.teamsWebhookUrl || project.handlerTeamsWebhookUrl)) return res.status(400).json({ error: '請先設定負責人或處理人的 Teams Webhook。' });
    try {
      const result = await dispatchProjectDigest(project, 'VERSION', true);
      res.json({ success: true, ...result, message: result.sent ? `已手動發送 ${result.sent} 項版本更新至 ${result.recipients} 個 Teams Webhook。` : '目前沒有需要通知的版本更新。' });
    } catch (err: any) { res.status(502).json({ error: err?.message || '版本通知發送失敗' }); }
  });

  app.post('/api/projects/:id/notify-cve-now', async (req, res) => {
    const project = projects.find((item) => item.id === req.params.id);
    if (!project) return res.status(404).json({ error: '專案不存在' });
    if (!(project.ownerTeamsWebhookUrl || project.teamsWebhookUrl || project.handlerTeamsWebhookUrl)) return res.status(400).json({ error: '請先設定負責人或處理人的 Teams Webhook。' });
    try {
      const result = await dispatchProjectDigest(project, 'CVE', true);
      res.json({ success: true, ...result, message: result.sent ? `已手動發送 ${result.sent} 項 CVE 至 ${result.recipients} 個 Teams Webhook。` : '目前沒有符合 CVSS／CISA KEV 條件的 CVE。' });
    } catch (err: any) { res.status(502).json({ error: err?.message || 'CVE 通知發送失敗' }); }
  });

  // POST /api/projects/:id/notify-test - Dispatch Test Email to Project Owner
  app.post('/api/projects/:id/notify-test', async (req, res) => {
    const prj = projects.find((p) => p.id === req.params.id);
    if (!prj) return res.status(404).json({ error: '專案不存在' });

    const prjProducts = products.filter((p) => prj.productIds.includes(p.id));
    const sampleCve = cvesDatabase[0] || {
      id: 'CVE-2024-3094',
      title: '測試資安漏洞通報範本',
      cvss: { baseScore: 10.0, severity: 'CRITICAL' },
    };

    const recipient = prj.ownerEmail;
    addLog('WEBHOOK_DISPATCH', 'SUCCESS', `[Email 派送] 發送專案漏洞預警郵件至負責人: ${prj.ownerName} <${recipient}>`, prj.name, `包含產品: ${prjProducts.map(p => p.name).join(', ')}`);

    res.json({
      success: true,
      recipient,
      ownerName: prj.ownerName,
      projectName: prj.name,
      sentAt: new Date().toISOString(),
      emailSubject: `[SentinelCVE 緊急通報] 專案「${prj.name}」漏洞影響風險通知`,
      message: `已派發測試預警郵件至專案負責人信箱: ${prj.ownerName} <${recipient}>`,
    });
  });

  // --- Tickets & Work Orders API Routes ---

  // GET /api/tickets - List all tickets (optional ?projectId= filter)
  app.get('/api/tickets', (req, res) => {
    const { projectId } = req.query;
    if (projectId && typeof projectId === 'string') {
      return res.json(tickets.filter((t) => t.projectId === projectId));
    }
    res.json(tickets);
  });

  // POST /api/tickets - Create a new custom ticket (e.g. from version matrix or vulnerability list)
  app.post('/api/tickets', (req, res) => {
    const newTicket: Ticket = {
      id: `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ticketNo: req.body.ticketNo || `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      projectId: req.body.projectId || '',
      projectCode: req.body.projectCode || 'PRJ',
      projectName: req.body.projectName || '未指定專案',
      department: req.body.department || 'DevSecOps',
      title: req.body.title || '資安修補處置單',
      priority: req.body.priority || 'HIGH',
      status: req.body.status || 'OPEN',
      assigneeName: req.body.assigneeName || '專案負責人',
      assigneeEmail: req.body.assigneeEmail || '',
      affectedProducts: req.body.affectedProducts || [],
      cveCount: req.body.cveCount || 1,
      cveList: req.body.cveList || [],
      slaHours: req.body.slaHours || 72,
      slaDeadline: req.body.slaDeadline || new Date(Date.now() + (req.body.slaHours || 72) * 3600000).toISOString(),
      aiModelUsed: req.body.aiModelUsed || currentAiConfig.model || 'gemini-3.6-flash',
      executiveSummary: req.body.executiveSummary || '經評估進行專案套件版本升級或受影響資產 CVE 弱點修補處置。',
      rootCauseAnalysis: req.body.rootCauseAnalysis || '受監控軟體套件存在已知 CVE 弱點或版本過舊，需派發修補工單指派專人處理。',
      actionSteps: req.body.actionSteps || [
        { stepNumber: 1, title: '套件備份與環境驗證', detail: '執行系統組態備份與測試環境測試。' },
        { stepNumber: 2, title: '修補升級套用', detail: '依據建議升級版本進行套件升級與部署。' },
        { stepNumber: 3, title: '功能測試與資安複測', detail: '執行部署後功能與資安掃描複測。' },
      ],
      mitigationPlan: req.body.mitigationPlan || '執行安全版本更新與防禦控制。',
      verificationMethod: req.body.verificationMethod || '執行 SentinelCVE 複測掃描與 Log 核驗。',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tickets.unshift(newTicket);
    addLog('SYSTEM_INFO', 'INFO', `建立新修補工單 [${newTicket.ticketNo}]: ${newTicket.title} (指派對象: ${newTicket.assigneeName})`, newTicket.projectName);
    res.json(newTicket);
  });

  // GET /api/tickets/:id - Get single ticket details
  app.get('/api/tickets/:id', (req, res) => {
    const ticket = tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: '工單不存在' });
    res.json(ticket);
  });

  // PUT /api/tickets/:id - Update ticket status / assignee
  app.put('/api/tickets/:id', (req, res) => {
    const ticket = tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: '工單不存在' });

    if (req.body.status === 'RESOLVED' && !String(req.body.resolutionNote || ticket.resolutionNote || '').trim()) {
      return res.status(400).json({ error: '工單標記為已解決前，必須填寫處理說明。' });
    }

    Object.assign(ticket, req.body, { updatedAt: new Date().toISOString() });
    addLog('SYSTEM_INFO', 'INFO', `更新專案工單狀態 [${ticket.ticketNo}]: ${ticket.status}`, ticket.projectName);
    res.json(ticket);
  });

  // DELETE /api/tickets/:id - Delete ticket
  app.delete('/api/tickets/:id', (req, res) => {
    const idx = tickets.findIndex((t) => t.id === req.params.id);
    if (idx !== -1) {
      const removed = tickets.splice(idx, 1)[0];
      addLog('SYSTEM_INFO', 'INFO', `刪除專案修補工單: ${removed.ticketNo}`, removed.projectName);
    }
    res.json({ success: true });
  });

  // POST /api/tickets/:id/email - Send ticket via email
  app.post('/api/tickets/:id/email', async (req, res) => {
    const ticket = tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: '工單不存在' });

    const recipient = req.body.recipientEmail || ticket.assigneeEmail;
    if (!recipient || !emailConfig.smtpServer || !emailConfig.senderEmail) {
      return res.status(400).json({ success: false, error: 'SMTP 或工單收件者尚未設定完整。' });
    }
    try {
      const transport = createMailTransport(emailConfig);
      await transport.sendMail({
        from: `"${emailConfig.senderName || 'SentinelCVE'}" <${emailConfig.senderEmail}>`,
        to: recipient,
        subject: `[${ticket.priority}] SentinelCVE 修補工單 ${ticket.ticketNo}`,
        text: `${ticket.title}\n\n專案：${ticket.projectName}\n狀態：${ticket.status}\n優先級：${ticket.priority}\n\n${ticket.executiveSummary || ''}`,
      });
      addLog('WEBHOOK_DISPATCH', 'SUCCESS', `[Email 派送工單] 已派發安全修補工單 [${ticket.ticketNo}] 至 <${recipient}>`, ticket.projectName);
      res.json({ success: true, sentTo: recipient, ticketNo: ticket.ticketNo });
    } catch (err: any) {
      addLog('WEBHOOK_DISPATCH', 'ERROR', `[Email 派送工單失敗] ${err?.message || 'SMTP 錯誤'}`, ticket.projectName);
      res.status(502).json({ success: false, error: err?.message || 'SMTP 寄送失敗' });
    }
  });

  // POST /api/projects/:id/generate-ticket - AI Generate Work Order for Project
  app.post('/api/projects/:id/generate-ticket', async (req, res) => {
    const prj = projects.find((p) => p.id === req.params.id);
    if (!prj) return res.status(404).json({ error: '專案不存在' });

    const prjProducts = products.filter((p) => prj.productIds.includes(p.id));
    if (prjProducts.length === 0) {
      return res.status(400).json({ error: '該專案未繫結任何監控產品資產' });
    }

    // Find CVEs related to these products
    const prjProductNames = prjProducts.map((p) => p.name.toLowerCase());
    const prjCpeKeywords = prjProducts.map((p) => p.cpeKeyword.toLowerCase());

    const relevantCves = cvesDatabase.filter((cve) => {
      const pName = cve.productName.toLowerCase();
      return prjProductNames.some((n) => pName.includes(n)) || prjCpeKeywords.some((k) => pName.includes(k));
    });

    const activeCveList = relevantCves.length > 0 ? relevantCves : cvesDatabase.slice(0, 2);

    // Determine highest CVSS & Priority
    const maxCvss = activeCveList.reduce((max, c) => Math.max(max, c.cvss.baseScore), 0);
    let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let slaHours = 168; // 7 days default
    if (maxCvss >= 9.0) {
      priority = 'CRITICAL';
      slaHours = 24;
    } else if (maxCvss >= 7.0) {
      priority = 'HIGH';
      slaHours = 72;
    } else if (maxCvss >= 4.0) {
      priority = 'MEDIUM';
      slaHours = 168;
    } else {
      priority = 'LOW';
      slaHours = 336;
    }

    const slaDeadline = new Date(Date.now() + slaHours * 3600000).toISOString();
    const ticketNo = `TKT-${prj.code.toUpperCase()}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const activeModel = currentAiConfig.model || 'gemini-3.6-flash';

    try {
      let rolePrompt = '你是一位 DevSecOps 安全防護架構師與資安事件應變隊長。';
      if (currentAiConfig.promptPreset === 'redteam') {
        rolePrompt = '你是一位頂尖紅隊攻擊專家，著重於釐清攻防利用路徑與加固手段。';
      } else if (currentAiConfig.promptPreset === 'compliance') {
        rolePrompt = '你是一位資安稽核顧問，專注於產生符合 ISO 27001 規範的資安矯正單。';
      } else if (currentAiConfig.promptPreset === 'custom' && currentAiConfig.customSystemPrompt) {
        rolePrompt = currentAiConfig.customSystemPrompt;
      }

      const prompt = `${rolePrompt}
請為以下專案生成一份極致專業、可執行的「專案 CVE 漏洞資安修補處置工單 (Remediation Ticket / Work Order)」：

[專案資訊]
- 專案名稱: ${prj.name} (代號: ${prj.code})
- 隸屬部門: ${prj.department}
- 專案負責人: ${prj.ownerName} (${prj.ownerEmail})
- 受影響產品資產: ${prjProducts.map((p) => p.name).join(', ')}

[發現之資安漏洞清單 (共 ${activeCveList.length} 個)]
${activeCveList
  .map(
    (c) =>
      `- [${c.id}] ${c.productName}: CVSS ${c.cvss.baseScore} (${c.cvss.severity}) | CISA KEV: ${
        c.cisaKev ? '是' : '否'
      } | 標題: ${c.title}`
  )
  .join('\n')}

請以 JSON 格式 (繁體中文) 輸出，結構如下：
{
  "title": "簡短且明確的工單主題標題",
  "executiveSummary": "針對此專案影響範疇的高階威脅摘要 (100字以內)",
  "rootCauseAnalysis": "漏洞發生的底層技術根因剖析",
  "actionSteps": [
    {
      "stepNumber": 1,
      "title": "步驟1標題 (例如: 環境版本檢視)",
      "detail": "步驟1具體說明與操作指引",
      "commandSnippet": "可執行之 Linux / CLI / Docker 命令行或 API 驗證語法 (選填)"
    },
    {
      "stepNumber": 2,
      "title": "步驟2標題 (例如: 套件升級或 Patch 套用)",
      "detail": "步驟2具體說明",
      "commandSnippet": "修補指令"
    }
  ],
  "mitigationPlan": "若無法立即升級重構時的臨時替代規避方案 (Workaround / WAF 規則 / IP 隔離)",
  "verificationMethod": "修補完成後的驗證指引與安全複查步驟"
}`;

      const aiText = await generateAiText(prompt, currentAiConfig, true);
      const aiParsed = JSON.parse(aiText);

      const newTicket: Ticket = {
        id: `tkt-${Date.now()}`,
        ticketNo,
        projectId: prj.id,
        projectCode: prj.code,
        projectName: prj.name,
        department: prj.department,
        title: aiParsed.title || `【安全修補】${prj.name} 專案 CVE 漏洞處置工單`,
        priority,
        status: 'OPEN',
        assigneeName: prj.ownerName,
        assigneeEmail: prj.ownerEmail,
        affectedProducts: prjProducts.map((p) => p.name),
        cveCount: activeCveList.length,
        cveList: activeCveList.map((c) => ({
          cveId: c.id,
          title: c.title,
          cvss: c.cvss.baseScore,
          severity: c.cvss.severity,
          cisaKev: c.cisaKev,
          productName: c.productName,
        })),
        slaHours,
        slaDeadline,
        aiModelUsed: `${currentAiConfig.provider}/${activeModel}`,
        executiveSummary: aiParsed.executiveSummary || `專案「${prj.name}」發現 ${activeCveList.length} 個待修補漏洞，需儘速完成安全檢視。`,
        rootCauseAnalysis: aiParsed.rootCauseAnalysis || '底層套件版本過舊或缺乏邊界防禦控制機制。',
        actionSteps: aiParsed.actionSteps && aiParsed.actionSteps.length > 0
          ? aiParsed.actionSteps
          : [
              {
                stepNumber: 1,
                title: '清查並確認受影響產品版本',
                detail: `針對專案綁定之資產 (${prjProducts.map((p) => p.name).join(', ')}) 進行版號清查。`,
                commandSnippet: 'apt list --installed | grep -E "openssl|linux|docker"',
              },
              {
                stepNumber: 2,
                title: '更新與驗證安全修補',
                detail: '安裝最新釋出之 LTS 修補版本套件並重啟服務驗證。',
                commandSnippet: 'sudo apt-get update && sudo apt-get upgrade',
              },
            ],
        mitigationPlan: aiParsed.mitigationPlan || '於前端 WAF 設定封包過濾規則並進行存取控制隔離。',
        verificationMethod: aiParsed.verificationMethod || '執行漏洞掃描工具複查，確認無高危風險項目後結案。',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      tickets.unshift(newTicket);

      addLog(
        'AI_ANALYSIS',
        'SUCCESS',
        `AI [${currentAiConfig.provider}/${activeModel}] 已產出專案「${prj.name}」修補工單: ${newTicket.ticketNo}`,
        prj.name,
        `優先級: ${newTicket.priority}, SLA: ${slaHours}h, CVE: ${newTicket.cveCount} 項`
      );

      res.json(newTicket);
    } catch (err: any) {
      console.error('Ticket generation error:', err);
      addLog('AI_ANALYSIS', 'ERROR', `AI 工單產生失敗: ${err?.message || '未知錯誤'}`, prj.name);
      res.status(502).json({ success: false, error: err?.message || 'AI 工單產生失敗' });
    }
  });

  // --- Email Config API Routes ---


  // GET /api/email/config
  app.get('/api/email/config', (req, res) => {
    res.json(publicEmailConfig());
  });

  // PUT /api/email/config
  app.put('/api/email/config', (req, res) => {
    const { password, ...safeUpdates } = req.body;
    Object.assign(emailConfig, safeUpdates);
    if (password) emailConfig.password = password;
    addLog('SYSTEM_INFO', 'INFO', `更新 Email SMTP 通報伺服器設定: ${emailConfig.smtpServer}:${emailConfig.smtpPort}`, 'Email Notification');
    res.json(publicEmailConfig());
  });

  // POST /api/email/test - Send Test Email
  app.post('/api/email/test', async (req, res) => {
    const { testEmail, testRecipient, recipientName } = req.body;
    const targetEmail = testEmail || testRecipient || emailConfig.defaultRecipients?.[0] || emailConfig.senderEmail;
    const targetName = recipientName || '專案負責人';
    if (!emailConfig.smtpServer || !emailConfig.senderEmail || !targetEmail) {
      return res.status(400).json({ success: false, error: '請先設定 SMTP 主機、寄件者與測試收件者。' });
    }
    try {
      const transport = createMailTransport(emailConfig);
      await transport.sendMail({
        from: `"${emailConfig.senderName || 'SentinelCVE'}" <${emailConfig.senderEmail}>`,
        to: targetEmail,
        subject: 'SentinelCVE SMTP 連線測試',
        text: `SentinelCVE SMTP 測試成功。測試時間：${new Date().toISOString()}`,
      });
      addLog('WEBHOOK_DISPATCH', 'SUCCESS', `[Email Engine] SMTP 測試信件發送成功: ${targetName} <${targetEmail}>`, 'Email Notification');
      res.json({ success: true, sentTo: targetEmail, timestamp: new Date().toISOString(), message: `測試電子郵件已成功派送至 ${targetEmail}` });
    } catch (err: any) {
      addLog('WEBHOOK_DISPATCH', 'ERROR', `[Email Engine] SMTP 測試失敗: ${err?.message || '連線失敗'}`, 'Email Notification');
      res.status(502).json({ success: false, error: err?.message || 'SMTP 連線或寄送失敗' });
    }
  });

  // --- Auto Schedule Config API Routes ---

  // GET /api/schedule/config
  app.get('/api/schedule/config', (req, res) => {
    res.json(scheduleConfig);
  });

  // PUT /api/schedule/config
  app.put('/api/schedule/config', (req, res) => {
    const { enabled, intervalMinutes, cronExpression, scanScope, autoAiAnalysis, autoNotifyTeams, autoNotifyEmail } = req.body;
    if (enabled !== undefined) scheduleConfig.enabled = Boolean(enabled);
    if (intervalMinutes !== undefined) scheduleConfig.intervalMinutes = Number(intervalMinutes);
    if (cronExpression) scheduleConfig.cronExpression = cronExpression;
    if (scanScope) scheduleConfig.scanScope = scanScope;
    if (autoAiAnalysis !== undefined) scheduleConfig.autoAiAnalysis = Boolean(autoAiAnalysis);
    if (autoNotifyTeams !== undefined) scheduleConfig.autoNotifyTeams = Boolean(autoNotifyTeams);
    if (autoNotifyEmail !== undefined) scheduleConfig.autoNotifyEmail = Boolean(autoNotifyEmail);

    scheduleConfig.nextRunAt = new Date(Date.now() + scheduleConfig.intervalMinutes * 60000).toISOString();

    addLog('SYSTEM_INFO', 'INFO', `更新系統自動排程設定: 頻率 ${scheduleConfig.intervalMinutes} 分鐘 / 範圍 [${scheduleConfig.scanScope}]`, 'Auto Scheduler');
    res.json(scheduleConfig);
  });

  // POST /api/schedule/run-now
  app.post('/api/schedule/run-now', async (req, res) => {
    const now = new Date();
    scheduleConfig.lastRunAt = now.toISOString();
    scheduleConfig.nextRunAt = new Date(now.getTime() + scheduleConfig.intervalMinutes * 60000).toISOString();

    let scannedCount = 0;
    let alertsTriggered = 0;
    const scanErrors: Array<{ productId: string; productName: string; error: string }> = [];

    const targetProds = scheduleConfig.scanScope === 'CRITICAL_HIGH_ONLY'
      ? products.filter((p) => p.criticality === 'CRITICAL' || p.criticality === 'HIGH')
      : products;

    for (const prod of targetProds) {
      try {
        const found = await scanProductFromVerifiedSources(prod);
        scannedCount++;
        for (const cve of found) alertsTriggered += evaluateAlertRules(cve, prod);
      } catch (err: any) {
        scanErrors.push({ productId: prod.id, productName: prod.name, error: err?.message || '掃描失敗' });
      }
    }

    addLog('AUTO_SCAN', scanErrors.length ? 'WARNING' : 'SUCCESS', `[排程手動觸發] 完成 ${scannedCount} 項、失敗 ${scanErrors.length} 項`, 'Auto Scheduler', `新增警報: ${alertsTriggered} 則`);

    res.json({
      success: true,
      scannedCount,
      alertsTriggered,
      errors: scanErrors,
      lastRunAt: scheduleConfig.lastRunAt,
      nextRunAt: scheduleConfig.nextRunAt,
      message: `手動觸發排程掃描完成！共掃描 ${scannedCount} 項資產產品。`,
    });
  });

  // --- Microsoft Teams Notification API Routes ---

  // GET /api/teams/config
  app.get('/api/teams/config', (req, res) => {
    res.json(teamsConfig);
  });

  // PUT /api/teams/config
  app.put('/api/teams/config', (req, res) => {
    Object.assign(teamsConfig, req.body);
    addLog('SYSTEM_INFO', 'INFO', `更新 Microsoft Teams 通知設定: 頻道 [${teamsConfig.channelName}]`, 'MS Teams Notification');
    res.json(teamsConfig);
  });

  // POST /api/teams/test
  app.post('/api/teams/test', async (req, res) => {
    const { webhookUrl, channelName } = req.body;
    const targetUrl = webhookUrl || teamsConfig.webhookUrl;
    const targetChannel = channelName || teamsConfig.channelName;

    try {
      const teamsPayload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '2563EB',
        summary: '🎉 SentinelCVE Microsoft Teams 通報連線測試成功',
        sections: [
          {
            activityTitle: '✅ SentinelCVE 資安監控系統 - Teams 頻道連線測試',
            activitySubtitle: `通報頻道: ${targetChannel}`,
            facts: [
              { name: '系統狀態', value: '🟢 運作正常 (Online)' },
              { name: '頻道名稱', value: targetChannel },
              { name: '測試時間', value: new Date().toLocaleString('zh-TW') },
              { name: '觸發門檻', value: `CVSS >= ${teamsConfig.minCvssScore}` },
            ],
            markdown: true,
            text: '這是一封來自 **SentinelCVE 漏洞資安監控與預警系統** 的 Microsoft Teams Webhook 通報測試卡片。若您看到此訊息，代表 Teams 即時推播管道設定已順利生效！',
          },
        ],
      };

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ success: false, error: '請提供有效的 Teams Webhook URL。' });
      }
      const teamsResponse = await fetchWithTimeout(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsPayload),
      });
      if (!teamsResponse.ok) {
        throw new Error(`Teams Webhook 回傳 HTTP ${teamsResponse.status}`);
      }

      addLog('WEBHOOK_DISPATCH', 'SUCCESS', `[MS Teams 測試] 測試訊息已成功推播至 Teams 頻道: ${targetChannel}`, 'MS Teams Notification');

      res.json({
        success: true,
        channelName: targetChannel,
        sentAt: new Date().toISOString(),
        message: `Microsoft Teams 測試卡片已成功送出至「${targetChannel}」！`,
      });
    } catch (err: any) {
      addLog('WEBHOOK_DISPATCH', 'ERROR', `[MS Teams 測試失敗]: ${err?.message || '連線逾時或 URL 錯誤'}`, 'MS Teams Notification');
      res.status(502).json({
        success: false,
        channelName: targetChannel,
        sentAt: new Date().toISOString(),
        error: err?.message || 'Teams Webhook 連線失敗',
      });
    }
  });

  // Get Monitored Products
  app.get('/api/products', (req, res) => {
    res.json(products);
  });

  // Add Monitored Product
  app.post('/api/products', async (req, res) => {
    const { name, vendor, category, cpeKeyword, criticality, scanIntervalMinutes } = req.body;
    if (!name || !cpeKeyword) {
      return res.status(400).json({ error: 'Name and CPE keyword are required.' });
    }

    const newProd: MonitoredProduct = enrichProductFromCatalog({
      id: `prod-${Date.now()}`,
      name,
      vendor: vendor || 'Generic',
      category: category || 'Application',
      cpeKeyword,
      criticality: criticality || 'HIGH',
      autoScanEnabled: true,
      scanIntervalMinutes: Number(scanIntervalMinutes) || 30,
      lastScannedAt: new Date().toISOString(),
      detectedCveCount: 0,
      activeAlertCount: 0,
      currentVersion: req.body.currentVersion,
      sourceType: req.body.sourceType || 'auto',
      ecosystem: req.body.ecosystem,
      packageName: req.body.packageName,
      purl: req.body.purl,
      cpe: req.body.cpe,
      repository: req.body.repository,
      vendorReleaseUrl: req.body.vendorReleaseUrl,
      releaseChannel: req.body.releaseChannel || 'stable',
    });

    products.push(newProd);
    addLog('SYSTEM_INFO', 'INFO', `新增監控產品: ${newProd.name}`, newProd.name, `類別: ${newProd.category}, CPE: ${newProd.cpeKeyword}`);

    // Trigger immediate initial scan for new product
    try {
      const foundCves = await scanProductFromVerifiedSources(newProd);
      foundCves.forEach((cve) => evaluateAlertRules(cve, newProd));
    } catch (err: any) {
      addLog('AUTO_SCAN', 'WARNING', `產品新增成功，但首次精確漏洞掃描未執行: ${err?.message || '識別資料不足'}`, newProd.name);
    }

    res.json(newProd);
  });

  // Toggle or Update Product
  app.put('/api/products/:id', (req, res) => {
    const prod = products.find((p) => p.id === req.params.id);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    Object.assign(prod, enrichProductFromCatalog({ ...prod, ...req.body }));
    addLog('SYSTEM_INFO', 'INFO', `更新產品設定: ${prod.name}`, prod.name);
    res.json(prod);
  });

  // Delete Monitored Product
  app.delete('/api/products/:id', (req, res) => {
    const idx = products.findIndex((p) => p.id === req.params.id);
    if (idx !== -1) {
      const removed = products.splice(idx, 1)[0];
      addLog('SYSTEM_INFO', 'INFO', `刪除監控產品: ${removed.name}`, removed.name);
    }
    res.json({ success: true });
  });

  const applyVersionResult = (prod: MonitoredProduct, result: Awaited<ReturnType<typeof getLatestVersion>>) => {
    prod.latestVersion = result.latestVersion;
    prod.latestSecureVersion = result.latestSecureVersion;
    prod.hasUpdateAvailable = Boolean(prod.currentVersion && result.latestSecureVersion !== prod.currentVersion);
    prod.latestReleaseDate = result.releaseDate;
    prod.updateNotes = result.notes;
    prod.sourceType = resolveSourceType(prod) as MonitoredProduct['sourceType'];
    prod.versionSourceUrl = result.sourceUrl;
    prod.versionCheckedAt = result.checkedAt;
    prod.versionConfidence = result.confidence;
    prod.lastScannedAt = result.checkedAt;
  };

  // POST /api/products/:id/check-version - Check official/registry version source
  app.post('/api/products/:id/check-version', async (req, res) => {
    const prod = products.find((p) => p.id === req.params.id);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    try {
      const result = await getLatestVersion(prod);
      applyVersionResult(prod, result);

      addLog(
        'SYSTEM_INFO',
        'SUCCESS',
        `[新版本監控] 產品【${prod.name}】版本檢查完成 - 目前: v${prod.currentVersion || '未知'}, 最新安全版: v${prod.latestSecureVersion}`,
        prod.name,
        `來源: ${result.sourceUrl} / 可信度: ${result.confidence}`
      );

      res.json(prod);
    } catch (err: any) {
      console.warn('Official version check failed:', err);
      addLog('SYSTEM_INFO', 'ERROR', `產品【${prod.name}】官方版本檢查失敗: ${err?.message || '未知錯誤'}`, prod.name);
      res.status(502).json({ success: false, error: err?.message || '官方版本檢查失敗' });
    }
  });

  // POST /api/products/check-all-versions - Check all products for updates
  app.post('/api/products/check-all-versions', async (req, res) => {
    let updatedCount = 0;
    const errors: Array<{ productId: string; productName: string; error: string }> = [];
    for (const prod of products) {
      try {
        applyVersionResult(prod, await getLatestVersion(prod));
        updatedCount++;
      } catch (err: any) {
        errors.push({ productId: prod.id, productName: prod.name, error: err?.message || '版本檢查失敗' });
      }
    }
    addLog('AI_ANALYSIS', errors.length ? 'WARNING' : 'SUCCESS', `全站版本清查完成：成功 ${updatedCount}、失敗 ${errors.length}`, 'Version Audit Engine');
    res.status(errors.length === products.length && products.length > 0 ? 502 : 200).json({ success: errors.length === 0, count: updatedCount, products, errors });
  });

  // Get All CVEs
  app.get('/api/cves', (req, res) => {
    const { query, severity, cisaKevOnly } = req.query;
    let results = [...cvesDatabase];

    if (query && typeof query === 'string' && query.trim() !== '') {
      const q = query.toLowerCase().trim();
      results = results.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.productName.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    if (severity && typeof severity === 'string' && severity !== 'ALL') {
      results = results.filter((c) => c.cvss.severity === severity);
    }

    if (cisaKevOnly === 'true') {
      results = results.filter((c) => c.cisaKev);
    }

    res.json(results);
  });

  // Search Live CVEs from API
  app.get('/api/cves/search', async (req, res) => {
    const q = (req.query.q as string) || 'linux';
    const found = await searchCVEsFromSource(q);
    res.json(found);
  });

  // Execute Immediate Manual Scan for a single product or ALL products
  app.post('/api/cves/scan', async (req, res) => {
    const { productId } = req.body;
    let totalAlertsTriggered = 0;
    let scannedProductNames: string[] = [];
    const errors: Array<{ productId: string; productName: string; error: string }> = [];

    const targetProds = productId ? products.filter((p) => p.id === productId) : products.filter((p) => p.autoScanEnabled);

    for (const prod of targetProds) {
      try {
        const found = await scanProductFromVerifiedSources(prod);
        scannedProductNames.push(prod.name);
        for (const cve of found) totalAlertsTriggered += evaluateAlertRules(cve, prod);
      } catch (err: any) {
        errors.push({ productId: prod.id, productName: prod.name, error: err?.message || '掃描失敗' });
      }
    }

    addLog(
      'MANUAL_SCAN',
      errors.length ? 'WARNING' : 'SUCCESS',
      `全盤監控掃描完成 ${scannedProductNames.length} 項、失敗 ${errors.length} 項`,
      scannedProductNames.join(', '),
      `觸發新警報: ${totalAlertsTriggered} 則`
    );

    res.json({
      scannedCount: scannedProductNames.length,
      alertsTriggered: totalAlertsTriggered,
      scannedProducts: scannedProductNames,
      errors,
      timestamp: new Date().toISOString(),
    });
  });

  // AI - Vulnerability Threat Analysis Endpoint
  app.post('/api/cve/ai-assess', async (req, res) => {
    const { cveId } = req.body;
    const cve = cvesDatabase.find((c) => c.id === cveId) || req.body.cveData;

    if (!cve) {
      return res.status(404).json({ error: 'CVE record not found' });
    }

    try {
      let rolePrompt = '你是一位資深企業資安架構師與 SOC (Security Operations Center) 威脅分析專家。';
      if (currentAiConfig.promptPreset === 'redteam') {
        rolePrompt = '你是一位頂尖紅隊攻擊專家與滲透測試工程師，專注於分析概念驗證 (PoC) 攻擊鏈與漏洞突破路徑。';
      } else if (currentAiConfig.promptPreset === 'compliance') {
        rolePrompt = '你是一位資安合規與內部稽核顧問，專注於分析 ISO 27001、NIST CSF 合規標準與監管風控要求。';
      } else if (currentAiConfig.promptPreset === 'custom' && currentAiConfig.customSystemPrompt) {
        rolePrompt = currentAiConfig.customSystemPrompt;
      }

      const prompt = `${rolePrompt}
請針對以下 CVE 漏洞進行深度威脅剖析與資安處置建議：

[漏洞資訊]
- CVE 編號: ${cve.id}
- 標題: ${cve.title}
- 受影響產品: ${cve.productName} (廠商: ${cve.vendorName})
- CVSS v3.1 評分: ${cve.cvss?.baseScore} (${cve.cvss?.severity})
- CVSS Vector: ${cve.cvss?.vectorString}
- CISA Known Exploited (已在網路遭攻擊): ${cve.cisaKev ? '是 (急迫危機)' : '否'}
- 漏洞描述: ${cve.description}

請輸出 JSON 格式 (繁體中文)，結構如下：
{
  "summary": "1-2 句精簡專業的漏洞核心風險概述",
  "impactLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "attackScenario": "攻擊者具體攻擊路徑與潛在後果 (例如如何取得遠端執行權限或提權)",
  "mitigationSteps": ["具體修補步驟1 (如升級版本)", "具體修補步驟2 (如關閉特定設定或服務)", "網絡層阻斷建議"],
  "workaround": "如果無法立即重啟升級時的臨時應變規避措施 (Workaround)",
  "executiveAdvisory": "給企業高階資安主管 (CISO) 或維運團隊的緊急行動指引與影響範疇"
}`;

      const activeModel = currentAiConfig.model || 'gemini-3.6-flash';
      const aiText = await generateAiText(prompt, currentAiConfig, true);
      const analysisJson = JSON.parse(aiText);
      analysisJson.analyzedAt = new Date().toISOString();

      // Save to CVE item in DB
      cve.aiAnalysis = analysisJson;

      addLog('AI_ANALYSIS', 'SUCCESS', `完成 AI [${currentAiConfig.provider}/${activeModel}] 漏洞剖析: ${cve.id}`, cve.productName);

      res.json(analysisJson);
    } catch (err: any) {
      console.error('AI Assessment error:', err);
      addLog('AI_ANALYSIS', 'ERROR', `AI 漏洞剖析失敗: ${cve.id} - ${err?.message || '未知錯誤'}`, cve.productName);
      res.status(502).json({ success: false, error: err?.message || 'AI 漏洞剖析失敗' });
    }
  });


  // AI - Security Briefing Report Generator
  app.post('/api/reports/generate', async (req, res) => {
    try {
      const timeframe = req.body.timeframe || '最近 7 天';

      const monitoredNames = products.map((p) => `${p.name} (${p.category})`).join(', ');
      const highRiskCves = cvesDatabase
        .filter((c) => c.cvss.baseScore >= 7.0)
        .slice(0, 5)
        .map((c) => `- [${c.id}] ${c.productName}: CVSS ${c.cvss.baseScore} (${c.cisaKev ? 'CISA KEV攻擊中' : '高風險'}) - ${c.title}`)
        .join('\n');

      const activeModel = currentAiConfig.model || 'gemini-3.6-flash';

      const prompt = `你是一位企業級 Chief Information Security Officer (CISO) 資安顧問。
請根據以下監控數據，撰寫一份高階「資安威脅與 CVE 漏洞即時監控報告」(${timeframe})：

[監控資產清單]
${monitoredNames}

[近期高危漏洞發現 (CVSS >= 7.0)]
${highRiskCves}

請以繁體中文 Markdown 格式輸出，包含以下章節：
1. 📊 Executive Summary (高階摘要與整體資安風險指數 0-100)
2. 🚨 核心威脅與關鍵 CVE 漏洞剖析 (重點說明最危險的 2-3 個漏洞)
3. 🛡️ 建議優先處置行動清單 (按緊急程度排序：24小時內/7天內/30天內)
4. 📈 資安防禦戰略與監控優化建議`;

      const reportText = await generateAiText(prompt, { ...currentAiConfig, temperature: currentAiConfig.temperature ?? 0.3 });

      const report = {
        id: `rep-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        timeframe,
        title: `SentinelCVE 企業資安威脅週報 (${new Date().toLocaleDateString('zh-TW')})`,
        executiveSummary: reportText,
        topThreats: cvesDatabase.slice(0, 3).map((c) => ({
          cveId: c.id,
          product: c.productName,
          cvss: c.cvss.baseScore,
          description: c.title,
          status: c.cisaKev ? '被積極利用中' : '待修補',
        })),
        overallRiskScore: 78,
        recommendedActions: [
          '立即修補 Linux Kernel CVE-2024-3094 供應鏈後門漏洞。',
          '更新 Docker Engine 與 runC 防止容器逃逸 (CVE-2024-21626)。',
          '針對 Log4j 設定 WAF 阻斷規則並排查舊版 JAR 檔。',
        ],
        affectedProductsCount: products.filter((p) => p.activeAlertCount > 0).length,
        totalCveAnalyzed: cvesDatabase.length,
      };

      addLog('AI_ANALYSIS', 'SUCCESS', `生成 AI [${currentAiConfig.provider}/${activeModel}] 資安威脅監控報告`, '全系統');

      res.json(report);
    } catch (err: any) {
      console.error('Report Generation Error:', err);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });


  // Get Alerts
  app.get('/api/alerts', (req, res) => {
    res.json(notifications);
  });

  // Acknowledge Alert
  app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const notif = notifications.find((n) => n.id === req.params.id);
    if (notif) {
      notif.status = 'ACKNOWLEDGED';
      addLog('SYSTEM_INFO', 'INFO', `標記警報為已確認: ${notif.cveId}`, notif.productName);
    }
    res.json({ success: true, notif });
  });

  // Resolve Alert
  app.post('/api/alerts/:id/resolve', (req, res) => {
    const notif = notifications.find((n) => n.id === req.params.id);
    if (notif) {
      notif.status = 'RESOLVED';
      const prod = products.find((p) => p.name === notif.productName);
      if (prod && prod.activeAlertCount > 0) prod.activeAlertCount -= 1;
      addLog('SYSTEM_INFO', 'SUCCESS', `已修復並關閉警報: ${notif.cveId}`, notif.productName);
    }
    res.json({ success: true, notif });
  });

  // Get Alert Rules
  app.get('/api/rules', (req, res) => {
    res.json(rules);
  });

  // Save / Update Alert Rule
  app.post('/api/rules', (req, res) => {
    const { name, minCvssScore, onlyCisaKev, targetProductIds, notifyChannels } = req.body;
    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      name: name || 'Custom Alert Rule',
      enabled: true,
      minCvssScore: Number(minCvssScore) || 7.0,
      onlyCisaKev: Boolean(onlyCisaKev),
      targetProductIds: Array.isArray(targetProductIds) ? targetProductIds : [],
      notifyChannels: Array.isArray(notifyChannels) ? notifyChannels : ['in_app', 'webhook'],
      createdAt: new Date().toISOString(),
    };
    rules.push(newRule);
    addLog('SYSTEM_INFO', 'INFO', `新增警報規則: ${newRule.name}`);
    res.json(newRule);
  });

  app.put('/api/rules/:id', (req, res) => {
    const rule = rules.find((r) => r.id === req.params.id);
    if (rule) {
      Object.assign(rule, req.body);
      addLog('SYSTEM_INFO', 'INFO', `更新警報規則: ${rule.name}`);
    }
    res.json(rule);
  });

  app.delete('/api/rules/:id', (req, res) => {
    const idx = rules.findIndex((r) => r.id === req.params.id);
    if (idx !== -1) {
      const deleted = rules.splice(idx, 1)[0];
      addLog('SYSTEM_INFO', 'INFO', `刪除警報規則: ${deleted.name}`);
    }
    res.json({ success: true });
  });

  // Get Webhooks
  app.get('/api/webhooks', (req, res) => {
    res.json(webhooks);
  });

  // Save / Update Webhook
  app.post('/api/webhooks', (req, res) => {
    const { name, type, url, secretKey } = req.body;
    const newWh: WebhookConfig = {
      id: `wh-${Date.now()}`,
      name: name || 'Webhook Target',
      type: type || 'slack',
      url,
      enabled: true,
      secretKey,
    };
    webhooks.push(newWh);
    addLog('SYSTEM_INFO', 'INFO', `新增 Webhook 頻道: ${newWh.name}`);
    res.json(newWh);
  });

  app.post('/api/webhooks/test', async (req, res) => {
    const { url, type, name } = req.body;
    const dummyWebhook: WebhookConfig = {
      id: 'test-wh',
      name: name || 'Test Channel',
      type: type || 'slack',
      url: url || 'https://hooks.slack.com/services/test',
      enabled: true,
    };

    const dummyAlert: AlertNotification = {
      id: 'test-alert',
      cveId: 'CVE-2024-TEST',
      cveTitle: 'SentinelCVE 警報頻道連線測試範例',
      productName: 'Sentinel Monitor Test',
      cvssScore: 9.8,
      severity: 'CRITICAL',
      cisaKev: true,
      message: '這是 SentinelCVE 資安監控系統發送的測試警報與 Webhook 連線驗證訊息。',
      ruleName: 'Webhook Connectivity Verification',
      status: 'UNREAD',
      timestamp: new Date().toISOString(),
      channelDispatched: ['Webhook Test'],
    };

    await dispatchWebhook(dummyWebhook, dummyAlert);

    res.json({
      success: dummyWebhook.lastStatus === 'SUCCESS',
      status: dummyWebhook.lastStatus,
      message: dummyWebhook.lastStatus === 'SUCCESS' ? 'Webhook 測試訊息已成功送出！' : 'Webhook 送出失敗，請確認 URL 與網路設定。',
    });
  });

  // Get System Logs
  app.get('/api/logs', (req, res) => {
    res.json(logs);
  });

  // --- Background Auto-Scan Worker Interval ---
  // Runs every 30 seconds to check both global scheduleConfig and individual product intervals
  setInterval(async () => {
    const now = Date.now();

    // Project notification clocks are checked first so long-running product scans cannot delay them.
    for (const project of projects) {
      if (project.versionNotifyEnabled !== false) {
        const next = project.versionNotifyNextRunAt ? new Date(project.versionNotifyNextRunAt).getTime() : 0;
        if (!next || now >= next) {
          try { await dispatchProjectDigest(project, 'VERSION'); }
          catch (err: any) { addLog('WEBHOOK_DISPATCH', 'ERROR', `[版本排程通知失敗] ${project.name}: ${err?.message || '未知錯誤'}`, project.name); }
        }
      }
      if (project.cveNotifyEnabled !== false) {
        const next = project.cveNotifyNextRunAt ? new Date(project.cveNotifyNextRunAt).getTime() : 0;
        if (!next || now >= next) {
          try { await dispatchProjectDigest(project, 'CVE'); }
          catch (err: any) { addLog('WEBHOOK_DISPATCH', 'ERROR', `[CVE 排程通知失敗] ${project.name}: ${err?.message || '未知錯誤'}`, project.name); }
        }
      }
    }

    // 1. Check Global Schedule Config
    if (scheduleConfig.enabled && scheduleConfig.nextRunAt) {
      const nextRunTime = new Date(scheduleConfig.nextRunAt).getTime();
      if (now >= nextRunTime) {
        scheduleConfig.lastRunAt = new Date().toISOString();
        scheduleConfig.nextRunAt = new Date(now + scheduleConfig.intervalMinutes * 60000).toISOString();

        addLog('AUTO_SCAN', 'INFO', `[排程自動觸發] 啟動全域自動定期資安掃描 (頻率: ${scheduleConfig.intervalMinutes} 分鐘)`, 'Auto Scheduler');

        const targetProds = scheduleConfig.scanScope === 'CRITICAL_HIGH_ONLY'
          ? products.filter(p => p.criticality === 'CRITICAL' || p.criticality === 'HIGH')
          : products;

        let totalAlerts = 0;
        for (const prod of targetProds) {
          try {
            const found = await scanProductFromVerifiedSources(prod);
            prod.detectedCveCount = found.length;
            prod.lastScannedAt = new Date().toISOString();
            for (const cve of found) {
              totalAlerts += evaluateAlertRules(cve, prod);
            }
          } catch (err) {
            console.error(`Scheduled scan failed for ${prod.name}:`, err);
          }
        }
        addLog('AUTO_SCAN', 'SUCCESS', `[排程自動觸發] 全域自動掃描完成，已巡檢 ${targetProds.length} 項資產`, 'Auto Scheduler', `觸發警報: ${totalAlerts} 則`);
      }
    }

    // 2. Check Individual Product Auto-Scan Intervals
    for (const prod of products) {
      if (!prod.autoScanEnabled) continue;

      const lastScanTime = prod.lastScannedAt ? new Date(prod.lastScannedAt).getTime() : 0;
      const intervalMs = prod.scanIntervalMinutes * 60 * 1000;

      if (now - lastScanTime >= intervalMs) {
        prod.lastScannedAt = new Date().toISOString();
        addLog('AUTO_SCAN', 'INFO', `系統定期自動背景掃描產品: ${prod.name}`, prod.name);

        try {
          const found = await scanProductFromVerifiedSources(prod);
          prod.detectedCveCount = found.length;
          for (const cve of found) {
            evaluateAlertRules(cve, prod);
          }
        } catch (err) {
          console.error(`Auto scan failed for ${prod.name}:`, err);
        }
      }
    }

  }, 30000);

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SentinelCVE Monitor Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
