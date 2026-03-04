let capturedData = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "INJECT_PICKER") {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: () => { window.__sectionPickerStop?.(); window.__sectionPickerActive = false; }
    }).catch(()=>{}).finally(() => {
      chrome.scripting.executeScript({ target: { tabId: msg.tabId }, files: ["content.js"] })
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    });
    return true;
  }
  if (msg.type === "SECTION_CAPTURED") {
    capturedData = { html: msg.html, css: msg.css };
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#34d399" });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "GET_CAPTURED") { sendResponse(capturedData || null); return true; }
  if (msg.type === "CLEAR_CAPTURED") {
    capturedData = null;
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true }); return true;
  }
  if (msg.type === "PICKER_STOPPED") { sendResponse({ ok: true }); return true; }
});

// Icon click → inject picker directly
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { window.__sectionPickerStop?.(); window.__sectionPickerActive = false; }
  }).catch(()=>{}).finally(() => {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
      .catch(console.error);
  });
});
