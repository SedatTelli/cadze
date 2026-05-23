use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use sys_locale::get_locale;
use tauri::Manager;

// ── Locale ────────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_system_locale() -> String {
    let locale = get_locale().unwrap_or_else(|| "en".to_string());
    let lang = locale.split('-').next().unwrap_or("en").to_lowercase();
    match lang.as_str() {
        "tr" => "tr", "de" => "de", "zh" => "zh", "ja" => "ja", _ => "en",
    }.to_string()
}

#[tauri::command]
fn app_version() -> String { env!("CARGO_PKG_VERSION").to_string() }

// ── Main CAD loader — takes a FILE PATH (no byte transfer over IPC) ───────────

#[derive(Debug, serde::Serialize)]
pub struct CadResult {
    success:     bool,
    file_type:   String,          // "dxf" | "dwg" | "unsupported"
    dxf_content: Option<String>,  // DXF text (for both DXF files and converted DWG)
    dwg_version: Option<String>,
    error:       Option<String>,
}

#[tauri::command]
async fn process_cad_file(app: tauri::AppHandle, path: String) -> CadResult {
    let file_path = Path::new(&path);
    let ext = file_path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "dxf" => load_dxf(file_path),
        "dwg" => convert_dwg(app, file_path),
        _ => CadResult {
            success: false, file_type: "unsupported".into(),
            dxf_content: None, dwg_version: None,
            error: Some(format!("Unsupported format: .{ext}")),
        },
    }
}

fn load_dxf(path: &Path) -> CadResult {
    match fs::read_to_string(path) {
        Ok(content) => CadResult {
            success: true, file_type: "dxf".into(),
            dxf_content: Some(content), dwg_version: None, error: None,
        },
        Err(e) => CadResult {
            success: false, file_type: "dxf".into(),
            dxf_content: None, dwg_version: None,
            error: Some(format!("Cannot read DXF: {e}")),
        },
    }
}

fn debug_log(msg: &str) {
    let log_path = std::env::temp_dir().join("cadze_debug.log");
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(f, "{}", msg);
    }
}

fn convert_dwg(app: tauri::AppHandle, dwg_path: &Path) -> CadResult {
    debug_log(&format!("=== convert_dwg: {:?}", dwg_path));

    // Read header to detect version
    let dwg_version = fs::read(dwg_path).ok()
        .and_then(|b| String::from_utf8(b[..6.min(b.len())].to_vec()).ok())
        .map(|h| map_dwg_version(h.trim()));
    debug_log(&format!("dwg_version: {:?}", dwg_version));

    // Find dwg2dxf.exe
    let converter = match find_converter(&app, "dwg2dxf.exe") {
        Some(p) => { debug_log(&format!("converter: {:?}", p)); p }
        None => {
            debug_log("ERROR: dwg2dxf.exe not found");
            return CadResult {
                success: false, file_type: "dwg".into(),
                dxf_content: None, dwg_version,
                error: Some("dwg2dxf.exe not found. Make sure bin/ folder is next to Cadze.exe".into()),
            };
        }
    };

    // Use fixed ASCII filenames — dwg2dxf.exe cannot handle Unicode/Turkish paths
    let tmp_dir = std::env::temp_dir().join("cadze_tmp");
    let _ = fs::create_dir_all(&tmp_dir);
    let dwg_in  = tmp_dir.join("cadze_in.dwg");
    let dxf_out = tmp_dir.join("cadze_out.dxf");
    debug_log(&format!("dwg_in: {:?}", dwg_in));
    debug_log(&format!("dxf_out: {:?}", dxf_out));

    // Copy input to ASCII temp path so converter doesn't choke on Turkish chars
    if let Err(e) = fs::copy(dwg_path, &dwg_in) {
        debug_log(&format!("ERROR copying input: {e}"));
        return CadResult {
            success: false, file_type: "dwg".into(),
            dxf_content: None, dwg_version,
            error: Some(format!("Cannot copy DWG to temp: {e}")),
        };
    }

    // Remove old output if exists
    let _ = fs::remove_file(&dxf_out);

    let bin_dir = converter.parent().unwrap_or(Path::new("."));
    debug_log(&format!("bin_dir: {:?}", bin_dir));

    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new(&converter);
    cmd.current_dir(bin_dir).arg(&dwg_in).arg("-o").arg(&dxf_out);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let output = cmd.output();

    let _ = fs::remove_file(&dwg_in);

    match output {
        Err(e) => {
            debug_log(&format!("ERROR running converter: {e}"));
            CadResult {
                success: false, file_type: "dwg".into(),
                dxf_content: None, dwg_version,
                error: Some(format!("Cannot run converter: {e}")),
            }
        }
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            debug_log(&format!("exit_code: {:?}", out.status.code()));
            debug_log(&format!("stdout: {stdout}"));
            debug_log(&format!("stderr: {stderr}"));
            debug_log(&format!("dxf_out exists: {}", dxf_out.exists()));

            if dxf_out.exists() {
                match fs::read_to_string(&dxf_out) {
                    Ok(content) => {
                        debug_log(&format!("DXF size: {} bytes", content.len()));
                        let _ = fs::remove_file(&dxf_out);
                        CadResult {
                            success: true, file_type: "dwg".into(),
                            dxf_content: Some(content), dwg_version, error: None,
                        }
                    }
                    Err(e) => {
                        debug_log(&format!("ERROR reading output: {e}"));
                        CadResult {
                            success: false, file_type: "dwg".into(),
                            dxf_content: None, dwg_version,
                            error: Some(format!("Cannot read output: {e}")),
                        }
                    }
                }
            } else {
                debug_log("ERROR: DXF output file not created");
                CadResult {
                    success: false, file_type: "dwg".into(),
                    dxf_content: None, dwg_version,
                    error: Some(format!("Converter produced no output. stderr: {stderr}")),
                }
            }
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn find_converter(app: &tauri::AppHandle, name: &str) -> Option<PathBuf> {
    // 1. Tauri resource dir (when bundled)
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("bin").join(name);
        if p.exists() { return Some(p); }
    }
    // 2. bin/ folder next to the .exe (portable mode)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("bin").join(name);
            if p.exists() { return Some(p); }
        }
    }
    // 3. Dev: relative to src-tauri (cargo run from workspace)
    let dev = PathBuf::from("resources/bin").join(name);
    if dev.exists() { return Some(dev); }

    None
}

fn map_dwg_version(code: &str) -> String {
    match code {
        "AC1006" => "R10",   "AC1009" => "R12",   "AC1012" => "R13",
        "AC1014" => "R14",   "AC1015" => "R2000",  "AC1018" => "R2004",
        "AC1021" => "R2007", "AC1024" => "R2010",  "AC1027" => "R2013",
        "AC1032" => "R2018", "AC1035" => "R2021",  "AC1037" => "R2024",
        "AC1038" => "R2025", other => other,
    }.to_string()
}

// ── Entry ─────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_locale,
            app_version,
            process_cad_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
