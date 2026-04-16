import { userRepository, wearableRepository } from "../database/index.js";
import logger from '../utils/logger.js';

export class dbService {

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
                sleep_duration: wearableRecord?.sleep_duration ?? null,
                sleep_quality: wearableRecord?.sleep_quality ?? null,
                rest_duration: wearableRecord?.rest_duration ?? null,
                exercise_type: wearableRecord?.exercise_type ?? null,
                set_count: wearableRecord?.set_count ?? null,
            };

            //logger.info(`Fetched RAG data for user_id=${userId}: ${JSON.stringify(ragDict, null, 2)}`);

            return ragDict;
        } catch (error) {
            logger.error("Error fetching user data:", error);
            throw error;
        }
    }

// this is a function that fetches all data needed for the full LLM prompt (profile + wearable + RAG advice) --- IGNORE ---
// Which is covered in getResponse already helper function wrapped in llm.service.js
    async getLlmData(userId) { 
        try {
            const userInfo = await userRepository.findById(userId);
            const wearableData = await wearableRepository.findById(userId);
            
            // wearableData may be a single record or an array of records — pick the last record if it's an array
            const wearableRecord = Array.isArray(wearableData)
                ? wearableData[wearableData.length - 1]
                : wearableData;

            const llmDict = {
                // keep the exact property name requested by the user
                excercise_level: userInfo?.excercise_level ?? userInfo?.exercise_level ?? null,
                age: userInfo?.age ?? null,
                heart_rate: wearableRecord?.heart_rate ?? null,
                sleep_duration: wearableRecord?.sleep_duration ?? null,
                sleep_quality: wearableRecord?.sleep_quality ?? null,
                rest_duration: wearableRecord?.rest_duration ?? null,
                exercise_type: wearableRecord?.exercise_type ?? null,
                set_count: wearableRecord?.set_count ?? null,
            };

            //logger.info(`Fetched LLM data for user_id=${userId}: ${JSON.stringify(llmDict, null, 2)}`);
            
            return llmDict;
        } catch (error) {
            logger.error("Error fetching user data:", error);
            throw error;
        }
    }

    async findUserByUsername(user_name) { // For register Helper function
        try {
            return await userRepository.findByUsername(user_name);
        } catch (error) {
            logger.error("Error finding user by username:", error);
            throw error;
        }
    }

    async findWearableByUserId(userId) { // For fetching data endpoint
        try {
            return await wearableRepository.findById(userId);
        } catch (error) {
            logger.error("Error finding wearable by userId:", error);
            throw error;
        }
    }
}

export default new dbService();
