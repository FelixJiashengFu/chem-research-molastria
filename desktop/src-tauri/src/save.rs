//! Downloads in the desktop app: every download a page starts opens the system Save dialog.
//!
//! The app sets no download handler, so WebView2 (Windows) silently drops downloads into the
//! Downloads folder and WKWebView (macOS) does nothing; either way the button looks dead.
//! SCRIPT runs in every frame, catches `<a download>` clicks (including `a.click()` on an anchor that
//! was never added to the page), reads the bytes of the blob:, data: or in-app URL and hands them to
//! `save_download`. The page sends only the bytes and a suggested name: the folder and the final
//! name come from the system dialog alone, so a page cannot choose where anything is written.
use std::sync::atomic::{AtomicBool, Ordering};

use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request};
use tauri::{State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

/// shortcut: the file is held in memory twice (page and app); raise the cap or stream it in chunks
/// if a page ever needs to save files this large (the biggest today is a merged preprint PDF).
pub const MAX_BYTES: usize = 256 * 1024 * 1024;
/// Most file systems allow 255 bytes per name; leave room for the " (2)" a user might add.
const MAX_NAME_BYTES: usize = 200;

pub const SCRIPT: &str = r#"
(() => {
  let tauri = null;
  try { tauri = window.__TAURI_INTERNALS__ || window.top.__TAURI_INTERNALS__; } catch {}
  if (!tauri || !tauri.invoke) return; // a frame from another site: leave it alone
  const MAX = 256 * 1024 * 1024;
  const topDoc = () => { try { return window.top.document; } catch { return document; } };
  const en = () => topDoc().documentElement.lang === 'en';
  const toast = (text, bad) => {
    const doc = topDoc();
    let el = doc.getElementById('molastria-save-toast');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'molastria-save-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('translate', 'no');
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:min(560px,90vw);padding:10px 16px;border-radius:10px;background:var(--surface,#fdfcf8);border:1px solid var(--line,#d8dfd2);box-shadow:var(--shadow,0 10px 28px rgb(28 58 47/.12));font:14px/1.5 var(--font-sans,system-ui,sans-serif);overflow-wrap:anywhere;pointer-events:none;transition:opacity .2s';
      doc.body.append(el);
    }
    el.textContent = text;
    el.style.color = bad ? 'var(--danger,#a5402d)' : 'var(--ink,#1c3a2f)';
    el.style.opacity = '1';
    clearTimeout(el.hideTimer);
    el.hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
  };
  // Only downloads the page asked for, of bytes it already has: blob:, data: or a file inside the app.
  const wanted = (a) => {
    if (!a.hasAttribute('download') || !a.hasAttribute('href')) return null;
    let u;
    try { u = new URL(a.getAttribute('href'), a.baseURI); } catch { return null; }
    const own = u.protocol === location.protocol && u.host === location.host;
    return own || u.protocol === 'blob:' || u.protocol === 'data:' ? u : null;
  };
  const nameOf = (a, u) => {
    const given = a.getAttribute('download');
    if (given) return given;
    if (u.protocol === 'blob:' || u.protocol === 'data:') return '';
    try { return decodeURIComponent(u.pathname.split('/').pop()); } catch { return ''; }
  };
  let busy = false;
  const save = async (url, name) => {
    if (busy) return; // a double click, or a second button while the dialog is open
    busy = true;
    try {
      const res = await fetch(url); // started before any await, so a page revoking its blob URL later is fine
      if (!res.ok) throw new Error('http-' + res.status);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX) throw new Error('too-large');
      const saved = await tauri.invoke('save_download', bytes, { headers: { 'x-name': encodeURIComponent(name) } });
      if (saved) toast((en() ? 'Saved: ' : '已保存：') + saved);
    } catch (e) {
      const code = String((e && e.message) || e);
      if (code === 'busy') return;
      if (code === 'too-large') toast(en() ? 'The file is larger than 256 MB; the desktop app cannot save it.' : '文件超过 256 MB，桌面版无法保存。', true);
      else toast((en() ? 'Could not save the file: ' : '保存失败：') + code, true);
    } finally {
      busy = false;
    }
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    const u = a && wanted(a);
    if (!u) return;
    e.preventDefault();
    save(u.href, nameOf(a, u));
  }, true);
  // Pages that build an anchor and call a.click() without adding it to the page: no event reaches the document.
  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const u = !this.isConnected && wanted(this);
    if (u) { save(u.href, nameOf(this, u)); return; }
    return nativeClick.call(this);
  };
})();
"#;

/// Set while a Save dialog is open, so a second request cannot stack another dialog.
#[derive(Default)]
pub struct Saving(AtomicBool);

struct Release<'a>(&'a AtomicBool);

impl Drop for Release<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

/// Error codes are short; the page turns them into sentences.
fn check_size(len: usize) -> Result<(), String> {
    if len > MAX_BYTES { Err("too-large".into()) } else { Ok(()) }
}

/// Zero-width and direction-override characters can disguise an extension ("report\u{202E}fdp.exe").
fn invisible(c: char) -> bool {
    matches!(c, '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2060}'..='\u{2064}' | '\u{2066}'..='\u{2069}' | '\u{FEFF}')
}

