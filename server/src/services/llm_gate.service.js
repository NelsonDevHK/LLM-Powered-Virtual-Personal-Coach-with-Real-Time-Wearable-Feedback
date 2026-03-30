import logger from '../utils/logger.js';

class GateError extends Error {
    constructor(message, statusCode = 429) {
        super(message);
        this.name = 'GateError';
        this.status = statusCode;
        this.statusCode = statusCode;
    }
}

class LlmGateService {
    constructor() {
        this.userQueues = new Map();
        this.userBusyCount = new Map();
        this.lastAttemptByOp = new Map();
    }

    _userKey(userId) {
        return String(userId || 'anonymous');
    }

    _opKey(userId, operation) {
        return `${this._userKey(userId)}:${operation}`;
    }

    _touchAttempt(userId, operation, minIntervalMs = 0) {
        const opKey = this._opKey(userId, operation);
        const now = Date.now();
        const last = this.lastAttemptByOp.get(opKey);

        if (minIntervalMs > 0 && last && now - last < minIntervalMs) {
            const waitMs = minIntervalMs - (now - last);
            throw new GateError(
                `Too many ${operation} requests. Retry in ${waitMs}ms.`,
                429
            );
        }

        this.lastAttemptByOp.set(opKey, now);
    }

    _incBusy(userKey) {
        this.userBusyCount.set(userKey, (this.userBusyCount.get(userKey) || 0) + 1);
    }

    _decBusy(userKey) {
        const current = this.userBusyCount.get(userKey) || 0;
        if (current <= 1) {
            this.userBusyCount.delete(userKey);
            return;
        }
        this.userBusyCount.set(userKey, current - 1);
    }

    isUserBusy(userId) {
        return (this.userBusyCount.get(this._userKey(userId)) || 0) > 0;
    }

    async runExclusive(userId, operation, task, options = {}) {
        const {
            minIntervalMs = 0,
            rejectIfBusy = false
        } = options;

        const userKey = this._userKey(userId);
        this._touchAttempt(userId, operation, minIntervalMs);

        if (rejectIfBusy && this.isUserBusy(userId)) {
            throw new GateError(`Another request is in progress for user ${userId}.`);
        }

        const previous = this.userQueues.get(userKey) || Promise.resolve();

        const chained = previous
            .catch(() => {})
            .then(async () => {
                this._incBusy(userKey);
                try {
                    return await task();
                } finally {
                    this._decBusy(userKey);
                }
            });

        this.userQueues.set(
            userKey,
            chained.finally(() => {
                if (this.userQueues.get(userKey) === chained) {
                    this.userQueues.delete(userKey);
                }
            })
        );

        try {
            return await chained;
        } catch (error) {
            if (error instanceof GateError) throw error;
            logger.warn(`Gate task '${operation}' failed for user ${userId}: ${error?.message || error}`);
            throw error;
        }
    }
}

export { GateError };
export default new LlmGateService();
