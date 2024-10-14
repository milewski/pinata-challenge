import * as Tone from 'tone'

export class Recorder {

    private recorder: Tone.Recorder = new Tone.Recorder()
    private microphone: Tone.UserMedia = new Tone.UserMedia()
    private duration = 5000

    public async start(): Promise<{ blob: Blob, player: Tone.Player }> {

        if (this.recorder.state === 'started') {
            console.log('already running...')
            return
        }

        await Tone.start()

        console.log('starting...')

        const highPassFilter = new Tone.Filter({
            frequency: 300,
            type: 'highpass',
        })

        this.microphone.connect(
            highPassFilter.connect(this.recorder),
        )

        let resolver
        const promise: Promise<{ blob: Blob, player: Tone.Player }> = new Promise(resolve => resolver = resolve)

        setTimeout(async () => this.stopRecording().then(resolver), this.duration)

        await this.microphone.open()

        this.recorder.start().then(() => {
            console.log('done recording...')
        })

        return promise
    }

    private async stopRecording(): Promise<{ blob: Blob, player: Tone.Player }> {

        console.log('stopping')

        let blob = await this.recorder.stop()

        this.recorder.dispose()
        this.microphone.dispose()

        const audioContext = Tone.getContext()
        const arrayBuffer = await blob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        const trimmedBuffer = this.trimSilence(audioBuffer)

        const player = new Tone.Player({
            loop: true,
            url: trimmedBuffer,
            fadeIn: '128t',
            fadeOut: '128t',
        }).toDestination()

        player.start()

        return {
            blob,
            player,
        }

    }

    private trimSilence(buffer: AudioBuffer, threshold = 0.01): AudioBuffer {

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

    private padWithSilence(audioBuffer: AudioBuffer): AudioBuffer {

        const audioContext = Tone.getContext()
        const duration = this.duration / 1000

        if (audioBuffer.duration < duration) {

            const newAudioBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate)

            newAudioBuffer.copyToChannel(audioBuffer.getChannelData(0), 0, 0)

            return newAudioBuffer

        }

        const trimmedBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate)

        trimmedBuffer.copyToChannel(audioBuffer.getChannelData(0), 0, 0)

        return trimmedBuffer

    }

}