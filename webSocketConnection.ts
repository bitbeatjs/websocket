import { Connection, Server } from '@bitbeat/core';
import { Socket } from 'net';
import WebSocket from 'ws';
import Timer = NodeJS.Timer;

export default class WebSocketConnection extends Connection {
    ws: WebSocket | undefined;
    validateTimeout: Timer | undefined;

    constructor(
        server: Server,
        socket: Socket,
        secure: boolean = false,
        recycleFunction: () => Promise<void>
    ) {
        super(server, socket, secure, recycleFunction);
    }
}
