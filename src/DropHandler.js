import Crunker from "crunker";
export default class DropHandler {
  constructor(morphaweb) {
    this.morphaweb = morphaweb;
    this.overlay = document.getElementById("overlay");
    this.messageOverlay = document.getElementById("message-overlay");
    this.messageText = document.getElementById("message-text");
    this.crunker = null; // Will be initialized with the correct sample rate when loading files

    document.addEventListener("dragover", this.allowDrop.bind(this));
    document.addEventListener("drop", this.onDrop.bind(this));
  }

  allowDrop(e) {
    this.overlayShow();
    e.preventDefault();
  }

  showMessage(text, duration = 10000) {
    this.messageText.textContent = text;
    this.messageOverlay.classList.add("show");

    setTimeout(() => {
      this.messageOverlay.classList.remove("show");
    }, duration);
  }

  // Function to read the original sample rate from WAV file header
  getOriginalSampleRate(arrayBuffer) {
    try {
      const dataView = new DataView(arrayBuffer);

      // Check if it's a WAV file (RIFF header)
      const riffHeader = String.fromCharCode(
        dataView.getUint8(0),
        dataView.getUint8(1),
        dataView.getUint8(2),
        dataView.getUint8(3)
      );

      if (riffHeader !== 'RIFF') {
        console.log('Not a WAV file, cannot detect original sample rate');
        return null;
      }

      // Check WAVE format
      const waveHeader = String.fromCharCode(
        dataView.getUint8(8),
        dataView.getUint8(9),
        dataView.getUint8(10),
        dataView.getUint8(11)
      );

      if (waveHeader !== 'WAVE') {
        console.log('Not a valid WAV file');
        return null;
      }

      // Sample rate is at byte offset 24 (little-endian 32-bit integer)
      const sampleRate = dataView.getUint32(24, true);
      // console.log(`Original file sample rate from header: ${sampleRate} Hz`);
      return sampleRate;
    } catch (error) {
      console.error('Error reading WAV header:', error);
      return null;
    }
  }

  async loadFiles(files) {
    const MAX_DURATION_SECONDS = 174; // 2.9 minutes in seconds

    let audioBuffers = [];
    let audioCtx;
    let markers = [];
    let offset = 0;
    let originalSampleRate = null;
    const fileArray = [...files];
    const promise = fileArray.map(async (file) => {
      console.log(file);
      await file.arrayBuffer().then(
        async (buf) => {
          // Detect original sample rate from file header before AudioContext processes it
          originalSampleRate = this.getOriginalSampleRate(buf);
          audioCtx = new AudioContext({
            sampleRate: originalSampleRate || 44100, // Fallback to 44100 Hz if not detected}
          });
          const p = await audioCtx.decodeAudioData(buf).then(
            async (decodedBuf) => {
              console.log("=== LOAD DEBUG INFO ===")
              console.log("Loaded file:", file.name);
              console.log(`Sample rate (from header): ${originalSampleRate} Hz`);
              console.log(`AudioContext decoded sample rate: ${decodedBuf.sampleRate} Hz`);
              console.log(`Audio channels: ${decodedBuf.numberOfChannels}`);
              console.log(`Buffer length: ${decodedBuf.length}`);
              console.log(`Audio duration: ${decodedBuf.duration} seconds`);
              console.log(`AudioContext sample rate: ${audioCtx.sampleRate}`);

              // Store the ORIGINAL sample rate from the file header for the first file
              if (audioBuffers.length === 0) {
                const sampleRateToUse = originalSampleRate || decodedBuf.sampleRate;
                this.morphaweb.wavHandler.setOriginalSampleRate(sampleRateToUse);
                // Initialize Crunker with the original sample rate to avoid unwanted resampling
                this.crunker = new Crunker({ sampleRate: sampleRateToUse });
                console.log(`Crunker initialized with sample rate: ${sampleRateToUse}`);
              }
              console.log("========================");

              if (decodedBuf.duration > MAX_DURATION_SECONDS) {
                const truncatedBuffer = audioCtx.createBuffer(
                  decodedBuf.numberOfChannels,
                  Math.floor(MAX_DURATION_SECONDS * decodedBuf.sampleRate),
                  decodedBuf.sampleRate,
                );

                for (
                  let channel = 0;
                  channel < decodedBuf.numberOfChannels;
                  channel++
                ) {
                  truncatedBuffer.copyToChannel(
                    decodedBuf
                      .getChannelData(channel)
                      .slice(
                        0,
                        Math.floor(MAX_DURATION_SECONDS * decodedBuf.sampleRate),
                      ),
                    channel,
                  );
                }

                this.showMessage(
                  `Audio file longer than ${MAX_DURATION_SECONDS / 60} minutes. It has been truncated.`,
                );
                decodedBuf = truncatedBuffer;
              }

              let m = await this.morphaweb.wavHandler.getMarkersFromFile(file);
              m = m.map((mm, i) => {
                mm.position += offset;
                return mm;
              });
              markers.push(...m);
              // add marker between multiple files
              markers.push({ position: decodedBuf.duration * 1000 });
              offset += decodedBuf.duration * 1000;
              audioBuffers.push(decodedBuf);
            },
            () => {
              this.morphaweb.track("ErrorFileUploadMarkers");
            },
          );
          return p;
        },
        () => {
          this.morphaweb.track("ErrorFileUpload");
        },
      );
    });
    const resolvedPromises = await Promise.all(promise);
    markers.pop();

    // Ensure crunker is initialized (fallback to 44100 Hz if no files were processed)
    if (!this.crunker) {
      this.crunker = new Crunker({ sampleRate: 44100 });
      console.log("Fallback: Crunker initialized with 44100 Hz");
    }

    const concatted = this.crunker.concatAudio(audioBuffers);
    const ex = this.crunker.export(concatted, "audio/wav");
    const obj = {
      blob: ex.blob,
      markers: markers,
      sampleRate: originalSampleRate,
    };
    return obj;
  }

  onDrop(e) {
    e.preventDefault();
    this.overlayHide();
    this.morphaweb.wavesurfer.clearMarkers();
    this.loadFiles(e.dataTransfer.files).then((res) => {
      this.morphaweb.wavesurfer.loadBlob(res.blob);
      this.morphaweb.wavesurfer.sampleRate = res.sampleRate;
      this.morphaweb.wavHandler.markers = res.markers;
    });
  }

  // Add a method to allow file input loading from ControlsHandler
  loadFilesFromInput(files) {
    this.overlayHide();
    return this.loadFiles(files);
  }

  overlayShow() {
    this.overlay.style.display = "block";
  }

  overlayHide() {
    this.overlay.style.display = "none";
  }
}
