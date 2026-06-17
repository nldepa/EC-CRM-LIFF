# LINE LIFF 會員資料綁定表單 (Cloudflare Pages)

本專案是一個放置於 Cloudflare Pages 的 LINE LIFF 表單。使用者開啟連結後，將會自動讀取 LINE 帳號資訊（User ID 與暱稱）以及網址自帶的 UTM 參數 (`utm_source` / `utm_medium`)，並在使用者填妥姓名與 Email 後，安全地轉發回後台的 Docker API 綁定，完成後引導前往 LINE 官方帳號 (Messaging API)。

## 專案結構

```
cloudflare-liff-form/
├── public/                 # 靜態前端網頁
│   ├── index.html          # 表單主頁面
│   ├── style.css           # 質感磨砂玻璃風格樣式
│   └── app.js              # LIFF SDK 初始化、防呆驗證與 POST 提交
├── functions/              # Cloudflare Pages Functions (Serverless Workers)
│   └── api/
│       └── submit.js       # 安全中轉 API 程式（轉發至 Docker API 後端）
├── wrangler.toml           # Cloudflare Wrangler 配置文件
├── package.json            # 本地測試與編譯腳本
└── README.md               # 本說明文件
```

## 部署與配置步驟

### 1. 填寫 LINE LIFF ID
在 `public/app.js` 的最上方，將 `LIFF_ID` 替換為您在 LINE Developers 後台建立的 LIFF 應用程式 ID：
```javascript
const LIFF_ID = "2000000000-XXXXXXXX"; // 請替換成您實際的 LIFF ID
```

*注意：該 LIFF 應用的「Endpoint URL」應指向您的 Cloudflare Pages 網址（例如：`https://xxx.pages.dev/`）。*

### 2. 設定 Cloudflare Pages 環境變數
當您在 Cloudflare Dashboard 建立並部署 Pages 專案時，請在 **Settings -> Environment variables** 中設定以下環境變數：

| 變數名稱 | 範例值 | 說明 |
| :--- | :--- | :--- |
| `BACKEND_URL` | `https://api.yourdomain.com` | 您的 Docker API 後台主機網址（結尾不加斜線） |
| `LIFF_BIND_SECRET` | `liff_bind_secret_key_2026_secure` | 與後端 Docker API `.env` 中一致的安全性金鑰，用於防止非法請求 |

*提示：設定完成後請重新部署 (Redeploy) 以使環境變數生效。*

### 3. 後端 Docker API `.env` 設定
請確認您的 CRM 系統後端 `.env` 有加入對應的密鑰：
```env
LIFF_BIND_SECRET=liff_bind_secret_key_2026_secure
```

---

## 本地開發與測試方法

我們內建了**「模擬測試模式」**，即使沒有配置 LINE LIFF，您也可以在一般瀏覽器中打開表單進行姓名與 Email 的填寫與送出測試。

### 1. 安裝 CLI 工具
進入本目錄並安裝 Cloudflare 開發者工具 `wrangler`：
```bash
npm install
```

### 2. 啟動本地開發伺服器
```bash
npm run dev
```
這會在本地啟動一個開發伺服器（預設為 `http://localhost:8788`），同時會執行 `functions/api/submit.js` 中的 Serverless 轉發邏輯。

### 3. 測試 URL 範例 (帶 UTM 參數)
您可以使用以下網址載入表單進行測試（包含 UTM 來源 4 碼，與 UTM 媒介 8 碼）：
```
http://localhost:8788/?utm_source=ad21&utm_medium=fb_share
```
1. 瀏覽器開啟上述網址後，系統會偵測到無法連上 LINE LIFF，並自動開啟**「本地模擬測試模式」**。
2. 填寫**姓名**與 **Email**。
3. 點選「確認送出並綁定」，此請求會被本地 Function 攔截，並轉發至後端 Docker API。
4. 成功後，網頁會出現綠色打勾標誌，3 秒後會自動轉導至 Messaging API 官方帳號的加好友連結 。
