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
        
        // Extract relevant data for RAG prompt from userDict
        const ragData = {
            excercise_level: userDict.excercise_level,
            fitness_goal: userDict.fitness_goal,
            heart_rate: userDict.heart_rate,
            current_speed: userDict.current_speed
        };

        // Build prompt using template and user data
        const prompt = RAG_TEMPLATE
            .replace(/\{excercise_level\}/g, ragData.excercise_level ?? "unknown")
            .replace(/\{fitness_goal\}/g, ragData.fitness_goal ?? "unknown")
            .replace(/\{heart_rate\}/g, String(ragData.heart_rate ?? "unknown"))
            .replace(/\{current_speed\}/g, ragData.current_speed ?? "unknown");
        //logger.info(`Built RAG prompt for user_id=${userId}: ${prompt}`);

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
    