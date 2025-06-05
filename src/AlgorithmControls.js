export default class AlgorithmControls {
  constructor(morphaweb) {
    this.morphaweb = morphaweb;
    this.createControls();
    this.initializeDefaultValues();
  }

  createControls() {
    // const controlsContainer = document.createElement('div');
    const controlsContainer = document.getElementById("algorithm-controls");
    controlsContainer.className = "algorithm-controls";

    // Frame Size Slider
    const frameSizeControl = this.createSlider({
      id: "frame-size",
      label: "Frame Size",
      min: 512,
      max: 8192,
      value: 2048,
      step: 512,
      tooltip: "Size of audio chunks for analysis. Controls frequency resolution. Increase this when using the 'Complex' or 'Complex Phase' detection functions and a pitched sound.",
    });

    // Hop Size Slider (as percentage of frame size)
    const hopSizeControl = this.createSlider({
      id: "hop-size",
      label: "Hop Size %",
      min: 5,
      max: 100,
      value: 50,
      step: 1,
      tooltip: "Audio analysis frame rate, given as a percentage of the frame size. Lower values result in increased temporal resolution, but longer analysis time.",
    });

    // Sensitivity Slider
    const sensitivityControl = this.createSlider({
      id: "sensitivity",
      label: "Sensitivity %",
      min: 1,
      max: 100,
      value: 50,
      step: 1,
      tooltip: "Regulates the threshold for onset detection. Higher values tend to produce more false positives. Increase it if you know that your chosen audio has onsets but few or none are being displayed.",
    });

    // ODF Ratio Slider
    const odfRatioControl = this.createSlider({
      id: "odf-ratio",
      label: "ODF Ratio",
      min: 0,
      max: 100,
      value: 50,
      step: 10,
      helpText:
        "Higher values improve detection for percussive elements, lower values improve detection for pitch changes",
      tooltip: "To the right, this function computes the High Frequency Content (HFC) of a sound's spectrum. Great for detecting percussive events. To the left, reacts to deviations in pitch and changes in the frequency components of the sound. Measures spectral differences of both magnitude and phase between frames.",
    });

    controlsContainer.appendChild(frameSizeControl);
    controlsContainer.appendChild(hopSizeControl);
    controlsContainer.appendChild(sensitivityControl);
    controlsContainer.appendChild(odfRatioControl);

    // Insert controls before the existing controls
    const existingControls = document.querySelector(".controls");
    // existingControls.appendChild(controlsContainer);
    // existingControls.insertBefore(controlsContainer, existingControls.firstChild);
  }

  createSlider({ id, label, min, max, value, step, helpText, tooltip }) {
    const container = document.createElement("div");
    container.className = "slider-container";

    // Create a div to wrap the controls
    const controlsWrapper = document.createElement("div");
    controlsWrapper.className = "slider-controls";

    const labelElement = document.createElement("label");
    labelElement.htmlFor = id;
    labelElement.textContent = label;

    // Add tooltip to label if provided
    if (tooltip) {
      labelElement.title = tooltip;
    }

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = id;
    slider.min = min;
    slider.max = max;
    slider.value = value;
    slider.step = step;

    // Add tooltip to slider if provided
    if (tooltip) {
      slider.title = tooltip;
    }

    // Calculate and set the initial position percentage
    const percentage = ((value - min) / (max - min)) * 100;
    slider.style.setProperty("--value", percentage + "%");

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "slider-value";
    valueDisplay.textContent = Number(value).toFixed(
      String(step).split(".")[1]?.length || 0,
    );

    slider.addEventListener("input", (e) => {
      // Update the position when slider moves
      const percentage = ((e.target.value - min) / (max - min)) * 100;
      slider.style.setProperty("--value", percentage + "%");
      valueDisplay.textContent = Number(slider.value).toFixed(
        String(step).split(".")[1]?.length || 0,
      );
      this.handleSliderChange();
    });

    // Add elements to the controls wrapper
    controlsWrapper.appendChild(labelElement);
    controlsWrapper.appendChild(slider);
    controlsWrapper.appendChild(valueDisplay);

    // Add controls wrapper to main container
    container.appendChild(controlsWrapper);

    // Add help text if provided
    if (helpText) {
      const helpElement = document.createElement("div");
      helpElement.className = "slider-help-text";
      helpElement.textContent = helpText;
      container.appendChild(helpElement);
    }

    return container;
  }

  handleSliderChange() {
    const frameSize = parseInt(document.getElementById("frame-size").value);
    const hopSizePercent = parseInt(document.getElementById("hop-size").value);
    const sensitivity = parseFloat(
      document.getElementById("sensitivity").value,
    );
    const odfRatio = parseInt(document.getElementById("odf-ratio").value);

    const hopSize = Math.floor(frameSize * (hopSizePercent / 100));
    const hfcWeight = odfRatio / 100;
    const complexWeight = 1 - hfcWeight;

    let odfs, odfsWeights;

    if (odfRatio === 0) {
      // Use only complex
      odfs = ["complex"];
      odfsWeights = [1];
    } else if (odfRatio === 100) {
      // Use only HFC
      odfs = ["hfc"];
      odfsWeights = [1];
    } else {
      // Use both with weights
      odfs = ["hfc", "complex"];
      odfsWeights = [hfcWeight, complexWeight];
    }

    const params = {
      frameSize,
      hopSize,
      sensitivity: sensitivity / 100.0,
      odfs,
      odfsWeights,
    };

    if (this.morphaweb.onsetHandler) {
      this.morphaweb.onsetHandler.worker.postMessage({
        type: "updateParams",
        params,
      });
    }
  }

  initializeDefaultValues() {
    // Set initial values
    this.handleSliderChange();
  }
}
