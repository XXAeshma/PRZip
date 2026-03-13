// PR File Zipper – Background script (Firefox)
// Minimal – download triggering is handled in content.js via object URLs.
// This script exists to satisfy MV3 requirements and could be extended
// for offscreen document-based zip generation in the future.

browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log("[PR Zipper] Extension installed.");
  }
});
