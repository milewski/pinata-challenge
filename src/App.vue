<script setup lang="ts">

    import { onMounted } from 'vue'
    import { Application, Sprite, Assets, SCALE_MODE, Texture } from 'pixi.js'
    import { ScrollBox } from '@pixi/ui'

    onMounted(async () => {
        // Create a new application
        const app = new Application()

        // Initialize the application
        await app.init({ background: '#1099bb', resizeTo: window })

        // Append the application canvas to the document body
        document.body.appendChild(app.canvas)

        // Load the bunny texture
        const textures: Texture[] = [
            await Assets.load('/assets/crab.png'),
            await Assets.load('/assets/traefik.png'),
        ]

        textures.forEach(function (texture) {
            texture.source.scaleMode = 'linear'
        })

        // Set the texture's scale mode to nearest to preserve pixelation
        // texture.baseTexture.scaleMode = SCALE_MODES.NEAREST
        // texture.baseTexture

        for (let i = 0; i < 10; i++) {
            // createBunny(
            //     Math.floor(Math.random() * app.screen.width),
            //     Math.floor(Math.random() * app.screen.height),
            //     textures[ Math.floor(Math.random() * textures.length) ],
            // )
        }

        function mapRange(value, minOutput, maxOutput) {
            // Ensure the input is clamped between -1 and 1
            if (value < -1) value = -1
            if (value > 1) value = 1

            // Map the value from [-1, 1] to [minOutput, maxOutput]
            return minOutput + (value + 1) * (maxOutput - minOutput) / 2
        }

        let scrollboxElement = new Sprite(textures[ 0 ])

        scrollboxElement.on('click', function () {
            createBunny(Math.floor(Math.random() * app.screen.width),
                Math.floor(Math.random() * app.screen.height), textures[ 0 ])
        })

        let box = new ScrollBox({
            background: 0XFFFFFF,
            width: 500,
            height: 300,
            items: [
                scrollboxElement,
                scrollboxElement,
                scrollboxElement,
                scrollboxElement,
                scrollboxElement,
            ],
        })

        app.stage.addChild(box)
        document.oncontextmenu = document.body.oncontextmenu = function (event) {
            event.preventDefault()
        }

        function createBunny(x, y, texture) {

            const bunny = new Sprite(texture)

            // Enable the bunny to be interactive... this will allow it to respond to mouse and touch events
            bunny.eventMode = 'static'

            // This button mode will mean the hand cursor appears when you roll over the bunny with your mouse
            bunny.cursor = 'pointer'

            // Center the bunny's anchor point
            bunny.anchor.set(0.5, 0.9)

            // Make it a bit bigger, so it's easier to grab
            bunny.scale.set(0.5)

            let elapsed = Math.random() * 100

            app.ticker.add(function (delta) {
                elapsed += delta.deltaTime / 10
                const amount = Math.sin(elapsed)
                // bunny.scale.set(mapRange(amount, 0.4, 0.41))

                bunny.scale.x = 0.5 + Math.sin(amount) * 0.04
                bunny.scale.y = 0.5 + Math.cos(amount) * 0.04

            })

            // Setup events for mouse + touch using the pointer events
            bunny.on('pointerdown', onDragStart, bunny)
            bunny.on('rightclick', function (e) {
                e.preventDefault()
                app.stage.removeChild(bunny)
            })

            // Move the sprite to its designated position
            bunny.x = x
            bunny.y = y

            // Add it to the stage
            app.stage.addChild(bunny)
        }

        let dragTarget = null

        app.stage.eventMode = 'static'
        app.stage.hitArea = app.screen
        app.stage.on('pointerup', onDragEnd)
        app.stage.on('pointerupoutside', onDragEnd)

        function onDragMove(event) {
            if (dragTarget) {
                console.log(this)
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
                dragTarget = null
            }
        }

    })

</script>

<template>
    <main>
        <div class="grid">
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>

            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/1.jpg);"></div>
            <div class="grid__item" style="background-image:url(/assets/2.jpg);"></div>
        </div>
    </main>
</template>

<style>

    body {
        padding: 0;
        margin: 0;
        overflow: hidden;
    }

</style>
