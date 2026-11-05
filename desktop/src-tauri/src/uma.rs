//! "Run on this computer" for the Meta page's UMA generator.
//!
//! The page only sends parameters (SMILES, job, model, …), which are checked here. The Python script is
//! compiled into the app (uma/runner.py), so nothing a page shows — AI output, release names — can make
//! the app run code of its choosing. The Python interpreter must be an absolute path to a python binary.
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

const RUNNER: &str = include_str!("../uma/runner.py");
const MAX_LINES: usize = 4000;

/// The one calculation that may run at a time, and its log.
#[derive(Default)]
pub struct Uma(Arc<Mutex<Run>>);

#[derive(Default)]
struct Run {
    lines: Vec<String>,
    /// Lines dropped from the front once the log passed MAX_LINES; indices stay absolute.
    dropped: usize,
    running: bool,
    exit: Option<i32>,
    child: Option<Child>,
    dir: Option<PathBuf>,
}

#[derive(Deserialize, Serialize)]
pub struct Params {
    smiles: String,
    name: String,
    job: String,
    model: String,
    device: String,
    charge: i32,
    spin: i32,
    #[serde(default)]
    with_m: bool,
}

#[derive(Serialize)]
pub struct Poll {
    /// Absolute index of the first returned line. The last line is re-sent on every poll because
    /// progress bars redraw it with carriage returns.
    from: usize,
    lines: Vec<String>,
    running: bool,
    exit: Option<i32>,
    dir: Option<String>,
}

/// Errors are short codes; the page turns them into sentences in the visitor's language.
fn check(p: &mut Params) -> Result<(), String> {
    let s = p.smiles.trim();
    if s.is_empty() || s.len() > 400 || !s.chars().all(|c| c.is_ascii_alphanumeric() || "@+-[]()=#$%/\\.:~*".contains(c)) {
        return Err("bad-smiles".into());
    }
    p.smiles = s.to_string();
    let name: String = p.name.chars().filter(|c| c.is_ascii_alphanumeric() || "_.-".contains(*c)).take(40).collect();
    p.name = if name.is_empty() || name.starts_with('.') { "molecule".into() } else { name };
    let ok = ["ipea", "opt", "conf", "md"].contains(&p.job.as_str())
        && ["uma-s-1p2p1", "uma-s-1p2p1-ft-d4rev", "uma-m-1p1"].contains(&p.model.as_str())
        && ["cuda", "cpu"].contains(&p.device.as_str())
        && (-4..=4).contains(&p.charge)
        && (1..=7).contains(&p.spin);
    if ok { Ok(()) } else { Err("bad-params".into()) }
}

/// An absolute path to an existing python / python3 / python3.N binary.
fn python_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path.trim());
    let file = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_ascii_lowercase();
    let stem = file.strip_suffix(".exe").unwrap_or(&file);
    let named = stem == "python" || stem == "python3" || stem.strip_prefix("python3.").is_some_and(|v| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit()));
    if p.is_absolute() && named && p.is_file() { Ok(p) } else { Err("bad-python".into()) }
}

/// Writes the built-in runner next to the app data and returns its path.
fn runner(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("uma");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("runner.py");
    std::fs::write(&file, RUNNER).map_err(|e| e.to_string())?;
    Ok(file)
}

fn command(program: &Path) -> Command {
    let mut c = Command::new(program);
    c.env("PYTHONIOENCODING", "utf-8").env("PYTHONUTF8", "1").env("PYTHONUNBUFFERED", "1").env("TQDM_MININTERVAL", "1");
    c.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: no console flashes up
    }
    c
}

/// Runs a short command and returns the "@@PROBE" JSON it prints, or None after the timeout.
fn probe_with(mut cmd: Command, timeout: Duration) -> Option<Value> {
    let mut child = cmd.spawn().ok()?;
    let mut out = child.stdout.take()?;
    let reader = thread::spawn(move || {
        let mut s = String::new();
        let _ = out.read_to_string(&mut s);
        s
    });
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() < timeout => thread::sleep(Duration::from_millis(100)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
        }
    }
    let text = reader.join().ok()?;
    let line = text.lines().find_map(|l| l.strip_prefix("@@PROBE "))?;
    serde_json::from_str(line).ok()
}

