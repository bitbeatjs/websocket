import { ActionMiddleware } from '@bitbeat/core';
import WebSocketAction from './webSocketAction';
import WebSocketConnection from './webSocketConnection';

export default class WebSocketActionMiddleware extends ActionMiddleware {
    constructor() {
        super();
    }
    /**
     * The function to run before running the run function.
     */
    public async beforeRun(data: {
        action: WebSocketAction;
        result: any;
        raw: {
            conn: WebSocketConnection;
        };
    }): Promise<void> {}
    /**
     * The function to run after running the run function.
     */
    public async afterRun(data: {
        action: WebSocketAction;
        result: any;
        raw: {
            conn: WebSocketConnection;
        };
    }): Promise<void> {}
}
