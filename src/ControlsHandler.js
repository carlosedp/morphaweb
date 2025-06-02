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
    });

    document.addEventListener("keydown", this.onKeydown.bind(this));
    this.morphaweb.wavesurfer.on("seek", this.onSeek.bind(this));
    this.morphaweb.wavesurfer.on("finish", this.onFinish.bind(this));
    this.morphaweb.wavesurfer.on("ready", () => {
      this.setButtonsState(false);
      this.clearCropRegion(); // Clear any existing crop region when new audio loads
      this.clearFadeRegions(); // Clear any existing fade regions when new audio loads
    });
    window.addEventListener("wheel", throttle(this.onWheel.bind(this), 10));

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
      //if()

      const buffer = [
        this.morphaweb.wavesurfer.backend.buffer.getChannelData(0),
      ];

      try {
        buffer.push(this.morphaweb.wavesurfer.backend.buffer.getChannelData(1));
      } catch (error) {
        // Duplicate L channel to R channel
        buffer.push(this.morphaweb.wavesurfer.backend.buffer.getChannelData(0));
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
    if (this.morphaweb.scrollPos + e.deltaY >= this.morphaweb.scrollMin) {
      this.morphaweb.scrollPos = this.morphaweb.scrollPos + e.deltaY;
      this.morphaweb.wavesurfer.zoom(this.morphaweb.scrollPos);
    }
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
      });

      this.showMessage(`Crop region created. Drag edges to adjust selection.`);
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

      // Calculate sample positions
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.floor(endTime * sampleRate);
      const croppedLength = endSample - startSample;

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

      // Adjust existing markers to new timeline
      this.adjustMarkersForCrop(startTime, endTime);

      // Clear crop region
      this.clearCropRegion();

      this.showMessage(
        `Audio cropped from ${this.formatTime(startTime)} to ${this.formatTime(endTime)}`,
      );
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

      this.morphaweb.track("ClearCropRegion");
    } catch (error) {
      this.morphaweb.track("ErrorClearCropRegion");
      console.error("Error clearing crop region:", error);
    }
  };

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
      });

      this.showMessage(
        `Fade-in region created. Drag edges to adjust fade length.`,
      );
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
      });

      this.showMessage(
        `Fade-out region created. Drag edges to adjust fade length.`,
      );
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
}
