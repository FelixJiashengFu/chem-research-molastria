// MolAstria desktop: serves public/ from inside the app, opens outside links in the system browser,
// and installs signed updates published on GitHub Releases.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Runs on every page before the site's own scripts.
/// External http(s) links and window.open() calls go to the default browser (checkout, papers, docs);
/// in-app pages keep navigating inside the window.
const INIT_SCRIPT: &str = r#"
(() => {
  window.__MOLASTRIA_DESKTOP__ = true;
  const external = (href) => {
    try {
      const u = new URL(href, location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== location.origin && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1' ? u.href : null;
    } catch { return null; }
  };
  const openOutside = (url) => window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url', { url });
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    const url = external(a.getAttribute('href'));
    if (url) { e.preventDefault(); openOutside(url); }
  }, true);
  const nativeOpen = window.open;
  window.open = function (href, ...rest) {
    const url = href ? external(String(href)) : null;
    if (url) { openOutside(url); return null; }
    return nativeOpen.call(window, href, ...rest);
  };
})();
"#;

/// The update found by the last check, kept so any page can install it.
#[derive(Default)]
struct PendingUpdate(Mutex<Option<Update>>);

/// Bytes downloaded so far and the expected total (0 = unknown), polled by the page during an install.
#[derive(Default)]
struct Progress {
    done: AtomicU64,
    total: AtomicU64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    version: String,
    current_version: String,
    notes: Option<String>,
}

/// Reads latest.json from the release feed; returns the newer version, if there is one.
#[tauri::command]
async fn check_update(app: AppHandle, pending: State<'_, PendingUpdate>) -> Result<Option<UpdateInfo>, String> {
    let update = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
    });
    *pending.0.lock().unwrap() = update;
    Ok(info)
}

/// Downloads the pending update, checks its signature, installs it and restarts the app.
/// On Windows the installer closes the app itself and starts the new version when it finishes.
#[tauri::command]
async fn install_update(app: AppHandle, pending: State<'_, PendingUpdate>) -> Result<(), String> {
    let update = pending.0.lock().unwrap().clone().ok_or("no update is pending")?;
    let progress = app.state::<Progress>();
    progress.done.store(0, Ordering::Relaxed);
    progress.total.store(0, Ordering::Relaxed);
    let handle = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                let p = handle.state::<Progress>();
                p.done.fetch_add(chunk as u64, Ordering::Relaxed);
                if let Some(t) = total {
                    p.total.store(t, Ordering::Relaxed);
                }
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

#[tauri::command]
fn update_progress(progress: State<'_, Progress>) -> (u64, u64) {
    (progress.done.load(Ordering::Relaxed), progress.total.load(Ordering::Relaxed))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingUpdate::default())
        .manage(Progress::default())
        .invoke_handler(tauri::generate_handler![check_update, install_update, update_progress])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("MolAstria")
                .inner_size(1320.0, 880.0)
                .min_inner_size(900.0, 600.0)
                .initialization_script(INIT_SCRIPT)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MolAstria");
}
