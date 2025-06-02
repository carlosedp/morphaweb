export default class OnsetHandler {
  constructor(morphaweb) {
    this.morphaweb = morphaweb;
    this.worker = null;
    this.initWorker();
    this.initKeyboardControls();
  }

  initWorker() {
    this.worker = new Worker(
      new URL("./workers/onset-worker.js", import.meta.url),
      { type: "module" },
    );

    this.worker.onmessage = (e) => {
      // Remove loading state when processing is done
      this.setLoadingState(false);

      if (e.data.error) {
        console.error("Onset detection error:", e.data.error);
        return;
      }

      if (e.data.onsets) {
        console.log("onsets", e.data.onsets);
        this.morphaweb.markerHandler.createOnsetMarkers(e.data.onsets);
      }

      if (e.data.bpm !== null) {
        this.morphaweb.updateBPM(e.data.bpm);
      }
    };
  }

  setLoadingState(isLoading) {
    const container = this.morphaweb.wavesurfer.container;
    if (isLoading) {
      container.classList.add("wavesurfer-loading");
    } else {
      container.classList.remove("wavesurfer-loading");
    }
  }

  detectOnsets(audioData, sampleRate) {
    if (!this.worker) {
      console.error("Worker not initialized");
      return;
    }

    // Set loading state before starting processing
    this.setLoadingState(true);

    // Convert audio data to the format expected by Essentia.js
    const float32Array = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      float32Array[i] = audioData[i];
    }

    this.worker.postMessage({
      type: "processAudio",
      audioData: float32Array,
      sampleRate,
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  initKeyboardControls() {
    document.addEventListener("keydown", (e) => {
      // Number keys 1-9 and 0 (for 10th slice)
      if ((e.key >= "1" && e.key <= "9") || e.key === "0") {
        const index = e.key === "0" ? 9 : parseInt(e.key) - 1;
        this.playSliceByIndex(index);
      }

      // QWERTY row for indices 10-19
      const qwertyKeys = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
      const keyIndex = qwertyKeys.indexOf(e.key.toLowerCase());
      if (keyIndex !== -1) {
        this.playSliceByIndex(keyIndex + 10);
      }
    });
  }

  playSliceByIndex(index) {
    const markers = this.morphaweb.markerHandler.getMarkers();
    if (index < markers.length) {
      // Get audio data
      const audioData =
        this.morphaweb.wavesurfer.backend.buffer.getChannelData(0);
      const sampleRate = this.morphaweb.wavesurfer.backend.buffer.sampleRate;

      // Get the current marker time and next marker time (or audio end)
      const startTime = markers[index];
      const endTime =
        index < markers.length - 1
          ? markers[index + 1]
          : this.morphaweb.wavesurfer.getDuration();

      // Convert times to sample indices
      const startSample = Math.round(startTime.time * sampleRate);
      const endSample = Math.round(endTime.time * sampleRate);

      // Find nearest zero crossings
      const snappedStartSample = this.findNearestZeroCrossing(
        audioData,
        startSample,
      );
      const snappedEndSample = this.findNearestZeroCrossing(
        audioData,
        endSample,
      );

      // Convert back to time
      const snappedStartTime = snappedStartSample / sampleRate;
      const snappedEndTime = snappedEndSample / sampleRate;

      // Create a temporary region for playback
      const region = this.morphaweb.wavesurfer.addRegion({
        start: snappedStartTime,
        end: snappedEndTime,
        color: "hsla(358, 57%, 79%, 0.2)",
      });

      // Play the region
      region.play();

      // Remove the temporary region after playback
      region.once("out", () => {
        region.remove();
      });
    }
  }

  findNearestZeroCrossing(audioData, index, maxOffset = 100) {
    // Search within maxOffset samples in both directions
    let left = Math.max(0, index - maxOffset);
    let right = Math.min(audioData.length - 1, index + maxOffset);

    // Start from the index and move outward
    for (let offset = 0; offset <= maxOffset; offset++) {
      // Check forward
      let forwardIndex = index + offset;
      if (forwardIndex <= right) {
        if (this.isZeroCrossing(audioData, forwardIndex)) {
          return forwardIndex;
        }
      }

      // Check backward
      let backwardIndex = index - offset;
      if (backwardIndex >= left) {
        if (this.isZeroCrossing(audioData, backwardIndex)) {
          return backwardIndex;
        }
      }
    }

    // If no zero crossing found, return original index
    return index;
  }

  isZeroCrossing(audioData, index) {
    // Check if this point represents a zero crossing
    // We check if the signal crosses zero between this sample and the next
    if (index >= audioData.length - 1) return false;

    const current = audioData[index];
    const next = audioData[index + 1];

    // Check if the signal crosses zero (changes sign)
    return (current <= 0 && next > 0) || (current >= 0 && next < 0);
  }
}
