import { summarizeWearableData } from "../../utils/wearableSummary.js";
import { RAG_TEMPLATE } from "./templates.js";
import { COACH_TEMPLATE } from "./templates.js";
import logger from "../../utils/logger.js";


// Base prompt builder - concrete builders should implement `builder(userId)`
export class PromptBuilder {
    async builder(userId) {
        throw new Error("builder(userId) not implemented");
    }
}

// RAG prompt builder - returns a filled prompt string using RAG_TEMPLATE
/**
 * {param {Dictionary} userDict  - data of the user for whom to build the prompt}
 */
export class RagPromptBuilder extends PromptBuilder {
    async builder(userDict) {
        logger.info(`RagPromptBuilder.builder: Building prompt for user data: ${JSON.stringify(userDict, null, 2)}`);
        // Use summarizeWearableData utility for wearable summary
        let wearableSummary = '';
        if (Array.isArray(userDict.wearable_data)) {
            wearableSummary = summarizeWearableData(userDict.wearable_data);
        } else if (userDict.wearable_data && typeof userDict.wearable_data === 'object') {
            wearableSummary = summarizeWearableData([userDict.wearable_data]);
        }

        let prompt = RAG_TEMPLATE
            .replace(/\{excercise_level\}/g, userDict.excercise_level ?? userDict.exercise_level ?? "unknown")
            .replace(/\{fitness_goal\}/g, userDict.fitness_goal ?? "unknown")
            .replace(/\{heart_rate\}/g, String(userDict.heart_rate ?? (userDict.wearable_data?.heart_rate ?? "unknown")))
            .replace(/\{current_speed\}/g, String(userDict.current_speed ?? userDict.wearable_data?.current_speed ?? userDict.wearable_data?.speed ?? "unknown"));
        if (userDict.gender) prompt += `\nGender: ${userDict.gender}`;
        if (userDict.age_group) prompt += `\nAge group: ${userDict.age_group}`;
        if (wearableSummary) prompt += `\nWearable summary: ${wearableSummary}`;
        return prompt;
    }
}

export class LlmPromptBuilder extends PromptBuilder {
    async builder(userDict, ragAdvice) {
        // For simplicity, we just concatenate all the info into a single prompt string.
        // In a real implementation, you would likely want to use a more sophisticated template.
        const prompt =  COACH_TEMPLATE
            .replace(/\{age\}/g, String(userDict.age ?? "unknown"))
            .replace(/\{excercise_level\}/g, userDict.excercise_level ?? "unknown")
            .replace(/\{heart_rate\}/g, String(userDict.heart_rate ?? "unknown"))
            .replace(/\{speed\}/g, String(userDict.current_speed ?? "unknown"))
            .replace(/\{context\}/g, (ragAdvice ?? []).join("\n") || "No advice available")
            .replace(/\{history\}/g, userDict.conversation_history ?? "No conversation history");

        //logger.info(`Built LLM prompt for user data: ${JSON.stringify(userDict, null, 2)}, RAG advice: ${JSON.stringify(ragAdvice, null, 2)}. Resulting prompt: ${prompt}`);

        return prompt;
    }
}
    