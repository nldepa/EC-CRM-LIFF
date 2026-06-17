// =========================================================
// LINE LIFF Form Configuration & Logic
// =========================================================

// REPLACE THIS with your actual LIFF ID from LINE Developers Console
const LIFF_ID = "YOUR_LIFF_ID"; 

// LINE Official Account Add-Friend URL
const LINE_BOT_FOLLOW_URL = "https://line.me/R/ti/p/@252egmyd";

document.addEventListener("DOMContentLoaded", () => {
  const formCard = document.getElementById("form_card");
  const successCard = document.getElementById("success_card");
  const bindForm = document.getElementById("bind_form");
  const submitBtn = document.getElementById("submit_btn");
  const spinner = submitBtn.querySelector(".spinner");
  const btnText = submitBtn.querySelector(".btn-text");
  
  // URL parameters parsing (UTM tracking)
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get("utm_source");
  const utmMedium = urlParams.get("utm_medium");

  // Populate UTM inputs and visually display them if present
  if (utmSource || utmMedium) {
    document.getElementById("utm_source").value = utmSource || "";
    document.getElementById("utm_medium").value = utmMedium || "";
    
    const utmContainer = document.getElementById("utm_tags_container");
    const tagSource = document.getElementById("tag_source");
    const tagMedium = document.getElementById("tag_medium");
    
    if (utmSource) tagSource.textContent = `Source: ${utmSource}`;
    if (utmMedium) tagMedium.textContent = `Medium: ${utmMedium}`;
    utmContainer.style.display = "flex";
  }

  // Input elements for validation feedback
  const inputs = bindForm.querySelectorAll("input[required]");
  inputs.forEach(input => {
    input.addEventListener("input", () => {
      const group = input.closest(".form-group");
      if (input.checkValidity()) {
        group.classList.remove("invalid");
      }
    });
  });

  // 1. Initialize LINE LIFF
  if (window.liffLoadError || typeof liff === "undefined") {
    console.error("LINE LIFF SDK failed to load from CDN.");
    showToast("LINE 套件載入失敗，啟用本地測試模式", "error");
    enableMockMode();
  } else if (LIFF_ID && LIFF_ID !== "YOUR_LIFF_ID") {
    liff.init({ liffId: LIFF_ID })
      .then(() => {
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          loadUserProfile();
        }
      })
      .catch((err) => {
        console.error("LIFF initialization failed", err);
        showToast("LINE LIFF 載入失敗，啟用本地測試模式", "error");
        enableMockMode();
      });
  } else {
    // Fallback if LIFF ID is not yet configured (helps development testing)
    console.warn("LINE LIFF ID is not set. Running in Local Mock mode.");
    enableMockMode();
  }

  // Fetch LINE user profile info
  function loadUserProfile() {
    liff.getProfile()
      .then((profile) => {
        // UI updates
        document.getElementById("user_avatar").src = profile.pictureUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a1a1aa'><path d='M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z'/></svg>";
        document.getElementById("line_name_display").textContent = profile.displayName;
        document.getElementById("line_uid_display").textContent = `ID: ${maskString(profile.userId)}`;
        
        // Hidden inputs
        document.getElementById("line_uid").value = profile.userId;
        document.getElementById("line_display_name").value = profile.displayName;
        
        // Enable submit button
        submitBtn.removeAttribute("disabled");
      })
      .catch((err) => {
        console.error("Error getting profile:", err);
        // Prevent token expiration / authorization issues by forcing a re-login
        if (err.code === "UNAUTHORIZED" || err.message?.includes("expired") || err.message?.includes("token")) {
          showToast("登入已過期，正在重新導向 LINE 登入...", "error");
          setTimeout(() => {
            liff.logout();
            liff.login();
          }, 1500);
        } else {
          showToast("無法取得 LINE 個人檔，啟用本地測試模式", "error");
          enableMockMode();
        }
      });
  }

  // Enable Mock Mode for local testing when LIFF is unavailable
  function enableMockMode() {
    document.getElementById("line_name_display").textContent = "測試會員 (模擬模式)";
    document.getElementById("line_uid_display").textContent = "ID: U_mock_test_123456";
    document.getElementById("line_uid").value = "U_mock_test_123456";
    document.getElementById("line_display_name").value = "測試會員 (模擬模式)";
    submitBtn.removeAttribute("disabled");
  }

  // Helper function to mask profile ID for visual assurance
  function maskString(str) {
    if (!str) return "";
    return str.substring(0, 5) + "..." + str.substring(str.length - 4);
  }

  // 2. Submit handler
  bindForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    // Check validation
    let isFormValid = true;
    inputs.forEach(input => {
      const group = input.closest(".form-group");
      if (!input.checkValidity()) {
        group.classList.add("invalid");
        isFormValid = false;
      } else {
        group.classList.remove("invalid");
      }
    });

    if (!isFormValid) {
      showToast("請填寫所有必要欄位且格式正確！", "error");
      return;
    }

    // Set loading state
    submitBtn.setAttribute("disabled", "true");
    spinner.style.display = "inline-block";
    btnText.textContent = "綁定中...";

    const lineDisplayName = document.getElementById("line_display_name").value;
    const payload = {
      customer_name: lineDisplayName || "LINE用戶",
      email: document.getElementById("email").value,
      line_uid: document.getElementById("line_uid").value,
      line_display_name: lineDisplayName,
      utm_source: document.getElementById("utm_source").value || null,
      utm_medium: document.getElementById("utm_medium").value || null,
    };

    // Make API call to Cloudflare Pages Functions
    fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(response => response.json().then(data => ({ status: response.status, body: data })))
      .then(({ status, body }) => {
        if (status !== 200 || !body.success) {
          throw new Error(body.error || "綁定失敗");
        }
        
        // Success: Transition cards
        formCard.style.display = "none";
        successCard.style.display = "block";
        
        // Start Countdown and Redirect
        startCountdown();
      })
      .catch((err) => {
        console.error("Submission failed:", err);
        showToast(err.message || "系統錯誤，請稍後再試。", "error");
        
        // Reset loading state
        submitBtn.removeAttribute("disabled");
        spinner.style.display = "none";
        btnText.textContent = "確認送出並綁定";
      });
  });

  // Countdown timer redirect
  function startCountdown() {
    let secondsLeft = 3;
    const countdownEl = document.getElementById("countdown_sec");
    
    const interval = setInterval(() => {
      secondsLeft--;
      countdownEl.textContent = secondsLeft;
      
      if (secondsLeft <= 0) {
        clearInterval(interval);
        window.location.href = LINE_BOT_FOLLOW_URL;
      }
    }, 1000);
  }

  // Toast helper
  function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "toast";
    
    if (type === "error") {
      toast.classList.add("error");
    }
    
    toast.classList.add("show");
    
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }
});
