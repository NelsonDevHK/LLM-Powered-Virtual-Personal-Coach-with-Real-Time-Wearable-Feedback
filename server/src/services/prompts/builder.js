import { RAG_TEMPLATE } from "./templates.js";
import user_data from "../user_data.js";
import logger from "../../utils/logger.js";


// Base prompt builder - concrete builders should implement `builder(userId)`
export class PromptBuilder {
    async builder(userId) {
        throw new Error("builder(userId) not implemented");
    }
}

// RAG prompt builder - returns a filled prompt string using RAG_TEMPLATE
export class RagPromptBuilder extends PromptBuilder {
    async builder(userId) {
        // Fetch user data for RAG prompt
        const ragData = await user_data.getRagData(userId);

        // Build prompt using template and user data
        const prompt = RAG_TEMPLATE
            .replace("{excercise_level}", ragData.excercise_level ?? "unknown")
            .replace("{fitness_goal}", ragData.fitness_goal ?? "unknown")
            .replace("{heart_rate}", String(ragData.heart_rate ?? "unknown"))
            .replace("{current_speed}", ragData.current_speed ?? "unknown");

        logger.info(`Built RAG prompt for user_id=${userId}: ${prompt}`);

        return prompt;
    }
}

export default RagPromptBuilder;
    