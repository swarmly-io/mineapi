import express from 'express';
import { BotService, InitBot, TaskEnvelope } from './bot_api';
import mcd from 'minecraft-data';
import { MinecraftVersion } from './Config';
import { SearchData, searchMcData } from './helpers/McDataHelper';
import { TravelGoal, createGoal } from './helpers/TravelHelper'
import { Example, StartExample } from './example';
import 'express-async-errors';

const app = express();
const port = 3000;
app.use(express.json())

const bots: { [name: string]: BotService } = {}
let mcData = mcd(MinecraftVersion)

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/', (req, res) => {
    const params = req.body as InitBot
    if (bots[params.name]) {
        bots[params.name].reset()
        res.send({ botId: bots[params.name].id, name: params.name });
    }

    try {
        let bot = new BotService(params.port, params.host, params.name)
        bots[bot.name] = bot

        res.send({ botId: bot.id, name: params.name });
    } catch (e) {
        console.log(e)
        res.status(500)
    }
});

app.get('/status/:name', (req, res) => {
    const params = req.params
    if (!bots[params.name]) {
        throw new Error("No bot found")
    }

    res.send(bots[params.name].errors)
});

app.post('/canDo/:name', async (req, res) => {
    const bot = getBot(req.params.name);
    console.log(req.body)
    res.send(await bot.can_do(req.body))
})

app.post('/tryDo/:name', async (req, res) => {
    const bot = getBot(req.params.name);
    console.log(req.body)
    const task = await bot.start_task(req.body)
    res.status(202).send({ message: "task accepted", taskId: task.id, task })
})

app.post('/v1/bots', (req, res) => {
    const params = req.body as InitBot
    if (!params?.name) return res.status(400).send(errorEnvelope('invalid_request', 'name is required'))
    if (bots[params.name]) return res.status(200).send({ bot_id: bots[params.name].id, name: params.name })
    const bot = new BotService(params.port, params.host, params.name)
    bots[bot.name] = bot
    res.status(201).send({ bot_id: bot.id, name: bot.name })
})

app.post('/v1/bots/:bot/tasks:preflight', async (req, res) => {
    const body = req.body as Partial<TaskEnvelope>
    if (!Array.isArray(body.action_chain)) return res.status(400).send(errorEnvelope('invalid_request', 'action_chain is required'))
    res.send(await getBot(req.params.bot).preflight(body.action_chain))
})

app.post('/v1/bots/:bot/tasks', async (req, res) => {
    const envelope = req.body as TaskEnvelope
    if (!envelope?.action_id || !envelope.capability_id || !Array.isArray(envelope.action_chain)) {
        return res.status(400).send(errorEnvelope('invalid_request', 'action_id, capability_id, and action_chain are required'))
    }
    const task = await getBot(req.params.bot).start_envelope(envelope)
    res.status(202).send(task)
})

app.get('/v1/bots/:bot/tasks/:taskId', (req, res) => {
    const task = getBot(req.params.bot).get_task(req.params.taskId)
    if (!task) return res.status(404).send(errorEnvelope('task_not_found', 'No task found'))
    res.send(task)
})

app.post('/v1/bots/:bot/tasks/:taskId/cancel', async (req, res) => {
    await getBot(req.params.bot).stop(req.params.taskId)
    res.status(202).send({ task_id: req.params.taskId, message: 'cancellation requested' })
})

app.get('/v1/bots/:bot/observations', (req, res) => {
    const since = req.query.since_version === undefined ? undefined : Number(req.query.since_version)
    if (since !== undefined && !Number.isInteger(since)) return res.status(400).send(errorEnvelope('invalid_request', 'since_version must be an integer'))
    res.send(getBot(req.params.bot).get_observations(since))
})

app.get('/v1/bots/:bot/events', (req, res) => {
    const bot = getBot(req.params.bot)
    res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }).flushHeaders()
    const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`)
    bot.events.forEach(send)
    const unsubscribe = bot.subscribe(send)
    req.on('close', unsubscribe)
})

app.get('/v1/capabilities', (_req, res) => res.send({ minecraft_protocol_version: MinecraftVersion, mineflayer_version: '4.39.0', supported_actions: Object.keys(bots).length ? Object.values(bots)[0].get_actions() : ['CraftAction', 'FightAction', 'FindAndCollectAction', 'MineBlockAtAction', 'PlaceAction', 'SleepAction', 'TravelAction', 'SmeltAction', 'DepositAction', 'WithdrawAction'] }))

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes('No bot') || message.includes('No task') ? 404 : 400
    res.status(status).send(errorEnvelope(status === 404 ? 'not_found' : 'invalid_request', message))
})

app.get('/task/:name/:taskId', (req, res) => {
    const task = getBot(req.params.name).get_task(req.params.taskId)
    if (!task) return res.status(404).send({ message: "No task found" })
    res.send(task)
})

app.post('/stop/:name/:taskId?', async (req, res) => {
    const bot = getBot(req.params.name);
    await bot.stop(req.params.taskId)
    res.send({"message": "task cancelled", taskId: req.params.taskId })
})

app.post('/all/tryDo', (req, res) => {
    for (const name of Object.keys(bots)) {
        const bot = bots[name]
        if (!bot) {
            throw new Error("No bot found")
        }
        console.log(req.body)
        bot.start_task(req.body)
    }
    res.send({"message": "task started"})
})

app.get("/state/:name", async (req, res) => {
    const bot = getBot(req.params.name)
    res.send(await bot.get_agent_state())
})

app.get('/action_state/:name', async (req, res) => {
    const bot = getBot(req.params.name);
    res.send(await bot.get_action_state())
})

app.get("/players/:name", (req, res) => {
    const bot = getBot(req.params.name)
    res.send(bot.bot.players)
})

app.post("/search/", async (req, res) => {
    const params = req.body as SearchData
    res.send(searchMcData(mcData, params))
})

app.post('/makeGoal/', async (req, res) => {
    const params = req.body as TravelGoal
    res.send(createGoal(params))
})

app.post('/example',async (req, res) => {
   const params = req.body as StartExample
   const example = new Example(params, mcData)
   await example.run()
   res.send({ "message": params.type + " example running!" })
})

app.listen(port, () => {
  return console.log(`http://localhost:${port}`);
});

function getBot(name: string) {
    const bot = bots[name];
    if (!bot) {
        throw new Error("No bot found");
    }

    return bot;
}

function errorEnvelope(code: string, message: string, retryable = false, details: Record<string, unknown> = {}) {
    return { code, message, retryable, details }
}
