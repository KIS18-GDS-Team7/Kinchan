// main と、main を base とする PR の成果物を Google Drive (共有ドライブ) に置く Apps Script
//
//   成果物/                                main の最新に追従する
//   PR-成果物/#<番号> <タイトル>-成果物/   PR の差分に含まれる成果物。PR が閉じたらゴミ箱に移す
//
// 置くファイルと置き場所は manifest.json で決める。時間トリガーの poll が GitHub と Drive の状態を突き合わせる。

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";
const POLL_MINUTES = 10;                // everyMinutes に渡せる値は 1, 5, 10, 15, 30
const TIME_BUDGET_MS = 4.5 * 60 * 1000; // 実行時間の上限 (6 分) に対する余裕。超えた分は次回に回す
const EMPTY_CACHE_SEC = 6 * 60 * 60;    // 成果物を含まない PR head を覚えておく時間 (CacheService の上限)
const DRIVE_OPTS = { supportsAllDrives: true };

// スクリプトプロパティ取得 (既定値あり、required 指定時は未設定でエラー)
function prop_(key, def, required) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (v) return v;
  if (required) throw new Error("Script property not set: " + key);
  return def;
}

function config_() {
  return {
    repo: prop_("GITHUB_REPO", null, true),
    rootId: prop_("DRIVE_FOLDER_ID", null, true),
    base: prop_("BASE_BRANCH", "main"),
    mainFolder: prop_("MAIN_FOLDER_NAME", "成果物"),
    prFolder: prop_("PR_FOLDER_NAME", "PR-成果物"),
    manifestPath: prop_("MANIFEST_PATH", "tools/drive-delivery/manifest.json")
  };
}

// ---------------------------------------------------------------- 手動で実行する関数

// poll の時間トリガーを作り直す
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "poll")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("poll").timeBased().everyMinutes(POLL_MINUTES).create();
  Logger.log("trigger installed: poll every " + POLL_MINUTES + " minutes");
}

// Drive に書き込まずに、置く予定のファイルをログに出す
function dryRun() {
  const cfg = config_();
  const sha = mainHead_(cfg);
  try {
    const mainTargets = mainTargets_(cfg, sha);
    Logger.log(cfg.mainFolder + "/ <- " + cfg.base + " @" + sha.slice(0, 7) + " (" + mainTargets.length + " files)");
    mainTargets.forEach(t => Logger.log("  " + t.path + " -> " + destKey_(t)));
  } catch (e) {
    Logger.log(cfg.mainFolder + "/: ERROR " + e.message);
  }
  listOpenPulls_(cfg).forEach(pr => {
    const reason = ineligibleReason_(cfg, pr);
    if (reason) {
      Logger.log("#" + pr.number + ": skipped (" + reason + ")");
      return;
    }
    let targets;
    try {
      targets = prTargets_(cfg, pr);
    } catch (e) {
      Logger.log("#" + pr.number + ": ERROR " + e.message);
      return;
    }
    if (!targets.length) {
      Logger.log("#" + pr.number + ": skipped (no deliverable changes)");
      return;
    }
    Logger.log(cfg.prFolder + "/" + prFolderName_(pr) + "/ (" + targets.length + " files)");
    targets.forEach(t => Logger.log("  " + t.path + " -> " + destKey_(t)));
  });
}

// 同期済みの head の記録を消し、次回の poll で全対象を読み直させる (内容が同じファイルは再アップロードしない)
function forceResync() {
  const cfg = config_();
  const main = findFolder_(cfg.rootId, cfg.mainFolder);
  if (main) setProps_(main.id, { kinchanHead: null });
  const prRoot = findFolder_(cfg.rootId, cfg.prFolder);
  if (prRoot) {
    const folders = listPrFolders_(prRoot.id);
    Object.keys(folders.byPr).forEach(num => setProps_(folders.byPr[num].id, { kinchanHead: null }));
  }
  Logger.log("cleared kinchanHead; the next poll re-reads all targets");
}

