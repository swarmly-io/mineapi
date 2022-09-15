import { Attributes } from './Attributes.js'
import mineflayer from "mineflayer"
import mcd from 'minecraft-data'
import readline from 'readline'
import { observe } from './Observer.js'
import { MinecraftVersion } from './Config.js'

let mcData = mcd(MinecraftVersion)

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

const attributes = new Attributes(bot, mcData)

let chain = [attributes.collect_logs(3), 
    attributes.craft({ itemIds: mcData.itemsArray.filter(x => x.name.endsWith('_planks')).map(x => x.id), count: 12, allowWalking: false }),
    attributes.craft({ itemIds: mcData.itemsByName.stick.id, count: 4, allowWalking: false }),
    attributes.craft_axe()]

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
                if (typeof x === 'number') {
                    console.log("Chain not possible: Failing at task " + (x + 1))
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