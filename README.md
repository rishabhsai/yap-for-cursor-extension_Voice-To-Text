Yap: Voice to Text (Local Whisper)

Adds a mic button (status bar + editor title) to toggle local speech transcription using Hugging Face Transformers (Whisper on WebGPU). On stop, choose what to do with the transcript (copy, insert, new file) or set a default action.

Features
- Status bar mic and editor title mic
- Bottom panel view (no editor window pop‑up) while recording
- Live inline preview of partial text while transcribing
- QuickPick on stop: Copy, Insert at cursor, Insert below/above, Open new file
- Cmd+Shift+Y to toggle
- No API key required; downloads Whisper and runs locally via WebGPU

Settings
- `yap.alwaysPrompt` (default: true)
- `yap.defaultAction` (copy | insertAtCursor | insertBelow | insertAbove | newFile)
- `yap.inlinePreview` (default: true)
- `yap.language` (default: auto)
- `yap.showPopupWhileRecording` (default: true) — shows a small bottom panel view

Usage
- Click the `Yap` status bar item or use `Cmd+Shift+Y` to start/stop.
- While recording, a compact “Yap Recorder” view appears in the bottom panel.
- On stop, pick an action (or set a default) to apply the transcript.

Notes
- First run will download model files via CDN in the webview; ensure WebGPU is supported by Cursor/VS Code on your machine.
- If you disabled the popup view and recording doesn’t start, re‑enable `yap.showPopupWhileRecording` so the recorder can access the microphone.

License

MIT
