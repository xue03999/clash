function main(config) {
  var dns = config && config.dns;
  // FlClash 会在脚本之后应用 DNS 字段覆写；关闭该依赖可避免
  // proxy-server-nameserver 被后置清空时导致整份配置加载失败。
  var raw = Array.isArray(config.proxies) ? config.proxies : [];
  if (!raw.length) return config;

  var TEST_URL = "https://www.gstatic.com/generate_204";
  var DIRECT_TEST_URL = "https://www.gstatic.com/generate_204";

  // 保留原来的地区识别和订阅信息过滤条件。
  var flag = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/;

  var regionText =
    /(香港|台湾|澳门|中国|日本|韩国|新加坡|马来西亚|泰国|越南|菲律宾|印尼|印度|美国|加拿大|英国|法国|德国|荷兰|意大利|西班牙|俄罗斯|澳大利亚|新西兰|东京|大阪|首尔|台北|高雄|洛杉矶|圣何塞|西雅图|纽约|芝加哥|达拉斯|伦敦|巴黎|法兰克福|阿姆斯特丹|悉尼|墨尔本|Hong\s*Kong|Taiwan|Macau|Japan|Korea|Singapore|United\s*States|USA|Canada|United\s*Kingdom|France|Germany|Netherlands|Australia|Tokyo|Osaka|Seoul|Taipei|Los\s*Angeles|San\s*Jose|Seattle|New\s*York|London|Paris|Frankfurt|Amsterdam|Sydney|Melbourne)/i;

  var regionCode =
    /(?:^|[\s._|｜/+\-])(?:HK|TW|MO|CN|JP|KR|SG|MY|TH|VN|PH|ID|IN|PK|AE|TR|IL|SA|US|USA|CA|MX|BR|AR|CL|PE|UK|GB|FR|DE|NL|IT|ES|PT|SE|NO|FI|DK|CH|AT|PL|CZ|RO|HU|UA|RU|IE|IS|BE|GR|AU|NZ|ZA|EG)(?:\d+)?(?=$|[\s._|｜/+\-])/i;

  var infoNode =
    /(剩余|流量|到期|过期|套餐|官网|客服|公告|通知|订阅|重置|traffic|remaining|expire|expiry|subscription)/i;

  var builtin = ["direct", "reject", "reject-drop", "pass", "compatible"];
  var proxies = [], allNames = [];

  // 一次完成过滤、浅复制、UDP 开启和重名处理，保持原始顺序。
  for (var i = 0; i < raw.length; i++) {
    var source = raw[i];
    if (!source || typeof source.name !== "string" || !source.name) continue;
    if (builtin.indexOf(String(source.type || "").toLowerCase()) !== -1) continue;
    if (infoNode.test(source.name)) continue;
    if (!flag.test(source.name) && !regionText.test(source.name) &&
        !regionCode.test(source.name)) continue;

    var p = {};
    for (var k in source) {
      if (Object.prototype.hasOwnProperty.call(source, k)) p[k] = source[k];
    }
    p.udp = true;
    var base = p.name, n = 2;
    while (allNames.indexOf(p.name) !== -1) p.name = base + " " + n++;
    allNames.push(p.name);
    proxies.push(p);
  }
  if (!proxies.length) return config;

  // 各地区表达式、地区优先顺序保持原样。
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
      for (var j = 0; j < allNames.length; j++) {
        if (re.test(allNames[j])) out.push(allNames[j]);
      }
    }
    return unique(out);
  }

  var sgUs = byRegion(["SG", "US"]);
  var usSgJp = byRegion(["US", "SG", "JP"]);
  var hkTw = byRegion(["HK", "TW"]);
  var jpTw = byRegion(["JP", "TW"]);

  // 用同一个构造函数生成域名 / IP 规则集，地址与缓存路径不变。
  var META = "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo";
  function provider(name, file, isIP) {
    return {
      type: "http",
      behavior: isIP ? "ipcidr" : "domain",
      format: "mrs",
      interval: 86400,
      url: META + (isIP ? "/geoip/" : "/geosite/") + file + ".mrs",
      path: "./ruleset/" + name + ".mrs"
    };
  }

  config["rule-providers"] = {
    private_domain: provider("private_domain", "private"),
    private_ip: provider("private_ip", "private", true),
    cn_domain: provider("cn_domain", "cn"),
    cn_ip: provider("cn_ip", "cn", true),
    douyin_domain: provider("douyin_domain", "douyin"),
    apple_cn: provider("apple_cn", "apple-cn"),
    telegram_domain: provider("telegram_domain", "telegram"),
    telegram_ip: provider("telegram_ip", "telegram", true),
    twitter_domain: provider("twitter_domain", "twitter"),
    tiktok_domain: provider("tiktok_domain", "tiktok"),
    openai_domain: provider("openai_domain", "openai"),
    gemini_domain: provider("gemini_domain", "google-gemini"),
    ai_domain: provider("ai_domain", "category-ai-!cn"),
    youtube_domain: provider("youtube_domain", "youtube"),
    google_domain: provider("google_domain", "google"),
    google_ip: provider("google_ip", "google", true),
    microsoft_domain: provider("microsoft_domain", "microsoft"),
    bilibili_domain: provider("bilibili_domain", "bilibili"),
    bybit_domain: provider("bybit_domain", "bybit"),
    ads_domain: {
      type: "http",
      behavior: "domain",
      format: "mrs",
      interval: 86400,
      url: "https://fastly.jsdelivr.net/gh/217heidai/adblockfilters@main/rules/adblockmihomolite.mrs",
      path: "./ruleset/adblockmihomolite.mrs"
    }
  };

  // 手动选择、空地区回退、图标和测速设置保持不变。
  function group(name, list, icon, directTest) {
    return {
      name: name,
      type: "select",
      proxies: unique(list.length ? list : ["节点选择"]),
      url: directTest ? DIRECT_TEST_URL : TEST_URL,
      interval: 0,
      icon: icon
    };
  }

  config["proxy-groups"] = [
    group("节点选择", allNames, "https://i.postimg.cc/wBkXs3tr/Airport.png"),
    group("Telegram", sgUs, "https://i.postimg.cc/wvvmy28b/Telegram.png"),
    group("X", sgUs, "https://i.postimg.cc/tgYX18dD/x.png"),
    group("TikTok", sgUs, "https://i.postimg.cc/JnnkDxVg/Tik-Tok.png"),
    group("AI", usSgJp, "https://i.postimg.cc/JhG1yS3Y/openai.png"),
    group("Google服务", sgUs, "https://i.postimg.cc/8Cwvz339/Google.png"),
    group("微软服务", sgUs.concat(["DIRECT"]), "https://i.postimg.cc/903KTFFF/Microsoft.png", true),
    group("哔哩哔哩", hkTw.concat(["DIRECT"]), "https://i.postimg.cc/mrV9gqq3/bilibili.png", true),
    group("Bybit", jpTw, "https://i.postimg.cc/qqYmNgtV/bybit.jpg")
  ];

  // 分流规则按原来的顺序匹配。
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

  config.proxies = proxies;
  config.mode = "rule";
  if (!config.profile || typeof config.profile !== "object") config.profile = {};
  config.profile["store-selected"] = true;
  return config;
}