// GitHub API の認証の有無と残り回数、リポジトリを読めることを確認する (/rate_limit は回数に数えられない)
function checkGitHub() {
  const cfg = config_();
  const core = JSON.parse(githubFetch_("https://api.github.com/rate_limit").getContentText()).resources.core;
  const reset = Utilities.formatDate(new Date(core.reset * 1000), "Asia/Tokyo", "HH:mm");
  Logger.log("core: limit=" + core.limit + " remaining=" + core.remaining + " reset=" + reset + " JST");
  if (core.limit <= 60) Logger.log("WARNING: the limit is the unauthenticated one; check GITHUB_TOKEN");
  Logger.log("repo: " + ghJson_(cfg, "").full_name + " (readable)");
}

// Markdown → Docs のインポート対応を確認
function checkImportFormats() {
  const formats = Drive.About.get({ fields: "importFormats" }).importFormats || {};
  Logger.log("text/markdown import: " + (formats["text/markdown"] ? JSON.stringify(formats["text/markdown"]) : "NOT supported"));
}

// ---------------------------------------------------------------- トリガーから呼ばれる処理

function poll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log("previous run is still active; skipped");
    return;
  }
  try {
    reconcile_(config_());
  } finally {
    lock.releaseLock();
  }
}

// GitHub の状態 (main の head、open PR) に Drive を合わせる
function reconcile_(cfg) {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const errors = [];

  try {
    syncMain_(cfg, deadline);
  } catch (e) {
    errors.push(cfg.mainFolder + ": " + e.message);
    Logger.log("sync failed for " + cfg.mainFolder + "/: " + e.message);
  }

  // PR 一覧の取得に失敗した場合はここで例外になる。不完全な一覧をもとにフォルダを消さない
  const pulls = listOpenPulls_(cfg);
  const prRootId = findOrCreateFolder_(cfg.rootId, cfg.prFolder).id;
  const folders = listPrFolders_(prRootId);
  const eligible = pulls.filter(pr => !ineligibleReason_(cfg, pr));

  // 対象外になった PR (close、merge、draft 化、base の変更) のフォルダをゴミ箱へ
  const open = {};
  eligible.forEach(pr => { open[pr.number] = true; });
  folders.duplicates.forEach(f => trashFolder_(f, "duplicate folder for PR #" + f.properties.kinchanPr));
  Object.keys(folders.byPr).forEach(num => {
    if (!open[num]) trashFolder_(folders.byPr[num], "PR #" + num + " is no longer an open non-draft PR to " + cfg.base);
  });

  const deferred = [];
  eligible.forEach(pr => {
    if (Date.now() > deadline) {
      deferred.push("#" + pr.number);
      return;
    }
    try {
      syncPr_(cfg, pr, folders.byPr[pr.number], prRootId, deadline);
    } catch (e) {
      errors.push("#" + pr.number + ": " + e.message);
      Logger.log("sync failed for PR #" + pr.number + ": " + e.message);
    }
  });
  if (deferred.length) Logger.log("deferred to the next run: " + deferred.join(", "));

  // 失敗はまとめて例外にし、トリガーの失敗通知を発火させる (他の PR の処理は止めない)
  if (errors.length) throw new Error("sync failed: " + errors.join(" / "));
}

// 成果物/ を main の head に合わせる
function syncMain_(cfg, deadline) {
  const sha = mainHead_(cfg);
  const folder = findOrCreateFolder_(cfg.rootId, cfg.mainFolder);
  if (folder.properties.kinchanHead === sha) return;

  const targets = mainTargets_(cfg, sha);
  // manifest の誤りで対象が 0 件になった場合に、成果物/ を空にしない
  if (!targets.length) throw new Error("manifest matched no files at " + sha.slice(0, 7) + "; " + cfg.mainFolder + "/ is left as is");

  const stats = syncFolder_(cfg, sha, folder.id, targets, cfg.base + " @" + sha.slice(0, 7), deadline);
  if (stats.complete) setProps_(folder.id, { kinchanHead: sha });
  logStats_(cfg.mainFolder + "/ <- " + cfg.base + " @" + sha.slice(0, 7), stats);
}

