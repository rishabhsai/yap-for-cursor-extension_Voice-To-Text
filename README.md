# <p align="center"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Speaking%20Head.webp" alt="Speaking Head" width="128" height="128" /><br/> Yap: Voice to Text (Local Whisper) </p>

🗣️ Local, WebGPU‑powered voice‑to‑text right inside VS Code/Cursor using Hugging Face Transformers (Whisper).

https://github.com/user-attachments/assets/ea641fb8-00c8-4da8-b0b8-b6e11aac6478

## ✨ Features

- 🎙️ LOCAL VOICE TRANSCRIPTION: Dictate directly into the editor.
- 🔒 IN‑BROWSER PROCESSING: Runs locally in a webview worker (no API keys; initial model download only).
- 🖱️ SEAMLESS INTEGRATION: Mic in the status bar and editor title.
- 🧩 BOTTOM PANEL VIEW: Compact recorder panel while capturing audio.
- 🔤 LIVE PREVIEW: Inline partial transcript preview as you speak.
- 🧰 QUICK ACTIONS: On stop, choose Copy/Insert/New File.
- ⌨️ `Cmd+Shift+Y` to toggle recording.

## 🚀 Installation Guide

Install from a marketplace (no cloning required):

- Cursor Marketplace: search for "YapCode: Voice to Text (Local Whisper)" or run `cursor --install-extension rishabhsai.yap-cursor-extension`.
- Open VSX: https://open-vsx.org/ (search for `rishabhsai.yap-cursor-extension`).
- Visual Studio Code Marketplace: https://marketplace.visualstudio.com/ (search for "YapCode: Voice to Text (Local Whisper)").

Optional (recommended): Press `Cmd+,` to open Settings and search for "Yap" to customize behavior (see Settings below). You can also edit `settings.json` directly.

Note: First run downloads model files in the webview and requires WebGPU support.

## 🛠️ How to Use

1. Click the `Yap` status bar item (or editor title mic) or press `Cmd+Shift+Y`.
2. The bottom panel “Yap Recorder” appears and begins listening.
3. Speak clearly; watch live inline preview near your cursor.
4. Click again (or run `Yap: Stop Recording`).
5. Pick what to do with the transcript: Copy, Insert at cursor/below/above, or open in a new file.

## ⚙️ Settings

Add via Settings UI or `settings.json`:

```json
{
  "yap.alwaysPrompt": true,
  "yap.defaultAction": "copy",           // copy | insertAtCursor | insertBelow | insertAbove | newFile
  "yap.inlinePreview": true,
  "yap.language": "auto",                // hint language (e.g., "en", "es") or "auto"
  "yap.showPopupWhileRecording": true     // shows the bottom panel recorder
}
```

Tips:
- If recording won’t start, re‑enable `yap.showPopupWhileRecording` (webview needs to initialize to access the mic).
- WebGPU is required for real‑time local inference.

## 🖥️ Compatibility

- VS Code ≥ 1.86 and Cursor 0.49+.
- macOS (Apple Silicon & Intel) recommended with WebGPU.
- Windows/Linux may work if Electron/WebGPU is available.

## 🔑 Commands

- `Yap: Toggle Recording` (`yap.toggle`)
- `Yap: Start Recording` (`yap.start`)
- `Yap: Stop Recording` (`yap.stop`)

## License

MIT
