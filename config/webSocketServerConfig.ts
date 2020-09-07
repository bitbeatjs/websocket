import { Configuration } from '@bitbeat/core';

export default class WebSocketServerConfig extends Configuration {
    constructor() {
        super();
    }

    default: {
        host: string;
        port: number;
        [name: string]: any;
    } = {
        host: 'localhost',
        port: 5000,
        perMessageDeflate: {
            zlibDeflateOptions: {
                chunkSize: 1024,
                memLevel: 7,
                level: 3,
            },
            zlibInflateOptions: {
                chunkSize: 10 * 1024,
            },
            clientNoContextTakeover: true,
            serverNoContextTakeover: true,
            serverMaxWindowBits: 10,
            concurrencyLimit: 10,
            threshold: 1024,
        },
    };
}
