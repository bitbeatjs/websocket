import {
    logger,
    getInstance,
    getInstancesOfType,
    Server,
    ConnectionMiddleware,
    Result,
    RunParameters,
    boot,
    store,
} from '@bitbeat/core';
import { ServerOptions, Server as WsServer, AddressInfo } from 'ws';
import WebSocketServerConfig from '../config/webSocketServerConfig';
import * as Throttle from 'promise-parallel-throttle';
import WebSocketConnection from '../webSocketConnection';
import { randomBytes } from 'crypto';
import { WebSocketAction } from '../index';
import { Debugger } from 'debug';

enum Types {
    Ping = 'ping',
    Pong = 'pong',
    Action = 'action',
    Response = 'response',
    Message = 'message',
    Subscribe = 'subscribe',
    Unsubscribe = 'unsubscribe',
}

export default class WebSocketServer extends Server {
    runtime: WsServer | undefined;
    debug: Debugger | any;

    constructor() {
        super();
        this.startPriority = 900;
        this.stopPriority = 700;
    }

    async configure(): Promise<void> {
        this.debug = boot.generateDebugger(this.name);
    }

    public generateNonce(): string {
        return randomBytes(16).toString('base64');
    }

    public async broadcast(message: {
        type: Types;
        nonce?: string;
        data?: any;
        error?: Error;
    }, securedOnly = true): Promise<void> {
        await Throttle.all(
            ([...this.connections] as WebSocketConnection[])
                .filter((conn) => (securedOnly && conn.secure) || !securedOnly)
                .map((conn) => async () => {
                    await this.send(conn, message);
                })
        );
    }

    public async send(
        conn: WebSocketConnection,
        message: {
            type: Types;
            data?: any;
            error?: Error;
        }
    ): Promise<void> {
        return new Promise((res, rej) => {
            conn.ws?.send(
                JSON.stringify({
                    nonce: this.generateNonce(),
                    ...message,
                    error: message.error?.toString(),
                }),
                (err) => (err ? rej(err) : res())
            );
        });
    }

