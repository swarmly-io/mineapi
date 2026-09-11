# MC Bot
This project allows you to run a swarm of bots from through REST API! This is can easily be coupled with a decision engine, task scheduler or run manually. 

## Running
* Install Node.js 22 or later.
* ```npm ci```
* Start minecraft and run ```/publish 1337```
* Now start the API ```npm start```
* Use the postman collection to initialise a bot, now you can run commands like fight an entity or collect resources.

## Task lifecycle API

`POST /tryDo/:name` accepts a callback chain and immediately returns `202 Accepted` with a `taskId`.
Poll `GET /task/:name/:taskId` for the correlated lifecycle (`accepted`, `running`, `succeeded`,
`failed`, or `cancelled`), execution result, before/after observations, and block changes observed
while the task ran. `GET /action_state/:name` includes the active `taskId` with the current activity
analysis. Cancel the active task with `POST /stop/:name/:taskId`.

For an exact mining contract, use `MineBlockAtAction`:

```json
[
  {
    "typeName": "MineBlockAtAction",
    "params": {
      "blockId": 17,
      "position": { "x": 7, "y": 5, "z": 0 }
    },
    "continueOnFailure": false
  }
]
### Internal package registries
For a registry that is TLS-inspected with an internal CA, preserve TLS verification and provide the CA certificate as a BuildKit secret:

```sh
docker build --secret id=npm_ca,src=/path/to/registry-ca.pem -t mineapi .
```

## Integration tests
The integration suite exercises login, movement, crafting, collection, combat, and schematic building against a local Java 1.17.1 server.

```sh
docker compose -f test/docker-compose.integration.yml up -d --wait
npm run test:integration
docker compose -f test/docker-compose.integration.yml down -v
```

## Example before a bunch of bug fixes
![Bot example](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanpsdW1nOTI5YTNqZnN6aDI5NzM5aTc3ZmN4N3lmYmxxZW5rNHI0cSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/aaqEg3r8va8wCGZORL/giphy-downsized-large.gif)
