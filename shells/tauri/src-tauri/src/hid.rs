//! Raw HID pass-through for Vial keyboards.
//!
//! The Rust side only moves 32-byte messages. The Vial protocol itself runs in
//! the shared app (JavaScript), exactly as in the web version.

use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

const USAGE_PAGE: u16 = 0xFF60;
const USAGE: u16 = 0x61;
const MSG_LEN: usize = 32;
const LAST_VIA_COMMAND: u8 = 0x14;
const TIMEOUT_MS: i32 = 500;
const ATTEMPTS: usize = 5;

#[derive(Serialize)]
pub struct HidInfo {
    id: String,
    vendor_id: u16,
    product_id: u16,
    product_name: String,
    manufacturer_name: String,
    serial_number: String,
}

#[derive(Default)]
pub struct Keyboards {
    // One open connection per keyboard; the lock also keeps requests one at a time.
    open: Mutex<HashMap<String, HidDevice>>,
}

fn raw_hid_devices(api: &HidApi) -> Vec<HidInfo> {
    api.device_list()
        .filter(|d| d.usage_page() == USAGE_PAGE && d.usage() == USAGE)
        .map(|d| HidInfo {
            id: d.path().to_string_lossy().into_owned(),
            vendor_id: d.vendor_id(),
            product_id: d.product_id(),
            product_name: d.product_string().unwrap_or_default().to_string(),
            manufacturer_name: d.manufacturer_string().unwrap_or_default().to_string(),
            serial_number: d.serial_number().unwrap_or_default().to_string(),
        })
        .collect()
}

#[tauri::command]
pub fn hid_list(keyboards: State<Keyboards>) -> Result<Vec<HidInfo>, String> {
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let found = raw_hid_devices(&api);
    // Forget connections to keyboards that were unplugged.
    keyboards
        .open
        .lock()
        .map_err(|_| "keyboard state is poisoned".to_string())?
        .retain(|id, _| found.iter().any(|d| &d.id == id));
    Ok(found)
}

/// Send one 32-byte message and return the 32-byte answer. A request without
/// an answer is sent again, like the web version does. Core VIA commands echo
/// their id (or answer 0xFF); other answers are late replies to an earlier try.
#[tauri::command]
pub fn hid_exchange(
    id: String,
    message: Vec<u8>,
    keyboards: State<Keyboards>,
) -> Result<Vec<u8>, String> {
    let mut open = keyboards
        .open
        .lock()
        .map_err(|_| "keyboard state is poisoned".to_string())?;

    if !open.contains_key(&id) {
        let api = HidApi::new().map_err(|e| e.to_string())?;
        let path = std::ffi::CString::new(id.clone()).map_err(|e| e.to_string())?;
        let device = api
            .open_path(&path)
            .map_err(|e| format!("Could not open the keyboard: {e}"))?;
        open.insert(id.clone(), device);
    }
    let device = &open[&id];

    // Report id 0 followed by the 32-byte message.
    let mut report = [0u8; MSG_LEN + 1];
    for (slot, byte) in report[1..].iter_mut().zip(message.iter()) {
        *slot = *byte;
    }
    let command = report[1];
    let echoed = (0x01..=LAST_VIA_COMMAND).contains(&command);

    for _ in 0..ATTEMPTS {
        if let Err(e) = device.write(&report) {
            open.remove(&id);
            return Err(format!("Could not send to the keyboard: {e}"));
        }
        let mut buf = [0u8; MSG_LEN];
        loop {
            let read = match device.read_timeout(&mut buf, TIMEOUT_MS) {
                Ok(n) => n,
                Err(e) => {
                    open.remove(&id);
                    return Err(format!("Could not read from the keyboard: {e}"));
                }
            };
            if read == 0 {
                break; // no answer in time: send again
            }
            if echoed && buf[0] != command && buf[0] != 0xFF {
                continue; // late answer to an earlier request
            }
            return Ok(buf.to_vec());
        }
    }
    Err("Keyboard did not answer in time.".to_string())
}