/// The page's suggested name, made safe to offer in the dialog: one path component, no characters
/// Windows or macOS refuse, no reserved device name, short enough for any file system.
pub fn clean_name(raw: &str) -> String {
    let last = raw.rsplit(['/', '\\']).next().unwrap_or("");
    let replaced: String = last
        .chars()
        .filter(|c| !invisible(*c))
        .map(|c| if c.is_control() || "<>:\"|?*".contains(c) { '_' } else { c })
        .collect();
    let trimmed = replaced.trim_matches(|c: char| c == '.' || c.is_whitespace());
    let mut name = if trimmed.is_empty() { "download".to_string() } else { trimmed.to_string() };
    let stem = name.split('.').next().unwrap_or("").trim_end().to_ascii_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT")) && stem.len() == 4 && stem.as_bytes()[3].is_ascii_digit());
    if reserved {
        name.insert(0, '_');
    }
    if name.len() > MAX_NAME_BYTES {
        let ext = extension(&name).map(|e| format!(".{e}")).unwrap_or_default();
        let mut stem = name[..name.len() - ext.len()].to_string();
        while stem.len() + ext.len() > MAX_NAME_BYTES {
            stem.pop();
        }
        name = format!("{}{ext}", stem.trim_end_matches(|c: char| c == '.' || c.is_whitespace()));
    }
    name
}

/// The extension used for the dialog's type filter: 1-10 ASCII letters or digits after the last dot.
pub fn extension(name: &str) -> Option<String> {
    let (stem, ext) = name.rsplit_once('.')?;
    let ok = !stem.is_empty() && (1..=10).contains(&ext.len()) && ext.chars().all(|c| c.is_ascii_alphanumeric());
    ok.then(|| ext.to_ascii_lowercase())
}

/// Shows the Save dialog for bytes a page sent and writes them unchanged to the path the user picked.
/// Returns the saved file's name, or None when the user cancelled (nothing is written then).
#[tauri::command]
pub async fn save_download(window: WebviewWindow, saving: State<'_, Saving>, request: Request<'_>) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("bad-body".into());
    };
    check_size(bytes.len())?;
    let raw = request.headers().get("x-name").and_then(|v| v.to_str().ok()).unwrap_or("");
    let name = clean_name(&percent_decode_str(raw).decode_utf8_lossy());
    if saving.0.swap(true, Ordering::AcqRel) {
        return Err("busy".into());
    }
    let _release = Release(&saving.0);
    let mut dialog = window.dialog().file().set_parent(&window).set_file_name(&name);
    if let Some(ext) = extension(&name) {
        dialog = dialog.add_filter(format!("{} (*.{ext})", ext.to_ascii_uppercase()), &[ext.as_str()]);
    }
    let Some(path) = tauri::async_runtime::spawn_blocking(move || dialog.blocking_save_file()).await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| format!("write-failed: {e}"))?;
    Ok(Some(path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(name)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_ordinary_names() {
        assert_eq!(clean_name("chemdb-agent.zip"), "chemdb-agent.zip");
        assert_eq!(clean_name("ChemDB-资源目录.csv"), "ChemDB-资源目录.csv");
        assert_eq!(clean_name("O_C1OCC_F_O1_uma-s_ipea.xyz"), "O_C1OCC_F_O1_uma-s_ipea.xyz");
        assert_eq!(clean_name("2026-11-06 3 preprints.pdf"), "2026-11-06 3 preprints.pdf");
    }

    #[test]
    fn strips_paths_and_bad_characters() {
        assert_eq!(clean_name("../../etc/passwd"), "passwd");
        assert_eq!(clean_name("C:\\Windows\\System32\\evil.dll"), "evil.dll");
        assert_eq!(clean_name("a<b>c:d\"e|f?g*h.txt"), "a_b_c_d_e_f_g_h.txt");
        assert_eq!(clean_name("line\nbreak\t.csv"), "line_break_.csv");
        assert_eq!(clean_name("report\u{202E}fdp.exe"), "reportfdp.exe");
        assert_eq!(clean_name("  .hidden.json. "), "hidden.json");
        assert_eq!(clean_name(""), "download");
        assert_eq!(clean_name("..."), "download");
        assert_eq!(clean_name("dir/"), "download");
    }

    #[test]
    fn avoids_reserved_windows_names() {
        assert_eq!(clean_name("CON"), "_CON");
        assert_eq!(clean_name("nul.txt"), "_nul.txt");
        assert_eq!(clean_name("com1.csv"), "_com1.csv");
        assert_eq!(clean_name("console.csv"), "console.csv");
        assert_eq!(clean_name("com10.csv"), "com10.csv");
    }

    #[test]
    fn shortens_long_names_and_keeps_the_extension() {
        let long = format!("{}.xyz", "分子".repeat(100)); // 600 bytes of stem
        let name = clean_name(&long);
        assert!(name.len() <= MAX_NAME_BYTES, "{} bytes", name.len());
        assert!(name.ends_with(".xyz"));
        assert!(name.starts_with("分子分子"));
    }

    #[test]
    fn picks_the_filter_extension() {
        assert_eq!(extension("chemdb-agent.zip").as_deref(), Some("zip"));
        assert_eq!(extension("Report.CSV").as_deref(), Some("csv"));
        assert_eq!(extension("archive.tar.gz").as_deref(), Some("gz"));
        assert_eq!(extension("download"), None);
        assert_eq!(extension(".bashrc"), None);
        assert_eq!(extension("a.b c"), None);
    }

    #[test]
    fn caps_the_size() {
        assert!(check_size(0).is_ok());
        assert!(check_size(MAX_BYTES).is_ok());
        assert_eq!(check_size(MAX_BYTES + 1), Err("too-large".to_string()));
    }

    #[test]
    fn one_dialog_at_a_time() {
        let saving = Saving::default();
        assert!(!saving.0.swap(true, Ordering::AcqRel));
        {
            let _release = Release(&saving.0);
            assert!(saving.0.swap(true, Ordering::AcqRel)); // a second request while the first is open is refused
        }
        assert!(!saving.0.load(Ordering::Acquire)); // released when the first request ends, even on an error path
    }
}
