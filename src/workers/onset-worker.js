// Import essentia as a module
import { Essentia, EssentiaWASM } from 'essentia.js';
import { PolarFFTWASM } from '../../lib/polarFFT.module.js';
import { OnsetsWASM } from '../../lib/onsets.module.js';

let essentia = null;

// Initialize parameters
self.allowedParams = ['sampleRate', 'frameSize', 'hopSize', 'odfs', 'odfsWeights', 'sensitivity'];
self.params = {
    frameSize: 1024,
    hopSize: 512,
    sampleRate: 44100,
    sensitivity: 0.5,
    odfs: ['hfc'],
    odfsWeights: [1.0]
};

// Global storage
self.signal = null;
self.polarFrames = null;
self.onsetPositions = null;

// Initialize essentia
async function initEssentia() {
    try {
        const wasmModule = EssentiaWASM.EssentiaWASM;
        essentia = new Essentia(wasmModule);
    } catch (error) {
        console.error('Failed to initialize essentia:', error);
    }
}

function computeFFT() {
    self.polarFrames = [];
    let PolarFFT = new PolarFFTWASM.PolarFFT(self.params.frameSize);
    let frames = essentia.FrameGenerator(self.signal, self.params.frameSize, self.params.hopSize);

    for (let i = 0; i < frames.size(); i++) {
        let currentFrame = frames.get(i);
        let windowed = essentia.Windowing(currentFrame).frame;
        
        const polar = PolarFFT.compute(essentia.vectorToArray(windowed));
        
        self.polarFrames.push(polar);
    }

    frames.delete();
    PolarFFT.shutdown();
}

function computeOnsets() {
    const alpha = 1- self.params.sensitivity;
    const Onsets = new OnsetsWASM.Onsets(alpha, 5, self.params.sampleRate / self.params.hopSize, 0.02);

    const odfMatrix = [];
    for (const func of self.params.odfs) {
        const odfArray = self.polarFrames.map((frame) => {
            return essentia.OnsetDetection(
                essentia.arrayToVector(essentia.vectorToArray(frame.magnitude)),
                essentia.arrayToVector(essentia.vectorToArray(frame.phase)),
                func,
                self.params.sampleRate
            ).onsetDetection;
        });
        odfMatrix.push(Float32Array.from(odfArray));
    }

    const onsetPositions = Onsets.compute(odfMatrix, self.params.odfsWeights).positions;
    Onsets.shutdown();
    
    if (onsetPositions.size() == 0) {
        return new Float32Array(0);
    } else {
        // Convert onset positions to array and shift them earlier by 5ms
        const shiftSamples = Math.round(0.005 * self.params.sampleRate / self.params.hopSize); // 5ms in frames
        const positions = essentia.vectorToArray(onsetPositions);
        return positions.map(pos => Math.max(0, pos - shiftSamples));
    }
}

// Initialize immediately
initEssentia();

self.onerror = function(error) {
    self.postMessage({ error: error.message });
};

self.onmessage = async function(e) {
    const { type, audioData, sampleRate, params } = e.data;
    
    // Wait for essentia to be ready if it's not
    if (!essentia) {
        await new Promise(resolve => {
            const checkEssentia = () => {
                if (essentia) {
                    resolve();
                } else {
                    setTimeout(checkEssentia, 100);
                }
            };
            checkEssentia();
        });
    }

    try {
        switch (type) {
            case 'updateParams':
                if (params) {
                    self.params = { ...self.params, ...params };
                }
                break;

            case 'processAudio':
                if (!(audioData instanceof Float32Array)) {
                    throw new Error('Audio data must be Float32Array');
                }
                self.signal = audioData;
                self.params.sampleRate = sampleRate;

                computeFFT();
                const onsets = computeOnsets();
                
                self.postMessage({ 
                    onsets: onsets,
                    success: true 
                });
                break;

            default:
                throw new Error('Unknown message type');
        }
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};