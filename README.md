# BITBEAT WEBSOCKET MODULE

## Introduction

This is the official websocket module for bitbeat using ws.<br>
This package will export you a websocket server and a websocket server config.<br>
To use it follow the documentation of bitbeat at [the homepage](https://bitbeat.projects.oliverfreudrich.com/#/?id=add-existing-module-extend-core).

## Configure

The default `WebConfig` looks like this:

```typescript
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
```

You can edit those properties by either extending the `WebSocketConfig` class in your project's config folder as own class or edit it in the `boot.js`.

### Example 1:

-- config<br>
&nbsp;|-- myOwnConfig.ts

```typescript
import { WebSocketConfig } from '@bitbeat/websocket';
import { merge } from 'lodash';

export default class MyOwnConfig extends WebSocketConfig {
    constructor() {
        super();
    }

    default = {}; // this will overwrite the default props

    /* or you can do something non-destructive like this
    default = merge(default, {
        port: 3000,
    });
    */
}
```

### Example 2:

This example happens in the `boot.js`:

```typescript
import { registerBulk } from '@bitbeat/core';
import { WebSocketConfig, WebSocketServer } from '@bitbeat/websocket';

export default async () => {
    const webSocketConfig = new WebSocketConfig();
    webSocketConfig.default.port = 3000;
    await registerBulk(new Set([webSocketConfig, WebSocketServer]));
};
```
