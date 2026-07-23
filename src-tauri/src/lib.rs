// SPDX-License-Identifier: AGPL-3.0-or-later
//! Tauri shell for Neoma. On desktop this adds a native window, a system tray,
//! single-instance focus, optional launch-on-startup, and native
//! dialogs/notifications. On mobile (iOS/Android) the tray, single-instance and
//! autostart pieces don't apply and are compiled out with `#[cfg(desktop)]`.
//! No network, no telemetry: the offline web app remains the source of truth.
//! See DESKTOP.md.

#[cfg(desktop)]
use std::sync::atomic::{AtomicU8, Ordering};

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

/// What happens when the user closes the main window (desktop only).
/// 0 = quit completely, 1 = minimise to tray, 2 = ask each time.
#[cfg(desktop)]
#[derive(Default)]
struct CloseBehavior(AtomicU8);

#[cfg(desktop)]
const DEFAULT_BEHAVIOR: u8 = 1; // minimise to tray

#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// Persist the user's tray/close preference so the native close handler matches
/// the in-app setting.
#[cfg(desktop)]
#[tauri::command]
fn set_close_behavior(app: tauri::AppHandle, behavior: u8) {
    app.state::<CloseBehavior>().0.store(behavior, Ordering::Relaxed);
}

/// Called by the frontend (e.g. after the "ask" dialog) to really quit.
#[cfg(desktop)]
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Desktop-only: tray, single-instance focus, launch-on-startup, and the
    // close-to-tray window behaviour. None of this exists on mobile.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
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
        });

    // Plugins available on every platform (offline; no network, no telemetry).
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Neoma");
}
