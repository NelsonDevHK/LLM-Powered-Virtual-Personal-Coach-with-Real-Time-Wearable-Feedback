import { summarizeWearableData } from "../../utils/wearableSummary.js";
import { RAG_TEMPLATE, COACH_TEMPLATE } from "./templates.js";
import logger from "../../utils/logger.js";


// Base prompt builder - concrete builders should implement `builder(userId)`
export class PromptBuilder {
    async builder(userId) {
        throw new Error("builder(userId) not implemented");
    }
}

/**
 * RagPromptBuilder - Retrieves fitness knowledge relevant to user profile and context.
 * Builds RAG retrieval query using RAG_TEMPLATE for Chroma semantic search.
 */
export class RagPromptBuilder extends PromptBuilder {
    async builder(userDict) {
        // logger.info(`RagPromptBuilder.builder: Building RAG query for user data: ${JSON.stringify(userDict, null, 2)}`);
        logger.info(`RagPromptBuilder.builder: Building RAG query for user_id=${userDict.user_id}`);
        // Summarize wearable data
        let wearableSummary = '';
        if (Array.isArray(userDict.wearable_data)) {
            wearableSummary = summarizeWearableData(userDict.wearable_data);
        } else if (userDict.wearable_data && typeof userDict.wearable_data === 'object') {
            wearableSummary = summarizeWearableData([userDict.wearable_data]);
        }

        // Fill RAG_TEMPLATE with user profile and wearable context
        const prompt = RAG_TEMPLATE
            .replace(/\{gender\}/g, userDict.gender ?? 'unknown')
            .replace(/\{age_group\}/g, userDict.age_group ?? 'unknown')
            .replace(/\{exercise_level\}/g, userDict.exercise_level ?? userDict.excercise_level ?? 'unknown')
            .replace(/\{wearable_summary\}/g, wearableSummary || 'General fitness inquiry');


        // logger.info(`RagPromptBuilder.builder: Built RAG prompt for user_id=${userDict.user_id} with wearable summary: ${wearableSummary}. Full prompt: ${prompt}`);
        return prompt;
    }
}

/**
 * AskPromptBuilder - Builds comprehensive fitness coaching prompts for the /api/ask endpoint.
 * Focuses on holistic fitness guidance (cardio, strength, recovery, nutrition, sleep).
 * Incorporates user profile, wearable data, and RAG advice.
 */
export class AskPromptBuilder extends PromptBuilder {
    async builder(userDict, ragAdvice, userQuery = "") {
        // Safely extract user profile fields
        const age = userDict.age ?? userDict.age_group ?? "unknown";
        const fitnessLevel = userDict.exercise_level ?? userDict.excercise_level ?? "unknown";
        const latest = Array.isArray(userDict.wearable_data) && userDict.wearable_data.length > 0
            ? userDict.wearable_data[0]
            : null;
        const heartRate = userDict.heart_rate ?? latest?.heart_rate ?? latest?.average_heart_rate ?? "unknown";
        
        // Build wearable context summary from recent data
        let wearableContext = '';
        if (Array.isArray(userDict.wearable_data) && userDict.wearable_data.length > 0) {
            wearableContext = `Recent Workout Summary:\n- Activity: ${latest.exercise_type ?? 'unknown'}\n- Duration: ${latest.duration ?? 'unknown'} min\n- Avg Heart Rate: ${latest.average_heart_rate ?? 'unknown'} bpm\n- Calories: ${latest.calories ?? 'unknown'}\n- Sleep: ${latest.sleep_duration ?? 'unknown'} hrs (quality: ${latest.sleep_quality ?? 'unknown'}/5)`;
        } else {
            wearableContext = 'No recent workout data available.';
        }

        const metricSnapshot = [
            `Heart Rate: ${heartRate} bpm`,
            `Exercise Type: ${latest?.exercise_type ?? 'unknown'}`,
            `Duration: ${latest?.duration ?? 'unknown'} min`,
            `Calories: ${latest?.calories ?? 'unknown'}`,
            `Sleep: ${latest?.sleep_duration ?? 'unknown'} min`,
            `Sleep Quality: ${latest?.sleep_quality ?? 'unknown'}/5`,
            `Set Count: ${latest?.set_count ?? 'unknown'}`,
            `Rest Duration: ${latest?.rest_duration ?? 'unknown'} min`
        ].join('\n- ');

        // Format RAG advice context
        const ragContext = (ragAdvice && ragAdvice.length > 0) 
            ? ragAdvice.join('\n\n') 
            : 'No fitness knowledge base matches found.';

        // Fill COACH_TEMPLATE with user and context data
        const prompt = COACH_TEMPLATE
            .replace(/\{age\}/g, String(age))
            .replace(/\{fitness_level\}/g, String(fitnessLevel))
            .replace(/\{heart_rate\}/g, String(heartRate))
            .replace(/\{context\}/g, ragContext)
            .replace(/\{user_question\}/g, String(userQuery || 'No explicit question provided'))
            .replace(/\{metric_snapshot\}/g, `- ${metricSnapshot}`);

        // Prepend wearable context for comprehensive coaching context
        return `${wearableContext}\n\n${prompt}`;
    }
}

export class LlmPromptBuilder extends PromptBuilder {
    async builder(userDict, ragAdvice) {
        // For simplicity, we just concatenate all the info into a single prompt string.
        // In a real implementation, you would likely want to use a more sophisticated template.
        const prompt =  COACH_TEMPLATE
            .replace(/\{age\}/g, String(userDict.age ?? "unknown"))
            .replace(/\{fitness_level\}/g, userDict.excercise_level ?? userDict.exercise_level ?? "unknown")
            .replace(/\{heart_rate\}/g, String(userDict.heart_rate ?? "unknown"))
            .replace(/\{context\}/g, (ragAdvice ?? []).join("\n") || "No advice available");

        const extraContext = `\n\nADDITIONAL WEARABLE CONTEXT:\n- Exercise type: ${userDict.exercise_type ?? "unknown"}\n- Set count: ${userDict.set_count ?? "unknown"}\n- Rest duration: ${userDict.rest_duration ?? "unknown"} min\n- Sleep duration: ${userDict.sleep_duration ?? "unknown"} min\n- Sleep quality: ${userDict.sleep_quality ?? "unknown"}/5`;

        //logger.info(`Built LLM prompt for user data: ${JSON.stringify(userDict, null, 2)}, RAG advice: ${JSON.stringify(ragAdvice, null, 2)}. Resulting prompt: ${prompt}`);

        return `${prompt}${extraContext}`;
    }

    async buildSessionSummaryPrompt(userDict) {
        return `You are a fitness coach. Summarize this workout session briefly and practically in 4-6 sentences.

User profile:
- Age: ${userDict.age ?? 'unknown'}
- Fitness level: ${userDict.excercise_level ?? userDict.exercise_level ?? 'unknown'}

Latest wearable metrics:
- Heart rate: ${userDict.heart_rate ?? 'unknown'} bpm
- Exercise type: ${userDict.exercise_type ?? 'unknown'}
- Duration: ${userDict.duration ?? 'unknown'} min
- Rest duration: ${userDict.rest_duration ?? 'unknown'} min
- Sleep duration: ${userDict.sleep_duration ?? 'unknown'} min
- Sleep quality: ${userDict.sleep_quality ?? 'unknown'}/5

Include:
1) overall effort,
2) one strength,
3) one area to improve,
4) one next-session action.`;
    }
}
    