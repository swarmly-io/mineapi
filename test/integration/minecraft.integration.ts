import assert from 'node:assert/strict'
import mineflayer, { Bot } from 'mineflayer'
import mcd from 'minecraft-data'
import { Rcon } from 'rcon-client'
import { goals } from 'mineflayer-pathfinder'
import { Schematic } from 'prismarine-schematic'
import { Vec3 } from 'vec3'
import { Attributes } from '../../Attributes'
import { MinecraftVersion } from '../../Config'
import { TravelAction } from '../../actions/TravelAction'
import { CraftAction } from '../../actions/CraftAction'
import { FindAndCollectAction } from '../../actions/FindAndCollectResourceAction'
import { MineBlockAtAction } from '../../actions/MineBlockAtAction'
import { FightAction } from '../../actions/FightAction'
import { BuildSchematicAction } from '../../actions/BuildSchematicAction'
import { logger } from '../../log'

const host = process.env.MINECRAFT_HOST ?? '127.0.0.1'
const port = Number(process.env.MINECRAFT_PORT ?? 25565)
const rconPort = Number(process.env.MINECRAFT_RCON_PORT ?? 25575)
const username = process.env.MINECRAFT_USERNAME ?? 'MineApiIntegration'
const rconPassword = process.env.MINECRAFT_RCON_PASSWORD ?? 'integration-test-password'
const mcData = mcd(MinecraftVersion)

const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))

const waitFor = <T>(callback: () => T | undefined, message: string, timeout = 20_000): Promise<T> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    const poll = () => {
      const result = callback()
      if (result !== undefined) return resolve(result)
      if (Date.now() >= deadline) return reject(new Error(message))
      setTimeout(poll, 100)
    }
    poll()
  })

const waitForSpawn = (bot: Bot): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for bot spawn')), 30_000)
    bot.once('spawn', () => {
      clearTimeout(timeout)
      resolve()
    })
    bot.once('error', reject)
  })

async function main () {
  const rcon = await Rcon.connect({ host, port: rconPort, password: rconPassword })
  const bot = mineflayer.createBot({ host, port, username, version: MinecraftVersion, auth: 'offline' })

  try {
    await waitForSpawn(bot)
    const attributes = new Attributes(bot, mcData, logger)

    await rcon.send('gamerule doMobSpawning false')
    await rcon.send(`gamemode survival ${username}`)
    await rcon.send(`clear ${username}`)
    await rcon.send(`tp ${username} 0 5 0`)
    await rcon.send('fill -16 0 -16 16 3 16 stone')
    await rcon.send('fill -16 4 -16 16 4 16 grass_block')
    await sleep(500)

    assert.equal(bot.entity !== undefined, true, 'bot should log in and spawn')

    const travel = new TravelAction({ bot, mcData, goal: new goals.GoalNear(4, 5, 0, 1) })
    assert.equal(await travel.do(), true, 'bot should move to a pathfinding goal')
    assert.ok(bot.entity.position.distanceTo(new Vec3(4, 5, 0)) <= 2, 'bot should reach movement target')

    await rcon.send(`give ${username} minecraft:oak_log 4`)
    await sleep(500)
    const craft = new CraftAction({ bot, mcData, itemIds: mcData.itemsByName.oak_planks.id, count: 4 })
    assert.equal(await craft.do(false, undefined), true, 'bot should craft planks from logs')
    assert.ok(bot.inventory.count(mcData.itemsByName.oak_planks.id, null) >= 4, 'crafted planks should be in inventory')

    await rcon.send('setblock 7 5 0 minecraft:oak_log')
    await sleep(500)
    const collect = new FindAndCollectAction({
      bot,
      mcData,
      blockIds: mcData.blocksByName.oak_log.id,
      amountToCollect: 1,
      allowedMaxDistance: 16
    })
    assert.equal(await collect.do(false, undefined), true, 'bot should collect a nearby block')
    await waitFor(() => bot.blockAt(new Vec3(7, 5, 0))?.name === 'air' ? true : undefined, 'bot did not collect the target block')

    const exactTarget = new Vec3(8, 5, 0)
    await rcon.send(`setblock ${exactTarget.x} ${exactTarget.y} ${exactTarget.z} minecraft:oak_log`)
    await sleep(500)
    const mineAt = new MineBlockAtAction({
      bot,
      mcData,
      blockId: mcData.blocksByName.oak_log.id,
      position: exactTarget
    })
    assert.equal(await mineAt.do(false, undefined), true, 'bot should collect the exact target block')
    await waitFor(() => bot.blockAt(exactTarget)?.name === 'air' ? true : undefined, 'bot did not collect the exact target block')

    await rcon.send('summon zombie 5 5 3 {NoAI:1b}')
    const zombie = await waitFor(() => Object.values(bot.entities).find(entity => entity.name === 'zombie'), 'zombie did not appear')
    const fight = new FightAction({ bot, mcData, entityName: 'zombie', entityType: 'mob' })
    assert.equal(await fight.do(), true, 'bot should start combat with a nearby zombie')
    await waitFor(() => bot.entities[zombie.id] === undefined ? true : undefined, 'bot did not defeat the zombie', 30_000)

    const buildPosition = new Vec3(10, 5, 0)
    await rcon.send(`setblock ${buildPosition.x} ${buildPosition.y} ${buildPosition.z} minecraft:air`)
    await rcon.send(`give ${username} minecraft:stone 1`)
    await sleep(500)
    const schematic = new Schematic(MinecraftVersion, new Vec3(1, 1, 1), new Vec3(0, 0, 0), [mcData.blocksByName.stone.defaultState], [0])
    const build = new BuildSchematicAction({ bot, mcData, schematic, position: buildPosition })
    assert.equal(await build.do(), true, 'bot should build a schematic block')
    await waitFor(() => bot.blockAt(buildPosition)?.name === 'stone' ? true : undefined, 'bot did not place the schematic block')
  } finally {
    bot.quit()
    rcon.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
