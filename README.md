Yap: Voice to Text (Local Whisper)

Adds a mic button (status bar + editor title) to toggle local speech transcription using Hugging Face Transformers (Whisper on WebGPU). On stop, choose what to do with the transcript (copy, insert, new file) or set a default action.

Features
- Status bar mic and editor title mic
- Popup panel that says “Recording…” while capturing audio
- Live inline preview of partial text while transcribing
- QuickPick on stop: Copy, Insert at cursor, Insert below/above, Open new file
- Cmd+Shift+Y to toggle
- No API key required; downloads Whisper and runs locally via WebGPU

Settings
- `yap.alwaysPrompt` (default: true)
- `yap.defaultAction` (copy | insertAtCursor | insertBelow | insertAbove | newFile)
- `yap.inlinePreview` (default: true)
- `yap.language` (default: auto)
- `yap.showPopupWhileRecording` (default: true)

Notes
- First run will download model files via CDN in the webview; ensure WebGPU is supported by Cursor on your machine.
- Partial preview is streamed during transcription. For true real‑time (while speaking) we can enhance with incremental chunking in a future iteration.

