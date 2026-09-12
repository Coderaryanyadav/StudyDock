export type LearningMode =
  | "explain"
  | "beginner"
  | "deep_dive"
  | "example"
  | "quiz"
  | "exam"
  | "flashcards"
  | "summary"
  | "teach_me"
  | "socratic";

export interface LearningModeConfig {
  id: LearningMode;
  name: string;
  icon: string;
  description: string;
  promptModifier: string;
  badgeColor: string;
}

export interface BookChunk {
  id: string;
  bookId: string;
  chapterId?: string | null;
  chapterTitle?: string | null;
  sectionId?: string | null;
  sectionTitle?: string | null;
  pageNumber: number;
  text: string;
  keyTerms?: string[];
}

export interface BookPage {
  pageNumber: number;
  chapterId?: string | null;
  chapterTitle?: string | null;
  sectionId?: string | null;
  sectionTitle?: string | null;
  title: string;
  content: string; // Markdown or rich HTML content
  diagramSvg?: string;
  keyTakeaways?: string[];
  equations?: string[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  startPage: number;
  endPage: number;
  sections: {
    id: string;
    number: string;
    title: string;
    page: number;
  }[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  edition: string;
  subject: string;
  totalPages: number;
  coverImage?: string;
  chapters: Chapter[];
  pages: BookPage[];
  chunks: BookChunk[];
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  color: "yellow" | "blue" | "green" | "pink";
  createdAt: string;
  note?: string;
  boundingRect?: HighlightRect | null;
  rects?: HighlightRect[];
}

export interface Bookmark {
  id: string;
  bookId: string;
  pageNumber: number;
  title: string;
  createdAt: string;
}

export interface Note {
  id: string;
  bookId: string;
  pageNumber: number;
  selectedText?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoTopic {
  timestampSeconds: number;
  formattedTime: string;
  title: string;
  chapterId: string;
  pageNumber: number;
  summary: string;
}

export interface VideoTranscriptSegment {
  timestampSeconds: number;
  formattedTime: string;
  text: string;
}

export interface VideoLecture {
  id: string;
  title: string;
  youtubeId: string;
  channelName?: string | null;
  durationSeconds: number;
  formattedDuration: string;
  bookId?: string;
  topics?: VideoTopic[];
  transcript?: VideoTranscriptSegment[];
  transcriptUnavailable?: boolean;
}

export interface Citation {
  id: string;
  sourceType?: "textbook" | "youtube";
  bookId: string;
  bookTitle: string;
  chapter: string;
  section: string;
  pageNumber?: number;
  videoTimestampSeconds?: number;
  videoFormattedTime?: string;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "system";
  content: string;
  timestamp: string;
  learningMode?: LearningMode;
  contextSnapshot?: {
    bookTitle: string;
    chapterTitle: string;
    sectionTitle: string;
    pageNumber: number;
    selectedText?: string;
    videoTimestamp?: string;
  };
  citations?: Citation[];
  suggestedFollowUps?: string[];
  isStreaming?: boolean;
}

export interface Flashcard {
  id: string;
  bookId: string;
  chapterId: string;
  pageNumber: number;
  concept: string;
  question: string;
  answer: string;
  status: "unseen" | "learning" | "mastered";
  lastReviewed?: string;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  bookId: string;
  chapterId: string;
  pageNumber: number;
  concept: string;
  question: string;
  options: QuizOption[];
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface ConceptMastery {
  id: string;
  name: string;
  category: string;
  masteryPercentage: number;
  questionsAttempted: number;
  questionsCorrect: number;
  isWeak: boolean;
  recommendedChapter: string;
  recommendedPage: number;
}

export interface StudyPlanItem {
  id: string;
  title: string;
  type: "reading" | "video" | "quiz" | "flashcards" | "review";
  target: string;
  completed: boolean;
  estimatedMinutes: number;
}

export interface StudentProgress {
  totalStudyMinutes: number;
  streakDays: number;
  chaptersCompleted: number;
  videosWatched: number;
  quizzesCompleted: number;
  questionsAsked: number;
  activeSubject: string;
  concepts: ConceptMastery[];
  todayPlan: StudyPlanItem[];
}
