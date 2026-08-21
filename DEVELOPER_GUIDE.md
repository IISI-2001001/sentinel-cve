# SentinelCVE 開發者技術指南

> 適用於目前工作區程式碼。本文件面向開發、維運與資安工程師，說明模組用途、資料來源、比對邏輯、排程通知、工單關聯、持久化與部署方式。

## 1. 系統概觀

SentinelCVE 是 React/Vite 單頁應用程式與 Java 21 / Spring Boot 3 後端的一體化系統，主要流程為：

1. 建立監控產品與專案，記錄當前版本、CPE/套件識別資訊與專案綁定。
2. 由供應商官網、GitHub Releases、npm、PyPI 等來源取得最新版本。
3. 由 NVD 與 OSV 等來源查找 CVE，再依產品名、CPE、供應商與專案綁定關聯。
4. 依專案獨立的版本/CVE 頻率與 CVSS/KEV 條件，透過 Microsoft Teams Webhook 發送 MessageCard。
5. 將版本或 CVE 派發成修補工單，追蹤 `OPEN`、`IN_PROGRESS`、`RESOLVED`、`CLOSED`、`WAIVED`。
6. `CLOSED` 工單對應的版本/CVE 移入結案區，並從所有後續通知排除。

## 2. 執行架構與資料流

