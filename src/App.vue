<script setup lang="ts">

    import { onMounted, ref } from 'vue'
    import { Application, Assets, Container, Sprite } from 'pixi.js'
    import { FancyButton, ScrollBox } from '@pixi/ui'
    import { Player } from 'tone'
    import { copyToClipboard, getRandomElements } from './Helpers.ts'
    import { Recorder } from './Recorder.ts'

    const monsters = [
        '/assets/monster-1.png',
        '/assets/monster-6.png',
        '/assets/monster-2.png',
        '/assets/monster-5.png',
        '/assets/monster-3.png',
        '/assets/monster-8.png',
        '/assets/monster-4.png',
        '/assets/monster-7.png',
    ]

    const preload = [
        ...monsters,
        '/assets/share.png',
        '/assets/background.jpg',
        '/assets/monster-selection.png',
        '/assets/record-button.png',
        '/assets/frame.png',
    ]

    const WIDTH = 1920
    const HEIGHT = 1080
    const PADDING = 100

    const loading = ref(true)
    const shareModal = ref(null)
    const canStart = ref(true)

    /**
     * Disable right click, because right click is used to remove the character from the screen
     */
    document.oncontextmenu = document.body.oncontextmenu = function (event) {
        if (shareModal.value === null || loading.value == false) {
            event.preventDefault()
        }
    }

    const audios: Record<number, { recorded: boolean, blob: Blob | string | null, player: Player | null }> = {}

    function playAudios() {

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

        setTimeout(() => playAudios(), 5000)

    }

    onMounted(async () => {

        /**
         * Preload all required assets
         */
        await Promise.all(preload.map(url => Assets.load(url)))

        const app = new Application()
        await app.init({ resizeTo: window })

        document.body.appendChild(app.canvas)

        const ratio = WIDTH / HEIGHT
        const inverseRatio = HEIGHT / WIDTH

        function actualWidth() {
            const { width, height } = app.screen
            const isWidthConstrained = width < height * ratio
            return (isWidthConstrained ? width : height * ratio) - PADDING * 2
        }

        function actualHeight() {
            const { width, height } = app.screen
            const isHeightConstrained = width * inverseRatio > height
            return (isHeightConstrained ? height : width * inverseRatio) - PADDING * 2
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

        share.addEventListener('click', () => exportShare())

        share.setSize(250)
        share.x = 1610
        share.y = 480

        const background = Sprite.from('/assets/background.jpg')

        const container = adjustContainerSize(new Container())
        container.addChild(background)
        container.addChild(share)

        app.renderer.on('resize', () => adjustContainerSize(container))

        function adjustContainerSize(container) {

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
                    app.screen.width / 2 - sprite.width / 2,
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

                const { blob, player } = await new Recorder().start()

                if (player && blob) {

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

        const queryString = window.location.search
        const urlParams = new URLSearchParams(queryString)
        const shareValue = urlParams.get('share')

        if (shareValue) {

            canStart.value = false
            loading.value = true

            const response = await fetch(`${ import.meta.env.VITE_PINATA_GATEWAY }/ipfs/${ shareValue }?pinataGatewayToken=${ import.meta.env.VITE_PINATA_GATEWAY_TOKEN }`)

            await restore(await response.json())

            loading.value = false

        }

        async function restore(data) {

            console.log('restoring...')

            const promises = []

            for (const { creature, position, audio } of data.monsters) {

                const texture = textures.find(texture => texture.label === creature)
                let audioObject = null

                if (audio) {

                    let resolver

                    promises.push(new Promise(resolve => resolver = resolve))

                    const player = new Player({
                        loop: true,
                        autostart: false,
                        url: `${ import.meta.env.VITE_PINATA_GATEWAY }/ipfs/${ audio }?pinataGatewayToken=${ import.meta.env.VITE_PINATA_GATEWAY_TOKEN }`,
                        fadeIn: '128t',
                        fadeOut: '128t',
                        onload: resolver,
                    })

                    audioObject = {
                        player: player.toDestination(),
                        blob: audio,
                    }

                }

                await createMonster(creature, position.x, position.y, texture, audioObject)

            }

            await Promise.all(promises)

        }

        async function exportShare() {

            loading.value = true

            const data = {
                version: 1,
                monsters: [],
            }

            const monsters = app.stage.getChildrenByLabel('monster-root', true)

            const tokens = await fetch(`${ import.meta.env.VITE_BACKEND_API }/getToken?count=${ monsters.length + 1 }`)
            const { token } = await tokens.json()

            for (const monster of monsters) {

                const creature: Sprite = monster.getChildAt(1)
                const { blob, player } = audios[ monster.uid ]

                let audioHash = blob instanceof Blob ? null : blob

                if (blob && player && blob instanceof Blob) {

                    const formData = new FormData()
                    formData.append('file', blob)

                    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${ token }`,
                            },
                            body: formData,
                        },
                    )

                    const { IpfsHash } = await response.json()

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

            const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
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

            const { IpfsHash } = await response.json()

            loading.value = false

            shareModal.value = `${ window.location.protocol }//${ window.location.host }?share=${ IpfsHash }`

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

    function start() {
        canStart.value = true
        playAudios()
    }

</script>

<template>

    <Transition>

        <div class="share-modal" v-if="canStart === false">

            <div @click="start">
                <h1>Click to Start</h1>
            </div>

        </div>

    </Transition>

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
