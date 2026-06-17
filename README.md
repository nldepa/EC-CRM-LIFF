# LIFF recover2.0

用 Cloudflare Pages + Functions 建立的 LIFF 表單專案。提供兩個頁面：

* `index.html`：活動報名表單（main）
* `line-log.html`：LINE 登入／快速綁定表單（log）

後端以 Functions 提供：

* `GET /api/ping`：檢查環境變數是否完整
* `POST /api/write`：驗證 LINE id_token 後，轉發資料到後端（Cloudflare Tunnel → `db.php?action=write`）

前端以 `app.js` 共用（依路徑自動選擇不同 LIFF ID、單次提交保護、成功或失敗皆導向 LINE 加好友頁）。

---

## 目錄結構

```
/
├─ index.html                 # 活動報名
├─ line-log.html              # 快速登入/綁定
├─ /js
│  ├─ app.js                  # 共用 LIFF 初始化 + 提交 + 導向好友頁
│  ├─ index-form.js           # index.html 的前端驗證
│  └─ line-log-form.js        # line-log.html 的前端驗證
├─ /css
│  └─ style.css ...           # 樣式（可自行擴充 index/line-log 專屬 css）
└─ /functions
   ├─ _middleware.js          # 依路徑載入對應 HTML 並注入 LIFF_ID
   ├─ ping.js                 # GET /api/ping 檢查 env
   └─ write.js                # POST /api/write 驗證 id_token → 轉發到 Tunnel
```

---

## 環境變數（Cloudflare Pages → Settings → Environment variables）

**必填**（`/api/ping` 會檢查）：

| 變數名                       | 用途                                                                       |
| ------------------------- | ------------------------------------------------------------------------ |
| `LIFF_ID_MAIN`            | `index.html` 使用的 LIFF ID                                                 |
| `LIFF_ID_LOG`             | `line-log.html` 使用的 LIFF ID                                              |
| `LINE_LOGIN_CHANNEL_ID`   | 用於呼叫 `https://api.line.me/oauth2/v2.1/verify` 驗證 id_token                |
| `TUNNEL_BASE`             | 指向你後端 PHP 的 Cloudflare Tunnel 基底 URL（例如 `https://xxx.trycloudflare.com`） |
| `CF_ACCESS_CLIENT_ID`     | 若 Tunnel 後面有 Cloudflare Access 保護，填入 Client ID                           |
| `CF_ACCESS_CLIENT_SECRET` | 同上，Client Secret                                                         |

> 小提醒：若尚未設定 Access，可先留空，但 `write.js` 的轉發就不要帶 Access header（或先以允許匿名測試）。

---

## 運作流程

### 1) _middleware：注入 LIFF ID

* 依 `pathname` 是否包含 `log` 決定載入 `index.html` 或 `line-log.html`
* 將 HTML 中的 `{{LIFF_ID}}` 以 `env.LIFF_ID_MAIN` 或 `env.LIFF_ID_LOG` 取代

### 2) 前端流程（共用 `app.js`）

1. `getActiveLiffId()`：

   * 若頁面直接宣告 `const LIFF_ID = "..."` 則優先採用
   * 否則依路徑自動選擇 `LIFF_ID_MAIN` 或 `LIFF_ID_LOG`
2. `initLiff()`：

   * `liff.init()` → 未登入則 `liff.login({ redirectUri: location.href })`
   * 取得 `id_token`、`profile`，將 `#form` 顯示
   * 綁定 `validated` 與 `submit` 事件（避免重複送出）
3. `submitForm()`：

   * 將整個 `<form>` 以 `FormData` 轉為 JSON（支援 checkbox 多值）
   * 預先補上 `id_token` 與 `activity` 欄位
   * `POST /api/write`
   * 依回應：

     * `ok: true` → alert 成功，**立即**導向 LINE 加好友連結
     * 非 `ok` 或 `fetch` 失敗 → 告知失敗，但仍導向 LINE 加好友

> **加好友跳轉**：請在 `app.js` 裡設定你的官方帳號連結：
>
> ```js
> const botUrl = "https://line.me/R/ti/p/@你的BotID";
> ```

### 3) 後端 `/api/write`

* 解析 JSON，檢查 `id_token`
* 呼叫 `POST https://api.line.me/oauth2/v2.1/verify`（參數：`id_token`, `client_id=LINE_LOGIN_CHANNEL_ID`）
* 取回 `sub` 當作 `line_user_id`
* **將 `id_token` 自 payload 移除**，其餘欄位 + `line_user_id` 一併轉發到：

  * `${TUNNEL_BASE}/db.php?action=write`
  * 帶上 `CF-Access-Client-Id` / `CF-Access-Client-Secret`（若有設）
