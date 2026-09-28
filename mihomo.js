const main = (config) => {
  const raw = Array.isArray(config.proxies) ? config.proxies : [];
  if (!raw.length) return config;

  const flag = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
  const regionWords = /(?:香港|Hong\s*Kong|台湾|Taiwan|澳门|Macao|Macau|中国|China|日本|Japan|韩国|South\s*Korea|Korea|新加坡|狮城|Singapore|马来西亚|Malaysia|泰国|Thailand|越南|Vietnam|菲律宾|Philippines|印度尼西亚|印尼|Indonesia|印度|India|巴基斯坦|Pakistan|阿联酋|UAE|United\s*Arab\s*Emirates|土耳其|Turkey|以色列|Israel|沙特|Saudi\s*Arabia|美国|United\s*States|USA|加拿大|Canada|墨西哥|Mexico|巴西|Brazil|阿根廷|Argentina|智利|Chile|秘鲁|Peru|英国|United\s*Kingdom|Britain|法国|France|德国|Germany|荷兰|Netherlands|意大利|Italy|西班牙|Spain|葡萄牙|Portugal|瑞典|Sweden|挪威|Norway|芬兰|Finland|丹麦|Denmark|瑞士|Switzerland|奥地利|Austria|波兰|Poland|捷克|Czech|罗马尼亚|Romania|匈牙利|Hungary|乌克兰|Ukraine|俄罗斯|Russia|爱尔兰|Ireland|冰岛|Iceland|比利时|Belgium|希腊|Greece|澳大利亚|Australia|新西兰|New\s*Zealand|南非|South\s*Africa|埃及|Egypt)/i;
  const regionCode = /(?:^|[^A-Za-z])(?:HK|TW|MO|CN|JP|KR|SG|MY|TH|VN|PH|ID|IN|PK|AE|TR|IL|SA|US|USA|CA|MX|BR|AR|CL|PE|UK|GB|FR|DE|NL|IT|ES|PT|SE|NO|FI|DK|CH|AT|PL|CZ|RO|HU|UA|RU|IE|IS|BE|GR|AU|NZ|ZA|EG)(?:\d+|[^A-Za-z]|$)/i;

  const region = {
    HK: /(🇭🇰|香港|Hong\s*Kong|(?:^|[^A-Za-z])HK(?:\d+|[^A-Za-z]|$))/i,
    TW: /(🇹🇼|台湾|Taiwan|(?:^|[^A-Za-z])TW(?:\d+|[^A-Za-z]|$))/i,
    SG: /(🇸🇬|新加坡|狮城|Singapore|(?:^|[^A-Za-z])SG(?:\d+|[^A-Za-z]|$))/i,
    JP: /(🇯🇵|日本|Japan|(?:^|[^A-Za-z])JP(?:\d+|[^A-Za-z]|$))/i,
    US: /(🇺🇸|美国|United\s*States|USA|(?:^|[^A-Za-z])US(?:\d+|[^A-Za-z]|$))/i
  };

  const isBuiltin = p => ["direct", "reject", "reject-drop", "pass", "compatible"]
    .includes(String(p?.type || "").toLowerCase());

  const hasRegion = name => {
    if (typeof name !== "string" || !name.trim()) return false;
    return flag.test(name) || regionWords.test(name) || regionCode.test(name);
  };

  let proxies = raw
    .filter(p => p && typeof p.name === "string")
    .filter(p => !isBuiltin(p))
    .filter(p => hasRegion(p.name));

  if (!proxies.length) return config;

  const used = new Set();

  proxies = proxies.map(proxy => {
    const p = { ...proxy };
    const base = p.name;

    if (used.has(base)) {
      let n = 2;
      while (used.has(`${base} ${n}`)) n++;
      p.name = `${base} ${n}`;
    }

    used.add(p.name);
    p.udp = true;

    const type = String(p.type || "").toLowerCase();

    if (
      ["trojan", "vless", "vmess"].includes(type) &&
      !p["client-fingerprint"] &&
      (p.tls || p["reality-opts"])
    ) {
      p["client-fingerprint"] = "chrome";
    }

    return p;
  });

  const allNames = proxies.map(p => p.name);

  const byRegion = (...keys) => [...new Set(keys.flatMap(key =>
    proxies
      .filter(p => region[key].test(p.name))
      .map(p => p.name)
  ))];

  const safe = list => list.length ? list : ["节点选择"];

  const sgUs = byRegion("SG", "US");
  const usSgJp = byRegion("US", "SG", "JP");
  const hkTw = byRegion("HK", "TW");
  const jpTw = byRegion("JP", "TW");

  const META =
    "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo";

  const domain = (name, file = name) => ({
    type: "http",
    behavior: "domain",
    format: "mrs",
    interval: 86400,
    url: `${META}/geosite/${file}.mrs`,
    path: `./ruleset/${name}.mrs`
  });

  const ip = (name, file = name) => ({
    type: "http",
    behavior: "ipcidr",
    format: "mrs",
    interval: 86400,
    url: `${META}/geoip/${file}.mrs`,
    path: `./ruleset/${name}.mrs`
  });

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

  const domesticDNS = [
    "https://dns.alidns.com/dns-query#DIRECT",
    "https://doh.pub/dns-query#DIRECT"
  ];

  const foreignDNS = [
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

  const group = (name, list, icon, testDirect = false) => ({
    name,
    type: "select",

    ...(icon ? { icon } : {}),

    proxies: [...new Set(safe(list))],

    ...(testDirect ? {
      url: "http://www.msftconnecttest.com/connecttest.txt",
      interval: 0
    } : {})
  });

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
      [...sgUs, "DIRECT"],
      "https://i.postimg.cc/903KTFFF/Microsoft.png",
      true
    ),

    group(
      "哔哩哔哩",
      [...hkTw,"DIRECT"],
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

  config.profile = {
    ...(config.profile || {}),
    "store-selected": true,
    "store-fake-ip": true
  };
  
  delete config["global-client-fingerprint"];

  return config;
};
