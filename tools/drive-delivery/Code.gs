// GitHub の approved/* タグを検知し、承認済み資料を共有ドライブへ配信する Apps Script

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";

// スクリプトプロパティ取得（既定値あり、required 指定時は未設定でエラー）
function prop_(key, def, required) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (v) return v;
  if (required) throw new Error("Script property not set: " + key);
  return def;
}

function getProcessed_() {
  return JSON.parse(prop_("PROCESSED_TAGS", "[]"));
}

function markProcessed_(tag) {
  const list = getProcessed_();
  if (list.indexOf(tag) < 0) list.push(tag);
  PropertiesService.getScriptProperties().setProperty("PROCESSED_TAGS", JSON.stringify(list));
}

// 30分ごとの poll トリガーを作り直す
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "poll")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("poll").timeBased().everyMinutes(30).create();
  Logger.log("trigger installed: poll every 30 minutes");
}

// 未配信の approved/* タグを昇順に配信するメイン処理
function poll() {
  const repo = prop_("GITHUB_REPO", null, true);
  const prefix = prop_("TAG_PREFIX", "approved/");
  const res = githubFetch_("https://api.github.com/repos/" + repo + "/git/matching-refs/tags/" + prefix);
  const done = getProcessed_();
  const tags = JSON.parse(res.getContentText())
    .map(r => r.ref.replace(/^refs\/tags\//, ""))
    .filter(t => done.indexOf(t) < 0)
    .sort();
  Logger.log("new tags: " + JSON.stringify(tags));
  tags.forEach(tag => {
    try {
      deliverTag(tag);
      markProcessed_(tag);
    } catch (e) {
      Logger.log("delivery failed for " + tag + ": " + e);
      throw e; // 失敗通知を発火させる（処理済みにしない）
    }
  });
}

// manifest 読み込み（先頭が // の行はコメントとして除去）
function parseManifest_(text) {
  return JSON.parse(text.split("\n").filter(l => l.trim().indexOf("//") !== 0).join("\n"));
}

// entries を {src, destPath, convert} のリストへ展開（src 重複は先勝ち）
function expandEntries_(entries, blobs) {
  const seen = {};
  const out = [];
  entries.forEach(e => {
    const convert = e.convert || "none";
    const dest = e.dest || "";
    const isGlob = e.src.indexOf("*") >= 0;
    let paths;
    if (isGlob) {
      const re = globToRegExp_(e.src);
      paths = blobs.filter(p => re.test(p));
      if (!paths.length) Logger.log("WARNING: glob matched nothing: " + e.src);
    } else {
      if (blobs.indexOf(e.src) < 0) throw new Error("Path not found in tree: " + e.src);
      paths = [e.src];
    }
    const dirForm = isGlob || /\/$/.test(dest);
    // ** の場合は最初のワイルドカードより前のディレクトリ部分を基準にサブパスを保つ
    const fixed = e.src.slice(0, e.src.indexOf("*") < 0 ? 0 : e.src.indexOf("*"));
    const prefix = fixed.slice(0, fixed.lastIndexOf("/") + 1);
    paths.forEach(p => {
      if (seen[p]) return;
      seen[p] = true;
      let destPath = dest;
      if (dirForm) {
        const dir = dest && !/\/$/.test(dest) ? dest + "/" : dest;
        let rel = e.src.indexOf("**") >= 0 ? p.slice(prefix.length) : p.split("/").pop();
        if (convert === "gdoc" && /\.md$/.test(rel)) rel = rel.replace(/\.md$/, "");
        destPath = dir + rel;
      }
      out.push({ src: p, destPath: destPath, convert: convert });
    });
  });
  return out;
}

// 1タグ分の配信: SHA 解決 → manifest 取得 → エントリ展開 → アップロード
function deliverTag(tagName) {
  const repo = prop_("GITHUB_REPO", null, true);
  const rootId = prop_("DRIVE_FOLDER_ID", null, true);
  const manifestPath = prop_("MANIFEST_PATH", "tools/drive-delivery/manifest.json");
  const api = "https://api.github.com/repos/" + repo;

  // 1. タグからコミット SHA を解決（annotated tag は一段辿る）
  const ref = JSON.parse(githubFetch_(api + "/git/ref/tags/" + tagName).getContentText());
  let sha = ref.object.sha;
  if (ref.object.type === "tag") {
    sha = JSON.parse(githubFetch_(api + "/git/tags/" + sha).getContentText()).object.sha;
  }
  const sha7 = sha.slice(0, 7);

  // 2. manifest を当該コミットから取得（行頭 // のコメント行は除去）
  const manifest = JSON.parse(stripJsonComments_(rawFetch_(repo, sha, manifestPath).getContentText("UTF-8")));
  const mode = manifest.mode || "update";
  if (mode !== "update" && mode !== "snapshot") throw new Error("Unknown manifest.mode: " + mode);
  if (!Array.isArray(manifest.entries)) throw new Error("manifest.entries must be an array");

  // 3. ツリー取得
  const tree = JSON.parse(githubFetch_(api + "/git/trees/" + sha + "?recursive=1").getContentText());
  if (tree.truncated) Logger.log("WARNING: git tree is truncated; some files may be missing");
  const blobs = tree.tree.filter(n => n.type === "blob").map(n => n.path);

  // 4. エントリを配信対象 {path, asDoc, destDir, destName, rawName} に展開（src の重複は先勝ち）
  const seen = {};
  const targets = [];
  manifest.entries.forEach(entry => {
    if (!entry.src || entry.dest === undefined) throw new Error("Manifest entry needs src and dest: " + JSON.stringify(entry));
    const convert = entry.convert || "none";
    const isGlob = entry.src.indexOf("*") >= 0;
    const dirForm = isGlob || /\/$/.test(entry.dest);
    let paths;
    if (isGlob) {
      const re = globToRegExp_(entry.src);
      paths = blobs.filter(p => re.test(p));
      if (!paths.length) Logger.log("WARNING: glob matched nothing: " + entry.src);
    } else {
      if (blobs.indexOf(entry.src) < 0) throw new Error("Path not found at " + sha7 + ": " + entry.src);
      paths = [entry.src];
    }
    // glob の固定部分（最初の * より前の、最後の / まで）。** の下位パスは dest 配下に保つ
    const fixedPrefix = isGlob ? entry.src.slice(0, entry.src.indexOf("*")).replace(/[^/]*$/, "") : "";
    paths.forEach(p => {
      if (seen[p]) return;
      seen[p] = true;
      const base = p.split("/").pop();
      const asDoc = convert === "gdoc" && /\.md$/.test(base);
      let destDir, destName, rawName;
      if (dirForm) {
        const sub = isGlob ? p.slice(fixedPrefix.length) : base;
        const subParts = sub.split("/");
        rawName = subParts.pop();
        destDir = joinPath_(entry.dest.replace(/\/$/, ""), subParts.join("/"));
        destName = asDoc ? rawName.replace(/\.md$/, "") : rawName;
      } else {
        const dp = entry.dest.split("/");
        destName = dp.pop();
        rawName = destName;
        destDir = dp.join("/");
      }
      targets.push({ path: p, asDoc: asDoc, destDir: destDir, destName: destName, rawName: rawName });
    });
  });

  // 5. 配信先の基点: update は指定フォルダ直下、snapshot はタグ名のフォルダ
  const baseId = mode === "snapshot" ? findOrCreateFolder_(rootId, tagName.replace(/\//g, "-")) : rootId;
  const meta = { description: tagName + " " + sha7, appProperties: { approvedTag: tagName, commit: sha } };

  // 6. 各ファイルを配置（update: 既存は内容を差し替え / snapshot: 既存はスキップ）
  let created = 0, updated = 0, skipped = 0;
  targets.forEach(t => {
    const folderId = ensurePath_(baseId, t.destDir);
    const existing = findFile_(folderId, t.destName);
    if (existing && mode === "snapshot") {
      Logger.log("skip (exists): " + joinPath_(t.destDir, t.destName));
      skipped++;
      return;
    }
    const res = rawFetch_(repo, sha, t.path);
    const base = t.path.split("/").pop();
    const blob = t.asDoc
      ? Utilities.newBlob(res.getContentText("UTF-8"), "text/markdown", base)
      : Utilities.newBlob(res.getContent(), guessMime_(base), base);

    if (existing) {
      try {
        Drive.Files.update(meta, existing.id, blob, { supportsAllDrives: true });
        Logger.log("updated: " + joinPath_(t.destDir, t.destName));
        updated++;
        return;
      } catch (e) {
        Logger.log("WARNING: update failed for " + t.path + ", creating new and trashing old: " + e);
      }
    }

    const resource = Object.assign({ name: t.destName, parents: [folderId] }, meta);
    let done = false;
    if (t.asDoc) {
      try {
        Drive.Files.create(Object.assign({ mimeType: DOC_MIME }, resource), blob, { supportsAllDrives: true });
        done = true;
      } catch (e) {
        Logger.log("WARNING: gdoc conversion failed for " + t.path + ", uploading raw: " + e);
      }
    }
    if (!done) {
      resource.name = t.rawName;
      Drive.Files.create(resource, blob, { supportsAllDrives: true });
    }
    created++;
    if (existing) Drive.Files.update({ trashed: true }, existing.id, null, { supportsAllDrives: true });
    Logger.log("created: " + joinPath_(t.destDir, resource.name));
  });

  // 7. サマリ
  Logger.log("delivered " + tagName + " @" + sha7 + " mode=" + mode + ": created=" + created + " updated=" + updated + " skipped=" + skipped);
}

// 手動: 最新タグを PROCESSED_TAGS に関係なく配信
function deliverLatest() {
  const repo = prop_("GITHUB_REPO", null, true);
  const prefix = prop_("TAG_PREFIX", "approved/");
  const res = githubFetch_("https://api.github.com/repos/" + repo + "/git/matching-refs/tags/" + prefix);
  const tags = JSON.parse(res.getContentText()).map(r => r.ref.replace(/^refs\/tags\//, "")).sort();
  if (!tags.length) throw new Error("No tags with prefix " + prefix);
  const latest = tags[tags.length - 1];
  deliverTag(latest);
  markProcessed_(latest);
}

// 配信済みタグの記録を消去
function resetProcessed() {
  PropertiesService.getScriptProperties().deleteProperty("PROCESSED_TAGS");
  Logger.log("PROCESSED_TAGS cleared");
}

// Markdown → Docs のインポート対応を確認
function checkImportFormats() {
  const formats = Drive.About.get({ fields: "importFormats" }).importFormats || {};
  Logger.log("text/markdown import: " + (formats["text/markdown"] ? JSON.stringify(formats["text/markdown"]) : "NOT supported"));
}

// GitHub API 呼び出し（raw=true で Accept/Authorization を付けない）
function githubFetch_(url, opts) {
  const raw = opts && opts.raw;
  const headers = { "User-Agent": "kinchan-drive-delivery" };
  if (!raw) {
    headers["Accept"] = "application/vnd.github+json";
    const token = prop_("GITHUB_TOKEN", "");
    if (token) headers["Authorization"] = "Bearer " + token;
  }
  const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("HTTP " + code + " for " + url);
  return res;
}

// raw.githubusercontent.com から指定コミットのファイルを取得
function rawFetch_(repo, sha, path) {
  const enc = path.split("/").map(encodeURIComponent).join("/");
  return githubFetch_("https://raw.githubusercontent.com/" + repo + "/" + sha + "/" + enc, { raw: true });
}

// 行頭が // の行を取り除く（manifest のコメント用）
function stripJsonComments_(text) {
  return text.split("\n").filter(line => !/^\s*\/\//.test(line)).join("\n");
}

// パスを / で連結（空要素は飛ばす）
function joinPath_(a, b) {
  return [a, b].filter(x => x).join("/");
}

// glob を正規表現へ変換（* は同一セグメント、** はセグメント跨ぎ）
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

// 親フォルダ直下の名前でファイルまたはフォルダを検索（なければ null）
function findFile_(parentId, name, mimeType) {
  let q = "'" + parentId + "' in parents and name = '" + name.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "' and trashed = false";
  if (mimeType) q += " and mimeType = '" + mimeType + "'";
  const res = Drive.Files.list({
    q: q,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: "files(id,name,mimeType)"
  });
  return res.files && res.files.length ? res.files[0] : null;
}

function findOrCreateFolder_(parentId, name) {
  const found = findFile_(parentId, name, FOLDER_MIME);
  if (found) return found.id;
  return Drive.Files.create({ name: name, mimeType: FOLDER_MIME, parents: [parentId] }, null, { supportsAllDrives: true }).id;
}

// "a/b/c" 形式の相対ディレクトリを入れ子で作成し、末端の ID を返す
function ensurePath_(rootId, relDir) {
  return relDir.split("/").filter(s => s).reduce((id, seg) => findOrCreateFolder_(id, seg), rootId);
}
