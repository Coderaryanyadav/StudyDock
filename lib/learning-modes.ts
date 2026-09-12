import { LearningMode, LearningModeConfig } from "@/types";

export const LEARNING_MODES: Record<LearningMode, LearningModeConfig> = {
  explain: {
    id: "explain",
    name: "Explain",
    icon: "Sparkles",
    description: "Clear, balanced explanation of concepts and mechanisms.",
    promptModifier:
      "Explain the concept clearly and concisely. Structure the response with clear headings, bullet points, and highlight key terms.",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  beginner: {
    id: "beginner",
    name: "Beginner",
    icon: "Baby",
    description: "Explain with everyday analogies assuming no prior knowledge.",
    promptModifier:
      "Explain as if the student has zero prior technical knowledge. Use intuitive real-world analogies (like postal mail, phone calls, or traffic), avoid dense jargon, and break ideas into simple intuitive steps.",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  deep_dive: {
    id: "deep_dive",
    name: "Deep Dive",
    icon: "Layers",
    description: "Advanced architectural, mathematical, and protocol details.",
    promptModifier:
      "Provide an advanced, rigorous technical deep dive. Include underlying protocol mechanics, packet bitflags, edge cases, timing diagrams, mathematical formulas, and RFC-level architectural trade-offs.",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  example: {
    id: "example",
    name: "Example",
    icon: "FlaskConical",
    description: "Hands-on real-world scenarios and concrete code/traces.",
    promptModifier:
      "Provide practical, concrete real-world examples and step-by-step trace scenarios (e.g. Wireshark packet captures, real server handshakes, or socket programming code snippets) demonstrating this concept in action.",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  quiz: {
    id: "quiz",
    name: "Quiz",
    icon: "HelpCircle",
    description: "Interactive check questions based on the active textbook page.",
    promptModifier:
      "Formulate 2-3 engaging multiple-choice and short-answer quiz questions strictly based on the provided textbook context. Do not reveal the answers immediately; invite the student to answer.",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  },
  exam: {
    id: "exam",
    name: "Exam Mode",
    icon: "GraduationCap",
    description: "Rigorous university exam-style questions and marking keys.",
    promptModifier:
      "Generate university-level midterm/final exam questions on this topic. Include expected grading rubric criteria, common traps students fall into, and high-yield scoring keywords.",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  flashcards: {
    id: "flashcards",
    name: "Flashcards",
    icon: "BookOpen",
    description: "High-yield term definitions and prompt-answer cards.",
    promptModifier:
      "Extract high-yield concepts into 3-4 structured flashcards formatted with [FRONT: Concept / Question] and [BACK: Precise, concise definition or mechanism].",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  summary: {
    id: "summary",
    name: "Summary",
    icon: "FileText",
    description: "Executive summary notes and key exam takeaways.",
    promptModifier:
      "Synthesize this section into high-density revision notes. Use bullet points, bold key definitions, and include a 'Top 3 Takeaways to Memorize' section.",
    badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  },
  teach_me: {
    id: "teach_me",
    name: "Teach Me",
    icon: "Compass",
    description: "Step-by-step interactive guided lesson.",
    promptModifier:
      "Act as a master professor. Teach this concept step-by-step in numbered progression: 1) The Core Problem, 2) The Solution Mechanism, 3) Step-by-step walk-through, 4) Quick verification question.",
    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  },
  socratic: {
    id: "socratic",
    name: "Socratic Mode",
    icon: "Brain",
    description: "Guiding questions instead of direct answers to stimulate thinking.",
    promptModifier:
      "Do NOT give the direct answer immediately! Instead, use the Socratic method: ask thoughtful, guiding questions that lead the student to deduce the underlying principle themselves based on the textbook context.",
    badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  },
};
