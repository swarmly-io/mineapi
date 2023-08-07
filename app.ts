import express from 'express';
import { BotService, InitBot } from './bot_api';
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

    let bot = new BotService(params.port, params.host, params.name)
    bots[bot.name] = bot

    res.send({ botId: bot.id, name: params.name });
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
    res.send(await bot.start_task(req.body, true))
})

app.post('/tryDo/:name', async (req, res) => {
    const bot = getBot(req.params.name);
    console.log(req.body)
    const result = await bot.start_task(req.body)
    res.send({"message": "task started", "result": result })
})

app.get('/stop/:name', async (req, res) => {
    const bot = getBot(req.params.name);
    await bot.stop()
    res.send({"message": "bot stopped" })
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


