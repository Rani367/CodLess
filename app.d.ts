interface PositionUpdateData {
    x: number;
    y: number;
    angle: number;
    arm1Angle?: number;
    arm2Angle?: number;
    velocity?: { x: number; y: number; angular: number };
    command?: any;
}

interface EventMap {
    [key: string]: (...args: any[]) => void;
}

interface RobotSimulatorEvents extends EventMap {
    'positionUpdate': (data: PositionUpdateData) => void;
}

interface BLEControllerEvents extends EventMap {
    'connect': () => void;
    'disconnect': () => void;
    'data': (data: any) => void;
    [key: string]: (...args: any[]) => void;
}

interface FLLRoboticsAppEvents extends EventMap {
    'robotPositionUpdate': (data: PositionUpdateData) => void;
    [key: string]: (...args: any[]) => void;
}

declare class EventEmitter<T extends EventMap = EventMap> {
    constructor();
    on<K extends keyof T>(event: K, callback: T[K]): () => void;
    off<K extends keyof T>(event: K, callback: T[K]): void;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void;
}

declare class RobotSimulator extends EventEmitter<RobotSimulatorEvents> {
    constructor(canvas: HTMLCanvasElement);
    updateConfig(config: any): void;
    updatePhysics(config: any): void;
    animate(): void;
    sendCommand(command: any): void;
    // Add other methods as needed
}

declare class BLEController extends EventEmitter<BLEControllerEvents> {
    constructor();
    // Add other methods as needed
}

declare class FLLRoboticsApp extends EventEmitter<FLLRoboticsAppEvents> {
    constructor();
    robotSimulator: RobotSimulator;
    onSimulatorUpdate(data: PositionUpdateData): void;
    // Add other methods as needed
}