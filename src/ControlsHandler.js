import { throttle } from "lodash";
export default class ControlsHandler {
  constructor(morphaweb) {
    this.morphaweb = morphaweb;
    this.playButton = document.getElementById("play");
    this.zoomSlider = document.querySelector('input[type="range"]');
    this.exportButton = document.getElementById("export");
    this.sliceButton = document.getElementById("auto-slice");
    this.sliceCountInput = document.getElementById("slice-count");
    this.detectOnsetsButton = document.getElementById("detect-onsets");
    this.divideMarkersButton = document.getElementById("divide-markers");
    this.createCropRegionButton = document.getElementById("create-crop-region");
    this.cropAudioButton = document.getElementById("crop-audio");
    this.clearCropRegionButton = document.getElementById("clear-crop-region");
    this.createFadeInRegionButton = document.getElementById(
      "create-fade-in-region",
    );
    this.createFadeOutRegionButton = document.getElementById(
      "create-fade-out-region",
    );
    this.applyFadesButton = document.getElementById("apply-fades");
    this.clearFadeRegionsButton = document.getElementById("clear-fade-regions");
    this.waveform = document.getElementById("waveform");
    this.waveformLoadOverlay = document.getElementById("waveform-load-overlay");
    this.waveformFileInput = document.getElementById("waveform-file-input");

    // Crop region state
    this.cropRegion = null;

    // Fade region state
    this.fadeInRegion = null;
    this.fadeOutRegion = null;

    // Initial state - disable buttons
    this.setButtonsState(true);

    // Add listeners
    this.exportButton.addEventListener("click", this.exportWavFile);
    this.playButton.addEventListener("click", this.playToggle);
    this.sliceButton.addEventListener("click", this.handleAutoSlice);
    this.detectOnsetsButton.addEventListener(
      "click",
      this.handleOnsetDetection,
    );
    this.divideMarkersButton.addEventListener("click", this.divideMarkersByTwo);
    this.sliceCountInput.addEventListener("input", this.validateSliceCount);
    this.createCropRegionButton.addEventListener(
      "click",
      this.createCropRegion,
    );
    this.cropAudioButton.addEventListener("click", this.cropToSelection);
    this.clearCropRegionButton.addEventListener("click", this.clearCropRegion);
    this.createFadeInRegionButton.addEventListener(
      "click",
      this.createFadeInRegion,
    );
    this.createFadeOutRegionButton.addEventListener(
      "click",
      this.createFadeOutRegion,
    );
    this.applyFadesButton.addEventListener("click", this.applyFades);
    this.clearFadeRegionsButton.addEventListener(
      "click",
      this.clearFadeRegions,
    );
    this.zoomSlider.addEventListener("input", (e) => {
      const minPxPerSec = e.target.valueAsNumber;
      this.morphaweb.wavesurfer.zoom(minPxPerSec);
      // Update zoom display
      this.morphaweb.updateZoomDisplay();
    });

    document.addEventListener("keydown", this.onKeydown.bind(this));
    this.morphaweb.wavesurfer.on("seek", this.onSeek.bind(this));
    this.morphaweb.wavesurfer.on("finish", this.onFinish.bind(this));
    this.morphaweb.wavesurfer.on("ready", () => {
      this.setButtonsState(false);
      this.clearCropRegion(); // Clear any existing crop region when new audio loads
      this.clearFadeRegions(); // Clear any existing fade regions when new audio loads
      // Update all displays when audio is ready
      this.morphaweb.updateAllDisplays();
    });
    window.addEventListener("wheel", throttle(this.onWheel.bind(this), 10), {
      passive: false,
    });

    // Prevent spacebar from scrolling the page
    window.addEventListener("keydown", function (e) {
      if (e.code === "Space" && e.target == document.body) {
        e.preventDefault();
      }
    });

    document.addEventListener(
      "markers-changed",
      this.updateDivideButton.bind(this),
    );

    // Initial states
    this.updateDivideButton();
    this.validateSliceCount();

    // Overlay click opens file dialog
    this.waveformLoadOverlay.addEventListener("click", () => {
      this.waveformFileInput.click();
    });
    // File input loads file
    this.waveformFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.morphaweb.dropHandler.overlayHide();
        this.morphaweb.dropHandler.loadFiles(e.target.files).then((res) => {
          this.morphaweb.wavesurfer.loadBlob(res.blob);
          this.morphaweb.wavHandler.markers = res.markers;
        });
      }
    });
    // Show/hide overlay based on audio loaded
    this.morphaweb.wavesurfer.on("ready", () => {
      this.hideWaveformLoadOverlay();
    });
    this.morphaweb.wavesurfer.on("destroy", () => {
      this.showWaveformLoadOverlay();
    });
    // If no audio loaded at start, show overlay
    if (
      !this.morphaweb.wavesurfer.backend ||
      !this.morphaweb.wavesurfer.backend.buffer
    ) {
      this.showWaveformLoadOverlay();
    }
  }

  setButtonsState = (disabled) => {
    this.playButton.disabled = disabled;
    this.exportButton.disabled = disabled;
    this.sliceButton.disabled = disabled;
    this.detectOnsetsButton.disabled = disabled;
    this.sliceCountInput.disabled = disabled;
    this.createCropRegionButton.disabled = disabled;
    this.createFadeInRegionButton.disabled = disabled;
    this.createFadeOutRegionButton.disabled = disabled;
    // Don't enable crop, fade apply, and clear buttons here as they have their own logic
  };

  validateSliceCount = () => {
    const value = parseInt(this.sliceCountInput.value);
    const min = parseInt(this.sliceCountInput.min);

    if (isNaN(value) || value < min) {
      this.sliceCountInput.value = min;
    }

    // Disable slice button if no valid number or no audio loaded
    this.sliceButton.disabled =
      isNaN(value) ||
      value < min ||
      this.morphaweb.wavesurfer.getDuration() === 0;
  };

  exportWavFile = () => {
    try {
      if (this.morphaweb.wavesurfer.getDuration() === 0) {
        return false;
      }

      const audioBuffer = this.morphaweb.wavesurfer.backend.buffer;

      // Store the original sample rate from the audio buffer
      this.morphaweb.wavHandler.setOriginalSampleRate(audioBuffer.sampleRate);
      // this.morphaweb.wavHandler.setOriginalSampleRate(this.morphaweb.wavesurfer.sampleRate);

      const buffer = [audioBuffer.getChannelData(0)];

      try {
        buffer.push(audioBuffer.getChannelData(1));
      } catch (error) {
        // Duplicate L channel to R channel
        buffer.push(audioBuffer.getChannelData(0));
        console.log("No second channel");
      }

      const markers = this.morphaweb.wavesurfer.markers.markers;
      this.morphaweb.wavHandler.createFileFromBuffer(buffer, markers);
    } catch (error) {
      console.log(error);
      this.morphaweb.track("ErrorExportWavFile");
    }
  };

  playToggle = () => {
    const playButton = document.getElementById("play");
    const isPlaying = this.morphaweb.wavesurfer.isPlaying();

    if (isPlaying) {
      this.morphaweb.wavesurfer.pause();
      playButton.textContent = "⏸ play/pause";
    } else {
      this.morphaweb.wavesurfer.play();
      playButton.textContent = "⏵ play/pause";
    }
  };

  onSeek = (p) => {
    this.morphaweb.playOffset = p;
    this.morphaweb.markerHandler.removeTopMarker("top");
    this.morphaweb.markerHandler.createMarker(
      this.morphaweb.playOffset * this.morphaweb.wavesurfer.getDuration(),
      "top",
    );
    // this.morphaweb.wavesurfer.play()
  };

  onFinish = () => {
    // Start playback from the beginning
    this.morphaweb.wavesurfer.seekTo(0);
    this.morphaweb.wavesurfer.play();
  };

  onWheel = (e) => {
    // Check if mouse is over the waveform div or any of its children
    const waveformDiv = document.getElementById("waveform");

    // Check if the event target is the waveform div or inside it
    let isOverWaveform = false;
    if (waveformDiv) {
      isOverWaveform =
        waveformDiv.contains(e.target) ||
        e.target === waveformDiv ||
        e.target.closest("#waveform") !== null;
    }

    if (isOverWaveform) {
      // Mouse is over waveform - control zoom and prevent page scroll
      e.preventDefault();
      e.stopPropagation();

      if (this.morphaweb.scrollPos + e.deltaY >= this.morphaweb.scrollMin) {
        this.morphaweb.scrollPos = this.morphaweb.scrollPos + e.deltaY;
        this.morphaweb.wavesurfer.zoom(this.morphaweb.scrollPos);

        // Sync the zoom slider with the new zoom level
        if (this.zoomSlider) {
          this.zoomSlider.value = this.morphaweb.scrollPos;
        }

        // Update zoom display
        this.morphaweb.updateZoomDisplay();
      }
      return false; // Additional prevention
    }
    // If mouse is outside waveform div, do nothing - let browser handle page scroll
  };

  onKeydown = (e) => {
    switch (e.key) {
      case "j":
      case "J":
        this.morphaweb.markerHandler.createMarkerAtCurrentPosition();
        break;
      case "k":
      case "K":
        this.morphaweb.markerHandler.removeSelectedMarker();
        break;
      case " ":
        this.playToggle();
        break;
      case "c":
      case "C":
        if (!this.createCropRegionButton.disabled) {
          this.createCropRegion();
        }
        break;
      case "x":
      case "X":
        if (!this.cropAudioButton.disabled) {
          this.cropToSelection();
        }
        break;
      case "Escape":
        if (!this.clearCropRegionButton.disabled) {
          this.clearCropRegion();
        }
        break;
      case "f":
      case "F":
        if (!this.createFadeInRegionButton.disabled) {
          this.createFadeInRegion();
        }
        break;
      case "g":
      case "G":
        if (!this.createFadeOutRegionButton.disabled) {
          this.createFadeOutRegion();
        }
        break;
      case "a":
      case "A":
        if (!this.applyFadesButton.disabled) {
          this.applyFades();
        }
        break;
    }
  };

  handleAutoSlice = () => {
    if (this.morphaweb.wavesurfer.getDuration() === 0) {
      return false;
    }
    const numberOfSlices = parseInt(this.sliceCountInput.value);

    this.morphaweb.markerHandler.clearAllMarkers();
    this.morphaweb.markerHandler.createAutoSlices(numberOfSlices);
    this.morphaweb.track("AutoSlice");
  };

  handleOnsetDetection = () => {
    try {
      if (this.morphaweb.wavesurfer.getDuration() === 0) {
        return false;
      }
      this.morphaweb.detectOnsets();
      this.morphaweb.track("OnsetDetection");
    } catch (error) {
      this.morphaweb.track("ErrorOnsetDetection");
    }
  };

  updateDivideButton = (event) => {
    const markerCount = this.morphaweb.markerHandler.getBottomMarkers().length;
    this.divideMarkersButton.disabled = markerCount < 2;
  };

  divideMarkersByTwo = () => {
    try {
      if (!this.morphaweb.markerHandler.hasEnoughMarkers()) {
        return;
      }
      this.morphaweb.markerHandler.divideMarkersByTwo();
      this.morphaweb.track("DivideMarkersByTwo");
    } catch (error) {
      this.morphaweb.track("ErrorDivideMarkersByTwo");
    }
  };

  createCropRegion = () => {
    try {
      if (this.morphaweb.wavesurfer.getDuration() === 0) {
        return false;
      }

      // Clear existing crop region if any
      this.clearCropRegion();

      // Create a new crop region at the center third of the audio
      const duration = this.morphaweb.wavesurfer.getDuration();
      const start = duration * 0.25;
      const end = duration * 0.75;

      this.cropRegion = this.morphaweb.wavesurfer.addRegion({
        start: start,
        end: end,
        color: "rgba(255, 208, 0, 0.3)", // Yellow with transparency
        drag: true,
        resize: true,
        id: "crop-region",
      });

      // Update button states
      this.cropAudioButton.disabled = false;
      this.clearCropRegionButton.disabled = false;
      this.createCropRegionButton.disabled = true;

      // Add region event listeners
      this.cropRegion.on("update-end", () => {
        this.showMessage(
          `Crop region: ${this.formatTime(this.cropRegion.start)} - ${this.formatTime(this.cropRegion.end)}`,
        );
        // Update region displays
        this.morphaweb.updateRegionDisplays();
      });

      this.showMessage(`Crop region created. Drag edges to adjust selection.`);
      // Update region displays
      this.morphaweb.updateRegionDisplays();
      this.morphaweb.track("CreateCropRegion");
    } catch (error) {
      this.morphaweb.track("ErrorCreateCropRegion");
      console.error("Error creating crop region:", error);
    }
  };

  cropToSelection = () => {
    try {
      if (!this.cropRegion || this.morphaweb.wavesurfer.getDuration() === 0) {
        return false;
      }

      const startTime = this.cropRegion.start;
      const endTime = this.cropRegion.end;

      if (startTime >= endTime) {
        this.showMessage(
          "Invalid crop region: start time must be before end time",
        );
        return;
      }

      // Get the original audio buffer
      const originalBuffer = this.morphaweb.wavesurfer.backend.buffer;
      const sampleRate = originalBuffer.sampleRate;
      const channelCount = originalBuffer.numberOfChannels;

      // Get audio data for zero crossing detection (use first channel)
      const audioData = originalBuffer.getChannelData(0);

      // Calculate initial sample positions
      const initialStartSample = Math.floor(startTime * sampleRate);
      const initialEndSample = Math.floor(endTime * sampleRate);

      // Find nearest zero crossings to prevent clicks
      const startSample = this.findNearestZeroCrossing(
        audioData,
        initialStartSample,
      );
      const endSample = this.findNearestZeroCrossing(
        audioData,
        initialEndSample,
      );
      const croppedLength = endSample - startSample;

      // Log the adjustments made
      const startAdjustment =
        (Math.abs(startSample - initialStartSample) / sampleRate) * 1000;
      const endAdjustment =
        (Math.abs(endSample - initialEndSample) / sampleRate) * 1000;
      console.log(
        `Zero crossing adjustments - Start: ${startAdjustment.toFixed(2)}ms, End: ${endAdjustment.toFixed(2)}ms`,
      );

      // Create new audio buffer for cropped audio
      const audioContext = this.morphaweb.wavesurfer.backend.ac;
      const croppedBuffer = audioContext.createBuffer(
        channelCount,
        croppedLength,
        sampleRate,
      );

      // Copy cropped audio data for each channel
      for (let channel = 0; channel < channelCount; channel++) {
        const originalChannelData = originalBuffer.getChannelData(channel);
        const croppedChannelData = croppedBuffer.getChannelData(channel);

        for (let i = 0; i < croppedLength; i++) {
          croppedChannelData[i] = originalChannelData[startSample + i];
        }
      }

      // Load the cropped buffer into wavesurfer
      this.morphaweb.wavesurfer.loadDecodedBuffer(croppedBuffer);

      // Calculate actual crop times after zero-crossing adjustment
      const actualStartTime = startSample / sampleRate;
      const actualEndTime = endSample / sampleRate;

      // Adjust existing markers to new timeline
      this.adjustMarkersForCrop(actualStartTime, actualEndTime);

      // Clear crop region
      this.clearCropRegion();

      // Show message with adjustment info
      const hasAdjustments = startAdjustment > 1 || endAdjustment > 1; // Show if >1ms adjustment
      const adjustmentInfo = hasAdjustments
        ? ` (adjusted ${startAdjustment.toFixed(1)}ms/${endAdjustment.toFixed(1)}ms to prevent clicks)`
        : " (snapped to zero crossings)";

      this.showMessage(
        `Audio cropped from ${this.formatTime(actualStartTime)} to ${this.formatTime(actualEndTime)}${adjustmentInfo}`,
      );

      // Update duration display after cropping
      this.morphaweb.updateDurationDisplay();
      this.morphaweb.track("CropAudio");
    } catch (error) {
      this.morphaweb.track("ErrorCropAudio");
      console.error("Error cropping audio:", error);
      this.showMessage("Error cropping audio. Please try again.");
    }
  };

  clearCropRegion = () => {
    try {
      if (this.cropRegion) {
        this.cropRegion.remove();
        this.cropRegion = null;
      }

      // Update button states
      this.cropAudioButton.disabled = true;
      this.clearCropRegionButton.disabled = true;
      this.createCropRegionButton.disabled = false;

      // Update region displays
      this.morphaweb.updateRegionDisplays();
      this.morphaweb.track("ClearCropRegion");
    } catch (error) {
      this.morphaweb.track("ErrorClearCropRegion");
      console.error("Error clearing crop region:", error);
    }
  };

  // Zero-crossing detection methods for preventing clicks during cropping
  findNearestZeroCrossing(audioData, index, maxOffset = 1000) {
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

  adjustMarkersForCrop = (cropStart, cropEnd) => {
    try {
      const markers = this.morphaweb.markerHandler.getBottomMarkers();
      const cropDuration = cropEnd - cropStart;

      // Remove markers outside the crop region and adjust remaining ones
      markers.forEach((marker) => {
        if (marker.time < cropStart || marker.time > cropEnd) {
          // Remove markers outside crop region
          this.morphaweb.markerHandler.removeMarker(marker.time);
        } else {
          // Adjust marker time relative to new start
          const newTime = marker.time - cropStart;
          this.morphaweb.markerHandler.removeMarker(marker.time);
          this.morphaweb.markerHandler.createMarker(newTime, marker.position);
        }
      });
    } catch (error) {
      console.error("Error adjusting markers:", error);
    }
  };

  formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, "0")}`;
  };

  showMessage = (text) => {
    const messageOverlay = document.getElementById("message-overlay");
    const messageText = document.getElementById("message-text");

    messageText.textContent = text;
    messageOverlay.style.display = "block";

    // Auto-hide after 3 seconds
    setTimeout(() => {
      messageOverlay.style.display = "none";
    }, 3000);
  };

  interleaveChannels = (audioBuffer) => {
    const channelCount = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const result = new Float32Array(length * channelCount);

    for (let channel = 0; channel < channelCount; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        result[i * channelCount + channel] = channelData[i];
      }
    }

    return result;
  };

  createFadeInRegion = () => {
    try {
      if (this.morphaweb.wavesurfer.getDuration() === 0) {
        return false;
      }

      // Clear existing fade-in region if any
      if (this.fadeInRegion) {
        this.fadeInRegion.remove();
      }

      // Create a fade-in region at the beginning of the audio (first 10% or 2 seconds max)
      const duration = this.morphaweb.wavesurfer.getDuration();
      const fadeLength = Math.min(duration * 0.1, 2.0);

      this.fadeInRegion = this.morphaweb.wavesurfer.addRegion({
        start: 0,
        end: fadeLength,
        color: "rgba(0, 255, 0, 0.3)", // Green with transparency
        drag: true,
        resize: true,
        id: "fade-in-region",
      });

      // Update button states
      this.updateFadeButtonStates();

      // Add region event listeners
      this.fadeInRegion.on("update-end", () => {
        this.showMessage(
          `Fade-in region: ${this.formatTime(this.fadeInRegion.start)} - ${this.formatTime(this.fadeInRegion.end)}`,
        );
        // Update region displays
        this.morphaweb.updateRegionDisplays();
      });

      this.showMessage(
        `Fade-in region created. Drag edges to adjust fade length.`,
      );
      // Update region displays
      this.morphaweb.updateRegionDisplays();
      this.morphaweb.track("CreateFadeInRegion");
    } catch (error) {
      this.morphaweb.track("ErrorCreateFadeInRegion");
      console.error("Error creating fade-in region:", error);
    }
  };

  createFadeOutRegion = () => {
    try {
      if (this.morphaweb.wavesurfer.getDuration() === 0) {
        return false;
      }

      // Clear existing fade-out region if any
      if (this.fadeOutRegion) {
        this.fadeOutRegion.remove();
      }

      // Create a fade-out region at the end of the audio (last 10% or 2 seconds max)
      const duration = this.morphaweb.wavesurfer.getDuration();
      const fadeLength = Math.min(duration * 0.1, 2.0);
      const start = duration - fadeLength;

      this.fadeOutRegion = this.morphaweb.wavesurfer.addRegion({
        start: start,
        end: duration,
        color: "rgba(255, 0, 0, 0.3)", // Red with transparency
        drag: true,
        resize: true,
        id: "fade-out-region",
      });

      // Update button states
      this.updateFadeButtonStates();

      // Add region event listeners
      this.fadeOutRegion.on("update-end", () => {
        this.showMessage(
          `Fade-out region: ${this.formatTime(this.fadeOutRegion.start)} - ${this.formatTime(this.fadeOutRegion.end)}`,
        );
        // Update region displays
        this.morphaweb.updateRegionDisplays();
      });

      this.showMessage(
        `Fade-out region created. Drag edges to adjust fade length.`,
      );
      // Update region displays
      this.morphaweb.updateRegionDisplays();
      this.morphaweb.track("CreateFadeOutRegion");
    } catch (error) {
      this.morphaweb.track("ErrorCreateFadeOutRegion");
      console.error("Error creating fade-out region:", error);
    }
  };

  applyFades = () => {
    try {
      if (this.morphaweb.wavesurfer.getDuration() === 0) {
        return false;
      }

      if (!this.fadeInRegion && !this.fadeOutRegion) {
        this.showMessage(
          "No fade regions to apply. Create fade-in or fade-out regions first.",
        );
        return;
      }

      // Get the original audio buffer
      const originalBuffer = this.morphaweb.wavesurfer.backend.buffer;
      const sampleRate = originalBuffer.sampleRate;
      const channelCount = originalBuffer.numberOfChannels;
      const length = originalBuffer.length;

      // Create new audio buffer for faded audio
      const audioContext = this.morphaweb.wavesurfer.backend.ac;
      const fadedBuffer = audioContext.createBuffer(
        channelCount,
        length,
        sampleRate,
      );

      // Copy and apply fades to each channel
      for (let channel = 0; channel < channelCount; channel++) {
        const originalChannelData = originalBuffer.getChannelData(channel);
        const fadedChannelData = fadedBuffer.getChannelData(channel);

        // Copy original data
        for (let i = 0; i < length; i++) {
          fadedChannelData[i] = originalChannelData[i];
        }

        // Apply fade-in
        if (this.fadeInRegion) {
          const fadeInStartSample = Math.floor(
            this.fadeInRegion.start * sampleRate,
          );
          const fadeInEndSample = Math.floor(
            this.fadeInRegion.end * sampleRate,
          );
          const fadeInLength = fadeInEndSample - fadeInStartSample;

          for (let i = fadeInStartSample; i < fadeInEndSample; i++) {
            const progress = (i - fadeInStartSample) / fadeInLength;
            // Use a smooth fade curve (ease-in)
            const fadeMultiplier = progress * progress;
            fadedChannelData[i] *= fadeMultiplier;
          }
        }

        // Apply fade-out
        if (this.fadeOutRegion) {
          const fadeOutStartSample = Math.floor(
            this.fadeOutRegion.start * sampleRate,
          );
          const fadeOutEndSample = Math.floor(
            this.fadeOutRegion.end * sampleRate,
          );
          const fadeOutLength = fadeOutEndSample - fadeOutStartSample;

          for (let i = fadeOutStartSample; i < fadeOutEndSample; i++) {
            const progress = (i - fadeOutStartSample) / fadeOutLength;
            // Use a smooth fade curve (ease-out)
            const fadeMultiplier = 1 - progress * progress;
            fadedChannelData[i] *= fadeMultiplier;
          }
        }
      }

      // Load the faded buffer into wavesurfer
      this.morphaweb.wavesurfer.loadDecodedBuffer(fadedBuffer);

      // Clear fade regions after applying
      this.clearFadeRegions();

      this.showMessage("Fade effects applied successfully!");
      // Update duration display (though it shouldn't change)
      this.morphaweb.updateDurationDisplay();
      this.morphaweb.track("ApplyFades");
    } catch (error) {
      this.morphaweb.track("ErrorApplyFades");
      console.error("Error applying fades:", error);
      this.showMessage("Error applying fade effects. Please try again.");
    }
  };

  clearFadeRegions = () => {
    try {
      if (this.fadeInRegion) {
        this.fadeInRegion.remove();
        this.fadeInRegion = null;
      }

      if (this.fadeOutRegion) {
        this.fadeOutRegion.remove();
        this.fadeOutRegion = null;
      }

      // Update button states
      this.updateFadeButtonStates();

      // Update region displays
      this.morphaweb.updateRegionDisplays();
      this.morphaweb.track("ClearFadeRegions");
    } catch (error) {
      this.morphaweb.track("ErrorClearFadeRegions");
      console.error("Error clearing fade regions:", error);
    }
  };

  updateFadeButtonStates = () => {
    const hasFadeRegions = this.fadeInRegion || this.fadeOutRegion;
    this.applyFadesButton.disabled = !hasFadeRegions;
    this.clearFadeRegionsButton.disabled = !hasFadeRegions;
  };

  showWaveformLoadOverlay = () => {
    if (this.waveformLoadOverlay)
      this.waveformLoadOverlay.style.display = "flex";
  };
  hideWaveformLoadOverlay = () => {
    if (this.waveformLoadOverlay)
      this.waveformLoadOverlay.style.display = "none";
  };
}
