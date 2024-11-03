import { Essentia, EssentiaWASM } from 'essentia.js';
import { PolarFFTWASM } from '../../lib/polarFFT.module.js';

let essentia = null;

// Initialize essentia
async function initEssentia() {
    try {
        const wasmModule = EssentiaWASM.EssentiaWASM;
        essentia = new Essentia(wasmModule);
    } catch (error) {
        self.postMessage({ error: 'Failed to initialize essentia' });
    }
}

// Initialize immediately
initEssentia();

self.onmessage = async function(e) {
    // Wait for essentia to be initialized
    if (!essentia) {
        await new Promise(resolve => {
            const checkEssentia = () => {
                if (essentia) resolve();
                else setTimeout(checkEssentia, 100);
            };
            checkEssentia();
        });
    }

    const { frames, frameSize, startIndex } = e.data;
    
    try {
        const PolarFFT = new PolarFFTWASM.PolarFFT(frameSize);
        const results = [];

        for (let i = 0; i < frames.length; i++) {
            const currentFrame = frames[i];

            const windowed = essentia.Windowing(essentia.arrayToVector(currentFrame)).frame;
            const windowedArray = essentia.vectorToArray(windowed);
        
            const polar = PolarFFT.compute(windowedArray);
            
            results.push({
                magnitude: essentia.vectorToArray(polar.magnitude),
                phase: essentia.vectorToArray(polar.phase),
                index: startIndex + i
            });
        }

        PolarFFT.shutdown();
        self.postMessage({ frames: results });
        
    } catch (error) {
        console.error('FFT Worker error:', error);
        self.postMessage({ error: error.message });
    }
}; 