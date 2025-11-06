// This decodes a base64 string into a Uint8Array.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// This decodes raw PCM audio data into an AudioBuffer.
// The Gemini TTS API returns raw PCM data, not a standard file format like WAV or MP3.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // The raw data is 16-bit PCM, so we create a Int16Array view on the buffer.
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize the 16-bit integer to a float between -1.0 and 1.0
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// A singleton AudioContext to avoid creating multiple contexts.
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    // Gemini TTS uses a 24000 sample rate.
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

export const playAudio = async (base64Audio: string): Promise<void> => {
    try {
        const ctx = getAudioContext();
        // The API returns single-channel (mono) audio.
        const numChannels = 1;
        const sampleRate = 24000;

        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, ctx, sampleRate, numChannels);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        return new Promise(resolve => {
            source.onended = () => resolve();
            source.start();
        });
    } catch (error) {
        console.error("Failed to play audio:", error);
        throw error;
    }
};
