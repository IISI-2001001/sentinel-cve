# SentinelCVE 漏洞監控與即時警報系統 (SentinelCVE Security Engine)

企業級資安漏洞監控平台：自動同步全球權威 CVE/NVD/CISA KEV 漏洞資訊、透過 Gemini 與 Multi-LLM 智慧分析威脅等級與命令列修補建議，並提供 MS Teams Webhook、全域 Email (SMTP) 即時警報與自動化處置工單聯防。

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
  * **專案管理與工單中心 (Project Manager)**：專案團隊維護、產品版本與升級對照表 (Upgrade Matrix)、資安處置工單看板與 ⚡ AI 一鍵生成專案綜合處置工單。
  * **系統管理與設定中心 (System Manager)**：集中管理「⏱️ 自動排程」、「📦 監控資產產品 (.txt/CPE 批次匯入)」、「✉️ 全域 Email SMTP」、「💬 MS Teams Webhook 通報」、「📋 系統稽核日誌」與「🤖 AI 工具與 LLM 選擇」。
  * **系統說明與專業名詞手冊 (Documentation)**：完整收錄 CVE/CPE/CVSS 名詞解釋、NVD/CISA KEV/OSV/EPSS 權威數據源說明、4 種弱點查找與派單 SOP、自動化聯防管道與 FAQ。
* **生成式 AI 資安推演引擎**：
  * 支援 **Google Gemini**、OpenAI GPT-4o、Anthropic Claude 3.7 或地端 **Ollama**。
  * 自動將原始英文 CVE 分析為繁體中文之「漏洞根因」、「攻擊衝擊」、「CLI Command-line Workaround 修補指令」與「掃描複測步驟」。
* **自動閉環聯防與告警**：
  * 支援排程定時自動比對資產、自動生成資安處置工單。
  * 即時發送具備 MessageCard 格式之 MS Teams Webhook 通知與企業 Email 派報。

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
                       │  State Store) │   │ • NIST NVD API v2.0
                       └───────────────┘   │ • CISA KEV Feed
                                           │ • FIRST EPSS / OSV.dev
                                           │ • Google Gemini API
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
  * `ProjectManager.tsx`：專案管理、產品升級版本矩陣對照表、處置工單 Kanban 看板與 AI 綜合工單產出。
  * `SystemManager.tsx`：系統整合管理大廳，收納排程設定、監控資產產品、SMTP 郵件伺服器、Teams Webhook、稽核日誌與 AI 引擎選擇。
  * `ProductManager.tsx` (嵌入於 SystemManager)：資產產品清單維護、.txt CPE 檔案批次解析匯入、AI 升級檢測與個別資產弱點比對。
  * `SystemLogs.tsx` (嵌入於 SystemManager)：系統操作與排程稽核軌跡 Audit Log。
  * `Documentation.tsx`：完整系統文件與互動式專業名詞對照。
  * `CveDetailModal.tsx` / `TicketDetailModal.tsx`：CVE 漏洞威脅剖析與工單詳細內容與 Email 測試發送 Modal。

### 後端架構 (Backend)

