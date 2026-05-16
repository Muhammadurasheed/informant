var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const getPageContext = () => {
  var _a, _b;
  const title = document.title;
  const url = window.location.href;
  const clone = document.body.cloneNode(true);
  const scripts = clone.getElementsByTagName("script");
  while (scripts[0]) (_a = scripts[0].parentNode) == null ? void 0 : _a.removeChild(scripts[0]);
  const styles = clone.getElementsByTagName("style");
  while (styles[0]) (_b = styles[0].parentNode) == null ? void 0 : _b.removeChild(styles[0]);
  const content = clone.innerText || "";
  const inputs = Array.from(document.querySelectorAll("input, textarea, select")).map((el, index) => {
    const element = el;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || element.type === "hidden") return null;
    return {
      id: element.id || `input_${index}`,
      name: element.name,
      type: element.type,
      placeholder: "placeholder" in element ? element.placeholder : "",
      label: getLabelForElement(element),
      value: element.value,
      selector: getCssSelector(element)
    };
  }).filter(Boolean);
  return {
    title,
    url,
    content: content.substring(0, 5e4),
    // Cap at 50k chars for safety
    forms: inputs
  };
};
function getLabelForElement(element) {
  if (element.id) {
    const labelEl = document.querySelector(`label[for="${element.id}"]`);
    if (labelEl) return labelEl.innerText;
  }
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === "LABEL") {
      return parent.innerText;
    }
    parent = parent.parentElement;
    if (!parent || parent === document.body) break;
  }
  if (element.getAttribute("aria-label")) {
    return element.getAttribute("aria-label") || "";
  }
  return "";
}
function getCssSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === "string" && el.className.trim() !== "") {
    return "." + el.className.trim().split(/\s+/).join(".");
  }
  let path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.parentElement) {
      let siblings = el.parentElement.children;
      if (siblings.length > 1) {
        let index = Array.prototype.indexOf.call(siblings, el) + 1;
        selector += `:nth-child(${index})`;
      }
    }
    path.unshift(selector);
    el = el.parentElement;
    if (!el || el.tagName === "BODY") break;
  }
  return path.join(" > ");
}
console.log("ScholarStream Content Script Loaded");
const API_URL = "http://localhost:8081";
const ENDPOINTS = {
  mapFields: `${API_URL}/api/extension/map-fields`
};
const PLATFORM_TIPS = {
  DevPost: [
    "DevPost judges love clear problem statements",
    "Mention specific technologies and APIs used",
    "Highlight what makes your solution unique",
    "Include demo links or video if available"
  ],
  DoraHacks: [
    "Emphasize blockchain/Web3 aspects if relevant",
    "Highlight technical innovation",
    "Mention open-source contributions",
    "Show traction or community interest"
  ],
  MLH: [
    "Focus on what you learned during the hackathon",
    "Highlight team collaboration",
    "Mention any sponsors' technologies you used",
    "Be enthusiastic and authentic"
  ],
  Default: [
    "Be specific and avoid generic statements",
    "Use concrete examples and numbers",
    "Keep it concise but impactful",
    "Proofread for clarity"
  ]
};
if (window.location.host.includes("localhost") || window.location.host.includes("scholarstream")) {
  const extractAndSendToken = () => {
    let token = localStorage.getItem("scholarstream_auth_token");
    if (!token) {
      Object.keys(localStorage).forEach((key) => {
        if (key.includes("firebase:authUser")) {
          try {
            const user = JSON.parse(localStorage.getItem(key) || "{}");
            if (user.stsTokenManager && user.stsTokenManager.accessToken) {
              token = user.stsTokenManager.accessToken;
            }
          } catch (e) {
          }
        }
      });
    }
    if (token) {
      chrome.storage.local.set({ authToken: token }, () => {
        chrome.storage.local.get(["lastLoggedToken"], (result) => {
          if (result.lastLoggedToken !== token) {
            console.log("🔑 [EXT] Real Firebase token captured!");
            chrome.storage.local.set({ lastLoggedToken: token });
          }
        });
      });
    }
  };
  extractAndSendToken();
  setInterval(extractAndSendToken, 2e3);
}
class FocusEngine {
  constructor() {
    __publicField(this, "activeElement", null);
    __publicField(this, "sparkleBtn");
    __publicField(this, "tooltip");
    __publicField(this, "thoughtBubble");
    __publicField(this, "guidanceBubble");
    __publicField(this, "isStreaming", false);
    __publicField(this, "isDragging", false);
    __publicField(this, "dragOffset", { x: 0, y: 0 });
    __publicField(this, "sparkleHidden", false);
    this.sparkleBtn = this.createSparkleButton();
    this.tooltip = this.createTooltip();
    this.thoughtBubble = this.createThoughtBubble();
    this.guidanceBubble = this.createGuidanceBubble();
    this.initListeners();
  }
  createSparkleButton() {
    const container = document.createElement("div");
    container.id = "ss-sparkle-container";
    container.style.cssText = `
            position: absolute;
            display: none;
            z-index: 2147483647;
            cursor: grab;
        `;
    const btn = document.createElement("div");
    btn.id = "ss-sparkle-trigger";
    btn.style.cssText = `
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #FF6B6B, #4ECDC4);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            animation: ss-pulse 2s infinite;
        `;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>`;
    const closeBtn = document.createElement("div");
    closeBtn.id = "ss-sparkle-close";
    closeBtn.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 18px;
            height: 18px;
            background: #ef4444;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            opacity: 0;
            transition: opacity 0.2s;
        `;
    closeBtn.innerHTML = "×";
    container.appendChild(btn);
    container.appendChild(closeBtn);
    container.onmouseenter = () => {
      closeBtn.style.opacity = "1";
      if (!this.isDragging) btn.style.transform = "scale(1.1)";
    };
    container.onmouseleave = () => {
      closeBtn.style.opacity = "0";
      btn.style.transform = "scale(1)";
    };
    const style = document.createElement("style");
    style.textContent = `
            @keyframes ss-pulse { 0% { box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(78, 205, 196, 0); } 100% { box-shadow: 0 0 0 0 rgba(78, 205, 196, 0); } }
            @keyframes ss-typewriter { from { width: 0; } to { width: 100%; } }
            @keyframes ss-fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            #ss-sparkle-container.dragging { cursor: grabbing !important; }
            @keyframes ss-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
            @keyframes ss-spin { to { transform: rotate(360deg); } }
        `;
    document.head.appendChild(style);
    document.body.appendChild(container);
    btn.onclick = (e) => {
      if (this.isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      this.handleSparkleClick();
    };
    closeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.sparkleHidden = true;
      this.hideSparkle();
    };
    container.onmousedown = (e) => {
      if (e.target.id === "ss-sparkle-close") return;
      this.isDragging = true;
      container.classList.add("dragging");
      const rect = container.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };
    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      container.style.left = `${e.clientX - this.dragOffset.x + window.scrollX}px`;
      container.style.top = `${e.clientY - this.dragOffset.y + window.scrollY}px`;
    });
    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.classList.remove("dragging");
      }
    });
    return container;
  }
  createTooltip() {
    const div = document.createElement("div");
    div.style.cssText = `
            position: absolute;
            display: none;
            background: #1e293b;
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-family: sans-serif;
            z-index: 2147483647;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
    div.innerText = "✨ Auto-Fill with ScholarStream";
    document.body.appendChild(div);
    return div;
  }
  createThoughtBubble() {
    const div = document.createElement("div");
    div.id = "ss-thought-bubble";
    div.style.cssText = `
            position: absolute;
            display: none;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #e2e8f0;
            padding: 14px 18px;
            border-radius: 12px;
            border: 1px solid #334155;
            font-size: 13px;
            font-family: 'Inter', system-ui, sans-serif;
            line-height: 1.5;
            max-width: 360px;
            z-index: 2147483647;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
            pointer-events: none;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s, transform 0.3s;
        `;
    document.body.appendChild(div);
    return div;
  }
  createGuidanceBubble() {
    const div = document.createElement("div");
    div.id = "ss-guidance-bubble";
    div.style.cssText = `
            position: absolute;
            display: none;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #e2e8f0;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #3b82f6;
            font-size: 13px;
            font-family: 'Inter', system-ui, sans-serif;
            line-height: 1.5;
            max-width: 320px;
            z-index: 2147483647;
            box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.3);
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s, transform 0.3s;
        `;
    document.body.appendChild(div);
    return div;
  }
  initListeners() {
    document.addEventListener("focusin", (e) => this.handleFocus(e), true);
    document.addEventListener("scroll", () => this.updatePosition(), true);
    window.addEventListener("resize", () => this.updatePosition());
  }
  handleFocus(e) {
    const target = e.target;
    if (!target) return;
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
      this.hideSparkle();
      return;
    }
    const input = target;
    if (input.type === "file" || input.type === "hidden" || input.type === "submit" || input.type === "image") {
      this.hideSparkle();
      return;
    }
    this.activeElement = target;
    this.showSparkle(target);
  }
  showSparkle(target) {
    if (!target || this.sparkleHidden) return;
    const rect = target.getBoundingClientRect();
    const top = rect.top + window.scrollY + rect.height / 2 - 16;
    const left = rect.right + window.scrollX - 40;
    this.sparkleBtn.style.top = `${top}px`;
    this.sparkleBtn.style.left = `${left}px`;
    this.sparkleBtn.style.display = "flex";
    this.tooltip.style.top = `${top - 30}px`;
    this.tooltip.style.left = `${left - 60}px`;
  }
  hideSparkle() {
    this.sparkleBtn.style.display = "none";
    this.tooltip.style.display = "none";
    this.thoughtBubble.style.opacity = "0";
    this.hideGuidanceBubble();
  }
  updatePosition() {
    if (this.activeElement && this.sparkleBtn.style.display !== "none") {
      this.showSparkle(this.activeElement);
    }
  }
  // ========== ENHANCED THOUGHT BUBBLE (Phase 3) ==========
  showEnhancedReasoning(reasoning, target, fieldContext, wasTemplateUsed) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 8;
    const left = rect.left + window.scrollX;
    const platformTips = PLATFORM_TIPS[fieldContext.platformHint] || PLATFORM_TIPS.Default;
    const randomTip = platformTips[Math.floor(Math.random() * platformTips.length)];
    let content = `<div style="margin-bottom: 8px;"><span style="color: #4ECDC4; font-weight: 600;">🧠 AI Thought:</span> ${reasoning}</div>`;
    if (fieldContext.characterLimit) {
      content += `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">📏 Character limit: ${fieldContext.characterLimit}</div>`;
    }
    if (fieldContext.wordLimit) {
      content += `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">📝 Word limit: ~${fieldContext.wordLimit}</div>`;
    }
    if (fieldContext.format === "markdown") {
      content += `<div style="font-size: 11px; color: #60a5fa; margin-bottom: 6px;">📑 Markdown formatting supported</div>`;
    }
    content += `<div style="font-size: 11px; color: #fbbf24; margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155;">💡 Tip: ${randomTip}</div>`;
    if (wasTemplateUsed) {
      content += `<div style="font-size: 11px; color: #f87171; margin-top: 6px;">⚠️ Template used - replace [BRACKETS] with your info</div>`;
    }
    this.thoughtBubble.innerHTML = content;
    this.thoughtBubble.style.top = `${top}px`;
    this.thoughtBubble.style.left = `${left}px`;
    this.thoughtBubble.style.maxWidth = `${Math.min(360, window.innerWidth - left - 20)}px`;
    this.thoughtBubble.style.display = "block";
    void this.thoughtBubble.offsetWidth;
    this.thoughtBubble.style.opacity = "1";
    this.thoughtBubble.style.transform = "translateY(0)";
    const hideDelay = wasTemplateUsed ? 1e4 : 6e3;
    setTimeout(() => {
      this.thoughtBubble.style.opacity = "0";
      this.thoughtBubble.style.transform = "translateY(10px)";
      setTimeout(() => {
        if (this.thoughtBubble.style.opacity === "0") {
          this.thoughtBubble.style.display = "none";
        }
      }, 300);
    }, hideDelay);
  }
  showGuidanceBubble(target, hasProfile, hasDocument, fieldType) {
    const rect = target.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 8;
    const left = rect.left + window.scrollX;
    let message = "";
    let buttons = "";
    if (!hasProfile && !hasDocument) {
      message = `
                <div style="margin-bottom: 8px; font-weight: 600; color: #fbbf24;">🤔 I can help, but I don't know much about you yet.</div>
                <div style="color: #94a3b8; margin-bottom: 12px;">
                    For a <strong>great ${fieldType}</strong>, I need:
                    <ul style="margin: 8px 0 0 16px; padding: 0;">
                        <li>Your project details (upload via sidebar)</li>
                        <li>Your background (complete your profile)</li>
                    </ul>
                </div>
            `;
      buttons = `
                <button id="ss-guidance-upload" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Upload Doc</button>
                <button id="ss-guidance-profile" style="flex: 1; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Complete Profile</button>
                <button id="ss-guidance-try" style="flex: 1; background: #1e293b; color: #4ade80; border: 1px solid #22c55e; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Try Anyway</button>
            `;
    } else if (!hasDocument) {
      message = `
                <div style="margin-bottom: 8px; font-weight: 600; color: #60a5fa;">💡 I'll use your profile, but I don't have project context.</div>
                <div style="color: #94a3b8; margin-bottom: 12px;">
                    Upload a project README or description for better results on this ${fieldType} field.
                </div>
            `;
      buttons = `
                <button id="ss-guidance-upload" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Upload Doc</button>
                <button id="ss-guidance-try" style="flex: 1; background: #22c55e; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Generate Anyway</button>
            `;
    }
    this.guidanceBubble.innerHTML = `
            ${message}
            <div style="display: flex; gap: 8px; margin-top: 8px;">
                ${buttons}
            </div>
        `;
    this.guidanceBubble.style.top = `${top}px`;
    this.guidanceBubble.style.left = `${left}px`;
    this.guidanceBubble.style.display = "block";
    this.guidanceBubble.style.pointerEvents = "auto";
    void this.guidanceBubble.offsetWidth;
    this.guidanceBubble.style.opacity = "1";
    this.guidanceBubble.style.transform = "translateY(0)";
    setTimeout(() => {
      var _a, _b, _c;
      (_a = document.getElementById("ss-guidance-upload")) == null ? void 0 : _a.addEventListener("click", () => {
        void safeSendMessage({ type: "OPEN_SIDE_PANEL" });
        this.hideGuidanceBubble();
      });
      (_b = document.getElementById("ss-guidance-profile")) == null ? void 0 : _b.addEventListener("click", () => {
        window.open("https://scholarstream-frontend-opdnpd6bsq-uc.a.run.app/profile", "_blank");
        this.hideGuidanceBubble();
      });
      (_c = document.getElementById("ss-guidance-try")) == null ? void 0 : _c.addEventListener("click", () => {
        this.hideGuidanceBubble();
        this.generateWithAvailableContext();
      });
    }, 100);
  }
  hideGuidanceBubble() {
    this.guidanceBubble.style.opacity = "0";
    this.guidanceBubble.style.transform = "translateY(10px)";
    setTimeout(() => {
      this.guidanceBubble.style.display = "none";
    }, 300);
  }
  // ========== ENHANCED FIELD ANALYSIS (Phase 3) ==========
  analyzeField(target) {
    const label = this.getLabel(target);
    const placeholder = target.placeholder || "";
    const combinedText = (label + " " + placeholder).toLowerCase();
    const characterLimit = this.detectCharacterLimit(target);
    const wordLimit = this.detectWordLimit(target, label);
    const format = this.detectFormat(target, combinedText);
    const surroundingContext = this.getSurroundingContext(target);
    const platformHint = this.detectPlatform();
    const fieldCategory = this.categorizeFieldEnhanced(label, placeholder, surroundingContext);
    return {
      id: target.id,
      name: target.name || "",
      label,
      placeholder,
      type: target.type || target.tagName.toLowerCase(),
      selector: uniqueSelector(target),
      characterLimit,
      wordLimit,
      format,
      isRequired: target.required || target.hasAttribute("aria-required"),
      surroundingContext,
      platformHint,
      fieldCategory,
      pageTitle: document.title,
      pageUrl: window.location.href
    };
  }
  detectCharacterLimit(target) {
    if (target.maxLength && target.maxLength > 0 && target.maxLength < 1e6) {
      return target.maxLength;
    }
    const parent = target.parentElement;
    if (parent) {
      const counterText = parent.innerText.match(/(\d+)\s*\/\s*(\d+)/);
      if (counterText) {
        return parseInt(counterText[2], 10);
      }
    }
    const dataMax = target.getAttribute("data-max-length") || target.getAttribute("data-maxlength");
    if (dataMax) return parseInt(dataMax, 10);
    return void 0;
  }
  detectWordLimit(target, label) {
    const combinedText = label.toLowerCase();
    const wordMatch = combinedText.match(/(\d+)\s*words?/i);
    if (wordMatch) {
      return parseInt(wordMatch[1], 10);
    }
    const parent = target.parentElement;
    if (parent) {
      const parentText = parent.innerText.toLowerCase();
      const parentMatch = parentText.match(/(\d+)\s*words?/i);
      if (parentMatch) {
        return parseInt(parentMatch[1], 10);
      }
    }
    return void 0;
  }
  detectFormat(target, combinedText) {
    if (combinedText.includes("markdown") || combinedText.includes("supports formatting") || target.classList.contains("markdown") || target.getAttribute("data-format") === "markdown" || // DevPost submission fields typically support markdown
    window.location.hostname.includes("devpost") && target.tagName === "TEXTAREA") {
      return "markdown";
    }
    if (target.isContentEditable || target.classList.contains("richtext") || target.classList.contains("wysiwyg")) {
      return "html";
    }
    return "plain";
  }
  getSurroundingContext(target) {
    var _a;
    const parts = [];
    let el = target;
    for (let i = 0; i < 5 && el; i++) {
      el = el.parentElement;
      if (el) {
        const heading = el.querySelector("h1, h2, h3, h4, h5, h6");
        if (heading) {
          parts.push(`Section: ${(_a = heading.textContent) == null ? void 0 : _a.trim()}`);
          break;
        }
      }
    }
    const parent = target.parentElement;
    if (parent) {
      const helper = parent.querySelector('.helper-text, .hint, .description, [class*="help"], small');
      if (helper && helper.textContent) {
        parts.push(`Hint: ${helper.textContent.trim().slice(0, 200)}`);
      }
    }
    const labelEl = document.querySelector(`label[for="${target.id}"]`);
    if (labelEl) {
      const small = labelEl.querySelector("small, span.optional, span.required");
      if (small && small.textContent) {
        parts.push(small.textContent.trim());
      }
    }
    return parts.join(" | ").slice(0, 500);
  }
  detectPlatform() {
    const url = window.location.href.toLowerCase();
    if (url.includes("devpost.com")) return "DevPost";
    if (url.includes("dorahacks.io")) return "DoraHacks";
    if (url.includes("mlh.io")) return "MLH";
    if (url.includes("taikai.network")) return "Taikai";
    if (url.includes("gitcoin.co")) return "Gitcoin";
    if (url.includes("immunefi.com")) return "Immunefi";
    if (url.includes("hackerone.com")) return "HackerOne";
    if (url.includes("intigriti.com")) return "Intigriti";
    return "Default";
  }
  categorizeFieldEnhanced(label, placeholder, context) {
    const text = (label + " " + placeholder + " " + context).toLowerCase();
    if (text.includes("elevator") || text.includes("pitch") || text.includes("tagline")) return "elevator_pitch";
    if (text.includes("description") || text.includes("about") || text.includes("overview")) return "description";
    if (text.includes("inspiration") || text.includes("why") || text.includes("motivation") || text.includes("what inspired")) return "inspiration";
    if (text.includes("built") || text.includes("how") || text.includes("technical") || text.includes("architecture") || text.includes("stack")) return "technical";
    if (text.includes("challenge") || text.includes("obstacle") || text.includes("difficult") || text.includes("learned")) return "challenges";
    if (text.includes("team") || text.includes("member") || text.includes("collaborat")) return "team";
    if (text.includes("name") || text.includes("email") || text.includes("phone") || text.includes("linkedin") || text.includes("github")) return "personal_info";
    if (text.includes("url") || text.includes("link") || text.includes("demo") || text.includes("video") || text.includes("repo")) return "links";
    return "generic";
  }
  async handleSparkleClick() {
    if (!this.activeElement || this.isStreaming) return;
    const target = this.activeElement;
    const stored = await chrome.storage.local.get(["userProfile", "projectContext"]);
    const hasProfile = stored.userProfile && Object.keys(stored.userProfile).length > 0;
    const hasDocument = !!stored.projectContext;
    const fieldContext = this.analyzeField(target);
    const needsProjectContext = ["elevator_pitch", "description", "inspiration", "technical", "challenges"].includes(fieldContext.fieldCategory);
    if (needsProjectContext && !hasDocument && !hasProfile) {
      this.showGuidanceBubble(target, hasProfile, hasDocument, fieldContext.fieldCategory.replace("_", " "));
      return;
    }
    await this.generateWithEnhancedContext(fieldContext, hasProfile, hasDocument);
  }
  async generateWithEnhancedContext(fieldContext, hasProfile, hasDocument) {
    var _a, _b;
    if (!this.activeElement) return;
    this.isStreaming = true;
    const target = this.activeElement;
    const btn = this.sparkleBtn.querySelector("#ss-sparkle-trigger");
    if (btn) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="animation: ss-spin 1s linear infinite;"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2C6.48 2 2 6.48 2 12" opacity="0.75"/></svg>`;
    }
    try {
      const result = await generateFieldContentEnhanced(fieldContext, hasProfile, hasDocument);
      const content = ((_a = result.sparkle_result) == null ? void 0 : _a.content) || result.filled_value || result.template_content;
      const reasoning = ((_b = result.sparkle_result) == null ? void 0 : _b.reasoning) || result.reasoning || "Generated based on available context";
      const wasTemplateUsed = !!result.template_content || content && content.includes("[");
      if (content) {
        this.showEnhancedReasoning(reasoning, target, fieldContext, wasTemplateUsed);
        await this.typewriterEffect(target, content);
      }
    } catch (e) {
      console.error("Focus Fill Failed", e);
      this.showEnhancedReasoning(
        "Failed to generate content. Try again or check your connection.",
        target,
        fieldContext,
        false
      );
    } finally {
      this.isStreaming = false;
      const btn2 = this.sparkleBtn.querySelector("#ss-sparkle-trigger");
      if (btn2) {
        btn2.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>`;
      }
    }
  }
  // Legacy method for backward compatibility
  async generateWithAvailableContext() {
    if (!this.activeElement) return;
    const target = this.activeElement;
    const fieldContext = this.analyzeField(target);
    const stored = await chrome.storage.local.get(["userProfile", "projectContext"]);
    const hasProfile = stored.userProfile && Object.keys(stored.userProfile).length > 0;
    const hasDocument = !!stored.projectContext;
    await this.generateWithEnhancedContext(fieldContext, hasProfile, hasDocument);
  }
  getLabel(el) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return (((_b = (_a = document.querySelector(`label[for="${el.id}"]`)) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_d = (_c = el.closest("label")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || ((_f = (_e = el.previousElementSibling) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim()) || ((_h = (_g = el.parentElement) == null ? void 0 : _g.textContent) == null ? void 0 : _h.trim()) || "").slice(0, 100);
  }
  async typewriterEffect(element, text) {
    element.value = "";
    element.focus();
    const speed = Math.max(10, Math.min(50, 1e3 / text.length));
    for (let i = 0; i < text.length; i++) {
      element.value += text.charAt(i);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      if (element.scrollTop !== void 0) element.scrollTop = element.scrollHeight;
      await new Promise((r) => setTimeout(r, speed + Math.random() * 10));
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
    const originalBg = element.style.backgroundColor;
    element.style.transition = "background-color 0.5s";
    element.style.backgroundColor = "#dcfce7";
    setTimeout(() => element.style.backgroundColor = originalBg, 1e3);
  }
}
new FocusEngine();
async function generateFieldContentEnhanced(fieldContext, hasProfile, hasDocument) {
  let userProfile = {};
  let projectContext = "";
  try {
    const stored = await chrome.storage.local.get(["userProfile", "projectContext"]);
    userProfile = stored.userProfile || {};
    projectContext = stored.projectContext || "";
  } catch (e) {
  }
  const storedToken = (await chrome.storage.local.get(["authToken"])).authToken;
  if (!storedToken) {
    throw new Error("Not authenticated");
  }
  let instruction = `Fill this ${fieldContext.fieldCategory.replace("_", " ")} field.`;
  if (fieldContext.characterLimit) {
    instruction += ` Keep under ${fieldContext.characterLimit} characters.`;
  }
  if (fieldContext.wordLimit) {
    instruction += ` Aim for approximately ${fieldContext.wordLimit} words.`;
  }
  if (fieldContext.format === "markdown") {
    instruction += ` Use markdown formatting for emphasis and structure.`;
  }
  if (fieldContext.surroundingContext) {
    instruction += ` Context: ${fieldContext.surroundingContext}`;
  }
  if (!hasProfile && !hasDocument) {
    instruction += ` Since no profile or project context is available, generate a helpful template with [PLACEHOLDER] brackets that the user can fill in.`;
  } else if (!hasDocument && ["elevator_pitch", "description", "technical", "challenges"].includes(fieldContext.fieldCategory)) {
    instruction += ` No project document uploaded - use profile info and generate helpful content with [PROJECT SPECIFIC DETAILS] placeholders where needed.`;
  }
  const response = await fetch(ENDPOINTS.mapFields, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${storedToken}`
    },
    body: JSON.stringify({
      form_fields: [],
      user_profile: userProfile,
      target_field: {
        ...fieldContext,
        // Flatten for backend compatibility
        id: fieldContext.id,
        name: fieldContext.name,
        type: fieldContext.type,
        placeholder: fieldContext.placeholder,
        label: fieldContext.label,
        characterLimit: fieldContext.characterLimit,
        wordLimit: fieldContext.wordLimit,
        format: fieldContext.format,
        fieldCategory: fieldContext.fieldCategory,
        platformHint: fieldContext.platformHint
      },
      project_context: projectContext,
      instruction
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }
  return await response.json();
}
const safeSendMessage = async (message) => {
  var _a;
  if (!((_a = chrome.runtime) == null ? void 0 : _a.id)) {
    console.warn("Extension context invalidated. Reload page to reconnect.");
    return;
  }
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (e) {
    const msg = e.message || "";
    if (msg.includes("Extension context invalidated") || msg.includes("receiving end does not exist")) {
      console.log("Extension disconnected (reload needed).");
    } else {
      console.error("Message send failed:", e);
    }
  }
};
function uniqueSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.name) return `[name="${el.name}"]`;
  return el.tagName.toLowerCase();
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  var _a;
  if (!((_a = chrome.runtime) == null ? void 0 : _a.id)) return;
  try {
    if (message.type === "GET_PAGE_CONTEXT") {
      const context = getPageContext();
      console.log("Creating context:", context.title);
      sendResponse(context);
    }
    if (message.type === "AUTO_FILL_REQUEST") {
      console.log("Agentic Auto-Fill Triggered");
      handleAutoFill(message.projectContext).then((result) => {
        try {
          sendResponse(result);
        } catch (e) {
        }
      });
      return true;
    }
  } catch (e) {
    console.error("Content Script Error:", e);
  }
});
async function handleAutoFill(projectContext) {
  const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
  const formFields = inputs.map((el) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return {
      id: el.id,
      name: el.name,
      type: el.type || el.tagName.toLowerCase(),
      placeholder: el.placeholder,
      label: (((_b = (_a = document.querySelector(`label[for="${el.id}"]`)) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_d = (_c = el.closest("label")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || ((_f = (_e = el.previousElementSibling) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim()) || ((_h = (_g = el.parentElement) == null ? void 0 : _g.textContent) == null ? void 0 : _h.trim()) || "").slice(0, 100),
      selector: uniqueSelector(el)
    };
  }).filter((f) => f.type !== "hidden" && f.type !== "submit" && f.type !== "file");
  if (formFields.length === 0) return { success: false, message: "No fields found" };
  let userProfile = {};
  try {
    const stored = await chrome.storage.local.get(["userProfile"]);
    userProfile = stored.userProfile || {};
  } catch (e) {
    console.log("No stored profile, using empty");
  }
  try {
    const storedToken = (await chrome.storage.local.get(["authToken"])).authToken;
    if (!storedToken) {
      return { success: false, message: "Please sign in securely through the extension first." };
    }
    console.log(`🔑 [EXT] Using secure token for API call`);
    const response = await fetch(ENDPOINTS.mapFields, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${storedToken}`
      },
      body: JSON.stringify({
        form_fields: formFields,
        user_profile: userProfile,
        project_context: projectContext
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    const fieldMappings = data.field_mappings || {};
    let filledCount = 0;
    for (const [selector, value] of Object.entries(fieldMappings)) {
      const el = document.querySelector(selector);
      if (el && value) {
        if (el.type === "file") continue;
        el.value = String(value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filledCount++;
        el.style.border = "2px solid #22c55e";
        el.style.backgroundColor = "#f0fdf4";
      }
    }
    return { success: true, filled: filledCount };
  } catch (error) {
    console.error("Auto-Fill Failed:", error);
    return { success: false, error: String(error) };
  }
}
if (document.body.innerText.toLowerCase().includes("scholarship") || document.body.innerText.toLowerCase().includes("hackathon") || document.body.innerText.toLowerCase().includes("grant") || window.location.hostname.includes("devpost") || window.location.hostname.includes("dorahacks") || window.location.hostname.includes("mlh") || window.location.hostname.includes("taikai")) {
  const icon = document.createElement("div");
  icon.id = "scholarstream-pulse-icon";
  icon.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 50%;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      z-index: 9999;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: sans-serif;
      font-weight: bold;
      transition: transform 0.2s;
    `;
  icon.innerText = "SS";
  icon.onclick = () => {
    console.log("Pulse Clicked - Requesting Side Panel Open");
    safeSendMessage({ type: "OPEN_SIDE_PANEL" });
  };
  document.body.appendChild(icon);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3V0aWxzL2RvbVNjYW5uZXIudHMiLCIuLi9zcmMvY29udGVudC9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuLyoqXHJcbiAqIERPTSBTY2FubmVyIHRvIGV4dHJhY3QgcmVsZXZhbnQgcGFnZSBjb250ZXh0IGZvciB0aGUgQUkuXHJcbiAqIENhcHR1cmVzIHZpc2libGUgdGV4dCwgZm9ybSBmaWVsZHMsIGFuZCBtZXRhZGF0YS5cclxuICovXHJcblxyXG5leHBvcnQgY29uc3QgZ2V0UGFnZUNvbnRleHQgPSAoKSA9PiB7XHJcbiAgICAvLyAxLiBCYXNpYyBNZXRhZGF0YVxyXG4gICAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC50aXRsZTtcclxuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xyXG5cclxuICAgIC8vIDIuIFZpc2libGUgVGV4dCAoU2ltcGxpZmllZClcclxuICAgIC8vIENsb25lIGJvZHkgdG8gYXZvaWQgbW9kaWZ5aW5nIGxpdmUgcGFnZVxyXG4gICAgY29uc3QgY2xvbmUgPSBkb2N1bWVudC5ib2R5LmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAvLyBSZW1vdmUgc2NyaXB0cyBhbmQgc3R5bGVzXHJcbiAgICBjb25zdCBzY3JpcHRzID0gY2xvbmUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpO1xyXG4gICAgd2hpbGUgKHNjcmlwdHNbMF0pIHNjcmlwdHNbMF0ucGFyZW50Tm9kZT8ucmVtb3ZlQ2hpbGQoc2NyaXB0c1swXSk7XHJcblxyXG4gICAgY29uc3Qgc3R5bGVzID0gY2xvbmUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3N0eWxlJyk7XHJcbiAgICB3aGlsZSAoc3R5bGVzWzBdKSBzdHlsZXNbMF0ucGFyZW50Tm9kZT8ucmVtb3ZlQ2hpbGQoc3R5bGVzWzBdKTtcclxuXHJcbiAgICBjb25zdCBjb250ZW50ID0gY2xvbmUuaW5uZXJUZXh0IHx8IFwiXCI7XHJcblxyXG4gICAgLy8gMy4gRm9ybSBGaWVsZHMgKENyaXRpY2FsIGZvciBDby1QaWxvdCBmaWxsaW5nKVxyXG4gICAgY29uc3QgaW5wdXRzID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcpKS5tYXAoKGVsLCBpbmRleCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBlbCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cclxuICAgICAgICAvLyBTa2lwIGhpZGRlbiBmaWVsZHNcclxuICAgICAgICBpZiAocmVjdC53aWR0aCA9PT0gMCB8fCByZWN0LmhlaWdodCA9PT0gMCB8fCBlbGVtZW50LnR5cGUgPT09ICdoaWRkZW4nKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaWQ6IGVsZW1lbnQuaWQgfHwgYGlucHV0XyR7aW5kZXh9YCxcclxuICAgICAgICAgICAgbmFtZTogZWxlbWVudC5uYW1lLFxyXG4gICAgICAgICAgICB0eXBlOiBlbGVtZW50LnR5cGUsXHJcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyOiAncGxhY2Vob2xkZXInIGluIGVsZW1lbnQgPyBlbGVtZW50LnBsYWNlaG9sZGVyIDogJycsXHJcbiAgICAgICAgICAgIGxhYmVsOiBnZXRMYWJlbEZvckVsZW1lbnQoZWxlbWVudCksXHJcbiAgICAgICAgICAgIHZhbHVlOiBlbGVtZW50LnZhbHVlLFxyXG4gICAgICAgICAgICBzZWxlY3RvcjogZ2V0Q3NzU2VsZWN0b3IoZWxlbWVudClcclxuICAgICAgICB9O1xyXG4gICAgfSkuZmlsdGVyKEJvb2xlYW4pO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdGl0bGUsXHJcbiAgICAgICAgdXJsLFxyXG4gICAgICAgIGNvbnRlbnQ6IGNvbnRlbnQuc3Vic3RyaW5nKDAsIDUwMDAwKSwgLy8gQ2FwIGF0IDUwayBjaGFycyBmb3Igc2FmZXR5XHJcbiAgICAgICAgZm9ybXM6IGlucHV0c1xyXG4gICAgfTtcclxufTtcclxuXHJcbi8vIEhlbHBlcjogR2V0IExhYmVsIHRleHQgZm9yIGFuIGlucHV0XHJcbmZ1bmN0aW9uIGdldExhYmVsRm9yRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XHJcbiAgICBsZXQgbGFiZWwgPSAnJztcclxuXHJcbiAgICAvLyAxLiBDaGVjayBmb3IgbGFiZWwgdGFnIHdpdGggJ2ZvcicgYXR0cmlidXRlXHJcbiAgICBpZiAoZWxlbWVudC5pZCkge1xyXG4gICAgICAgIGNvbnN0IGxhYmVsRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsYWJlbFtmb3I9XCIke2VsZW1lbnQuaWR9XCJdYCk7XHJcbiAgICAgICAgaWYgKGxhYmVsRWwpIHJldHVybiAobGFiZWxFbCBhcyBIVE1MRWxlbWVudCkuaW5uZXJUZXh0O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIDIuIENoZWNrIGZvciBwYXJlbnQgbGFiZWxcclxuICAgIGxldCBwYXJlbnQgPSBlbGVtZW50LnBhcmVudEVsZW1lbnQ7XHJcbiAgICB3aGlsZSAocGFyZW50KSB7XHJcbiAgICAgICAgaWYgKHBhcmVudC50YWdOYW1lID09PSAnTEFCRUwnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAocGFyZW50IGFzIEhUTUxFbGVtZW50KS5pbm5lclRleHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnRFbGVtZW50O1xyXG4gICAgICAgIGlmICghcGFyZW50IHx8IHBhcmVudCA9PT0gZG9jdW1lbnQuYm9keSkgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gMy4gQ2hlY2sgZm9yIGFyaWEtbGFiZWxcclxuICAgIGlmIChlbGVtZW50LmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpKSB7XHJcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHwgJyc7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuICcnO1xyXG59XHJcblxyXG4vLyBIZWxwZXI6IEdlbmVyYXRlIHVuaXF1ZSBDU1Mgc2VsZWN0b3JcclxuZnVuY3Rpb24gZ2V0Q3NzU2VsZWN0b3IoZWw6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcclxuICAgIGlmIChlbC5pZCkgcmV0dXJuIGAjJHtlbC5pZH1gO1xyXG4gICAgaWYgKGVsLmNsYXNzTmFtZSAmJiB0eXBlb2YgZWwuY2xhc3NOYW1lID09PSAnc3RyaW5nJyAmJiBlbC5jbGFzc05hbWUudHJpbSgpICE9PSAnJykge1xyXG4gICAgICAgIHJldHVybiAnLicgKyBlbC5jbGFzc05hbWUudHJpbSgpLnNwbGl0KC9cXHMrLykuam9pbignLicpO1xyXG4gICAgfVxyXG4gICAgLy8gRmFsbGJhY2sgcGF0aFxyXG4gICAgbGV0IHBhdGggPSBbXTtcclxuICAgIHdoaWxlIChlbC5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUpIHtcclxuICAgICAgICBsZXQgc2VsZWN0b3IgPSBlbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgIGlmIChlbC5wYXJlbnRFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIGxldCBzaWJsaW5ncyA9IGVsLnBhcmVudEVsZW1lbnQuY2hpbGRyZW47XHJcbiAgICAgICAgICAgIGlmIChzaWJsaW5ncy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXggPSBBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHNpYmxpbmdzLCBlbCkgKyAxO1xyXG4gICAgICAgICAgICAgICAgc2VsZWN0b3IgKz0gYDpudGgtY2hpbGQoJHtpbmRleH0pYDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBwYXRoLnVuc2hpZnQoc2VsZWN0b3IpO1xyXG4gICAgICAgIGVsID0gZWwucGFyZW50RWxlbWVudCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBpZiAoIWVsIHx8IGVsLnRhZ05hbWUgPT09ICdCT0RZJykgYnJlYWs7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGF0aC5qb2luKCcgPiAnKTtcclxufVxyXG4iLCJjb25zb2xlLmxvZyhcIlNjaG9sYXJTdHJlYW0gQ29udGVudCBTY3JpcHQgTG9hZGVkXCIpO1xyXG5cclxuaW1wb3J0IHsgZ2V0UGFnZUNvbnRleHQgfSBmcm9tICcuLi91dGlscy9kb21TY2FubmVyJztcclxuXHJcbi8vIEFQSSBDb25maWd1cmF0aW9uIC0gbWF0Y2hlcyBleHRlbnNpb24gY29uZmlnXHJcbmNvbnN0IEFQSV9VUkwgPSAnX19WSVRFX0FQSV9VUkxfXycgIT09ICdfX1ZJVEVfQVBJX1VSTF9fJyBcclxuICAgID8gJ19fVklURV9BUElfVVJMX18nIFxyXG4gICAgOiAnaHR0cDovL2xvY2FsaG9zdDo4MDgxJztcclxuXHJcbmNvbnN0IEVORFBPSU5UUyA9IHtcclxuICAgIG1hcEZpZWxkczogYCR7QVBJX1VSTH0vYXBpL2V4dGVuc2lvbi9tYXAtZmllbGRzYCxcclxufTtcclxuXHJcbi8vID09PT09PT09PT0gRU5IQU5DRUQgRklFTEQgQ09OVEVYVCAoUGhhc2UgMykgPT09PT09PT09PVxyXG5pbnRlcmZhY2UgRmllbGRDb250ZXh0IHtcclxuICAgIC8vIEJhc2ljXHJcbiAgICBpZDogc3RyaW5nO1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgbGFiZWw6IHN0cmluZztcclxuICAgIHBsYWNlaG9sZGVyOiBzdHJpbmc7XHJcbiAgICB0eXBlOiBzdHJpbmc7XHJcbiAgICBzZWxlY3Rvcjogc3RyaW5nO1xyXG4gICAgXHJcbiAgICAvLyBFbmhhbmNlZCAoUGhhc2UgMylcclxuICAgIGNoYXJhY3RlckxpbWl0PzogbnVtYmVyO1xyXG4gICAgd29yZExpbWl0PzogbnVtYmVyO1xyXG4gICAgZm9ybWF0OiAncGxhaW4nIHwgJ21hcmtkb3duJyB8ICdodG1sJztcclxuICAgIGlzUmVxdWlyZWQ6IGJvb2xlYW47XHJcbiAgICBzdXJyb3VuZGluZ0NvbnRleHQ6IHN0cmluZztcclxuICAgIHBsYXRmb3JtSGludDogc3RyaW5nO1xyXG4gICAgZmllbGRDYXRlZ29yeTogRmllbGRDYXRlZ29yeTtcclxuICAgIFxyXG4gICAgLy8gUGFnZSBjb250ZXh0XHJcbiAgICBwYWdlVGl0bGU6IHN0cmluZztcclxuICAgIHBhZ2VVcmw6IHN0cmluZztcclxufVxyXG5cclxudHlwZSBGaWVsZENhdGVnb3J5ID0gXHJcbiAgICB8ICdlbGV2YXRvcl9waXRjaCcgXHJcbiAgICB8ICdkZXNjcmlwdGlvbicgXHJcbiAgICB8ICdpbnNwaXJhdGlvbicgXHJcbiAgICB8ICd0ZWNobmljYWwnIFxyXG4gICAgfCAnY2hhbGxlbmdlcycgXHJcbiAgICB8ICd0ZWFtJyBcclxuICAgIHwgJ3BlcnNvbmFsX2luZm8nXHJcbiAgICB8ICdsaW5rcydcclxuICAgIHwgJ2dlbmVyaWMnO1xyXG5cclxuLy8gUGxhdGZvcm0tc3BlY2lmaWMgdGlwcyBmb3IgdGhvdWdodCBidWJibGVcclxuY29uc3QgUExBVEZPUk1fVElQUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xyXG4gICAgRGV2UG9zdDogW1xyXG4gICAgICAgIFwiRGV2UG9zdCBqdWRnZXMgbG92ZSBjbGVhciBwcm9ibGVtIHN0YXRlbWVudHNcIixcclxuICAgICAgICBcIk1lbnRpb24gc3BlY2lmaWMgdGVjaG5vbG9naWVzIGFuZCBBUElzIHVzZWRcIixcclxuICAgICAgICBcIkhpZ2hsaWdodCB3aGF0IG1ha2VzIHlvdXIgc29sdXRpb24gdW5pcXVlXCIsXHJcbiAgICAgICAgXCJJbmNsdWRlIGRlbW8gbGlua3Mgb3IgdmlkZW8gaWYgYXZhaWxhYmxlXCJcclxuICAgIF0sXHJcbiAgICBEb3JhSGFja3M6IFtcclxuICAgICAgICBcIkVtcGhhc2l6ZSBibG9ja2NoYWluL1dlYjMgYXNwZWN0cyBpZiByZWxldmFudFwiLFxyXG4gICAgICAgIFwiSGlnaGxpZ2h0IHRlY2huaWNhbCBpbm5vdmF0aW9uXCIsXHJcbiAgICAgICAgXCJNZW50aW9uIG9wZW4tc291cmNlIGNvbnRyaWJ1dGlvbnNcIixcclxuICAgICAgICBcIlNob3cgdHJhY3Rpb24gb3IgY29tbXVuaXR5IGludGVyZXN0XCJcclxuICAgIF0sXHJcbiAgICBNTEg6IFtcclxuICAgICAgICBcIkZvY3VzIG9uIHdoYXQgeW91IGxlYXJuZWQgZHVyaW5nIHRoZSBoYWNrYXRob25cIixcclxuICAgICAgICBcIkhpZ2hsaWdodCB0ZWFtIGNvbGxhYm9yYXRpb25cIixcclxuICAgICAgICBcIk1lbnRpb24gYW55IHNwb25zb3JzJyB0ZWNobm9sb2dpZXMgeW91IHVzZWRcIixcclxuICAgICAgICBcIkJlIGVudGh1c2lhc3RpYyBhbmQgYXV0aGVudGljXCJcclxuICAgIF0sXHJcbiAgICBEZWZhdWx0OiBbXHJcbiAgICAgICAgXCJCZSBzcGVjaWZpYyBhbmQgYXZvaWQgZ2VuZXJpYyBzdGF0ZW1lbnRzXCIsXHJcbiAgICAgICAgXCJVc2UgY29uY3JldGUgZXhhbXBsZXMgYW5kIG51bWJlcnNcIixcclxuICAgICAgICBcIktlZXAgaXQgY29uY2lzZSBidXQgaW1wYWN0ZnVsXCIsXHJcbiAgICAgICAgXCJQcm9vZnJlYWQgZm9yIGNsYXJpdHlcIlxyXG4gICAgXVxyXG59O1xyXG5cclxuLy8gPT09PT0gUkVBTCBBVVRIOiBFeHRyYWN0IHRva2VuIGZyb20gU2Nob2xhclN0cmVhbSB3ZWIgYXBwID09PT09XHJcbmlmICh3aW5kb3cubG9jYXRpb24uaG9zdC5pbmNsdWRlcygnbG9jYWxob3N0JykgfHwgd2luZG93LmxvY2F0aW9uLmhvc3QuaW5jbHVkZXMoJ3NjaG9sYXJzdHJlYW0nKSkge1xyXG4gICAgY29uc3QgZXh0cmFjdEFuZFNlbmRUb2tlbiA9ICgpID0+IHtcclxuICAgICAgICBsZXQgdG9rZW4gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnc2Nob2xhcnN0cmVhbV9hdXRoX3Rva2VuJyk7XHJcblxyXG4gICAgICAgIGlmICghdG9rZW4pIHtcclxuICAgICAgICAgICAgT2JqZWN0LmtleXMobG9jYWxTdG9yYWdlKS5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoa2V5LmluY2x1ZGVzKCdmaXJlYmFzZTphdXRoVXNlcicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXNlciA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KSB8fCAne30nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVzZXIuc3RzVG9rZW5NYW5hZ2VyICYmIHVzZXIuc3RzVG9rZW5NYW5hZ2VyLmFjY2Vzc1Rva2VuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2tlbiA9IHVzZXIuc3RzVG9rZW5NYW5hZ2VyLmFjY2Vzc1Rva2VuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZ25vcmUgcGFyc2UgZXJyb3JzXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0b2tlbikge1xyXG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBhdXRoVG9rZW46IHRva2VuIH0sICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2xhc3RMb2dnZWRUb2tlbiddLCAocmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5sYXN0TG9nZ2VkVG9rZW4gIT09IHRva2VuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfwn5SRIFtFWFRdIFJlYWwgRmlyZWJhc2UgdG9rZW4gY2FwdHVyZWQhJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IGxhc3RMb2dnZWRUb2tlbjogdG9rZW4gfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgZXh0cmFjdEFuZFNlbmRUb2tlbigpO1xyXG4gICAgc2V0SW50ZXJ2YWwoZXh0cmFjdEFuZFNlbmRUb2tlbiwgMjAwMCk7XHJcbn1cclxuXHJcbi8vID09PT09IElOVEVMTElHRU5UIFNQQVJLTEUgRU5HSU5FIChQaGFzZSAzKSA9PT09PVxyXG5jbGFzcyBGb2N1c0VuZ2luZSB7XHJcbiAgICBwcml2YXRlIGFjdGl2ZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcbiAgICBwcml2YXRlIHNwYXJrbGVCdG46IEhUTUxEaXZFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSB0b29sdGlwOiBIVE1MRGl2RWxlbWVudDtcclxuICAgIHByaXZhdGUgdGhvdWdodEJ1YmJsZTogSFRNTERpdkVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIGd1aWRhbmNlQnViYmxlOiBIVE1MRGl2RWxlbWVudDtcclxuICAgIHByaXZhdGUgaXNTdHJlYW1pbmcgPSBmYWxzZTtcclxuICAgIHByaXZhdGUgaXNEcmFnZ2luZyA9IGZhbHNlO1xyXG4gICAgcHJpdmF0ZSBkcmFnT2Zmc2V0ID0geyB4OiAwLCB5OiAwIH07XHJcbiAgICBwcml2YXRlIHNwYXJrbGVIaWRkZW4gPSBmYWxzZTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLnNwYXJrbGVCdG4gPSB0aGlzLmNyZWF0ZVNwYXJrbGVCdXR0b24oKTtcclxuICAgICAgICB0aGlzLnRvb2x0aXAgPSB0aGlzLmNyZWF0ZVRvb2x0aXAoKTtcclxuICAgICAgICB0aGlzLnRob3VnaHRCdWJibGUgPSB0aGlzLmNyZWF0ZVRob3VnaHRCdWJibGUoKTtcclxuICAgICAgICB0aGlzLmd1aWRhbmNlQnViYmxlID0gdGhpcy5jcmVhdGVHdWlkYW5jZUJ1YmJsZSgpO1xyXG4gICAgICAgIHRoaXMuaW5pdExpc3RlbmVycygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlU3BhcmtsZUJ1dHRvbigpOiBIVE1MRGl2RWxlbWVudCB7XHJcbiAgICAgICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgY29udGFpbmVyLmlkID0gJ3NzLXNwYXJrbGUtY29udGFpbmVyJztcclxuICAgICAgICBjb250YWluZXIuc3R5bGUuY3NzVGV4dCA9IGBcclxuICAgICAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICAgICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgICAgICAgICB6LWluZGV4OiAyMTQ3NDgzNjQ3O1xyXG4gICAgICAgICAgICBjdXJzb3I6IGdyYWI7XHJcbiAgICAgICAgYDtcclxuXHJcbiAgICAgICAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgYnRuLmlkID0gJ3NzLXNwYXJrbGUtdHJpZ2dlcic7XHJcbiAgICAgICAgYnRuLnN0eWxlLmNzc1RleHQgPSBgXHJcbiAgICAgICAgICAgIHdpZHRoOiAzMnB4O1xyXG4gICAgICAgICAgICBoZWlnaHQ6IDMycHg7XHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICNGRjZCNkIsICM0RUNEQzQpO1xyXG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMik7XHJcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICAgICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBjdWJpYy1iZXppZXIoMC4zNCwgMS41NiwgMC42NCwgMSk7XHJcbiAgICAgICAgICAgIGFuaW1hdGlvbjogc3MtcHVsc2UgMnMgaW5maW5pdGU7XHJcbiAgICAgICAgYDtcclxuICAgICAgICBidG4uaW5uZXJIVE1MID0gYDxzdmcgd2lkdGg9XCIxOFwiIGhlaWdodD1cIjE4XCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwid2hpdGVcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBhdGggZD1cIk0xMiAyTDE1LjA5IDguMjZMMjIgOS4yN0wxNyAxNC4xNEwxOC4xOCAyMS4wMkwxMiAxNy43N0w1LjgyIDIxLjAyTDcgMTQuMTRMMiA5LjI3TDguOTEgOC4yNkwxMiAyWlwiPjwvcGF0aD48L3N2Zz5gO1xyXG5cclxuICAgICAgICBjb25zdCBjbG9zZUJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGNsb3NlQnRuLmlkID0gJ3NzLXNwYXJrbGUtY2xvc2UnO1xyXG4gICAgICAgIGNsb3NlQnRuLnN0eWxlLmNzc1RleHQgPSBgXHJcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgICAgICAgdG9wOiAtOHB4O1xyXG4gICAgICAgICAgICByaWdodDogLThweDtcclxuICAgICAgICAgICAgd2lkdGg6IDE4cHg7XHJcbiAgICAgICAgICAgIGhlaWdodDogMThweDtcclxuICAgICAgICAgICAgYmFja2dyb3VuZDogI2VmNDQ0NDtcclxuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xyXG4gICAgICAgICAgICBjb2xvcjogd2hpdGU7XHJcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDRweCByZ2JhKDAsMCwwLDAuMik7XHJcbiAgICAgICAgICAgIG9wYWNpdHk6IDA7XHJcbiAgICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4ycztcclxuICAgICAgICBgO1xyXG4gICAgICAgIGNsb3NlQnRuLmlubmVySFRNTCA9ICfDlyc7XHJcblxyXG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChidG4pO1xyXG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChjbG9zZUJ0bik7XHJcblxyXG4gICAgICAgIGNvbnRhaW5lci5vbm1vdXNlZW50ZXIgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGNsb3NlQnRuLnN0eWxlLm9wYWNpdHkgPSAnMSc7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5pc0RyYWdnaW5nKSBidG4uc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEuMSknO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgY29udGFpbmVyLm9ubW91c2VsZWF2ZSA9ICgpID0+IHtcclxuICAgICAgICAgICAgY2xvc2VCdG4uc3R5bGUub3BhY2l0eSA9ICcwJztcclxuICAgICAgICAgICAgYnRuLnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxKSc7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxyXG4gICAgICAgICAgICBAa2V5ZnJhbWVzIHNzLXB1bHNlIHsgMCUgeyBib3gtc2hhZG93OiAwIDAgMCAwIHJnYmEoNzgsIDIwNSwgMTk2LCAwLjcpOyB9IDcwJSB7IGJveC1zaGFkb3c6IDAgMCAwIDEwcHggcmdiYSg3OCwgMjA1LCAxOTYsIDApOyB9IDEwMCUgeyBib3gtc2hhZG93OiAwIDAgMCAwIHJnYmEoNzgsIDIwNSwgMTk2LCAwKTsgfSB9XHJcbiAgICAgICAgICAgIEBrZXlmcmFtZXMgc3MtdHlwZXdyaXRlciB7IGZyb20geyB3aWR0aDogMDsgfSB0byB7IHdpZHRoOiAxMDAlOyB9IH1cclxuICAgICAgICAgICAgQGtleWZyYW1lcyBzcy1mYWRlLWluLXVwIHsgZnJvbSB7IG9wYWNpdHk6IDA7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgxMHB4KTsgfSB0byB7IG9wYWNpdHk6IDE7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgfSB9XHJcbiAgICAgICAgICAgICNzcy1zcGFya2xlLWNvbnRhaW5lci5kcmFnZ2luZyB7IGN1cnNvcjogZ3JhYmJpbmcgIWltcG9ydGFudDsgfVxyXG4gICAgICAgICAgICBAa2V5ZnJhbWVzIHNzLWJvdW5jZSB7IDAlLCAxMDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9IDUwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTsgfSB9XHJcbiAgICAgICAgICAgIEBrZXlmcmFtZXMgc3Mtc3BpbiB7IHRvIHsgdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTsgfSB9XHJcbiAgICAgICAgYDtcclxuICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcblxyXG4gICAgICAgIGJ0bi5vbmNsaWNrID0gKGUpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNEcmFnZ2luZykgcmV0dXJuO1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlU3BhcmtsZUNsaWNrKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY2xvc2VCdG4ub25jbGljayA9IChlKSA9PiB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgdGhpcy5zcGFya2xlSGlkZGVuID0gdHJ1ZTtcclxuICAgICAgICAgICAgdGhpcy5oaWRlU3BhcmtsZSgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnRhaW5lci5vbm1vdXNlZG93biA9IChlKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICgoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmlkID09PSAnc3Mtc3BhcmtsZS1jbG9zZScpIHJldHVybjtcclxuICAgICAgICAgICAgdGhpcy5pc0RyYWdnaW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgICAgICAgIHRoaXMuZHJhZ09mZnNldCA9IHtcclxuICAgICAgICAgICAgICAgIHg6IGUuY2xpZW50WCAtIHJlY3QubGVmdCxcclxuICAgICAgICAgICAgICAgIHk6IGUuY2xpZW50WSAtIHJlY3QudG9wXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgKGUpID0+IHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmlzRHJhZ2dpbmcpIHJldHVybjtcclxuICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLmxlZnQgPSBgJHtlLmNsaWVudFggLSB0aGlzLmRyYWdPZmZzZXQueCArIHdpbmRvdy5zY3JvbGxYfXB4YDtcclxuICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLnRvcCA9IGAke2UuY2xpZW50WSAtIHRoaXMuZHJhZ09mZnNldC55ICsgd2luZG93LnNjcm9sbFl9cHhgO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc0RyYWdnaW5nKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2luZycpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBjb250YWluZXIgYXMgSFRNTERpdkVsZW1lbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjcmVhdGVUb29sdGlwKCkge1xyXG4gICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGRpdi5zdHlsZS5jc3NUZXh0ID0gYFxyXG4gICAgICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICMxZTI5M2I7XHJcbiAgICAgICAgICAgIGNvbG9yOiAjZmZmO1xyXG4gICAgICAgICAgICBwYWRkaW5nOiA4cHggMTJweDtcclxuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiBzYW5zLXNlcmlmO1xyXG4gICAgICAgICAgICB6LWluZGV4OiAyMTQ3NDgzNjQ3O1xyXG4gICAgICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICAgICAgYm94LXNoYWRvdzogMCA0cHggNnB4IHJnYmEoMCwwLDAsMC4zKTtcclxuICAgICAgICBgO1xyXG4gICAgICAgIGRpdi5pbm5lclRleHQgPSBcIuKcqCBBdXRvLUZpbGwgd2l0aCBTY2hvbGFyU3RyZWFtXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaXYpO1xyXG4gICAgICAgIHJldHVybiBkaXY7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjcmVhdGVUaG91Z2h0QnViYmxlKCkge1xyXG4gICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGRpdi5pZCA9ICdzcy10aG91Z2h0LWJ1YmJsZSc7XHJcbiAgICAgICAgZGl2LnN0eWxlLmNzc1RleHQgPSBgXHJcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgICAgICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzFlMjkzYiAwJSwgIzBmMTcyYSAxMDAlKTtcclxuICAgICAgICAgICAgY29sb3I6ICNlMmU4ZjA7XHJcbiAgICAgICAgICAgIHBhZGRpbmc6IDE0cHggMThweDtcclxuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMTJweDtcclxuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgIzMzNDE1NTtcclxuICAgICAgICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICAgICAgICBmb250LWZhbWlseTogJ0ludGVyJywgc3lzdGVtLXVpLCBzYW5zLXNlcmlmO1xyXG4gICAgICAgICAgICBsaW5lLWhlaWdodDogMS41O1xyXG4gICAgICAgICAgICBtYXgtd2lkdGg6IDM2MHB4O1xyXG4gICAgICAgICAgICB6LWluZGV4OiAyMTQ3NDgzNjQ3O1xyXG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDEwcHggMjVweCAtNXB4IHJnYmEoMCwgMCwgMCwgMC41KTtcclxuICAgICAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICAgICAgICAgIG9wYWNpdHk6IDA7XHJcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgxMHB4KTtcclxuICAgICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzLCB0cmFuc2Zvcm0gMC4zcztcclxuICAgICAgICBgO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICAgICAgICByZXR1cm4gZGl2O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlR3VpZGFuY2VCdWJibGUoKSB7XHJcbiAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgZGl2LmlkID0gJ3NzLWd1aWRhbmNlLWJ1YmJsZSc7XHJcbiAgICAgICAgZGl2LnN0eWxlLmNzc1RleHQgPSBgXHJcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgICAgICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzFlMjkzYiAwJSwgIzBmMTcyYSAxMDAlKTtcclxuICAgICAgICAgICAgY29sb3I6ICNlMmU4ZjA7XHJcbiAgICAgICAgICAgIHBhZGRpbmc6IDE2cHg7XHJcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDEycHg7XHJcbiAgICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkICMzYjgyZjY7XHJcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgICAgICAgZm9udC1mYW1pbHk6ICdJbnRlcicsIHN5c3RlbS11aSwgc2Fucy1zZXJpZjtcclxuICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDEuNTtcclxuICAgICAgICAgICAgbWF4LXdpZHRoOiAzMjBweDtcclxuICAgICAgICAgICAgei1pbmRleDogMjE0NzQ4MzY0NztcclxuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAxMHB4IDI1cHggLTVweCByZ2JhKDU5LCAxMzAsIDI0NiwgMC4zKTtcclxuICAgICAgICAgICAgb3BhY2l0eTogMDtcclxuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDEwcHgpO1xyXG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuM3MsIHRyYW5zZm9ybSAwLjNzO1xyXG4gICAgICAgIGA7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaXYpO1xyXG4gICAgICAgIHJldHVybiBkaXY7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBpbml0TGlzdGVuZXJzKCkge1xyXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzaW4nLCAoZSkgPT4gdGhpcy5oYW5kbGVGb2N1cyhlKSwgdHJ1ZSk7XHJcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4gdGhpcy51cGRhdGVQb3NpdGlvbigpLCB0cnVlKTtcclxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgKCkgPT4gdGhpcy51cGRhdGVQb3NpdGlvbigpKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGhhbmRsZUZvY3VzKGU6IEZvY3VzRXZlbnQpIHtcclxuICAgICAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xyXG5cclxuICAgICAgICBpZiAoIVsnSU5QVVQnLCAnVEVYVEFSRUEnLCAnU0VMRUNUJ10uaW5jbHVkZXModGFyZ2V0LnRhZ05hbWUpICYmICF0YXJnZXQuaXNDb250ZW50RWRpdGFibGUpIHtcclxuICAgICAgICAgICAgdGhpcy5oaWRlU3BhcmtsZSgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBpbnB1dCA9IHRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgIGlmIChpbnB1dC50eXBlID09PSAnZmlsZScgfHwgaW5wdXQudHlwZSA9PT0gJ2hpZGRlbicgfHwgaW5wdXQudHlwZSA9PT0gJ3N1Ym1pdCcgfHwgaW5wdXQudHlwZSA9PT0gJ2ltYWdlJykge1xyXG4gICAgICAgICAgICB0aGlzLmhpZGVTcGFya2xlKCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuYWN0aXZlRWxlbWVudCA9IHRhcmdldDtcclxuICAgICAgICB0aGlzLnNob3dTcGFya2xlKHRhcmdldCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzaG93U3BhcmtsZSh0YXJnZXQ6IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgaWYgKCF0YXJnZXQgfHwgdGhpcy5zcGFya2xlSGlkZGVuKSByZXR1cm47XHJcbiAgICAgICAgY29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHJcbiAgICAgICAgY29uc3QgdG9wID0gcmVjdC50b3AgKyB3aW5kb3cuc2Nyb2xsWSArIChyZWN0LmhlaWdodCAvIDIpIC0gMTY7XHJcbiAgICAgICAgY29uc3QgbGVmdCA9IHJlY3QucmlnaHQgKyB3aW5kb3cuc2Nyb2xsWCAtIDQwO1xyXG5cclxuICAgICAgICB0aGlzLnNwYXJrbGVCdG4uc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcclxuICAgICAgICB0aGlzLnNwYXJrbGVCdG4uc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xyXG4gICAgICAgIHRoaXMuc3BhcmtsZUJ0bi5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG5cclxuICAgICAgICB0aGlzLnRvb2x0aXAuc3R5bGUudG9wID0gYCR7dG9wIC0gMzB9cHhgO1xyXG4gICAgICAgIHRoaXMudG9vbHRpcC5zdHlsZS5sZWZ0ID0gYCR7bGVmdCAtIDYwfXB4YDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGhpZGVTcGFya2xlKCkge1xyXG4gICAgICAgIHRoaXMuc3BhcmtsZUJ0bi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgIHRoaXMudG9vbHRpcC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgIHRoaXMudGhvdWdodEJ1YmJsZS5zdHlsZS5vcGFjaXR5ID0gJzAnO1xyXG4gICAgICAgIHRoaXMuaGlkZUd1aWRhbmNlQnViYmxlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1cGRhdGVQb3NpdGlvbigpIHtcclxuICAgICAgICBpZiAodGhpcy5hY3RpdmVFbGVtZW50ICYmIHRoaXMuc3BhcmtsZUJ0bi5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZScpIHtcclxuICAgICAgICAgICAgdGhpcy5zaG93U3BhcmtsZSh0aGlzLmFjdGl2ZUVsZW1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyA9PT09PT09PT09IEVOSEFOQ0VEIFRIT1VHSFQgQlVCQkxFIChQaGFzZSAzKSA9PT09PT09PT09XHJcbiAgICBwcml2YXRlIHNob3dFbmhhbmNlZFJlYXNvbmluZyhcclxuICAgICAgICByZWFzb25pbmc6IHN0cmluZywgXHJcbiAgICAgICAgdGFyZ2V0OiBIVE1MRWxlbWVudCwgXHJcbiAgICAgICAgZmllbGRDb250ZXh0OiBGaWVsZENvbnRleHQsXHJcbiAgICAgICAgd2FzVGVtcGxhdGVVc2VkOiBib29sZWFuXHJcbiAgICApIHtcclxuICAgICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xyXG5cclxuICAgICAgICBjb25zdCByZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIGNvbnN0IHRvcCA9IHJlY3QuYm90dG9tICsgd2luZG93LnNjcm9sbFkgKyA4O1xyXG4gICAgICAgIGNvbnN0IGxlZnQgPSByZWN0LmxlZnQgKyB3aW5kb3cuc2Nyb2xsWDtcclxuXHJcbiAgICAgICAgLy8gR2V0IHBsYXRmb3JtLXNwZWNpZmljIHRpcHNcclxuICAgICAgICBjb25zdCBwbGF0Zm9ybVRpcHMgPSBQTEFURk9STV9USVBTW2ZpZWxkQ29udGV4dC5wbGF0Zm9ybUhpbnRdIHx8IFBMQVRGT1JNX1RJUFMuRGVmYXVsdDtcclxuICAgICAgICBjb25zdCByYW5kb21UaXAgPSBwbGF0Zm9ybVRpcHNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogcGxhdGZvcm1UaXBzLmxlbmd0aCldO1xyXG5cclxuICAgICAgICAvLyBCdWlsZCB0aG91Z2h0IGJ1YmJsZSBjb250ZW50XHJcbiAgICAgICAgbGV0IGNvbnRlbnQgPSBgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDhweDtcIj48c3BhbiBzdHlsZT1cImNvbG9yOiAjNEVDREM0OyBmb250LXdlaWdodDogNjAwO1wiPvCfp6AgQUkgVGhvdWdodDo8L3NwYW4+ICR7cmVhc29uaW5nfTwvZGl2PmA7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQWRkIGNoYXJhY3Rlci93b3JkIGxpbWl0IGluZm8gaWYgYXBwbGljYWJsZVxyXG4gICAgICAgIGlmIChmaWVsZENvbnRleHQuY2hhcmFjdGVyTGltaXQpIHtcclxuICAgICAgICAgICAgY29udGVudCArPSBgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZTogMTFweDsgY29sb3I6ICM5NGEzYjg7IG1hcmdpbi1ib3R0b206IDZweDtcIj7wn5OPIENoYXJhY3RlciBsaW1pdDogJHtmaWVsZENvbnRleHQuY2hhcmFjdGVyTGltaXR9PC9kaXY+YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZpZWxkQ29udGV4dC53b3JkTGltaXQpIHtcclxuICAgICAgICAgICAgY29udGVudCArPSBgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZTogMTFweDsgY29sb3I6ICM5NGEzYjg7IG1hcmdpbi1ib3R0b206IDZweDtcIj7wn5OdIFdvcmQgbGltaXQ6IH4ke2ZpZWxkQ29udGV4dC53b3JkTGltaXR9PC9kaXY+YDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEFkZCBmb3JtYXQgaGludFxyXG4gICAgICAgIGlmIChmaWVsZENvbnRleHQuZm9ybWF0ID09PSAnbWFya2Rvd24nKSB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQgKz0gYDxkaXYgc3R5bGU9XCJmb250LXNpemU6IDExcHg7IGNvbG9yOiAjNjBhNWZhOyBtYXJnaW4tYm90dG9tOiA2cHg7XCI+8J+TkSBNYXJrZG93biBmb3JtYXR0aW5nIHN1cHBvcnRlZDwvZGl2PmA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBBZGQgcGxhdGZvcm0gdGlwXHJcbiAgICAgICAgY29udGVudCArPSBgPGRpdiBzdHlsZT1cImZvbnQtc2l6ZTogMTFweDsgY29sb3I6ICNmYmJmMjQ7IG1hcmdpbi10b3A6IDhweDsgcGFkZGluZy10b3A6IDhweDsgYm9yZGVyLXRvcDogMXB4IHNvbGlkICMzMzQxNTU7XCI+8J+SoSBUaXA6ICR7cmFuZG9tVGlwfTwvZGl2PmA7XHJcblxyXG4gICAgICAgIC8vIEFkZCB0ZW1wbGF0ZSB3YXJuaW5nIGlmIHVzZWRcclxuICAgICAgICBpZiAod2FzVGVtcGxhdGVVc2VkKSB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQgKz0gYDxkaXYgc3R5bGU9XCJmb250LXNpemU6IDExcHg7IGNvbG9yOiAjZjg3MTcxOyBtYXJnaW4tdG9wOiA2cHg7XCI+4pqg77iPIFRlbXBsYXRlIHVzZWQgLSByZXBsYWNlIFtCUkFDS0VUU10gd2l0aCB5b3VyIGluZm88L2Rpdj5gO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy50aG91Z2h0QnViYmxlLmlubmVySFRNTCA9IGNvbnRlbnQ7XHJcbiAgICAgICAgdGhpcy50aG91Z2h0QnViYmxlLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XHJcbiAgICAgICAgdGhpcy50aG91Z2h0QnViYmxlLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcclxuICAgICAgICB0aGlzLnRob3VnaHRCdWJibGUuc3R5bGUubWF4V2lkdGggPSBgJHtNYXRoLm1pbigzNjAsIHdpbmRvdy5pbm5lcldpZHRoIC0gbGVmdCAtIDIwKX1weGA7XHJcbiAgICAgICAgdGhpcy50aG91Z2h0QnViYmxlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xyXG5cclxuICAgICAgICB2b2lkIHRoaXMudGhvdWdodEJ1YmJsZS5vZmZzZXRXaWR0aDtcclxuXHJcbiAgICAgICAgdGhpcy50aG91Z2h0QnViYmxlLnN0eWxlLm9wYWNpdHkgPSAnMSc7XHJcbiAgICAgICAgdGhpcy50aG91Z2h0QnViYmxlLnN0eWxlLnRyYW5zZm9ybSA9ICd0cmFuc2xhdGVZKDApJztcclxuXHJcbiAgICAgICAgLy8gQXV0by1oaWRlIGFmdGVyIDggc2Vjb25kcyAobG9uZ2VyIGZvciB0ZW1wbGF0ZXMpXHJcbiAgICAgICAgY29uc3QgaGlkZURlbGF5ID0gd2FzVGVtcGxhdGVVc2VkID8gMTAwMDAgOiA2MDAwO1xyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnRob3VnaHRCdWJibGUuc3R5bGUub3BhY2l0eSA9ICcwJztcclxuICAgICAgICAgICAgdGhpcy50aG91Z2h0QnViYmxlLnN0eWxlLnRyYW5zZm9ybSA9ICd0cmFuc2xhdGVZKDEwcHgpJztcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy50aG91Z2h0QnViYmxlLnN0eWxlLm9wYWNpdHkgPT09ICcwJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGhvdWdodEJ1YmJsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCAzMDApO1xyXG4gICAgICAgIH0sIGhpZGVEZWxheSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzaG93R3VpZGFuY2VCdWJibGUodGFyZ2V0OiBIVE1MRWxlbWVudCwgaGFzUHJvZmlsZTogYm9vbGVhbiwgaGFzRG9jdW1lbnQ6IGJvb2xlYW4sIGZpZWxkVHlwZTogc3RyaW5nKSB7XHJcbiAgICAgICAgY29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICBjb25zdCB0b3AgPSByZWN0LmJvdHRvbSArIHdpbmRvdy5zY3JvbGxZICsgODtcclxuICAgICAgICBjb25zdCBsZWZ0ID0gcmVjdC5sZWZ0ICsgd2luZG93LnNjcm9sbFg7XHJcblxyXG4gICAgICAgIGxldCBtZXNzYWdlID0gJyc7XHJcbiAgICAgICAgbGV0IGJ1dHRvbnMgPSAnJztcclxuXHJcbiAgICAgICAgaWYgKCFoYXNQcm9maWxlICYmICFoYXNEb2N1bWVudCkge1xyXG4gICAgICAgICAgICBtZXNzYWdlID0gYFxyXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDhweDsgZm9udC13ZWlnaHQ6IDYwMDsgY29sb3I6ICNmYmJmMjQ7XCI+8J+klCBJIGNhbiBoZWxwLCBidXQgSSBkb24ndCBrbm93IG11Y2ggYWJvdXQgeW91IHlldC48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzk0YTNiODsgbWFyZ2luLWJvdHRvbTogMTJweDtcIj5cclxuICAgICAgICAgICAgICAgICAgICBGb3IgYSA8c3Ryb25nPmdyZWF0ICR7ZmllbGRUeXBlfTwvc3Ryb25nPiwgSSBuZWVkOlxyXG4gICAgICAgICAgICAgICAgICAgIDx1bCBzdHlsZT1cIm1hcmdpbjogOHB4IDAgMCAxNnB4OyBwYWRkaW5nOiAwO1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bGk+WW91ciBwcm9qZWN0IGRldGFpbHMgKHVwbG9hZCB2aWEgc2lkZWJhcik8L2xpPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8bGk+WW91ciBiYWNrZ3JvdW5kIChjb21wbGV0ZSB5b3VyIHByb2ZpbGUpPC9saT5cclxuICAgICAgICAgICAgICAgICAgICA8L3VsPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgIGJ1dHRvbnMgPSBgXHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwic3MtZ3VpZGFuY2UtdXBsb2FkXCIgc3R5bGU9XCJmbGV4OiAxOyBiYWNrZ3JvdW5kOiAjM2I4MmY2OyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgcGFkZGluZzogOHB4IDEycHg7IGJvcmRlci1yYWRpdXM6IDZweDsgY3Vyc29yOiBwb2ludGVyOyBmb250LXNpemU6IDEycHg7XCI+VXBsb2FkIERvYzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInNzLWd1aWRhbmNlLXByb2ZpbGVcIiBzdHlsZT1cImZsZXg6IDE7IGJhY2tncm91bmQ6ICMxZTI5M2I7IGNvbG9yOiAjOTRhM2I4OyBib3JkZXI6IDFweCBzb2xpZCAjMzM0MTU1OyBwYWRkaW5nOiA4cHggMTJweDsgYm9yZGVyLXJhZGl1czogNnB4OyBjdXJzb3I6IHBvaW50ZXI7IGZvbnQtc2l6ZTogMTJweDtcIj5Db21wbGV0ZSBQcm9maWxlPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwic3MtZ3VpZGFuY2UtdHJ5XCIgc3R5bGU9XCJmbGV4OiAxOyBiYWNrZ3JvdW5kOiAjMWUyOTNiOyBjb2xvcjogIzRhZGU4MDsgYm9yZGVyOiAxcHggc29saWQgIzIyYzU1ZTsgcGFkZGluZzogOHB4IDEycHg7IGJvcmRlci1yYWRpdXM6IDZweDsgY3Vyc29yOiBwb2ludGVyOyBmb250LXNpemU6IDEycHg7XCI+VHJ5IEFueXdheTwvYnV0dG9uPlxyXG4gICAgICAgICAgICBgO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc0RvY3VtZW50KSB7XHJcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgXHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogOHB4OyBmb250LXdlaWdodDogNjAwOyBjb2xvcjogIzYwYTVmYTtcIj7wn5KhIEknbGwgdXNlIHlvdXIgcHJvZmlsZSwgYnV0IEkgZG9uJ3QgaGF2ZSBwcm9qZWN0IGNvbnRleHQuPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6ICM5NGEzYjg7IG1hcmdpbi1ib3R0b206IDEycHg7XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgVXBsb2FkIGEgcHJvamVjdCBSRUFETUUgb3IgZGVzY3JpcHRpb24gZm9yIGJldHRlciByZXN1bHRzIG9uIHRoaXMgJHtmaWVsZFR5cGV9IGZpZWxkLlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgIGJ1dHRvbnMgPSBgXHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwic3MtZ3VpZGFuY2UtdXBsb2FkXCIgc3R5bGU9XCJmbGV4OiAxOyBiYWNrZ3JvdW5kOiAjM2I4MmY2OyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgcGFkZGluZzogOHB4IDEycHg7IGJvcmRlci1yYWRpdXM6IDZweDsgY3Vyc29yOiBwb2ludGVyOyBmb250LXNpemU6IDEycHg7XCI+VXBsb2FkIERvYzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInNzLWd1aWRhbmNlLXRyeVwiIHN0eWxlPVwiZmxleDogMTsgYmFja2dyb3VuZDogIzIyYzU1ZTsgY29sb3I6IHdoaXRlOyBib3JkZXI6IG5vbmU7IHBhZGRpbmc6IDhweCAxMnB4OyBib3JkZXItcmFkaXVzOiA2cHg7IGN1cnNvcjogcG9pbnRlcjsgZm9udC1zaXplOiAxMnB4O1wiPkdlbmVyYXRlIEFueXdheTwvYnV0dG9uPlxyXG4gICAgICAgICAgICBgO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5ndWlkYW5jZUJ1YmJsZS5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgICAgICR7bWVzc2FnZX1cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGdhcDogOHB4OyBtYXJnaW4tdG9wOiA4cHg7XCI+XHJcbiAgICAgICAgICAgICAgICAke2J1dHRvbnN9XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIGA7XHJcblxyXG4gICAgICAgIHRoaXMuZ3VpZGFuY2VCdWJibGUuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcclxuICAgICAgICB0aGlzLmd1aWRhbmNlQnViYmxlLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcclxuICAgICAgICB0aGlzLmd1aWRhbmNlQnViYmxlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xyXG4gICAgICAgIHRoaXMuZ3VpZGFuY2VCdWJibGUuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdhdXRvJztcclxuXHJcbiAgICAgICAgdm9pZCB0aGlzLmd1aWRhbmNlQnViYmxlLm9mZnNldFdpZHRoO1xyXG5cclxuICAgICAgICB0aGlzLmd1aWRhbmNlQnViYmxlLnN0eWxlLm9wYWNpdHkgPSAnMSc7XHJcbiAgICAgICAgdGhpcy5ndWlkYW5jZUJ1YmJsZS5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlWSgwKSc7XHJcblxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3MtZ3VpZGFuY2UtdXBsb2FkJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gVXNlIHNhZmUgc2VuZGVyIHRvIGF2b2lkIHVuaGFuZGxlZCBwcm9taXNlIHJlamVjdGlvbnMgd2hlbiB0aGUgc2VydmljZSB3b3JrZXIgaXMgc2xlZXBpbmcvcmVsb2FkaW5nLlxyXG4gICAgICAgICAgICAgICAgdm9pZCBzYWZlU2VuZE1lc3NhZ2UoeyB0eXBlOiAnT1BFTl9TSURFX1BBTkVMJyB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuaGlkZUd1aWRhbmNlQnViYmxlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3MtZ3VpZGFuY2UtcHJvZmlsZScpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuKCdodHRwczovL3NjaG9sYXJzdHJlYW0ubG92YWJsZS5hcHAvcHJvZmlsZScsICdfYmxhbmsnKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuaGlkZUd1aWRhbmNlQnViYmxlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3MtZ3VpZGFuY2UtdHJ5Jyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oaWRlR3VpZGFuY2VCdWJibGUoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2VuZXJhdGVXaXRoQXZhaWxhYmxlQ29udGV4dCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LCAxMDApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaGlkZUd1aWRhbmNlQnViYmxlKCkge1xyXG4gICAgICAgIHRoaXMuZ3VpZGFuY2VCdWJibGUuc3R5bGUub3BhY2l0eSA9ICcwJztcclxuICAgICAgICB0aGlzLmd1aWRhbmNlQnViYmxlLnN0eWxlLnRyYW5zZm9ybSA9ICd0cmFuc2xhdGVZKDEwcHgpJztcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5ndWlkYW5jZUJ1YmJsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgIH0sIDMwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT09PT09PT09PSBFTkhBTkNFRCBGSUVMRCBBTkFMWVNJUyAoUGhhc2UgMykgPT09PT09PT09PVxyXG4gICAgcHJpdmF0ZSBhbmFseXplRmllbGQodGFyZ2V0OiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCk6IEZpZWxkQ29udGV4dCB7XHJcbiAgICAgICAgY29uc3QgbGFiZWwgPSB0aGlzLmdldExhYmVsKHRhcmdldCk7XHJcbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXIgPSB0YXJnZXQucGxhY2Vob2xkZXIgfHwgJyc7XHJcbiAgICAgICAgY29uc3QgY29tYmluZWRUZXh0ID0gKGxhYmVsICsgJyAnICsgcGxhY2Vob2xkZXIpLnRvTG93ZXJDYXNlKCk7XHJcblxyXG4gICAgICAgIC8vIERldGVjdCBjaGFyYWN0ZXIvd29yZCBsaW1pdHNcclxuICAgICAgICBjb25zdCBjaGFyYWN0ZXJMaW1pdCA9IHRoaXMuZGV0ZWN0Q2hhcmFjdGVyTGltaXQodGFyZ2V0KTtcclxuICAgICAgICBjb25zdCB3b3JkTGltaXQgPSB0aGlzLmRldGVjdFdvcmRMaW1pdCh0YXJnZXQsIGxhYmVsKTtcclxuXHJcbiAgICAgICAgLy8gRGV0ZWN0IGZvcm1hdCAobWFya2Rvd24gc3VwcG9ydClcclxuICAgICAgICBjb25zdCBmb3JtYXQgPSB0aGlzLmRldGVjdEZvcm1hdCh0YXJnZXQsIGNvbWJpbmVkVGV4dCk7XHJcblxyXG4gICAgICAgIC8vIEdldCBzdXJyb3VuZGluZyBjb250ZXh0IChuZWFyYnkgaGVhZGluZ3MsIGRlc2NyaXB0aW9ucylcclxuICAgICAgICBjb25zdCBzdXJyb3VuZGluZ0NvbnRleHQgPSB0aGlzLmdldFN1cnJvdW5kaW5nQ29udGV4dCh0YXJnZXQpO1xyXG5cclxuICAgICAgICAvLyBEZXRlY3QgcGxhdGZvcm1cclxuICAgICAgICBjb25zdCBwbGF0Zm9ybUhpbnQgPSB0aGlzLmRldGVjdFBsYXRmb3JtKCk7XHJcblxyXG4gICAgICAgIC8vIENhdGVnb3JpemUgZmllbGRcclxuICAgICAgICBjb25zdCBmaWVsZENhdGVnb3J5ID0gdGhpcy5jYXRlZ29yaXplRmllbGRFbmhhbmNlZChsYWJlbCwgcGxhY2Vob2xkZXIsIHN1cnJvdW5kaW5nQ29udGV4dCk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGlkOiB0YXJnZXQuaWQsXHJcbiAgICAgICAgICAgIG5hbWU6IHRhcmdldC5uYW1lIHx8ICcnLFxyXG4gICAgICAgICAgICBsYWJlbCxcclxuICAgICAgICAgICAgcGxhY2Vob2xkZXIsXHJcbiAgICAgICAgICAgIHR5cGU6IHRhcmdldC50eXBlIHx8IHRhcmdldC50YWdOYW1lLnRvTG93ZXJDYXNlKCksXHJcbiAgICAgICAgICAgIHNlbGVjdG9yOiB1bmlxdWVTZWxlY3Rvcih0YXJnZXQpLFxyXG4gICAgICAgICAgICBjaGFyYWN0ZXJMaW1pdCxcclxuICAgICAgICAgICAgd29yZExpbWl0LFxyXG4gICAgICAgICAgICBmb3JtYXQsXHJcbiAgICAgICAgICAgIGlzUmVxdWlyZWQ6IHRhcmdldC5yZXF1aXJlZCB8fCB0YXJnZXQuaGFzQXR0cmlidXRlKCdhcmlhLXJlcXVpcmVkJyksXHJcbiAgICAgICAgICAgIHN1cnJvdW5kaW5nQ29udGV4dCxcclxuICAgICAgICAgICAgcGxhdGZvcm1IaW50LFxyXG4gICAgICAgICAgICBmaWVsZENhdGVnb3J5LFxyXG4gICAgICAgICAgICBwYWdlVGl0bGU6IGRvY3VtZW50LnRpdGxlLFxyXG4gICAgICAgICAgICBwYWdlVXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZGV0ZWN0Q2hhcmFjdGVyTGltaXQodGFyZ2V0OiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XHJcbiAgICAgICAgLy8gQ2hlY2sgbWF4bGVuZ3RoIGF0dHJpYnV0ZVxyXG4gICAgICAgIGlmICh0YXJnZXQubWF4TGVuZ3RoICYmIHRhcmdldC5tYXhMZW5ndGggPiAwICYmIHRhcmdldC5tYXhMZW5ndGggPCAxMDAwMDAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0YXJnZXQubWF4TGVuZ3RoO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQ2hlY2sgZm9yIG5lYXJieSBjaGFyYWN0ZXIgY291bnRlciBlbGVtZW50c1xyXG4gICAgICAgIGNvbnN0IHBhcmVudCA9IHRhcmdldC5wYXJlbnRFbGVtZW50O1xyXG4gICAgICAgIGlmIChwYXJlbnQpIHtcclxuICAgICAgICAgICAgY29uc3QgY291bnRlclRleHQgPSBwYXJlbnQuaW5uZXJUZXh0Lm1hdGNoKC8oXFxkKylcXHMqXFwvXFxzKihcXGQrKS8pO1xyXG4gICAgICAgICAgICBpZiAoY291bnRlclRleHQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUludChjb3VudGVyVGV4dFsyXSwgMTApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBDaGVjayBkYXRhIGF0dHJpYnV0ZXNcclxuICAgICAgICBjb25zdCBkYXRhTWF4ID0gdGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1tYXgtbGVuZ3RoJykgfHwgdGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1tYXhsZW5ndGgnKTtcclxuICAgICAgICBpZiAoZGF0YU1heCkgcmV0dXJuIHBhcnNlSW50KGRhdGFNYXgsIDEwKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGRldGVjdFdvcmRMaW1pdCh0YXJnZXQ6IEhUTUxFbGVtZW50LCBsYWJlbDogc3RyaW5nKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcclxuICAgICAgICBjb25zdCBjb21iaW5lZFRleHQgPSBsYWJlbC50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENvbW1vbiBwYXR0ZXJuczogXCIzMDAgd29yZHNcIiwgXCJtYXggNTAwIHdvcmRzXCIsIFwid29yZCBsaW1pdDogMjUwXCJcclxuICAgICAgICBjb25zdCB3b3JkTWF0Y2ggPSBjb21iaW5lZFRleHQubWF0Y2goLyhcXGQrKVxccyp3b3Jkcz8vaSk7XHJcbiAgICAgICAgaWYgKHdvcmRNYXRjaCkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQod29yZE1hdGNoWzFdLCAxMCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBDaGVjayBzdXJyb3VuZGluZyBlbGVtZW50c1xyXG4gICAgICAgIGNvbnN0IHBhcmVudCA9IHRhcmdldC5wYXJlbnRFbGVtZW50O1xyXG4gICAgICAgIGlmIChwYXJlbnQpIHtcclxuICAgICAgICAgICAgY29uc3QgcGFyZW50VGV4dCA9IHBhcmVudC5pbm5lclRleHQudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgY29uc3QgcGFyZW50TWF0Y2ggPSBwYXJlbnRUZXh0Lm1hdGNoKC8oXFxkKylcXHMqd29yZHM/L2kpO1xyXG4gICAgICAgICAgICBpZiAocGFyZW50TWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZUludChwYXJlbnRNYXRjaFsxXSwgMTApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZGV0ZWN0Rm9ybWF0KHRhcmdldDogSFRNTEVsZW1lbnQsIGNvbWJpbmVkVGV4dDogc3RyaW5nKTogJ3BsYWluJyB8ICdtYXJrZG93bicgfCAnaHRtbCcge1xyXG4gICAgICAgIC8vIENoZWNrIGZvciBtYXJrZG93biBpbmRpY2F0b3JzXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBjb21iaW5lZFRleHQuaW5jbHVkZXMoJ21hcmtkb3duJykgfHxcclxuICAgICAgICAgICAgY29tYmluZWRUZXh0LmluY2x1ZGVzKCdzdXBwb3J0cyBmb3JtYXR0aW5nJykgfHxcclxuICAgICAgICAgICAgdGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnbWFya2Rvd24nKSB8fFxyXG4gICAgICAgICAgICB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWZvcm1hdCcpID09PSAnbWFya2Rvd24nIHx8XHJcbiAgICAgICAgICAgIC8vIERldlBvc3Qgc3VibWlzc2lvbiBmaWVsZHMgdHlwaWNhbGx5IHN1cHBvcnQgbWFya2Rvd25cclxuICAgICAgICAgICAgKHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZS5pbmNsdWRlcygnZGV2cG9zdCcpICYmIHRhcmdldC50YWdOYW1lID09PSAnVEVYVEFSRUEnKVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ21hcmtkb3duJztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIENoZWNrIGZvciByaWNoIHRleHQgZWRpdG9yIGluZGljYXRvcnNcclxuICAgICAgICBpZiAodGFyZ2V0LmlzQ29udGVudEVkaXRhYmxlIHx8IHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3JpY2h0ZXh0JykgfHwgdGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnd3lzaXd5ZycpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnaHRtbCc7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gJ3BsYWluJztcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGdldFN1cnJvdW5kaW5nQ29udGV4dCh0YXJnZXQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICAgICAgLy8gR2V0IG5lYXJieSBoZWFkaW5nXHJcbiAgICAgICAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSB0YXJnZXQ7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA1ICYmIGVsOyBpKyspIHtcclxuICAgICAgICAgICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoZWwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRpbmcgPSBlbC5xdWVyeVNlbGVjdG9yKCdoMSwgaDIsIGgzLCBoNCwgaDUsIGg2Jyk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGVhZGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcnRzLnB1c2goYFNlY3Rpb246ICR7aGVhZGluZy50ZXh0Q29udGVudD8udHJpbSgpfWApO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBHZXQgaGVscGVyIHRleHQgKGNvbW1vbiBwYXR0ZXJucylcclxuICAgICAgICBjb25zdCBwYXJlbnQgPSB0YXJnZXQucGFyZW50RWxlbWVudDtcclxuICAgICAgICBpZiAocGFyZW50KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGhlbHBlciA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuaGVscGVyLXRleHQsIC5oaW50LCAuZGVzY3JpcHRpb24sIFtjbGFzcyo9XCJoZWxwXCJdLCBzbWFsbCcpO1xyXG4gICAgICAgICAgICBpZiAoaGVscGVyICYmIGhlbHBlci50ZXh0Q29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgcGFydHMucHVzaChgSGludDogJHtoZWxwZXIudGV4dENvbnRlbnQudHJpbSgpLnNsaWNlKDAsIDIwMCl9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEdldCBsYWJlbCdzIGFkZGl0aW9uYWwgaW5mb1xyXG4gICAgICAgIGNvbnN0IGxhYmVsRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsYWJlbFtmb3I9XCIke3RhcmdldC5pZH1cIl1gKTtcclxuICAgICAgICBpZiAobGFiZWxFbCkge1xyXG4gICAgICAgICAgICBjb25zdCBzbWFsbCA9IGxhYmVsRWwucXVlcnlTZWxlY3Rvcignc21hbGwsIHNwYW4ub3B0aW9uYWwsIHNwYW4ucmVxdWlyZWQnKTtcclxuICAgICAgICAgICAgaWYgKHNtYWxsICYmIHNtYWxsLnRleHRDb250ZW50KSB7XHJcbiAgICAgICAgICAgICAgICBwYXJ0cy5wdXNoKHNtYWxsLnRleHRDb250ZW50LnRyaW0oKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBwYXJ0cy5qb2luKCcgfCAnKS5zbGljZSgwLCA1MDApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZGV0ZWN0UGxhdGZvcm0oKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZi50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgIGlmICh1cmwuaW5jbHVkZXMoJ2RldnBvc3QuY29tJykpIHJldHVybiAnRGV2UG9zdCc7XHJcbiAgICAgICAgaWYgKHVybC5pbmNsdWRlcygnZG9yYWhhY2tzLmlvJykpIHJldHVybiAnRG9yYUhhY2tzJztcclxuICAgICAgICBpZiAodXJsLmluY2x1ZGVzKCdtbGguaW8nKSkgcmV0dXJuICdNTEgnO1xyXG4gICAgICAgIGlmICh1cmwuaW5jbHVkZXMoJ3RhaWthaS5uZXR3b3JrJykpIHJldHVybiAnVGFpa2FpJztcclxuICAgICAgICBpZiAodXJsLmluY2x1ZGVzKCdnaXRjb2luLmNvJykpIHJldHVybiAnR2l0Y29pbic7XHJcbiAgICAgICAgaWYgKHVybC5pbmNsdWRlcygnaW1tdW5lZmkuY29tJykpIHJldHVybiAnSW1tdW5lZmknO1xyXG4gICAgICAgIGlmICh1cmwuaW5jbHVkZXMoJ2hhY2tlcm9uZS5jb20nKSkgcmV0dXJuICdIYWNrZXJPbmUnO1xyXG4gICAgICAgIGlmICh1cmwuaW5jbHVkZXMoJ2ludGlncml0aS5jb20nKSkgcmV0dXJuICdJbnRpZ3JpdGknO1xyXG4gICAgICAgIHJldHVybiAnRGVmYXVsdCc7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjYXRlZ29yaXplRmllbGRFbmhhbmNlZChsYWJlbDogc3RyaW5nLCBwbGFjZWhvbGRlcjogc3RyaW5nLCBjb250ZXh0OiBzdHJpbmcpOiBGaWVsZENhdGVnb3J5IHtcclxuICAgICAgICBjb25zdCB0ZXh0ID0gKGxhYmVsICsgJyAnICsgcGxhY2Vob2xkZXIgKyAnICcgKyBjb250ZXh0KS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0ZXh0LmluY2x1ZGVzKCdlbGV2YXRvcicpIHx8IHRleHQuaW5jbHVkZXMoJ3BpdGNoJykgfHwgdGV4dC5pbmNsdWRlcygndGFnbGluZScpKSByZXR1cm4gJ2VsZXZhdG9yX3BpdGNoJztcclxuICAgICAgICBpZiAodGV4dC5pbmNsdWRlcygnZGVzY3JpcHRpb24nKSB8fCB0ZXh0LmluY2x1ZGVzKCdhYm91dCcpIHx8IHRleHQuaW5jbHVkZXMoJ292ZXJ2aWV3JykpIHJldHVybiAnZGVzY3JpcHRpb24nO1xyXG4gICAgICAgIGlmICh0ZXh0LmluY2x1ZGVzKCdpbnNwaXJhdGlvbicpIHx8IHRleHQuaW5jbHVkZXMoJ3doeScpIHx8IHRleHQuaW5jbHVkZXMoJ21vdGl2YXRpb24nKSB8fCB0ZXh0LmluY2x1ZGVzKCd3aGF0IGluc3BpcmVkJykpIHJldHVybiAnaW5zcGlyYXRpb24nO1xyXG4gICAgICAgIGlmICh0ZXh0LmluY2x1ZGVzKCdidWlsdCcpIHx8IHRleHQuaW5jbHVkZXMoJ2hvdycpIHx8IHRleHQuaW5jbHVkZXMoJ3RlY2huaWNhbCcpIHx8IHRleHQuaW5jbHVkZXMoJ2FyY2hpdGVjdHVyZScpIHx8IHRleHQuaW5jbHVkZXMoJ3N0YWNrJykpIHJldHVybiAndGVjaG5pY2FsJztcclxuICAgICAgICBpZiAodGV4dC5pbmNsdWRlcygnY2hhbGxlbmdlJykgfHwgdGV4dC5pbmNsdWRlcygnb2JzdGFjbGUnKSB8fCB0ZXh0LmluY2x1ZGVzKCdkaWZmaWN1bHQnKSB8fCB0ZXh0LmluY2x1ZGVzKCdsZWFybmVkJykpIHJldHVybiAnY2hhbGxlbmdlcyc7XHJcbiAgICAgICAgaWYgKHRleHQuaW5jbHVkZXMoJ3RlYW0nKSB8fCB0ZXh0LmluY2x1ZGVzKCdtZW1iZXInKSB8fCB0ZXh0LmluY2x1ZGVzKCdjb2xsYWJvcmF0JykpIHJldHVybiAndGVhbSc7XHJcbiAgICAgICAgaWYgKHRleHQuaW5jbHVkZXMoJ25hbWUnKSB8fCB0ZXh0LmluY2x1ZGVzKCdlbWFpbCcpIHx8IHRleHQuaW5jbHVkZXMoJ3Bob25lJykgfHwgdGV4dC5pbmNsdWRlcygnbGlua2VkaW4nKSB8fCB0ZXh0LmluY2x1ZGVzKCdnaXRodWInKSkgcmV0dXJuICdwZXJzb25hbF9pbmZvJztcclxuICAgICAgICBpZiAodGV4dC5pbmNsdWRlcygndXJsJykgfHwgdGV4dC5pbmNsdWRlcygnbGluaycpIHx8IHRleHQuaW5jbHVkZXMoJ2RlbW8nKSB8fCB0ZXh0LmluY2x1ZGVzKCd2aWRlbycpIHx8IHRleHQuaW5jbHVkZXMoJ3JlcG8nKSkgcmV0dXJuICdsaW5rcyc7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuICdnZW5lcmljJztcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVNwYXJrbGVDbGljaygpIHtcclxuICAgICAgICBpZiAoIXRoaXMuYWN0aXZlRWxlbWVudCB8fCB0aGlzLmlzU3RyZWFtaW5nKSByZXR1cm47XHJcblxyXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuYWN0aXZlRWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG5cclxuICAgICAgICAvLyBDaGVjayBjb250ZXh0IGF2YWlsYWJpbGl0eVxyXG4gICAgICAgIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ3VzZXJQcm9maWxlJywgJ3Byb2plY3RDb250ZXh0J10pO1xyXG4gICAgICAgIGNvbnN0IGhhc1Byb2ZpbGUgPSBzdG9yZWQudXNlclByb2ZpbGUgJiYgT2JqZWN0LmtleXMoc3RvcmVkLnVzZXJQcm9maWxlKS5sZW5ndGggPiAwO1xyXG4gICAgICAgIGNvbnN0IGhhc0RvY3VtZW50ID0gISFzdG9yZWQucHJvamVjdENvbnRleHQ7XHJcblxyXG4gICAgICAgIC8vIEVuaGFuY2VkIGZpZWxkIGFuYWx5c2lzXHJcbiAgICAgICAgY29uc3QgZmllbGRDb250ZXh0ID0gdGhpcy5hbmFseXplRmllbGQodGFyZ2V0KTtcclxuXHJcbiAgICAgICAgLy8gU2hvdyBndWlkYW5jZSBpZiBtaXNzaW5nIGNyaXRpY2FsIGNvbnRleHQgZm9yIHByb2plY3Qtc3BlY2lmaWMgZmllbGRzXHJcbiAgICAgICAgY29uc3QgbmVlZHNQcm9qZWN0Q29udGV4dCA9IFsnZWxldmF0b3JfcGl0Y2gnLCAnZGVzY3JpcHRpb24nLCAnaW5zcGlyYXRpb24nLCAndGVjaG5pY2FsJywgJ2NoYWxsZW5nZXMnXS5pbmNsdWRlcyhmaWVsZENvbnRleHQuZmllbGRDYXRlZ29yeSk7XHJcblxyXG4gICAgICAgIGlmIChuZWVkc1Byb2plY3RDb250ZXh0ICYmICFoYXNEb2N1bWVudCAmJiAhaGFzUHJvZmlsZSkge1xyXG4gICAgICAgICAgICB0aGlzLnNob3dHdWlkYW5jZUJ1YmJsZSh0YXJnZXQsIGhhc1Byb2ZpbGUsIGhhc0RvY3VtZW50LCBmaWVsZENvbnRleHQuZmllbGRDYXRlZ29yeS5yZXBsYWNlKCdfJywgJyAnKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEdlbmVyYXRlIHdpdGggYXZhaWxhYmxlIGNvbnRleHRcclxuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlV2l0aEVuaGFuY2VkQ29udGV4dChmaWVsZENvbnRleHQsIGhhc1Byb2ZpbGUsIGhhc0RvY3VtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlV2l0aEVuaGFuY2VkQ29udGV4dChmaWVsZENvbnRleHQ6IEZpZWxkQ29udGV4dCwgaGFzUHJvZmlsZTogYm9vbGVhbiwgaGFzRG9jdW1lbnQ6IGJvb2xlYW4pIHtcclxuICAgICAgICBpZiAoIXRoaXMuYWN0aXZlRWxlbWVudCkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLmlzU3RyZWFtaW5nID0gdHJ1ZTtcclxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmFjdGl2ZUVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudDtcclxuXHJcbiAgICAgICAgLy8gQW5pbWF0aW9uOiBTcGluXHJcbiAgICAgICAgY29uc3QgYnRuID0gdGhpcy5zcGFya2xlQnRuLnF1ZXJ5U2VsZWN0b3IoJyNzcy1zcGFya2xlLXRyaWdnZXInKTtcclxuICAgICAgICBpZiAoYnRuKSB7XHJcbiAgICAgICAgICAgIGJ0bi5pbm5lckhUTUwgPSBgPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHlsZT1cImFuaW1hdGlvbjogc3Mtc3BpbiAxcyBsaW5lYXIgaW5maW5pdGU7XCI+PGNpcmNsZSBjeD1cIjEyXCIgY3k9XCIxMlwiIHI9XCIxMFwiIG9wYWNpdHk9XCIwLjI1XCIvPjxwYXRoIGQ9XCJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJcIiBvcGFjaXR5PVwiMC43NVwiLz48L3N2Zz5gO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2VuZXJhdGVGaWVsZENvbnRlbnRFbmhhbmNlZChmaWVsZENvbnRleHQsIGhhc1Byb2ZpbGUsIGhhc0RvY3VtZW50KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSByZXN1bHQuc3BhcmtsZV9yZXN1bHQ/LmNvbnRlbnQgfHwgcmVzdWx0LmZpbGxlZF92YWx1ZSB8fCByZXN1bHQudGVtcGxhdGVfY29udGVudDtcclxuICAgICAgICAgICAgY29uc3QgcmVhc29uaW5nID0gcmVzdWx0LnNwYXJrbGVfcmVzdWx0Py5yZWFzb25pbmcgfHwgcmVzdWx0LnJlYXNvbmluZyB8fCAnR2VuZXJhdGVkIGJhc2VkIG9uIGF2YWlsYWJsZSBjb250ZXh0JztcclxuICAgICAgICAgICAgY29uc3Qgd2FzVGVtcGxhdGVVc2VkID0gISFyZXN1bHQudGVtcGxhdGVfY29udGVudCB8fCAoY29udGVudCAmJiBjb250ZW50LmluY2x1ZGVzKCdbJykpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHtcclxuICAgICAgICAgICAgICAgIC8vIFNob3cgZW5oYW5jZWQgcmVhc29uaW5nIHdpdGggdGlwc1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RW5oYW5jZWRSZWFzb25pbmcocmVhc29uaW5nLCB0YXJnZXQsIGZpZWxkQ29udGV4dCwgd2FzVGVtcGxhdGVVc2VkKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gVHlwZXdyaXRlciBlZmZlY3RcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudHlwZXdyaXRlckVmZmVjdCh0YXJnZXQsIGNvbnRlbnQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRm9jdXMgRmlsbCBGYWlsZWRcIiwgZSk7XHJcbiAgICAgICAgICAgIC8vIFNob3cgZXJyb3IgZmVlZGJhY2tcclxuICAgICAgICAgICAgdGhpcy5zaG93RW5oYW5jZWRSZWFzb25pbmcoXHJcbiAgICAgICAgICAgICAgICBcIkZhaWxlZCB0byBnZW5lcmF0ZSBjb250ZW50LiBUcnkgYWdhaW4gb3IgY2hlY2sgeW91ciBjb25uZWN0aW9uLlwiLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgZmllbGRDb250ZXh0LFxyXG4gICAgICAgICAgICAgICAgZmFsc2VcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLmlzU3RyZWFtaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ0biA9IHRoaXMuc3BhcmtsZUJ0bi5xdWVyeVNlbGVjdG9yKCcjc3Mtc3BhcmtsZS10cmlnZ2VyJyk7XHJcbiAgICAgICAgICAgIGlmIChidG4pIHtcclxuICAgICAgICAgICAgICAgIGJ0bi5pbm5lckhUTUwgPSBgPHN2ZyB3aWR0aD1cIjE4XCIgaGVpZ2h0PVwiMThcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJ3aGl0ZVwiIHN0cm9rZS13aWR0aD1cIjJcIj48cGF0aCBkPVwiTTEyIDJMMTUuMDkgOC4yNkwyMiA5LjI3TDE3IDE0LjE0TDE4LjE4IDIxLjAyTDEyIDE3Ljc3TDUuODIgMjEuMDJMNyAxNC4xNEwyIDkuMjdMOC45MSA4LjI2TDEyIDJaXCI+PC9wYXRoPjwvc3ZnPmA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gTGVnYWN5IG1ldGhvZCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZVdpdGhBdmFpbGFibGVDb250ZXh0KCkge1xyXG4gICAgICAgIGlmICghdGhpcy5hY3RpdmVFbGVtZW50KSByZXR1cm47XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5hY3RpdmVFbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgZmllbGRDb250ZXh0ID0gdGhpcy5hbmFseXplRmllbGQodGFyZ2V0KTtcclxuICAgICAgICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWyd1c2VyUHJvZmlsZScsICdwcm9qZWN0Q29udGV4dCddKTtcclxuICAgICAgICBjb25zdCBoYXNQcm9maWxlID0gc3RvcmVkLnVzZXJQcm9maWxlICYmIE9iamVjdC5rZXlzKHN0b3JlZC51c2VyUHJvZmlsZSkubGVuZ3RoID4gMDtcclxuICAgICAgICBjb25zdCBoYXNEb2N1bWVudCA9ICEhc3RvcmVkLnByb2plY3RDb250ZXh0O1xyXG4gICAgICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVXaXRoRW5oYW5jZWRDb250ZXh0KGZpZWxkQ29udGV4dCwgaGFzUHJvZmlsZSwgaGFzRG9jdW1lbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZ2V0TGFiZWwoZWw6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsYWJlbFtmb3I9XCIke2VsLmlkfVwiXWApPy50ZXh0Q29udGVudD8udHJpbSgpIHx8XHJcbiAgICAgICAgICAgIGVsLmNsb3Nlc3QoJ2xhYmVsJyk/LnRleHRDb250ZW50Py50cmltKCkgfHxcclxuICAgICAgICAgICAgZWwucHJldmlvdXNFbGVtZW50U2libGluZz8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fFxyXG4gICAgICAgICAgICBlbC5wYXJlbnRFbGVtZW50Py50ZXh0Q29udGVudD8udHJpbSgpIHx8XHJcbiAgICAgICAgICAgICcnXHJcbiAgICAgICAgKS5zbGljZSgwLCAxMDApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgdHlwZXdyaXRlckVmZmVjdChlbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCwgdGV4dDogc3RyaW5nKSB7XHJcbiAgICAgICAgZWxlbWVudC52YWx1ZSA9IFwiXCI7XHJcbiAgICAgICAgZWxlbWVudC5mb2N1cygpO1xyXG5cclxuICAgICAgICBjb25zdCBzcGVlZCA9IE1hdGgubWF4KDEwLCBNYXRoLm1pbig1MCwgMTAwMCAvIHRleHQubGVuZ3RoKSk7XHJcblxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBlbGVtZW50LnZhbHVlICs9IHRleHQuY2hhckF0KGkpO1xyXG4gICAgICAgICAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgICAgICAgICAgIGlmIChlbGVtZW50LnNjcm9sbFRvcCAhPT0gdW5kZWZpbmVkKSBlbGVtZW50LnNjcm9sbFRvcCA9IGVsZW1lbnQuc2Nyb2xsSGVpZ2h0O1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIHNwZWVkICsgTWF0aC5yYW5kb20oKSAqIDEwKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcblxyXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsQmcgPSBlbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvcjtcclxuICAgICAgICBlbGVtZW50LnN0eWxlLnRyYW5zaXRpb24gPSBcImJhY2tncm91bmQtY29sb3IgMC41c1wiO1xyXG4gICAgICAgIGVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjZGNmY2U3XCI7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiBlbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IG9yaWdpbmFsQmcsIDEwMDApO1xyXG4gICAgfVxyXG59XHJcblxyXG4vLyBJbml0aWFsaXplIEZvY3VzIEVuZ2luZVxyXG5uZXcgRm9jdXNFbmdpbmUoKTtcclxuXHJcbi8vID09PT09PT09PT0gRU5IQU5DRUQgQVBJIEhFTFBFUiAoUGhhc2UgMykgPT09PT09PT09PVxyXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUZpZWxkQ29udGVudEVuaGFuY2VkKFxyXG4gICAgZmllbGRDb250ZXh0OiBGaWVsZENvbnRleHQsXHJcbiAgICBoYXNQcm9maWxlOiBib29sZWFuLFxyXG4gICAgaGFzRG9jdW1lbnQ6IGJvb2xlYW5cclxuKSB7XHJcbiAgICBsZXQgdXNlclByb2ZpbGU6IGFueSA9IHt9O1xyXG4gICAgbGV0IHByb2plY3RDb250ZXh0ID0gXCJcIjtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ3VzZXJQcm9maWxlJywgJ3Byb2plY3RDb250ZXh0J10pO1xyXG4gICAgICAgIHVzZXJQcm9maWxlID0gc3RvcmVkLnVzZXJQcm9maWxlIHx8IHt9O1xyXG4gICAgICAgIHByb2plY3RDb250ZXh0ID0gc3RvcmVkLnByb2plY3RDb250ZXh0IHx8IFwiXCI7XHJcbiAgICB9IGNhdGNoIChlKSB7IH1cclxuXHJcbiAgICBjb25zdCBzdG9yZWRUb2tlbiA9IChhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydhdXRoVG9rZW4nXSkpLmF1dGhUb2tlbjtcclxuICAgIGlmICghc3RvcmVkVG9rZW4pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBhdXRoZW50aWNhdGVkJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQnVpbGQgZW5oYW5jZWQgaW5zdHJ1Y3Rpb24gYmFzZWQgb24gZmllbGQgYW5hbHlzaXNcclxuICAgIGxldCBpbnN0cnVjdGlvbiA9IGBGaWxsIHRoaXMgJHtmaWVsZENvbnRleHQuZmllbGRDYXRlZ29yeS5yZXBsYWNlKCdfJywgJyAnKX0gZmllbGQuYDtcclxuICAgIFxyXG4gICAgaWYgKGZpZWxkQ29udGV4dC5jaGFyYWN0ZXJMaW1pdCkge1xyXG4gICAgICAgIGluc3RydWN0aW9uICs9IGAgS2VlcCB1bmRlciAke2ZpZWxkQ29udGV4dC5jaGFyYWN0ZXJMaW1pdH0gY2hhcmFjdGVycy5gO1xyXG4gICAgfVxyXG4gICAgaWYgKGZpZWxkQ29udGV4dC53b3JkTGltaXQpIHtcclxuICAgICAgICBpbnN0cnVjdGlvbiArPSBgIEFpbSBmb3IgYXBwcm94aW1hdGVseSAke2ZpZWxkQ29udGV4dC53b3JkTGltaXR9IHdvcmRzLmA7XHJcbiAgICB9XHJcbiAgICBpZiAoZmllbGRDb250ZXh0LmZvcm1hdCA9PT0gJ21hcmtkb3duJykge1xyXG4gICAgICAgIGluc3RydWN0aW9uICs9IGAgVXNlIG1hcmtkb3duIGZvcm1hdHRpbmcgZm9yIGVtcGhhc2lzIGFuZCBzdHJ1Y3R1cmUuYDtcclxuICAgIH1cclxuICAgIGlmIChmaWVsZENvbnRleHQuc3Vycm91bmRpbmdDb250ZXh0KSB7XHJcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYCBDb250ZXh0OiAke2ZpZWxkQ29udGV4dC5zdXJyb3VuZGluZ0NvbnRleHR9YDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZXF1ZXN0IHRlbXBsYXRlIGlmIG5vIGNvbnRleHQgYXZhaWxhYmxlXHJcbiAgICBpZiAoIWhhc1Byb2ZpbGUgJiYgIWhhc0RvY3VtZW50KSB7XHJcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYCBTaW5jZSBubyBwcm9maWxlIG9yIHByb2plY3QgY29udGV4dCBpcyBhdmFpbGFibGUsIGdlbmVyYXRlIGEgaGVscGZ1bCB0ZW1wbGF0ZSB3aXRoIFtQTEFDRUhPTERFUl0gYnJhY2tldHMgdGhhdCB0aGUgdXNlciBjYW4gZmlsbCBpbi5gO1xyXG4gICAgfSBlbHNlIGlmICghaGFzRG9jdW1lbnQgJiYgWydlbGV2YXRvcl9waXRjaCcsICdkZXNjcmlwdGlvbicsICd0ZWNobmljYWwnLCAnY2hhbGxlbmdlcyddLmluY2x1ZGVzKGZpZWxkQ29udGV4dC5maWVsZENhdGVnb3J5KSkge1xyXG4gICAgICAgIGluc3RydWN0aW9uICs9IGAgTm8gcHJvamVjdCBkb2N1bWVudCB1cGxvYWRlZCAtIHVzZSBwcm9maWxlIGluZm8gYW5kIGdlbmVyYXRlIGhlbHBmdWwgY29udGVudCB3aXRoIFtQUk9KRUNUIFNQRUNJRklDIERFVEFJTFNdIHBsYWNlaG9sZGVycyB3aGVyZSBuZWVkZWQuYDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKEVORFBPSU5UUy5tYXBGaWVsZHMsIHtcclxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJlYXJlciAke3N0b3JlZFRva2VufWBcclxuICAgICAgICB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgZm9ybV9maWVsZHM6IFtdLFxyXG4gICAgICAgICAgICB1c2VyX3Byb2ZpbGU6IHVzZXJQcm9maWxlLFxyXG4gICAgICAgICAgICB0YXJnZXRfZmllbGQ6IHtcclxuICAgICAgICAgICAgICAgIC4uLmZpZWxkQ29udGV4dCxcclxuICAgICAgICAgICAgICAgIC8vIEZsYXR0ZW4gZm9yIGJhY2tlbmQgY29tcGF0aWJpbGl0eVxyXG4gICAgICAgICAgICAgICAgaWQ6IGZpZWxkQ29udGV4dC5pZCxcclxuICAgICAgICAgICAgICAgIG5hbWU6IGZpZWxkQ29udGV4dC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogZmllbGRDb250ZXh0LnR5cGUsXHJcbiAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogZmllbGRDb250ZXh0LnBsYWNlaG9sZGVyLFxyXG4gICAgICAgICAgICAgICAgbGFiZWw6IGZpZWxkQ29udGV4dC5sYWJlbCxcclxuICAgICAgICAgICAgICAgIGNoYXJhY3RlckxpbWl0OiBmaWVsZENvbnRleHQuY2hhcmFjdGVyTGltaXQsXHJcbiAgICAgICAgICAgICAgICB3b3JkTGltaXQ6IGZpZWxkQ29udGV4dC53b3JkTGltaXQsXHJcbiAgICAgICAgICAgICAgICBmb3JtYXQ6IGZpZWxkQ29udGV4dC5mb3JtYXQsXHJcbiAgICAgICAgICAgICAgICBmaWVsZENhdGVnb3J5OiBmaWVsZENvbnRleHQuZmllbGRDYXRlZ29yeSxcclxuICAgICAgICAgICAgICAgIHBsYXRmb3JtSGludDogZmllbGRDb250ZXh0LnBsYXRmb3JtSGludCxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcHJvamVjdF9jb250ZXh0OiBwcm9qZWN0Q29udGV4dCxcclxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb25cclxuICAgICAgICB9KVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9IC0gJHtlcnJvclRleHR9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcclxufVxyXG5cclxuLy8gTGVnYWN5IGhlbHBlciBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxyXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUZpZWxkQ29udGVudCh0YXJnZXRGaWVsZDogYW55KSB7XHJcbiAgICBsZXQgdXNlclByb2ZpbGU6IGFueSA9IHt9O1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWyd1c2VyUHJvZmlsZSddKTtcclxuICAgICAgICB1c2VyUHJvZmlsZSA9IHN0b3JlZC51c2VyUHJvZmlsZSB8fCB7fTtcclxuICAgIH0gY2F0Y2ggKGUpIHsgfVxyXG5cclxuICAgIGNvbnN0IHN0b3JlZFRva2VuID0gKGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2F1dGhUb2tlbiddKSkuYXV0aFRva2VuO1xyXG4gICAgaWYgKCFzdG9yZWRUb2tlbikge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm90IGF1dGhlbnRpY2F0ZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgcHJvamVjdENvbnRleHQgPSBcIlwiO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydwcm9qZWN0Q29udGV4dCddKTtcclxuICAgICAgICBwcm9qZWN0Q29udGV4dCA9IHN0b3JlZC5wcm9qZWN0Q29udGV4dCB8fCBcIlwiO1xyXG4gICAgfSBjYXRjaCAoZSkgeyB9XHJcblxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChFTkRQT0lOVFMubWFwRmllbGRzLCB7XHJcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHtzdG9yZWRUb2tlbn1gXHJcbiAgICAgICAgfSxcclxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICAgIGZvcm1fZmllbGRzOiBbXSxcclxuICAgICAgICAgICAgdXNlcl9wcm9maWxlOiB1c2VyUHJvZmlsZSxcclxuICAgICAgICAgICAgdGFyZ2V0X2ZpZWxkOiB0YXJnZXRGaWVsZCxcclxuICAgICAgICAgICAgcHJvamVjdF9jb250ZXh0OiBwcm9qZWN0Q29udGV4dCxcclxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IFwiRmlsbCB0aGlzIGZpZWxkIGJhc2VkIG9uIG15IHByb2ZpbGUgYW5kIHByb2plY3QuXCJcclxuICAgICAgICB9KVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcclxufVxyXG5cclxuLy8gU2FmZSBNZXNzYWdlIFNlbmRlclxyXG5jb25zdCBzYWZlU2VuZE1lc3NhZ2UgPSBhc3luYyAobWVzc2FnZTogYW55KSA9PiB7XHJcbiAgICBpZiAoIWNocm9tZS5ydW50aW1lPy5pZCkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihcIkV4dGVuc2lvbiBjb250ZXh0IGludmFsaWRhdGVkLiBSZWxvYWQgcGFnZSB0byByZWNvbm5lY3QuXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRyeSB7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKG1lc3NhZ2UpO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnN0IG1zZyA9IChlIGFzIGFueSkubWVzc2FnZSB8fCBcIlwiO1xyXG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoXCJFeHRlbnNpb24gY29udGV4dCBpbnZhbGlkYXRlZFwiKSB8fCBtc2cuaW5jbHVkZXMoXCJyZWNlaXZpbmcgZW5kIGRvZXMgbm90IGV4aXN0XCIpKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRXh0ZW5zaW9uIGRpc2Nvbm5lY3RlZCAocmVsb2FkIG5lZWRlZCkuXCIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJNZXNzYWdlIHNlbmQgZmFpbGVkOlwiLCBlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG4vLyBVbmlxdWUgc2VsZWN0b3IgZ2VuZXJhdG9yXHJcbmZ1bmN0aW9uIHVuaXF1ZVNlbGVjdG9yKGVsOiBFbGVtZW50KTogc3RyaW5nIHtcclxuICAgIGlmIChlbC5pZCkgcmV0dXJuIGAjJHtlbC5pZH1gO1xyXG4gICAgaWYgKChlbCBhcyBhbnkpLm5hbWUpIHJldHVybiBgW25hbWU9XCIkeyhlbCBhcyBhbnkpLm5hbWV9XCJdYDtcclxuICAgIHJldHVybiBlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XHJcbn1cclxuXHJcbi8vIExpc3RlbiBmb3IgY29udGV4dCByZXF1ZXN0cyBhbmQgQXV0by1GaWxsIGNvbW1hbmRzXHJcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgX3NlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XHJcbiAgICBpZiAoIWNocm9tZS5ydW50aW1lPy5pZCkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0dFVF9QQUdFX0NPTlRFWFQnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBnZXRQYWdlQ29udGV4dCgpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkNyZWF0aW5nIGNvbnRleHQ6XCIsIGNvbnRleHQudGl0bGUpO1xyXG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoY29udGV4dCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAobWVzc2FnZS50eXBlID09PSAnQVVUT19GSUxMX1JFUVVFU1QnKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiQWdlbnRpYyBBdXRvLUZpbGwgVHJpZ2dlcmVkXCIpO1xyXG4gICAgICAgICAgICBoYW5kbGVBdXRvRmlsbChtZXNzYWdlLnByb2plY3RDb250ZXh0KS50aGVuKHJlc3VsdCA9PiB7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZShyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkgeyAvKiBDb250ZXh0IGxpa2VseSBsb3N0IGR1cmluZyBsb25nIG9wICovIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiQ29udGVudCBTY3JpcHQgRXJyb3I6XCIsIGUpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUF1dG9GaWxsKHByb2plY3RDb250ZXh0Pzogc3RyaW5nKSB7XHJcbiAgICBjb25zdCBpbnB1dHMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0LCBzZWxlY3QsIHRleHRhcmVhJykpO1xyXG4gICAgY29uc3QgZm9ybUZpZWxkcyA9IGlucHV0cy5tYXAoKGVsOiBhbnkpID0+ICh7XHJcbiAgICAgICAgaWQ6IGVsLmlkLFxyXG4gICAgICAgIG5hbWU6IGVsLm5hbWUsXHJcbiAgICAgICAgdHlwZTogZWwudHlwZSB8fCBlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCksXHJcbiAgICAgICAgcGxhY2Vob2xkZXI6IGVsLnBsYWNlaG9sZGVyLFxyXG4gICAgICAgIGxhYmVsOiAoXHJcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYGxhYmVsW2Zvcj1cIiR7ZWwuaWR9XCJdYCk/LnRleHRDb250ZW50Py50cmltKCkgfHxcclxuICAgICAgICAgICAgZWwuY2xvc2VzdCgnbGFiZWwnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fFxyXG4gICAgICAgICAgICBlbC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nPy50ZXh0Q29udGVudD8udHJpbSgpIHx8XHJcbiAgICAgICAgICAgIGVsLnBhcmVudEVsZW1lbnQ/LnRleHRDb250ZW50Py50cmltKCkgfHxcclxuICAgICAgICAgICAgJydcclxuICAgICAgICApLnNsaWNlKDAsIDEwMCksXHJcbiAgICAgICAgc2VsZWN0b3I6IHVuaXF1ZVNlbGVjdG9yKGVsKVxyXG4gICAgfSkpLmZpbHRlcihmID0+IGYudHlwZSAhPT0gJ2hpZGRlbicgJiYgZi50eXBlICE9PSAnc3VibWl0JyAmJiBmLnR5cGUgIT09ICdmaWxlJyk7XHJcblxyXG4gICAgaWYgKGZvcm1GaWVsZHMubGVuZ3RoID09PSAwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogXCJObyBmaWVsZHMgZm91bmRcIiB9O1xyXG5cclxuICAgIGxldCB1c2VyUHJvZmlsZTogYW55ID0ge307XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHN0b3JlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ3VzZXJQcm9maWxlJ10pO1xyXG4gICAgICAgIHVzZXJQcm9maWxlID0gc3RvcmVkLnVzZXJQcm9maWxlIHx8IHt9O1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiTm8gc3RvcmVkIHByb2ZpbGUsIHVzaW5nIGVtcHR5XCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3Qgc3RvcmVkVG9rZW4gPSAoYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFsnYXV0aFRva2VuJ10pKS5hdXRoVG9rZW47XHJcbiAgICAgICAgaWYgKCFzdG9yZWRUb2tlbikge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogXCJQbGVhc2Ugc2lnbiBpbiBzZWN1cmVseSB0aHJvdWdoIHRoZSBleHRlbnNpb24gZmlyc3QuXCIgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGDwn5SRIFtFWFRdIFVzaW5nIHNlY3VyZSB0b2tlbiBmb3IgQVBJIGNhbGxgKTtcclxuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKEVORFBPSU5UUy5tYXBGaWVsZHMsIHtcclxuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHtzdG9yZWRUb2tlbn1gXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgIGZvcm1fZmllbGRzOiBmb3JtRmllbGRzLFxyXG4gICAgICAgICAgICAgICAgdXNlcl9wcm9maWxlOiB1c2VyUHJvZmlsZSxcclxuICAgICAgICAgICAgICAgIHByb2plY3RfY29udGV4dDogcHJvamVjdENvbnRleHRcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgICAgICBjb25zdCBlcnJvclRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQmFja2VuZCBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9IC0gJHtlcnJvclRleHR9YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xyXG4gICAgICAgIGNvbnN0IGZpZWxkTWFwcGluZ3MgPSBkYXRhLmZpZWxkX21hcHBpbmdzIHx8IHt9O1xyXG5cclxuICAgICAgICBsZXQgZmlsbGVkQ291bnQgPSAwO1xyXG4gICAgICAgIGZvciAoY29uc3QgW3NlbGVjdG9yLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoZmllbGRNYXBwaW5ncykpIHtcclxuICAgICAgICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoZWwgJiYgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChlbC50eXBlID09PSAnZmlsZScpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgICAgIGVsLnZhbHVlID0gU3RyaW5nKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgICAgICAgICAgICAgICBlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnY2hhbmdlJywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuICAgICAgICAgICAgICAgIGZpbGxlZENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICBlbC5zdHlsZS5ib3JkZXIgPSBcIjJweCBzb2xpZCAjMjJjNTVlXCI7XHJcbiAgICAgICAgICAgICAgICBlbC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNmMGZkZjRcIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZmlsbGVkOiBmaWxsZWRDb3VudCB9O1xyXG5cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkF1dG8tRmlsbCBGYWlsZWQ6XCIsIGVycm9yKTtcclxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFN0cmluZyhlcnJvcikgfTtcclxuICAgIH1cclxufVxyXG5cclxuLy8gPT09PT0gU0lERSBQQU5FTCBUUklHR0VSIChQVUxTRSBJQ09OKSA9PT09PVxyXG5pZiAoZG9jdW1lbnQuYm9keS5pbm5lclRleHQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnc2Nob2xhcnNoaXAnKSB8fFxyXG4gICAgZG9jdW1lbnQuYm9keS5pbm5lclRleHQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnaGFja2F0aG9uJykgfHxcclxuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJUZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2dyYW50JykgfHxcclxuICAgIHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZS5pbmNsdWRlcygnZGV2cG9zdCcpIHx8XHJcbiAgICB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUuaW5jbHVkZXMoJ2RvcmFoYWNrcycpIHx8XHJcbiAgICB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUuaW5jbHVkZXMoJ21saCcpIHx8XHJcbiAgICB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUuaW5jbHVkZXMoJ3RhaWthaScpKSB7XHJcblxyXG4gICAgY29uc3QgaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgaWNvbi5pZCA9ICdzY2hvbGFyc3RyZWFtLXB1bHNlLWljb24nO1xyXG4gICAgaWNvbi5zdHlsZS5jc3NUZXh0ID0gYFxyXG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XHJcbiAgICAgIGJvdHRvbTogMjBweDtcclxuICAgICAgcmlnaHQ6IDIwcHg7XHJcbiAgICAgIHdpZHRoOiA1MHB4O1xyXG4gICAgICBoZWlnaHQ6IDUwcHg7XHJcbiAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICMzYjgyZjYsICM4YjVjZjYpO1xyXG4gICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgIGJveC1zaGFkb3c6IDAgNHB4IDE1cHggcmdiYSgwLDAsMCwwLjMpO1xyXG4gICAgICB6LWluZGV4OiA5OTk5O1xyXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICBjb2xvcjogd2hpdGU7XHJcbiAgICAgIGZvbnQtZmFtaWx5OiBzYW5zLXNlcmlmO1xyXG4gICAgICBmb250LXdlaWdodDogYm9sZDtcclxuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnM7XHJcbiAgICBgO1xyXG4gICAgaWNvbi5pbm5lclRleHQgPSBcIlNTXCI7XHJcblxyXG4gICAgaWNvbi5vbmNsaWNrID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiUHVsc2UgQ2xpY2tlZCAtIFJlcXVlc3RpbmcgU2lkZSBQYW5lbCBPcGVuXCIpO1xyXG4gICAgICAgIHNhZmVTZW5kTWVzc2FnZSh7IHR5cGU6ICdPUEVOX1NJREVfUEFORUwnIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVu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
