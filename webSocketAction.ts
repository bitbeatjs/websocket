import { Action, Result } from '@bitbeat/core';
import WebSocketConnection from './webSocketConnection';

export default class WebSocketAction extends Action {
    strict = false;

    constructor() {
        super();
    }

    async run(data: {
        params: any;
        result: Result;
        raw: {
            conn: WebSocketConnection;
        };
    }): Promise<any | void> {}
}
