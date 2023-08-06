import { goals } from 'mineflayer-pathfinder'
import { Block } from 'prismarine-block'
import { NotEnoughItemsError } from "../errors/NotEnoughItemsError"
import { findBlocks } from "../helpers/EnvironmentHelper"
import { assertHas } from "../helpers/InventoryHelper"
import { vec2key } from '../Observer'
import { Observation, Consequences } from "../types"
import { Action, ActionParams } from "./Action"
import { ActionDoResult } from './types'
import pathfinder from 'mineflayer-pathfinder';
const { GoalBlock } = pathfinder.goals;

export type FindAndCollectParams = {
    blockIds: number | number[],
    amountToCollect: number,
    allowedMaxDistance: number
}

export class FindAndCollectAction extends Action<FindAndCollectParams> {

    constructor(params: ActionParams<FindAndCollectParams>) {
        super(params)
    }

    async do(): Promise<ActionDoResult> { // TODO: Do we need metadata?     
        const blocks = findBlocks(this.bot, this.options.blockIds, this.options.allowedMaxDistance, this.options.amountToCollect)
        this.bot.chat("Going to get some blocks: " + blocks.length)
        if (blocks.length === 0) {
            return { reason: "FindAndCollectBlock: No blocks found" }
        }

        const targets: Block[] = []
        let equiped = false
        for (let i = 0; i < Math.min(blocks.length, this.options.amountToCollect); i++) {
            let block = this.bot.blockAt(blocks[i])
            if (block) {
                targets.push(block!)
                if (!equiped) {
                    await this.bot.tool.equipForBlock(block!, { getFromChest: true })
                    equiped = true
                }
            }
        }

        const moveToBlock = async (targetBlock) => {
            return new Promise((resolve, reject) => {
                this.bot.pathfinder.setGoal(new GoalBlock(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z));

                this.bot.once('goal_reached', resolve);
                this.bot.once('path_update', (data) => {
                    if (data.status === 'noPath') reject(new Error('No path to target block!'));
                });
            });
        }

        const dig = async (targetBlock) => {
            if (!targetBlock) {
                this.bot.chat('No target block provided');
                return;
            }

            if (this.bot.targetDigBlock) {
                this.bot.chat(`already digging ${this.bot.targetDigBlock.name}`);
            } else {
                if (this.bot.canDigBlock(targetBlock)) {
                    this.bot.chat(`starting to dig ${targetBlock.name}`);
                    try {
                        await this.bot.dig(targetBlock);
                        this.bot.chat(`finished digging ${targetBlock.name}`);
                    } catch (err) {
                        console.log(err);
                    }
                } else {
                    this.bot.chat('cannot dig');
                }
            }
        }

        const timeoutDuration = 30000; // 30 seconds
        const timeoutPromise = () => new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Navigation timed out!'));
            }, timeoutDuration);
        });

        try {
            for (let target of targets) {
                console.log("Target", target)
                //@ts-ignore  ts doesnt know about mineflayer plugins
                await Promise.race([moveToBlock(target), timeoutPromise()])
                    .then(() => {
                        if (this.bot.canDigBlock(target)) {
                            this.bot.chat(`starting to dig ${target.name}`);
                            return dig(target);
                        } else {
                            throw new Error('Cannot dig target block');
                        }
                    })
                    .then(() => {
                        this.bot.chat(`finished digging ${target.name}`);
                    })
                    .catch((err) => {
                        if (err.message === 'Navigation timed out!') {
                            this.bot.chat('I had trouble navigating. Please check my path.');
                        } else {
                            this.bot.chat(err.message);
                        }
                        console.log(err.stack);
                    });
            }
        } catch (e) {
            console.log("Error in collect", e)
            this.bot.chat("Darn!");

            return { reason: e } as ActionDoResult
        }
        return true
    }

    async possible(observation: Observation): Promise<Consequences> {
        this.bot.chat("Checking for blocks!")
        let blockTypes = typeof this.options.blockIds === 'number' ? [this.mcData.blocks[this.options.blockIds]] : this.options.blockIds.map(x => this.mcData.blocks[x])
        // Now checking for harvest tools
        let mineableBlockTypes = blockTypes.filter(blockType => {
            if (blockType.harvestTools !== undefined) {
                try {
                    assertHas(observation, 1, (i => !blockType.harvestTools || Object.keys(blockType.harvestTools!).includes(i as string)))
                } catch (e) {
                    if (e instanceof NotEnoughItemsError) {
                        return false
                    } else throw e
                }
            }
            return true
        })
        if (mineableBlockTypes.length === 0) {
            return { success: false, reason: "FindAndCollectResource: No blocks found" }
        }

        const blocks = findBlocks(this.bot, mineableBlockTypes.map(x => x.id), this.options.allowedMaxDistance, this.options.amountToCollect, observation)

        if (blocks.length < this.options.amountToCollect) {
            return { success: false, reason: "FindAndCollectResource: Not enough blocks found" }
        }

        // WARNING:
        // Since we cannot know what blocks the bot will actually collect in the do() method (when multiple blockIds were provided),
        // this will just return the drops of the first mineable block type it finds
        // This shoudn't be a problem when farming for example different kinds of woods, but it cannot be used for farming different blocks

        //TODO: Change block.drops to mcData.blockLoot['blockname'], since drops are not set in mc-data 1.18
        let inv = Object.fromEntries(mineableBlockTypes[0].drops.map(x => [x, this.options.amountToCollect]))
        return {
            success: true,
            inventory: inv,
            world: Object.fromEntries(blocks.map(x => [vec2key(x), this.mcData.blocksByName.air.id]))
        }
    }
}