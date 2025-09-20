// Minimal ASR webview harness.
// - Captures mic with MediaRecorder
// - On stop, decodes and resamples to Float32 (16kHz mono)
// - Runs Whisper via inline Worker code (from yap-for-cursor build)
// - Streams partial tokens via TextStreamer; sends {type:'partial'} to extension
// - Sends {type:'final'} on completion

(function(){
  const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

  // These constants should mirror yap-for-cursor
  const TARGET_SAMPLE_RATE = 16000;

  // Simple UI state
  let selectedDeviceId = null;
  let boundUI = false;

  function bindUIOnce() {
    if (boundUI) return; boundUI = true;
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        vscode?.postMessage({ type: 'stopRequest' });
      });
    }
    const micSelect = document.getElementById('micSelect');
    if (micSelect) {
      micSelect.addEventListener('change', () => {
        selectedDeviceId = micSelect.value || null;
      });
    }
  }

  async function refreshMicList() {
    try {
      bindUIOnce();
      const micSelect = document.getElementById('micSelect');
      if (!micSelect) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      micSelect.innerHTML = '';
      for (const d of inputs) {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || 'Microphone';
        micSelect.appendChild(opt);
      }
      if (selectedDeviceId) {
        const found = [...micSelect.options].some(o => o.value === selectedDeviceId);
        if (found) {
          micSelect.value = selectedDeviceId;
        }
      } else if (micSelect.options.length > 0) {
        selectedDeviceId = micSelect.options[0].value;
        micSelect.value = selectedDeviceId;
      }
    } catch (e) {
      // labels may be empty until user grants permission
    }
  }

  // Inline worker code extracted from yap-for-cursor's dist (trimmed header retained)
  const WORKER_CODE = `var C=Object.defineProperty,F=Object.defineProperties;var x=Object.getOwnPropertyDescriptors;var V=Object.getOwnPropertySymbols;var H=Object.prototype.hasOwnProperty,A=Object.prototype.propertyIsEnumerable;var w=(e,r,o)=>r in e?C(e,r,{enumerable:!0,configurable:!0,writable:!0,value:o}):e[r]=o,T=(e,r)=>{for(var o in r||(r={}))H.call(r,o)&&w(e,o,r[o]);if(V)for(var o of V(r))A.call(r,o)&&w(e,o,r[o]);return e},M=(e,r)=>F(e,x(r));console.log("[Voice Worker] Code execution started.");var d=!1,m="onnx-community/whisper-base",l=null,i=null,s=null,t=null,n=!1,c=!1,W,G,v,P,y,f;async function z(){console.log("[Voice Worker][Init] Initializing Transformers library...");try{let e=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0");console.log("[Voice Worker][Init] Transformers library imported successfully."),{AutoTokenizer:W,AutoProcessor:G,WhisperForConditionalGeneration:v,TextStreamer:P,full:y,env:f}=e,f.allowLocalModels=!1,f.backends.onnx.logLevel="info"}catch(e){throw console.error("[Voice Worker][Init] Failed to import Transformers library:",e),e}}async function S(e){console.log("[Voice Worker][Load] Loading model components..."),W||await z(),n=!1,c=!1;try{let r=[W.from_pretrained(m,{progress_callback:e}),G.from_pretrained(m,{progress_callback:e}),v.from_pretrained(m,{dtype:{encoder_model:"fp32",decoder_model_merged:"q4"},device:"webgpu",progress_callback:e})],o=await Promise.all(r);if(console.log("[Voice Worker][Load] All model components loaded."),l=o[0],i=o[1],s=o[2],!l||!i||!s)throw new Error("[Voice Worker][Load] Model components not assigned correctly after load.");await E(),n=!0,console.log("[Voice Worker][Load] Model is loaded and warmed up.")}catch(r){throw console.error("[Voice Worker][Load] Model loading or warmup failed:",r),l=null,i=null,s=null,n=!1,c=!1,t=null,r}}async function E(){if(!s||!y){console.warn("[Voice Worker][Warmup] Cannot warmup model: Not loaded yet.");return}if(c){console.log("[Voice Worker][Warmup] Model already warmed up.");return}console.log("[Voice Worker][Warmup] Warming up model...");try{let o={input_features:y([1,80,3e3],0),max_new_tokens:1,generation_config:{}};await s.generate(o),c=!0,console.log("[Voice Worker][Warmup] Model warmup successful.")}catch(e){console.warn("[Voice Worker][Warmup] Model warmup failed:",e),c=!1}}var k=!1;async function L({audio:e,language:r}){if(k){console.warn("[Voice Worker][Generate] Already processing audio."),self.postMessage({status:"error",data:"Already processing audio."});return}if(!e||e.length===0){console.warn("[Voice Worker][Generate] No audio data received."),self.postMessage({status:"error",data:"No audio data received."});return}if(!n||!l||!i||!s){console.error("[Voice Worker][Generate] Model not ready for transcription."),self.postMessage({status:"error",data:"Model not ready."});return}k=!0,d=!1,console.log("[Voice Worker][Generate] Starting transcription process..."),self.postMessage({status:"transcribing_start"});try{console.log("[Voice Worker][Generate] Processing audio input...");let o=await i(e);console.log("[Voice Worker][Generate] Audio processed.");let a=null,u=0,g="",h=_=>{if(d){console.log("[Voice Worker][Generate] Streamer callback cancelled.");return}a!=null||(a=performance.now()),g=_;let p=0;u++>0&&a&&(p=u/(performance.now()-a)*1e3),self.postMessage({status:"update",output:g,tps:p?parseFloat(p.toFixed(1)):0,numTokens:u})};console.log("[Voice Worker][Generate] Creating text streamer...");let b=new P(l,{skip_prompt:!0,skip_special_tokens:!0,callback_function:h});console.log("[Voice Worker][Generate] Text streamer created."),console.log("[Voice Worker][Generate] Starting model generation..."),await s.generate(M(T({},o),{language:r,streamer:b})),console.log("[Voice Worker][Generate] Model generation finished."),d?console.log("[Voice Worker][Generate] Transcription cancelled post-generation. Discarding result."):(console.log("[Voice Worker][Generate] Transcription complete. Sending final message."),self.postMessage({status:"complete",output:g}))}catch(o){console.error("[Voice Worker][Generate] Transcription failed:",o),self.postMessage({status:"error",data:`Transcription failed: ${o instanceof Error?o.message:String(o)}`})}finally{console.log("[Voice Worker][Generate] Cleaning up transcription process."),k=!1}}console.log("[Voice Worker] Setting up message listener.");self.addEventListener("message",async e=>{if(console.log("[Voice Worker][Handler] Received message:",e.data),!e.data||typeof e.data!="object"||!("type"in e.data)){console.warn("[Voice Worker][Handler] Received invalid message format:",e.data);return}let{type:r,data:o}=e.data;switch(r){case"load":if(console.log("[Voice Worker][Handler] Handling 'load' message."),t){console.log("[Voice Worker][Handler] Model loading already in progress or completed.");try{await t,n&&self.postMessage({status:"ready"})}catch(a){console.error("[Voice Worker][Handler] Previous load attempt failed."),n||self.postMessage({status:"error",data:`Model initialization failed: ${a instanceof Error?a.message:String(a)}`})}return}t=S(a=>{a.status==="progress"&&self.postMessage({status:"loading",data:`Loading: ${a.file} (${a.progress.toFixed(0)}%)`})});try{await t,self.postMessage({status:"ready"})}catch(a){console.error("[Voice Worker][Handler] loadModel promise rejected:",a),t=null,n||self.postMessage({status:"error",data:`Model initialization failed: ${a instanceof Error?a.message:String(a)}`})}break;case"generate":o?(console.log("[Voice Worker][Handler] Handling 'generate' message."),L(o)):(console.warn("[Voice Worker][Handler] 'generate' message received without data."),self.postMessage({status:"error",data:"Generate request missing audio data."}));break;case"stop":console.log("[Voice Worker][Handler] Handling 'stop' message."),d=!0,console.log("[Voice Worker][Handler] Cancellation requested flag set.");break;default:console.warn("[Voice Worker][Handler] Received unknown message type:",r);break}});console.log("[Voice Worker] Message listener set up. Initial script execution complete.");`;

  // Utility to create dedicated worker from inline code.
  function createWorkerFromCode(code) {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url, { type: 'module' });
    // Revoke after instantiation (worker keeps its own reference)
    URL.revokeObjectURL(url);
    return w;
  }

  // Audio processing: decode and resample to 16k mono Float32
  async function processAudioBlob(blob, targetSr = TARGET_SAMPLE_RATE) {
    if (!blob || blob.size === 0) return null;
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContext = window.AudioContext;
    if (!AudioContext) throw new Error('AudioContext not supported');
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const numChannels = decoded.numberOfChannels;
    const inSr = decoded.sampleRate;
    const length = decoded.length;
    // Merge to mono
    const tmp = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
      decoded.copyFromChannel(tmp, ch);
      if (ch === 0) {
        // keep tmp
      } else {
        for (let i = 0; i < length; i++) tmp[i] += decoded.getChannelData(ch)[i];
      }
    }
    if (numChannels > 1) {
      for (let i = 0; i < length; i++) tmp[i] /= numChannels;
    }
    // Resample
    if (inSr === targetSr) {
      await ctx.close();
      return tmp;
    }
    const ratio = inSr / targetSr;
    const outLen = Math.round(length / ratio);
    const out = new Float32Array(outLen);
    let pos = 0;
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, length - 1);
      const frac = idx - i0;
      out[i] = tmp[i0] * (1 - frac) + tmp[i1] * frac;
      pos++;
    }
    await ctx.close();
    return out;
  }

  let mediaRecorder = null;
  let audioChunks = [];
  let worker = null;
  let language = 'auto';
  let selectedDeviceId = null;

  function ensureWorker() {
    if (worker) return worker;
    worker = createWorkerFromCode(WORKER_CODE);
    worker.onmessage = (e) => {
      const { status, data, output } = e.data || {};
      if (status === 'loading') {
        vscode?.postMessage({ type: 'loading', message: data });
      } else if (status === 'ready') {
        vscode?.postMessage({ type: 'ready' });
      } else if (status === 'update') {
        vscode?.postMessage({ type: 'partial', text: output || '' });
      } else if (status === 'complete') {
        vscode?.postMessage({ type: 'final', text: output || '' });
      } else if (status === 'error') {
        vscode?.postMessage({ type: 'error', message: data || 'Worker error' });
      }
    };
    worker.onerror = (err) => {
      vscode?.postMessage({ type: 'error', message: err.message || 'Worker error' });
    };
    // Load model once
    worker.postMessage({ type: 'load' });
    return worker;
  }

  async function refreshMicList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const select = document.getElementById('micSelect');
      if (!select) return;
      
      select.innerHTML = '';
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${index + 1}`;
        select.appendChild(option);
      });
      
      // Select first device if none selected
      if (!selectedDeviceId && audioInputs.length > 0) {
        selectedDeviceId = audioInputs[0].deviceId;
        select.value = selectedDeviceId;
      }
    } catch (e) {
      console.error('Failed to enumerate devices:', e);
    }
  }

  async function startRecording() {
    audioChunks = [];
    try {
      // Check if we have microphone permission first
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported');
      }
      
      const constraints = selectedDeviceId ? { audio: { deviceId: { exact: selectedDeviceId } } } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verify we actually have audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available');
      }
      
      const types = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/wav'
      ];
      let mimeType = undefined;
      for (const t of types) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
      }
      
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (e) => { 
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
          console.log('Audio chunk received:', e.data.size, 'bytes');
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          console.log('Recording stopped, processing', audioChunks.length, 'chunks');
          if (audioChunks.length === 0) {
            vscode?.postMessage({ type: 'error', message: 'No audio data recorded' });
            return;
          }
          
          const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
          console.log('Audio blob created:', blob.size, 'bytes');
          audioChunks = [];
          
          const f32 = await processAudioBlob(blob, TARGET_SAMPLE_RATE);
          if (!f32 || f32.length === 0) { 
            vscode?.postMessage({ type: 'error', message: 'No audio data after processing' }); 
            return; 
          }
          
          console.log('Audio processed:', f32.length, 'samples');
          ensureWorker().postMessage({ type: 'generate', data: { audio: f32, language } });
        } catch (e) {
          console.error('Error processing audio:', e);
          vscode?.postMessage({ type: 'error', message: String(e?.message || e) });
        }
      };
      
      mediaRecorder.start(100); // Record in 100ms chunks
      console.log('Recording started with device:', selectedDeviceId);
      
      // populate device labels once permission granted
      refreshMicList();
    } catch (e) {
      console.error('Microphone access failed:', e);
      let errorMessage = 'Microphone access failed';
      if (e.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
      } else if (e.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please check your microphone connection.';
      } else if (e.name === 'NotReadableError') {
        errorMessage = 'Microphone is being used by another application.';
      }
      vscode?.postMessage({ type: 'error', message: errorMessage });
    }
  }

  function stopRecording() {
    try {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {}
  }

  window.addEventListener('message', async (e) => {
    const { type, language: lang } = e.data || {};
    if (type === 'start') {
      language = lang || 'auto';
      ensureWorker();
      bindUIOnce();
      refreshMicList();
      startRecording();
    } else if (type === 'stop') {
      stopRecording();
      const status = document.getElementById('status');
      if (status) status.textContent = 'Stopping…';
      // let worker finish and emit partial/final
    }
  });
})();
