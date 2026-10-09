export interface QuestionItem {
  id: string;
  question: string;
  followUpHint?: string;
  recommendedDurationSeconds: number; // e.g. 30-40s for Part 1
}

export interface Part2Topic {
  id: string;
  topicTitle: string;
  taskCardPrompt: string;
  bulletPoints: string[];
  prepTimeSeconds: number; // 60s
  speakTimeSeconds: number; // 120s
}

export interface ExamDataSet {
  id: string;
  title: string;
  category: string;
  season: string; // e.g. "Forecast Quý 3-4 / 2026"
  examinerName: string;
  examinerRole: string;
  examinerVoice: "en-GB" | "en-US" | "en-AU";
  part1: {
    welcome: string;
    questions: QuestionItem[];
  };
  part2: Part2Topic;
  part3: {
    topicIntro: string;
    questions: QuestionItem[];
  };
}

export const EXAM_DATA_SETS: ExamDataSet[] = [
  {
    id: "forecast-2026-travel",
    title: "Bộ đề 01: Travel, Journeys & Unforeseen Adventures",
    category: "Du lịch & Trải nghiệm cuộc sống",
    season: "Forecast Quý 3-4 / 2026 (Bộ đề Khảo thí)",
    examinerName: "Mr. David Harrison",
    examinerRole: "Senior Certified IELTS Examiner",
    examinerVoice: "en-GB",
    part1: {
      welcome:
        "Good afternoon. My name is David Harrison. Could you tell me your full name, please? And what can I call you? Thank you. In this first part, I'd like to ask you some questions about yourself.",
      questions: [
        {
          id: "p1_q1",
          question: "Let's talk about your hometown. Where is your hometown located, and what do you like most about it?",
          followUpHint: "Fluency focus: Describe geographical location and 1-2 distinctive features.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_q2",
          question: "Has your hometown changed much since you were a child?",
          followUpHint: "Grammatical Range: Contrast past vs present (used to be, drastic changes).",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_q3",
          question: "Let's move on to daily routines. What part of the day do you enjoy the most, and why?",
          followUpHint: "Lexical Resource: Descriptive adjectives (unwind, productive, serene evening).",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_q4",
          question: "Do you usually plan your day in advance, or do you prefer to be spontaneous?",
          followUpHint: "Linking ideas: Compare pros of structured scheduling vs spontaneity.",
          recommendedDurationSeconds: 35,
        },
      ],
    },
    part2: {
      id: "p2_cuecard_1",
      topicTitle: "Describe a memorable journey or trip you took that did not go entirely according to plan.",
      taskCardPrompt: "You should say:",
      bulletPoints: [
        "Where you went and who you traveled with",
        "What unexpected problem or change happened during the trip",
        "How you and your companions dealt with the situation",
        "And explain what you learned from this experience and why it remains memorable to you.",
      ],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
    part3: {
      topicIntro:
        "We've been talking about a journey that had unexpected changes. Now, in Part 3, I'd like to discuss some more general questions related to travel and planning.",
      questions: [
        {
          id: "p3_q1",
          question: "Do you think people nowadays rely too heavily on technology, such as GPS and travel apps, when they travel?",
          followUpHint: "Critical thinking: Convenience vs loss of navigational intuition.",
          recommendedDurationSeconds: 50,
        },
        {
          id: "p3_q2",
          question: "Why do some people prefer adventurous and spontaneous trips, while others prefer highly structured package tours?",
          followUpHint: "Comparative analysis: Personality traits, stress tolerance, comfort zone.",
          recommendedDurationSeconds: 55,
        },
        {
          id: "p3_q3",
          question: "In what ways has international tourism impacted local cultures around the world?",
          followUpHint: "Societal impact: Economic revitalization vs commercialization of traditions.",
          recommendedDurationSeconds: 60,
        },
        {
          id: "p3_q4",
          question: "Looking into the future, how do you foresee the way people travel changing over the next two decades?",
          followUpHint: "Speculation & Advanced grammar: Eco-tourism, high-speed rail, virtual immersion.",
          recommendedDurationSeconds: 60,
        },
      ],
    },
  },
  {
    id: "forecast-2026-technology",
    title: "Bộ đề 02: Artificial Intelligence, Technology & Future Careers",
    category: "Công nghệ số & Trí tuệ nhân tạo (Hot Topic 2026)",
    season: "Forecast Quý 3-4 / 2026 (Bộ đề Trọng tâm)",
    examinerName: "Ms. Sarah Jenkins",
    examinerRole: "Senior IDP Assessment Specialist",
    examinerVoice: "en-AU",
    part1: {
      welcome:
        "Good morning. My name is Sarah Jenkins. Could you state your full name for the record, please? Thank you. To begin, let's talk about your work or studies.",
      questions: [
        {
          id: "p1_tech_q1",
          question: "Do you currently work or are you a student? What do you find most rewarding about it?",
          followUpHint: "Fluency: Clearly state major or profession with 1-2 personal highlights.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_tech_q2",
          question: "How often do you use electronic devices and digital apps in your daily routine?",
          followUpHint: "Lexical Resource: Indispensable, seamless integration, productivity tools.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_tech_q3",
          question: "Do you prefer reading books on a digital screen or in paper format? Why?",
          followUpHint: "Coherence: Contrast tactile experience vs portability and instant search.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_tech_q4",
          question: "Do you think technology makes people's lives easier or more complicated?",
          followUpHint: "Balanced perspective: Double-edged sword, streamlines tasks but causes cognitive overload.",
          recommendedDurationSeconds: 35,
        },
      ],
    },
    part2: {
      id: "p2_tech_cuecard",
      topicTitle: "Describe a useful software application or artificial intelligence tool that you use regularly.",
      taskCardPrompt: "You should say:",
      bulletPoints: [
        "What the application or AI tool is and how you discovered it",
        "What specific tasks or purposes you use it for",
        "How it works and what features make it effective",
        "And explain how this tool has changed the way you work, learn, or organize your life.",
      ],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
    part3: {
      topicIntro:
        "We've been talking about digital applications and tools. Now, let's explore broader questions regarding technology and society in Part 3.",
      questions: [
        {
          id: "p3_tech_q1",
          question: "How might the rapid development of artificial intelligence transform the job market in the near future?",
          followUpHint: "Critical analysis: Automation of repetitive tasks vs demand for creativity and emotional intelligence.",
          recommendedDurationSeconds: 50,
        },
        {
          id: "p3_tech_q2",
          question: "Some people worry that reliance on AI could diminish human critical thinking skills. To what extent do you agree?",
          followUpHint: "Balanced stance: Risk of cognitive complacency vs empowered learning and research.",
          recommendedDurationSeconds: 55,
        },
        {
          id: "p3_tech_q3",
          question: "What responsibilities do tech companies have in ensuring user privacy and data security?",
          followUpHint: "Ethical reasoning: Transparent algorithms, ethical safeguards, data consent.",
          recommendedDurationSeconds: 60,
        },
        {
          id: "p3_tech_q4",
          question: "Do you think younger generations adapt more naturally to new technologies than older adults?",
          followUpHint: "Sociological reflection: Digital natives vs digital immigrants, bridging the generational divide.",
          recommendedDurationSeconds: 60,
        },
      ],
    },
  },
  {
    id: "forecast-2026-environment",
    title: "Bộ đề 03: Environment, Urban Living & Sustainability",
    category: "Môi trường, Đô thị & Phát triển bền vững",
    season: "Forecast Quý 3-4 / 2026 (Bộ đề Học thuật)",
    examinerName: "Dr. James Campbell",
    examinerRole: "Lead IELTS Examiner & Linguist",
    examinerVoice: "en-GB",
    part1: {
      welcome:
        "Hello and welcome. My name is Dr. James Campbell. Can you please state your full name and show your identification? Excellent. In this first section, let's talk about where you live.",
      questions: [
        {
          id: "p1_env_q1",
          question: "Do you live in a house or an apartment? What is your favorite room in your home?",
          followUpHint: "Lexical Resource: Cozy ambiance, natural lighting, sanctuary.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_env_q2",
          question: "Are there many public parks or green spaces in your neighborhood?",
          followUpHint: "Fluency: Describe accessibility and whether you frequently visit for relaxation.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_env_q3",
          question: "What is the weather usually like in your region during this time of year?",
          followUpHint: "Weather vocabulary: Tropical, humid, scorching heat, torrential downpours.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_env_q4",
          question: "Do you make an effort to recycle or reduce plastic waste in your daily life?",
          followUpHint: "Habits: Reusable bags, segregating waste, minimizing carbon footprint.",
          recommendedDurationSeconds: 35,
        },
      ],
    },
    part2: {
      id: "p2_env_cuecard",
      topicTitle: "Describe an environmental initiative or project in your city or country that you support.",
      taskCardPrompt: "You should say:",
      bulletPoints: [
        "What the initiative or project is focused on",
        "Who is organizing or participating in this initiative",
        "What specific actions or changes have been implemented",
        "And explain why you consider this project impactful for the community.",
      ],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
    part3: {
      topicIntro:
        "We've discussed community environmental efforts. In Part 3, let's explore larger environmental challenges facing modern cities.",
      questions: [
        {
          id: "p3_env_q1",
          question: "Who should bear greater responsibility for tackling pollution: individual citizens or government authorities?",
          followUpHint: "Governance vs personal civic duty: Systemic legislation vs collective consumer habits.",
          recommendedDurationSeconds: 50,
        },
        {
          id: "p3_env_q2",
          question: "How can modern cities balance economic growth with the preservation of natural habitats?",
          followUpHint: "Urban design: Green corridors, sustainable infrastructure, renewable energy integration.",
          recommendedDurationSeconds: 55,
        },
        {
          id: "p3_env_q3",
          question: "Do you believe environmental education in primary schools has a lasting effect on young children?",
          followUpHint: "Pedagogical impact: Cultivating eco-consciousness from an impressionable age.",
          recommendedDurationSeconds: 60,
        },
        {
          id: "p3_env_q4",
          question: "How optimistic are you that global cooperation can overcome the challenges of climate change?",
          followUpHint: "Nuanced conclusion: Geopolitical friction vs technological breakthroughs and civic activism.",
          recommendedDurationSeconds: 60,
        },
      ],
    },
  },
  {
    id: "forecast-2026-inspiring-people",
    title: "Bộ đề 04: Inspiring People, Mentorship & Culture",
    category: "Nhân vật truyền cảm hứng & Giao tiếp thế hệ",
    season: "Forecast Quý 3-4 / 2026 (Bộ đề Cốt lõi)",
    examinerName: "Ms. Emma Watson-Taylor",
    examinerRole: "Cambridge Assessment Examiner",
    examinerVoice: "en-GB",
    part1: {
      welcome:
        "Good afternoon. My name is Emma Watson-Taylor. Could you tell me your full name, please? Thank you. First of all, let's talk about your leisure time and friendships.",
      questions: [
        {
          id: "p1_peo_q1",
          question: "How do you usually like to spend your weekends?",
          followUpHint: "Fluency: Active pursuits vs recharging, catching up with friends.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_peo_q2",
          question: "What qualities do you value most in a close friend?",
          followUpHint: "Lexical Resource: Dependability, empathy, mutual respect, sense of humor.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_peo_q3",
          question: "Do you prefer spending time alone or in large social gatherings?",
          followUpHint: "Introspection: Introvert vs extrovert balance, need for quiet reflection.",
          recommendedDurationSeconds: 35,
        },
        {
          id: "p1_peo_q4",
          question: "Have your hobbies or personal interests changed since your teenage years?",
          followUpHint: "Contrast grammar: Outgrown youthful pastimes, developed refined hobbies.",
          recommendedDurationSeconds: 35,
        },
      ],
    },
    part2: {
      id: "p2_peo_cuecard",
      topicTitle: "Describe an inspiring person older than you whom you deeply admire and respect.",
      taskCardPrompt: "You should say:",
      bulletPoints: [
        "Who this person is and how you first met or learned about them",
        "What notable achievements, virtues, or qualities they possess",
        "How they have overcome challenges in their life or career",
        "And explain why this person serves as an important role model for you.",
      ],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
    part3: {
      topicIntro:
        "We've been talking about inspiring role models. Now let's explore broader questions about mentorship and generational values.",
      questions: [
        {
          id: "p3_peo_q1",
          question: "What makes someone a genuine role model in modern society compared to just being a celebrity?",
          followUpHint: "Substance vs spectacle: Moral integrity and societal contribution vs fleeting fame.",
          recommendedDurationSeconds: 50,
        },
        {
          id: "p3_peo_q2",
          question: "Why do young people sometimes find it difficult to communicate openly with older generations?",
          followUpHint: "Generation gap: Differing worldviews, technological literacy, cultural shifts.",
          recommendedDurationSeconds: 55,
        },
        {
          id: "p3_peo_q3",
          question: "In what ways can elderly citizens contribute valuable wisdom to modern communities?",
          followUpHint: "Community value: Historical perspective, life resilience, emotional grounding.",
          recommendedDurationSeconds: 60,
        },
        {
          id: "p3_peo_q4",
          question: "Do you think leadership is an inherent trait, or can it be learned through experience and mentorship?",
          followUpHint: "Nature vs nurture: Innate charisma vs cultivated emotional intelligence and diligence.",
          recommendedDurationSeconds: 60,
        },
      ],
    },
  },
];

// Default fallback export
export const OFFICIAL_EXAM_DATA: ExamDataSet = EXAM_DATA_SETS[0];

// Helper to look up data set by ID
export function getExamDataSetById(id: string): ExamDataSet {
  const found = EXAM_DATA_SETS.find((d) => d.id === id);
  return found || EXAM_DATA_SETS[0];
}
