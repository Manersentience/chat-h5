/* trace_core.js  —  H5三点归一（合规·生产版）
   - 从 URL 读取 openid（验证合法）
   - 生成每标签页唯一 trace_id（sessionStorage）
   - 读取后移除地址栏中的 openid
   - 不含任何网络请求/外部依赖
*/

(function () {
  var DEBUG = false; // 调试时可设为 true

  // 读取 URL 中的 openid
  function readOpenIdFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = (params.get("openid") || "").trim();
      return raw || null;
    } catch (e) {
      return null;
    }
  }

  // 合法性校验（微信 openid 常为字母数字/下划线/中划线，长度约 10-64）
  function normalizeOpenId(v) {
    var re = /^[A-Za-z0-9_-]{10,64}$/;
    return re.test(v) ? v : null;
  }

  // 获取 openid：优先 sessionStorage，其次 URL
  function getOpenId() {
    var cached = sessionStorage.getItem("openid");
    if (cached && normalizeOpenId(cached)) return cached;

    var fromUrl = readOpenIdFromUrl();
    var ok = fromUrl && normalizeOpenId(fromUrl) ? fromUrl : "anonymous";

    // 持久到本页会话
    sessionStorage.setItem("openid", ok);

    // 读取后从地址栏移除 openid，防止转发泄露
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete("openid");
      var newSearch = url.searchParams.toString();
      var newUrl = url.pathname + (newSearch ? "?" + newSearch : "") + url.hash;
      history.replaceState({}, document.title, newUrl);
    } catch (e) {}

    return ok;
  }

  // 生成/获取 trace_id：每个标签页唯一
  function getTraceId() {
    var tid = sessionStorage.getItem("trace_id");
    if (tid) return tid;

    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      tid = "t_" + crypto.randomUUID();
    } else {
      tid = "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);
    }
    sessionStorage.setItem("trace_id", tid);
    return tid;
  }

  // 三点生成
  var openid = getOpenId();
  var trace_id = getTraceId();

  if (DEBUG) console.log("[H5] 三点生成:", { openid: openid, trace_id: trace_id });

  // 向全局暴露（供 send_bridge.js 等使用）
  window.TRACE_CTX = Object.freeze({ openid: openid, trace_id: trace_id });
})();
