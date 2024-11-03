import { Essentia, EssentiaWASM } from 'essentia.js';

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

    const { frames, odfFunction, sampleRate, startIndex } = e.data;
    
    try {
        const odfValues = frames.map((frame, i) => {
            const result = essentia.OnsetDetection(
                essentia.arrayToVector(frame.magnitude),
                essentia.arrayToVector(frame.phase),
                odfFunction,
                sampleRate
            );

            // Add index to maintain order when results are combined
            return {
                value: result,
                index: startIndex + i
            };
        });

        self.postMessage({ 
            odfValues,
            odfFunction // Include this so we know which ODF these results are for
        });
        
    } catch (error) {
        console.error('ODF Worker error:', error);
        self.postMessage({ error: error.message });
    }
}; 