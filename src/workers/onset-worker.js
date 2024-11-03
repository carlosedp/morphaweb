// Import essentia as a module
import { Essentia, EssentiaWASM } from 'essentia.js';
import { PolarFFTWASM } from '../../lib/polarFFT.module.js';
import { OnsetsWASM } from '../../lib/onsets.module.js';

let essentia = null;

// Initialize parameters
self.allowedParams = ['sampleRate', 'frameSize', 'hopSize', 'odfs', 'odfsWeights', 'sensitivity'];
self.params = {
    frameSize: 2048,
    hopSize: Math.floor(2048 * 0.25), // 25% of frameSize = 512
    sampleRate: 44100,
    sensitivity: 0.1, // 10% sensitivity
    odfs: ['hfc', 'complex'],
    odfsWeights: [0.8, 0.2] // 80% HFC, 20% Complex
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

async function computeFFT() {
    self.polarFrames = [];
    const numWorkers = navigator.hardwareConcurrency || 4;
    const frames = essentia.FrameGenerator(self.signal, self.params.frameSize, self.params.hopSize);
    const totalFrames = frames.size();
    const framesPerWorker = Math.ceil(totalFrames / numWorkers);
    
    const workerPromises = [];
    
    for (let i = 0; i < numWorkers; i++) {
        const startFrame = i * framesPerWorker;
        const endFrame = Math.min((i + 1) * framesPerWorker, totalFrames);
        const frameSlice = [];
        
        // Extract frames for this worker
        for (let j = startFrame; j < endFrame; j++) {
            frameSlice.push(essentia.vectorToArray(frames.get(j)));
        }
        
        workerPromises.push(new Promise((resolve) => {
            const worker = new Worker(
                new URL('./fft-worker.js', import.meta.url),
                { type: 'module' }
            );
            
            worker.onmessage = (e) => {
                if (e.data.error) {
                    console.error('FFT Worker error:', e.data.error);
                } else {
                    self.polarFrames.push(...e.data.frames);
                    console.log('finished fft');
                }
                worker.terminate();
                resolve();
            };
            
            worker.postMessage({
                frames: frameSlice,
                frameSize: self.params.frameSize,
                startIndex: startFrame
            });
        }));
    }
    
    await Promise.all(workerPromises);
    
    // Sort frames by original index
    self.polarFrames.sort((a, b) => a.index - b.index);
    frames.delete();
}

async function computeOnsets() {
    const alpha = 1 - self.params.sensitivity;
    const numWorkers = navigator.hardwareConcurrency || 4;
    const framesPerWorker = Math.ceil(self.polarFrames.length / numWorkers);
    
    // Process each ODF type in parallel
    const odfMatrixPromises = self.params.odfs.map(async (func) => {
        const workerPromises = [];
        
        for (let i = 0; i < numWorkers; i++) {
            const startFrame = i * framesPerWorker;
            const endFrame = Math.min((i + 1) * framesPerWorker, self.polarFrames.length);
            
            workerPromises.push(new Promise((resolve) => {
                const worker = new Worker(
                    new URL('./odf-worker.js', import.meta.url),
                    { type: 'module' }
                );
                
                worker.onmessage = (e) => {
                    if (e.data.error) {
                        console.error('ODF Worker error:', e.data.error);
                    }
                    resolve(e.data.odfValues);
                    worker.terminate();
                };
                
                worker.postMessage({
                    frames: self.polarFrames.slice(startFrame, endFrame),
                    odfFunction: func,
                    sampleRate: self.params.sampleRate,
                    startIndex: startFrame
                });
            }));
        }
        
        const results = await Promise.all(workerPromises);

        return results.reduce((acc, curr) => {
            acc.push(...curr);
            return acc;
        }, []);
    });
    
    const odfMatrix = await Promise.all(odfMatrixPromises);

    for (let col = 0; col < odfMatrix[0].length; col++) {
        for (let row = 0; row < odfMatrix.length; row++) {
            odfMatrix[row][col] = odfMatrix[row][col].value.onsetDetection;
        }
    }

    console.log('odfMatrix', odfMatrix)
    
    const Onsets = new OnsetsWASM.Onsets(alpha, 5, self.params.sampleRate / self.params.hopSize, 0.02);
    
    const onsetPositions = Onsets.compute(odfMatrix, self.params.odfsWeights).positions;
    console.log('onset positions', onsetPositions);
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

function computeBPM() {
    if (!self.signal || !essentia) return null;
    
    try {
        // Use PercivalBpmEstimator with framed signal
        const bpm = essentia.PercivalBpmEstimator(
            essentia.arrayToVector(self.signal), 
            self.params.sampleRate,
            self.params.frameSize,
            self.params.hopSize
        );

        return Math.round(bpm.bpm);
    } catch (error) {
        console.error('Failed to compute BPM:', error);
        return null;
    }
}

// Initialize immediately
initEssentia();

self.onerror = function(error) {
    console.error('Onset Worker error:', error);
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

                await computeFFT();
                const onsets = await computeOnsets();
                const bpm = computeBPM();
                
                self.postMessage({ 
                    onsets: onsets,
                    bpm: bpm,
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