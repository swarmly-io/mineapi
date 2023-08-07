import mineflayer, { Bot } from 'mineflayer';
import { EventEmitter } from 'events';
import { Action, ActionAnalysis, ActionAnalysisPredicate } from './Action';

export interface ActionState {
  timestamp: number
  isMoving: boolean;
  isMining: boolean;
  isBuilding: boolean;
  isDigging: boolean;
  isCrafting: boolean;
  equipped: number | undefined;
  isTakingDamage: boolean;
  isFighting: boolean;
  isEating: boolean;
  isSleeping: boolean;
}

export class BotActionState extends EventEmitter {
  private bot: Bot;
  private moving: boolean = false;
  private mining: boolean = false;
  private building: boolean = false;
  private digging: boolean = false;
  private fighting: boolean = false;
  private crafting: boolean = false;
  private eating: boolean = false;
  private sleeping: boolean = false;
  private equippedItem: number | undefined;
  private isTakingDamage: boolean = false;
  private prevHealth: number = 20; // Maximum health value
  private prevFood: number = 20; // Maximum food value
  private currentTask: Action<any> | undefined;
  stateRecordHistory: ActionState[] = [];
  stateRecordingInterval: NodeJS.Timer | undefined;

  constructor(bot: Bot) {
    super();
    this.bot = bot;
    this.initListeners();
  }

  private initListeners() {
    this.bot.on('physicTick', () => {
      this.moving = this.bot.pathfinder.isMoving();
      this.mining = this.bot.pathfinder.isMining();
      this.building = this.bot.pathfinder.isBuilding();
    });

    this.bot.on('blockBreakProgressObserved', () => {
      this.digging = true;
    });

    this.bot.on('diggingAborted', () => {
      this.digging = false;
    });

    this.bot.on('entityHurt', (entity) => {
      if (entity === this.bot.entity) {
        this.isTakingDamage = true;
      }
      if (entity !== this.bot.entity) {
        this.fighting = true;
      }
    });

    this.bot.on('entitySwingArm', (entity) => {
      if (entity === this.bot.entity) {
        this.isTakingDamage = false;
      }
    });

    this.bot.on('spawn', () => {
      this.updateEquippedItem();
    });

    // this.bot.on('setSlot', () => {
    //   this.updateEquippedItem();
    // });

    this.bot.on('health', () => {
      // Check if the health has increased
      const currentHealth = this.bot.health || 0;
      if (currentHealth > this.prevHealth || currentHealth >= 20) {
        this.emit('healthIncreased');
      }
      this.prevHealth = currentHealth;
    });

    this.on('healthIncreased', () => {
      this.isTakingDamage = false;
      console.log('Bot health has increased, reset isTakingDamage to false.');
    });

    this.bot.on('entityGone', (entity) => {
      if (entity !== this.bot.entity) {
        this.fighting = false;
      }
    });

    this.bot.on('entityEat', (entity) => {
      if (entity === this.bot.entity) {
        this.eating = true;
        setTimeout(() => {
          this.eating = false;
        }, 2000); // Wait for 2 seconds to simulate the eating duration
      }
    });

    this.bot.on('entitySleep', (entity) => {
      if (entity === this.bot.entity) {
        this.sleeping = true;
      }
    });

    this.bot.on('entityWake', (entity) => {
      if (entity === this.bot.entity) {
        this.sleeping = false;
      }
    });

    this.bot.on('windowOpen', () => {
      console.log('Bot started crafting.', this.bot.currentWindow?.title);
      this.crafting = true;
      // You can update the state or perform actions when the bot starts crafting.
    });
  
    this.bot.on('windowClose', () => {
      console.log('Bot stopped crafting.', this.bot.currentWindow?.title);
      this.crafting = false;
      // You can update the state or perform actions when the bot stops crafting.
    });
  }

  private updateEquippedItem() {
    this.equippedItem = this.bot.inventory.slots[36]?.type;
  }

  public get isMoving(): boolean {
    return this.moving;
  }

  public get isDigging(): boolean {
    return this.digging;
  }

  public isEquipped(itemType: number): boolean {
    return this.equippedItem === itemType;
  }

  private async getState() {
    return {
      timestamp: Date.now(),
      isMoving: this.moving,
      isMining: this.mining,
      isBuilding: this.building,
      isDigging: this.digging,
      isCrafting: this.crafting,
      equipped: this.equippedItem,
      isTakingDamage: this.isTakingDamage,
      isFighting: false,
      isEating: this.eating,
      isSleeping: this.sleeping,
    } as ActionState
  }

  private async recordBotState() {
    this.stateRecordHistory.push(await this.getState());
  }

  public startTask(action: Action<any>) {
    this.stopTask(); // Stop any existing recording task to avoid duplicates
    this.currentTask = action;
    this.stateRecordingInterval = setInterval(() => {
      this.recordBotState();
    }, 50);
  }

  public stopTask() {
    if (this.stateRecordingInterval) {
      clearInterval(this.stateRecordingInterval);
      this.stateRecordingInterval = undefined;
    }
  }

  private analyzeOverTime(
    timePeriod: number,
    analyzeFn: ActionAnalysisPredicate
  ): ActionAnalysis {
    const stateHistory = this.stateRecordHistory;
    if (stateHistory.length === 0) {
      return { is_progressing: false, is_stuck: false };
    }

    const currentTime = Date.now();
    const startTime = Math.max(0, currentTime - timePeriod);

    // Filter state records within the specified time period
    const statesWithinPeriod = stateHistory.filter((state) => state.timestamp >= startTime);

    if (statesWithinPeriod.length === 0) {
      return { is_progressing: false, is_stuck: false };
    }

    // Analyze each state within the time period using the provided analyzeFn
    const analysisResults = statesWithinPeriod.map(analyzeFn);

    // Determine overall progress and stuck states based on the analysis results
    const isProgressing = analysisResults.some((result) => result.is_progressing);
    const isStuck = analysisResults.every((result) => result.is_stuck);

    return { is_progressing: isProgressing, is_stuck: isStuck };
  }

  private analyse() {
    // todo getting timing from action
    return this.analyzeOverTime(200, this.currentTask!.analyseFn())
  }

  public async get_action_state() {
    if (!this.currentTask) {
      return null
    }

    return this.analyse();
  }
}


