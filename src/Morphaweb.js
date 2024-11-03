import WaveSurfer from "wavesurfer.js"
import MarkersPlugin from "wavesurfer.js/src/plugin/markers";
import RegionsPlugin from "wavesurfer.js/src/plugin/regions";
import DropHandler from "./DropHandler";
import ControlsHandler from "./ControlsHandler";
import MarkerHandler from "./MarkerHandler";
import WavHandler from "./WavHandler";
import OnsetHandler from './OnsetHandler';
import AlgorithmControls from './AlgorithmControls';

export default class Morphaweb {
    constructor() {
        this.scrollPos = 0
        this.scrollMin = 0
        this.playOffset = 0
        
        this.wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#ffd000',
            progressColor: 'white',
            plugins: [MarkersPlugin.create(), RegionsPlugin.create()]  
        });

        this.dropHandler = new DropHandler(this)
        this.markerHandler = new MarkerHandler(this)
        this.controlsHandler = new ControlsHandler(this)
        this.wavHandler = new WavHandler()
        this.onsetHandler = new OnsetHandler(this);
        this.algorithmControls = new AlgorithmControls(this);

        this.initAnalytics()

        this.wavesurfer.on('ready',this.onReady.bind(this))

        // Add containers for BPM info
        this.createInfoDisplay();
    }

    onReady = async () => {
        this.scrollMin = Math.round(this.wavesurfer.container.scrollWidth / this.wavesurfer.getDuration())
        this.scrollPos = this.scrollMin
        this.markerHandler.addMarkers(this.wavHandler.markers)
    }

    initAnalytics() {
        const exportButton = document.getElementById("export")
        exportButton.addEventListener("click", (e) => {
            this.track("export")
        })
    }

    track(e) {
        return
    }

    detectOnsets() {
        const buffer = this.wavesurfer.backend.buffer;
        if (!buffer) {
            console.error('No audio loaded');
            return;
        }

        const audioData = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        
        this.onsetHandler.detectOnsets(audioData, sampleRate);
    }

    createInfoDisplay() {
        // Create container for BPM info
        const container = document.createElement('div');
        container.id = 'audio-info';
        container.className = 'audio-info';
        
        // Create BPM display
        this.bpmDisplay = document.createElement('div');
        this.bpmDisplay.id = 'bpm-display';
        container.appendChild(this.bpmDisplay);

        // Insert after waveform
        const waveform = document.getElementById('waveform');
        waveform.parentNode.insertBefore(container, waveform.nextSibling);
    }

    updateBPM(bpm) {
        if (this.bpmDisplay) {
            this.bpmDisplay.textContent = `BPM: ${bpm}`;
        }
    }
}