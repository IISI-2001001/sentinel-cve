# Email 寄信服務設定指南（公司 Outlook 無法申請 SMTP 時的替代方案）

## 背景

SentinelCVE 的告警/摘要通知信件是透過「系統管理 > ⏱️ 全域 Email SMTP」設定的通用 SMTP 帳密寄出（後端 `MailService` 以 `JavaMailSenderImpl` 實作，`EmailConfigController` 提供 `GET/PUT /api/email/config` 與 `POST /api/email/test`）。

**重要事實：這個實作沒有寫死任何 Outlook/Exchange 邏輯，是純粹的通用 SMTP 客戶端。** 若公司 IT 不開放 Outlook/Exchange 的 SMTP relay 權限（也不受理 Azure AD App Registration 的 Microsoft Graph API 申請），**完全不需要修改任何程式碼**，只要在「系統管理 > 全域 Email SMTP」頁面改填第三方寄信服務商提供的 SMTP 主機/連接埠/帳密，並用既有的「SMTP 連線測試」按鈕驗證即可切換。

## 方案比較表

| 方案 | 需要公司網域 DNS？ | 免費額度 | 導入難度 | 備註 |
|---|---|---|---|---|
| **Brevo SMTP Relay（推薦首選）** | 否 | 每日 300 封 | 極低，5 分鐘完成 | 免 DNS 即可正式寄給任意收件人，額度足夠日常告警/摘要通知使用 |
| **SendGrid SMTP（備援）** | 否（單一寄件人驗證） | 每日 100 封 | 低 | 作法與 Brevo 相同，額度略低 |
| Amazon SES SMTP | 驗證信箱可不用 DNS，但 Sandbox 模式收件人也要先驗證 | 量小近乎免費 | 中，需 AWS 帳號＋申請提升至 Production Access | 短期不是最快方案 |
| Mailgun SMTP | 正式對外寄送（無收件人數量限制）需網域 DNS 驗證 | 有限，新制常需信用卡 | 中 | 若無 DNS，Sandbox 網域只能寄給最多 5 個已授權收件人，僅適合臨時測試 |
| Resend SMTP | **必須**先完成網域 DNS 驗證才能寄信，無免 DNS 替代方案 | 每月 3,000 封、每日 100 封 | 中，但卡在 DNS 門檻 | ❌ 官方文件明確要求「verified domain」為前置條件；內建的 `onboarding@resend.dev`/`delivered@resend.dev` 等測試信箱僅能模擬送達/退信情境，**無法寄給任何真實收件人**，限制比 Mailgun 更嚴格（Mailgun 至少能用 Sandbox 網域寄給 5 個真實授權收件人）。在完全無法異動公司 DNS 的前提下不可行；若未來取得 DNS 權限，是現代化、開發體驗佳的選項 |
| Microsoft Graph API (Mail.Send) | 需 Azure AD App Registration + IT 核發應用程式權限 | 依 M365 授權 | 高 | 微軟官方建議的 SMTP AUTH 替代方案，但需 IT 配合申請，若公司不受理則不可行 |
| 個人 Gmail SMTP | 否 | 約每日 500 封 | 低，但需開兩步驟驗證＋產生「應用程式密碼」 | ⚠️ 消費者信箱非為程式化/自動化寄信設計，可能被 Google 判定為可疑活動而鎖帳號，僅建議短期測試或臨時過渡使用，不建議正式長期依賴 |
| 個人 Outlook.com / Hotmail SMTP | 否 | 官方無明確保證額度 | 低，但 Microsoft 正逐步淘汰消費者信箱的 SMTP 基本驗證 | ⚠️ 與公司 Outlook 無關（純個人免費信箱），但未來可能無預警失效，不建議採用 |

## 推薦方案：Brevo SMTP Relay

### 設定步驟

1. **註冊帳號**：前往 https://www.brevo.com/ 點選「Sign up free」，用 Email + 密碼註冊（免信用卡）。收到驗證信後點擊連結完成帳號驗證。
2. **驗證寄件人信箱**（取代 DNS 驗證）：登入後台 →「Senders, Domains & Dedicated IPs」→「Senders」分頁 →「Add a sender」→ 輸入要用來寄出通知的信箱（公司或個人信箱皆可，只是作為寄件人顯示位址，不需要該網域的 DNS 權限）→ 點擊驗證信中的連結完成驗證（幾分鐘內生效）。
3. **取得 SMTP 帳密**：後台右上角帳號選單 →「SMTP & API」→「SMTP」分頁：
   - SMTP 伺服器：`smtp-relay.brevo.com`
   - 連接埠：`587`
   - 登入帳號：註冊 Brevo 的 Email
   - 密碼：點「Generate a new SMTP key」產生一組專屬 SMTP 金鑰（**這組才是密碼，不是登入密碼**），只會顯示一次，請立即複製保存。
4. **填入 SentinelCVE 系統設定**：進入「系統管理 > ⏱️ 全域 Email SMTP」：
   - SMTP 主機：`smtp-relay.brevo.com`
   - 連接埠：`587`
   - 啟用驗證：開啟
   - 帳號：Step 3 的登入 Email
   - 密碼：Step 3 產生的 SMTP 金鑰
   - 寄件者 Email：**必須是 Step 2 已驗證的信箱**（否則會被 Brevo 拒絕寄送）
   - 寄件者名稱：自訂（例如「SentinelCVE 告警通知」）