// PR-成果物/<PR フォルダ>/ を PR の head に合わせる
function syncPr_(cfg, pr, folder, prRootId, deadline) {
  const sha = pr.head.sha;
  const name = prFolderName_(pr);

  if (folder && folder.properties.kinchanHead === sha) {
    if (folder.name !== name) {
      Drive.Files.update({ name: name, description: prDescription_(pr) }, folder.id, null, DRIVE_OPTS);
      Logger.log("renamed: " + folder.name + " -> " + name);
    }
    return;
  }

  // 成果物を含まない PR は head が変わるまで差分を読み直さない (GitHub API の呼び出しを抑える)
  const cache = CacheService.getScriptCache();
  const emptyKey = "empty:" + pr.number + ":" + sha;
  if (!folder && cache.get(emptyKey)) return;

  const targets = prTargets_(cfg, pr);
  if (!targets.length) {
    cache.put(emptyKey, "1", EMPTY_CACHE_SEC);
    if (folder) trashFolder_(folder, "PR #" + pr.number + " no longer changes any deliverable");
    return;
  }

  const folderId = folder
    ? folder.id
    : createFolder_(prRootId, name, { kinchanPr: String(pr.number) }, prDescription_(pr));
  const stats = syncFolder_(cfg, sha, folderId, targets, "PR #" + pr.number + " @" + sha.slice(0, 7), deadline);
  const meta = { name: name, description: prDescription_(pr) };
  if (stats.complete) meta.properties = { kinchanHead: sha };
  Drive.Files.update(meta, folderId, null, DRIVE_OPTS);
  logStats_(cfg.prFolder + "/" + name + " <- @" + sha.slice(0, 7), stats);
}

function ineligibleReason_(cfg, pr) {
  if (pr.draft) return "draft";
  // public repo なので fork からの PR は誰でも出せる。外部の内容を Drive に置かない
  if (!pr.head.repo || pr.head.repo.full_name.toLowerCase() !== cfg.repo.toLowerCase()) return "from a fork";
  if (pr.base.ref !== cfg.base) return "base is " + pr.base.ref;
  return null;
}

function prFolderName_(pr) {
  return "#" + pr.number + " " + pr.title.trim() + "-成果物";
}

function prDescription_(pr) {
  return "PR #" + pr.number + " " + pr.title.trim() + "\n" + pr.html_url + "\nhead: " + pr.head.ref + " @" + pr.head.sha.slice(0, 7);
}

function logStats_(label, s) {
  Logger.log(label + ": created=" + s.created + " updated=" + s.updated + " unchanged=" + s.unchanged +
    " trashed=" + s.trashed + (s.complete ? "" : " (incomplete; continues in the next run)"));
}

// ---------------------------------------------------------------- 同期対象の決定

// main の head にある、manifest に一致する全ファイル
function mainTargets_(cfg, sha) {
  const manifest = loadManifest_(cfg, sha);
  if (isLegacyManifest_(manifest)) throw new Error("manifest at " + sha.slice(0, 7) + " is in the old format (has mode); " + cfg.mainFolder + "/ is left as is");
  const tree = ghJson_(cfg, "/git/trees/" + sha + "?recursive=1");
  if (tree.truncated) Logger.log("WARNING: git tree is truncated; some files may be missing");
  const files = tree.tree.filter(n => n.type === "blob").map(n => ({ path: n.path, sha: n.sha }));
  return expandTargets_(manifest.entries, files, true);
}

