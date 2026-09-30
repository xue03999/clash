function main(config) {
  var raw = Array.isArray(config.proxies) ? config.proxies : [];
  if (!raw.length) return config;

  // 只保留名称里带地区信息的节点
  var flag = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/;
  var regionText = /(香港|台湾|澳门|中国|日本|韩国|新加坡|马来西亚|泰国|越南|菲律宾|印尼|印度|美国|加拿大|英国|法国|德国|荷兰|意大利|西班牙|俄罗斯|澳大利亚|新西兰|东京|大阪|首尔|台北|高雄|洛杉矶|圣何塞|西雅图|纽约|芝加哥|达拉斯|伦敦|巴黎|法兰克福|阿姆斯特丹|悉尼|墨尔本|Hong\s*Kong|Taiwan|Macau|Japan|Korea|Singapore|United\s*States|USA|Canada|United\s*Kingdom|France|Germany|Netherlands|Australia|Tokyo|Osaka|Seoul|Taipei|Los\s*Angeles|San\s*Jose|Seattle|New\s*York|London|Paris|Frankfurt|Amsterdam|Sydney|Melbourne)/i;
  var regionCode = /(?:^|[\s._|｜/+\-])(?:HK|TW|MO|CN|JP|KR|SG|MY|TH|VN|PH|ID|IN|PK|AE|TR|IL|SA|US|USA|CA|MX|BR|AR|CL|PE|UK|GB|FR|DE|NL|IT|ES|PT|SE|NO|FI|DK|CH|AT|PL|CZ|RO|HU|UA|RU|IE|IS|BE|GR|AU|NZ|ZA|EG)(?:\d+)?(?=$|[\s._|｜/+\-])/i;

  function isBuiltin(p) {
    var type = String(p && p.type ? p.type : "").toLowerCase();
    return ["direct", "reject", "reject-drop", "pass", "compatible"].indexOf(type) !== -1;
  }

  var infoNode = /(剩余|流量|到期|过期|套餐|官网|客服|公告|通知|订阅|重置|traffic|remaining|expire|expiry|subscription)/i;


  function hasRegion(name) {
  if (typeof name !== "string") return false;

  if (infoNode.test(name)) return false;

  return flag.test(name) ||
         regionText.test(name) ||
         regionCode.test(name);
}

  var proxies = [];
  for (var i = 0; i < raw.length; i++) {
    var source = raw[i];
    if (!source || typeof source.name !== "string") continue;
    if (isBuiltin(source)) continue;
    if (!hasRegion(source.name)) continue;

    var p = {};
    for (var k in source) {
      if (Object.prototype.hasOwnProperty.call(source, k)) p[k] = source[k];
    }
    proxies.push(p);
  }

  // 同名节点自动加序号，并保持 UDP/HY2 可用
  var used = [];
  for (var j = 0; j < proxies.length; j++) {
    var proxy = proxies[j];
    var base = proxy.name;

    if (used.indexOf(base) !== -1) {
      var n = 2;
      while (used.indexOf(base + " " + n) !== -1) n++;
      proxy.name = base + " " + n;
    }

    used.push(proxy.name);
    proxy.udp = true;

    var proxyType = String(proxy.type || "").toLowerCase();

    if (
      ["trojan", "vless", "vmess"].indexOf(proxyType) !== -1 &&
      !proxy["client-fingerprint"] &&
      (proxy.tls || proxy["reality-opts"])
    ) {
      proxy["client-fingerprint"] = "chrome";
    }
  }

  var allNames = [];
  for (var a = 0; a < proxies.length; a++) {
    allNames.push(proxies[a].name);
  }

  // 策略组地区分类
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
      if (out.indexOf(list[i]) === -1) out.push(list[i]);
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

  var sgUs = byRegion(["SG", "US"]);
  var usSgJp = byRegion(["US", "SG", "JP"]);
  var hkTw = byRegion(["HK", "TW"]);
  var jpTw = byRegion(["JP", "TW"]);

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
    youtube_domain: domain("youtube_domain", "youtube"),
    google_domain: domain("google_domain", "google"),
    google_ip: ip("google_ip", "google"),
    gemini_domain: domain("gemini_domain", "google-gemini"),
    microsoft_domain: domain("microsoft_domain", "microsoft"),
    bilibili_domain: domain("bilibili_domain", "bilibili"),
    ai_domain: domain("ai_domain", "category-ai-!cn"),
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

  var domesticDNS = [
    "https://dns.alidns.com/dns-query#DIRECT",
    "https://doh.pub/dns-query#DIRECT"
  ];

  var foreignDNS = [
    "https://cloudflare-dns.com/dns-query#节点选择",
    "https://dns.google/dns-query#节点选择"
  ];

  config.dns = {
    enable: true,
    ipv6: false,
    "use-system-hosts": false,
    "enhanced-mode": "redir-host",

    "default-nameserver": [
      "223.5.5.5",
      "119.29.29.29"
    ],

    "proxy-server-nameserver": domesticDNS,
    nameserver: foreignDNS,

    "nameserver-policy": {
      "rule-set:private_domain": domesticDNS,
      "rule-set:douyin_domain": domesticDNS,
      "rule-set:apple_cn": domesticDNS,
      "rule-set:gemini_domain": foreignDNS,
      "rule-set:google_domain": foreignDNS,
      "rule-set:cn_domain": domesticDNS,
      "+.cn": domesticDNS,
      "+.browserleaks.com": foreignDNS,
      "+.dnsleaktest.com": foreignDNS,
      "+.ipleak.net": foreignDNS,
      "+.ipinfo.io": foreignDNS,
      "whoami.akamai.net": foreignDNS
    },

    "direct-nameserver": domesticDNS,
    "direct-nameserver-follow-policy": true
  };

  function group(name, list, icon, testDirect) {
    var g = {
      name: name,
      type: "select",
      proxies: unique(safe(list))
    };

    if (icon) {
      g.icon = icon;
    }

    if (testDirect) {
      g.url = "http://www.msftconnecttest.com/connecttest.txt";
      g.interval = 0;
    }

    return g;
  }

  config["proxy-groups"] = [
    group(
      "节点选择",
      allNames.length ? allNames : ["DIRECT"],
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

  config.rules = [
    "RULE-SET,telegram_domain,Telegram",
    "RULE-SET,telegram_ip,Telegram,no-resolve",

    "RULE-SET,private_domain,DIRECT",
    "RULE-SET,private_ip,DIRECT,no-resolve",

    "RULE-SET,douyin_domain,DIRECT",

    "AND,((NETWORK,UDP),(DST-PORT,3478-3481)),REJECT",
    "AND,((NETWORK,UDP),(DST-PORT,5349-5350)),REJECT",
    "AND,((NETWORK,UDP),(DST-PORT,19302-19309)),REJECT",

    "DOMAIN-SUFFIX,browserleaks.com,节点选择",
    "DOMAIN-SUFFIX,dnsleaktest.com,节点选择",
    "DOMAIN-SUFFIX,ipleak.net,节点选择",
    "DOMAIN-SUFFIX,ipinfo.io,节点选择",
    "DOMAIN,whoami.akamai.net,节点选择",

    "RULE-SET,ads_domain,REJECT",
    "RULE-SET,apple_cn,DIRECT",

    "DOMAIN-SUFFIX,github.com,节点选择",
    "DOMAIN-SUFFIX,githubusercontent.com,节点选择",
    "DOMAIN-SUFFIX,githubassets.com,节点选择",
    "DOMAIN-SUFFIX,github.io,节点选择",

    "DOMAIN,gemini.google.com,AI",
    "DOMAIN,aistudio.google.com,AI",
    "DOMAIN,robinfrontend-pa.googleapis.com,AI",
    "DOMAIN,webchannel-robinfrontend-pa.googleapis.com,AI",
    "DOMAIN,generativelanguage.googleapis.com,AI",
    "DOMAIN,alkalimakersuite-pa.googleapis.com,AI",
    "DOMAIN,proactivebackend-pa.googleapis.com,AI",

    "RULE-SET,gemini_domain,AI",
    "RULE-SET,ai_domain,AI",
    "RULE-SET,twitter_domain,X",
    "RULE-SET,tiktok_domain,TikTok",
    "RULE-SET,youtube_domain,Google服务",
    "RULE-SET,google_domain,Google服务",
    "RULE-SET,google_ip,Google服务,no-resolve",
    "RULE-SET,microsoft_domain,微软服务",
    "RULE-SET,bilibili_domain,哔哩哔哩",
    "RULE-SET,bybit_domain,Bybit",

    "AND,((NETWORK,UDP),(DST-PORT,123)),DIRECT",

    "RULE-SET,cn_domain,DIRECT",
    "DOMAIN-SUFFIX,cn,DIRECT",
    "RULE-SET,cn_ip,DIRECT,no-resolve",

    "MATCH,节点选择"
  ];

  config.proxies = proxies;
  config.mode = "rule";

  if (!config.profile || typeof config.profile !== "object") {
    config.profile = {};
  }

  config.profile["store-selected"] = true;
  config.profile["store-fake-ip"] = true;

  delete config["global-client-fingerprint"];

  return config;
}
