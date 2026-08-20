package com.sentinelcve.catalog;

import com.sentinelcve.model.MonitoredProduct;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Java port of src/server/productCatalog.ts. */
public final class ProductCatalog {

    private ProductCatalog() {
    }

    @Getter
    public static class Entry {
        private final String id;
        private final String name;
        private final List<String> aliases;
        private final String vendor;
        private final String category;
        private final String sourceType;
        private final String repository;
        private final String ecosystem;
        private final String packageName;
        private final String cpeTemplate;
        private final String vendorReleaseUrl;
        private final String note;

        Entry(String id, String name, List<String> aliases, String vendor, String category, String sourceType,
              String repository, String ecosystem, String packageName, String cpeTemplate, String vendorReleaseUrl, String note) {
            this.id = id;
            this.name = name;
            this.aliases = aliases;
            this.vendor = vendor;
            this.category = category;
            this.sourceType = sourceType;
            this.repository = repository;
            this.ecosystem = ecosystem;
            this.packageName = packageName;
            this.cpeTemplate = cpeTemplate;
            this.vendorReleaseUrl = vendorReleaseUrl;
            this.note = note;
        }
    }

    private static Entry e(String id, String name, List<String> aliases, String vendor, String category, String sourceType) {
        return new Entry(id, name, aliases, vendor, category, sourceType, null, null, null, null, null, null);
    }