/// Pythons worth asking: the one the visitor added, the Windows launcher's list, PATH, and conda installs.
/// The macOS /usr/bin/python3 stub is skipped: it is too old for fairchem and may ask to install Xcode tools.
fn candidates(extra: Option<String>) -> Vec<(PathBuf, Vec<String>)> {
    let mut list: Vec<(PathBuf, Vec<String>)> = Vec::new();
    if let Some(p) = extra.as_deref().and_then(|p| python_path(p).ok()) {
        list.push((p, vec![]));
    }
    let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from);
    let mut conda_roots = Vec::new();
    if let Some(h) = &home {
        for d in ["miniconda3", "miniforge3", "anaconda3", "mambaforge"] {
            conda_roots.push(h.join(d));
        }
    }
    #[cfg(windows)]
    {
        if let Some(text) = command(Path::new("py")).arg("-0p").output().ok().map(|o| String::from_utf8_lossy(&o.stdout).into_owned()) {
            for line in text.lines() {
                // " -V:3.12 *        C:\Users\…\python.exe": the path starts at the drive letter.
                if let Some(p) = line.find(":\\").and_then(|i| line.get(i.checked_sub(1)?..)).map(|s| PathBuf::from(s.trim())) {
                    if p.is_file() {
                        list.push((p, vec![]));
                    }
                }
            }
        }
        for name in ["python", "python3"] {
            list.push((PathBuf::from(name), vec![]));
        }
        // python.org installers, per user and for all users; found even when PATH was not updated.
        let bases = [std::env::var_os("LOCALAPPDATA").map(|d| PathBuf::from(d).join("Programs").join("Python")), std::env::var_os("ProgramFiles").map(PathBuf::from)];
        for base in bases.into_iter().flatten() {
            if let Ok(dirs) = std::fs::read_dir(&base) {
                for d in dirs.flatten() {
                    if d.file_name().to_string_lossy().to_ascii_lowercase().starts_with("python3") {
                        list.push((d.path().join("python.exe"), vec![]));
                    }
                }
            }
        }
        for root in &conda_roots {
            list.push((root.join("python.exe"), vec![]));
            if let Ok(envs) = std::fs::read_dir(root.join("envs")) {
                for e in envs.flatten() {
                    list.push((e.path().join("python.exe"), vec![]));
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        for p in ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/Library/Frameworks/Python.framework/Versions/Current/bin/python3"] {
            list.push((PathBuf::from(p), vec![]));
        }
        for root in &conda_roots {
            list.push((root.join("bin/python"), vec![]));
            if let Ok(envs) = std::fs::read_dir(root.join("envs")) {
                for e in envs.flatten() {
                    list.push((e.path().join("bin/python"), vec![]));
                }
            }
        }
    }
    list.retain(|(p, _)| p.components().count() == 1 || p.is_file());
    list
}

/// Quick look at every Python found: version and which packages are importable (nothing heavy is imported).
#[tauri::command]
pub async fn uma_find(app: AppHandle, extra: Option<String>) -> Result<Vec<Value>, String> {
    let script = runner(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let handles: Vec<_> = candidates(extra)
            .into_iter()
            .map(|(p, args)| {
                let script = script.clone();
                thread::spawn(move || {
                    let mut c = command(&p);
                    c.args(&args).arg("-u").arg(&script).arg("--probe").arg("quick");
                    probe_with(c, Duration::from_secs(20))
                })
            })
            .collect();
        let mut seen = std::collections::HashSet::new();
        let mut found = Vec::new();
        for h in handles {
            if let Ok(Some(v)) = h.join() {
                let exe = v.get("executable").and_then(Value::as_str).unwrap_or("").to_ascii_lowercase();
                if !exe.is_empty() && seen.insert(exe) {
                    found.push(v);
                }
            }
        }
        found
    })
    .await
    .map_err(|e| e.to_string())
}

/// Full check of one Python: torch and CUDA, fairchem, RDKit, Hugging Face login and access to facebook/UMA.
#[tauri::command]
pub async fn uma_inspect(app: AppHandle, python: String) -> Result<Value, String> {
    let exe = python_path(&python)?;
    let script = runner(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut c = command(&exe);
        c.arg("-u").arg(&script).arg("--probe");
        probe_with(c, Duration::from_secs(90)).ok_or_else(|| "probe-failed".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Copies one output stream into the log. A carriage return without a newline (a progress bar)
/// keeps redrawing the same line instead of adding new ones.
fn pump(mut src: impl Read + Send + 'static, run: Arc<Mutex<Run>>) {
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut cur: Vec<u8> = Vec::new();
        let mut live: Option<usize> = None;
        let put = |text: String, live: Option<usize>| -> usize {
            let mut r = run.lock().unwrap();
            if let Some(i) = live {
                if i >= r.dropped && i - r.dropped < r.lines.len() {
                    let k = i - r.dropped;
                    r.lines[k] = text;
                    return i;
                }
            }
            r.lines.push(text);
            if r.lines.len() > MAX_LINES {
                let extra = r.lines.len() - MAX_LINES;
                r.lines.drain(..extra);
                r.dropped += extra;
            }
            r.dropped + r.lines.len() - 1
        };
        loop {
            let n = match src.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => n,
            };
            for &b in &buf[..n] {
                match b {
                    b'\r' => {
                        if !cur.is_empty() {
                            live = Some(put(String::from_utf8_lossy(&cur).into_owned(), live));
                            cur.clear();
                        }
                    }
                    b'\n' => {
                        if !cur.is_empty() {
                            put(String::from_utf8_lossy(&cur).into_owned(), live);
                            cur.clear();
                        }
                        live = None;
                    }
                    _ => cur.push(b),
                }
            }
        }
        if !cur.is_empty() {
            put(String::from_utf8_lossy(&cur).into_owned(), live);
        }
    });
}

