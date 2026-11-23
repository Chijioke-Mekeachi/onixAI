(() => {
  // Elements - macOS Auth Sheet
  const authSheet = document.getElementById("mac-auth-sheet");
  const authCard = document.getElementById("mac-auth-card");
  const authForm = document.getElementById("mac-login-form");
  const usernameInput = document.getElementById("mac-username-input");
  const loginBtn = document.getElementById("mac-login-btn");
  const btnArrow = document.getElementById("mac-btn-arrow");
  const btnSpinner = document.getElementById("mac-btn-spinner");
  const loginError = document.getElementById("mac-login-error");
  const avatarDefault = document.getElementById("mac-avatar-default");
  const avatarInitial = document.getElementById("mac-avatar-initial");

  // Elements - Titlebar & Window
  const macWindow = document.getElementById("mac-window");
  const sessionBadge = document.getElementById("session-badge");
  const sessionLabel = document.getElementById("session-label");
  const endButton = document.getElementById("end-session");
  const tlClose = document.getElementById("tl-close");
  const tlMinimize = document.getElementById("tl-minimize");
  const tlZoom = document.getElementById("tl-zoom");

  // Elements - Chat View
  const chatView = document.getElementById("chat-view");
  const conversation = document.getElementById("conversation");
  const welcome = document.getElementById("welcome");
  const welcomeHeading = document.getElementById("welcome-heading");
  const composerForm = document.getElementById("composer");
  const messageInput = document.getElementById("message");
  const sendButton = document.getElementById("send");
  const suggestionChips = document.getElementById("suggestion-chips");

  let currentSessionId = "";
  let currentUsername = "";

  // Helper: Request with credentials
  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || `Request failed with status ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return data;
  }

  // Trigger realistic macOS shake animation on error
  function shakeDialog(message) {
    if (loginError) {
      loginError.textContent = message;
      loginError.style.display = "block";
    }
    authCard.classList.remove("shake");
    // Force reflow
    void authCard.offsetWidth;
    authCard.classList.add("shake");
    usernameInput.focus();
    setTimeout(() => {
      authCard.classList.remove("shake");
    }, 500);
  }

  // Update dynamic avatar initial on typing
  usernameInput.addEventListener("input", () => {
    const val = usernameInput.value.trim();
    if (val.length > 0) {
      loginBtn.disabled = false;
      avatarDefault.style.display = "none";
      avatarInitial.textContent = val.charAt(0).toUpperCase();
      avatarInitial.style.display = "block";
    } else {
      loginBtn.disabled = true;
      avatarInitial.style.display = "none";
      avatarDefault.style.display = "block";
    }
    if (loginError.style.display !== "none") {
      loginError.style.display = "none";
    }
  });

  // Handle Format 2: Enter username & generate token
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();

    if (!username) {
      shakeDialog("Please enter your username.");
      return;
    }
    if (username.length > 80) {
      shakeDialog("Username must be 80 characters or less.");
      return;
    }

    // Enter loading state
    usernameInput.disabled = true;
    loginBtn.disabled = true;
    btnArrow.style.display = "none";
    btnSpinner.style.display = "inline-block";
    loginError.style.display = "none";

    try {
      const result = await request("/api/v1/ai/token", {
        method: "POST",
        body: JSON.stringify({ username })
      });

      const { sessionId, username: resolvedUsername } = result.data;
      currentSessionId = sessionId;
      currentUsername = resolvedUsername;

      // Transition smoothly into the chat section
      openChatView(currentSessionId, currentUsername);
    } catch (err) {
      usernameInput.disabled = false;
      loginBtn.disabled = false;
      btnArrow.style.display = "block";
      btnSpinner.style.display = "none";
      shakeDialog(err.message || "Failed to generate session token.");
    }
  });

  // Open Chat View with smooth transition
  function openChatView(sessionId, username) {
    // Hide auth modal smoothly
    authSheet.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    authSheet.style.opacity = "0";
    setTimeout(() => {
      authSheet.style.display = "none";
      authSheet.style.opacity = "";
      authSheet.style.transition = "";
      // Reset auth form for potential future use
      usernameInput.disabled = false;
      loginBtn.disabled = true;
      usernameInput.value = "";
      btnArrow.style.display = "block";
      btnSpinner.style.display = "none";
      avatarInitial.style.display = "none";
      avatarDefault.style.display = "block";
    }, 250);

    // Update Titlebar
    sessionBadge.className = "session-badge auth";
    sessionLabel.innerHTML = `Signed in as <strong style="font-weight:600; margin-left:3px;">${escapeHtml(username)}</strong>`;
    endButton.style.display = "inline-flex";

    // Show Chat View
    chatView.style.display = "flex";
    if (welcomeHeading) {
      welcomeHeading.textContent = `Welcome, ${username}!`;
    }

    // Auto-focus composer
    setTimeout(() => {
      messageInput.focus();
    }, 300);
  }

  // Show the macOS Enter Username Sheet (Format 2 prompt)
  function showAuthSheet() {
    chatView.style.display = "none";
    endButton.style.display = "none";
    sessionBadge.className = "session-badge unauth";
    sessionLabel.textContent = "Guest";

    authSheet.style.display = "flex";
    authSheet.style.opacity = "1";
    setTimeout(() => {
      usernameInput.focus();
    }, 150);
  }

  // Add a message bubble to conversation
  function addMessage(role, content) {
    const welcomeEl = document.getElementById("welcome");
    if (welcomeEl) welcomeEl.remove();

    const item = document.createElement("div");
    item.className = `message ${role}`;

    if (role === "assistant") {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>`;
      item.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = content;
    item.appendChild(bubble);

    conversation.appendChild(item);
    conversation.scrollTop = conversation.scrollHeight;
  }

  // Add typing indicator
  function showTypingIndicator() {
    const typing = document.createElement("div");
    typing.className = "typing";
    typing.id = "assistant-typing";
    typing.innerHTML = `
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span>Assistant is typing…</span>
    `;
    conversation.appendChild(typing);
    conversation.scrollTop = conversation.scrollHeight;
    return typing;
  }

  // Handle composer submission
  composerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || sendButton.disabled) return;

    addMessage("user", text);
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendButton.disabled = true;

    const typing = showTypingIndicator();

    try {
      const result = await request("/api/v1/ai/message", {
        method: "POST",
        body: JSON.stringify({ message: text })
      });
      typing.remove();
      addMessage("assistant", result.data.message);
    } catch (error) {
      typing.remove();
      addMessage("assistant", error.message || "Unable to send your message.");
    } finally {
      sendButton.disabled = false;
      messageInput.focus();
    }
  });

  // Auto-resize composer textarea & handle Enter key
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
  });

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composerForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  // Suggestion chips
  if (suggestionChips) {
    suggestionChips.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const prompt = btn.dataset.prompt;
      if (prompt) {
        messageInput.value = prompt;
        messageInput.dispatchEvent(new Event("input"));
        messageInput.focus();
      }
    });
  }

  // End session handler
  endButton.addEventListener("click", async () => {
    if (!currentSessionId) return;

    endButton.disabled = true;
    try {
      await request(`/api/v1/ai/session/${encodeURIComponent(currentSessionId)}`, {
        method: "DELETE"
      });
    } catch (e) {
      // Continue even if server session expired
    } finally {
      endButton.disabled = false;
      currentSessionId = "";
      currentUsername = "";
      conversation.replaceChildren();

      // Restore welcome message inside conversation
      conversation.innerHTML = `
        <div id="welcome" class="welcome">
          <div class="welcome-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/>
            </svg>
          </div>
          <h1 id="welcome-heading">How can I help today?</h1>
          <p id="welcome-sub">Ask a question, brainstorm ideas, or generate content.</p>
        </div>
      `;

      showAuthSheet();
    }
  });

  // Window Controls (Traffic Lights)
  tlClose.addEventListener("click", () => {
    if (currentSessionId) {
      endButton.click();
    } else {
      usernameInput.value = "";
      usernameInput.dispatchEvent(new Event("input"));
    }
  });

  tlMinimize.addEventListener("click", () => {
    macWindow.style.transform = "scale(0.97)";
    setTimeout(() => {
      macWindow.style.transform = "";
    }, 200);
  });

  tlZoom.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Bootstrap Application Flow
  async function init() {
    try {
      // Attempt to bootstrap active session (Format 1 or existing session)
      const res = await request("/api/v1/ai/bootstrap", { method: "GET" });
      currentSessionId = res.data.sessionId;
      currentUsername = res.data.username;

      openChatView(currentSessionId, currentUsername);

      // Load conversation history if available
      try {
        const histRes = await request(`/api/v1/ai/session/${encodeURIComponent(currentSessionId)}/history`, { method: "GET" });
        if (histRes.data?.messages?.length > 0) {
          histRes.data.messages.forEach(msg => addMessage(msg.role, msg.content));
        }
      } catch (err) {
        console.warn("Could not load history:", err);
      }
    } catch (err) {
      // Not authenticated: Format 2 entry (user navigated without token)
      // Prompt user with the authentic macOS username sheet!
      showAuthSheet();
    }
  }

  init();
})();
