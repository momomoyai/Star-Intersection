#[cfg(any(target_os = "macos", target_os = "windows"))]
mod desktop {
    use chrono::{Local, Timelike};
    use std::sync::Mutex;
    use std::time::Duration;
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri::{App, AppHandle, LogicalSize, Manager, Size, State};
    use tauri_plugin_notification::NotificationExt;

    #[derive(Default)]
    pub struct ReminderState(Mutex<ReminderSettings>);

    #[derive(Default)]
    struct ReminderSettings {
        time: Option<(u8, u8)>,
        last_sent_date: Option<String>,
    }

    #[tauri::command]
    pub fn set_reminder(
        state: State<'_, ReminderState>,
        enabled: bool,
        hour: u8,
        minute: u8,
    ) -> Result<(), String> {
        if hour > 23 || minute > 59 {
            return Err("Invalid reminder time".into());
        }
        state.0.lock().map_err(|_| "Reminder is unavailable")?.time =
            enabled.then_some((hour, minute));
        Ok(())
    }

    fn show(app: &AppHandle, mode: &str) {
        if let Some(window) = app.get_webview_window("main") {
            let (width, height, script) = match mode {
                "capture" => (430.0, 640.0, "window.starNative?.capture()"),
                "today" => (430.0, 640.0, "window.starNative?.quick()"),
                _ => (1200.0, 800.0, "window.starNative?.full()"),
            };
            let _ = window.set_size(Size::Logical(LogicalSize::new(width, height)));
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            let _ = window.eval(script);
        }
    }

    #[tauri::command]
    pub fn show_full(app: AppHandle) {
        show(&app, "full");
    }

    #[tauri::command]
    pub fn hide_window(app: AppHandle) {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
    }

    pub fn setup(app: &mut App) -> tauri::Result<()> {
        let today = MenuItem::with_id(app, "today", "Quick Today", true, None::<&str>)?;
        let capture = MenuItem::with_id(app, "capture", "Capture thought", true, None::<&str>)?;
        let full = MenuItem::with_id(app, "full", "Open full planner", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "Quit Star Intersection", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&today, &capture, &full, &quit])?;
        let mut tray = TrayIconBuilder::new()
            .menu(&menu)
            .show_menu_on_left_click(false)
            .tooltip("Star Intersection")
            .on_menu_event(|app, event| match event.id.as_ref() {
                "today" => show(app, "today"),
                "capture" => show(app, "capture"),
                "full" => show(app, "full"),
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show(tray.app_handle(), "today");
                }
            });
        if let Some(icon) = app.default_window_icon() {
            tray = tray.icon(icon.clone());
        }
        tray.build(app)?;

        if let Some(window) = app.get_webview_window("main") {
            if std::env::args().any(|arg| arg == "--hidden") {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
        } else {
            eprintln!("Star Intersection main window was not created");
        }

        let handle = app.handle().clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(20));
            let now = Local::now();
            let date = now.format("%Y-%m-%d").to_string();
            let state = handle.state::<ReminderState>();
            let should_send = if let Ok(mut settings) = state.0.lock() {
                if let Some((hour, minute)) = settings.time {
                    if (now.hour(), now.minute()) >= (hour as u32, minute as u32)
                        && settings.last_sent_date.as_deref() != Some(&date)
                    {
                        settings.last_sent_date = Some(date);
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            } else {
                false
            };
            if should_send {
                let _ = handle
                    .notification()
                    .builder()
                    .title("Review tomorrow with Star")
                    .body("Check your week plan and Inbox before you finish today.")
                    .show();
            }
        });
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default().plugin(tauri_plugin_notification::init());

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let app = app
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .manage(desktop::ReminderState::default())
        .invoke_handler(tauri::generate_handler![
            desktop::set_reminder,
            desktop::show_full,
            desktop::hide_window
        ]);

    app.setup(|app| {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        desktop::setup(app)?;
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let _ = app;
        Ok(())
    })
    .on_window_event(|window, event| {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let _ = (window, event);
    })
    .run(tauri::generate_context!())
    .expect("failed to start Star Intersection");
}
