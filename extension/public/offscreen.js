let mediaRecorder;
let recordedChunks = [];

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_RECORDING') {
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

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // Send chunk to background script
        const reader = new FileReader();
        reader.onload = () => {
            chrome.runtime.sendMessage({
                type: 'RECORDING_CHUNK',
                chunk: reader.result,
                sessionId: sessionId
            });
        };
        reader.readAsDataURL(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      mediaRecorder = null;
    };

    // Record in 5-second chunks
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
