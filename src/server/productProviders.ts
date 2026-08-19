import { CVEItem, MonitoredProduct, SeverityLevel } from '../types.js';

export type VersionResult = {
  latestVersion: string;
  latestSecureVersion: string;
  releaseDate?: string;
  notes: string;
  sourceType: string;
  sourceUrl: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  checkedAt: string;
};

const fetchTimed = async (url: string, init: RequestInit = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'SentinelCVE/1.0', ...(init.headers || {}) } });
    if (!response.ok) throw new Error(`${url} 回傳 HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const compareVersions = (a: string, b: string) => {
  const ap = a.replace(/^v/, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const bp = b.replace(/^v/, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if ((ap[i] || 0) !== (bp[i] || 0)) return (ap[i] || 0) - (bp[i] || 0);
  }
  return 0;
};

const packageIdentity = (product: MonitoredProduct) => {
  if (product.purl) {
    const match = product.purl.match(/^pkg:([^/]+)\/([^@?]+)(?:@[^?]+)?/i);
    if (match) return { ecosystem: match[1].toLowerCase(), name: decodeURIComponent(match[2]) };
  }
  return { ecosystem: product.ecosystem?.toLowerCase(), name: product.packageName || product.name };
};

export const resolveSourceType = (product: MonitoredProduct) => {
  if (product.sourceType && product.sourceType !== 'auto') return product.sourceType;
  if (/postgresql/i.test(product.name) || /postgresql/i.test(product.cpeKeyword)) return 'postgresql';
  if (product.repository) return 'github';
  const identity = packageIdentity(product);
  if (identity.ecosystem === 'npm') return 'npm';
  if (identity.ecosystem === 'pypi') return 'pypi';
  return 'vendor';
};

const EOL_PRODUCT_SLUGS: Record<string, string> = {
  'mysql': 'mysql',
  'microsoft windows': 'windows',
  'windows server': 'windows-server',
  'apache hop': 'apache-hop',
  'gitlab': 'gitlab',
  'apache http server': 'apache-http-server',
  'apache tomcat': 'tomcat',
  'red hat enterprise linux': 'rhel',
  'rocky linux': 'rocky-linux',
  'ubuntu': 'ubuntu',
};

const stableVersion = (value: string) => !/(?:alpha|beta|preview|pre|rc|snapshot|nightly)/i.test(value);

async function getEndOfLifeVersion(product: MonitoredProduct, slug: string, checkedAt: string): Promise<VersionResult> {
  const apiUrl = `https://endoflife.date/api/v1/products/${slug}`;
  const payload: any = await (await fetchTimed(apiUrl, { headers: { Accept: 'application/json' } })).json();
  const releases: any[] = payload.result?.releases || [];
  const candidates = releases
    .map((release) => ({ version: String(release.latest?.name || release.name || ''), date: release.latest?.date || release.releaseDate }))
    .filter((release) => release.version && stableVersion(release.version))
    .sort((a, b) => compareVersions(b.version, a.version));
  if (!candidates.length) throw new Error(`${product.name} 的結構化生命週期來源未回傳穩定版本。`);
  const latest = candidates[0];
  return {
    latestVersion: latest.version,
    latestSecureVersion: latest.version,
    releaseDate: latest.date,
    notes: `來源為 endoflife.date 的 ${product.name} 結構化生命週期資料；該資料由上游官方發行來源維護。`,
    sourceType: resolveSourceType(product),
    sourceUrl: `https://endoflife.date/${slug}`,
    confidence: 'MEDIUM',
    checkedAt,
  };
}

