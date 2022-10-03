import { Attributes } from './Attributes'
import mineflayer from "mineflayer"
import mcd from 'minecraft-data'
import readline from 'readline'
import { ILogObject, Logger } from 'tslog'
import { observe, prettyObservation } from './Observer'
import { MinecraftVersion } from './Config'
import fs from 'fs'
import { FightActionParams } from './actions/FightAction'
import { BuildSchematicAction } from './actions/BuildSchematicAction'
import { Schematic } from 'prismarine-schematic'
import { Vec3 } from 'vec3'

let mcData = mcd(MinecraftVersion)

if (fs.existsSync('log.txt')) { // remove log file
    fs.unlinkSync('log.txt')
}

const writeLog = (log: ILogObject) => {
    let obj = {
        date: log.date,
        level: log.logLevel,
        file: `${log.fileName}:${log.lineNumber}`,
        message: log.argumentsArray
    }
    fs.appendFileSync('log.txt', JSON.stringify(obj, null, 2) + '\n')
}
const logger = new Logger({ minLevel: "trace", suppressStdOutput: true })
logger.attachTransport({
    silly: writeLog,
    debug: writeLog,
    trace: writeLog,
    info: writeLog,
    warn: writeLog,
    error: writeLog,
    fatal: writeLog,
}, "debug")

const host = process.argv[2] || '127.0.0.1'
const port = process.argv[3] || 25565
const name = process.argv[4] || 'McBot'

const bot = mineflayer.createBot({
 // host: process.argv[0],
  host: host,
  port: port as number,
  username: name,
//  username: process.argv[4] ? process.argv[4] : "finder",
//  password: process.argv[5],
});

const attributes = new Attributes(bot, mcData, logger)
var i = (x) => { console.log('inspect',x); return x; }
let chain = [
    attributes.collect_logs(3),
    attributes.craft({ itemIds: mcData.itemsArray.filter(x => x.name.endsWith("_planks")).map(x => x.id), count: 12 }),
    attributes.craft_table(),
    attributes.place_table(),
    attributes.craft({itemIds: mcData.itemsByName.stick.id, count: 4}),
    attributes.craft_pickaxe(),
    attributes.findAndCollectResource({ blockIds: mcData.blocksByName.stone.id, amountToCollect: 10, allowedMaxDistance: 32 }),
    attributes.craft({ itemIds: mcData.itemsByName.stone_pickaxe.id, count: 1 }),
    attributes.findAndCollectResource({ blockIds: mcData.blocksByName.iron_ore.id, amountToCollect: 3, allowedMaxDistance: 64 })
]

let chain_craft_only = [
    attributes.craft_pickaxe()]

let chain_table_only = [
    attributes.place_table()]

async function read() {
  const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    reader.question(`please input a command \n`, async cmd => {
        if (cmd === 'observe') {
            observe(bot).then(x => console.log(x))
        }
        if (cmd == 'chain possible') {
            attributes.canDo(chain).then(x => {
                if (true !== x) {
                    console.log(`Chain not possible: Task ${x.index + 1} fails with reason '${x.reason}'`)
                } else {
                    console.log("Chain is possible")
                }
            })
        }
        if (cmd === 'execute chain') {
            try {
                attributes.tryDo(chain).then(res => {
                    console.log("Done")
                })
            } catch (e) {
                console.log(e)
            }
        }

        if (cmd === 'execute chain table') {
            try {
                attributes.tryDo(chain_craft_only).then(res => {
                    console.log("Done")
                })
            } catch (e) {
                console.log(e)
            }
        }

        if (cmd === 'place table') {
            try {
                attributes.tryDo(chain_table_only).then(res => {
                    console.log("Done")
                })
            } catch (e) {
                console.log(e)
            }
        }

        if (cmd.includes("fight")) {
            const [_, type, name] = cmd.split(" ")
            const params = { entityName: name, entityType: type } as FightActionParams
            attributes.tryDo([attributes.fight(params)])
        }

        if (cmd === "build") {
            let schematic = await Schematic.read(fs.readFileSync('small_house.schem'), MinecraftVersion)
            schematic.offset = new Vec3(0, 0, 0)
            attributes.tryDo([attributes.build_schematic({
                schematic: schematic,
                position: bot.entity.position.floored()
            })])
        }



          if (cmd == "make an axe") {
              // todo, should be able to find any type of wood
              // todo, should have some try do command
              // todo a chain of do commands tryDo([collect_wood, craft_table, make_axe, craft_pickaxe])
              // it should evaluate the chain and see if it is possible, throw not possible exception | perform action

              // todo add canDo([collect_wood, craft_table, make_axe, craft_pickaxe]) -> evaluates chain and returns true | false 
            //   await attributes.findAndCollectResource(mcData.blocksByName.oak_log.id, 3)
            //   await attributes.craft_table()
            //   await attributes.craft_pickaxe()
          }
        //   if (cmd == "collect") {
        //       await bot.collect()
        //   }
        //   if (cmd == "empty") {
        //       await bot.empty()
        //   }
        //   if (cmd == "nudge") {
        //       await bot.nudge()
        //   }
          reader.close()
          read()
      })
}
read()