
export type ActionDoResult = true | {
    reason: string,
    details?: Record<string, unknown>
}