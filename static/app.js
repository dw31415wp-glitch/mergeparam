// Progressive enhancement only. Everything works without JavaScript.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const requestedPlatform = new URLSearchParams(location.search).get("hotkeys");
  let autoload = new URLSearchParams(location.search).get("autoload");
  function withAutoload(href) {
    const url = new URL(href, location.href);
    if (autoload === "0" || autoload === "1") url.searchParams.set("autoload", autoload);
    return url.href;
  }
  let platform = ["mac", "windows"].includes(requestedPlatform) ? requestedPlatform :
    sessionStorage.getItem("mergeparam-hotkeys") || (/Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "windows");
  if (!["mac", "windows"].includes(platform)) platform = "windows";
  const shortcutToggle = document.querySelector("[data-shortcut-toggle]");
  function updateShortcuts() {
    sessionStorage.setItem("mergeparam-hotkeys", platform);
    const url = new URL(location.href);
    url.searchParams.set("hotkeys", platform);
    history.replaceState(history.state, "", url);
    shortcutToggle.hidden = false;
    shortcutToggle.textContent = `Hotkeys: ${platform === "mac" ? "Mac" : "Windows"}`;
    shortcutToggle.title = `Switch to ${platform === "mac" ? "Windows" : "Mac"} hotkeys`;
    const modifier = platform === "mac" ? "Ctrl+Option" : "Alt";
    for (const item of document.querySelectorAll("[data-workflow-next]")) item.textContent = `${modifier}+N`;
    for (const item of document.querySelectorAll("[data-workflow-tab]")) item.textContent = platform === "mac" ? "Control+Tab" : "Ctrl+Tab";
    for (const item of document.querySelectorAll("[data-workflow-publish]")) item.textContent = platform === "mac" ? "Control+Option+S" : "Alt+Shift+S";
    for (const element of document.querySelectorAll("[data-review-button], .next-btn")) {
      element.innerHTML = element.innerHTML.replace(/(?:Alt|Ctrl\+Option)\+([NR])/g, `${modifier}+$1`);
    }
  }
  shortcutToggle.addEventListener("click", () => { platform = platform === "mac" ? "windows" : "mac"; updateShortcuts(); });
  const shortcut = event => event.altKey && !event.metaKey && !event.shiftKey && !event.repeat &&
    (platform === "mac" ? event.ctrlKey : !event.ctrlKey);
  const queueKey = "mergeparam-simple-pages";
  const upload = document.querySelector("[data-queue-upload]");
  if (upload) upload.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = upload.querySelector("[data-queue-error]");
    try {
      const data = JSON.parse(await upload.querySelector('input[type="file"]').files[0].text());
      if (!Array.isArray(data.pages) || !data.pages.length ||
          data.pages.some(page => !page || typeof page.page_name !== "string" || !page.page_name.trim())) {
        throw new Error("Expected a nonempty pages list with a page_name for every entry.");
      }
      const titles = data.pages.map(page => page.page_name.trim());
      sessionStorage.setItem(queueKey, JSON.stringify(titles));
      location.href = withAutoload("/fix?" + new URLSearchParams({title: titles[0], queue: "0"}));
    } catch (err) {
      error.textContent = "Could not open the list: " + err.message;
      error.hidden = false;
    }
  });
  const position = new URLSearchParams(location.search).get("queue") ??
    document.querySelector("[data-queue-position], input[name=queue]")?.value ?? "";
  if (/^\d+$/.test(position)) {
    try {
      const titles = JSON.parse(sessionStorage.getItem(queueKey));
      const index = Number(position);
      if (Array.isArray(titles) && index < titles.length) {
        const next = index + 1;
        for (const link of document.querySelectorAll("[data-queue-next]")) {
          link.hidden = false;
          link.href = next < titles.length
            ? "/fix?" + new URLSearchParams({title: titles[next], queue: String(next)})
            : "/?queue_done=1";
          if (next >= titles.length) link.textContent = link.classList.contains("next-btn") ? "Finish list (Alt+N) →" : "Finish list →";
        }
        const marker = document.createElement("p");
        marker.className = "hint";
        marker.textContent = `Uploaded list: article ${index + 1} of ${titles.length}`;
        document.querySelector("main").prepend(marker);
      }
    } catch (_) { /* A missing or invalid list leaves ordinary navigation in place. */ }
  }
  const nextLinks = document.querySelectorAll("[data-queue-next], [data-back]");
  const updateNextLinks = () => {
    for (const link of nextLinks) link.href = withAutoload(link.href);
  };
  updateNextLinks();
  updateShortcuts();
  if (new URLSearchParams(location.search).has("queue_done")) {
    const marker = document.createElement("p");
    marker.className = "notice";
    marker.textContent = "You have reached the end of the uploaded list.";
    document.querySelector("main").prepend(marker);
  }
  document.addEventListener("keydown", (event) => {
    if (shortcut(event) && event.code === "KeyN") {
      const next = document.querySelector(".next-btn");
      if (next) { event.preventDefault(); next.click(); }
    }
  });
  const reviewForm = document.querySelector("form[data-merge-handoff], form[data-handoff]");
  let syncReview;
  if (reviewForm) {
    const button = reviewForm.querySelector("[data-review-button]");
    const status = document.querySelector("[data-review-status]");
    let reviewRequested = false;
    syncReview = () => {
      if (reviewRequested) return;
      if (autoload !== "1") {
        status.textContent = "";
      } else if (document.hidden) {
        status.textContent = "The Wikipedia diff opens when you return to this tab.";
      } else {
        reviewForm.requestSubmit(button);
      }
    };
    document.addEventListener("visibilitychange", syncReview);
    reviewForm.addEventListener("submit", () => {
      reviewRequested = true;
      document.removeEventListener("visibilitychange", syncReview);
      status.textContent = "Opening Wikipedia review. If your browser blocks pop-ups, allow them and try again.";
    });
    document.addEventListener("keydown", (event) => {
      if (shortcut(event) && event.code === "KeyR") {
        event.preventDefault();
        reviewForm.requestSubmit(button);
      }
    });
  }
  const nextAfterHandoff = document.querySelector("#after-handoff .next-btn");
  const autoloadButton = document.querySelector("[data-next-autoload]");
  let handedOffForm;
  let publishCheck;
  function loadNextWhenHidden() {
    if (!document.hidden) return;
    document.removeEventListener("visibilitychange", loadNextWhenHidden);
    location.href = nextAfterHandoff.href;
  }
  function syncAdvance() {
    document.removeEventListener("visibilitychange", loadNextWhenHidden);
    publishCheck?.abort();
    publishCheck = null;
    if (autoload !== "1" || !handedOffForm || !nextAfterHandoff) return;
    if (handedOffForm.hasAttribute("data-auto")) {
      publishCheck = new AbortController();
      autoAdvance(handedOffForm, publishCheck.signal);
      return;
    }
    document.addEventListener("visibilitychange", loadNextWhenHidden);
    loadNextWhenHidden();
  }
  if (autoloadButton) {
    const afterText = document.querySelector("#after-handoff .after-text");
    const enabledText = afterText.textContent;
    const state = autoloadButton.querySelector("[data-next-autoload-state]");
    const updateToggle = () => {
      const enabled = autoload === "1";
      autoloadButton.setAttribute("aria-pressed", String(enabled));
      autoloadButton.classList.toggle("primary", enabled);
      state.textContent = enabled ? "On" : "Off";
      afterText.textContent = enabled ? enabledText : "Choose Next article when you're ready.";
    };
    updateToggle();
    autoloadButton.closest("[data-next-autoload-option]").hidden = false;
    autoloadButton.addEventListener("click", () => {
      autoload = autoload === "1" ? "0" : "1";
      history.replaceState(history.state, "", withAutoload(location.href));
      updateNextLinks();
      updateToggle();
      syncAdvance();
      syncReview?.();
    });
  }
  function advanceAfterHandoff(form) {
    if (handedOffForm === form) return;
    handedOffForm = form;
    syncAdvance();
  }
  const mergeForm = document.querySelector("form[data-merge-handoff]");
  if (mergeForm) mergeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = mergeForm.querySelector("[data-merge-error]");
    error.hidden = true;
    const target = window.open("", "mergeparam-wikipedia");
    if (!target) {
      error.textContent = "Allow pop-ups for this site to open the Wikipedia edit.";
      error.hidden = false;
      return;
    }
    try {
      const response = await fetch(mergeForm.action, {
        method: "POST", body: new FormData(mergeForm), headers: {"X-Requested-With": "fetch"},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare the edit.");
      const handoff = document.createElement("form");
      handoff.method = "post";
      handoff.action = data.url;
      handoff.target = "mergeparam-wikipedia";
      for (const [name, value] of Object.entries(data.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        handoff.append(input);
      }
      document.body.append(handoff);
      handoff.submit();
      handoff.remove();
      document.documentElement.classList.add("handed-off");
      advanceAfterHandoff(mergeForm);
    } catch (err) {
      error.textContent = err.message || "Could not prepare the edit.";
      error.hidden = false;
    }
  });
  // After handing off to Wikipedia, point the user at the next article.
  for (const form of document.querySelectorAll("form[data-handoff]")) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!window.open("", form.target)) return;
      form.submit();
      document.documentElement.classList.add("handed-off");
      const steps = document.querySelectorAll(".steps li");
      steps.forEach((li, i) => {
        li.classList.toggle("done", i < steps.length - 1);
        li.classList.toggle("current", i === steps.length - 1);
      });
      const next = document.querySelector("#after-handoff .next-btn");
      if (next) setTimeout(() => next.focus(), 100);
      advanceAfterHandoff(form);
    });
  }
  syncReview?.();

  // Switch suggestions in the same editable field used for the Wikipedia review.
  const textarea = document.querySelector("textarea[data-original]");
  const reset = document.querySelector("[data-reset]");
  if (textarea && reset) {
    const institutionFirst = document.querySelector("[data-institution-first]");
    const lineBreaks = document.querySelector("[data-line-breaks]");
    const notes = document.querySelector("[data-suggestion-notes]");
    const sync = () => {
      reset.hidden = textarea.value === textarea.dataset.original;
      if (institutionFirst) {
        institutionFirst.disabled = textarea.value === institutionFirst.dataset.institutionFirst;
        lineBreaks.disabled = textarea.value === lineBreaks.dataset.lineBreaks;
        notes.hidden = institutionFirst.disabled || lineBreaks.disabled;
      }
    };
    textarea.addEventListener("input", sync);
    const useSuggestion = (value) => {
      textarea.value = value;
      sync();
      textarea.focus();
    };
    reset.addEventListener("click", () => useSuggestion(textarea.dataset.original));
    if (institutionFirst) {
      institutionFirst.closest("[data-format-option]").hidden = false;
      institutionFirst.addEventListener("click", () => useSuggestion(institutionFirst.dataset.institutionFirst));
      lineBreaks.addEventListener("click", () => useSuggestion(lineBreaks.dataset.lineBreaks));
    }
    sync();
  }

  // Error pages: offer "Go back" when there's somewhere on this site to go back to.
  const historyBack = document.querySelector("[data-history-back]");
  if (historyBack && history.length > 1 && document.referrer.startsWith(location.origin)) {
    historyBack.hidden = false;
    historyBack.addEventListener("click", (e) => {
      e.preventDefault();
      history.back();
    });
  }

  // Theme toggle: switch straight away, then save the choice in the background.
  const toggle = document.querySelector("form[data-theme-toggle]");
  if (toggle) toggle.addEventListener("submit", (e) => {
    e.preventDefault();
    const order = ["system", "light", "dark"];
    const labels = { system: "Same as your device", light: "Light", dark: "Dark" };
    const input = toggle.querySelector('input[name="theme"]');
    const button = toggle.querySelector("button");
    const theme = input.value;
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    // SVG elements have no .hidden property, so set the attribute itself.
    for (const icon of toggle.querySelectorAll("[data-icon]")) {
      icon.toggleAttribute("hidden", icon.dataset.icon !== theme);
    }
    const next = order[(order.indexOf(theme) + 1) % order.length];
    input.value = next;
    button.dataset.themeCurrent = theme;
    button.title = button.ariaLabel = `Theme: ${labels[theme]}. Click for ${labels[next].toLowerCase()}.`;
    fetch(toggle.action, {
      method: "POST", body: new URLSearchParams({ theme }),
      headers: { "X-Requested-With": "fetch" }, credentials: "same-origin",
    }).catch(() => {});  // if saving fails, the theme still changes for this page
  });

  // "Go back and change it" keeps the user's edits by going back in history.
  const back = document.querySelector("[data-back]");
  if (back && history.length > 1) {
    back.addEventListener("click", (e) => {
      e.preventDefault();
      history.back();
    });
  }
});

