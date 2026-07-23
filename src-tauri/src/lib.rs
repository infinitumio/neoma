// SPDX-License-Identifier: AGPL-3.0-or-later
//! Tauri desktop shell for neoma. The whole app is the offline web build —
//! this adds a native window, a system tray, single-instance focus, optional
//! launch-on-startup, and native dialogs/notifications. No network, no
//! telemetry: the web app remains the source of truth.
//!
//! NOTE: This crate is a scaffold. It has NOT been compiled in the repo's CI
//! (which builds the PWA only). Build it locally with a Rust toolchain — see
//! DESKTOP.md.

use std::sync::atomic::{AtomicU8, Ordering};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

/// What happens when the user closes the main window.
/// 0 = quit completely, 1 = minimise to tray, 2 = ask each time.
#[derive(Default)]
struct CloseBehavior(AtomicU8);

const DEFAULT_BEHAVIOR: u8 = 1; // minimise to tray

fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// Called by the frontend to persist the user's tray/close preference so the
/// native close handler matches the in-app setting.
#[tauri::command]
fn set_close_behavior(app: tauri::AppHandle, behavior: u8) {
    app.state::<CloseBehavior>().0.store(behavior, Ordering::Relaxed);
}

/// Called by the frontend (e.g. after the "ask" dialog) to really quit.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Focus the existing window instead of launching a second copy.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(CloseBehavior(AtomicU8::new(DEFAULT_BEHAVIOR)))
        .invoke_handler(tauri::generate_handler![set_close_behavior, quit_app])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show Neoma", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Neoma")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let behavior = app.state::<CloseBehavior>().0.load(Ordering::Relaxed);
                match behavior {
                    // Quit completely: let the close proceed.
                    0 => {}
                    // Ask each time: keep the window, let the web app decide.
                    2 => {
                        api.prevent_close();
                        let _ = window.emit("neoma://close-requested", ());
                    }
                    // Minimise to tray (default).
                    _ => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Neoma");
}