* 直接回傳上游文字或 JSON 給前端

---

## 安裝 / 開發

### 本地開發

此專案以 Cloudflare Pages + Functions 為主。若要本地跑 Functions：

```bash
# 若使用 Wrangler 本地開發
wrangler pages dev .
# 或指定 Functions 目錄
wrangler pages dev --local true
```

> 請在本地 `.dev.vars` 或終端環境設好上述環境變數。

### 部署到 Cloudflare Pages

1. 將 repo 連接到 Cloudflare Pages
2. 設定 **Build command**（純靜態可留空）與 **Build output directory**（根目錄或 `dist`）
3. 在 **Environment variables** 填入上面列的變數（Production / Preview 皆填）
4. 部署完成後，先打 `GET /api/ping` 檢查變數

---

## 前端驗證

* `index-form.js`、`line-log-form.js` 會攔截原生 submit，先跑 HTML5 驗證規則：

  * 姓名（中文 2–25）
  * 手機（`^09\d{8}$`）
  * Email（型別驗證）
* 驗證通過後會觸發自訂事件 `validated`，再由 `app.js` 呼叫 `submitForm()`

---

## API 使用說明

### `GET /api/ping`

回傳目前環境變數配置與缺漏提示：

```json
{
  "ok": true,
  "env": {
    "LIFF_ID_MAIN": "...",
    "LIFF_ID_LOG": "...",
    "LINE_LOGIN_CHANNEL_ID": "...",
    "TUNNEL_BASE": "...",
    "CF_ACCESS_CLIENT_ID": "(set)",
    "CF_ACCESS_CLIENT_SECRET": "(set)"
  },
  "missing": [],
  "branch": "production",
  "hint": "All good 🎉"
}
```

### `POST /api/write`

**Request Body（前端送出）**

```json
{
  "id_token": "<LINE id_token>",
  "activity": "活動報名表單",
  "router": "main",
  "event_name": "2025 活動報名",
  "name": "王小明",
  "line_name": "小明",
  "tel": "0912345678",
  "email": "a@b.com",
  "Disability": ["第一類", "第二類"],
  "degree": "輕度",
  "employment_unit": "xxx 協會",
  "notes": "..."
}
```

**Response（視上游 `db.php` 而定）**

```json
{ "ok": true, "id": 123 }
```

或

```json
{ "ok": false, "error": "..." }
```

---

## 常見問題（FAQ）

### Q1. 送出顯示 `530 / error code: 1016`？

* 通常是 `TUNNEL_BASE` 解析不到或 Tunnel 尚未啟動
* 先打 `GET /api/ping` 確認 `TUNNEL_BASE` 是否正確
* 若有 Cloudflare Access，請確認 `CF_ACCESS_CLIENT_ID/SECRET` 有效

### Q2. 為什麼送出後按鈕沒恢復？

* 目前 `app.js` 已在 `finally` 調整 `authStatus`，按鈕狀態交由表單驗證腳本控制
* 若要 UX 更完整，可在 `submitForm` 內對 `button[type=submit]` 做 disable/enable

### Q3. 為什麼失敗也會跳轉到加好友頁？

* 目前設計為「成功或失敗都導向加好友」以提升轉換
* 若需改成 **只有成功才導向**，請修改 `app.js`：把導向邏輯從 `catch/finally` 移除

### Q4. 如何改成每頁手動指定 LIFF ID？

* 在 HTML 放置：

  ```html
  <script>const LIFF_ID = "你的 LIFF ID";</script>
  ```
* `app.js` 的 `getActiveLiffId()` 會優先使用該值

---

## 安全建議

* **不要**把敏感金鑰放在前端（`CHANNEL_SECRET` 等）
* `id_token` 只用於伺服端驗證，**不要**保存到 DB
* 若 Tunnel 後面有 Access，務必設定 `CF_ACCESS_CLIENT_ID/SECRET`
* 請對 `db.php` 做最基本的輸入檢查與防注入處理

---

## 自訂化建議

* 導向好友頁 URL：

  * `app.js` → `const botUrl = "https://line.me/R/ti/p/@你的BotID";`
* 活動名稱（readonly 欄位）：

  * `index.html` → `<input name="event_name" id="eventName" value="2025 活動報名" readonly />`
  * 也可改為從 URL 參數讀取（例如 `?event=公益講座`）

---

## 版權

© 社團法人台北市新生命促進身障就業協會