* **核心技術**：Java 21, Spring Boot 3 (Web / JDBC / Async / Scheduling), Maven, **PostgreSQL 16 (`postgresql` JDBC driver + HikariCP)**。
* **模組劃分 (`java-backend/src/main/java/com/sentinelcve/`)**：
  * `controller/*`：53 支 REST API endpoints（`/api/dashboard/stats`, `/api/cves`, `/api/products`, `/api/projects`, `/api/tickets`, `/api/schedule/*`, `/api/system/*` 等），逐一對應原 Node/Express 路由。
  * `service/*`：核心業務邏輯，包含 `ScanService`（NVD/OSV 檢索與版本比對）、`AiService`（Multi-LLM 抽象層）、`MailService`（動態 SMTP 寄信）、`WebhookDispatchService`（Teams/Slack/自訂 Webhook）、`AlertRuleEngineService`（告警規則引擎）、`SchedulerService`（`@Scheduled` 背景排程）、`TicketService`（AI 工單生成）、`ProjectDigestService`（專案摘要通知）。
  * `db/PersistenceRepository.java` + `config/DataSourceConfig.java`：應用程式狀態（監控產品、CVE 資料庫、警報規則、通知、Webhook、稽核日誌、專案、工單、AI/Email/Teams/排程設定）全部以 PostgreSQL 儲存，每個集合對應一張資料表，主要欄位另外抽出做索引（如 `severity`、`cisa_kev`、`status`），完整物件則存於 `data JSONB` 欄位（透過 `PGobject` 序列化），服務啟動時整批載入記憶體、每次異動即以 `@Async` 方式整批寫回資料庫（Transaction 包裹，確保一致性）。
  * `model/*`：與前端 `src/types.ts` 對應之 20 個 Java Model（Jackson camelCase 序列化）。

### 資料流與背景排程 Worker

* **Background Scheduler Engine**：
  * `SchedulerService` 以 Spring 的 `@Scheduled(fixedDelay = 30000)` 註解實作，每 30 秒執行一次背景輪詢。
  * **全域系統自動排程**：可在「系統管理 > ⏱️ 自動排程」頁面靈活調整全域掃描週期（**15 分鐘、30 分鐘、1 小時、6 小時、24 小時**）與掃描資產範疇（全部資產 / 僅限 Critical & High）。
  * **個別產品獨立週期**：亦可在「系統管理 > 📦 監控資產產品」設定個別產品的 `scanIntervalMinutes`（預設 30 分鐘）。
  * **自動告警與派報**：每當達到排程時間，背景 Worker 會自動調用 NVD/OSV API 發起弱點檢索；若比對到符合條件的高危漏洞（如 CVSS $\ge$ 7.0），將自動觸發 Teams Webhook 即時推播、發送 Email 通知，並寫入系統 Audit Log。

---

## 🔑 環境變數配置 (Environment Variables)

請於專案根目錄參考 `.env.example` 建立 `.env` 檔案：

```env
# Gemini API Key (用於生成式 AI 漏洞解析與處置工單推演)
GEMINI_API_KEY="your_gemini_api_key_here"

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
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
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

如果您希望直接在主機上執行，需先準備一個可連線的 PostgreSQL（本機安裝或用 Docker 快速起一個都可以）：

```bash
# 快速啟動一個本機測試用 PostgreSQL 容器
docker run -d --name sentinel-cve-db -p 5432:5432 \
  -e POSTGRES_USER=sentinel -e POSTGRES_PASSWORD=sentinel -e POSTGRES_DB=sentinel_cve \
  postgres:16-alpine

# 前端：安裝套件並啟動 Vite dev server（熱重載，預設 5173）
npm install
npm run dev

# 後端：另開一個終端機，設定環境變數並啟動 Spring Boot（需 Java 21 + Maven）
cd java-backend
export DATABASE_URL="postgres://sentinel:sentinel@localhost:5432/sentinel_cve"
export GEMINI_API_KEY="your_gemini_api_key_here"
mvn spring-boot:run
```

後端啟動於 `http://localhost:8080`，會自動建立所需的資料表 (`CREATE TABLE IF NOT EXISTS`)，無需另外執行 migration。開發模式下前端 Vite dev server 與後端 API 為分離埠號，請自行設定 Vite proxy 或直接呼叫 `http://localhost:8080/api/*`。

---

### 2. 使用 Docker Compose 一鍵啟動

建議之標準正式部署方式：

```bash
# 1. 複製並設定環境變數
cp .env.example .env
# 請編輯 .env 填入正確的 GEMINI_API_KEY

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

# 執行容器 (帶入 GEMINI_API_KEY 與 DATABASE_URL)
docker run -d \
  --name sentinel-cve-app \
  --network sentinel-net \
  -p 3000:8080 \
  -e GEMINI_API_KEY="your_api_key_here" \
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
