// MolAstria desktop: serves public/ from inside the app and opens outside links in the system browser.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
