(() => {
  if (window.__sectionPickerActive) return;
  window.__sectionPickerActive = true;

  // ── CSS EXTRACTION ─────────────────────────────────────────────────────────
  const KEEP_PROPS = new Set([
    "display", "position", "top", "right", "bottom", "left", "z-index",
    "flex", "flex-direction", "flex-wrap", "justify-content", "align-items",
    "align-self", "flex-grow", "flex-shrink", "flex-basis", "order", "gap", "row-gap", "column-gap",
    "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "grid-area",
    "width", "min-width", "max-width", "height", "min-height", "max-height",
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "box-sizing", "overflow", "overflow-x", "overflow-y", "aspect-ratio", "float", "clear",
    "font-family", "font-size", "font-weight", "font-style", "line-height",
    "letter-spacing", "text-align", "text-transform", "text-decoration", "color", "white-space", "word-break",
    "background", "background-color", "background-image", "background-size", "background-position", "background-repeat",
    "border", "border-top", "border-right", "border-bottom", "border-left",
    "border-radius", "border-color", "border-width", "border-style",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
    "box-shadow", "opacity", "transform", "transition",
    "object-fit", "cursor", "pointer-events", "list-style", "text-shadow", "outline",
  ]);
  const SKIP_VALUES = new Set([
    "normal", "auto", "none", "0px", "0", "inherit", "initial", "unset", "revert",
    "rgba(0, 0, 0, 0)", "transparent", "currentcolor", "currentColor",
    "start", "baseline", "static", "visible", "medium", "ease", "1", "nowrap", "0s",
  ]);

  function extractCSS(el) {
    const results = [];
    let blockedSheets = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = Array.from(sheet.cssRules || []); }
      catch { blockedSheets++; continue; }
      walkRules(el, rules, results, null);
    }
    if (results.length) {
      return [...results.filter(r => !r.media), ...results.filter(r => r.media)]
        .map(r => {
          const block = `${r.selector} {\n${r.props}\n}`;
          return r.media ? `${r.media} {\n  ${block.replace(/\n/g, "\n  ")}\n}` : block;
        }).join("\n\n");
    }
    // Fallback: computed style for cross-origin / CSS-in-JS sites
    return computedFallback(el);
  }

  function computedFallback(rootEl) {
    const lines = [];
    function processEl(el, selector) {
      const cs = getComputedStyle(el);
      const props = [];
      for (const prop of KEEP_PROPS) {
        const val = cs.getPropertyValue(prop).trim();
        if (!val || SKIP_VALUES.has(val)) continue;
        if (/^(0px\s*)+$/.test(val)) continue;
        props.push(`  ${prop}: ${val};`);
      }
      if (props.length) lines.push(`${selector} {\n${props.join("\n")}\n}`);
    }
    const rootSel = elSel(rootEl);
    processEl(rootEl, rootSel);
    Array.from(rootEl.children).slice(0, 20).forEach((child, i) => {
      processEl(child, `${rootSel} > *:nth-child(${i + 1})`);
    });
    return lines.length
      ? "/* computed fallback — cross-origin stylesheet */\n\n" + lines.join("\n\n")
      : "/* CSS alinamadi */";
  }

  function elSel(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `${tag}${id}${cls}`;
  }
  function walkRules(el, rules, out, media) {
    for (const rule of rules) {
      if (rule.type === CSSRule.MEDIA_RULE) { walkRules(el, Array.from(rule.cssRules), out, `@media ${rule.conditionText}`); continue; }
      if (rule.type === CSSRule.SUPPORTS_RULE) { walkRules(el, Array.from(rule.cssRules), out, media); continue; }
      if (rule.type !== CSSRule.STYLE_RULE) continue;
      const sel = rule.selectorText; if (!sel) continue;
      const base = sel.replace(/:{1,2}[a-z-]+(\([^)]*\))?/gi, "").trim(); if (!base) continue;
      let ok = false;
      try { ok = el.matches(base) || el.querySelector(base) !== null; } catch { continue; }
      if (!ok) continue;
      const props = [];
      for (let i = 0; i < rule.style.length; i++) {
        const p = rule.style[i];
        if (!KEEP_PROPS.has(p)) continue;
        const v = rule.style.getPropertyValue(p).trim();
        if (!v || SKIP_VALUES.has(v)) continue;
        props.push(`  ${p}: ${v};`);
      }
      if (!props.length) continue;
      out.push({ selector: sel, props: props.join("\n"), media });
    }
  }

  function cleanHTML(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("script,noscript,iframe").forEach(n => n.remove());
    clone.querySelectorAll("*").forEach(node => {
      [...node.attributes].forEach(attr => {
        if (/^(data-gtm|data-analytics|data-track|on[a-z]+)/i.test(attr.name))
          node.removeAttribute(attr.name);
      });
    });
    return formatHTML(clone.outerHTML);
  }

  function formatHTML(html) {
    let indent = 0;
    const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
    return html.replace(/>\s*</g, ">\n<").split("\n").map(line => {
      line = line.trim(); if (!line) return null;
      const tag = (line.match(/^<([a-z]+)/i) || [])[1] || "";
      if (/^<\//.test(line)) indent = Math.max(0, indent - 1);
      const out = "  ".repeat(indent) + line;
      if (/^<[^/!]/.test(line) && !/^<\//.test(line) && !VOID.test(tag) && !line.endsWith("/>")) indent++;
      return out;
    }).filter(l => l !== null).join("\n");
  }

  // ── NAVIGATION STACK ───────────────────────────────────────────────────────
  // When going ↑ to parent, remember which child we came from.
  // When going ↓, return to that remembered child (not firstElementChild).
  const childMemory = new WeakMap(); // parent → last visited child

  function goUp() {
    if (!current) return;
    const p = current.parentElement;
    if (!p || p === document.body || p === document.documentElement) return;
    childMemory.set(p, current); // remember we came from `current`
    select(p);
  }

  function goDown() {
    if (!current) return;
    // Return to remembered child if exists, else first child
    const remembered = childMemory.get(current);
    const target = (remembered && current.contains(remembered))
      ? remembered
      : current.firstElementChild;
    if (target) select(target);
  }

  function goPrev() {
    if (!current) return;
    const prev = current.previousElementSibling;
    if (prev) select(prev);
  }

  function goNext() {
    if (!current) return;
    const next = current.nextElementSibling;
    if (next) select(next);
  }

  // ── UI ELEMENTS ────────────────────────────────────────────────────────────
  let current = null;
  let panelVisible = false;

  // Highlight overlay
  const hl = document.createElement("div");
  hl.style.cssText = `
    position:fixed;pointer-events:none;z-index:2147483640;
    border:2px solid #ff5c00;background:rgba(255,92,0,0.08);
    border-radius:3px;box-sizing:border-box;
    transition:left .07s,top .07s,width .07s,height .07s;
  `;
  document.body.appendChild(hl);

  // Tag badge
  const badge = document.createElement("div");
  badge.style.cssText = `
    position:fixed;pointer-events:none;z-index:2147483642;
    background:#ff5c00;color:#fff;font:bold 10px/1 monospace;
    padding:3px 7px 4px;border-radius:0 0 4px 4px;white-space:nowrap;
  `;
  document.body.appendChild(badge);

  // Bottom breadcrumb bar
  // Top shortcut bar
  const shortcuts = document.createElement("div");
  shortcuts.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:2147483641;
    background:rgba(10,10,18,0.96);backdrop-filter:blur(6px);
    border-bottom:1px solid #7a2e00;
    display:flex;align-items:center;justify-content:center;gap:6px;
    padding:7px 16px;flex-wrap:wrap;
  `;
  const keys = [
    ["↑", "Parent'a çık"], ["↓", "Child'a gir"],
    ["←", "Önceki sibling"], ["→", "Sonraki sibling"],
    ["Enter / Tıkla", "Seç & kopyala"], ["Shift+Enter/Tıkla", "Direkt Resim"], ["ESC", "İptal"],
  ];
  keys.forEach(([key, desc]) => {
    const item = document.createElement("span");
    item.style.cssText = "display:flex;align-items:center;gap:4px;white-space:nowrap;font:11px/1 -apple-system,sans-serif";
    item.innerHTML = `<kbd style="background:#3d1a00;border:1px solid #7a2e00;color:#ffb380;font:bold 11px/1 monospace;padding:3px 7px;border-radius:4px;box-shadow:0 2px 0 #5c2200">${key}</kbd><span style="color:#a59f85">${desc}</span>`;
    shortcuts.appendChild(item);
    if (key !== "ESC") {
      const sep = document.createElement("span");
      sep.style.cssText = "color:#3d1a00;font-size:14px";
      sep.textContent = "·";
      shortcuts.appendChild(sep);
    }
  });
  document.body.appendChild(shortcuts);

  // Bottom breadcrumb bar
  const bar = document.createElement("div");
  bar.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;z-index:2147483641;
    background:rgba(10,10,18,0.95);backdrop-filter:blur(6px);
    color:#ff5c00;font:11px/1 monospace;padding:6px 12px 8px;
    display:flex;align-items:center;gap:3px;flex-wrap:wrap;
    border-top:1px solid #7a2e00;
  `;
  document.body.appendChild(bar);

  // Result panel (replaces popup)
  const panel = document.createElement("div");
  panel.style.cssText = `
    position:fixed;top:16px;right:16px;width:420px;z-index:2147483647;
    background:#1e1e1e;border:1px solid #7a2e00;border-radius:10px;
    box-shadow:0 8px 32px rgba(0,0,0,0.7);font-family:-apple-system,sans-serif;
    display:none;flex-direction:column;overflow:hidden;
    max-height:calc(100vh - 40px);
  `;
  document.body.appendChild(panel);

  // ── SELECT ELEMENT ─────────────────────────────────────────────────────────
  function select(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    current = el;
    const r = el.getBoundingClientRect();

    hl.style.left = r.left + "px";
    hl.style.top = r.top + "px";
    hl.style.width = r.width + "px";
    hl.style.height = r.height + "px";

    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    badge.textContent = `${tag}${id}${cls}`;
    badge.style.left = r.left + "px";
    badge.style.top = Math.max(0, r.top - 20) + "px";

    updateBreadcrumb(el);
  }

  function updateBreadcrumb(el) {
    const ancestors = [];
    let p = el;
    while (p && p !== document.documentElement) {
      const t = p.tagName.toLowerCase();
      const i = p.id ? `#${p.id}` : "";
      const c = typeof p.className === "string" && p.className
        ? "." + p.className.trim().split(/\s+/)[0] : "";
      ancestors.unshift({ text: `${t}${i}${c}`, el: p });
      p = p.parentElement;
    }

    bar.innerHTML = "";

    ancestors.slice(-6).forEach((a, idx, arr) => { // show last 6 ancestors
      const span = document.createElement("span");
      span.textContent = a.text;
      const isActive = idx === arr.length - 1;
      span.style.cssText = `
        cursor:pointer;padding:2px 5px;border-radius:3px;
        color:${isActive ? "#fff" : "#ff5c00"};
        background:${isActive ? "#7a2e00" : "transparent"};
        transition:background .1s;
      `;
      if (!isActive) {
        span.addEventListener("mouseenter", () => span.style.background = "#3d1a00");
        span.addEventListener("mouseleave", () => span.style.background = "transparent");
        span.addEventListener("click", e => { e.stopPropagation(); select(a.el); });
      }
      bar.appendChild(span);
      if (!isActive) {
        const sep = document.createElement("span");
        sep.textContent = "›"; sep.style.color = "#7a2e00";
        bar.appendChild(sep);
      }
    });

    const hint = document.createElement("span");
    hint.style.cssText = "margin-left:auto;color:#a59f85;font-size:10px;white-space:nowrap";
    hint.innerHTML = `<b style="color:#a59f85">↑↓</b> parent/child &nbsp;<b style="color:#a59f85">←→</b> sibling &nbsp;<b style="color:#a59f85">Enter</b> seç &nbsp;<b style="color:#a59f85">ESC</b> çık`;
    bar.appendChild(hint);
  }

  // ── RESULT PANEL ──────────────────────────────────────────────────────────
  const DEFAULT_PROMPT = `<style>
{{CSS}}
</style>

{{HTML}}

---
Bu kodu Tailwind CSS ile yeniden kodla.
- Aynı görünümü tailwind default classları ile birebir elde et (renkler, spacing, tipografi, layout). Yani text-[13px] gibi değerler yerine text-sm gibi kullan.
- Gereksiz class kullanma
- data-* attribute'lerini mevcut yapıda bırak. Sadece tasarımı buradaki gibi olsun.
- data-* attribute'leri kullanarak Slider, accordion, tab gibi interaktif öğeler için kontrol et. JS yazmayacaksın.
- Responsive breakpoint'leri koru
- Döngüleri, değişkenleri vb. değerleri kullan.`;

  const STORAGE_KEY = "picktotailwind_prompt";
  function getPrompt() {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_PROMPT; } catch { return DEFAULT_PROMPT; }
  }
  function savePrompt(val) {
    try { localStorage.setItem(STORAGE_KEY, val); } catch { }
  }

  const TAB_STYLE_ACTIVE = "padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;color:#ff5c00;border-bottom:2px solid #ff5c00;margin-bottom:-1px";
  const TAB_STYLE_IDLE = "padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;color:#a59f85;border-bottom:2px solid transparent;margin-bottom:-1px";
  const PRE_STYLE = "padding:10px 14px;font-size:10px;line-height:1.7;font-family:'Fira Code',Consolas,monospace;color:#c9d1d9;white-space:pre-wrap;word-break:break-all;margin:0;user-select:text;-webkit-user-select:text;cursor:text";
  const TEXTAREA_STYLE = "width:100%;box-sizing:border-box;padding:10px 14px;font-size:10px;line-height:1.7;font-family:'Fira Code',Consolas,monospace;color:#c9d1d9;background:transparent;border:none;outline:none;resize:none;min-height:220px;white-space:pre-wrap;word-break:break-all";

  function showPanel(html, css) {
    panelVisible = true;
    panel.style.display = "flex";

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #3e3d32;background:#252526;flex-shrink:0">
        <span style="font-weight:700;font-size:12px;color:#ffb380">✅ Element yakalandı</span>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="sp-newpick" style="background:#3d1a00;border:1px solid #7a2e00;color:#ffb380;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer">🎯 Yeni Seçim</button>
          <button id="sp-close" style="background:none;border:none;color:#4b5563;font-size:16px;cursor:pointer;line-height:1;padding:2px 4px">✕</button>
        </div>
      </div>

      <div style="display:flex;border-bottom:1px solid #3e3d32;padding:0 14px;flex-shrink:0">
        <div class="sp-tab" data-tab="html" style="${TAB_STYLE_ACTIVE}">HTML</div>
        <div class="sp-tab" data-tab="css"  style="${TAB_STYLE_IDLE}">CSS</div>
        <div class="sp-tab" data-tab="prompt" style="${TAB_STYLE_IDLE}">⚙️ Prompt</div>
      </div>

      <div id="sp-panel-html" style="overflow-y:auto;flex:1">
        <pre style="${PRE_STYLE}">${escHTML(html)}</pre>
      </div>
      <div id="sp-panel-css" style="overflow-y:auto;flex:1;display:none">
        <pre style="${PRE_STYLE}">${escHTML(css)}</pre>
      </div>
      <div id="sp-panel-prompt" style="overflow-y:auto;flex:1;display:none;flex-direction:column">
        <div style="padding:8px 14px 4px;font-size:10px;color:#a59f85;flex-shrink:0">
          Prompt şablonunda <code style="color:#ff5c00;background:#3d1a00;padding:1px 5px;border-radius:3px">{{HTML}}</code> ve <code style="color:#ff5c00;background:#3d1a00;padding:1px 5px;border-radius:3px">{{CSS}}</code> alanlarına otomatik eklenir.
        </div>
        <textarea id="sp-prompt-editor" style="${TEXTAREA_STYLE}" spellcheck="false"></textarea>
        <div style="display:flex;gap:6px;padding:6px 14px;border-top:1px solid #3e3d32;flex-shrink:0">
          <button id="sp-prompt-save" style="flex:1;padding:5px;border-radius:5px;border:1px solid #7a2e00;background:#3d1a00;color:#ffb380;font-size:11px;font-weight:700;cursor:pointer">💾 Kaydet</button>
          <button id="sp-prompt-reset" style="padding:5px 10px;border-radius:5px;border:1px solid #3e3d32;background:#252526;color:#a59f85;font-size:11px;font-weight:700;cursor:pointer">↩ Varsayılan</button>
        </div>
        <div id="sp-prompt-saved" style="display:none;text-align:center;padding:4px;font-size:10px;color:#34d399;font-weight:700">✅ Kaydedildi</div>
      </div>

      <div style="padding:10px 14px;border-top:1px solid #3e3d32;flex-shrink:0;display:flex;gap:8px;align-items:stretch">
        <button id="sp-copy" style="flex:1;padding:9px 12px;border-radius:7px;border:none;cursor:pointer;font-size:12px;font-weight:700;background:linear-gradient(135deg,#ff5c00,#cc4900);color:#fff;letter-spacing:.01em;transition:opacity .15s;display:flex;align-items:center;justify-content:center;gap:7px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          HTML, CSS &amp; Prompt Kopyala
        </button>
        <button id="sp-screenshot-copy" title="Ekran görüntüsünü kopyala" style="padding:7px 10px;border-radius:7px;border:1px solid #7a2e00;cursor:pointer;background:#3d1a00;color:#ffb380;transition:opacity .15s;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:52px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style="font-size:9px;font-weight:700;letter-spacing:.02em;line-height:1">Kopyala</span>
        </button>
        <button id="sp-screenshot-dl" title="Ekran görüntüsünü indir" style="padding:7px 10px;border-radius:7px;border:1px solid #7a2e00;cursor:pointer;background:#3d1a00;color:#ffb380;transition:opacity .15s;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:52px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/><polyline points="12 17 12 21"/><polyline points="10 19 12 21 14 19"/></svg>
          <span style="font-size:9px;font-weight:700;letter-spacing:.02em;line-height:1">İndir</span>
        </button>
      </div>
      <div id="sp-toast" style="display:none;text-align:center;padding:6px 14px 10px;font-size:11px;color:#34d399;font-weight:700"></div>
    `;

    // Load saved prompt into editor
    panel.querySelector("#sp-prompt-editor").value = getPrompt();

    // Tabs
    panel.querySelectorAll(".sp-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        panel.querySelectorAll(".sp-tab").forEach(t => t.style.cssText = TAB_STYLE_IDLE);
        tab.style.cssText = TAB_STYLE_ACTIVE;
        panel.querySelector("#sp-panel-html").style.display = tab.dataset.tab === "html" ? "block" : "none";
        panel.querySelector("#sp-panel-css").style.display = tab.dataset.tab === "css" ? "block" : "none";
        panel.querySelector("#sp-panel-prompt").style.display = tab.dataset.tab === "prompt" ? "flex" : "none";
      });
    });

    panel.querySelector("#sp-close").addEventListener("click", () => {
      panel.style.display = "none";
      panelVisible = false;
    });

    panel.querySelector("#sp-newpick").addEventListener("click", () => {
      panel.style.display = "none";
      panelVisible = false;
      document.addEventListener("mousemove", onMove, true);
      document.body.style.cursor = "crosshair";
    });

    panel.querySelector("#sp-prompt-save").addEventListener("click", () => {
      const val = panel.querySelector("#sp-prompt-editor").value;
      savePrompt(val);
      const saved = panel.querySelector("#sp-prompt-saved");
      saved.style.display = "block";
      setTimeout(() => saved.style.display = "none", 1500);
    });

    panel.querySelector("#sp-prompt-reset").addEventListener("click", () => {
      panel.querySelector("#sp-prompt-editor").value = DEFAULT_PROMPT;
      savePrompt(DEFAULT_PROMPT);
      const saved = panel.querySelector("#sp-prompt-saved");
      saved.textContent = "↩ Varsayılana döndürüldü";
      saved.style.display = "block";
      setTimeout(() => { saved.style.display = "none"; saved.textContent = "✅ Kaydedildi"; }, 1500);
    });

    panel.querySelector("#sp-copy").addEventListener("click", () => {
      const promptTemplate = getPrompt();
      const full = promptTemplate.replace("{{HTML}}", html).replace("{{CSS}}", css);
      copyText(full, () => {
        const t = panel.querySelector("#sp-toast");
        t.textContent = "Kopyalandı — AI'ya yapıştır! 🚀";
        t.style.display = "block";
        setTimeout(() => t.style.display = "none", 2500);
      });
    });

    ["sp-screenshot-copy", "copy"].concat(["sp-screenshot-dl", "download"]).reduce((_, __, i, arr) => {
      if (i % 2 !== 0) return;
      const [id, mode] = [arr[i], arr[i + 1]];
      panel.querySelector(`#${id}`).addEventListener("click", () => {
        if (!current) return;
        const rect = current.getBoundingClientRect();
        const btn = panel.querySelector(`#${id}`);
        const prev = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
        btn.style.opacity = "0.5";
        const overlays = [panel, hl, badge, bar, shortcuts];
        const prevDisplay = overlays.map(el => el.style.display);
        overlays.forEach(el => { el.style.display = "none"; });
        requestAnimationFrame(() => setTimeout(() => {
          chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (res) => {
            overlays.forEach((el, i) => { el.style.display = prevDisplay[i]; });
            btn.innerHTML = prev;
            btn.style.opacity = "1";
            if (!res?.dataUrl) return;
            cropAndCopyScreenshot(res.dataUrl, rect, mode);
          });
        }, 60));
      });
    }, null);
  }

  function cropAndCopyScreenshot(dataUrl, rect, mode = "copy") {
    const dpr = window.devicePixelRatio || 1;
    const img = new Image();
    img.onload = () => {
      const sx = Math.round(rect.left * dpr);
      const sy = Math.round(rect.top * dpr);
      const sw = Math.round(rect.width * dpr);
      const sh = Math.round(rect.height * dpr);
      const MAX = 1000;
      const scale = sw > MAX ? MAX / sw : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const showToast = (msg) => {
        let t = panelVisible ? panel.querySelector("#sp-toast") : null;
        if (!t) {
          t = document.getElementById("sp-global-toast");
          if (!t) {
            t = document.createElement("div");
            t.id = "sp-global-toast";
            t.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#252526;border:1px solid #7a2e00;color:#34d399;font:bold 13px/1 sans-serif;padding:10px 20px;border-radius:8px;box-shadow:0 8px 16px rgba(0,0,0,0.6);";
            document.body.appendChild(t);
          }
        }
        t.textContent = msg;
        t.style.display = "block";
        setTimeout(() => t.style.display = "none", 2500);
      };

      if (mode === "download") {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/jpeg", 0.82);
        a.download = "section-screenshot.jpg";
        a.click();
        showToast("⬇️ Görüntü indiriliyor...");
      } else {
        canvas.toBlob(blob => {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
            .then(() => showToast("📋 Görüntü kopyalandı — AI'ya yapıştır!"))
            .catch(() => {
              const a = document.createElement("a");
              a.href = canvas.toDataURL("image/jpeg", 0.82);
              a.download = "section-screenshot.jpg";
              a.click();
              showToast("⬇️ Kopyalanamadı, indirildi.");
            });
        }, "image/png");
      }
    };
    img.src = dataUrl;
  }

  function copyText(text, cb) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(cb).catch(() => fallbackCopy(text, cb));
    } else {
      fallbackCopy(text, cb);
    }
  }

  function quickScreenshot(el, mode = "copy") {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const overlays = [panel, hl, badge, bar, shortcuts];
    const prevDisplay = overlays.map(o => o?.style.display);
    overlays.forEach(o => { if (o) o.style.display = "none"; });
    requestAnimationFrame(() => setTimeout(() => {
      chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (res) => {
        overlays.forEach((o, i) => { if (o) o.style.display = prevDisplay[i]; });
        if (!res?.dataUrl) return;
        cropAndCopyScreenshot(res.dataUrl, rect, mode);
      });
    }, 60));
  }

  function fallbackCopy(text, cb) {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand("copy"); } catch { }
    ta.remove();
    cb();
  }

  function escHTML(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── CAPTURE ────────────────────────────────────────────────────────────────
  function capture(el) {
    if (!el) return;
    // Stop mouse tracking while panel is shown
    document.removeEventListener("mousemove", onMove, true);
    document.body.style.cursor = "";
    const html = cleanHTML(el);
    const css = extractCSS(el);
    // Also send to background for popup fallback
    chrome.runtime.sendMessage({ type: "SECTION_CAPTURED", html, css });
    showPanel(html, css);
  }

  // ── EVENT HANDLERS ─────────────────────────────────────────────────────────
  const onMove = e => {
    if (panelVisible) return;
    // Temporarily hide overlay to hit-test beneath it
    hl.style.display = "none";
    badge.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    hl.style.display = "";
    badge.style.display = "";
    if (el && el !== hl && el !== badge && el !== bar &&
      el !== document.body && el !== document.documentElement) {
      select(el);
    }
  };

  const onClick = e => {
    if (panelVisible) return;
    if (e.target === bar || bar.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      quickScreenshot(current || e.target);
    } else {
      capture(current || e.target);
    }
  };

  const onKey = e => {
    if (e.key === "ArrowUp") { e.preventDefault(); goUp(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); goDown(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); goNext(); return; }
    if (e.key === "Enter" && !panelVisible) {
      e.preventDefault();
      if (e.shiftKey) {
        quickScreenshot(current);
      } else {
        capture(current);
      }
      return;
    }
    if (e.key === "Escape") { stop(); return; }
  };

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  document.body.style.cursor = "crosshair";

  // ── STOP ───────────────────────────────────────────────────────────────────
  function stop() {
    window.__sectionPickerActive = false;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    document.body.style.cursor = "";
    hl.remove(); badge.remove(); bar.remove(); shortcuts.remove(); panel.remove();
    chrome.runtime.sendMessage({ type: "PICKER_STOPPED" });
  }
  window.__sectionPickerStop = stop;
})();
