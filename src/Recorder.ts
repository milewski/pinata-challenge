export class Recorder {

    private instance: MediaRecorder
    private chunks = []

    public async initialize() {

        this.instance = <MediaRecorder>await navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then(stream => new MediaRecorder(stream))
            .catch(error => console.error(`The following getUserMedia error occurred: ${ error }`));

    }

    public record(): () => Promise<ArrayBuffer> {

        let resolver

        const promise = new Promise(resolve => resolver = resolve)

        this.instance.addEventListener('dataavailable', event => this.chunks.push(event.data))
        this.instance.addEventListener('stop', async () => {

            const blob = new Blob(this.chunks, { type: 'audio/ogg; codecs=opus' });

            resolver(
                await blob.arrayBuffer()
            )

        })

        this.instance.start();

        return async () => {

            this.instance.stop()

            return await promise

        }

    }
}