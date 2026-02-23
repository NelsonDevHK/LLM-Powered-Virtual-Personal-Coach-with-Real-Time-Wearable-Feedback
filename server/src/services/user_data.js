import { userRepository, wearableRepository, conversationRepository } from "../database/index.js";
import logger from '../utils/logger.js';

export class UserDataService {

    async getRagData(userId) {
        try {
            const userInfo = await userRepository.findById(userId);
            const wearableData = await wearableRepository.findById(userId);

            // wearableData may be a single record or an array of records — pick the last record if it's an array
            const wearableRecord = Array.isArray(wearableData)
                ? wearableData[wearableData.length - 1]
                : wearableData;

            const ragDict = {
                // keep the exact property name requested by the user
                excercise_level: userInfo?.excercise_level ?? userInfo?.exercise_level ?? null,
                fitness_goal: userInfo?.fitness_goal ?? null,
                heart_rate: wearableRecord?.heart_rate ?? null,
                current_speed: wearableRecord?.current_speed ?? wearableRecord?.speed ?? null,
            };

            //logger.info(`Fetched RAG data for user_id=${userId}: ${JSON.stringify(ragDict, null, 2)}`);

            return ragDict;
        } catch (error) {
            logger.error("Error fetching user data:", error);
            throw error;
        }
    }

    async getLlmData(userId) {
        try {
            const userInfo = await userRepository.findById(userId);
            const wearableData = await wearableRepository.findById(userId);
            //logger.info(`Fetched wearable data for user_id=${userId}: ${JSON.stringify(wearableData, null, 2)}`);
            const conversationHistory = await conversationRepository.findById(userId);
            
            // wearableData may be a single record or an array of records — pick the last record if it's an array
            const wearableRecord = Array.isArray(wearableData)
                ? wearableData[wearableData.length - 1]
                : wearableData;

            const llmDict = {
                // keep the exact property name requested by the user
                excercise_level: userInfo?.excercise_level ?? userInfo?.exercise_level ?? null,
                age: userInfo?.age ?? null,
                heart_rate: wearableRecord?.heart_rate ?? null,
                current_speed: wearableRecord?.current_speed ?? wearableRecord?.speed ?? null,
                conversation_history: conversationHistory?.session_summary ?? [],
            };

            //logger.info(`Fetched LLM data for user_id=${userId}: ${JSON.stringify(llmDict, null, 2)}`);
            
            return llmDict;
        } catch (error) {
            logger.error("Error fetching user data:", error);
            throw error;
        }
    }
}

export default new UserDataService();
