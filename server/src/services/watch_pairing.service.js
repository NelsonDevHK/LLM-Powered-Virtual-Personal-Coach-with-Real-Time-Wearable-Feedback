import jwt from 'jsonwebtoken';

const CODE_TTL_MS = Number(process.env.WATCH_PAIR_CODE_TTL_MS || 10 * 60 * 1000);
const WATCH_TOKEN_EXPIRES_IN = process.env.WATCH_TOKEN_EXPIRES_IN || '30d';

class WatchPairingService {
    constructor() {
        this.pairingCodes = new Map();
        this.userPairings = new Map();
        this.devicePairings = new Map();
    }

    createPairCode(userId, userName) {
        this._cleanupExpiredCodes();

        const pairingCode = this._generateCode();
        const expiresAt = Date.now() + CODE_TTL_MS;

        this.pairingCodes.set(pairingCode, {
            userId,
            userName: userName || 'unknown',
            expiresAt
        });

        return {
            pairingCode,
            expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
            expiresAt: new Date(expiresAt).toISOString()
        };
    }

    confirmPairing({ pairingCode, deviceUuid, deviceModel, osVersion, appVersion }) {
        this._cleanupExpiredCodes();

        const pending = this.pairingCodes.get(pairingCode);
        if (!pending) {
            return {
                success: false,
                statusCode: 400,
                error: 'Invalid or expired pairing code'
            };
        }

        const existingUserPair = this.userPairings.get(pending.userId);
        if (existingUserPair && existingUserPair.deviceUuid !== deviceUuid) {
            return {
                success: false,
                statusCode: 409,
                error: 'User is already paired with another watch device'
            };
        }

        const existingDevicePair = this.devicePairings.get(deviceUuid);
        if (existingDevicePair && existingDevicePair.userId !== pending.userId) {
            return {
                success: false,
                statusCode: 409,
                error: 'This watch device is already paired with another user'
            };
        }

        const token = jwt.sign(
            {
                user_id: pending.userId,
                user_name: pending.userName,
                device_uuid: deviceUuid,
                token_type: 'watch'
            },
            process.env.JWT_SECRET || 'dev-secret',
            { expiresIn: WATCH_TOKEN_EXPIRES_IN }
        );

        const pairing = {
            userId: pending.userId,
            userName: pending.userName,
            deviceUuid,
            deviceModel: deviceModel || 'Apple Watch',
            osVersion: osVersion || 'unknown',
            appVersion: appVersion || 'unknown',
            pairedAt: new Date().toISOString(),
            tokenIssuedAt: new Date().toISOString()
        };

        this.userPairings.set(pending.userId, pairing);
        this.devicePairings.set(deviceUuid, {
            userId: pending.userId,
            pairedAt: pairing.pairedAt
        });
        this.pairingCodes.delete(pairingCode);

        return {
            success: true,
            token,
            userId: pending.userId,
            pairing
        };
    }

    getPairStatus(userId) {
        const pairing = this.userPairings.get(userId);
        if (!pairing) {
            return {
                paired: false,
                message: 'No watch paired yet'
            };
        }

        return {
            paired: true,
            deviceUuid: pairing.deviceUuid,
            deviceModel: pairing.deviceModel,
            osVersion: pairing.osVersion,
            appVersion: pairing.appVersion,
            pairedAt: pairing.pairedAt
        };
    }

    _generateCode() {
        for (let i = 0; i < 10; i += 1) {
            const code = String(Math.floor(100000 + Math.random() * 900000));
            if (!this.pairingCodes.has(code)) {
                return code;
            }
        }
        return String(Date.now()).slice(-6);
    }

    _cleanupExpiredCodes() {
        const now = Date.now();
        for (const [code, value] of this.pairingCodes.entries()) {
            if (value.expiresAt <= now) {
                this.pairingCodes.delete(code);
            }
        }
    }
}

export default new WatchPairingService();