    async start(): Promise<void> {
        const config = getInstance(WebSocketServerConfig)?.value;
        const actions = getInstancesOfType(WebSocketAction);
        this.runtime = new WsServer({
            ...config,
            verifyClient: async ({ origin, req, secure }, cb) => {
                this.debug('Verifying incoming client.');
                const conn = new WebSocketConnection(
                    this,
                    req.socket,
                    secure,
                    async () => {
                        this.debug(`Sending ping to client '${conn.id}'.`);
                        await this.send(conn, {
                            type: Types.Ping,
                        });
                        conn.validateTimeout = setTimeout(async () => {
                            this.debug(
                                `No pong from client '${conn.id}'. Removing connection.`
                            );
                            await this.send(conn, {
                                type: Types.Message,
                                error: new Error('Pong timeout.'),
                            });
                            conn.ws?.close(1000, 'Pong timeout.');
                            await this.removeConnection(conn);
                        }, 3000);
                    }
                );

                try {
                    const connectionMiddlewares: Set<ConnectionMiddleware> = this.getMiddlewaresOfType(
                        ConnectionMiddleware
                    ) as Set<ConnectionMiddleware>;
                    await Throttle.all(
                        [...connectionMiddlewares].map(
                            (connectionMiddleware) => async () => {
                                await connectionMiddleware.beforeCreate(
                                    conn,
                                    this
                                );
                            }
                        )
                    );
                    this.addConnection(conn);
                    this.debug(`Verified client with id '${conn.id}'.`);
                    cb(true);
                } catch (e) {
                    await conn.close();
                    cb(false, 4000, e.toString());
                }
            },
        });

        this.runtime.on('connection', async (ws, req) => {
            const conn = this.getConnection(
                req.socket.remoteAddress as string
            ) as WebSocketConnection;
            conn.ws = ws;
            logger.debug(`'${conn.id}' has connected.`);
            const connectionMiddlewares: Set<ConnectionMiddleware> = this.getMiddlewaresOfType(
                ConnectionMiddleware
            ) as Set<ConnectionMiddleware>;
            await Throttle.all(
                [...connectionMiddlewares].map(
                    (connectionMiddleware) => async () => {
                        await connectionMiddleware.afterCreate(conn, this);
                    }
                )
            );

            ws.on('error', (error) => {
                this.emit('message', {
                    conn,
                    nonce: this.generateNonce(),
                    type: Types.Response,
                    error,
                });
            });
            ws.on('pong', () => {
                this.emit('message', {
                    conn,
                    nonce: this.generateNonce(),
                    type: Types.Pong,
                });
            });
            ws.on('message', async (message) => {
                let msg: any = message.toString('utf-8');

                try {
                    msg = JSON.parse(msg);
                } catch (e) {
                    // dont do anything
                }

                const { data, nonce, type, error } = msg;
                this.emit('message', {
                    conn,
                    msg,
                    data,
                    nonce,
                    type,
                    error,
                });
            });
            ws.on('close', async (code, reason) => {
                this.debug(`Client '${conn.id}' disconnected.`);
                await this.removeConnection(conn);
                ws.removeAllListeners();
                ws.close(code, reason);
            });
        });
        this.debug(`${this.name} started.`);
        const options: ServerOptions = this.runtime.options as ServerOptions;
        const address: AddressInfo | null = this.runtime.address() as AddressInfo;
        logger.info(
            `Websocket server listening at ws://${address && address.address ? address.address : options?.host}:${address && address.port ? address.port : options?.port}`
        );

        this.on('message', async ({ conn, type, data, nonce }) => {
            try {
                let name: string, params: RunParameters['params'], action: WebSocketAction, res: Result, result: Result | any;
                let middlewares;
                switch (type.toLowerCase()) {
                    case Types.Action:
                        this.debug(`Got action request from '${conn.id}'.`);
                        name = data.name;
                        params = data.params;
                        [action] = [...actions].filter(
                            (action) => action.name === name
                        );

                        if (!action) {
                            await this.send(conn, {
                                type: Types.Response,
                                error: new Error('Action was not found.'),
                            });
                            return;
                        }

                        res = new Result();
                        middlewares = boot.getMiddlewaresOfInstance(
                            action,
                            store,
                        );
                        await Throttle.all(
                            [...middlewares].map(
                                (middleware: any) => async () =>
                                    middleware.beforeRun({
                                        action,
                                        result: res,
                                        raw: {
                                            conn,
                                        },
                                    })
                            ),
                            {
                                maxInProgress: 1,
                            }
                        );
                        result =
                            (await action.run({
                                params,
                                result: res,
                                raw: {
                                    conn,
                                },
                            })) || res;
                        await Throttle.all(
                            [...middlewares].map(
                                (middleware: any) => async () =>
                                    middleware.afterRun({
                                        action,
                                        result: res,
                                        raw: {
                                            conn,
                                        },
                                    })
                            ),
                            {
                                maxInProgress: 1,
                            }
                        );
                        await this.send(conn, {
                            type: Types.Response,
                            data: result,
                        });
                        this.debug(`Returned action result to '${conn.id}'.`);
                        break;
                    case Types.Pong:
                        if (!nonce) {
                            return this.send(conn, {
                                type: Types.Response,
                                error: new Error('No nonce found on ping response.'),
                            });
                        }

                        this.debug(`Got pong response from '${conn.id}'.`);
                        clearTimeout(conn.validateTimeout);
                        break;
                    case Types.Subscribe:
                        this.debug(`Got subscribe request from '${conn.id}'.`);
                        await this.send(conn, {
                            type: Types.Response,
                        });
                        break;
                    case Types.Unsubscribe:
                        this.debug(
                            `Got unsubscribe request from '${conn.id}'.`
                        );
                        await this.send(conn, {
                            type: Types.Response,
                        });
                        break;
                    default:
                }
            } catch (e) {
                await this.send(conn, {
                    type: Types.Response,
                    error: e,
                });
            }
        });
        return super.start();
    }

    async stop(): Promise<void> {
        await Throttle.all(
            ([...this.connections] as WebSocketConnection[]).map(
                (conn) => async () => {
                    conn.ws?.close(1012, 'Server closed.');
                    this.debug(`Send close event to '${conn.id}'.`);
                    logger.info(`Send close event to '${conn.id}'.`);
                    await this.removeConnection(conn);
                    this.debug(`Closed connection '${conn.id}'.`);
                    logger.info(`Closed connection '${conn.id}'.`);
                }
            )
        );
        this.runtime?.close();
        this.debug(`${this.name} stopped.`);
        logger.info(`${this.name} stopped.`);
        return super.stop();
    }
}