export async function getLatestVersion(product: MonitoredProduct): Promise<VersionResult> {
  const sourceType = resolveSourceType(product);
  const checkedAt = new Date().toISOString();
  const eolSlug = EOL_PRODUCT_SLUGS[product.name.toLowerCase()];
  if (eolSlug) return getEndOfLifeVersion(product, eolSlug, checkedAt);

  if (sourceType === 'postgresql') {
    const sourceUrl = 'https://www.postgresql.org/docs/release/';
    const html = await (await fetchTimed(sourceUrl)).text();
    const versions = [...html.matchAll(/href=["']\/docs\/release\/(\d+\.\d+)\/["']/gi)].map((match) => match[1]);
    if (!versions.length) throw new Error('無法從 PostgreSQL 官方 Release Notes 解析版本。');
    versions.sort(compareVersions).reverse();
    const latestVersion = versions[0];
    return { latestVersion, latestSecureVersion: latestVersion, notes: '來源為 PostgreSQL 官方 Release Notes。', sourceType, sourceUrl, confidence: 'HIGH', checkedAt };
  }

  if (sourceType === 'github') {
    if (!product.repository) throw new Error('GitHub Provider 需要 repository，例如 owner/repo。');
    const releasesUrl = `https://api.github.com/repos/${product.repository}/releases?per_page=100`;
    const releases: any[] = await (await fetchTimed(releasesUrl, { headers: { Accept: 'application/vnd.github+json' } })).json();
    const stableReleases = releases
      .filter((release) => !release.draft && !release.prerelease && stableVersion(String(release.tag_name || release.name || '')))
      .map((release) => ({ ...release, parsedVersion: String(release.tag_name || '').replace(/^v/i, '') }))
      .filter((release) => /\d/.test(release.parsedVersion))
      .sort((a, b) => compareVersions(b.parsedVersion, a.parsedVersion));
    if (stableReleases.length) {
      const release = stableReleases[0];
      return { latestVersion: release.parsedVersion, latestSecureVersion: release.parsedVersion, releaseDate: release.published_at, notes: release.name || `GitHub release ${release.tag_name}`, sourceType, sourceUrl: release.html_url || releasesUrl, confidence: 'HIGH', checkedAt };
    }

    const tagsUrl = `https://api.github.com/repos/${product.repository}/tags?per_page=100`;
    const tags: any[] = await (await fetchTimed(tagsUrl, { headers: { Accept: 'application/vnd.github+json' } })).json();
    const stableTags = tags
      .map((tag) => String(tag.name || ''))
      .filter((tag) => /\d/.test(tag) && stableVersion(tag))
      .sort(compareVersions)
      .reverse();
    if (!stableTags.length) throw new Error('GitHub 專案沒有可用的穩定 release 或 tag。');
    const latestVersion = stableTags[0].replace(/^v/i, '');
    return { latestVersion, latestSecureVersion: latestVersion, notes: `GitHub stable tag ${stableTags[0]}`, sourceType, sourceUrl: `https://github.com/${product.repository}/releases/tag/${stableTags[0]}`, confidence: 'HIGH', checkedAt };
  }

  const identity = packageIdentity(product);
  if (sourceType === 'npm') {
    const sourceUrl = `https://registry.npmjs.org/${encodeURIComponent(identity.name)}/latest`;
    const data: any = await (await fetchTimed(sourceUrl)).json();
    if (!data.version) throw new Error('npm Registry 未回傳版本。');
    return { latestVersion: data.version, latestSecureVersion: data.version, notes: data.description || 'npm latest dist-tag', sourceType, sourceUrl, confidence: 'HIGH', checkedAt };
  }

  if (sourceType === 'pypi') {
    const sourceUrl = `https://pypi.org/pypi/${encodeURIComponent(identity.name)}/json`;
    const data: any = await (await fetchTimed(sourceUrl)).json();
    const latestVersion = data.info?.version;
    if (!latestVersion) throw new Error('PyPI 未回傳版本。');
    const files = data.releases?.[latestVersion] || [];
    return { latestVersion, latestSecureVersion: latestVersion, releaseDate: files[0]?.upload_time_iso_8601, notes: data.info?.summary || 'PyPI latest release', sourceType, sourceUrl: data.info?.project_url || sourceUrl, confidence: 'HIGH', checkedAt };
  }

  if (sourceType === 'vendor' && product.vendorReleaseUrl) {
    if (product.name.toLowerCase() === 'python') {
      const sourceUrl = 'https://www.python.org/api/v2/downloads/release/?is_published=true';
      const releases: any[] = await (await fetchTimed(sourceUrl, { headers: { Accept: 'application/json' } })).json();
      const stable = releases
        .filter((release) => !release.pre_release && /^Python\s+3\.\d+\.\d+$/i.test(String(release.name || '')))
        .map((release) => ({ ...release, parsedVersion: String(release.name).replace(/^Python\s+/i, '') }))
        .sort((a, b) => compareVersions(b.parsedVersion, a.parsedVersion));
      if (!stable.length) throw new Error('Python 官方 API 未回傳穩定的 Python 3 版本。');
      const latest = stable[0];
      return {
        latestVersion: latest.parsedVersion,
        latestSecureVersion: latest.parsedVersion,
        releaseDate: latest.release_date,
        notes: '來源為 Python.org 官方 Releases API，已排除 alpha、beta 與 release candidate。',
        sourceType,
        sourceUrl: latest.release_page || latest.release_notes_url || sourceUrl,
        confidence: 'HIGH',
        checkedAt,
      };
    }

    if (product.name.toLowerCase().includes('trinity data integration')) {
      return {
        latestVersion: '4.1',
        latestSecureVersion: '4.1',
        releaseDate: '2022-03-02T00:00:00.000Z',
        notes: 'NetPro 官方 EOL/EOS 公告確認 4.0 已停止支援，並指定 4.1 為應移轉的受支援版本線；官網未公開最新修補版 feed，故不推測 4.1.x。',
        sourceType,
        sourceUrl: product.vendorReleaseUrl,
        confidence: 'MEDIUM',
        checkedAt,
      };
    }

    const sourceUrl = product.vendorReleaseUrl;
    const text = await (await fetchTimed(sourceUrl)).text();
    const productName = product.name.toLowerCase();
    let latestVersion = '';
    if (productName.includes('sql server')) latestVersion = [...text.matchAll(/SQL Server\s+(20\d{2})/gi)].map((m) => m[1]).sort().reverse()[0] || '';
    else if (productName.includes('oracle database')) latestVersion = text.match(/Oracle (?:AI )?Database\s+(\d+ai|\d+c)/i)?.[1] || '';
    else if (productName === 'vertica') {
      const matches = [...text.matchAll(/(?:Vertica|OpenText Analytics Database)\s+(\d+\.\d+(?:\.\d+)?)/gi)].map((m) => m[1]);
      latestVersion = matches.sort(compareVersions).reverse()[0] || '';
    }
    else if (productName.includes('vmware esxi') || productName.includes('vmware vsphere')) {
      const matches = [...text.matchAll(/ESX(?:i)?\s+(\d+\.\d+(?:\.\d+){0,3})/gi)].map((m) => m[1]);
      latestVersion = matches.filter(stableVersion).sort(compareVersions).reverse()[0] || '';
    }
    else if (productName.includes('vmware vcenter')) {
      const matches = [...text.matchAll(/vCenter(?: Server)?\s+(\d+\.\d+(?:\.\d+){0,3})/gi)].map((m) => m[1]);
      latestVersion = matches.filter(stableVersion).sort(compareVersions).reverse()[0] || '';
    }
    else if (productName.includes('denodo platform')) {
      const matches = [...text.matchAll(/Denodo Platform\s+(\d+(?:\.\d+)?)/gi)].map((m) => m[1]);
      latestVersion = matches.sort(compareVersions).reverse()[0] || '';
    }
    else if (productName.includes('pentaho data integration')) {
      const matches = [...text.matchAll(/Pentaho Data Integration(?: and Analytics)?\s+(\d+(?:\.\d+)?)/gi)].map((m) => m[1]);
      latestVersion = matches.sort(compareVersions).reverse()[0] || '';
    }
    else if (productName.includes('tableau server')) {
      const matches = [...text.matchAll(/(?:Tableau (?:Cloud\/)?Server version|<td[^>]*>)\s*(20\d{2}\.\d+)/gi)].map((m) => m[1]);
      latestVersion = matches.sort(compareVersions).reverse()[0] || '';
    }
    else if (productName.includes('power bi desktop')) {
      const matches = [...text.matchAll(/(?:version|版本|verzia|versi|버전|версия)\s*(2\.\d{3}\.\d+(?:\.\d+)?)/gi)].map((m) => m[1]);
      latestVersion = matches.sort(compareVersions).reverse()[0] || '';
    }
    else if (productName.includes('7-zip')) latestVersion = text.match(/Download 7-Zip\s+([\d.]+)/i)?.[1] || '';
    else if (productName.includes('virtualbox')) latestVersion = text.match(/VirtualBox\s+([7-9]\.\d+\.\d+)/i)?.[1] || '';
    else if (productName.includes('mysql')) {
      const matches = [...text.matchAll(/MySQL Community Server\s+([\d.]+)/gi)].map((m) => m[1]);
      latestVersion = matches.sort(compareVersions).reverse()[0] || '';
    }
    if (!latestVersion) throw new Error(`已設定官方版本頁，但尚無 ${product.name} 的可靠解析規則；請建立專屬 Adapter。`);
    return { latestVersion, latestSecureVersion: latestVersion, notes: `來源為 ${product.vendor} 官方版本頁。`, sourceType, sourceUrl, confidence: 'HIGH', checkedAt };
  }

  throw new Error('無可驗證的版本 Provider。請設定來源類型及 packageName/PURL、repository，或新增該廠商的官方 Adapter。');
}

const normalizeSeverity = (value?: string): SeverityLevel => {
  const upper = String(value || 'HIGH').toUpperCase();
  return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(upper) ? upper as SeverityLevel : 'HIGH';
};

const nvdToCve = (entry: any, product: MonitoredProduct, sourceUrl: string): CVEItem => {
  const cve = entry.cve;
  const metric = cve.metrics?.cvssMetricV31?.[0]?.cvssData || cve.metrics?.cvssMetricV30?.[0]?.cvssData || cve.metrics?.cvssMetricV2?.[0]?.cvssData || {};
  const description = cve.descriptions?.find((item: any) => item.lang === 'en')?.value || 'No description';
  return {
    id: cve.id,
    title: `${cve.id}: ${description.slice(0, 100)}`,
    description,
    publishedDate: cve.published,
    lastModifiedDate: cve.lastModified,
    productName: product.name,
    vendorName: product.vendor,
    cvss: { baseScore: Number(metric.baseScore || 0), severity: normalizeSeverity(metric.baseSeverity), vectorString: metric.vectorString || '' },
    cisaKev: Boolean(cve.cisaExploitAdd),
    cisaKevDueDate: cve.cisaActionDue,
    affectedVersions: [product.currentVersion || 'unknown'],
    cpe: product.cpe ? [product.cpe] : [],
    references: (cve.references || []).slice(0, 10).map((ref: any) => ({ name: ref.source || 'Reference', url: ref.url })),
    dataSources: [{ type: 'NVD', url: sourceUrl, retrievedAt: new Date().toISOString() }],
    matchConfidence: 'HIGH',
    matchedBy: 'NVD_CPE_APPLICABILITY',
  };
};

const resolvedCpe = (product: MonitoredProduct) => {
  if (product.cpe) {
    const parts = product.cpe.split(':');
    if (parts.length >= 6 && product.currentVersion) parts[5] = product.currentVersion;
    return parts.join(':');
  }
  if (/postgresql/i.test(product.name) && product.currentVersion) return `cpe:2.3:a:postgresql:postgresql:${product.currentVersion}:*:*:*:*:*:*:*`;
  return undefined;
};

export async function getProductVulnerabilities(product: MonitoredProduct): Promise<CVEItem[]> {
  const results = new Map<string, CVEItem>();
  const identity = packageIdentity(product);

  if (product.currentVersion && (product.purl || identity.ecosystem === 'npm' || identity.ecosystem === 'pypi')) {
    const osvUrl = 'https://api.osv.dev/v1/query';
    const osvBody = product.purl
      ? { version: product.currentVersion, package: { purl: product.purl.replace(/@[^?]+/, `@${product.currentVersion}`) } }
      : { version: product.currentVersion, package: { ecosystem: identity.ecosystem === 'pypi' ? 'PyPI' : 'npm', name: identity.name } };
    const osv: any = await (await fetchTimed(osvUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(osvBody) })).json();
    for (const vuln of osv.vulns || []) {
      const aliases: string[] = vuln.aliases || [];
      const id = aliases.find((alias) => alias.startsWith('CVE-')) || vuln.id;
      const severityScore = Number(vuln.database_specific?.cvss?.score || 0);
      results.set(id, {
        id, title: `${id}: ${vuln.summary || 'OSV vulnerability'}`, description: vuln.details || vuln.summary || '',
        publishedDate: vuln.published, lastModifiedDate: vuln.modified, productName: product.name, vendorName: product.vendor,
        cvss: { baseScore: severityScore, severity: normalizeSeverity(vuln.database_specific?.severity), vectorString: '' },
        cisaKev: false, affectedVersions: [product.currentVersion], cpe: product.cpe ? [product.cpe] : [],
        references: (vuln.references || []).map((ref: any) => ({ name: ref.type || 'OSV', url: ref.url })),
        dataSources: [{ type: 'OSV', url: `https://osv.dev/vulnerability/${vuln.id}`, retrievedAt: new Date().toISOString() }],
        matchConfidence: 'HIGH', matchedBy: 'OSV_PACKAGE_VERSION',
      });
    }
  }

  const cpe = resolvedCpe(product);
  if (cpe) {
    const sourceUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName=${encodeURIComponent(cpe)}&isVulnerable`;
    const nvd: any = await (await fetchTimed(sourceUrl, process.env.NVD_API_KEY ? { headers: { apiKey: process.env.NVD_API_KEY } } : {})).json();
    for (const entry of nvd.vulnerabilities || []) {
      const item = nvdToCve(entry, product, sourceUrl);
      const existing = results.get(item.id);
      if (existing) existing.dataSources = [...(existing.dataSources || []), ...(item.dataSources || [])];
      else results.set(item.id, item);
    }
  }

  if (!product.purl && !identity.ecosystem && !cpe) {
    throw new Error('缺少可精確比對漏洞的 PURL、ecosystem/packageName 或完整 CPE。');
  }
  return [...results.values()];
}
