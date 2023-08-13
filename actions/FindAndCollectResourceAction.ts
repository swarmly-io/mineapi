import { Block } from 'prismarine-block'
import { NotEnoughItemsError } from "../errors/NotEnoughItemsError"
import { findBlocks } from "../helpers/EnvironmentHelper"
import { assertHas } from "../helpers/InventoryHelper"
import { Action, ActionAnalysisPredicate, ActionParams } from "./Action"
import { ActionDoResult } from './types'
import { ActionState } from './BotActionState'
import { sleep } from '../Attributes'
import { Observation } from '../types'
import { moveToPositionWithRetry } from '../helpers/TravelHelper'
import { Vec3 } from 'vec3'

export type FindAndCollectParams = {
    blockIds: number | number[],
    amountToCollect: number,
    allowedMaxDistance: number
}

export class FindAndCollectAction extends Action<FindAndCollectParams> {

    constructor(params: ActionParams<FindAndCollectParams>) {
        super(params)
    }

    private async nudge() {
        const toVec = (x) => new Vec3(x.x, x.y, x.z)
        const getRandomSurroundingCoord = () => (toVec({
            x: Math.floor(Math.random() * 3) - 4 + this.bot.entity.position.x,
            y: this.bot.entity.position.y,
            z: Math.floor(Math.random() * 3) - 4 + this.bot.entity.position.z
        }));
        const coord = getRandomSurroundingCoord();
        await moveToPositionWithRetry(this.bot, coord)
    }

    async do(possibleCheck: boolean = false, observation: Observation | undefined): Promise<ActionDoResult> { // TODO: Do we need metadata? 
        let blockTypes = typeof this.options.blockIds === 'number' ? [this.mcData.blocks[this.options.blockIds]] : this.options.blockIds.map(x => this.mcData.blocks[x])
        if (possibleCheck) {
            // Now checking for harvest tools
            let mineableBlockTypes = blockTypes.filter(blockType => {
                if (blockType.harvestTools !== undefined) {
                    try {
                        assertHas(observation!, 1, (i => !blockType.harvestTools || Object.keys(blockType.harvestTools!).includes(i as string)))
                    } catch (e) {
                        if (e instanceof NotEnoughItemsError) {
                            return false
                        } else throw e
                    }
                }
                return true
            })
            if (mineableBlockTypes.length === 0) {
                return { reason: "FindAndCollectResource: No tools available to mine that block" }
            }
            const blocks = findBlocks(this.bot, this.options.blockIds, this.options.allowedMaxDistance, this.options.amountToCollect, observation)
            if (!blocks) {
                return { reason: "FindAndCollectResource: No blocks found" }
            }

            if (blocks.length < this.options.amountToCollect) {
                return { reason: "FindAndCollectResource: Not enough blocks found" }
            }

            return true;
        }
        const blocks = findBlocks(this.bot, this.options.blockIds, this.options.allowedMaxDistance, this.options.amountToCollect)
        this.bot.chat("Going to get some blocks: " + blocks.length)

        await this.nudge()
        let targetCount = this.options.amountToCollect;

        const getTargets = async () => {
            const targets: Block[] = []
            let equiped = false
            for (let i = 0; i < Math.min(blocks.length, targetCount); i++) {
                let block = this.bot.blockAt(blocks[i])
                if (block) {
                    targets.push(block!)
                    if (!equiped) {
                        await this.bot.tool.equipForBlock(block!, { getFromChest: true })
                        await sleep(100)
                        console.log(`Equiped tool for ${block}`)
                        equiped = true
                    }
                }
            }
            return targets
        }

        let targets: Block[] = await getTargets()

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
                        await this.bot.tool.equipForBlock(targetBlock!, { getFromChest: true })
                        await sleep(50)
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

        try {
            let failCount = 0;
            while (targets.length > 0) {
                const target = targets.pop();
                if (!target) break;

                console.log("Target", target)
                //@ts-ignore  ts doesnt know about mineflayer plugins
                await moveToPositionWithRetry(this.bot, target.position)
                    .then(() => {
                        if (this.bot.canDigBlock(target)) {
                            this.bot.chat(`starting to dig ${target.name}`);
                            return dig(target);
                        } else {
                            throw new Error('Cannot dig target block');
                        }
                    })
                    .then(async () => {
                        this.bot.chat(`finished digging ${target.name}`);
                        const droppedItems = Object.values(this.bot.entities).filter(entity => entity.type === 'object' && entity.objectType === 'Item');
                        for (let item of droppedItems) {
                            if (item.position.distanceTo(this.bot.entity.position) < 2) {
                                console.log(item)
                                await moveToPositionWithRetry(this.bot, item.position)
                            }
                        }
                        targetCount -= 1;
                    })
                    .catch(async (err) => {
                        if (err.message === 'Navigation timed out!') {
                            this.bot.chat('I had trouble navigating. Please check my path.');
                        } else {
                            this.bot.chat(err.message);
                        }
                        await this.nudge()
                        if (failCount > 2) {
                            throw new Error("Failed to collect")
                        }
                        failCount += 1;
                        // re target
                        targets = await getTargets()
                    });
            }
        } catch (e) {
            console.log("Error in collect", e)
            this.bot.chat("Darn!");

            return { reason: e } as ActionDoResult
        }
        return true
    }

    analyseFn(): ActionAnalysisPredicate {
        return (state: ActionState) => ({
            is_progressing: state.isDigging || state.isMoving,
            is_stuck: !state.isDigging && !state.isMoving
        });
    }
}