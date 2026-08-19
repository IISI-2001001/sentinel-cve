import { MonitoredProduct } from '../types.js';

export type ProductCatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  vendor: string;
  category: MonitoredProduct['category'];
  sourceType: MonitoredProduct['sourceType'];
  repository?: string;
  ecosystem?: string;
  packageName?: string;
  cpeTemplate?: string;
  vendorReleaseUrl?: string;
  note?: string;
};

export const PRODUCT_CATALOG: ProductCatalogEntry[] = [
  { id: 'vertica', name: 'Vertica', aliases: ['vertica db'], vendor: 'OpenText', category: 'Database', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:vertica:vertica_analytics_platform:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://docs.vertica.com/latest/en/', note: '來源為 OpenText Vertica 最新版文件。' },
  { id: 'postgresql', name: 'PostgreSQL', aliases: ['postgres', 'pgsql'], vendor: 'PostgreSQL Global Development Group', category: 'Database', sourceType: 'postgresql', cpeTemplate: 'cpe:2.3:a:postgresql:postgresql:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://www.postgresql.org/docs/release/' },
  { id: 'sql-server', name: 'Microsoft SQL Server', aliases: ['sql server', 'mssql'], vendor: 'Microsoft', category: 'Database', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:microsoft:sql_server:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://learn.microsoft.com/en-us/troubleshoot/sql/releases/download-and-install-latest-updates' },
  { id: 'oracle-db', name: 'Oracle Database', aliases: ['oracle db', 'oracle database'], vendor: 'Oracle', category: 'Database', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:oracle:database:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://www.oracle.com/database/technologies/oracle-database-software-downloads.html' },
  { id: 'mysql', name: 'MySQL', aliases: ['mysql server'], vendor: 'Oracle', category: 'Database', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:oracle:mysql:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://dev.mysql.com/downloads/mysql/' },
  { id: 'windows', name: 'Microsoft Windows', aliases: ['windows desktop', 'windows 11'], vendor: 'Microsoft', category: 'Operating System', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:o:microsoft:windows_11:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information', note: '請以實際 Windows 產品與 feature version 調整完整 CPE。' },
  { id: 'windows-server', name: 'Windows Server', aliases: ['microsoft windows server'], vendor: 'Microsoft', category: 'Operating System', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:o:microsoft:windows_server_2025:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://learn.microsoft.com/en-us/windows-server/get-started/windows-server-release-info' },
  { id: 'vmware-esxi', name: 'VMware ESXi', aliases: ['vmware', 'esxi'], vendor: 'VMware by Broadcom', category: 'Container/Cloud', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:o:vmware:esxi:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://knowledge.broadcom.com/external/article/316595/build-numbers-and-versions-of-vmware-esx.htm' },
  { id: 'vcenter', name: 'VMware vCenter Server', aliases: ['vcenter'], vendor: 'VMware by Broadcom', category: 'Container/Cloud', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:vmware:vcenter_server:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://knowledge.broadcom.com/external/article/326316/build-numbers-and-versions-of-vcenter-s.html' },
  { id: 'vsphere', name: 'VMware vSphere', aliases: ['vsphere'], vendor: 'VMware by Broadcom', category: 'Container/Cloud', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:vmware:vsphere:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://knowledge.broadcom.com/external/article/316595/build-numbers-and-versions-of-vmware-esx.htm' },
  { id: 'kong', name: 'Kong Gateway', aliases: ['kong'], vendor: 'Kong Inc.', category: 'Application', sourceType: 'github', repository: 'Kong/kong', cpeTemplate: 'cpe:2.3:a:konghq:kong:{version}:*:*:*:*:*:*:*' },
  { id: 'denodo', name: 'Denodo Platform', aliases: ['denodo'], vendor: 'Denodo', category: 'Application', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:denodo:denodo_platform:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://community.denodo.com/new-release/' },
  { id: 'pentaho', name: 'Pentaho Data Integration', aliases: ['pentaho', 'kettle'], vendor: 'Hitachi Vantara', category: 'Application', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:hitachivantara:pentaho_business_analytics:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://docs.pentaho.com/install' },
  { id: 'apache-hop', name: 'Apache Hop', aliases: ['hop'], vendor: 'Apache Software Foundation', category: 'Application', sourceType: 'github', repository: 'apache/hop', cpeTemplate: 'cpe:2.3:a:apache:hop:{version}:*:*:*:*:*:*:*' },
  { id: 'trinity', name: 'Trinity Data Integration Platform', aliases: ['trinity', 'trinity etl', 'trinity data integration'], vendor: 'NetPro Information Service', category: 'Application', sourceType: 'vendor', vendorReleaseUrl: 'https://www.netpro.com.tw/2022-03-02/', note: '網擎資訊 Trinity ETL／Data Integration Platform；公開支援公告目前可驗證的受支援版本線為 4.1。' },
  { id: 'tableau', name: 'Tableau Server', aliases: ['tableau'], vendor: 'Salesforce', category: 'Application', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:tableau:tableau_server:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm' },
  { id: 'power-bi', name: 'Microsoft Power BI Desktop', aliases: ['powerbi', 'power bi'], vendor: 'Microsoft', category: 'Application', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:microsoft:power_bi:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-latest-update-archive' },
  { id: 'virtualbox', name: 'Oracle VM VirtualBox', aliases: ['virtualbox'], vendor: 'Oracle', category: 'Container/Cloud', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:oracle:vm_virtualbox:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://www.virtualbox.org/wiki/Downloads' },
  { id: 'python', name: 'Python', aliases: ['python runtime'], vendor: 'Python Software Foundation', category: 'Framework/Library', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:python:python:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://www.python.org/downloads/' },
  { id: 'git', name: 'Git', aliases: ['git scm'], vendor: 'Git Project', category: 'Application', sourceType: 'github', repository: 'git/git', cpeTemplate: 'cpe:2.3:a:git-scm:git:{version}:*:*:*:*:*:*:*' },
  { id: 'gitlab', name: 'GitLab', aliases: ['gitlab ce', 'gitlab ee'], vendor: 'GitLab', category: 'Application', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:gitlab:gitlab:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://about.gitlab.com/releases/categories/releases/' },
  { id: 'airflow', name: 'Apache Airflow', aliases: ['airflow'], vendor: 'Apache Software Foundation', category: 'Framework/Library', sourceType: 'github', repository: 'apache/airflow', ecosystem: 'PyPI', packageName: 'apache-airflow', cpeTemplate: 'cpe:2.3:a:apache:airflow:{version}:*:*:*:*:*:*:*' },
  { id: 'redis', name: 'Redis', aliases: ['redis server'], vendor: 'Redis', category: 'Database', sourceType: 'github', repository: 'redis/redis', cpeTemplate: 'cpe:2.3:a:redis:redis:{version}:*:*:*:*:*:*:*' },
  { id: 'apache-httpd', name: 'Apache HTTP Server', aliases: ['apache', 'httpd'], vendor: 'Apache Software Foundation', category: 'Web Server', sourceType: 'github', repository: 'apache/httpd', cpeTemplate: 'cpe:2.3:a:apache:http_server:{version}:*:*:*:*:*:*:*' },
  { id: 'tomcat', name: 'Apache Tomcat', aliases: ['tomcat'], vendor: 'Apache Software Foundation', category: 'Web Server', sourceType: 'github', repository: 'apache/tomcat', cpeTemplate: 'cpe:2.3:a:apache:tomcat:{version}:*:*:*:*:*:*:*' },
  { id: 'notepad-plus-plus', name: 'Notepad++', aliases: ['notepad++', 'notepad plus plus'], vendor: 'Don Ho', category: 'Application', sourceType: 'github', repository: 'notepad-plus-plus/notepad-plus-plus', cpeTemplate: 'cpe:2.3:a:notepad-plus-plus:notepad\+\+:{version}:*:*:*:*:*:*:*' },
  { id: '7zip', name: '7-Zip', aliases: ['7zip', '7-zip'], vendor: 'Igor Pavlov', category: 'Application', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:a:7-zip:7-zip:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://www.7-zip.org/download.html' },
  { id: 'rhel', name: 'Red Hat Enterprise Linux', aliases: ['redhat', 'red hat', 'rhel'], vendor: 'Red Hat', category: 'Operating System', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:o:redhat:enterprise_linux:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://access.redhat.com/articles/3078' },
  { id: 'rocky-linux', name: 'Rocky Linux', aliases: ['rocky', 'rocky linux'], vendor: 'Rocky Enterprise Software Foundation', category: 'Operating System', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:o:rocky:rocky_linux:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://rockylinux.org/download' },
  { id: 'ubuntu', name: 'Ubuntu', aliases: ['ubuntu linux'], vendor: 'Canonical', category: 'Operating System', sourceType: 'vendor', cpeTemplate: 'cpe:2.3:o:canonical:ubuntu_linux:{version}:*:*:*:*:*:*:*', vendorReleaseUrl: 'https://ubuntu.com/about/release-cycle' },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();

export function findCatalogEntry(name: string) {
  const target = normalize(name);
  return PRODUCT_CATALOG.find((entry) => [entry.name, ...entry.aliases].some((alias) => normalize(alias) === target))
    || PRODUCT_CATALOG.find((entry) => [entry.name, ...entry.aliases].some((alias) => target.includes(normalize(alias)) || normalize(alias).includes(target)));
}

export function enrichProductFromCatalog<T extends Partial<MonitoredProduct>>(product: T): T {
  const entry = product.name ? findCatalogEntry(product.name) : undefined;
  if (!entry) return product;
  const version = product.currentVersion || '*';
  return {
    ...product,
    name: entry.name,
    vendor: product.vendor && product.vendor !== 'Generic' ? product.vendor : entry.vendor,
    category: product.category || entry.category,
    sourceType: product.sourceType && product.sourceType !== 'auto' ? product.sourceType : entry.sourceType,
    repository: product.repository || entry.repository,
    ecosystem: product.ecosystem || entry.ecosystem,
    packageName: product.packageName || entry.packageName,
    cpe: product.cpe || entry.cpeTemplate?.replace('{version}', version),
    vendorReleaseUrl: product.vendorReleaseUrl || entry.vendorReleaseUrl,
  } as T;
}