    public static final List<Entry> CATALOG = List.of(
        new Entry("vertica", "Vertica", List.of("vertica db"), "OpenText", "Database", "vendor",
            null, null, null, "cpe:2.3:a:vertica:vertica_analytics_platform:{version}:*:*:*:*:*:*:*",
            "https://docs.vertica.com/latest/en/", "來源為 OpenText Vertica 最新版文件。"),
        new Entry("postgresql", "PostgreSQL", List.of("postgres", "pgsql"), "PostgreSQL Global Development Group", "Database", "postgresql",
            null, null, null, "cpe:2.3:a:postgresql:postgresql:{version}:*:*:*:*:*:*:*",
            "https://www.postgresql.org/docs/release/", null),
        new Entry("sql-server", "Microsoft SQL Server", List.of("sql server", "mssql"), "Microsoft", "Database", "vendor",
            null, null, null, "cpe:2.3:a:microsoft:sql_server:{version}:*:*:*:*:*:*:*",
            "https://learn.microsoft.com/en-us/troubleshoot/sql/releases/download-and-install-latest-updates", null),
        new Entry("oracle-db", "Oracle Database", List.of("oracle db", "oracle database"), "Oracle", "Database", "vendor",
            null, null, null, "cpe:2.3:a:oracle:database:{version}:*:*:*:*:*:*:*",
            "https://www.oracle.com/database/technologies/oracle-database-software-downloads.html", null),
        new Entry("mysql", "MySQL", List.of("mysql server"), "Oracle", "Database", "vendor",
            null, null, null, "cpe:2.3:a:oracle:mysql:{version}:*:*:*:*:*:*:*",
            "https://dev.mysql.com/downloads/mysql/", null),
        new Entry("windows", "Microsoft Windows", List.of("windows desktop", "windows 11"), "Microsoft", "Operating System", "vendor",
            null, null, null, "cpe:2.3:o:microsoft:windows_11:{version}:*:*:*:*:*:*:*",
            "https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information",
            "請以實際 Windows 產品與 feature version 調整完整 CPE。"),
        new Entry("windows-server", "Windows Server", List.of("microsoft windows server"), "Microsoft", "Operating System", "vendor",
            null, null, null, "cpe:2.3:o:microsoft:windows_server_2025:{version}:*:*:*:*:*:*:*",
            "https://learn.microsoft.com/en-us/windows-server/get-started/windows-server-release-info", null),
        new Entry("vmware-esxi", "VMware ESXi", List.of("vmware", "esxi"), "VMware by Broadcom", "Container/Cloud", "vendor",
            null, null, null, "cpe:2.3:o:vmware:esxi:{version}:*:*:*:*:*:*:*",
            "https://knowledge.broadcom.com/external/article/316595/build-numbers-and-versions-of-vmware-esx.htm", null),
        new Entry("vcenter", "VMware vCenter Server", List.of("vcenter"), "VMware by Broadcom", "Container/Cloud", "vendor",
            null, null, null, "cpe:2.3:a:vmware:vcenter_server:{version}:*:*:*:*:*:*:*",
            "https://knowledge.broadcom.com/external/article/326316/build-numbers-and-versions-of-vcenter-s.html", null),
        new Entry("vsphere", "VMware vSphere", List.of("vsphere"), "VMware by Broadcom", "Container/Cloud", "vendor",
            null, null, null, "cpe:2.3:a:vmware:vsphere:{version}:*:*:*:*:*:*:*",
            "https://knowledge.broadcom.com/external/article/316595/build-numbers-and-versions-of-vmware-esx.htm", null),
        new Entry("kong", "Kong Gateway", List.of("kong"), "Kong Inc.", "Application", "github",
            "Kong/kong", null, null, "cpe:2.3:a:konghq:kong:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("denodo", "Denodo Platform", List.of("denodo"), "Denodo", "Application", "vendor",
            null, null, null, "cpe:2.3:a:denodo:denodo_platform:{version}:*:*:*:*:*:*:*",
            "https://community.denodo.com/new-release/", null),
        new Entry("pentaho", "Pentaho Data Integration", List.of("pentaho", "kettle"), "Hitachi Vantara", "Application", "vendor",
            null, null, null, "cpe:2.3:a:hitachivantara:pentaho_business_analytics:{version}:*:*:*:*:*:*:*",
            "https://docs.pentaho.com/install", null),
        new Entry("apache-hop", "Apache Hop", List.of("hop"), "Apache Software Foundation", "Application", "github",
            "apache/hop", null, null, "cpe:2.3:a:apache:hop:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("trinity", "Trinity Data Integration Platform", List.of("trinity", "trinity etl", "trinity data integration"),
            "NetPro Information Service", "Application", "vendor",
            null, null, null, null, "https://www.netpro.com.tw/2022-03-02/",
            "網擎資訊 Trinity ETL／Data Integration Platform；公開支援公告目前可驗證的受支援版本線為 4.1。"),
        new Entry("tableau", "Tableau Server", List.of("tableau"), "Salesforce", "Application", "vendor",
            null, null, null, "cpe:2.3:a:tableau:tableau_server:{version}:*:*:*:*:*:*:*",
            "https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm", null),
        new Entry("power-bi", "Microsoft Power BI Desktop", List.of("powerbi", "power bi"), "Microsoft", "Application", "vendor",
            null, null, null, "cpe:2.3:a:microsoft:power_bi:{version}:*:*:*:*:*:*:*",
            "https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-latest-update-archive", null),
        new Entry("virtualbox", "Oracle VM VirtualBox", List.of("virtualbox"), "Oracle", "Container/Cloud", "vendor",
            null, null, null, "cpe:2.3:a:oracle:vm_virtualbox:{version}:*:*:*:*:*:*:*",
            "https://www.virtualbox.org/wiki/Downloads", null),
        new Entry("python", "Python", List.of("python runtime"), "Python Software Foundation", "Framework/Library", "vendor",
            null, null, null, "cpe:2.3:a:python:python:{version}:*:*:*:*:*:*:*",
            "https://www.python.org/downloads/", null),
        new Entry("git", "Git", List.of("git scm"), "Git Project", "Application", "github",
            "git/git", null, null, "cpe:2.3:a:git-scm:git:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("gitlab", "GitLab", List.of("gitlab ce", "gitlab ee"), "GitLab", "Application", "vendor",
            null, null, null, "cpe:2.3:a:gitlab:gitlab:{version}:*:*:*:*:*:*:*",
            "https://about.gitlab.com/releases/categories/releases/", null),
        new Entry("airflow", "Apache Airflow", List.of("airflow"), "Apache Software Foundation", "Framework/Library", "github",
            "apache/airflow", "PyPI", "apache-airflow", "cpe:2.3:a:apache:airflow:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("redis", "Redis", List.of("redis server"), "Redis", "Database", "github",
            "redis/redis", null, null, "cpe:2.3:a:redis:redis:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("apache-httpd", "Apache HTTP Server", List.of("apache", "httpd"), "Apache Software Foundation", "Web Server", "github",
            "apache/httpd", null, null, "cpe:2.3:a:apache:http_server:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("tomcat", "Apache Tomcat", List.of("tomcat"), "Apache Software Foundation", "Web Server", "github",
            "apache/tomcat", null, null, "cpe:2.3:a:apache:tomcat:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("notepad-plus-plus", "Notepad++", List.of("notepad++", "notepad plus plus"), "Don Ho", "Application", "github",
            "notepad-plus-plus/notepad-plus-plus", null, null, "cpe:2.3:a:notepad-plus-plus:notepad\\+\\+:{version}:*:*:*:*:*:*:*", null, null),
        new Entry("7zip", "7-Zip", List.of("7zip", "7-zip"), "Igor Pavlov", "Application", "vendor",
            null, null, null, "cpe:2.3:a:7-zip:7-zip:{version}:*:*:*:*:*:*:*",
            "https://www.7-zip.org/download.html", null),
        new Entry("rhel", "Red Hat Enterprise Linux", List.of("redhat", "red hat", "rhel"), "Red Hat", "Operating System", "vendor",
            null, null, null, "cpe:2.3:o:redhat:enterprise_linux:{version}:*:*:*:*:*:*:*",
            "https://access.redhat.com/articles/3078", null),
        new Entry("rocky-linux", "Rocky Linux", List.of("rocky", "rocky linux"), "Rocky Enterprise Software Foundation", "Operating System", "vendor",
            null, null, null, "cpe:2.3:o:rocky:rocky_linux:{version}:*:*:*:*:*:*:*",
            "https://rockylinux.org/download", null),
        new Entry("ubuntu", "Ubuntu", List.of("ubuntu linux"), "Canonical", "Operating System", "vendor",
            null, null, null, "cpe:2.3:o:canonical:ubuntu_linux:{version}:*:*:*:*:*:*:*",
            "https://ubuntu.com/about/release-cycle", null)
    );

