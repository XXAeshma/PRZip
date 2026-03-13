// PR File Zipper - Content Script v3
// Fixed for GitHub's 2025/2026 UI — all known issues resolved.

(function () {
  "use strict";

  var injected = false;
  var observer = null;
  var lastPathname = location.pathname;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getPRInfo() {
    var match = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], prNumber: match[3] };
  }

  function getStoredToken() {
    return browser.storage.local.get("githubToken").then(function (data) {
      return data.githubToken || "";
    });
  }

  function isOnFilesTab() {
    // URL-based checks
    if (/\/pull\/\d+\/files/.test(location.pathname)) return true;
    if (/\/pull\/\d+\/changes/.test(location.pathname)) return true;

    // Hash-based (older GitHub UI)
    if (location.hash === "#files_bucket" || location.hash === "#files") return true;

    // DOM-based: look for known file diff containers
    if (document.querySelector('#diff-stats')) return true;
    if (document.querySelector('[data-target="diff-layout.mainContainer"]')) return true;
    if (document.querySelector('.js-diff-progressive-container')) return true;
    if (document.querySelector('[class*="PullRequestFilesToolbar"]')) return true;

    return false;
  }

  // ── Find the toolbar to inject the button into ────────────────────────────

  function findInjectionTarget() {
    // Strategy 1: "N / M viewed" progress text (some GitHub UI variants)
    var allEls = document.querySelectorAll("div, span");
    for (var i = 0; i < allEls.length; i++) {
      var text = allEls[i].textContent.trim();
      if (/^\d+ \/ \d+ viewed$/.test(text)) {
        var parent = allEls[i].parentElement;
        if (parent) return { container: parent, mode: "prepend" };
      }
    }

    // Strategy 2: Commit selector dropdown ("All commits" details element)
    var commitDetails = document.querySelector('#diff-filter details') ||
      document.querySelector('.diff-review-filter details') ||
      document.querySelector('[data-hotkey="c"]');
    if (commitDetails) {
      var row = commitDetails.closest('.d-flex') ||
                commitDetails.parentElement;
      if (row) return { container: row, mode: "append" };
    }

    // Strategy 3: Find "All commits" text by scanning visible text
    for (var j = 0; j < allEls.length; j++) {
      var elText = allEls[j].textContent.trim();
      if (elText === "All commits" || /^\d+ commits?$/.test(elText)) {
        // Walk up a few levels to find the toolbar row
        var el = allEls[j];
        for (var k = 0; k < 5; k++) {
          el = el.parentElement;
          if (!el || el === document.body) break;
          var style = window.getComputedStyle(el);
          if (style.display === "flex" || style.display === "inline-flex") {
            return { container: el, mode: "append" };
          }
        }
      }
    }

    // Strategy 4: diff-layout diffBar (data-target based)
    var diffBar = document.querySelector('[data-target="diff-layout.diffBar"]');
    if (diffBar) {
      var flex = diffBar.querySelector(".d-flex");
      if (flex) return { container: flex, mode: "append" };
      return { container: diffBar, mode: "append" };
    }

    // Strategy 5: PR review tools bar (older UI)
    var reviewTools = document.querySelector(".pr-review-tools");
    if (reviewTools) return { container: reviewTools, mode: "prepend" };

    // Strategy 6: files bucket toolbar area
    var filesBucket = document.querySelector("#files_bucket .d-flex.flex-justify-end");
    if (filesBucket) return { container: filesBucket, mode: "prepend" };

    // Strategy 7: Diff stats line
    var diffStats = document.querySelector("#diff-stats") || document.querySelector(".diff-stats");
    if (diffStats) return { container: diffStats, mode: "append" };

    // Strategy 8: toc-diff-stats
    var tocStats = document.querySelector(".toc-diff-stats");
    if (tocStats) return { container: tocStats, mode: "append" };

    // Strategy 9: "Files changed" tab — inject a bar right after the tab navigation
    var tabNav = document.querySelector('.tabnav-tabs') ||
                 document.querySelector('[role="tablist"]') ||
                 document.querySelector('.js-pull-request-tab-container .tabnav');
    if (tabNav) return { container: tabNav.parentElement || tabNav, mode: "after" };

    // Strategy 10: First diff file header — inject just before the first file diff
    var firstFile = document.querySelector('[id^="diff-"]') ||
                    document.querySelector('.file-header') ||
                    document.querySelector('[data-file-type]');
    if (firstFile) return { container: firstFile, mode: "before" };

    // Strategy 11: Float above any diff container as last resort
    var diffContainer =
      document.querySelector('[data-target="diff-layout.mainContainer"]') ||
      document.querySelector(".js-diff-progressive-container") ||
      document.querySelector('[class*="PullRequestFilesToolbar"]') ||
      document.querySelector('[class*="diff-view"]') ||
      document.querySelector(".file-list") ||
      document.querySelector('[class*="Layout-main"]');

    if (diffContainer) return { container: diffContainer, mode: "before" };

    // Strategy 12 (nuclear): Fixed-position floating button
    // If absolutely nothing else matched, create a fixed container
    return { container: document.body, mode: "fixed" };
  }

  // ── Button creation ────────────────────────────────────────────────────────

  function createDownloadButton() {
    var wrapper = document.createElement("div");
    wrapper.id = "przipper-btn-wrapper";
    wrapper.style.cssText = "display:inline-flex;align-items:center;flex-shrink:0;margin-left:8px;";

    var btn = document.createElement("button");
    btn.id = "przipper-download-btn";
    btn.type = "button";
    btn.className = "przipper-btn";
    btn.innerHTML = ICONS.idle + "Download All";
    btn.addEventListener("click", handleDownload);
    wrapper.appendChild(btn);
    return wrapper;
  }

  function injectButton() {
    if (document.getElementById("przipper-btn-wrapper")) return;
    if (!isOnFilesTab()) {
      console.log("[PR Zipper] Not on files tab, skipping injection. Path:", location.pathname);
      return;
    }
    if (!getPRInfo()) {
      console.log("[PR Zipper] Not on a PR page, skipping injection.");
      return;
    }

    var target = findInjectionTarget();
    if (!target) {
      console.log("[PR Zipper] Could not find injection target in DOM. Will retry.");
      return;
    }
    console.log("[PR Zipper] Injecting button via mode:", target.mode, "into:", target.container);

    var btnEl = createDownloadButton();

    switch (target.mode) {
      case "prepend":
        target.container.insertBefore(btnEl, target.container.firstChild);
        break;
      case "append":
        target.container.appendChild(btnEl);
        break;
      case "after":
        // Insert a bar right after the target element
        var afterBar = document.createElement("div");
        afterBar.id = "przipper-float-bar";
        afterBar.style.cssText = "display:flex;justify-content:flex-end;padding:8px 16px 4px;";
        afterBar.appendChild(btnEl);
        target.container.insertAdjacentElement("afterend", afterBar);
        break;
      case "before":
        // Float bar above the target element
        var floatBar = document.createElement("div");
        floatBar.id = "przipper-float-bar";
        floatBar.style.cssText = "display:flex;justify-content:flex-end;padding:8px 16px 4px;";
        floatBar.appendChild(btnEl);
        target.container.insertAdjacentElement("beforebegin", floatBar);
        break;
      case "fixed":
        // Nuclear fallback: fixed-position floating button
        var fixedBar = document.createElement("div");
        fixedBar.id = "przipper-float-bar";
        fixedBar.style.cssText = "position:fixed;top:8px;right:20px;z-index:99999;";
        fixedBar.appendChild(btnEl);
        document.body.appendChild(fixedBar);
        console.log("[PR Zipper] Used fixed-position fallback — no toolbar found.");
        break;
      default:
        target.container.appendChild(btnEl);
    }

    injected = true;
  }

  // ── Download handler ───────────────────────────────────────────────────────

  function buildHeaders(token) {
    var headers = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      var authPrefix = token.startsWith("github_pat_") ? "Bearer " : "token ";
      headers.Authorization = authPrefix + token;
    }
    return headers;
  }

  function handleDownload() {
    var btn = document.getElementById("przipper-download-btn");
    var prInfo = getPRInfo();
    if (!prInfo) return;

    getStoredToken().then(function (token) {
      var headers = buildHeaders(token);

      setButtonState(btn, "loading", "Fetching PR info\u2026");

      // Step 1: Get the PR metadata to find the head branch/sha
      fetch(
        "https://api.github.com/repos/" +
          prInfo.owner +
          "/" +
          prInfo.repo +
          "/pulls/" +
          prInfo.prNumber,
        { headers: headers }
      )
        .then(function (res) {
          if (res.status === 401 || res.status === 403) {
            if (!token) {
              // No token — this is probably a private repo, ask for one
              throw new Error("AUTH_NEEDED");
            }
            if (res.status === 401) throw new Error("401 Unauthorized — token invalid/expired");
            throw new Error("403 Forbidden — check token scopes or SSO authorization");
          }
          if (!res.ok) throw new Error("GitHub API error " + res.status);
          return res.json();
        })
        .then(function (prData) {
          var headRef = prData.head.ref;
          var headSha = prData.head.sha;

          setButtonState(btn, "loading", "Fetching file list\u2026");

          return fetchAllChangedFiles(prInfo, headers).then(function (files) {
            if (!files.length) {
              setButtonState(btn, "error", "No files found");
              setTimeout(function () {
                setButtonState(btn, "idle");
              }, 3000);
              return;
            }
            setButtonState(
              btn,
              "loading",
              "Downloading " + files.length + " files\u2026"
            );
            return downloadAndZip(files, prInfo, headers, headRef, headSha);
          });
        })
        .then(function () {
          setButtonState(btn, "success", "Downloaded!");
          setTimeout(function () {
            setButtonState(btn, "idle");
          }, 3000);
        })
        .catch(function (err) {
          console.error("[PR Zipper]", err);

          if (err.message === "AUTH_NEEDED") {
            // No token and got blocked — show the token dialog
            setButtonState(btn, "idle");
            showTokenDialog();
            return;
          }

          var msg = "Error \u2013 see console";
          if (err.message.indexOf("401") !== -1) msg = "Token invalid/expired";
          else if (err.message.indexOf("403") !== -1) msg = "403 \u2013 check token type/scopes";
          else if (err.message.indexOf("rate limit") !== -1) msg = "API rate limited";
          setButtonState(btn, "error", msg);
          setTimeout(function () {
            setButtonState(btn, "idle");
          }, 5000);
        });
    });
  }

  // ── Fetch list of changed files (paginated) ───────────────────────────────

  function fetchAllChangedFiles(prInfo, headers) {
    var files = [];
    var page = 1;

    function fetchPage() {
      var url =
        "https://api.github.com/repos/" +
        prInfo.owner +
        "/" +
        prInfo.repo +
        "/pulls/" +
        prInfo.prNumber +
        "/files?per_page=100&page=" +
        page;
      return fetch(url, { headers: headers })
        .then(function (res) {
          if (res.status === 401) throw new Error("401 Unauthorized");
          if (res.status === 403) throw new Error("403 Forbidden");
          if (!res.ok) throw new Error("GitHub API error " + res.status);
          return res.json();
        })
        .then(function (batch) {
          files = files.concat(
            batch.filter(function (f) {
              return f.status !== "removed";
            })
          );
          if (batch.length === 100) {
            page++;
            return fetchPage();
          }
          return files;
        });
    }
    return fetchPage();
  }

  // ── Download files and create ZIP ──────────────────────────────────────────

  function downloadAndZip(files, prInfo, headers, headRef, headSha) {
    // JSZip is now bundled and loaded in the content script's isolated world
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip not loaded — check that jszip.min.js is in manifest.json");
    }

    var zip = new JSZip();
    var btn = document.getElementById("przipper-download-btn");
    var completed = 0;

    function downloadFile(file) {
      var encodedPath = file.filename
        .split("/")
        .map(encodeURIComponent)
        .join("/");

      // Primary: Blob API using the file's blob SHA (most reliable)
      return fetch(
        "https://api.github.com/repos/" +
          prInfo.owner +
          "/" +
          prInfo.repo +
          "/git/blobs/" +
          file.sha,
        { headers: headers }
      )
        .then(function (r) {
          if (!r.ok) throw new Error("blob API failed: " + r.status);
          return r.json();
        })
        .then(function (d) {
          if (d.encoding === "base64" && d.content) {
            var binary = atob(d.content.replace(/\n/g, ""));
            zip.file(file.filename, binary, { binary: true });
            return;
          }
          throw new Error("blob not base64");
        })
        .catch(function () {
          // Fallback 1: Contents API with the PR head branch ref
          return fetch(
            "https://api.github.com/repos/" +
              prInfo.owner +
              "/" +
              prInfo.repo +
              "/contents/" +
              encodedPath +
              "?ref=" +
              encodeURIComponent(headRef),
            { headers: headers }
          )
            .then(function (r) {
              if (!r.ok) throw new Error("contents API failed: " + r.status);
              return r.json();
            })
            .then(function (data) {
              if (data.encoding === "base64" && data.content) {
                var binary = atob(data.content.replace(/\n/g, ""));
                zip.file(file.filename, binary, { binary: true });
                return;
              }
              throw new Error("contents not base64");
            });
        })
        .catch(function () {
          // Fallback 2: Raw download from head branch
          return fetch(
            "https://raw.githubusercontent.com/" +
              prInfo.owner +
              "/" +
              prInfo.repo +
              "/" +
              encodeURIComponent(headRef) +
              "/" +
              file.filename,
            { headers: { Authorization: headers.Authorization } }
          )
            .then(function (r) {
              if (!r.ok) throw new Error("raw download failed: " + r.status);
              return r.blob();
            })
            .then(function (blob) {
              zip.file(file.filename, blob);
            });
        })
        .catch(function (e) {
          console.warn("[PR Zipper] Skipped " + file.filename + ":", e.message);
        })
        .then(function () {
          completed++;
          var pct = Math.round((completed / files.length) * 100);
          setButtonState(btn, "loading", "Downloading\u2026 " + pct + "%");
        });
    }

    // Download files in batches of 5 to avoid overwhelming the API
    function downloadBatch(startIndex) {
      if (startIndex >= files.length) return Promise.resolve();
      var batch = files.slice(startIndex, startIndex + 5);
      var promises = batch.map(function (f) {
        return downloadFile(f);
      });
      return Promise.all(promises).then(function () {
        return downloadBatch(startIndex + 5);
      });
    }

    return downloadBatch(0).then(function () {
      return zip.generateAsync({ type: "blob" });
    }).then(function (zipBlob) {
      var filename =
        prInfo.owner +
        "-" +
        prInfo.repo +
        "-pr" +
        prInfo.prNumber +
        "-files.zip";
      var link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 1000);
    });
  }

  // ── Button states ──────────────────────────────────────────────────────────

  var ICONS = {
    idle: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right:5px;vertical-align:-2px;flex-shrink:0"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.97a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.779a.749.749 0 1 1 1.06-1.06l1.97 1.97Z"/></svg>',
    loading:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right:5px;vertical-align:-2px;flex-shrink:0;animation:przipper-spin 1s linear infinite"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z" opacity=".3"/><path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5h1.5A8 8 0 0 0 8 0v1.5Z"/></svg>',
    success:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right:5px;vertical-align:-2px;flex-shrink:0"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>',
    error:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right:5px;vertical-align:-2px;flex-shrink:0"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 6a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 6Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>',
  };

  function setButtonState(btn, state, label) {
    if (!btn) return;
    var defaultLabel = "Download All";
    btn.innerHTML = (ICONS[state] || ICONS.idle) + (label || defaultLabel);
    btn.disabled = state === "loading";
    btn.dataset.state = state;
  }

  // ── Token dialog ───────────────────────────────────────────────────────────

  function showTokenDialog() {
    if (document.getElementById("przipper-modal")) return;
    var overlay = document.createElement("div");
    overlay.id = "przipper-modal";
    overlay.innerHTML =
      '<div class="przipper-modal-backdrop"></div>' +
      '<div class="przipper-modal-box" role="dialog" aria-modal="true">' +
      '<div class="przipper-modal-header">' +
      '<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 11.75a.25.25 0 0 1 .25-.25h7.5a.25.25 0 0 1 .25.25v2a.75.75 0 0 0 1.5 0v-2A1.75 1.75 0 0 0 11.25 10H4.75A1.75 1.75 0 0 0 3 11.75v2a.75.75 0 0 0 1.5 0Zm5-6.5V8a.75.75 0 0 1-1.5 0V5.25a.75.75 0 0 1 1.5 0ZM8 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>' +
      "<h2>GitHub Personal Access Token</h2>" +
      "</div>" +
      '<p class="przipper-modal-desc">This repo requires authentication. A GitHub PAT is needed for private repos and to avoid rate limits on public repos.<br><br>' +
      '<strong>Classic token</strong> (recommended): select <code>repo</code> scope. ' +
      '<a href="https://github.com/settings/tokens/new?scopes=repo&description=PR+File+Zipper" target="_blank" rel="noopener">Create one here</a>.<br>' +
      '<strong>Fine-grained token</strong>: grant <code>Contents: Read</code> permission and select the repos you need.</p>' +
      '<input id="przipper-token-input" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false"/>' +
      '<div class="przipper-modal-actions">' +
      '<button id="przipper-modal-cancel" class="przipper-btn-secondary">Cancel</button>' +
      '<button id="przipper-modal-save" class="przipper-btn">Save &amp; Download</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(overlay);
    overlay
      .querySelector(".przipper-modal-backdrop")
      .addEventListener("click", closeModal);
    overlay
      .querySelector("#przipper-modal-cancel")
      .addEventListener("click", closeModal);
    overlay
      .querySelector("#przipper-modal-save")
      .addEventListener("click", function () {
        var val = overlay.querySelector("#przipper-token-input").value.trim();
        if (!val) return;
        browser.storage.local.set({ githubToken: val }).then(function () {
          closeModal();
          handleDownload();
        });
      });
    requestAnimationFrame(function () {
      overlay.classList.add("przipper-modal-visible");
    });
    overlay.querySelector("#przipper-token-input").focus();
  }

  function closeModal() {
    var modal = document.getElementById("przipper-modal");
    if (modal) {
      modal.classList.remove("przipper-modal-visible");
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 200);
    }
  }

  // ── SPA observer ──────────────────────────────────────────────────────────

  function tryInject() {
    // If button was removed (SPA navigation), reset state
    if (!document.getElementById("przipper-btn-wrapper")) {
      injected = false;
    }
    // Also remove stale float bar
    if (!injected) {
      var staleBar = document.getElementById("przipper-float-bar");
      if (staleBar) staleBar.remove();
    }
    if (!injected) injectButton();
  }

  function startObserver() {
    if (observer) observer.disconnect();

    // Debounce the mutation observer to avoid thrashing
    var pending = false;
    observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        tryInject();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Detect SPA navigation by polling pathname changes (more reliable than events alone)
  setInterval(function () {
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      injected = false;
      setTimeout(tryInject, 300);
      setTimeout(tryInject, 800);
      setTimeout(tryInject, 1500);
    }
  }, 500);

  // GitHub Turbo/Pjax SPA events
  document.addEventListener("turbo:render", function () {
    injected = false;
    tryInject();
  });
  document.addEventListener("turbo:load", function () {
    injected = false;
    tryInject();
  });
  document.addEventListener("pjax:end", function () {
    injected = false;
    tryInject();
  });
  window.addEventListener("popstate", function () {
    injected = false;
    setTimeout(tryInject, 300);
    setTimeout(tryInject, 800);
  });

  // Initial injection — retry a few times since GitHub lazy-loads the Files tab content
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      tryInject();
      startObserver();
    });
  } else {
    tryInject();
    startObserver();
  }

  // Retry injection after delays to catch lazy-loaded GitHub UI
  setTimeout(tryInject, 500);
  setTimeout(tryInject, 1500);
  setTimeout(tryInject, 3000);
})();
