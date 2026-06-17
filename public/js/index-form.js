document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form");
  if (!form) return;

  const inputs = form.querySelectorAll("input[required], textarea[required]");
  const btn = form.querySelector('button[type="submit"]');
    // === 顯示「其他」輸入欄 ===
  const radios = document.querySelectorAll('input[name="platform_source"]');
  const otherInput = document.getElementById('platformOtherText');

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.id === 'platformOTHER' && radio.checked) {
        otherInput.style.display = 'block';
        otherInput.setAttribute('required', 'required');
        otherInput.placeholder = '請說明';
      } else {
        otherInput.style.display = 'none';
        otherInput.removeAttribute('required');
        otherInput.value = '';
      }
    });
  });

  // 建立提示訊息元素
  inputs.forEach((input) => {
    const msg = document.createElement("div");
    msg.className = "validation-message";
    input.insertAdjacentElement("afterend", msg);

    input.addEventListener("input", () => {
      checkField(input, msg);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;
    btn.disabled = true;

    inputs.forEach((input) => {
      const msg = input.nextElementSibling;
      if (!input.checkValidity()) {
        checkField(input, msg);
        valid = false;
      } else {
        msg.textContent = "";
        msg.classList.remove("active");
      }
    });

    if (valid) {
      // ✅ 給 app.js 使用，不干擾原本流程
      form.dispatchEvent(new Event("validated"));
    } else {
      btn.disabled = false;
    }
  });

  function checkField(input, msgEl) {
    if (input.validity.valueMissing) {
      msgEl.textContent = "此欄位為必填。";
    } else if (input.validity.patternMismatch) {
      msgEl.textContent = input.title || "格式不符要求。";
    } else if (input.validity.typeMismatch) {
      msgEl.textContent = "請輸入正確格式。";
    } else {
      msgEl.textContent = "";
    }
    msgEl.classList.add("active");
  }
});