// Auto-advance (opt-in on the Settings page). Ask Wikipedia's API for the
// article's latest revision every few seconds. When it changes, ask the tool
// once whether that revision fixed the infobox; if so, count down and load
// the next article.
const POLL_MS = 5000;
const GIVE_UP_MS = 15 * 60 * 1000;
const COUNTDOWN_S = 3;

function autoAdvance(form, signal) {
  const box = document.querySelector("#after-handoff .auto-status");
  const next = document.querySelector("#after-handoff .next-btn");
  if (!box || !next) return;

  const status = box.querySelector("[role=status]");
  const stay = box.querySelector("[data-stay]");
  const say = (text) => { box.hidden = false; status.textContent = text; };
  const started = Date.now();
  let timer;
  signal.addEventListener("abort", () => {
    clearTimeout(timer);
    box.hidden = true;
    stay.hidden = true;
  }, { once: true });

  const api = new URL(form.dataset.api);
  api.search = new URLSearchParams({
    action: "query", prop: "revisions", titles: form.dataset.title, rvprop: "ids",
    format: "json", formatversion: "2", origin: "*",
  });

  async function latestRevid() {
    const data = await (await fetch(api, { cache: "no-store", signal })).json();
    return data?.query?.pages?.[0]?.revisions?.[0]?.revid;
  }

  async function fixedBy(revid) {
    const check = new URL(form.dataset.check, location.href);
    check.search = new URLSearchParams({ title: form.dataset.title, revid, before: form.dataset.before });
    const r = await fetch(check, { cache: "no-store", signal });
    if (!r.ok) throw new Error("check failed");
    return (await r.json()).done;
  }

  async function poll() {
    if (Date.now() - started > GIVE_UP_MS) {
      say("Stopped checking for your edit. Click Next article when you're ready.");
      return;
    }
    try {
      const revid = await latestRevid();
      if (signal.aborted) return;
      if (revid && String(revid) !== form.dataset.revid) {
        const fixed = await fixedBy(revid);
        if (signal.aborted) return;
        if (fixed) return countdown();
        say("The article was edited, but |alma_mater= is still there. Check it on Wikipedia, or move on.");
        return;
      }
    } catch (e) {
      // A network hiccup or a busy server: just try again next time.
    }
    if (!signal.aborted) timer = setTimeout(poll, POLL_MS);
  }

  function countdown() {
    let left = COUNTDOWN_S;
    stay.hidden = false;
    stay.addEventListener("click", () => {
      clearTimeout(timer);
      stay.hidden = true;
      say("Published ✓");
    }, { once: true, signal });
    const tick = () => {
      if (left === 0) {
        location.href = next.href;
        return;
      }
      say(`Published ✓ Next article in ${left}…`);
      left -= 1;
      timer = setTimeout(tick, 1000);
    };
    tick();
  }

  say("Waiting for you to publish on Wikipedia…");
  timer = setTimeout(poll, POLL_MS);
}
