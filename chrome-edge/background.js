// PR File Zipper – Background service worker
// Minimal – download triggering is handled in content.js via object URLs.
// This worker exists to satisfy MV3 requirements and could be extended
// for offscreen document-based zip generation in the future.

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log("[PR Zipper] Extension installed.");
  }
});
