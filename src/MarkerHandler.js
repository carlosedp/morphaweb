export default class MarkerHandler {
    constructor(morphaweb){
        this.color = '#ff990a'
        this.colorHighlight = "#ff1111"
        this.colorTopMarker = "#ff00bb"
        this.markers = morphaweb.wavesurfer.markers;

        this.morphaweb = morphaweb
        this.morphaweb.wavesurfer.on('marker-click',this.onClick.bind(this))
    }

    addMarkers = (markers) => {
        for (let marker of markers) {
            this.createMarker(marker.position / 1000)
        }
    }
    removeTopMarker() {
        const i = this.markers.markers.map(m => m.position).indexOf('top')
        this.morphaweb.wavesurfer.markers.remove(i)
    }

    removeSelectedMarker() {
        const i = this.getSelectedMarkerIndex()
        this.markers.remove(i)
    }

    highlightMarker(time) {
        this.markers.markers.map(m => {
            if(m.position=="bottom"){
                if(m.time == time) {
                    m.el.children[1].children[0].children[0].setAttribute('fill', this.colorHighlight)
                } else {
                    m.el.children[1].children[0].children[0].setAttribute('fill', this.color)
                }       
            }
        })
    }

    getBottomMarkers() {
        return this.markers.markers.filter(m => m.position === "bottom")
    }

    getTopMarkers() {
        return this.markers.markers.filter(m => m.position === "top")
    }

    getSelectedMarker() {
        const selectedMarker = this.markers.markers.filter(m => m.el.children[1].children[0].children[0].getAttribute('fill') === this.colorHighlight)[0]
        return selectedMarker;
    }
    getSelectedMarkerIndex() {
        const selectedMarker = this.getSelectedMarker()
        return this.markers.markers.findIndex(m => m === selectedMarker)
    }

    getMarkerAtTime(time) {
        const bottomMarkers = this.getBottomMarkers()
        return bottomMarkers.indexOf(time)
    }
    
    createMarker(time, type="bottom") {
        if (type == "bottom" && this.getMarkerAtTime(time) != -1) {return false}

        // Get audio data and find nearest zero crossing
        const audioData = this.morphaweb.wavesurfer.backend.buffer.getChannelData(0);
        const sampleRate = this.morphaweb.wavesurfer.backend.buffer.sampleRate;
        const sampleIndex = Math.round(time * sampleRate);
        
        // Only snap to zero crossings for bottom markers (user-created)
        let snappedTime = time;
        if (type === "bottom" && this.morphaweb.onsetHandler) {
            const snappedSample = this.morphaweb.onsetHandler.findNearestZeroCrossing(audioData, sampleIndex);
            snappedTime = snappedSample / sampleRate;
        }

        let o = {
            time: snappedTime,
            position: "bottom",
            color: this.color,
            draggable: true
        }
        if(type == "top") {
            o.position = "top";
            o.color = this.colorTopMarker;
        }
        this.morphaweb.wavesurfer.addMarker(o);
    }
    
    createMarkerAtCurrentPosition() {
        this.createMarker(this.morphaweb.playOffset * this.morphaweb.wavesurfer.getDuration(),"bottom")
    }

    onClick(e) {
        this.highlightMarker(e.time)
    }   

    createAutoSlices(numberOfSlices) {
        const duration = this.morphaweb.wavesurfer.getDuration();
        const interval = duration / numberOfSlices;

        // Create markers at regular intervals
        for (let i = 1; i < numberOfSlices; i++) {
            this.createMarker(interval * i, "bottom");
        }
    }

    clearAllMarkers() {
        this.morphaweb.wavesurfer.clearMarkers()
    }

    // Add method to get all markers in time order
    getMarkers() {
        return this.markers.markers.sort((a, b) => a.time - b.time);
    }

    // Add method to convert onset times to markers
    createOnsetMarkers(onsets) {
        this.clearAllMarkers();C
        onsets.forEach(onset => {
            this.createMarker(onset, "bottom");
        });
    }

    // Add method to convert markers to onset times
    getOnsetTimes() {
        return this.getTopMarkers()
            .map(marker => marker.time)
            .sort((a, b) => a - b);
    }

    // Add method to update marker positions
    updateMarkerPosition(index, newTime) {
        const marker = this.markers.markers[index];
        if (marker) {
            marker.time = newTime;
            this.morphaweb.wavesurfer.updateMarkerPosition(index, newTime);
        }
    }
}