// PR の差分 (削除を除く) のうち、manifest に一致するファイル。manifest は PR の head のものを使う
function prTargets_(cfg, pr) {
  let manifest = null;
  try {
    manifest = loadManifest_(cfg, pr.head.sha);
  } catch (e) {
    if (e.httpCode !== 404) throw e; // manifest が入る前に main から分かれたブランチ
  }
  // manifest が無い、または旧形式 (approved/* タグ時代、dest が 成果物/ 始まり) のブランチは main の manifest で代える
  if (!manifest || isLegacyManifest_(manifest)) {
    manifest = loadManifest_(cfg, mainHead_(cfg));
    if (isLegacyManifest_(manifest)) throw new Error("manifest on " + cfg.base + " is in the old format (has mode)");
  }
  const files = listPullFiles_(cfg, pr.number)
    .filter(f => f.status !== "removed")
    .map(f => ({ path: f.filename, sha: f.sha }));
  return expandTargets_(manifest.entries, files, false);
}

function loadManifest_(cfg, sha) {
  const manifest = JSON.parse(stripJsonComments_(rawFetch_(cfg, sha, cfg.manifestPath).getContentText("UTF-8")));
  if (!Array.isArray(manifest.entries)) throw new Error("manifest.entries must be an array");
  return manifest;
}

// 旧形式は mode を持ち、dest が DRIVE_FOLDER_ID からの相対パス (成果物/ 始まり) になっている
function isLegacyManifest_(manifest) {
  return Object.prototype.hasOwnProperty.call(manifest, "mode");
}

// manifest のエントリを同期対象 {path, blob, asDoc, destDir, destName} に展開する (src の重複は先勝ち)
// strict: exact な src が files に無ければエラー、glob が 0 件なら警告 (main 用)
function expandTargets_(entries, files, strict) {
  const blobOf = {};
  files.forEach(f => { blobOf[f.path] = f.sha; });
  const paths = Object.keys(blobOf).sort();
  const seen = {};
  const destSeen = {};
  const targets = [];
  entries.forEach(entry => {
    if (!entry.src || entry.dest === undefined) throw new Error("Manifest entry needs src and dest: " + JSON.stringify(entry));
    const convert = entry.convert || "none";
    if (convert !== "none" && convert !== "gdoc") throw new Error("Unknown convert: " + convert);
    const isGlob = entry.src.indexOf("*") >= 0;
    const dirForm = isGlob || /\/$/.test(entry.dest);
    let matched;
    if (isGlob) {
      const re = globToRegExp_(entry.src);
      matched = paths.filter(p => re.test(p));
      if (strict && !matched.length) Logger.log("WARNING: glob matched nothing: " + entry.src);
    } else {
      matched = Object.prototype.hasOwnProperty.call(blobOf, entry.src) ? [entry.src] : [];
      if (strict && !matched.length) throw new Error("Path not found: " + entry.src);
    }
    // glob の固定部分 (最初の * より前の、最後の / まで)。** の下位パスは dest 配下に保つ
    const fixedPrefix = isGlob ? entry.src.slice(0, entry.src.indexOf("*")).replace(/[^/]*$/, "") : "";
    matched.forEach(p => {
      if (seen[p]) return;
      seen[p] = true;
      const base = p.split("/").pop();
      const asDoc = convert === "gdoc" && /\.md$/.test(base);
      let destDir, destName;
      if (dirForm) {
        const sub = isGlob ? p.slice(fixedPrefix.length) : base;
        const subParts = sub.split("/");
        const subBase = subParts.pop();
        destDir = joinPath_(entry.dest.replace(/\/$/, ""), subParts.join("/"));
        destName = asDoc ? subBase.replace(/\.md$/, "") : subBase;
      } else {
        const dp = entry.dest.split("/");
        destName = dp.pop();
        destDir = dp.join("/");
      }
      const key = joinPath_(destDir, destName);
      if (destSeen[key]) throw new Error("Destination clash: " + key + " <- " + destSeen[key] + " and " + p);
      destSeen[key] = p;
      targets.push({ path: p, blob: blobOf[p], asDoc: asDoc, destDir: destDir, destName: destName });
    });
  });
  return targets;
}

// ---------------------------------------------------------------- Drive への反映

