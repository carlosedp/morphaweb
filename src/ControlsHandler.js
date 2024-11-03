import { throttle } from "lodash";
export default class ControlsHandler {
    constructor(morphaweb) {
        this.morphaweb = morphaweb
        this.playButton = document.getElementById("play")
        this.pauseButton = document.getElementById("pause")
        this.exportButton = document.getElementById("export")
        this.sliceButton = document.getElementById("auto-slice")
        this.sliceCountInput = document.getElementById("slice-count")
        this.detectOnsetsButton = document.getElementById("detect-onsets")
        this.divideMarkersButton = document.getElementById("divide-markers")
        
        this.exportButton.addEventListener('click',this.exportWavFile)
        this.playButton.addEventListener('click',this.play)
        this.pauseButton.addEventListener('click',this.pause)
        this.sliceButton.addEventListener('click', this.handleAutoSlice)
        this.detectOnsetsButton.addEventListener('click', this.handleOnsetDetection)
        this.divideMarkersButton.addEventListener('click', this.divideMarkersByTwo)

        document.addEventListener('keydown',this.onKeydown.bind(this))
        this.morphaweb.wavesurfer.on('seek',this.onSeek.bind(this))
        this.morphaweb.wavesurfer.on('finish',this.onFinish.bind(this))
        window.addEventListener("wheel",throttle(this.onWheel.bind(this),10))

        // Add listener for marker changes
        document.addEventListener('markers-changed', this.updateDivideButton.bind(this));
        
        // Initial button state
        this.updateDivideButton();
    }
    exportWavFile = () => {
        try {
            if(this.morphaweb.wavesurfer.getDuration() === 0) { return false; }
            //if()
            
            const buffer = [
                this.morphaweb.wavesurfer.backend.buffer.getChannelData(0),
            ]

            try {
                buffer.push(this.morphaweb.wavesurfer.backend.buffer.getChannelData(1))
            } catch(error) {
                // Duplicate L channel to R channel
                buffer.push(this.morphaweb.wavesurfer.backend.buffer.getChannelData(0))
                console.log('No second channel')
            }
            
            const markers = this.morphaweb.wavesurfer.markers.markers
            this.morphaweb.wavHandler.createFileFromBuffer(buffer,markers)
        } catch(error) {
            console.log(error)
            this.morphaweb.track("ErrorExportWavFile")
        }
    }

    play = () => {
        if(this.morphaweb.wavesurfer.isPlaying()) {
            this.morphaweb.wavesurfer.seekTo(0)
        }
        this.morphaweb.wavesurfer.play()
    }

    pause = () => {
        this.morphaweb.wavesurfer.pause()
    }

    playToggle = () => {
        if (this.morphaweb.wavesurfer.isPlaying()) {
            this.morphaweb.wavesurfer.pause()
        } else {
            this.morphaweb.wavesurfer.play()
        }
    }

    onSeek = (p) => {
        this.morphaweb.playOffset = p
        this.morphaweb.markerHandler.removeTopMarker("top")
        this.morphaweb.markerHandler.createMarker(this.morphaweb.playOffset * this.morphaweb.wavesurfer.getDuration(),"top")
        this.morphaweb.wavesurfer.play()
    }
    
    onFinish = () => {
        // Do nothing
    }
    
    onWheel = (e) => {
        if(this.morphaweb.scrollPos + e.deltaY >= this.morphaweb.scrollMin) {
            this.morphaweb.scrollPos = this.morphaweb.scrollPos + e.deltaY
            this.morphaweb.wavesurfer.zoom(this.morphaweb.scrollPos)
        }
    }
    
    onKeydown = (e) => {
        switch(e.key) {
            case "j":
            case "J":
                this.morphaweb.markerHandler.createMarkerAtCurrentPosition()
                break;
            case "k":
            case "K":
                this.morphaweb.markerHandler.removeSelectedMarker()
                break;
            case " ":
                this.playToggle()
                break;
        }
    }

    handleAutoSlice = () => {
        if(this.morphaweb.wavesurfer.getDuration() === 0) { return false; }
        const numberOfSlices = parseInt(this.sliceCountInput.value);

        this.morphaweb.markerHandler.clearAllMarkers();
        this.morphaweb.markerHandler.createAutoSlices(numberOfSlices);
        this.morphaweb.track("AutoSlice");
    }

    handleOnsetDetection = () => {
        try {
            if(this.morphaweb.wavesurfer.getDuration() === 0) { return false; }
            this.morphaweb.detectOnsets();
            this.morphaweb.track("OnsetDetection");
        } catch(error) {
            this.morphaweb.track("ErrorOnsetDetection");
        }
    }

    updateDivideButton = (event) => {
        const markerCount = this.morphaweb.markerHandler.getBottomMarkers().length;
        this.divideMarkersButton.disabled = markerCount < 2;
    }

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
    }
}