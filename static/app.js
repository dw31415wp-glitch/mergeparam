// Progressive enhancement only. Everything works without JavaScript.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const requestedPlatform = new URLSearchParams(location.search).get("hotkeys");
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
    for (const element of document.querySelectorAll("[data-review-button], [data-stop-countdown], .next-btn")) {
      element.innerHTML = element.innerHTML.replace(/(?:Alt|Ctrl\+Option)\+([NRS])/g, `${modifier}+$1`);
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
      location.href = "/fix?" + new URLSearchParams({title: titles[0], queue: "0"});
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
  if (reviewForm) {
    const button = reviewForm.querySelector("[data-review-button]");
    const stop = reviewForm.querySelector("[data-stop-countdown]");
    const status = reviewForm.querySelector("[data-countdown-status]") || document.querySelector("[data-countdown-status]");
    let remaining = 3;
    let timer;
    const cancel = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      stop.hidden = true;
      status.textContent = "Countdown stopped. Open the Wikipedia review when ready.";
    };
    stop.hidden = false;
    status.textContent = `Opening Wikipedia review in ${remaining} seconds.`;
    timer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) status.textContent = `Opening Wikipedia review in ${remaining} seconds.`;
      else {
        clearInterval(timer);
        timer = null;
        stop.hidden = true;
        status.textContent = "Opening Wikipedia review. If your browser blocks pop-ups, allow them and try again.";
        reviewForm.requestSubmit(button);
      }
    }, 1000);
    stop.addEventListener("click", cancel);
    reviewForm.addEventListener("submit", () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        stop.hidden = true;
        status.textContent = "Opening Wikipedia review.";
      }
    });
    document.addEventListener("keydown", (event) => {
      if (!shortcut(event)) return;
      if (event.code === "KeyS") { event.preventDefault(); cancel(); }
      if (event.code === "KeyR") { event.preventDefault(); reviewForm.requestSubmit(button); }
    });
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
      if (mergeForm.hasAttribute("data-auto")) autoAdvance(mergeForm);
    } catch (err) {
      error.textContent = err.message || "Could not prepare the edit.";
      error.hidden = false;
    }
  });
  // After handing off to Wikipedia, point the user at the next article.
  for (const form of document.querySelectorAll("form[data-handoff]")) {
    form.addEventListener("submit", () => {
      document.documentElement.classList.add("handed-off");
      const steps = document.querySelectorAll(".steps li");
      steps.forEach((li, i) => {
        li.classList.toggle("done", i < steps.length - 1);
        li.classList.toggle("current", i === steps.length - 1);
      });
      const next = document.querySelector("#after-handoff .next-btn");
      if (next) setTimeout(() => next.focus(), 100);
      if (form.hasAttribute("data-auto")) autoAdvance(form);
    });
  }

  // "Reset to suggestion" appears once the suggested value has been edited.
  const textarea = document.querySelector("textarea[data-original]");
  const reset = document.querySelector("[data-reset]");
  if (textarea && reset) {
    const sync = () => { reset.hidden = textarea.value === textarea.dataset.original; };
    textarea.addEventListener("input", sync);
    reset.addEventListener("click", () => {
      textarea.value = textarea.dataset.original;
      sync();
      textarea.focus();
    });
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

function autoAdvance(form) {
  const box = document.querySelector("#after-handoff .auto-status");
  const next = document.querySelector("#after-handoff .next-btn");
  if (!box || !next || form.dataset.polling) return;
  form.dataset.polling = "1";

  const status = box.querySelector("[role=status]");
  const stay = box.querySelector("[data-stay]");
  const say = (text) => { box.hidden = false; status.textContent = text; };
  const started = Date.now();
  let timer;

  const api = new URL(form.dataset.api);
  api.search = new URLSearchParams({
    action: "query", prop: "revisions", titles: form.dataset.title, rvprop: "ids",
    format: "json", formatversion: "2", origin: "*",
  });

  async function latestRevid() {
    const data = await (await fetch(api, { cache: "no-store" })).json();
    return data?.query?.pages?.[0]?.revisions?.[0]?.revid;
  }

  async function fixedBy(revid) {
    const check = new URL(form.dataset.check, location.href);
    check.search = new URLSearchParams({ title: form.dataset.title, revid, before: form.dataset.before });
    const r = await fetch(check, { cache: "no-store" });
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
      if (revid && String(revid) !== form.dataset.revid) {
        if (await fixedBy(revid)) return countdown();
        say("The article was edited, but |alma_mater= is still there. Check it on Wikipedia, or move on.");
        return;
      }
    } catch (e) {
      // A network hiccup or a busy server: just try again next time.
    }
    timer = setTimeout(poll, POLL_MS);
  }

  function countdown() {
    let left = COUNTDOWN_S;
    stay.hidden = false;
    stay.addEventListener("click", () => {
      clearTimeout(timer);
      stay.hidden = true;
      say("Published ✓");
    }, { once: true });
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