// folderId 配下を targets に合わせる。内容 (blob SHA) が同じファイルは触らない。
// script が置いたもののうち対象から外れたものはゴミ箱へ移す。人が置いたものは更新も削除もしない。
function syncFolder_(cfg, sha, folderId, targets, label, deadline) {
  const items = listTree_(folderId);
  const dirIds = {}; // 相対パス → フォルダ ID。誰が作ったフォルダでも再利用する
  const files = {};  // 相対パス → script が置いたファイル
  items.forEach(it => {
    if (it.isFolder) {
      if (!dirIds[it.path]) dirIds[it.path] = it.id;
    } else if (isManaged_(it) && !files[it.path]) {
      files[it.path] = it;
    }
  });

  const want = {};
  targets.forEach(t => { want[destKey_(t)] = true; });
  const stats = { created: 0, updated: 0, unchanged: 0, trashed: 0, complete: true };
  const trashed = {};

  for (let i = 0; i < targets.length; i++) {
    if (Date.now() > deadline) {
      stats.complete = false;
      break;
    }
    const t = targets[i];
    let ex = files[destKey_(t)];
    // convert が変わった場合、Google Docs と通常のファイルは相互に差し替えられないので作り直す
    if (ex && (ex.mimeType === DOC_MIME) !== t.asDoc) {
      trash_(ex.id);
      trashed[ex.id] = true;
      stats.trashed++;
      ex = null;
    }
    if (ex && t.blob && ex.properties.kinchanBlob === t.blob) {
      stats.unchanged++;
      continue;
    }
    const meta = { description: label + " " + t.path, properties: { kinchanManaged: "1", kinchanBlob: t.blob || "" } };
    const blob = fetchBlob_(cfg, sha, t);
    if (ex) {
      // 既存ファイルの内容を差し替える (URL と版履歴を保つ)
      Drive.Files.update(meta, ex.id, blob, DRIVE_OPTS);
      stats.updated++;
    } else {
      meta.name = t.destName;
      meta.parents = [ensureDir_(folderId, t.destDir, dirIds)];
      if (t.asDoc) meta.mimeType = DOC_MIME;
      Drive.Files.create(meta, blob, DRIVE_OPTS);
      stats.created++;
    }
  }
  if (!stats.complete) return stats; // 片付けは全ファイルを置き終えてから行う

  const keep = {}; // 中身が残るフォルダの相対パス
  const keepDir = p => {
    const segs = p.split("/").filter(s => s);
    for (let i = 1; i <= segs.length; i++) keep[segs.slice(0, i).join("/")] = true;
  };
  Object.keys(want).forEach(k => keepDir(dirOf_(k)));

  // ファイル: 対象のもの、人が置いたものは残す。それ以外 (script が置いて対象から外れたもの、同じパスの重複) はゴミ箱へ
  items.forEach(it => {
    if (it.isFolder || trashed[it.id]) return;
    if (!isManaged_(it) || (want[it.path] && files[it.path] === it)) {
      keepDir(dirOf_(it.path));
      return;
    }
    trash_(it.id);
    stats.trashed++;
  });
  // フォルダ: 深い順に見て、script が作り、中身が残らないものをゴミ箱へ
  items.filter(it => it.isFolder)
    .sort((a, b) => depth_(b.path) - depth_(a.path))
    .forEach(it => {
      if (!isManaged_(it)) {
        keepDir(it.path);
        return;
      }
      if (keep[it.path]) return;
      trash_(it.id);
      stats.trashed++;
    });
  return stats;
}

// script が置いたものか。appProperties.approvedTag は approved/* タグで納品していた旧版の印
function isManaged_(it) {
  return it.properties.kinchanManaged === "1" || !!it.appProperties.approvedTag;
}

function fetchBlob_(cfg, sha, t) {
  const res = rawFetch_(cfg, sha, t.path);
  const base = t.path.split("/").pop();
  return t.asDoc
    ? Utilities.newBlob(res.getContentText("UTF-8"), "text/markdown", base)
    : Utilities.newBlob(res.getContent(), guessMime_(base), base);
}

