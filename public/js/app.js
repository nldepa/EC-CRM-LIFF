// ==========================================================
// 🚀 FINAL PRODUCTION RELEASE — LIFF v5.0 (Ultimate Stable)
// ==========================================================

let isSubmitting = false;
let isRefreshing = false;
let retryPayload = null;
const SAFE_REFRESH_SECONDS = 300;

/* ---------------------------------------------------------
   ★ UTM Tracking
--------------------------------------------------------- */
function getQueryUTM() {
  const p = new URLSearchParams(location.search);
  return {
    utm_source: p.get("utm_source") || "",
    utm_medium: p.get("utm_medium") || "",
    utm_campaign: p.get("utm_campaign") || "",
    utm_content: p.get("utm_content") || "",
    utm_term: p.get("utm_term") || ""
  };
}
/*
 utm_source: p.get("utm_source"):utm_source_code
 utm_medium: p.get("utm_medium") || "",:utm_medium_code

*/ 

function saveUTM(utm) {
  if (!utm || (!utm.utm_source && !utm.utm_campaign && !utm.utm_medium)) return; // 避免覆蓋空值
  document.cookie = `utm=${encodeURIComponent(JSON.stringify(utm))}; path=/; max-age=2592000`;
  try { localStorage.setItem("utm", JSON.stringify(utm)); } catch {}
}

function loadUTM() {
  const fromURL = getQueryUTM();
  if (fromURL.utm_source || fromURL.utm_campaign) return fromURL;

  const cookie = document.cookie.split("; ").find(x => x.startsWith("utm="));
  if (cookie) {
    try { return JSON.parse(decodeURIComponent(cookie.split("=")[1])); } catch {}
  }

  try { return JSON.parse(localStorage.getItem("utm")) || {}; } catch {
    return {};
  }
}

/* ---------------------------------------------------------
   ★ LIFF Loader
--------------------------------------------------------- */
async function ensureLIFF() {
  if (window?.liff) return true;

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject("❌ LIFF SDK 載入失敗，請於 LINE App 開啟本頁");
    document.head.appendChild(s);
  });
}


/* ---------------------------------------------------------
   ★ UI Helper
--------------------------------------------------------- */
function showForm() {
  const form = document.getElementById("form");
  if (form) {
    form.classList.remove("hidden");
    form.style.display = "block";
    form.style.visibility = "visible";
    form.style.opacity = "1";
  }
}

function lockSubmit(btn, lock = true) {
  if (!btn) return;
  btn.disabled = lock;
  btn.innerText = lock ? "送出中…" : "送出";
}


/* ---------------------------------------------------------
   ★ Token Refresh
--------------------------------------------------------- */
async function refreshTokenAndRetry(formEl, authStatus, router) {
  if (isRefreshing) return;
  isRefreshing = true;

  if (authStatus) authStatus.textContent = "🔄 Token 更新中…";

  retryPayload = { formEl, authStatus, router };

  try { liff.logout(); } catch {}

  return liff.login({
    redirectUri: location.href,
    state: encodeURIComponent(JSON.stringify(loadUTM()))
  });
}

function startTokenMonitor(formEl, authStatus, router) {
  setInterval(() => {
    const decoded = liff.getDecodedIDToken?.();
    if (!decoded?.exp) return;

    const remain = (decoded.exp * 1000 - Date.now()) / 1000;

    if (remain < SAFE_REFRESH_SECONDS && !isRefreshing) {
      refreshTokenAndRetry(formEl, authStatus, router);
    }
  }, 120000);
}