5. **測試**：點擊既有的「SMTP 連線測試」按鈕，確認測試信可送達（並檢查垃圾郵件匣）。

完成後即可正式取代公司 Outlook 寄信，每日 300 封額度內完全免費，且完全不需要改動任何程式碼。若未來取得公司網域 DNS 控制權，可額外於 Brevo 設定網域驗證（SPF/DKIM）以提升送達率，屬於漸進式優化。

## 備援方案：SendGrid SMTP

1. **註冊帳號**：https://sendgrid.com/ → 建立免費帳號。
2. **單一寄件人驗證**：Settings → Sender Authentication →「Verify a Single Sender」→ 輸入寄件信箱 → 收信點擊驗證連結（不需 DNS）。
3. **取得 SMTP 帳密**：Settings → API Keys → 建立一組 API Key（**帳號固定為 `apikey` 這個字串，密碼即為產生的 API Key**）。
4. **填入 SentinelCVE**：
   - SMTP 主機：`smtp.sendgrid.net`
   - 連接埠：`587`
   - 帳號：`apikey`
   - 密碼：產生的 API Key
   - 寄件者 Email：Step 2 已驗證的信箱
5. **測試**：同樣使用「SMTP 連線測試」驗證。

免費額度每日 100 封，作為 Brevo 額度不足或帳號異常時的備援選項。

## 備援（僅限測試/臨時過渡）：個人 Gmail 應用程式密碼

⚠️ **僅建議短期測試或臨時應急使用，不建議正式長期依賴**（消費者信箱非為自動化寄信設計，可能因「可疑活動」被 Google 暫時鎖定，且服務條款不鼓勵此用途）。

1. 登入要使用的 Google 帳號 → Google 帳戶設定 →「安全性」→ 開啟「兩步驟驗證」（若尚未啟用）。
2. 開啟兩步驟驗證後，同一頁面會出現「應用程式密碼」選項 → 建立一組新的應用程式密碼（選擇「其他（自訂名稱）」，輸入如「SentinelCVE」）→ 系統會產生一組 16 碼密碼，請立即複製。
3. 填入 SentinelCVE：
   - SMTP 主機：`smtp.gmail.com`
   - 連接埠：`587`
   - 帳號：完整 Gmail 地址
   - 密碼：Step 2 產生的應用程式密碼（**不是 Google 帳號登入密碼**）
   - 寄件者 Email：同一個 Gmail 地址
4. 測試：使用「SMTP 連線測試」驗證。

## 不建議方案：Mailgun（因無公司 DNS 權限）

Mailgun 註冊後預設提供一個 `sandboxXXXX.mailgun.org` 網域，不需要 DNS 即可用，但**只能寄給「Authorized Recipients」名單**（最多 5 個信箱，且每個收件人都要先收邀請信並點擊確認）。若要對任意收件人正式寄送，需另外新增自訂網域並在 DNS 新增 TXT（SPF/DKIM）與 MX 記錄驗證——這需要公司網域的 DNS 存取權限，在本案無法取得的情況下，Mailgun 僅能作為「寄給少數已知內部信箱」的臨時測試工具，不建議作為正式方案。

## 不建議方案：Resend（因無公司 DNS 權限，限制比 Mailgun 更嚴格）

Resend 的 SMTP 設定本身很簡單（主機 `smtp.resend.com`，連接埠 587/465 等，帳號固定為 `resend`，密碼為 API Key），但官方文件明確將「完成網域驗證（Verified Domain）」列為使用前提，**沒有提供像 Brevo/SendGrid 那種免 DNS 的單一寄件人驗證機制**。

官方內建的測試信箱（`delivered@resend.dev`、`bounced@resend.dev`、`complained@resend.dev` 等）只能用來**模擬**送達成功/退信/被標記垃圾信等情境，**無法寄送給任何真實收件人**——這點比 Mailgun 的 Sandbox 網域（至少能寄給 5 個真實授權收件人）更受限。因此在完全無法異動公司 DNS 的前提下，Resend 目前無法作為方案使用。

免費額度為每月 3,000 封、每日 100 封，功能與開發體驗現代化；若未來取得公司網域的 DNS 存取權限，可重新評估將 Resend 納入候選。

## 不建議方案：Microsoft Graph API

微軟官方建議以 Graph API 的 `Mail.Send` 應用程式權限取代已逐步淘汰的 SMTP 基本驗證（Basic Auth），且不需暴露 SMTP 帳密、安全性更高。但此方案需要公司 IT 在 Azure AD 建立 App Registration 並核發應用程式權限。若公司 IT 政策不受理此類申請，則此方案不可行；未來若政策鬆綁，可重新評估改採此方案以提升安全性。

## 總結

| 情境 | 建議方案 |
|---|---|
| 正式上線、長期使用 | **Brevo**（首選）或 **SendGrid**（備援） |
| 臨時測試、驗證程式邏輯 | 個人 Gmail 應用程式密碼（測試完畢後應改用 Brevo/SendGrid） |
| 未來 IT 政策鬆綁 | 重新評估 Microsoft Graph API（`Mail.Send` 應用程式權限） |