// 起点フォルダ配下を幅優先でたどり、{id, name, mimeType, properties, appProperties, path, isFolder} の配列を返す
function listTree_(rootId) {
  const items = [];
  const queue = [{ id: rootId, path: "" }];
  while (queue.length) {
    const dir = queue.shift();
    listChildren_(dir.id).forEach(f => {
      const it = {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        properties: f.properties || {},
        appProperties: f.appProperties || {},
        path: joinPath_(dir.path, f.name),
        isFolder: f.mimeType === FOLDER_MIME
      };
      items.push(it);
      if (it.isFolder) queue.push({ id: it.id, path: it.path });
    });
  }
  return items;
}

function listChildren_(parentId, foldersOnly) {
  let q = "'" + parentId + "' in parents and trashed = false";
  if (foldersOnly) q += " and mimeType = '" + FOLDER_MIME + "'";
  const out = [];
  let pageToken = null;
  do {
    const args = {
      q: q,
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: "nextPageToken, files(id,name,mimeType,properties,appProperties)"
    };
    if (pageToken) args.pageToken = pageToken;
    const res = Drive.Files.list(args);
    (res.files || []).forEach(f => out.push(f));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

// PR-成果物/ 直下のフォルダを properties.kinchanPr で引く。kinchanPr の無いフォルダ (人が作ったもの) は扱わない
function listPrFolders_(prRootId) {
  const byPr = {};
  const duplicates = [];
  listChildren_(prRootId, true).forEach(f => {
    const num = f.properties && f.properties.kinchanPr;
    if (!num) return;
    const folder = { id: f.id, name: f.name, properties: f.properties };
    if (byPr[num]) duplicates.push(folder);
    else byPr[num] = folder;
  });
  return { byPr: byPr, duplicates: duplicates };
}

function findFolder_(parentId, name) {
  const q = "'" + parentId + "' in parents and name = '" + name.replace(/\\/g, "\\\\").replace(/'/g, "\\'") +
    "' and mimeType = '" + FOLDER_MIME + "' and trashed = false";
  const res = Drive.Files.list({
    q: q,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: "files(id,name,properties)"
  });
  const f = res.files && res.files[0];
  return f ? { id: f.id, name: f.name, properties: f.properties || {} } : null;
}

function findOrCreateFolder_(parentId, name) {
  return findFolder_(parentId, name) || { id: createFolder_(parentId, name), name: name, properties: {} };
}

function createFolder_(parentId, name, properties, description) {
  const meta = { name: name, mimeType: FOLDER_MIME, parents: [parentId] };
  if (properties) meta.properties = properties;
  if (description) meta.description = description;
  return Drive.Files.create(meta, null, DRIVE_OPTS).id;
}

// "a/b/c" 形式の相対ディレクトリを入れ子で用意し、末端の ID を返す。新しく作るフォルダには印を付ける
function ensureDir_(rootId, relDir, dirIds) {
  let path = "";
  let id = rootId;
  relDir.split("/").filter(s => s).forEach(seg => {
    path = joinPath_(path, seg);
    if (!dirIds[path]) dirIds[path] = createFolder_(id, seg, { kinchanManaged: "1" });
    id = dirIds[path];
  });
  return id;
}

function setProps_(id, properties) {
  Drive.Files.update({ properties: properties }, id, null, DRIVE_OPTS);
}

// ゴミ箱へ移す (完全には削除しない。共有ドライブのゴミ箱から 30 日間は戻せる)
function trash_(id) {
  Drive.Files.update({ trashed: true }, id, null, DRIVE_OPTS);
}

function trashFolder_(folder, reason) {
  trash_(folder.id);
  Logger.log("trashed: " + folder.name + " (" + reason + ")");
}

// ---------------------------------------------------------------- GitHub

function mainHead_(cfg) {
  return ghJson_(cfg, "/git/ref/heads/" + cfg.base).object.sha;
}

function listOpenPulls_(cfg) {
  return ghPaged_(cfg, "/pulls?state=open&base=" + encodeURIComponent(cfg.base), 10);
}

// 1 PR あたり最大 3000 ファイル (GitHub API の上限)
function listPullFiles_(cfg, number) {
  return ghPaged_(cfg, "/pulls/" + number + "/files", 30);
}

function ghJson_(cfg, path) {
  return JSON.parse(githubFetch_("https://api.github.com/repos/" + cfg.repo + path).getContentText());
}

// 100 件ずつページングして全件を返す
function ghPaged_(cfg, path, maxPages) {
  const out = [];
  const sep = path.indexOf("?") >= 0 ? "&" : "?";
  for (let page = 1; page <= maxPages; page++) {
    const items = ghJson_(cfg, path + sep + "per_page=100&page=" + page);
    items.forEach(x => out.push(x));
    if (items.length < 100) return out;
  }
  throw new Error("Too many items: " + path);
}

// GitHub への HTTP 呼び出し。GITHUB_TOKEN は必須 (raw=true では Accept を付けない)
function githubFetch_(url, opts) {
  const raw = opts && opts.raw;
  const headers = { "User-Agent": "kinchan-drive-delivery" };
  if (!raw) headers["Accept"] = "application/vnd.github+json";
  // 認証なしの上限 (送信元 IP ごとに 60 回/時) は GAS では他の利用者と共有され、すぐに尽きる
  headers["Authorization"] = "Bearer " + prop_("GITHUB_TOKEN", null, true);
  const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    const err = new Error("HTTP " + code + " for " + url + describeGithubError_(res));
    err.httpCode = code;
    throw err;
  }
  return res;
}

// エラー応答から原因の手がかり (GitHub の message、rate limit の上限と回復時刻) を取り出す
function describeGithubError_(res) {
  const h = {};
  const raw = res.getHeaders() || {};
  Object.keys(raw).forEach(k => { h[k.toLowerCase()] = String(raw[k]); });
  const parts = [];
  const body = res.getContentText();
  let msg;
  try {
    msg = JSON.parse(body).message;
  } catch (e) {
    msg = body.slice(0, 200);
  }
  if (msg) parts.push(msg);
  if (h["x-ratelimit-remaining"] === "0") {
    const reset = new Date(Number(h["x-ratelimit-reset"]) * 1000);
    parts.push("rate limit " + h["x-ratelimit-limit"] + "/h exhausted until " + Utilities.formatDate(reset, "Asia/Tokyo", "HH:mm") + " JST");
  }
  return parts.length ? " (" + parts.join("; ") + ")" : "";
}

// raw.githubusercontent.com から指定コミットのファイルを取得
function rawFetch_(cfg, sha, path) {
  const enc = path.split("/").map(encodeURIComponent).join("/");
  return githubFetch_("https://raw.githubusercontent.com/" + cfg.repo + "/" + sha + "/" + enc, { raw: true });
}

// ---------------------------------------------------------------- 小物

// 行頭が // の行を取り除く (manifest のコメント用)
function stripJsonComments_(text) {
  return text.split("\n").filter(line => !/^\s*\/\//.test(line)).join("\n");
}

// パスを / で連結 (空要素は飛ばす)
function joinPath_(a, b) {
  return [a, b].filter(x => x).join("/");
}

function destKey_(t) {
  return joinPath_(t.destDir, t.destName);
}

function dirOf_(path) {
  return path.replace(/\/?[^/]*$/, "");
}

function depth_(path) {
  return path.split("/").length;
}

// glob を正規表現へ変換 (* は同一セグメント、** はセグメント跨ぎ)
function globToRegExp_(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; } else { re += "[^/]*"; }
    } else {
      re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + re + "$");
}

function guessMime_(name) {
  const ext = (name.match(/\.([^.]+)$/) || [])[1];
  const map = { md: "text/markdown", svg: "image/svg+xml", png: "image/png", json: "application/json" };
  return map[(ext || "").toLowerCase()] || "application/octet-stream";
}
