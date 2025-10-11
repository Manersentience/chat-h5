/* send_bridge.js — 发送 message + 三点归一（生产合规版）
   依赖：trace_core.js 暴露的 window.TRACE_CTX（{ openid, trace_id }）
   特性：
   - 不引入任何外部库/SDK
   - 超时与错误兜底、按钮防抖、自动滚动
   - 仅向备案域 HTTPS 直连发送
*/

(function () {
  // ====== 可按需修改 ======
  var ENDPOINT = "https://manersentienceai.cn/fire_core"; // 你的 fire_core 接收路由
  var TIMEOUT_MS = 12000;                                  // 请求超时
  // =======================

  // DOM
  var input    = document.getElementById("userInput");
  var sendBtn  = document.getElementById("sendBtn");
  var messages = document.getElementById("messages");

  if (!input || !sendBtn || !messages) {
    console.warn("[H5] send_bridge.js: 必需的 DOM 节点未找到。");
    return;
  }

  // 上下文（三点归一：openid + trace_id）
  var CTX = window.TRACE_CTX || {};
  var OPENID   = CTX.openid   || "anonymous";
  var TRACE_ID = CTX.trace_id || ("t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10));

  // 工具：追加一条消息（纯文本，防 XSS）
  function appendMsg(prefix, text) {
    var div = document.createElement("div");
    div.textContent = prefix + text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // 工具：请求（带超时）
  function postWithTimeout(url, options, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
    options = options || {};
    options.signal = ctrl.signal;
    return fetch(url, options).finally(function(){ clearTimeout(t); });
  }

  // 发送逻辑
  async function sendMessage() {
    var msg = (input.value || "").trim();
    if (!msg) return;

    // 前端展示用户消息
    appendMsg("👤 用户：", msg);

    // 防抖：发送中禁用按钮
    sendBtn.disabled = true;

    // 组装三点归一负载
    var payload = {
      openid:   OPENID,
      trace_id: TRACE_ID,
      message:  msg,
      timestamp: Date.now()
    };

    try {
      console.log("[H5] 准备发送:", payload);

      var res = await postWithTimeout(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
        // 重要：不带凭证，避免跨域与审查误伤
        credentials: "omit",
        cache: "no-store",
        redirect: "follow"
      }, TIMEOUT_MS);

      if (!res.ok) {
        var txt = await res.text().catch(function(){ return ""; });
        appendMsg("⚠️ 系统：", "服务繁忙（" + res.status + "）");
        console.error("[H5] 响应非200：", res.status, txt);
        return;
      }

      // 兼容纯文本/JSON
      var replyText = "";
      var ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.indexOf("application/json") >= 0) {
        var data = await res.json();
        replyText = (data && (data.reply || data.message)) || "（AI 回复中…）";
      } else {
        replyText = await res.text();
        replyText = replyText || "（AI 回复中…）";
      }

      appendMsg("🤖 AI：", replyText);
    } catch (err) {
      var reason = (err && err.name === "AbortError") ? "请求超时" : "网络异常";
      appendMsg("⚠️ 系统：", reason + "，请稍后再试。");
      console.error("[H5] 发送失败：", err);
    } finally {
      // 复位
      sendBtn.disabled = false;
      input.value = "";
      input.focus();
    }
  }

  // 事件绑定
  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") sendMessage();
  });
})();
