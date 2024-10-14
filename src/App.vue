<script setup lang="ts">

    import { onMounted, ref } from 'vue'
    import { Application, Assets, Container, Sprite } from 'pixi.js'
    import { FancyButton, ScrollBox } from '@pixi/ui'
    import * as Tone from 'tone'
    import { Player, Recorder, UserMedia } from 'tone'
    import { copyToClipboard, getRandomElements } from './Helpers.ts'

    const monsters = [
        '/assets/monster-1.png',
        '/assets/monster-2.png',
        '/assets/monster-3.png',
        '/assets/monster-4.png',
        '/assets/monster-5.png',
        '/assets/monster-6.png',
        '/assets/monster-7.png',
        '/assets/monster-8.png',
    ]

    const preload = [
        ...monsters,
        '/assets/share.png',
        '/assets/background.jpg',
        '/assets/monster-selection.png',
        '/assets/record-button.png',
        '/assets/frame.png',
    ]

    const loading = ref(true)
    const shareModal = ref(null)
    const recorder = new Recorder()
    const microphone = new UserMedia()

    let interval

    async function stopRecording(): Promise<{ blob: Blob, player: Player }> {

        console.log('stopping')

        let blob = await recorder.stop()

        const audioContext = Tone.getContext()
        const arrayBuffer = await blob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        const trimmedBuffer = trimSilence(audioBuffer)
        // const paddedBuffer = padWithSilence(trimmedBuffer);

        const player = new Player({
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

    async function startRecording(): Promise<{ blob: Blob, player: Player }> {

        if (recorder.state === 'started') {
            console.log('already running...')
            return
        }

        clearInterval(interval)

        await Tone.start()

        console.log('starting...')

        const highPassFilter = new Tone.Filter({
            frequency: 300,
            type: 'highpass',
        })

        const bandPassFilter = new Tone.Filter({
            frequency: 1000, // Center frequency (Hz)
            type: 'bandpass',
        })

        const pitchShift = new Tone.PitchShift({
            pitch: 3, // Increase pitch for a higher robotic sound
            windowSize: 0.1,
        })

        const distortion = new Tone.Distortion(0.5)

        // const reverb = new Tone.Reverb({
        //     decay: 1.5,   // Reverb decay time
        //     preDelay: 0.01, // Reverb pre-delay
        // }).toDestination();

        microphone.connect(highPassFilter)
        highPassFilter.connect(recorder)
        // bandPassFilter.connect(recorder)
        // pitchShift.connect(distortion);
        // pitchShift.connect(recorder)
        // microphone.connect(highPassFilter)
        // highPassFilter.connect(bandPassFilter)
        // bandPassFilter.connect(recorder)

        let resolver
        const promise: Promise<Player> = new Promise(resolve => resolver = resolve)

        setTimeout(async () => stopRecording().then(resolver), 5000)

        await microphone.open()

        recorder.start()

        return promise
    }

    function padWithSilence(audioBuffer: AudioBuffer, duration = 5) {
        const audioContext = Tone.getContext()

        if (audioBuffer.duration < duration) {
            // Create a new audio buffer with 2 seconds of duration
            const newAudioBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate)

            // Copy the recorded audio to the new buffer
            newAudioBuffer.copyToChannel(audioBuffer.getChannelData(0), 0, 0)

            // Fill the rest with silence
            // No need to do anything, the buffer is already initialized with silence

            console.log('Audio buffer padded to 2 seconds')

            return newAudioBuffer
        } else {
            // If the recorded audio is longer than 2 seconds, trim it
            const trimmedBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate)
            trimmedBuffer.copyToChannel(audioBuffer.getChannelData(0), 0, 0) // Copy first 2 seconds
            return trimmedBuffer
        }
    }

    function trimSilence(buffer: AudioBuffer, threshold = 0.01) {
        const audioData = buffer.getChannelData(0) // Get the first audio channel
        const sampleRate = buffer.sampleRate

        // Function to find the first and last sample above the threshold
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

        // Create a new trimmed buffer
        const trimmedLength = endSample - startSample
        const trimmedAudioBuffer = new AudioContext().createBuffer(1, trimmedLength, sampleRate)
        trimmedAudioBuffer.copyToChannel(audioData.subarray(startSample, endSample), 0)

        return trimmedAudioBuffer
    }

    onMounted(async () => {

        /**
         * Preload all required assets
         */
        await Promise.all(preload.map(url => Assets.load(url)))

        // Create a new application
        const app = new Application()

        await app.init({ resizeTo: window })
        // Append the application canvas to the document body
        document.body.appendChild(app.canvas)

        const WIDTH = 1920
        const HEIGHT = 1080
        const padding = 100

        const ratio = WIDTH / HEIGHT
        const inverseRatio = HEIGHT / WIDTH

        function actualWidth() {
            const { width, height } = app.screen
            const isWidthConstrained = width < height * ratio
            return (isWidthConstrained ? width : height * ratio) - padding * 2
        }

        function actualHeight() {
            const { width, height } = app.screen
            const isHeightConstrained = width * inverseRatio > height
            return (isHeightConstrained ? height : width * inverseRatio) - padding * 2
        }

        const share = new FancyButton({
            defaultView: '/assets/share.png',
            anchorX: 0.5,
            anchorY: 0.9,
            animations: {
                hover: {
                    props: {
                        scale: { x: 1.1, y: 1.1 },
                    },
                    duration: 80,
                },
                pressed: {
                    props: {
                        scale: { x: 0.9, y: 0.9 },
                    },
                    duration: 80,
                },
            },
        })

        share.eventMode = 'static'
        share.cursor = 'pointer'

        share.addEventListener('click', async function () {
            await exportShare()
        })

        share.setSize(250)
        share.x = 1610
        share.y = 480

        const background = Sprite.from('/assets/background.jpg')

        const container = createScaledContainer(new Container())
        container.addChild(background)
        container.addChild(share)

        // container.mask =  new RoundedRectangle(0, 0, container.width, container.height, 30)

        app.renderer.on('resize', function () {
            createScaledContainer(container)
        })

        function createScaledContainer(container) {

            container.width = WIDTH
            container.height = HEIGHT
            container.scale.x = actualWidth() / WIDTH
            container.scale.y = actualHeight() / HEIGHT
            container.x = app.screen.width / 2 - actualWidth() / 2
            container.y = app.screen.height / 2 - actualHeight() / 2

            return container

        }

        app.stage.addChild(container)

        const textures = monsters
            .map(url => Assets.get(url))
            .map(texture => (texture.source.scaleMode = 'linear', texture))

        const sprites = textures.map(texture => {

            const sprite = new Sprite(texture)

            sprite.width = 230
            sprite.height = 230
            sprite.cursor = 'pointer'

            sprite.addListener('click', async () => {

                await createMonster(
                    sprite.texture.label!,
                    app.screen.width / 2 + 230 / 2,
                    app.screen.height / 2,
                    texture,
                )

            })

            return sprite

        })

        const monsterSelection = Sprite.from('/assets/monster-selection.png')

        const box = new ScrollBox({
            background: 'rgba(47% 88% 65% / 30%)',
            radius: 20,
            width: 230,
            height: 1080 - 250,
            items: sprites,
        })

        box.y = 150
        box.x = 50

        monsterSelection.x = 20
        monsterSelection.y = 20

        container.addChild(box)
        container.addChild(monsterSelection)

        document.oncontextmenu = document.body.oncontextmenu = function (event) {
            if (shareModal.value === null || loading.value == false) {
                event.preventDefault()
            }
        }

        const audios: Record<number, { recorded: boolean, blob: Blob | string | null, player: Player | null }> = {}

        setInterval(() => {

            const players = Object.keys(audios)
                .map(key => audios[ key ].player)
                .filter(Boolean)

            for (const player of players) {
                player.stop()
            }

            const randomElements = getRandomElements(players, 4)

            for (const player of randomElements) {
                player.start()
            }

        }, 5000)

        function positionFrame(frame, recordButton, monster) {

            frame.position.copyFrom(monster)
            frame.position.x -= 135
            frame.position.y -= 220
            frame.scale.set(0.7)

            recordButton.position.copyFrom(frame)
            recordButton.position.x += 130
            recordButton.position.y += 230
            recordButton.scale.set(0.9)

            const shouldShow = !audios[ monster.parent.uid ].recorded

            frame.visible = shouldShow
            recordButton.visible = shouldShow

        }

        async function createMonster(name: string, x, y, texture, audio: {
            player: Player,
            blob: string
        } | null = null) {

            const recordButton = new FancyButton({
                defaultView: '/assets/record-button.png',
                anchorX: 0.45,
                anchorY: 0.45,
                animations: {
                    hover: {
                        props: {
                            scale: { x: 1.1, y: 1.1 },
                        },
                        duration: 80,
                    },
                    pressed: {
                        props: {
                            scale: { x: 0.9, y: 0.9 },
                        },
                        duration: 80,
                    },
                },
            })

            recordButton.label = 'record-button'

            const frame = new Sprite({ texture: Assets.get('/assets/frame.png'), label: 'frame' })
            const group = new Container({ label: 'monster-root' })
            const monster = new Sprite({ label: name, texture })

            group.addChild(frame, monster, recordButton)

            audios[ group.uid ] = {
                recorded: !!audio?.player!,
                player: audio?.player!,
                blob: audio?.blob!,
            }

            monster.eventMode = 'static'
            monster.cursor = 'pointer'
            monster.anchor.set(0.5, 0.9)

            recordButton.eventMode = 'static'
            recordButton.cursor = 'pointer'

            recordButton.addEventListener('click', async function () {

                recordButton.visible = false

                const { blob, player } = await startRecording()

                if (player) {

                    audios[ group.uid ].recorded = true
                    audios[ group.uid ].player = player
                    audios[ group.uid ].blob = blob

                    positionFrame(frame, recordButton, monster)

                }

            })

            let elapsed = Math.random() * 100
            let singing = true

            app.ticker.add(function (delta) {

                if (singing) {

                    elapsed += delta.deltaTime / 10
                    const amount = Math.sin(elapsed)
                    // monster.scale.set(mapRange(amount, 0.4, 0.41))

                    monster.scale.x = 0.25 + Math.sin(amount) * 0.02
                    monster.scale.y = 0.25 + Math.cos(amount) * 0.02

                } else {

                    monster.scale.y = monster.scale.y
                    monster.alpha = 0.6

                }

            })

            monster.x = x
            monster.y = y

            monster.on('pointerdown', onDragStart, monster)
            monster.on('rightclick', function () {

                container.removeChild(group)

                audios[ group.uid ].player?.stop()
                delete audios[ group.uid ]

            })

            // Add it to the stage
            positionFrame(frame, recordButton, monster)
            container.addChild(group)

            return group
        }

        let dragTarget: Sprite | null = null

        app.stage.eventMode = 'static'
        app.stage.hitArea = app.screen
        app.stage.on('pointerup', onDragEnd)
        app.stage.on('pointerupoutside', onDragEnd)

        function onDragMove(event) {

            if (dragTarget) {

                const frame = dragTarget.parent?.getChildByLabel('frame')
                const recordButton = dragTarget.parent?.getChildByLabel('record-button')

                if (frame && recordButton) {
                    frame.visible = false
                    recordButton.visible = false
                }

                dragTarget.parent.toLocal(event.global, null, dragTarget.position)

            }

        }

        const queryString = window.location.search
        const urlParams = new URLSearchParams(queryString)
        const shareValue = urlParams.get('share')

        if (shareValue) {

            loading.value = true

            const response = await fetch(`${ import.meta.env.VITE_PINATA_GATEWAY }/ipfs/${ shareValue }?pinataGatewayToken=${ import.meta.env.VITE_PINATA_GATEWAY_TOKEN }`)

            await restore(await response.json())

            loading.value = false

        }

        async function restore(data) {

            console.log('restoring...')

            for (const { creature, position, audio } of data.monsters) {

                const texture = textures.find(texture => texture.label === creature)
                let audioObject = null

                if (audio) {

                    const player = new Player({
                        loop: true,
                        url: `${ import.meta.env.VITE_PINATA_GATEWAY }/ipfs/${ audio }?pinataGatewayToken=${ import.meta.env.VITE_PINATA_GATEWAY_TOKEN }`,
                        fadeIn: '128t',
                        fadeOut: '128t',
                    }).toDestination()

                    audioObject = {
                        player,
                        blob: audio,
                    }

                }

                await createMonster(creature, position.x, position.y, texture, audioObject)

            }

        }

        async function exportShare() {

            loading.value = true

            const data = {
                version: 1,
                monsters: [],
            }

            const monsters = app.stage.getChildrenByLabel('monster-root', true)

            const tokens = await fetch(`https://pinata-challenge.onrender.com/getToken?count=${ monsters.length + 1 }`)
            const { token } = await tokens.json()

            for (const monster of monsters) {

                const creature: Sprite = monster.getChildAt(1)
                const { blob, player } = audios[ monster.uid ]

                let audioHash = blob instanceof Blob ? null : blob

                if (blob && player && blob instanceof Blob) {

                    const formData = new FormData()
                    formData.append('file', blob)

                    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${ token }`,
                            },
                            body: formData,
                        },
                    )

                    const { IpfsHash } = await res.json()

                    audioHash = IpfsHash

                }

                data.monsters.push({
                    creature: creature.label,
                    audio: audioHash,
                    position: {
                        x: creature.position.x,
                        y: creature.position.y,
                    },
                })

            }

            const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${ token }`,
                    },
                    body: JSON.stringify({
                        pinataContent: data,
                        pinataMetadata: {
                            name: 'metadata.json',
                        },
                    }),
                },
            )

            const { IpfsHash } = await res.json()

            loading.value = false

            shareModal.value = `https://${ window.location.host }?share=${ IpfsHash }`

        }

        function onDragStart() {
            // Store a reference to the data
            // * The reason for this is because of multitouch *
            // * We want to track the movement of this particular touch *
            this.alpha = 0.5
            dragTarget = this
            app.stage.on('pointermove', onDragMove)
        }

        function onDragEnd() {
            if (dragTarget) {
                app.stage.off('pointermove', onDragMove)
                dragTarget.alpha = 1

                const frame = dragTarget.parent?.getChildByLabel('frame')
                const recordButton = dragTarget.parent?.getChildByLabel('record-button')

                if (frame && recordButton) {
                    frame.visible = true
                    recordButton.visible = true
                    positionFrame(frame, recordButton, dragTarget)
                }

                dragTarget = null

            }
        }

        loading.value = false

    })

</script>

<template>

    <Transition>

        <div class="share-modal" v-if="shareModal" @click.self="shareModal = null">

            <div>
                <h1>Copy and Share!</h1>
                <input @click="copyToClipboard($event, shareModal)" :value="shareModal"/>
            </div>

        </div>

    </Transition>

    <Transition>

        <div class="loader" v-if="loading">

            <div class="spinner">
                <div v-for="_ of 5"/>
            </div>

        </div>

    </Transition>

</template>

<style>

    .share-modal {
        position: absolute;
        align-content: center;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.60);
        cursor: pointer;

        > div {
            font-size: 18px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
        }

        input {
            font-size: 16px;
            display: flex;
            text-align: center;
            margin: auto;
            background: white;
            width: 40vw;
            padding: 20px;
            border-radius: 5px;
            border: none;
        }
    }

    .v-enter-active,
    .v-leave-active {
        transition: opacity 0.5s ease;
    }

    .v-enter-from,
    .v-leave-to {
        opacity: 0;
    }

</style>
