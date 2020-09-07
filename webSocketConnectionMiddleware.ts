import { ConnectionMiddleware } from '@bitbeat/core';
import WebSocketConnection from './webSocketConnection';
import WebSocketServer from './servers/webSocketServer';

export default class WebSocketConnectionMiddleware extends ConnectionMiddleware {
    constructor() {
        super();
    }

    public async beforeCreate(
        connection: WebSocketConnection,
        server: WebSocketServer
    ): Promise<void> {}
    public async afterCreate(
        connection: WebSocketConnection,
        server: WebSocketServer
    ): Promise<void> {}
    public async beforeDestroy(
        connection: WebSocketConnection,
        server: WebSocketServer
    ): Promise<void> {}
    public async afterDestroy(
        connection: WebSocketConnection,
        server: WebSocketServer
    ): Promise<void> {}
}
