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
        // Summarize wearable data
        let wearableSummary = '';
        if (Array.isArray(userDict.wearable_data)) {
            wearableSummary = summarizeWearableData(userDict.wearable_data);
        } else if (userDict.wearable_data && typeof userDict.wearable_data === 'object') {
            wearableSummary = summarizeWearableData([userDict.wearable_data]);
        }

        // Format conversation history (last 5 messages)
        let history = '';
        if (Array.isArray(userDict.conversation_history) && userDict.conversation_history.length > 0) {
            const lastMsgs = userDict.conversation_history.slice(-5);
            history = lastMsgs.map((msg, i) => `#${i+1}: Q: ${msg.question}\nA: ${msg.answer}`).join('\n');
        } else {
            history = 'No conversation history.';
        }

        // Explicit, instructional prompt
        let prompt = `User Profile:\n- Gender: ${userDict.gender 
            ?? 'unknown'}\n- Age group: ${userDict.age_group ?? 'unknown'}\n- Exercise level: ${userDict.excercise_level ?? userDict.exercise_level ?? 'unknown'}\n\nWorkout Summary:\n- ${wearableSummary || 'No recent workout data.'}\n\nConversation History:\n${history}\n\nInstructions:\nProvide running advice that is specific to this user’s profile and workout data. Reference the user’s age group, gender, and exercise level. Do not give generic advice—make your answer actionable and personalized.`;
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
    