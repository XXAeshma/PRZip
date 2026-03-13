// PR File Zipper – Popup script

document.addEventListener("DOMContentLoaded", () => {
  const tokenInput     = document.getElementById("tokenInput");
  const saveBtn        = document.getElementById("saveBtn");
  const clearBtn       = document.getElementById("clearBtn");
  const toggleBtn      = document.getElementById("toggleVisibility");
  const statusMsg      = document.getElementById("statusMsg");
  const statusText     = document.getElementById("statusText");
  const statusIcon     = document.getElementById("statusIcon");

  // Load existing token
  chrome.storage.local.get("githubToken", (data) => {
    if (data.githubToken) {
      tokenInput.value = data.githubToken;
      showStatus("ok", "Token saved ✓");
    }
  });

  // Toggle password visibility
  toggleBtn.addEventListener("click", () => {
    const isPassword = tokenInput.type === "password";
    tokenInput.type = isPassword ? "text" : "password";
  });

  // Save
  saveBtn.addEventListener("click", () => {
    const val = tokenInput.value.trim();
    if (!val) {
      showStatus("err", "Please enter a token");
      return;
    }
    chrome.storage.local.set({ githubToken: val }, () => {
      showStatus("ok", "Token saved ✓");
    });
  });

  // Clear
  clearBtn.addEventListener("click", () => {
    chrome.storage.local.remove("githubToken", () => {
      tokenInput.value = "";
      showStatus("err", "Token removed");
      setTimeout(() => hideStatus(), 2500);
    });
  });

  // Enter key
  tokenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
  });

  function showStatus(type, msg) {
    statusMsg.className = `status show ${type}`;
    statusText.textContent = msg;
    if (type === "ok") {
      statusIcon.innerHTML = `<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>`;
    } else {
      statusIcon.innerHTML = `<path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>`;
    }
  }

  function hideStatus() {
    statusMsg.className = "status";
  }
});
