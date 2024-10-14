import * as Tone from 'tone'

export function getRandomElements<T>(array: T[], elements = 5): T[] {

    const shuffled = array.slice().sort(() => Math.random() - 0.5)

    return shuffled.slice(0, elements)

}

export function copyToClipboard(event: Event, text: string): Promise<void> {

    const element = event.target as HTMLInputElement

    element.select()
    element.setSelectionRange(0, 99999)

    return navigator.clipboard.writeText(text)

}

export function trimSilence(buffer: AudioBuffer, threshold = 0.01): AudioBuffer {

    const audioData = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate

    const findNonSilentSample = (data, fromStart = true) => {

        const increment = fromStart ? 1 : -1

        let sampleIndex = fromStart ? 0 : data.length - 1

        while (Math.abs(data[ sampleIndex ]) < threshold && sampleIndex >= 0 && sampleIndex < data.length) {
            sampleIndex += increment
        }

        return sampleIndex

    }

    const startSample = findNonSilentSample(audioData, true)
    const endSample = findNonSilentSample(audioData, false)

    const trimmedLength = endSample - startSample
    const trimmedAudioBuffer = new AudioContext().createBuffer(1, trimmedLength, sampleRate)
    trimmedAudioBuffer.copyToChannel(audioData.subarray(startSample, endSample), 0)

    return trimmedAudioBuffer

}

export function padWithSilence(audioBuffer: AudioBuffer, duration = 5): AudioBuffer {

    const audioContext = Tone.getContext()

    if (audioBuffer.duration < duration) {

        const newAudioBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate)

        newAudioBuffer.copyToChannel(audioBuffer.getChannelData(0), 0, 0)

        console.log('Audio buffer padded to 2 seconds')

        return newAudioBuffer

    }

    const trimmedBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate)

    trimmedBuffer.copyToChannel(audioBuffer.getChannelData(0), 0, 0)

    return trimmedBuffer

}

