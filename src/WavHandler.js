import { WaveFile } from "wavefile";
import { saveAs } from "file-saver";

export default class WavHandler {
    constructor() {
        this.markers = []
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    async getMarkersFromFile(file) {
        return new Promise((resolve, reject) => {
            let fr = new FileReader()
            let cues = []
            fr.readAsDataURL(file)
            fr.onloadend = () => {
                // Check if file is MP3 or WAV
                if (file.type === 'audio/wav' || file.type === 'audio/wave' || file.type === 'audio/x-wav') {
                    let f = new WaveFile()
                    const base64String = fr.result
                        .replace("data:", "")
                        .replace(/^.+,/, "");
                    f.fromBase64(base64String)
                    cues = f.listCuePoints()
                    resolve(cues)
                } else {
                    // For MP3s, we won't have cue points initially
                    resolve([])
                }
            }
            fr.onerror = reject
        })
    }

    async createFileFromBuffer(buffer, markers) {
        let file = new WaveFile()
        file.fromScratch(2, this.audioContext.sampleRate, '32f', buffer)

        // Add markers as cue points
        for (let marker of markers) {
            if (marker.position != "top") {
                file.setCuePoint({
                    position: marker.time * 1000
                })
            }
        }

        for (let i = 0; i < file.cue.points.length; i++) {
            file.cue.points[i].dwPosition = file.cue.points[i].dwSampleOffset
        }

        const data = file.toDataURI()
        
        // Determine file extension based on original format
        const filename = "export.wav"
        saveAs(data, filename)
    }

    async audioBufferToWav(audioBuffer) {
        // Get the audio data from all channels
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const result = new Float32Array(length * numberOfChannels);
        
        // Interleave the channels
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                result[i * numberOfChannels + channel] = channelData[i];
            }
        }
        
        return result;
    }

    async mp3ToAudioBuffer(arrayBuffer) {
        // Decode MP3 to AudioBuffer
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }

    async loadAudioFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const audioBuffer = await this.mp3ToAudioBuffer(arrayBuffer);
                    resolve(audioBuffer);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
}