import WaveSurfer from "wavesurfer.js";
import MarkersPlugin from "wavesurfer.js/src/plugin/markers";
import RegionsPlugin from "wavesurfer.js/src/plugin/regions";
import TimelinePlugin from "wavesurfer.js/src/plugin/timeline";
import CursorPlugin from "wavesurfer.js/src/plugin/cursor";
import DropHandler from "./DropHandler";
import ControlsHandler from "./ControlsHandler";
import MarkerHandler from "./MarkerHandler";
import WavHandler from "./WavHandler";
import OnsetHandler from "./OnsetHandler";
import AlgorithmControls from "./AlgorithmControls";

export default class Morphaweb {
  constructor() {
    this.scrollPos = 0;
    this.scrollMin = 0;
    this.playOffset = 0;

    this.wavesurfer = WaveSurfer.create({
      container: "#waveform",
      waveColor: "#ffd000",
      progressColor: "white",
      plugins: [
        MarkersPlugin.create(),
        RegionsPlugin.create(),
        TimelinePlugin.create({
          container: "#waveform-timeline",
          primaryFontColor: "white",
          secondaryFontColor: "white",
          primaryColor: "#ffd000",
          secondaryColor: "#ffd000",
          primaryFontSize: 12,
          secondaryFontSize: 10,
          height: 15,
          notchPercentHeight: 30,
          unlabeledNotchColor: "#ffd000",
          labelPadding: 5,
          formatTimeCallback: (seconds) => {
            return this.formatTime(seconds);
          },
        }),
        CursorPlugin.create({
          showTime: true,
          opacity: 1,
          customShowTimeStyle: {
            "background-color": "#000",
            color: "#fff",
            padding: "2px",
            "font-size": "10px",
          },
        }),
      ],
      minPxPerSec: 20,
      cursorWidth: 1,
      cursorColor: "#ff0000",
    });

    this.dropHandler = new DropHandler(this);
    this.markerHandler = new MarkerHandler(this);
    this.controlsHandler = new ControlsHandler(this);
    this.wavHandler = new WavHandler();
    this.onsetHandler = new OnsetHandler(this);
    this.algorithmControls = new AlgorithmControls(this);

    this.initAnalytics();

    this.wavesurfer.on("ready", this.onReady.bind(this));

    // Add containers for BPM info
    this.createInfoDisplay();

    // Set up zoom change listener
    this.setupZoomListener();
  }

  onReady = async () => {
    this.scrollMin = Math.round(
      this.wavesurfer.container.scrollWidth / this.wavesurfer.getDuration(),
    );
    this.scrollPos = this.scrollMin;
    this.markerHandler.addMarkers(this.wavHandler.markers);

    // Update all displays when audio is ready
    this.updateAllDisplays();
  };

  initAnalytics() {
    const exportButton = document.getElementById("export");
    exportButton.addEventListener("click", (e) => {
      this.track("export");
    });
  }

  track(e) {
    return;
  }

  detectOnsets() {
    const buffer = this.wavesurfer.backend.buffer;
    if (!buffer) {
      console.error("No audio loaded");
      return;
    }

    const audioData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    this.onsetHandler.detectOnsets(audioData, sampleRate);
  }

  createInfoDisplay() {
    // Create container for BPM info
    const container = document.createElement("div");
    container.id = "audio-info";
    container.className = "audio-info";

    // Create BPM display
    this.bpmDisplay = document.createElement("div");
    this.bpmDisplay.id = "bpm-display";
    container.appendChild(this.bpmDisplay);

    // Insert after waveform
    const waveform = document.getElementById("waveform");
    waveform.parentNode.insertBefore(container, waveform.nextSibling);
  }

  updateBPM(bpm) {
    if (this.bpmDisplay) {
      this.bpmDisplay.textContent = `BPM: ${bpm}`;
    }
  }

  // Format time in MM:SS format
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // Update zoom level display
  updateZoomDisplay() {
    const zoomElement = document.getElementById("zoom-level");
    if (zoomElement && this.wavesurfer) {
      const zoomLevel = this.wavesurfer.params.minPxPerSec || 20;
      zoomElement.textContent = `Zoom: ${zoomLevel} px/sec`;
    }
  }

  // Update audio duration display
  updateDurationDisplay() {
    const durationElement = document.getElementById("audio-duration");
    if (durationElement && this.wavesurfer) {
      const duration = this.wavesurfer.getDuration();
      if (duration > 0) {
        durationElement.textContent = `Duration: ${this.formatTime(duration)}`;
      } else {
        durationElement.textContent = "Duration: --:--";
      }
    }
  }

  // Update region information displays
  updateRegionDisplays() {
    this.updateCropRegionDisplay();
    this.updateFadeRegionDisplays();
  }

  // Update crop region display
  updateCropRegionDisplay() {
    const cropElement = document.getElementById("crop-info");
    if (cropElement && this.controlsHandler.cropRegion) {
      const start = this.controlsHandler.cropRegion.start;
      const end = this.controlsHandler.cropRegion.end;
      cropElement.textContent = `Crop: ${this.formatTime(start)} - ${this.formatTime(end)}`;
      cropElement.style.display = "block";
    } else if (cropElement) {
      cropElement.style.display = "none";
    }
  }

  // Update fade region displays
  updateFadeRegionDisplays() {
    const fadeInElement = document.getElementById("fade-in-info");
    const fadeOutElement = document.getElementById("fade-out-info");

    if (fadeInElement && this.controlsHandler.fadeInRegion) {
      const start = this.controlsHandler.fadeInRegion.start;
      const end = this.controlsHandler.fadeInRegion.end;
      fadeInElement.textContent = `Fade In: ${this.formatTime(start)} - ${this.formatTime(end)}`;
      fadeInElement.style.display = "block";
    } else if (fadeInElement) {
      fadeInElement.style.display = "none";
    }

    if (fadeOutElement && this.controlsHandler.fadeOutRegion) {
      const start = this.controlsHandler.fadeOutRegion.start;
      const end = this.controlsHandler.fadeOutRegion.end;
      fadeOutElement.textContent = `Fade Out: ${this.formatTime(start)} - ${this.formatTime(end)}`;
      fadeOutElement.style.display = "block";
    } else if (fadeOutElement) {
      fadeOutElement.style.display = "none";
    }
  }

  // Update all displays
  updateAllDisplays() {
    this.updateZoomDisplay();
    this.updateDurationDisplay();
    this.updateRegionDisplays();
  }

  // Set up zoom change listener
  setupZoomListener() {
    // Listen for zoom changes from wavesurfer
    this.wavesurfer.on("zoom", (minPxPerSec) => {
      this.updateZoomDisplay();
    });
  }
}
