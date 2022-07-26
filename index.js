/*
 * This simple bot will help you find any block
 */
const mineflayer = require("mineflayer");
const {
  pathfinder,
  Movements,
  goals: { GoalNear },
} = require("mineflayer-pathfinder");
const { performance } = require("perf_hooks");

if (process.argv.length < 4 || process.argv.length > 6) {
  console.log(
    "Usage : node blockfinder.js <host> <port> [<name>] [<password>]"
  );
  process.exit(1);
}

const bot = mineflayer.createBot({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username: process.argv[4] ? process.argv[4] : "finder",
  password: process.argv[5],
});

const RANGE_GOAL = 1;

bot.loadPlugin(pathfinder);

bot.on("chat", async (username, message) => {
  if (username === bot.username) return;

  if (message === "loaded") {
    console.log(bot.entity.position);
    await bot.waitForChunksToLoad();
    bot.chat("Ready!");
  }

  if (message.startsWith("find")) {
    findPath()
  }

  if (message.startsWith("craft")) {
    const command = message.split(" ");
    craftItem(command[2], command[1]);
  }

  if (message === "list") {
    sayItems();
  }
});

function sayItems(items = null) {
  if (!items) {
    items = bot.inventory.items();
    if (
      require("minecraft-data")(bot.version).isNewerOrEqualTo("1.9") &&
      bot.inventory.slots[45]
    )
      items.push(bot.inventory.slots[45]);
  }
  const output = items.map(itemToString).join(", ");
  if (output) {
    bot.chat(output);
  } else {
    bot.chat("empty");
  }
}

function findPath() {
  const mcData = require("minecraft-data")(bot.version);
  const defaultMove = new Movements(bot, mcData);

  const name = message.split(" ")[1];

  if (mcData.blocksByName[name] === undefined) {
    bot.chat(`${name} is not a block name`);
    return;
  }
  const ids = [mcData.blocksByName[name].id];

  const startTime = performance.now();
  const blocks = bot.findBlocks({
    matching: ids,
    maxDistance: 128,
    count: 10,
  });
  const time = (performance.now() - startTime).toFixed(2);

  bot.chat(`I found ${blocks.length} ${name} blocks in ${time} ms`);

  if (blocks.length === 0) {
    bot.chat("Abort action");
    return;
  }

  const { x: botX, y: botY, z: botZ } = bot.spawnPoint;
  const { x, y, z } = blocks[0];

  bot.pathfinder.setMovements(defaultMove);
  bot.pathfinder.setGoal(new GoalNear(x, y, z, RANGE_GOAL));
  // return to spawn point
  bot.pathfinder.setGoal(new GoalNear(botX, botY, botZ, RANGE_GOAL));
}

async function craftItem(name, amount) {
  amount = parseInt(amount, 10);
  const mcData = require("minecraft-data")(bot.version);

  const item = mcData.itemsByName[name];
  const craftingTableID = mcData.blocksByName['stick']
  console.log(craftingTableID);

  // const craftingTable = bot.findBlock({
  //   matching: craftingTableID
  // })

  // if (item) {
  //   const recipe = bot.recipesFor(item.id, null, 1, craftingTable)[0]
  //   if (recipe) {
  //     bot.chat(`I can make ${name}`)
  //     try {
        // await bot.craft(recipe, amount)
  //       bot.chat(`did the recipe for ${name} ${amount} times`)
  //     } catch (err) {
  //       bot.chat(`error making ${name}`)
  //     }
  //   } else {
  //     bot.chat(`I cannot make ${name}`)
  //   }
  // } else {
  //   bot.chat(`unknown item: ${name}`)
  // }
  // console.log(`item: ${item.displayName}`);
  // console.log(`craftingTableID: ${craftingTableID}`);
  // console.log(`craftingTable: ${craftingTable}`);
}

function itemToString(item) {
  if (item) {
    return `${item.name} x ${item.count}`;
  } else {
    return "(nothing)";
  }
}

function itemByName(name) {
  const items = bot.inventory.items();
  if (
    require("minecraft-data")(bot.version).isNewerOrEqualTo("1.9") &&
    bot.inventory.slots[45]
  )
    items.push(bot.inventory.slots[45]);
  return items.filter((item) => item.name === name)[0];
}
