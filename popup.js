const PROMPT = `Bu HTML ve CSS kodlarını Tailwind CSS ile yeniden kodla.
- Aynı görünümü birebir elde et (renkler, spacing, tipografi, layout)
- Gereksiz class kullanma
- Slider, accordion, tab gibi interaktif öğeler için Alpine.js kullan
- Tailwind'de olmayan değerler için arbitrary values kullan: w-[123px]
- Responsive breakpoint'leri koru

--- HTML ---
{{HTML}}

--- CSS ---
{{CSS}}`;

let html = "", css = "";

const statusEl  = document.getElementById("status");
const contentEl = document.getElementById("content");
const toastEl   = document.getElementById("toast");
const pickBtn   = document.getElementById("pickBtn");

// On open: fetch stored data from background
chrome.runtime.sendMessage({ type: "GET_CAPTURED" }, (data) => {
  if (data?.html) {
    html = data.html;
    css  = data.css;
    chrome.runtime.sendMessage({ type: "CLEAR_CAPTURED" });
    render();
  } else {
    setStatus("", "İkon'a tıkla → sayfada element seç → Enter veya tıkla");
  }
});

// "Yeni seçim" button — inject picker into active tab and close popup
pickBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { window.__sectionPickerStop?.(); window.__sectionPickerActive = false; }
  }).catch(()=>{}).finally(() => {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  });
  setTimeout(() => window.close(), 300);
});

function render() {
  setStatus("success", "✅ Element yakalandı — prompt ile kopyala.");

  contentEl.innerHTML = `
    <div class="tabs">
      <div class="tab active" data-tab="html">HTML</div>
      <div class="tab" data-tab="css">CSS</div>
    </div>
    <div class="panel active" id="panel-html">
      <pre id="code-html" contenteditable="true" spellcheck="false">${esc(html)}</pre>
    </div>
    <div class="panel" id="panel-css">
      <pre id="code-css" contenteditable="true" spellcheck="false">${esc(css)}</pre>
    </div>
    <div class="actions">
      <button class="btn primary" id="copyPrompt" style="display:flex;align-items:center;justify-content:center;gap:7px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>HTML, CSS &amp; Prompt Kopyala</button>
    </div>
  `;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab,.panel").forEach(el => el.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab)?.classList.add("active");
    });
  });

  document.getElementById("copyPrompt").addEventListener("click", () => {
    copy(
      PROMPT.replace("{{HTML}}", html).replace("{{CSS}}", css),
      "Kopyalandı — AI'ya yapıştır! 🚀"
    );
  });
}

function copy(text, msg) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(msg)).catch(() => fallback(text, msg));
  } else {
    fallback(text, msg);
  }
}
function fallback(text, msg) {
  const ta = Object.assign(document.createElement("textarea"), { value: text });
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  toast(msg);
}
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}
function setStatus(cls, msg) { statusEl.className = cls; statusEl.textContent = msg; }
function esc(s) {
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