```text
Browser / React
    │  REST JSON（前端每 10 秒同步）
    ▼
Spring Boot app（`java-backend/` / `sentinel-cve-server.jar`）
    │
    ├─ `controller/*` REST Controllers
    │      ▼
    ├─ `service/*` 業務邏輯
    │      ├─ `ScanService` / `AiService` / `TicketService`
    │      ├─ `SchedulerService`（30 秒 tick）
    │      └─ `StateService`（管理 `AppState`）
    │              ▼
    ├─ `db/PersistenceRepository`
    │      ▼
    └─ PostgreSQL（每集合一張表，`data JSONB`；啟動時載入 `AppState`，異動後非同步寫回）
```

生產模式中 Spring Boot 內建 Tomcat 同時提供 `/api/*` 與打包進 Jar 的前端靜態資源。開發模式通常以前端 Vite dev server（5173）與後端 Spring Boot（8080）分離埠號運作；後端啟動時會由 `SentinelCveApplication` 的 `CommandLineRunner` 呼叫 `stateService.initAndLoad()`，先完成 PostgreSQL 初始化與狀態載入。

## 3. 檔案與程式用途

| 檔案 | 用途 |
|---|---|
| `src/main.tsx` | React DOM 啟動點，將 `App` 掛載至 HTML root。 |
| `src/App.tsx` | 前端最上層狀態、頁面導覽、API 資料整合；每 10 秒重載產品、專案、CVE、警報與日誌。 |
| `src/types.ts` | 前後端共用 TypeScript 型別，包含 CVE、產品、專案、通知、AI、工單與排程。 |
| `src/data/initialData.ts` | 前端示範/初始資料常數；供 UI 與型別開發參考，非正式後端持久化來源。 |
| `src/components/Navbar.tsx` | 頂部導覽、掃描快捷鍵、未讀警報與 CVE 開啟。 |
| `src/components/Dashboard.tsx` | 總覽 KPI、弱點分佈、重點產品狀態、最新 CVE/Alert feed。 |
| `src/components/ProjectManager.tsx` | 專案 CRUD、產品綁定、版本矩陣、CVE 清單、獨立通知頻率、Teams Webhook、手動通知、工單生命週期與結案區。 |
| `src/components/ProductManager.tsx` | 產品新增/編輯/刪除、目前版本、識別欄位、單筆/批次版本檢查。 |
| `src/components/SystemManager.tsx` | 全域掃描排程、監控產品、稽核日誌、AI/LLM 設定。Teams Webhook 正式流程不在此設定，而在各專案設定。 |
| `src/components/SystemLogs.tsx` | 稽核日誌顯示、狀態與類型篩選。 |
| `src/components/CveDetailModal.tsx` | CVE 詳細資訊、CVSS vector、KEV、參考連結與 AI 剖析。 |
| `src/components/TicketDetailModal.tsx` | 工單詳情、狀態變更與 Markdown 匯出。 |
| `src/components/Documentation.tsx` | 系統內建使用手冊、名詞、資料來源、SOP、流程與 FAQ。 |
| `src/index.css` | Tailwind CSS 入口與全域視覺樣式。 |
| `vite.config.ts` | React/Tailwind Vite plugin、開發建置設定。 |
| `tsconfig.json` | TypeScript 編譯與型別檢查設定。 |
| `index.html` | SPA HTML shell。 |
| `java-backend/pom.xml` | Maven 專案定義；管理 Spring Boot、JDBC、Mail、PostgreSQL 等相依。 |
| `java-backend/Dockerfile` | 三階段建置：`node:20-alpine` 建前端、`maven:3.9-eclipse-temurin-21` 打包 Jar、`eclipse-temurin:21-jre-alpine` 作為執行階段。 |
| `java-backend/src/main/resources/application.yml` | Spring Boot 組態，目前含 `server.port` 與 logging level。 |
| `java-backend/src/main/resources/demo-data.json` | `SEED_DEMO_DATA=true` 且資料庫為空時使用的示範資料集。 |
| `java-backend/src/main/java/com/sentinelcve/SentinelCveApplication.java` | Spring Boot 啟動入口；啟用 `@EnableAsync` / `@EnableScheduling`，並以 `CommandLineRunner` 呼叫 `stateService.initAndLoad()`。 |
| `java-backend/src/main/java/com/sentinelcve/controller/*.java` | 16 支 REST Controller：Product、Cve、Project、Ticket、Rule、Webhook、Alert、Log、Report、AiConfig、EmailConfig、ScheduleConfig、TeamsConfig、ProductCatalog、Health、SpaFallback。 |
| `java-backend/src/main/java/com/sentinelcve/service/*.java` | 核心業務邏輯：`ScanService`、`AiService`、`MailService`、`WebhookDispatchService`、`AlertRuleEngineService`、`SchedulerService`、`TicketService`、`ProjectDigestService`、`StateService`、`LogService`。 |
| `java-backend/src/main/java/com/sentinelcve/model/*.java` | 21 個 Java POJO，對應前端 `src/types.ts`，由 Jackson 以 camelCase 序列化/反序列化。 |
| `java-backend/src/main/java/com/sentinelcve/state/AppState.java` | 記憶體中的全域應用狀態；啟動時由 PostgreSQL 載入，各 service 在鎖保護下讀寫。 |
| `java-backend/src/main/java/com/sentinelcve/db/PersistenceRepository.java` | PostgreSQL 持久化層；每個集合對應一張表，完整物件寫入 `data JSONB`，並抽出查詢索引欄位。 |
| `java-backend/src/main/java/com/sentinelcve/config/DataSourceConfig.java` | 依 `DATABASE_URL` 或 PG* 環境變數建立 HikariCP `DataSource`。 |
| `java-backend/src/main/java/com/sentinelcve/catalog/ProductCatalog.java` | 內建產品目錄、別名、供應商、類別、CPE 範本與 catalog enrichment；由舊 `productCatalog.ts` 移植。 |
| `java-backend/src/main/java/com/sentinelcve/provider/ProductProviderService.java` | 官方版本與 CVE 相關 provider；負責 HTTP timeout、版本解析、穩定版篩選、NVD/OSV 映射；由舊 `productProviders.ts` 移植。 |
| `docker-compose.yml` | 啟動 PostgreSQL 與 Spring Boot 應用；由 `java-backend/Dockerfile` 建置，對外映射 `3000:8080`，並設定 DB/app healthcheck。 |
| `.dockerignore` | 排除 dependencies、dist、Git、`.env` 與本機器雜項。 |
| `package.json` | 前端專用 scripts 與 npm dependencies；`dev` 為 `vite`、`build` 為 `vite build`、`lint` 為 `tsc --noEmit`。 |
| `README.md` | 專案基礎啟動說明；實作細節以本文件為準。 |
| `metadata.json` | 專案/應用程式後設資訊。 |
| `package-lock.json` / `bun.lock` | `package-lock.json` 為目前前端建置使用的 npm lock；`bun.lock` 仍在 repo 中，但目前部署與建置流程未使用。 |

## 4. 持久化與狀態

Spring Boot 啟動時，`SentinelCveApplication` 會透過 `StateService.initAndLoad()` 先呼叫 `PersistenceRepository.initDb()` 建表，再把 PostgreSQL 中的所有集合載入記憶體 `AppState`。

- 持久化已改為 **100% PostgreSQL**，不再使用 `data/state.json`、`DATA_DIR`、檔案 mode `0600` 或 Docker bind mount `./data`。
- `StateService` 在啟動時會把 `products`、`cves`、`rules`、`notifications`、`webhooks`、`logs`、`projects`、`tickets` 與 `app_config`（AI / Email / Teams / Schedule 設定）整批載入 `AppState`。
- 每次異動後由 `StateService.persist()` 以 `@Async` 非同步寫回 PostgreSQL；`PersistenceRepository.persistState()` 會在 transaction 中對每個集合執行 `replaceCollection(...)`，先清空再依 `position` 重建，保留原本陣列順序。
- 各集合各自對應資料表：`products`、`cves`、`rules`、`notifications`、`webhooks`、`logs`、`projects`、`tickets`，以及設定表 `app_config`。
- 主鍵以 `id` 為主；`cves` 例外使用 `(id, product_name)` 複合主鍵。完整物件會序列化到 `data JSONB` 欄位，並抽出 `severity`、`cvss_score`、`cisa_kev`、`status`、`code`、`type`、`level` 等欄位供 SQL 查詢與索引。
- 連線由 `DATABASE_URL`（或 `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE`）控制；格式請以 `README.md` 為準。
- 若資料庫為空且設定 `SEED_DEMO_DATA=true`，啟動時會將 classpath 中的 `demo-data.json` 種入 PostgreSQL。
- Webhook URL 與 API key 屬敏感資料；不應提交 `.env`，資料庫憑證也不應硬編碼進 image 或 Git。

## 5. 產品目錄與識別

### 5.1 Catalog enrichment

`findCatalogEntry()` 會將輸入名稱正規化（小寫、移除大部分符號），再與 catalog 名稱與 aliases 比對。`enrichProductFromCatalog()` 會補上：

- 標準產品名與供應商。
- `sourceType`、repository、ecosystem/package name、vendor release URL。
- 依當前版本展開的 CPE template。

使用者自訂欄位應優先保留，catalog 只用於補齊缺少資訊。

### 5.2 版本來源選擇

`resolveSourceType()` 依明確 `sourceType` 與產品 metadata 決定 Provider：

| Provider | 來源 | 判斷/解析 |
|---|---|---|
| `postgresql` | PostgreSQL 官方 Release Notes | 擷取 release URL 中的 `major.minor`，以語意數字比較取最新穩定版。 |
| `github` | GitHub Releases API | 排除 draft、prerelease、alpha/beta/rc/nightly，依 tag 版本降序。 |
| `npm` | npm registry `/latest` | 使用 latest dist-tag 版本。 |
| `pypi` | PyPI JSON API | 使用 `info.version`。 |
| `vendor` | catalog 指定的官方頁/API | 產品專屬 parser，例如 Python API、SQL Server、Oracle、VMware、7-Zip、MySQL 等。 |
| lifecycle fallback | endoflife.date | 使用結構化 release 資料，信心等級為 `MEDIUM`；它是上游官方資料的聚合來源，不是廠商第一方 API。 |

`stableVersion()` 排除 alpha、beta、preview、pre、rc、snapshot 與 nightly。`compareVersions()` 以數字版本段比較；非標準廠商版號需寫專屬 adapter，不應猜測。

### 5.3 更新判斷

`applyVersionResult()` 寫入 `latestVersion`、`latestSecureVersion`、來源 URL、查詢時間與信心等級。目前的更新判斷為：

```ts
hasUpdateAvailable = Boolean(currentVersion && latestSecureVersion !== currentVersion)
```

注意：這是字串不相等判斷，不是完整版本支援政策判斷。例如 PostgreSQL `16.1` 與 `18.4` 會判定需更新，但是否應跨 major 升級仍需工程師評估。

## 6. CVE 資料來源與關聯方式

### 6.1 來源

- **NVD API 2.0**：用 CPE 或 keyword 查詢，映射 CVE ID、描述、發布/修改時間、CVSS v3.1/v3.0/v2、CISA metadata、CPE 與 references。
- **OSV.dev**：當產品有 ecosystem/package identity 時查詢，適合 npm、PyPI、Maven、Go 等生態。
- **本地 `cvesDatabase`**：保存已查得 CVE 與初始範例，並作為外部來源失敗時的現有資料集；不代表即時完整的全球 CVE 鏡像。

外部 HTTP 使用 timeout，單一來源失敗時應在日誌明確呈現，不可將無資料直接解釋為「安全」。

### 6.2 CVSS 與 severity

NVD 轉換優先順序為 CVSS 3.1、3.0、2.0。severity 正規化為 `CRITICAL | HIGH | MEDIUM | LOW`。專案通知使用 `cvss.baseScore >= project.notifyMinCvss`；`notifyCisaKevOnly=true` 時還必須 `cisaKev=true`。

### 6.3 專案 CVE 關聯

前端專案弱點清單以下列方式之一關聯產品：

- CVE product name 與產品名互相包含。
- CVE CPE 包含產品 `cpeKeyword`。
- vendor 相符且 product name 相符。

後端專案通知目前主要使用正規化後產品名精確相等。新增別名或變體名稱時，應同時測試前後端關聯結果，避免 UI 看得到但通知漏掉。

## 7. 掃描、警報與排程

### 7.1 全域排程

`SchedulerService.tick()` 透過 `@Scheduled(fixedDelay = 30000, initialDelay = 30000)` 每 30 秒檢查是否到期。為避免長時間產品掃描延誤通知，專案版本/CVE 時鐘優先檢查，後續才執行全域與單產品掃描。

全域 scheduler 負責：

- 依 `scheduleConfig.nextRunAt` 執行所有產品或僅 critical/high 產品。
- 執行 CVE Provider，寫回 `detectedCveCount` 與 `lastScannedAt`。
- 對查得 CVE 執行 `evaluateAlertRules()`。

### 7.2 Alert rule

Rule 必須啟用，且需符合：

- 產品在 `targetProductIds`，或該陣列為空（全產品）。
- CVSS 達 `minCvssScore`。
- `onlyCisaKev` 開啟時 CVE 必須為 KEV。

內建 alert 以 `cveId + product + rule` 去重。這是總覽警報去重，與專案 Teams digest 簽章是不同層次。

## 8. 專案版本/CVE 通知

### 8.1 頻率

| 值 | 間隔 |
|---|---:|
| `REALTIME` | 60 秒 |
| `EVERY_15_MIN` | 15 分鐘 |
| `HOURLY` | 1 小時 |
| `DAILY` | 24 小時 |
| `WEEKLY` | 7 天 |

`versionNotifyNextRunAt` 與 `cveNotifyNextRunAt` 為獨立時鐘。前端變更頻率時將 next run 設為當下，使背景 worker 在下一個 30 秒檢查點生效。

### 8.2 版本通知判斷

1. 取得專案綁定產品。
2. 首次、資料超過 15 分鐘或手動強制發送時，先執行官方版本 Provider。
3. 篩選 `hasUpdateAvailable=true`。
4. 排除已有 `CLOSED` 版本工單的產品。
5. 以 `product.id + latestSecureVersion` 排序組成 signature。
6. 自動通知若 signature 無變化，只更新上/下次執行時間，不重送。
7. 手動通知 `force=true`，會重查來源並略過去重，但仍排除已結案項目。

### 8.3 CVE 通知判斷

1. CVE 產品名與專案綁定產品名相等。
2. CVSS 達專案門檻，並套用 KEV-only 條件。
3. 排除已有 `CLOSED` CVE 工單的項目。
4. 以 `CVE ID + product + CVSS + lastModifiedDate` 排序組成 signature。
5. 新環境簽章為空，第一次會發送全部符合項目；後續無變化不重送。

### 8.4 成功與失敗語意

- 只有所有目標 Webhook 都回傳 2xx 後才儲存 signature。
- Webhook 失敗時不儲存 signature，下次排程可重試。
- 無 Webhook 時略過並寫日誌，不假裝發送成功。
- 無符合項目仍更新 last/next run，UI 可分辨「已執行但無項目」與「尚未執行」。

### 8.5 Teams MessageCard

通知發送至去重後的 owner/handler Webhook URL。卡片包含專案、通知類型、項目數、時間與逐項 facts。單次最多顯示 30 項，超過時顯示剩餘數量，避免卡片過大。

## 9. 工單與對應項目

### 9.1 狀態

| 狀態 | 意義 |
|---|---|
| `OPEN` | 已派單/待處理。 |
| `IN_PROGRESS` | 處理中。 |
| `RESOLVED` | 已完成處理，必須填寫 `resolutionNote`；仍可複測與審核。 |
| `CLOSED` | 正式結案，對應項目不再通知。 |
| `WAIVED` | 資安豁免，應保存原因、核准者與時間。 |

### 9.2 關聯規則

- **版本工單**：專案 ID 相符、`cveList` 為空，且 `affectedProducts` 包含產品名。
- **CVE 工單**：專案 ID 相符，且 `cveList[].cveId` 精確等於 CVE ID。

前端以上述關聯顯示工單編號與狀態。已派單項目將「派單」改為「查看工單」，避免不必要的重複工單。

### 9.3 結案排除

`hasClosedVersionTicket()` 與 `hasClosedCveTicket()` 是後端通知排除的權威判斷。前端也將已結案項目移至「不再通知」區。只有 `CLOSED` 會停止通知；`RESOLVED` 尚未結案。

## 10. AI 模組

`AiService.generateAiText()` 支援：

- Google Gemini REST API。
- OpenAI API、Ollama 與自訂 OpenAI-compatible endpoint。
- Anthropic Claude Messages API。

AI 用於 CVE 影響摘要、根因、攻擊情境、減緩、修補步驟、複測方法與綜合工單草案。AI 輸出不是官方公告，不應未複核就在生產環境執行指令。

API 對外回傳 AI 設定時會用布林值表示 key 是否存在，不回傳明文 key。

## 11. 主要 API 分組

| 分組 | 端點摘要 |
|---|---|
| Health | `GET /api/health` |
| Products | `GET/POST /api/products`, `PUT/DELETE /api/products/:id`, `POST /api/products/:id/check-version`, `POST /api/products/check-all-versions` |
| Catalog | `GET /api/product-catalog`, `POST /api/product-catalog/check-all-versions` |
| CVE | `GET /api/cves`, `GET /api/cves/search`, `POST /api/cves/scan`, `POST /api/cve/ai-assess` |
| Projects | `GET/POST /api/projects`, `PUT/DELETE /api/projects/:id` |
| Project Teams | `POST /api/projects/:id/notify-teams-test`, `notify-version-now`, `notify-cve-now` |
| Tickets | `GET/POST /api/tickets`, `GET/PUT/DELETE /api/tickets/:id`, `POST /api/projects/:id/generate-ticket` |
| Scheduler | `GET/PUT /api/schedule/config`, `POST /api/schedule/run-now` |
| Alerts/rules | `/api/alerts*`, `/api/rules*`, `/api/webhooks*` |
| AI | `GET/PUT /api/ai/config`, `POST /api/ai/test`, `POST /api/reports/generate` |
| Logs | `GET /api/logs` |

### 舊版相容端點

`/api/email/*`、`/api/tickets/:id/email` 與全域 `/api/teams/*` 仍留在後端，但目前正式 UI 已移除 Email 與全域 Teams 設定，專案通知以專案 owner/handler Teams Webhook 為準。新功能不應依賴這些舊端點；若要刪除，應先做 persisted-state/API 相容性盤點。

## 12. 開發與驗證

```bash
npm ci
npm run dev
npm run lint
npm run build
cd java-backend
mvn test
mvn -q -DskipTests package
```

- `npm run lint` 是 TypeScript `--noEmit` 檢查。
- `npm run build` 僅建置 Vite 前端靜態檔案。
- `mvn test` 執行 Spring Boot 後端測試；`mvn -q -DskipTests package` 會產出 `target/sentinel-cve-server.jar`。
- 健康檢查：`GET http://localhost:3000/api/health`。
- 修改排程時必須測試：首次發送、無變化去重、Webhook 失敗重試、手動強制發送、CLOSED 排除、last/next run 更新。
- 修改 Provider 時必須測試穩定版篩選、rate limit、timeout、網頁格式變更與無結果情境。

## 13. Docker 部署

```bash
docker compose up -d --build
docker inspect --format '{{.State.Health.Status}}' sentinel-cve-app
```

環境變數：

| 變數 | 用途 |
|---|---|
| `PORT` | Spring Boot / Embedded Tomcat 埠號；容器內預設 8080，Compose 對外映射為 3000。 |
| `APP_URL` | 應用對外 URL，用於需要連結的訊息。 |
| `DATABASE_URL` | PostgreSQL 連線字串；後端所有狀態資料皆持久化於此。 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `docker-compose.yml` 啟動 PostgreSQL 時使用，並用來組裝預設 `DATABASE_URL`。 |
| `SEED_DEMO_DATA` | `true` 時，首次連到空資料庫會匯入示範資料。 |
| `GEMINI_API_KEY` | Gemini API key；不可寫進 image 或 Git。 |

EC2/VM 部署時，除了容器 healthy，還要檢查 Security Group/firewall 是否放行對外 port。建議只允許測試 IP，或放在 TLS reverse proxy 後方，不要將測試服務無限制開放。

## 14. 已知限制與改善方向

1. **目前為全量集合寫回 PostgreSQL**：每次異動會以 transaction 重寫整個集合，資料量成長後需評估增量更新、事件流或更細粒度 schema。
2. **無身分驗證/RBAC**：目前 API 未有完整驗證與權限邊界，不應直接暴露於不受信任網路。
3. **Webhook secret at rest**：目前仍保存在 PostgreSQL JSONB/設定資料中；生產化應使用 secrets manager/KMS 或加密欄位。
4. **Provider 易受上游變更影響**：HTML parser 應加 contract test 與來源失效告警。
5. **版本判斷簡化**：目前以最新安全版字串不等於當前版判定，未處理 LTS/major branch/backport 支援政策。
6. **CVE 關聯規則不完全一致**：前端較寬鬆，後端 digest 較嚴格；應抽出共用 matching service 與測試資料。
7. **排程為進程內 scheduler**：重啟後依 persisted next-run 繼續，但沒有 distributed lock。多 replica 會重複執行。
8. **MessageCard 容量**：目前限制顯示 30 項；大型專案應加入系統深連結、分頁或 Adaptive Card/Workflow 處理。
9. **舊 API 尚未移除**：Email 與全域 Teams 相容端點仍在後端，後續應在有 migration plan 時正式下線。

## 15. 內建產品追蹤來源完整清單

本節以 `catalog/ProductCatalog.java` 與 `provider/ProductProviderService.java` 的**目前實際程式執行順序**為準，而不是只看目錄中的 `sourceType`。`getLatestVersion()` 會先檢查 `EOL_PRODUCT_SLUGS`；命中的產品會優先使用 endoflife.date，即使目錄原本標為 vendor 或 GitHub。

### 15.1 版本與 CVE 來源總表

| # | 產品 | 實際版本追蹤來源 | 版本判斷方式 | CVE 追蹤來源 | 目前狀態／注意事項 |
|---:|---|---|---|---|---|
| 1 | Vertica | [OpenText Vertica 最新文件](https://docs.vertica.com/latest/en/) | 解析 `Vertica` 或 `OpenText Analytics Database` 後的版本號，取數值最大穩定版 | NVD CVE API，依 Vertica CPE 與目前版本查詢 | 官方 HTML Adapter；頁面格式改變時可能失效 |
| 2 | PostgreSQL | [PostgreSQL Release Notes](https://www.postgresql.org/docs/release/) | 從官方 release 路徑解析所有版本並取最大值 | NVD CVE API，依 PostgreSQL CPE 與目前版本查詢 | 官方來源，版本可信度 HIGH |
| 3 | Microsoft SQL Server | [Microsoft 最新更新與版本資訊](https://learn.microsoft.com/en-us/troubleshoot/sql/releases/download-and-install-latest-updates) | 解析 `SQL Server 20xx`，目前只判斷產品世代，不解析 CU/build | NVD CVE API，依 SQL Server CPE 與目前版本查詢 | 無法精確判斷最新 CU；需專屬結構化 Adapter 改善 |
| 4 | Oracle Database | [Oracle Database Downloads](https://www.oracle.com/database/technologies/oracle-database-software-downloads.html) | 解析 `Oracle Database n ai/n c` 產品版本 | NVD CVE API，依 Oracle Database CPE 與目前版本查詢 | 不等同最新 RU/CPU 修補層級 |
| 5 | MySQL | [endoflife.date MySQL](https://endoflife.date/mysql) | 讀取結構化 releases，排除預覽版後依版本排序 | NVD CVE API，依 MySQL CPE 與目前版本查詢 | 實際不走目錄中的 Oracle download URL；可信度 MEDIUM |
| 6 | Microsoft Windows | [endoflife.date Windows](https://endoflife.date/windows) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 Windows 11 CPE template 與目前版本查詢 | 泛稱 Windows 被固定映射為 Windows 11 CPE；不同 edition/build 應建立獨立資產 |
| 7 | Windows Server | [endoflife.date Windows Server](https://endoflife.date/windows-server) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 Windows Server 2025 CPE template 與目前版本查詢 | 不同 server 世代需使用正確 CPE，否則可能漏報或誤報 |
| 8 | VMware ESXi | [Broadcom ESXi build 對照表](https://knowledge.broadcom.com/external/article/316595/build-numbers-and-versions-of-vmware-esx.htm) | 解析 `ESX/ESXi` 版本並取最大值 | NVD CVE API，依 VMware ESXi CPE 與目前版本查詢 | HTML Adapter；目前未用 build number 精確比較修補層級 |
| 9 | VMware vCenter Server | [Broadcom vCenter build 對照表](https://knowledge.broadcom.com/external/article/326316/build-numbers-and-versions-of-vcenter-s.html) | 解析 `vCenter Server` 版本並取最大值 | NVD CVE API，依 vCenter Server CPE 與目前版本查詢 | HTML Adapter；build 對照仍應強化 |
| 10 | VMware vSphere | [Broadcom ESXi build 對照表](https://knowledge.broadcom.com/external/article/316595/build-numbers-and-versions-of-vmware-esx.htm) | 目前沿用 ESX/ESXi 版本解析 | NVD CVE API，依 vSphere CPE 與目前版本查詢 | vSphere 是產品套件概念，版本來源與 CPE 可能過度簡化 |
| 11 | Kong Gateway | [GitHub Kong/kong Releases](https://github.com/Kong/kong/releases) | GitHub API 取非 draft、非 prerelease 的最新 release；無 release 時改查 tag | NVD CVE API，依 Kong CPE 與目前版本查詢 | GitHub 官方 repository，可信度 HIGH |
| 12 | Denodo Platform | [Denodo New Release](https://community.denodo.com/new-release/) | 解析 `Denodo Platform n/n.n` 並取最大值 | NVD CVE API，依 Denodo CPE 與目前版本查詢 | Community 頁面可能要求登入或改版，需監控解析失敗 |
| 13 | Pentaho Data Integration | [Pentaho Install 文件](https://docs.pentaho.com/install) | 解析 `Pentaho Data Integration` 版本並取最大值 | NVD CVE API，依 Pentaho Business Analytics CPE 與目前版本查詢 | 產品名稱與 CPE 顆粒度不完全一致，須注意誤配 |
| 14 | Apache Hop | [endoflife.date Apache Hop](https://endoflife.date/apache-hop) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 Apache Hop CPE 與目前版本查詢 | 因 EOL mapping 優先，實際不走 `apache/hop` GitHub |
| 15 | Trinity Data Integration Platform | [NetPro 官方支援公告](https://www.netpro.com.tw/2022-03-02/) | 固定回傳公告可驗證的受支援版本線 `4.1`，不推測 `4.1.x` | 無可用的內建精確來源 | 目前無 CPE、PURL 或 package identity，CVE 掃描會明確失敗；需廠商公告/feed 或元件 SBOM |
| 16 | Tableau Server | [Tableau REST API 版本概念頁](https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm) | 解析 Tableau Server `20xx.x` 版本 | NVD CVE API，依 Tableau Server CPE 與目前版本查詢 | REST API 版本不一定等於 Server 最新維護版本，來源需改為官方 release notes |
| 17 | Microsoft Power BI Desktop | [Power BI Desktop 更新封存](https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-latest-update-archive) | 解析本地化頁面中的 `2.xxx.x` 版本並取最大值 | NVD CVE API，依 Power BI CPE 與目前版本查詢 | HTML 多語系規則，頁面結構變更可能失效 |
| 18 | Oracle VM VirtualBox | [VirtualBox Downloads](https://www.virtualbox.org/wiki/Downloads) | 解析 `VirtualBox 7.x.x` 以上版本 | NVD CVE API，依 VirtualBox CPE 與目前版本查詢 | 官方 HTML Adapter，可信度 HIGH |
| 19 | Python | [Python.org Releases API](https://www.python.org/api/v2/downloads/release/?is_published=true) | 只接受穩定 Python 3 `x.y.z`，排除 pre-release，取最大版本 | NVD CVE API，依 Python CPE 與目前版本查詢 | 官方結構化 API，可信度 HIGH；目前不區分各仍受支援 minor branch 最新修補版 |
| 20 | Git | [GitHub git/git Releases/Tags](https://github.com/git/git) | 優先穩定 release，無 release 時取穩定 tag | NVD CVE API，依 Git CPE 與目前版本查詢 | GitHub mirror 的 release 情況可能主要依賴 tags |
| 21 | GitLab | [endoflife.date GitLab](https://endoflife.date/gitlab) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 GitLab CPE 與目前版本查詢 | 實際不走 GitLab releases 頁；未區分月度支援分支/backport |
| 22 | Apache Airflow | [GitHub apache/airflow Releases](https://github.com/apache/airflow/releases) | 取最新穩定 GitHub release/tag | OSV API（PyPI `apache-airflow` + 目前版本）與 NVD CVE API（CPE）合併去重 | 目前唯一同時具 package identity 與 CPE 的內建產品 |
| 23 | Redis | [GitHub redis/redis Releases](https://github.com/redis/redis/releases) | 取最新穩定 GitHub release/tag | NVD CVE API，依 Redis CPE 與目前版本查詢 | 未區分 Redis Open Source 不同維護分支或商業版 |
| 24 | Apache HTTP Server | [endoflife.date Apache HTTP Server](https://endoflife.date/apache-http-server) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 Apache HTTP Server CPE 與目前版本查詢 | 因 EOL mapping 優先，實際不走 `apache/httpd` GitHub |
| 25 | Apache Tomcat | [endoflife.date Tomcat](https://endoflife.date/tomcat) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 Tomcat CPE 與目前版本查詢 | 只取全域最大版，未依 9/10/11 等受支援主線分別建議修補版 |
| 26 | Notepad++ | [GitHub notepad-plus-plus/notepad-plus-plus Releases](https://github.com/notepad-plus-plus/notepad-plus-plus/releases) | 取最新穩定 GitHub release/tag | NVD CVE API，依 Notepad++ CPE 與目前版本查詢 | GitHub 官方 repository，可信度 HIGH |
| 27 | 7-Zip | [7-Zip Downloads](https://www.7-zip.org/download.html) | 解析 `Download 7-Zip x` | NVD CVE API，依 7-Zip CPE 與目前版本查詢 | 官方 HTML Adapter，版本格式需持續測試 |
| 28 | Red Hat Enterprise Linux | [endoflife.date RHEL](https://endoflife.date/rhel) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 RHEL CPE 與目前版本查詢 | 真正修補狀態常由套件 NEVRA/backport 決定；僅看 OS 版本不足，生產環境應串 Red Hat Security Data API/OVAL |
| 29 | Rocky Linux | [endoflife.date Rocky Linux](https://endoflife.date/rocky-linux) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 Rocky Linux CPE 與目前版本查詢 | 套件層級 CVE/backport 仍需 Rocky errata/OVAL 類來源 |
| 30 | Ubuntu | [endoflife.date Ubuntu](https://endoflife.date/ubuntu) | 讀取結構化 releases 並取最大穩定版 | NVD CVE API，依 Ubuntu CPE 與目前版本查詢 | 應依實際 LTS/interim release 與 Ubuntu USN/OVAL 判斷修補狀態，不能只追全域最大版 |

### 15.2 共用來源與執行規則

- **endoflife.date**：呼叫 `https://endoflife.date/api/v1/products/{slug}`，從 `result.releases` 取 `latest.name` 或 release name，排除 alpha、beta、preview、pre、rc、snapshot、nightly，再以目前的簡化數字比較器排序。這是結構化彙整來源，程式標記可信度 `MEDIUM`，不是原廠 API。
- **GitHub**：呼叫 `GET /repos/{owner}/{repo}/releases?per_page=100`；排除 draft、prerelease 與預覽標籤。若沒有可用 release，再呼叫 tags API。程式目前未設定 GitHub Token，可能受匿名 rate limit 影響。
- **原廠 HTML/API**：Python 使用官方 JSON API；其他 vendor Adapter 多數抓取 HTML 後用正規表示式解析。只要上游文案、語系或 DOM 改變，就可能回報「尚無可靠解析規則」，不會把當前版本假裝成最新版。
- **NVD**：以完整 CPE（將 template 的 version 欄替換為產品目前版本）呼叫 CVE 2.0 API，並加上 `isVulnerable`。若有 `NVD_API_KEY` 則帶入 request header。查詢結果以 `NVD_CPE_APPLICABILITY`、`HIGH` match confidence 記錄。
- **OSV**：只有產品具 PURL，或 ecosystem 為 npm/PyPI 且有 packageName 時才查詢。目前內建目錄中 Apache Airflow 具 PyPI identity。OSV 與 NVD 同時命中同一 CVE 時以 CVE ID 合併資料來源。
- **目前版本是必要輸入**：版本通知是比較 `currentVersion` 與 `latestSecureVersion`；CVE 查詢也要把 `currentVersion` 放進 CPE/PURL。沒有目前版本時，結果不能代表該實例的實際風險。
- **`latestSecureVersion` 的語意限制**：目前 Provider 將「最新穩定版本」同時填入 `latestVersion` 與 `latestSecureVersion`，尚未逐項證明它是特定主線、LTS 或 backport 政策下的最低安全修補版。

### 15.3 維護時的完整性檢查

產品來源變更後，至少要執行 `/api/product-catalog/check-all-versions`，逐項確認 `success`、`sourceUrl`、`confidence`、解析版本及失敗原因。CVE 部分則需使用具代表性的目前版本逐項呼叫掃描，不能只用「API 沒拋錯」判定正確；零筆結果可能是真正無漏洞，也可能是 CPE 版本、產品名稱或上游資料涵蓋不足。

## 16. 新增產品 Adapter 清單

1. 在 `catalog/ProductCatalog.java` 新增名稱、aliases、vendor、category 與來源 metadata。
2. 優先使用結構化官方 API/registry；最後才使用 HTML parser。
3. 在 `provider/ProductProviderService.getLatestVersion()` 新增 adapter，排除預覽版並回傳 `sourceUrl`、`confidence`、`checkedAt`。
4. 配置 CPE template 或 ecosystem/package identity。
5. 測試當前版、最新版、失敗情境、rate limit 與通知 signature。
6. 以 `/api/product-catalog/check-all-versions` 執行內建目錄批次稽核，不可只以 UI 顯示作為通過標準。
