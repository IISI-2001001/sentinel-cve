# SentinelCVE 漏洞監控與即時警報系統 (SentinelCVE Security Engine)

企業級資安漏洞監控平台：自動同步全球權威 CVE/NVD/CISA KEV 漏洞資訊、透過 NVD CPE 對照比對資產版本與已知弱點，並提供 MS Teams Webhook、全域 Email (SMTP) 即時警報與自動化處置工單聯防。

---

## 📖 目錄 (Table of Contents)

1. [系統核心功能概覽](#-系統核心功能概覽)
2. [前後端系統架構說明](#-前後端系統架構說明)
   - [前端架構 (Frontend)](#前端架構-frontend)
   - [後端架構 (Backend)](#後端架構-backend)
   - [資料流與背景排程 Worker](#資料流與背景排程-worker)
3. [環境變數配置 (Environment Variables)](#-環境變數配置-environment-variables)
4. [Docker 容器化與建構說明](#-docker-容器化與建構說明)
   - [多階段建構 Dockerfile](#多階段建構-dockerfile)
   - [Docker Compose 服務配置](#docker-compose-服務配置)
5. [Docker 部署、建置與重建指令指南](#-docker-部署建置與重建指令指南)
   - [本地非容器化開發 (Local Dev)](#1-本地非容器化開發-local-dev)
   - [使用 Docker Compose 一鍵啟動](#2-使用-docker-compose-一鍵啟動)
   - [使用 Docker CLI 手動建置與執行](#3-使用-docker-cli-手動建置與執行)
   - [完整容器重建與更新流程 (Rebuild Workflow)](#4-完整容器重建與更新流程-rebuild-workflow)
   - [日誌查看與健康檢查 (Logs & Health check)](#5-日誌查看與健康檢查-logs--health-check)

---

## 🌟 系統核心功能概覽

* **四大多維度管控頁面**：
  * **總覽儀表板 (Dashboard)**：全站受監控資產、警報數量、CISA KEV 警告、CVSS 分數統計圖表與即時 Feed 檢視。
  * **專案管理與工單中心 (Project Manager)**：專案團隊維護、產品版本與升級對照表 (Upgrade Matrix)、資安處置工單看板。
  * **系統管理與設定中心 (System Manager)**：集中管理「⏱️ 自動排程」、「📦 產品管理（`product_cpe_cache` 全域產品目錄，含 NVD CPE 自動/手動查詢與定期刷新）」、「🏢 組織清單管理」、「🔑 NVD API Key 管理」、「🗄️ 資料庫連線管理」、「✉️ 全域 Email SMTP」與「📋 系統稽核日誌」共 6 個分頁；MS Teams Webhook 通報已改為於各專案內個別設定（見「專案管理」的 Teams Webhook 頁籤），非系統管理的全域分頁。
    - `MailService`/`EmailConfigController` 為通用 SMTP 實作，不依賴任何特定郵件服務商；若公司內部郵件系統（如 Outlook/Exchange）無法申請 SMTP relay 或 Azure AD App Registration 權限，可改用第三方 SMTP 中繼服務（如 Brevo、SendGrid）取代，**完全不需修改程式碼**，僅需於此頁面更換 SMTP 主機/連接埠/帳密並以「SMTP 連線測試」驗證。詳細方案比較與設定步驟請參閱 [`EMAIL_SMTP_GUIDE.md`](EMAIL_SMTP_GUIDE.md)。
  * **系統說明與專業名詞手冊 (Documentation)**：完整收錄 CVE/CPE/CVSS 名詞解釋、NVD/CISA KEV/OSV/EPSS 權威數據源說明、4 種弱點查找與派單 SOP、自動化聯防管道與 FAQ。
* **NVD CPE 對照引擎**：
  * 依產品名稱自動向 NVD CPE Dictionary 查詢並快取對應的 vendor:product CPE 識別碼（版本以萬用字元表示），供資產版本比對使用。
  * 可設定 NVD API Key 以提升呼叫速率上限（無 Key 約 5 requests/30s，有 Key 約 50 requests/30s），未設定時以匿名方式呼叫。
  * 支援獨立的 **CPE 對照自動更新排程**（於「系統管理 > ⏱️ 自動排程」設定間隔），定期重新查詢已快取產品是否有新發布的 CPE 識別碼；亦可於「產品管理」頁面手動觸發「確認所有產品是否有新 CPE」立即檢查。
* **全域產品目錄與專案套用產品（雙層架構）**：
  * `product_cpe_cache` 是「所有客戶/專案可能用到的產品」全域目錄，於「系統管理 > 📦 產品管理」統一維護，每個產品皆有定期（或手動觸發）向 NVD 刷新的 CPE 對照候選清單（同一產品名稱在 NVD CPE 字典中常對應到多個不同 vendor 的候選 CPE）。
  * 每個專案再透過「使用產品清單」頁籤（表格呈現）從全域產品目錄挑選要套用的產品，「選擇監控產品」下拉選單僅顯示產品名稱（不顯示特定 vendor，因掃描已涵蓋該產品名稱下所有 vendor），並各自指定該專案專屬的「目標套用版本號」、「部署環境」（必填）與備註（`Project.productBindings`），因此同一個全域產品可被不同專案各自套用不同版本；**新增套用後，「產品」與「部署環境」即鎖定不可再變更**，僅能編輯版本號/備註/掃描設定，如需更換產品或環境須先移除該筆套用後重新新增。
  * **CVE 掃描以「專案套用」為單位執行，且會查詢該產品名稱下所有已知 vendor 的 CPE**：由於同一產品名稱可能對應多個不同 vendor 的 CPE 識別碼（例如專案實際部署的版本是由另一家 vendor 發行），掃描時會取出該產品名稱快取的**所有非 deprecated 候選 CPE**，各自代入專案指定的目標版本組成精確 CPE，逐一查詢 NVD 並依 CVE ID 去重合併（查詢間有短暫延遲以避免觸發 NVD API rate limit），避免因只查詢單一 vendor 而漏掉其他 vendor 底下的已知漏洞；若該產品名稱尚無候選 CPE 快取，則退回使用綁定時記錄的單一代表性 CPE 查詢。掃描結果、偵測漏洞數與告警計數皆各自記錄在該筆專案套用（binding）上，而非全域產品層級；可於「使用產品清單」頁籤對單一套用產品按「立即掃描」，或由背景排程/手動觸發全站巡檢所有專案的套用產品。系統管理「受監控產品」的全域掃描亦套用相同的多 vendor 查詢邏輯。
* **組織清單管理（使用者清單）**：於「系統管理 > 🏢 組織清單管理」維護「所屬部門」與「使用者」兩份全域名單，每位使用者可填寫 Email；「專案管理」的新增/編輯專案表單以下拉選單方式選取專案經理（避免手動輸入造成名稱不一致），而有填寫 Email 的使用者同時會出現在各專案「通知管道與頻率設定」頁籤的 Email 收件人勾選清單中。
* **專案部署環境清單**：每個專案在專案詳情頁面內有獨立的「部署環境設定」頁籤（與「使用產品清單」頁籤分開呈現），可自行維護「部署環境」清單（新建專案預設 DEV/SIT/UAT/PRD，可依專案需求動態新增/移除），供該專案的產品版本套用表單使用；因不同客戶/專案所需環境不同，此清單刻意採「專案層級」維護，不設於系統管理的全域設定。
* **自動閉環聯防與告警**：
  * 支援排程定時自動比對資產、自動生成資安處置工單。
  * 每個專案的「通知管道與頻率設定」頁籤可分別設定並獨立啟用/停用兩種通知管道：**Teams Webhook**（單一 URL 欄位 + 啟用開關，無需清空 URL 即可暫停通知）與 **Email 通知**（啟用開關 + 從「使用者清單」中勾選實際收件人）；兩者互不依賴，即使其中一種未設定，另一種仍會正常發送。自動排程與「立即發送」手動觸發皆會依此設定同時（或分別）寄出 Teams Webhook 訊息與 Email 通知信。四組啟用開關（產品版本更新通知／CVE 漏洞通知／Teams Webhook／Email 通知）皆改為與「系統管理 \ 自動排程設定」一致的 toggle switch 樣式。
  * 畫面不再每 10 秒自動輪詢刷新（避免使用者輸入中的表單內容被意外清空），改為於各項新增/編輯操作後立即局部刷新，並於頁首提供手動「重新整理」按鈕供主動取得最新資料（例如查看背景排程剛完成的結果或他人協作異動）。
  * **新增專案後，「產品版本更新通知」「CVE 漏洞通知」「Teams Webhook」「Email 通知」四個開關預設皆為停用**，需使用者於「通知管道與頻率設定」頁籤手動開啟後才會開始背景檢查/發送通知（既有專案的設定狀態不受影響）。其中「產品版本更新通知」「CVE 漏洞通知」預設停用時，代表該專案連背景自動檢查都不會執行，並非僅停用通知。

---

## 🏗️ 前後端系統架構說明

SentinelCVE 採用 **Full-Stack (Java 21/Spring Boot 3 + React/Vite)** 一體化架構。前端開發時透過 Vite dev server 提供熱重載；生產環境則由 Multi-stage Dockerfile 建置 Vite 靜態檔案並打包進 Spring Boot 的可執行 Fat Jar (`sentinel-cve-server.jar`)，由內建 Tomcat 同時提供 REST API 與前端靜態資源。

```
                       ┌─────────────────────────────────────────────────┐
                       │          Client Browser (User Interface)        │
                       └────────────────────────┬────────────────────────┘
                                                │
                                    REST API / HTTP (Port 3000 → 8080)
                                                │
                       ┌────────────────────────▼────────────────────────┐
                       │   Spring Boot App (sentinel-cve-server.jar)     │
                       ├─────────────────────────────────────────────────┤
                       │  • Embedded Tomcat & Static Asset Handler       │
                       │  • RESTful API Controllers (/api/*)             │
                       │  • Background Scheduler (@Scheduled, 30s tick)  │
                       └───────────┬─────────────┬───────────────────────┘
                                   │             │
                       ┌───────────▼──┐   ┌──────▼──────────────────────┐
                       │  PostgreSQL   │   │      External APIs          │
                       │ (Application  │   ├──────────────────────────────
                       │  State Store) │   │ • NIST NVD API v2.0 / CPE Dictionary
                       └───────────────┘   │ • CISA KEV Feed
                                           │ • FIRST EPSS / OSV.dev
                                           │ • MS Teams Webhook
                                           │ • Enterprise SMTP Server
                                           └──────────────────────────────
```

### 前端架構 (Frontend)

* **核心技術**：React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Motion (Framer Motion).
* **模組劃分 (`/src/components/`)**：
  * `App.tsx`：應用程式主要進入點，控管頂部導覽列狀態、數據載入與全局 Modal 狀態。
  * `Navbar.tsx`：頂部導覽列，提供 4 大頁面切換、即時全站掃描按鈕與未讀警報通知 Dropdown。
  * `Dashboard.tsx`：總覽儀表板，提供核心 KPI 數據、風險指數圓餅圖與最新監控 Feed。
  * `ProjectManager.tsx`：專案管理、產品升級版本矩陣對照表、處置工單 Kanban 看板。專案詳情頁面分為 6 個頁籤：1. 專案基本資訊、2. 部署環境設定、3. 使用產品清單（表格，含新增/掃描/移除套用產品）、4. 通知管道與頻率設定、5. 產品版本與升級對照、6. 專案資產弱點列表。
  * `SystemManager.tsx`：系統整合管理大廳，收納排程設定、監控資產產品、CPE 對照管理、組織清單管理、NVD API Key 管理、資料庫連線管理、SMTP 郵件伺服器、Teams Webhook 與稽核日誌。
  * `CpeManager.tsx` (嵌入於 SystemManager)：管理 `product_cpe_cache` 資料表，可從 NVD 重新查詢/刷新、手動新增編輯或刪除各產品對應的 CPE 識別碼，並可一鍵批次檢查所有已儲存產品是否有新發布的 CPE。
  * `OrgDirectoryManager.tsx` (嵌入於 SystemManager)：維護「所屬部門」與「使用者」清單（使用者含姓名與可編輯的 Email），供「專案管理」新增/編輯專案表單選取專案經理，以及各專案 Email 通知收件人勾選使用。
  * `NvdApiKeyManager.tsx` (嵌入於 SystemManager)：設定並測試呼叫 NVD REST API 用的 API Key。
  * `DbConnectionManager.tsx` (嵌入於 SystemManager)：設定/測試後端連線的 PostgreSQL 主機資訊，設定值寫入後端本機檔案，優先於環境變數，儲存後需重新啟動後端服務。
  * `SystemLogs.tsx` (嵌入於 SystemManager)：系統操作與排程稽核軌跡 Audit Log。
  * `Documentation.tsx`：完整系統文件與互動式專業名詞對照。
  * `CveDetailModal.tsx` / `TicketDetailModal.tsx`：CVE 漏洞威脅剖析與工單詳細內容與 Email 測試發送 Modal。

### 後端架構 (Backend)

* **核心技術**：Java 21, Spring Boot 3 (Web / JDBC / Async / Scheduling), Maven, **PostgreSQL 16 (`postgresql` JDBC driver + HikariCP)**。
* **模組劃分 (`java-backend/src/main/java/com/sentinelcve/`)**：
  * `controller/*`：REST API endpoints（`/api/dashboard/stats`, `/api/cves`, `/api/cves/scan`, `/api/products`, `/api/projects`, `POST /api/projects/{id}/bindings/{productId}/scan`（針對單一專案套用產品即時觸發 CVE 掃描）, `/api/tickets`, `/api/schedule/*`, `/api/system/*`, `/api/system/db-config`, `/api/cpe-cache/*`, `/api/nvd/*`, `/api/org-directory/*` 等）。
  * `service/*`：核心業務邏輯，包含 `ScanService`（NVD/OSV 檢索與版本比對；掃描單一專案套用產品時，會依產品名稱取出快取的所有非 deprecated 候選 CPE 逐一查詢 NVD 並依 CVE ID 去重合併，涵蓋不同 vendor 提供的同名產品，查詢間有延遲避免觸發 rate limit，無候選快取時退回單一代表性 CPE 查詢）、`ProductProviderService`（NVD CPE 查詢；「受監控產品」全域掃描亦採相同的多候選 CPE 去重合併邏輯）、`CpeCacheService`（批次檢查已快取產品是否有新發布 CPE，供手動觸發與排程共用）、`MailService`（動態 SMTP 寄信）、`WebhookDispatchService`（Teams/Slack/自訂 Webhook）、`AlertRuleEngineService`（告警規則引擎）、`SchedulerService`（`@Scheduled` 背景排程，含掃描排程與 CPE 對照自動更新排程）、`ProjectDigestService`（專案摘要通知）。
  * `db/PersistenceRepository.java` + `config/DataSourceConfig.java`：應用程式狀態（監控產品、CVE 資料庫、警報規則、通知、Webhook、稽核日誌、專案、工單、CPE 快取、NVD/Email/Teams/排程設定）全部以 PostgreSQL 儲存，每個集合對應一張資料表，主要欄位另外抽出做索引（如 `severity`、`cisa_kev`、`status`），完整物件則存於 `data JSONB` 欄位（透過 `PGobject` 序列化），服務啟動時整批載入記憶體、每次異動即以 `@Async` 方式整批寫回資料庫（Transaction 包裹，確保一致性）。另有 `product_cpe_cache`、`departments`、`project_managers` 三張獨立維運表格，採一般欄位（非 JSONB）直接 CRUD，不隨 AppState 整批快照寫回，供「CPE 對照管理」與「組織清單管理」頁面即時查詢/新增/刪除使用；部署環境則不建立獨立全域資料表，而是以 `deploymentEnvironments` 欄位存於各專案自身的 JSONB 物件中（新建專案預設 seed `DEV`/`SIT`/`UAT`/`PRD`），確保每個專案可獨立維護自己的部署環境清單。
  * `model/*`：與前端 `src/types.ts` 對應之 Java Model（Jackson camelCase 序列化）。

### 資料流與背景排程 Worker

* **Background Scheduler Engine**：
  * `SchedulerService` 以 Spring 的 `@Scheduled(fixedDelay = 30000)` 註解實作，每 30 秒執行一次背景輪詢。
  * **全域系統自動排程**：可在「系統管理 > ⏱️ 自動排程」頁面靈活調整全域掃描週期（**15 分鐘、30 分鐘、1 小時、6 小時、24 小時**）與掃描資產範疇（全部資產 / 僅限 Critical & High），巡迴掃描所有專案已套用的產品（`ProjectProductBinding`）。
  * **個別套用產品獨立週期**：每個專案的每筆產品套用皆可獨立設定 `autoScanEnabled`／`scanIntervalMinutes`（預設 1440 分鐘），不受其他專案或其他套用影響。
  * **CPE 對照自動更新排程**：獨立於上述弱點掃描排程，可在「系統管理 > ⏱️ 自動排程」另外設定間隔（**6 小時、12 小時、24 小時、每週**），定期重新向 NVD 查詢已快取產品是否有新發布的 CPE 識別碼並自動更新快取；同一邏輯也可在「產品管理」頁面以「確認所有產品是否有新 CPE」按鈕手動觸發，並各自顯示獨立的上次/下次執行時間。
  * **自動告警與派報**：每當達到排程時間，背景 Worker 會自動調用 NVD/OSV API 發起弱點檢索；若比對到符合條件的高危漏洞（如 CVSS $\ge$ 7.0），將自動觸發 Teams Webhook 即時推播、發送 Email 通知，並寫入系統 Audit Log。

---

## 🔑 環境變數配置 (Environment Variables)

請於專案根目錄參考 `.env.example` 建立 `.env` 檔案：

```env
# NVD API Key (選填：用於提升呼叫 NIST NVD REST API 的速率上限，未設定則以匿名方式呼叫)
NVD_API_KEY="your_nvd_api_key_here"

# 服務執行埠號 (容器內部埠號，預設為 8080；對外仍以 3000 訪問)
PORT=8080

# 應用程式對外網址
APP_URL="http://localhost:3000"

# PostgreSQL 連線字串 (應用程式狀態資料庫：產品、CVE、工單、專案、日誌等)
# 使用 docker-compose 時會自動組裝好，僅在連接外部/既有 PostgreSQL 時才需覆寫。
DATABASE_URL="postgres://sentinel:sentinel@localhost:5432/sentinel_cve"
POSTGRES_USER="sentinel"
POSTGRES_PASSWORD="sentinel"
POSTGRES_DB="sentinel_cve"
```

> 💡 也可以在啟動後改由「系統管理 > 🗄️ 資料庫連線管理」頁面設定/切換 PostgreSQL 連線，設定值會寫入後端本機檔案 `java-backend/config/db.properties`（Docker 部署時建議掛載為具名 volume 以持久化），其優先權高於 `DATABASE_URL` 環境變數；儲存後需重新啟動後端服務（或 `docker compose restart sentinel-cve`）才會套用。

---

## 🐳 Docker 容器化與建構說明

本專案提供符合資安規範與效能最佳化的 Dockerfile 與 Docker Compose 配置。

### 多階段建構 Dockerfile

Dockerfile (`java-backend/Dockerfile`) 採用三階段建構 (Multi-stage Build)：
1. **Stage 1 (`frontend`)**：使用 `node:20-alpine` 安裝前端依賴並執行 `npm run build`，產出 Vite 靜態檔案 (`dist/`)。
2. **Stage 2 (`backend`)**：使用 `maven:3.9-eclipse-temurin-21`，將 Stage 1 產出的靜態檔案複製進 `src/main/resources/static`，再執行 `mvn clean package` 打包成單一 Fat Jar (`sentinel-cve-server.jar`)。
3. **Stage 3 (runtime)**：使用純淨 `eclipse-temurin:21-jre-alpine`，僅複製最終 Jar 檔案，以 `ENTRYPOINT ["java","-jar","/app/app.jar"]` 啟動，`EXPOSE 8080`，體積精簡且不含建構工具鏈。

### Docker Compose 服務配置

`docker-compose.yml` 內含 `postgres`（PostgreSQL 16，資料存於具名 volume `pgdata`，並以 `pg_isready` 做健康檢查）與 `sentinel-cve`（Spring Boot 應用程式，`depends_on` 等待資料庫健康後才啟動）兩個服務：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: sentinel-cve-db
    restart: always
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-sentinel}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-sentinel}
      - POSTGRES_DB=${POSTGRES_DB:-sentinel_cve}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-sentinel} -d ${POSTGRES_DB:-sentinel_cve}"]
      interval: 10s
      timeout: 5s
      retries: 5

  sentinel-cve:
    build:
      context: .
      dockerfile: java-backend/Dockerfile
    container_name: sentinel-cve-app
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:8080"
    environment:
      - PORT=8080
      - NVD_API_KEY=${NVD_API_KEY:-}
      - DATABASE_URL=postgres://${POSTGRES_USER:-sentinel}:${POSTGRES_PASSWORD:-sentinel}@postgres:5432/${POSTGRES_DB:-sentinel_cve}
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:8080/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  pgdata:
```

---

## 🛠️ Docker 部署、建置與重建指令指南

### 1. 本地非容器化開發 (Local Dev)

如果您希望直接在主機上執行，需先準備一個可連線的 PostgreSQL，以下三種方式擇一即可：

**方式 A：使用 Docker 快速啟動一個本機測試用 PostgreSQL 容器**

```bash
docker run -d --name sentinel-cve-db -p 5432:5432 \
  -e POSTGRES_USER=sentinel -e POSTGRES_PASSWORD=sentinel -e POSTGRES_DB=sentinel_cve \
  postgres:16-alpine
```

**方式 B：使用 Vagrant VM（無 Docker Desktop 環境時的替代方案，本機開發實際採用）**

本專案在 `sentinel-cve-db/`（未納入版本控制，需自行建立或已存在於本機）提供一份獨立的 `Vagrantfile`，會啟動一台 Rocky Linux 9 VM，並在 VM 內以 Docker 執行 PostgreSQL 16 容器，固定以私有網路 IP `192.168.100.20:5432` 對外提供連線，不需佔用/依賴主機上的 Docker：

```bash
cd sentinel-cve-db

# 首次啟動（會自動下載 box、開機、於 VM 內安裝 Docker 並啟動 Postgres 容器）
vagrant up

# 之後每次要用本機資料庫時，皆執行 vagrant up 即可（VM 內 Postgres 容器為 --restart always，隨 VM 開機自動啟動）
# 確認狀態
vagrant status

# 不使用時可關機釋放資源
vagrant halt
```

啟動後將 `DATABASE_URL` 指向該 VM 位址，例如：`postgres://sentinel:sentinel@192.168.100.20:5432/sentinel_cve`。

**方式 C：連接既有/外部 PostgreSQL**

直接於 `.env` 或環境變數設定既有 PostgreSQL 主機的 `DATABASE_URL`。

準備好資料庫連線後，先建立本機環境變數檔（若尚未建立過）：

```bash
cp .env.example .env
```

再編輯 `.env`，依您選擇的方式設定 `DATABASE_URL`（格式為 `postgres://<帳號>:<密碼>@<主機>:<Port>/<資料庫名稱>`）：
- 方式 A（本機 Docker 容器）：`.env.example` 內的預設值即可直接使用，無需修改。
- 方式 B（Vagrant VM）：需將主機部分改為 VM 的私有網路 IP `192.168.100.20`（Port 仍為 `5432`）。
- 方式 C（既有/外部 PostgreSQL）：改為該主機的實際連線資訊。

接續啟動前後端：

```bash
# 前端：安裝套件並啟動 Vite dev server（熱重載，預設 5173）
npm install
npm run dev

# 後端：另開一個終端機，啟動 Spring Boot（需 Java 21 + Maven）
# 會自動讀取專案根目錄的 .env；若未建立 .env，也可改用 export 設定環境變數
cd java-backend
mvn spring-boot:run
```

後端啟動於 `http://localhost:8080`，會自動建立所需的資料表 (`CREATE TABLE IF NOT EXISTS`)，無需另外執行 migration。開發模式下前端 Vite dev server 與後端 API 為分離埠號，請自行設定 Vite proxy 或直接呼叫 `http://localhost:8080/api/*`。

> 💡 **快速驗證**：前端載入後，若總覽儀表板（Dashboard）出現「資料庫未連線」提示 banner，代表後端無法連上 PostgreSQL，請依序檢查：(1) 資料庫本身是否已啟動（`docker ps` 或 `vagrant status`）、(2) `.env` 的 `DATABASE_URL` 主機/Port 是否正確、(3) 修改 `.env` 後是否已重新啟動後端服務（Spring Boot 只會在啟動時讀取一次環境變數）。

---

### 2. 使用 Docker Compose 一鍵啟動

建議之標準正式部署方式：

```bash
# 1. 複製並設定環境變數
cp .env.example .env
# 請編輯 .env 填入 NVD_API_KEY（選填，可提升 NVD API 呼叫速率上限）

# 2. 啟動建置並背景執行容器
docker-compose up -d --build
```

訪問 `http://localhost:3000` 即可登入使用。

---

### 3. 使用 Docker CLI 手動建置與執行

若不使用 Docker Compose，可直接透過 `docker` 命令操作，但需自行先啟動一個 PostgreSQL 並建立共用網路：

```bash
# 建立共用網路，並啟動 PostgreSQL 容器
docker network create sentinel-net
docker run -d --name sentinel-cve-db --network sentinel-net \
  -e POSTGRES_USER=sentinel -e POSTGRES_PASSWORD=sentinel -e POSTGRES_DB=sentinel_cve \
  -v sentinel-cve-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# 建置 Docker 映像檔（使用 java-backend/Dockerfile）
docker build -f java-backend/Dockerfile -t sentinel-cve:latest .

# 執行容器 (帶入 NVD_API_KEY 與 DATABASE_URL)
docker run -d \
  --name sentinel-cve-app \
  --network sentinel-net \
  -p 3000:8080 \
  -e NVD_API_KEY="your_nvd_api_key_here" \
  -e PORT=8080 \
  -e DATABASE_URL="postgres://sentinel:sentinel@sentinel-cve-db:5432/sentinel_cve" \
  --restart always \
  sentinel-cve:latest
```

---

### 4. 完整容器重建與更新流程 (Rebuild Workflow)

當程式碼更新或設定變更，需要進行升級重建時，請執行以下步驟：

```bash
# 步驟 1: 停止並移除舊有容器與網路
docker-compose down

# 步驟 2: 強制重新建置映像檔並啟動容器
docker-compose up -d --build --force-recreate

# (可選) 清除舊有未使用的 Docker 快取與 Build 殘留
docker image prune -f
```

---

### 5. 日誌查看與健康檢查 (Logs & Health check)

**查看即時應用程式與背景排程日誌**：
```bash
docker-compose logs -f sentinel-cve
```

**確認容器健康狀態 (Health status)**：
```bash
docker inspect --format='{{json .State.Health}}' sentinel-cve-app
```

**手動測試健康檢查 Endpoint**：
```bash
curl -I http://localhost:3000/api/health
```
若回傳 `HTTP/1.1 200 OK` 且包含 `{"status":"ok"}` 即代表服務正常運作！
