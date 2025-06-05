import { WaveFile } from "wavefile";
import { saveAs } from "file-saver";

export default class WavHandler {
  constructor() {
    this.markers = [];
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.originalSampleRate = null;
    this.targetSampleRate = 48000; // Always export at 48kHz
  }

  setOriginalSampleRate(sampleRate) {
    this.originalSampleRate = sampleRate;
    // console.log(`Original sample rate set to: ${sampleRate}`);
  }

  // Simple linear interpolation resampling
  resampleBuffer(inputBuffer, fromSampleRate, toSampleRate) {
    console.log("=== RESAMPLE FUNCTION DEBUG ===");
    console.log("From sample rate:", fromSampleRate);
    console.log("To sample rate:", toSampleRate);

    if (fromSampleRate === toSampleRate) {
      console.log("No resampling needed - sample rates match");
      return inputBuffer;
    }

    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(inputBuffer[0].length / ratio);
    console.log("Ratio:", ratio);
    console.log("Original length:", inputBuffer[0].length);
    console.log("New length:", newLength);
    console.log(
      "Original duration:",
      inputBuffer[0].length / fromSampleRate,
      "seconds",
    );
    console.log("New duration:", newLength / toSampleRate, "seconds");
    console.log("===============================");

    const resampledBuffer = [];

    for (let channel = 0; channel < inputBuffer.length; channel++) {
      const channelData = inputBuffer[channel];
      const newChannelData = new Float32Array(newLength);

      for (let i = 0; i < newLength; i++) {
        const sourceIndex = i * ratio;
        const index = Math.floor(sourceIndex);
        const fraction = sourceIndex - index;

        if (index + 1 < channelData.length) {
          // Linear interpolation
          newChannelData[i] =
            channelData[index] * (1 - fraction) +
            channelData[index + 1] * fraction;
        } else {
          newChannelData[i] = channelData[index] || 0;
        }
      }

      resampledBuffer.push(newChannelData);
    }

    return resampledBuffer;
  }

  async getMarkersFromFile(file) {
    return new Promise((resolve, reject) => {
      let fr = new FileReader();
      let cues = [];
      fr.readAsDataURL(file);
      fr.onloadend = () => {
        // Check if file is MP3 or WAV
        if (
          file.type === "audio/wav" ||
          file.type === "audio/wave" ||
          file.type === "audio/x-wav"
        ) {
          let f = new WaveFile();
          const base64String = fr.result
            .replace("data:", "")
            .replace(/^.+,/, "");
          f.fromBase64(base64String);
          cues = f.listCuePoints();
          resolve(cues);
        } else {
          // For MP3s, we won't have cue points initially
          resolve([]);
        }
      };
      fr.onerror = reject;
    });
  }

  async createFileFromBuffer(buffer, markers, formatOptions = {}) {
    // Default format options
    const {
      channels = 2,
      bitDepth = 32,
      sampleRate = 48000
    } = formatOptions;

    console.log("=== EXPORT FORMAT INFO ===");
    console.log("Export channels:", channels);
    console.log("Export bit depth:", bitDepth);
    console.log("Export sample rate:", sampleRate);
    console.log("==========================");

    const originalRate = this.originalSampleRate || 44100;

    console.log("=== EXPORT DEBUG INFO ===");
    console.log("Input buffer channels:", buffer.length);
    console.log("Input buffer length:", buffer[0].length);
    console.log("Original sample rate:", originalRate);
    console.log("Target sample rate:", sampleRate);
    console.log(
      "Original duration:",
      buffer[0].length / originalRate,
      "seconds",
    );

    // Check if resampling is needed
    const needsResampling = originalRate !== sampleRate;
    console.log("Needs resampling:", needsResampling);
    console.log("========================");

    // Only resample if sample rates are different
    const finalBuffer = needsResampling
      ? this.resampleBuffer(buffer, originalRate, sampleRate)
      : buffer;

    // Handle channel configuration
    let outputBuffer = finalBuffer;
    if (channels === 1 && finalBuffer.length === 2) {
      // Convert stereo to mono by averaging the channels
      const monoBuffer = new Float32Array(finalBuffer[0].length);
      for (let i = 0; i < finalBuffer[0].length; i++) {
        monoBuffer[i] = (finalBuffer[0][i] + finalBuffer[1][i]) / 2;
      }
      outputBuffer = [monoBuffer];
      console.log("Converted stereo to mono");
    } else if (channels === 2 && finalBuffer.length === 1) {
      // Convert mono to stereo by duplicating the channel
      outputBuffer = [finalBuffer[0], finalBuffer[0]];
      console.log("Converted mono to stereo");
    }

    if (needsResampling) {
      console.log("=== RESAMPLE DEBUG INFO ===");
      console.log("Resampled buffer length:", finalBuffer[0].length);
      console.log(
        "Expected resampled duration:",
        finalBuffer[0].length / sampleRate,
        "seconds",
      );
      console.log("Sample rate ratio:", sampleRate / originalRate);
      console.log("============================");
    } else {
      console.log("=== NO RESAMPLING NEEDED ===");
      console.log("Using original buffer directly");
      console.log("=============================");
    }

    console.log("Exporting audio...");
    let file = new WaveFile();

    // Determine bit depth format string for WaveFile
    const bitDepthFormat = bitDepth === 16 ? "16" : bitDepth === 24 ? "24" : "32f";

    file.fromScratch(channels, sampleRate, bitDepthFormat, outputBuffer);

    // Add markers as cue points (no sample rate adjustment needed - time stays the same)
    for (let marker of markers) {
      if (marker.position != "top") {
        file.setCuePoint({
          position: marker.time * 1000, // Convert seconds to milliseconds
        });
      }
    }

    for (let i = 0; i < file.cue.points.length; i++) {
      file.cue.points[i].dwPosition = file.cue.points[i].dwSampleOffset;
    }

    const data = file.toDataURI();
    // Determine file extension based on original format
    const filename = "export.wav";
    console.log("Saving file...");
    saveAs(data, filename);
  }