/// Starts a calculation in a new folder under the app data; returns that folder.
#[tauri::command]
pub fn uma_start(app: AppHandle, state: State<'_, Uma>, python: String, mut params: Params) -> Result<String, String> {
    let exe = python_path(&python)?;
    check(&mut params)?;
    if state.0.lock().unwrap().running {
        return Err("busy".into());
    }
    let script = runner(&app)?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("uma-runs").join(format!("{stamp}-{}-{}", params.name, params.job));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("params.json"), serde_json::to_string_pretty(&params).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let mut c = command(&exe);
    c.arg("-u").arg(&script).arg("params.json").current_dir(&dir);
    let mut child = c.spawn().map_err(|e| format!("spawn-failed: {e}"))?;
    let (out, err) = (child.stdout.take(), child.stderr.take());
    {
        let mut r = state.0.lock().unwrap();
        *r = Run { running: true, child: Some(child), dir: Some(dir.clone()), ..Default::default() };
    }
    if let Some(o) = out {
        pump(o, state.0.clone());
    }
    if let Some(e) = err {
        pump(e, state.0.clone());
    }
    let run = state.0.clone();
    thread::spawn(move || loop {
        {
            let mut r = run.lock().unwrap();
            let done = match r.child.as_mut().map(|c| c.try_wait()) {
                Some(Ok(Some(status))) => Some(status.code().unwrap_or(-1)),
                Some(Ok(None)) => None,
                _ => Some(-1),
            };
            if let Some(code) = done {
                r.exit = Some(code);
                r.running = false;
                r.child = None;
                return;
            }
        }
        thread::sleep(Duration::from_millis(200));
    });
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn uma_poll(state: State<'_, Uma>, since: usize) -> Poll {
    let r = state.0.lock().unwrap();
    let from = since.saturating_sub(1).max(r.dropped);
    let lines = r.lines.get(from - r.dropped..).map(<[String]>::to_vec).unwrap_or_default();
    Poll { from, lines, running: r.running, exit: r.exit, dir: r.dir.as_ref().map(|d| d.to_string_lossy().into_owned()) }
}

#[tauri::command]
pub fn uma_stop(state: State<'_, Uma>) {
    stop(&state);
}

pub fn stop(state: &Uma) {
    if let Some(c) = state.0.lock().unwrap().child.as_mut() {
        let _ = c.kill();
    }
}

/// Opens the last run's folder in Explorer / Finder.
#[tauri::command]
pub fn uma_open_dir(app: AppHandle, state: State<'_, Uma>) -> Result<(), String> {
    let dir = state.0.lock().unwrap().dir.clone().ok_or("no-run")?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(smiles: &str, name: &str) -> Params {
        Params { smiles: smiles.into(), name: name.into(), job: "ipea".into(), model: "uma-s-1p2p1".into(), device: "cuda".into(), charge: 0, spin: 1, with_m: true }
    }

    #[test]
    fn checks_parameters() {
        let mut p = params(" O=C1OCC(F)O1 ", "FEC");
        assert!(check(&mut p).is_ok());
        assert_eq!(p.smiles, "O=C1OCC(F)O1");
        let mut p = params("C/C=C\\C", "../../evil name");
        assert!(check(&mut p).is_ok());
        assert_eq!(p.name, "molecule"); // "../../evil name" keeps only "....evilname", which starts with a dot
    }

    #[test]
    fn rejects_bad_input() {
        assert!(check(&mut params("CC'; import os", "x")).is_err());
        assert!(check(&mut params("CC\nimport os", "x")).is_err());
        let mut p = params("CC", "x");
        p.job = "shell".into();
        assert!(check(&mut p).is_err());
        let mut p = params("CC", "x");
        p.spin = 0;
        assert!(check(&mut p).is_err());
        assert!(python_path("cmd.exe").is_err());
        assert!(python_path("python").is_err()); // not absolute
    }
}