    private static String normalize(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9+#]+", " ").trim();
    }

    public static Optional<Entry> findCatalogEntry(String name) {
        String target = normalize(name);
        Optional<Entry> exact = CATALOG.stream()
            .filter(entry -> allNames(entry).stream().anyMatch(alias -> normalize(alias).equals(target)))
            .findFirst();
        if (exact.isPresent()) return exact;
        return CATALOG.stream()
            .filter(entry -> allNames(entry).stream().anyMatch(alias -> {
                String n = normalize(alias);
                return target.contains(n) || n.contains(target);
            }))
            .findFirst();
    }

    private static List<String> allNames(Entry entry) {
        List<String> names = new ArrayList<>();
        names.add(entry.getName());
        names.addAll(entry.getAliases());
        return names;
    }

    public static MonitoredProduct enrichProductFromCatalog(MonitoredProduct product) {
        if (product.getName() == null) return product;
        Optional<Entry> found = findCatalogEntry(product.getName());
        if (found.isEmpty()) return product;
        Entry entry = found.get();
        String version = product.getCurrentVersion() != null && !product.getCurrentVersion().isBlank() ? product.getCurrentVersion() : "*";

        product.setName(entry.getName());
        if (product.getVendor() == null || product.getVendor().equals("Generic")) product.setVendor(entry.getVendor());
        if (product.getCategory() == null) product.setCategory(entry.getCategory());
        if (product.getSourceType() == null || product.getSourceType().equals("auto")) product.setSourceType(entry.getSourceType());
        if (product.getRepository() == null) product.setRepository(entry.getRepository());
        if (product.getEcosystem() == null) product.setEcosystem(entry.getEcosystem());
        if (product.getPackageName() == null) product.setPackageName(entry.getPackageName());
        if (product.getCpe() == null && entry.getCpeTemplate() != null) {
            product.setCpe(entry.getCpeTemplate().replace("{version}", version));
        }
        if (product.getVendorReleaseUrl() == null) product.setVendorReleaseUrl(entry.getVendorReleaseUrl());
        return product;
    }
}
