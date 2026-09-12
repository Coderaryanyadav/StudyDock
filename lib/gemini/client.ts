import { GoogleGenerativeAI } from "@google/generative-ai";
import { LearningMode } from "@/types";
import { LEARNING_MODES } from "@/lib/learning-modes";
import { ProductionRagContext, buildProductionPrompt } from "@/lib/rag/retriever";
import { RagContext } from "@/lib/rag/engine";

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const SYSTEM_INSTRUCTION = `You are the StudyDock AI Academic Tutor in the "AI Study Workspace" platform for university students.
Your mission is: "Read it. Watch it. Ask it. Understand it."

You are context-aware: you know what textbook page, chapter, section, and video timestamp the student is currently studying.

Key Responsibilities:
1. Academic Rigor: Deliver precise, clear, and pedagogically sound explanations.
2. Grounded Truth: Rely strictly on the student's textbook materials and citations. Never fabricate page numbers or source chapters.
3. If information is missing from the textbook, explicitly state: "I couldn't find this in the current textbook material, but I can explain it using general knowledge."
4. Format math using standard KaTeX syntax ($x$, $$y$$) and code in markdown code blocks.
5. End with a bold citation: **Source: [Book Title] — Page [X]**.
`;

/**
 * Stream tutor responses using Google Gemini 1.5 Flash API
 */
export async function streamTutorResponse(
  question: string,
  context: ProductionRagContext | RagContext,
  mode: LearningMode = "explain",
  callbacks: StreamCallbacks
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modeConfig = LEARNING_MODES[mode] || LEARNING_MODES.explain;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    const errorNotice = `### ⚠️ Gemini API Key Required

The StudyDock AI Tutor requires a valid \`GEMINI_API_KEY\` to answer questions grounded on your uploaded textbook.

To configure your API key:
1. Open or create \`.env.local\` in your project root
2. Add:
\`\`\`env
GEMINI_API_KEY="your-actual-gemini-api-key"
\`\`\`
3. Restart your dev server (\`npm run dev\`)`;

    callbacks.onChunk(errorNotice);
    callbacks.onComplete(errorNotice);
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = buildProductionPrompt(question, context as ProductionRagContext, modeConfig.promptModifier);
    const result = await model.generateContentStream(prompt);

    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      callbacks.onChunk(fullText);
    }

    callbacks.onComplete(fullText);
  } catch (error: any) {
    console.error("Gemini API stream error:", error?.message || error);
    const failureMsg = `### ⚠️ AI Tutor Service Unavailable

I encountered an issue connecting to the Gemini AI service: **${error?.message || "Rate limit or network error"}**.

Please try asking your question again in a moment.`;
    callbacks.onChunk(failureMsg);
    callbacks.onComplete(failureMsg);
  }
}