/* ---------------------------------------------------------
   ★ Form Submit (Supports Checkbox Arrays & Single Value Normalization)
--------------------------------------------------------- */
async function sendForm(formEl, authStatus, router) {
  if (isSubmitting) return;
  isSubmitting = true;

  const btn = formEl.querySelector("button[type=submit]");
  lockSubmit(btn, true);

  const formData = new FormData(formEl);
  const payload = {};

  for (const key of formData.keys()) {
    const values = formData.getAll(key);

    // 🔥 Fix: Only keys that logically should be array become array
    if (values.length > 1 && key !== "line_user_id") {
      payload[key] = values;
    } else {
      payload[key] = values[0];
    }
  }

  Object.assign(payload, loadUTM());
  payload.id_token = liff.getIDToken() || "";
  payload.activity = router === "log" ? "LINE Login" : "活動報名表單";

  console.log("📤 Sending Payload:", payload);

  try {
    const res = await fetch("/api/line-receiver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const raw = await res.text();
    let json = {};
    try { json = JSON.parse(raw); } catch {}

    if (res.status === 401 || json?.error?.includes("invalid")) {
      return refreshTokenAndRetry(formEl, authStatus, router);
    }

    if (json?.ok) {
      const redirectUrl = "https://line.me/R/ti/p/@872qdken";
      if (router === "log") {
        const logStatus = document.getElementById("logStatusText");
        const fallbackBtn = document.getElementById("fallbackBtn");
        const spinner = document.querySelector(".status-spinner");
        if (logStatus) logStatus.innerHTML = "✅ 紀錄成功！<br>若未自動跳轉，請點擊下方按鈕";
        if (logStatus) logStatus.classList.replace("text-secondary", "text-success");
        if (spinner) spinner.style.display = "none";
        if (fallbackBtn) fallbackBtn.style.display = "inline-block";
        
        window.location.href = redirectUrl;
        return;
      }
      alert("🎉 已成功送出！即將加入 LINE 官方帳號！");
      return liff.openWindow({ url: redirectUrl, external: true });
    }

    if (router === "log") {
      const logStatus = document.getElementById("logStatusText");
      const spinner = document.querySelector(".status-spinner");
      if (logStatus) logStatus.textContent = "⚠️ 送出失敗：" + (json?.message || raw);
      if (logStatus) logStatus.classList.replace("text-secondary", "text-danger");
      if (spinner) spinner.style.display = "none";
    } else {
      alert("⚠️ 送出失敗：" + (json?.message || raw));
    }

  } catch (err) {
    if (router === "log") {
      const logStatus = document.getElementById("logStatusText");
      const spinner = document.querySelector(".status-spinner");
      if (logStatus) logStatus.textContent = "❌ 網路錯誤：" + err.message;
      if (logStatus) logStatus.classList.replace("text-secondary", "text-danger");
      if (spinner) spinner.style.display = "none";
    } else {
      alert("❌ 網路錯誤：" + err.message);
    }

  } finally {
    isSubmitting = false;
    lockSubmit(btn, false);
  }
}


/* ---------------------------------------------------------
   ★ INIT
--------------------------------------------------------- */
async function init() {
  try {
    saveUTM(getQueryUTM());

    await ensureLIFF().catch(err => { throw new Error(err); });

    // 精確判斷是否為自動紀錄的 log 頁面（避免 line-log.html 被誤判）
    const page = (location.pathname.endsWith("/log") || location.pathname.endsWith("/log.html")) ? "log" : "main";

    
    // 優先使用 HTML 中經由 Worker 注入的 LIFF_ID
    let liffId = typeof window !== "undefined" && window.LIFF_ID && window.LIFF_ID !== "{{LIFF_ID}}"
      ? window.LIFF_ID
      : (page === "log" ? "2005447385-dPMQKmkO" : "2005447385-XRoOK8zx");

    console.log("🛠 Using LIFF ID:", liffId);
    
    // 把目前的進度顯示在畫面上，幫助除錯
    const logStatus = document.getElementById("logStatusText");
    if (logStatus) logStatus.innerText = "正在初始化 LIFF SDK...";

    await liff.init({ liffId });

    if (logStatus) logStatus.innerText = "檢查登入狀態...";

    if (!liff.isLoggedIn()) {
      return liff.login({
        redirectUri: location.href,
        state: encodeURIComponent(JSON.stringify(loadUTM()))
      });
    }

    const form = document.getElementById("form");
    const authStatus = document.getElementById("authStatus");

    if (page !== "log") {
      showForm();
    }

    if (logStatus) logStatus.innerText = "正在取得使用者資料...";
    const profile = await liff.getProfile();

    // 🛠 Fix duplicated hidden fields
    let uidInput = form.querySelector('input[name="line_user_id"]');
    if (!uidInput) {
      uidInput = document.createElement("input");
      uidInput.type = "hidden";
      uidInput.name = "line_user_id";
      form.appendChild(uidInput);
    }
    uidInput.value = profile.userId;

    if (authStatus) {
      authStatus.textContent = `🟢 已登入：${profile.displayName}`;
      authStatus.classList.add("text-success");
    }

    form.addEventListener("validated", () => sendForm(form, authStatus, page));

    // 🔥 Auto-submit if it's the log page
    if (page === "log") {
      if (logStatus) logStatus.innerText = "背景傳送中...";
      sendForm(form, authStatus, page);
    }

    startTokenMonitor(form, authStatus, page);

    if (retryPayload && !isSubmitting && !isRefreshing) {
      const { formEl, authStatus, router } = retryPayload;
      retryPayload = null;
      sendForm(formEl, authStatus, router);
    }
  } catch (initErr) {
    const logStatus = document.getElementById("logStatusText");
    const spinner = document.querySelector(".status-spinner");
    if (logStatus) {
      logStatus.innerHTML = `⚠️ 啟動錯誤: <br><small>${initErr.message}</small>`;
      logStatus.classList.replace("text-secondary", "text-danger");
    } else {
      alert("⚠️ 啟動錯誤: " + initErr.message);
    }
    if (spinner) spinner.style.display = "none";
  }
}


/* ---------------------------------------------------------
   ★ Boot
--------------------------------------------------------- */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
