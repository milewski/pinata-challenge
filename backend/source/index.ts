import { PinataSDK } from 'pinata'
import { fastify } from 'fastify'
import cors from '@fastify/cors'

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: 'pink-realistic-hare-164.mypinata.cloud',
})

const app = fastify()
app.register(cors, { origin: '*' })

async function getOneTimeToken(usages: number): Promise<string> {

    const key = await pinata.keys.create({
        keyName: 'Signed Upload JWT',
        maxUses: usages,
        permissions: {
            endpoints: {
                data: {
                    pinList: false,
                    userPinnedDataTotal: false,
                },
                pinning: {
                    pinFileToIPFS: true,
                    pinJSONToIPFS: true,
                    pinJobs: false,
                    unpin: false,
                    userPinPolicy: false,
                },
            },
        },
    })

    return key.JWT

}

app.get('/getToken', async request => {

    const count = Math.min(20, parseInt(request.query[ 'count' ] || '1'))

    return {
        token: await getOneTimeToken(count),
    }

})

app.listen({ port: 3000, host: '0.0.0.0' }, function () {
    console.log('Server running at http://0.0.0.0:3000/')
})