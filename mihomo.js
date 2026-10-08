function main(config) {
  var raw = Array.isArray(config.proxies) ? config.proxies : [];
  if (!raw.length) return config;

  // Clash / Mihomo 通用手动测速地址
  var TEST_URL = "http://www.gstatic.com/generate_204";
  var DIRECT_TEST_URL = "http://www.msftconnecttest.com/connecttest.txt";

  // 只保留名称里带地区信息的真实节点
  var flag = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/;

  var regionText =
    /(香港|台湾|澳门|中国|日本|韩国|新加坡|马来西亚|泰国|越南|菲律宾|印尼|印度|美国|加拿大|英国|法国|德国|荷兰|意大利|西班牙|俄罗斯|澳大利亚|新西兰|东京|大阪|首尔|台北|高雄|洛杉矶|圣何塞|西雅图|纽约|芝加哥|达拉斯|伦敦|巴黎|法兰克福|阿姆斯特丹|悉尼|墨尔本|Hong\s*Kong|Taiwan|Macau|Japan|Korea|Singapore|United\s*States|USA|Canada|United\s*Kingdom|France|Germany|Netherlands|Australia|Tokyo|Osaka|Seoul|Taipei|Los\s*Angeles|San\s*Jose|Seattle|New\s*York|London|Paris|Frankfurt|Amsterdam|Sydney|Melbourne)/i;

  var regionCode =
    /(?:^|[\s._|｜/+\-])(?:HK|TW|MO|CN|JP|KR|SG|MY|TH|VN|PH|ID|IN|PK|AE|TR|IL|SA|US|USA|CA|MX|BR|AR|CL|PE|UK|GB|FR|DE|NL|IT|ES|PT|SE|NO|FI|DK|CH|AT|PL|CZ|RO|HU|UA|RU|IE|IS|BE|GR|AU|NZ|ZA|EG)(?:\d+)?(?=$|[\s._|｜/+\-])/i;

  var infoNode =
    /(剩余|流量|到期|过期|套餐|官网|客服|公告|通知|订阅|重置|traffic|remaining|expire|expiry|subscription)/i;

  function isBuiltin(p) {
    var type = String(p && p.type ? p.type : "").toLowerCase();

    return [
      "direct",
      "reject",
      "reject-drop",
      "pass",
      "compatible"
    ].indexOf(type) !== -1;
  }

  function hasRegion(name) {
    if (typeof name !== "string" || !name) return false;

    if (infoNode.test(name)) return false;

    return (
      flag.test(name) ||
      regionText.test(name) ||
      regionCode.test(name)
    );
  }

  // 过滤节点，并保持机场原始顺序
  var proxies = [];

  for (var i = 0; i < raw.length; i++) {
    var source = raw[i];

    if (!source || typeof source.name !== "string") continue;
    if (isBuiltin(source)) continue;
    if (!hasRegion(source.name)) continue;

    var p = {};

    for (var k in source) {
      if (Object.prototype.hasOwnProperty.call(source, k)) {
        p[k] = source[k];
      }
    }

    // HY2 / Hysteria2 等节点需要 UDP
    p.udp = true;

    proxies.push(p);
  }

  if (!proxies.length) return config;

  // 同名节点自动加序号
  var used = [];

  for (var j = 0; j < proxies.length; j++) {
    var base = proxies[j].name;

    if (used.indexOf(base) !== -1) {
      var n = 2;

      while (used.indexOf(base + " " + n) !== -1) {
        n++;
      }

      proxies[j].name = base + " " + n;
    }

    used.push(proxies[j].name);
  }

  var allNames = [];

  for (var a = 0; a < proxies.length; a++) {
    allNames.push(proxies[a].name);
  }

  // 专用策略组地区分类
  var region = {
    HK: /(🇭🇰|香港|Hong\s*Kong|(?:^|[\s._|｜/+\-])HK(?:\d+)?(?=$|[\s._|｜/+\-]))/i,

    TW: /(🇹🇼|台湾|Taiwan|台北|高雄|(?:^|[\s._|｜/+\-])TW(?:\d+)?(?=$|[\s._|｜/+\-]))/i,

    SG: /(🇸🇬|新加坡|狮城|Singapore|(?:^|[\s._|｜/+\-])SG(?:\d+)?(?=$|[\s._|｜/+\-]))/i,

    JP: /(🇯🇵|日本|Japan|东京|大阪|(?:^|[\s._|｜/+\-])JP(?:\d+)?(?=$|[\s._|｜/+\-]))/i,

    US: /(🇺🇸|美国|United\s*States|USA|洛杉矶|圣何塞|西雅图|纽约|芝加哥|达拉斯|(?:^|[\s._|｜/+\-])US(?:\d+)?(?=$|[\s._|｜/+\-]))/i
  };

  function unique(list) {
    var out = [];

    for (var i = 0; i < list.length; i++) {
      if (out.indexOf(list[i]) === -1) {
        out.push(list[i]);
      }
    }

    return out;
  }

  function byRegion(keys) {
    var out = [];

    for (var i = 0; i < keys.length; i++) {
      var re = region[keys[i]];

      if (!re) continue;

      for (var j = 0; j < proxies.length; j++) {
        if (re.test(proxies[j].name)) {
          out.push(proxies[j].name);
        }
      }
    }

    return unique(out);
  }

  function safe(list) {
    return list.length ? list : ["节点选择"];
  }

  // 各策略组地区
  var sgUs = byRegion(["SG", "US"]);
  var usSgJp = byRegion(["US", "SG", "JP"]);
  var hkTw = byRegion(["HK", "TW"]);
  var jpTw = byRegion(["JP", "TW"]);

  // MetaCubeX Rule Provider
  var META =
    "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo";

  function domain(name, file) {
    file = file || name;

    return {
      type: "http",
      behavior: "domain",
      format: "mrs",
      interval: 86400,
      url: META + "/geosite/" + file + ".mrs",
      path: "./ruleset/" + name + ".mrs"
    };
  }

  function ip(name, file) {
    file = file || name;

    return {
      type: "http",
      behavior: "ipcidr",
      format: "mrs",
      interval: 86400,
      url: META + "/geoip/" + file + ".mrs",
      path: "./ruleset/" + name + ".mrs"
    };
  }

  config["rule-providers"] = {
    private_domain: domain("private_domain", "private"),
    private_ip: ip("private_ip", "private"),

    cn_domain: domain("cn_domain", "cn"),
    cn_ip: ip("cn_ip", "cn"),

    douyin_domain: domain("douyin_domain", "douyin"),
    apple_cn: domain("apple_cn", "apple-cn"),

    telegram_domain: domain("telegram_domain", "telegram"),
    telegram_ip: ip("telegram_ip", "telegram"),

    twitter_domain: domain("twitter_domain", "twitter"),
    tiktok_domain: domain("tiktok_domain", "tiktok"),

    openai_domain: domain("openai_domain", "openai"),
    gemini_domain: domain("gemini_domain", "google-gemini"),
    ai_domain: domain("ai_domain", "category-ai-!cn"),

    youtube_domain: domain("youtube_domain", "youtube"),
    google_domain: domain("google_domain", "google"),
    google_ip: ip("google_ip", "google"),

    microsoft_domain: domain("microsoft_domain", "microsoft"),

    bilibili_domain: domain("bilibili_domain", "bilibili"),

    bybit_domain: domain("bybit_domain", "bybit"),

    ads_domain: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      interval: 86400,
      url: "https://fastly.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.mrs",
      path: "./ruleset/adblockmihomolite.mrs"
    }
  };

  // =========================
  // DNS
  // =========================

  // Bootstrap DNS
  var bootstrapDNS = [
    "223.5.5.5",
    "119.29.29.29"
  ];

  // 国内 DNS
  var domesticDNS = [
    "https://dns.alidns.com/dns-query#DIRECT",
    "https://doh.pub/dns-query#DIRECT"
  ];

  // 普通国外 DNS
  var foreignDNS = [
    "https://cloudflare-dns.com/dns-query#节点选择",
    "https://dns.google/dns-query#节点选择"
  ];

  // Telegram 专用 DNS
  var telegramDNS = [
    "https://cloudflare-dns.com/dns-query#Telegram",
    "https://dns.google/dns-query#Telegram"
  ];

  // AI / OpenAI / Gemini 专用 DNS
  var aiDNS = [
    "https://cloudflare-dns.com/dns-query#AI",
    "https://dns.google/dns-query#AI"
  ];

  config.dns = {
    enable: true,

    // DNS 不返回 IPv6，避免部分线路 Telegram / X 变慢
    ipv6: false,

    "use-system-hosts": false,

    "enhanced-mode": "redir-host",

    "default-nameserver": bootstrapDNS,

    // 机场节点域名解析
    "proxy-server-nameserver": bootstrapDNS,

    // 默认国外 DNS
    nameserver: foreignDNS,

    "nameserver-policy": {
      // 国内
      "rule-set:private_domain": domesticDNS,
      "rule-set:douyin_domain": domesticDNS,
      "rule-set:apple_cn": domesticDNS,
      "rule-set:cn_domain": domesticDNS,
      "+.cn": domesticDNS,

      // Telegram
      "rule-set:telegram_domain": telegramDNS,

      // OpenAI / ChatGPT / Codex / Gemini
      "rule-set:openai_domain": aiDNS,
      "rule-set:gemini_domain": aiDNS,
      "rule-set:ai_domain": aiDNS,

      // Google
      "rule-set:google_domain": foreignDNS,

      // IP / DNS Leak Test
      "+.browserleaks.com": foreignDNS,
      "+.dnsleaktest.com": foreignDNS,
      "+.ipleak.net": foreignDNS,
      "+.ipinfo.io": foreignDNS,
      "whoami.akamai.net": foreignDNS
    },

    "direct-nameserver": domesticDNS,

    "direct-nameserver-follow-policy": true
  };

  // =========================
  // 策略组
  // =========================
  function group(name, list, icon, directTest) {
    var g = {
      name: name,
      type: "select",
      proxies: unique(safe(list)),
      url: directTest ? DIRECT_TEST_URL : TEST_URL,
      interval: 0
    };

    if (icon) {
      g.icon = icon;
    }

    return g;
  }

  config["proxy-groups"] = [
    group(
      "节点选择",
      allNames,
      "https://i.postimg.cc/wBkXs3tr/Airport.png"
    ),

    group(
      "Telegram",
      sgUs,
      "https://i.postimg.cc/wvvmy28b/Telegram.png"
    ),

    group(
      "X",
      sgUs,
      "https://i.postimg.cc/tgYX18dD/x.png"
    ),

    group(
      "TikTok",
      sgUs,
      "https://i.postimg.cc/JnnkDxVg/Tik-Tok.png"
    ),

    group(
      "AI",
      usSgJp,
      "https://i.postimg.cc/JhG1yS3Y/openai.png"
    ),

    group(
      "Google服务",
      sgUs,
      "https://i.postimg.cc/8Cwvz339/Google.png"
    ),

    group(
      "微软服务",
      sgUs.concat(["DIRECT"]),
      "https://i.postimg.cc/903KTFFF/Microsoft.png",
      true
    ),

    group(
      "哔哩哔哩",
      hkTw.concat(["DIRECT"]),
      "https://i.postimg.cc/mrV9gqq3/bilibili.png",
      true
    ),

    group(
      "Bybit",
      jpTw,
      "https://i.postimg.cc/qqYmNgtV/bybit.jpg"
    )
  ];

  // =========================
  // 路由规则
  // =========================

  config.rules = [
    // Telegram
    "RULE-SET,telegram_domain,Telegram",
    "RULE-SET,telegram_ip,Telegram,no-resolve",

    // 私有网络
    "RULE-SET,private_domain,DIRECT",
    "RULE-SET,private_ip,DIRECT,no-resolve",

    // 国内抖音
    "RULE-SET,douyin_domain,DIRECT",

    // WebRTC / STUN / TURN 防泄漏
    "AND,((NETWORK,UDP),(DST-PORT,3478-3481)),REJECT",
    "AND,((NETWORK,UDP),(DST-PORT,5349-5350)),REJECT",
    "AND,((NETWORK,UDP),(DST-PORT,19302-19309)),REJECT",

    // IP / DNS Leak 测试站
    "DOMAIN-SUFFIX,browserleaks.com,节点选择",
    "DOMAIN-SUFFIX,dnsleaktest.com,节点选择",
    "DOMAIN-SUFFIX,ipleak.net,节点选择",
    "DOMAIN-SUFFIX,ipinfo.io,节点选择",
    "DOMAIN,whoami.akamai.net,节点选择",

    // 广告
    "RULE-SET,ads_domain,REJECT",

    // Apple 中国
    "RULE-SET,apple_cn,DIRECT",

    // GitHub
    "DOMAIN-SUFFIX,github.com,节点选择",
    "DOMAIN-SUFFIX,githubusercontent.com,节点选择",
    "DOMAIN-SUFFIX,githubassets.com,节点选择",
    "DOMAIN-SUFFIX,github.io,节点选择",

    // AI / OpenAI / ChatGPT / Codex / Gemini
    "RULE-SET,openai_domain,AI",
    "RULE-SET,gemini_domain,AI",
    "RULE-SET,ai_domain,AI",

    // X / TikTok
    "RULE-SET,twitter_domain,X",
    "RULE-SET,tiktok_domain,TikTok",

    // YouTube / Google
    "RULE-SET,youtube_domain,Google服务",
    "RULE-SET,google_domain,Google服务",
    "RULE-SET,google_ip,Google服务,no-resolve",

    // Microsoft
    "RULE-SET,microsoft_domain,微软服务",

    // Bilibili
    "RULE-SET,bilibili_domain,哔哩哔哩",

    // Bybit
    "RULE-SET,bybit_domain,Bybit",

    // NTP
    "AND,((NETWORK,UDP),(DST-PORT,123)),DIRECT",

    // 中国大陆
    "RULE-SET,cn_domain,DIRECT",
    "DOMAIN-SUFFIX,cn,DIRECT",
    "RULE-SET,cn_ip,DIRECT,no-resolve",

    // 其他国外流量
    "MATCH,节点选择"
  ];

  // 写回过滤后的节点
  config.proxies = proxies;

  // 使用规则模式
  config.mode = "rule";

  // 只保留节点选择记忆
  if (!config.profile || typeof config.profile !== "object") {
    config.profile = {};
  }

  config.profile["store-selected"] = true;

  return config;
}