  async createSampleDrumBuffer(buffer, markers) {
    const originalRate = this.originalSampleRate || 44100;
    console.log("Exporting audio... sample drum");

    // Only resample if sample rates are different (but use 16-bit for sample drums)
    const needsResampling = originalRate !== this.targetSampleRate;
    const finalBuffer = needsResampling
      ? this.resampleBuffer(buffer, originalRate, this.targetSampleRate)
      : buffer;

    if (needsResampling) {
      console.log(
        `Resampling sample drum from ${originalRate} to ${this.targetSampleRate} Hz`,
      );
    } else {
      console.log(
        `No resampling needed for sample drum - already at ${this.targetSampleRate} Hz`,
      );
    }

    let file = new WaveFile();
    file.fromScratch(2, this.targetSampleRate, "16", finalBuffer);

    // Note: markers are currently commented out for sample drum export
    // // Add markers as cue points
    // for (let marker of markers) {
    //     if (marker.position != "top") {
    //         file.setCuePoint({
    //             position: marker.time * 1000
    //         })
    //     }
    // }

    // for (let i = 0; i < file.cue.points.length; i++) {
    //     file.cue.points[i].dwPosition = file.cue.points[i].dwSampleOffset
    // }

    const data = file.toDataURI();

    // Determine file extension based on original format
    const filename = "export.wav";
    console.log("Saving file...");
    saveAs(data, filename);
  }

  async createCroppedBuffer(buffer, markers, filename = "cropped.wav") {
    const originalRate = this.originalSampleRate || 44100;
    console.log("Exporting cropped audio...");

    // Only resample if sample rates are different
    const needsResampling = originalRate !== this.targetSampleRate;
    const finalBuffer = needsResampling
      ? this.resampleBuffer(buffer, originalRate, this.targetSampleRate)
      : buffer;

    if (needsResampling) {
      console.log(
        `Resampling cropped audio from ${originalRate} to ${this.targetSampleRate} Hz`,
      );
    } else {
      console.log(
        `No resampling needed for cropped audio - already at ${this.targetSampleRate} Hz`,
      );
    }

    let file = new WaveFile();
    file.fromScratch(2, this.targetSampleRate, "32f", finalBuffer);

    // Add markers as cue points (no sample rate adjustment needed - time stays the same)
    for (let marker of markers) {
      if (marker.position != "top") {
        file.setCuePoint({
          position: marker.time * 1000, // Convert seconds to milliseconds
        });
      }
    }

    for (let i = 0; i < file.cue.points.length; i++) {
      file.cue.points[i].dwPosition = file.cue.points[i].dwSampleOffset;
    }

    const data = file.toDataURI();
    console.log("Saving cropped file...");
    saveAs(data, filename);
  }
}
