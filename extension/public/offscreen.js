let mediaRecorder;
let recordedChunks = [];
let currentSessionId = null;
let currentToken = null;
let currentApiUrl = null;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_RECORDING') {
    currentToken = message.token;
    currentApiUrl = message.apiUrl;
    startRecording(message.streamId, message.sessionId);
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording();
  }
});

async function startRecording(streamId, sessionId) {
  if (mediaRecorder) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    });

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
    });

    currentSessionId = sessionId;
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
        // Send a lightweight signal to tick up the UI counter!
        chrome.runtime.sendMessage({
            type: 'CHUNK_ACQUIRED',
            chunkIndex: recordedChunks.length
        });
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      
      const blob = new Blob(recordedChunks, { type: 'video/webm;codecs=vp9' });
      
      if (currentToken && currentApiUrl && currentSessionId) {
        console.log("[Informant Offscreen] Initiating direct upload. Size:", blob.size);
        try {
          const formData = new FormData();
          formData.append('file', blob, `chunk_${Date.now()}.webm`);
          formData.append('session_id', currentSessionId);

          const response = await fetch(`${currentApiUrl}/api/extension/upload-chunk`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${currentToken}` },
              body: formData
          });

          if (response.ok) {
              const data = await response.json();
              console.log("[Informant Offscreen] Direct upload successful:", data);
              // Notify background/sidepanel that chunk is successfully indexed
              chrome.runtime.sendMessage({
                  type: 'CHUNK_INDEXED',
                  chunkIndex: data.chunk_index,
                  indexed: data.indexed
              });
          } else {
              console.error("[Informant Offscreen] Upload failed with status:", response.status);
          }
        } catch (uploadErr) {
          console.error("[Informant Offscreen] Direct upload error:", uploadErr);
        }
      } else {
        console.warn("[Informant Offscreen] Missing token, API URL or Session ID, skipping direct upload");
      }

      mediaRecorder = null;
      recordedChunks = [];
      currentSessionId = null;
      currentToken = null;
      currentApiUrl = null;
    };

    // Record continuously but fire ondataavailable every 5 seconds to tick the UI counter
    mediaRecorder.start(5000);
    console.log("Recording started in offscreen doc");

  } catch (err) {
    console.error("Failed to get media stream:", err);
  }
}

function stopRecording() {
  if (mediaRecorder) {
    mediaRecorder.stop();
    console.log("Recording stopped in offscreen doc");
  }
}
