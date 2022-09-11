import { Attributes } from './attributes.js'
import mineflayer from "mineflayer"
import mcd from 'minecraft-data'
let mcData = mcd('1.17.1')
import readline from 'readline'
import fs from 'fs'

const port = process.argv[2] || 54393

const bot = mineflayer.createBot({
 // host: process.argv[0],
  port: port,
//  username: process.argv[4] ? process.argv[4] : "finder",
//  password: process.argv[5],
});

const attributes = new Attributes(bot, mcData)

async function read() {
  const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    reader.question(`please input a command \n`, async cmd => {
          if (cmd == "make an axe") {
              // todo, should be able to find any type of wood
              // todo, should have some try do command
              // todo a chain of do commands tryDo([collect_wood, craft_table, make_axe, craft_pickaxe])
              // it should evaluate the chain and see if it is possible, throw not possible exception | perform action

              // todo add canDo([collect_wood, craft_table, make_axe, craft_pickaxe]) -> evaluates chain and returns true | false 
              await attributes.findAndCollectResource(mcData.blocksByName.birch_wood.id, 50)
              await attributes.craft_table()
              await attributes.crafting_pickaxe()
          }
          if (cmd == "collect") {
              await bot.collect()
          }
          if (cmd == "empty") {
              await bot.empty()
          }
          if (cmd == "nudge") {
              await bot.nudge()
          }
          reader.close()
          read()
      })
}
read()