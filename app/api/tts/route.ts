import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// In-memory cache for synthesized audio to ensure sub-10ms response on repeated phrases
const audioCache = new Map<string, Buffer>();
const MAX_CACHE_ITEMS = 200;

// Mapping friendly examiner IDs or accents to premium neural voices
const VOICE_MAP: Record<string, string> = {
  "david": "en-GB-RyanNeural",
  "ryan": "en-GB-RyanNeural",
  "en-gb": "en-GB-RyanNeural",
  "british": "en-GB-RyanNeural",
  "sonia": "en-GB-SoniaNeural",
  "emma": "en-GB-SoniaNeural",
  "sarah": "en-AU-NatashaNeural",
  "natasha": "en-AU-NatashaNeural",
  "en-au": "en-AU-NatashaNeural",
  "australian": "en-AU-NatashaNeural",
  "william": "en-AU-WilliamMultilingualNeural",
  "james": "en-GB-ThomasNeural",
  "thomas": "en-GB-ThomasNeural",
  "en-us": "en-US-GuyNeural",
  "american": "en-US-GuyNeural",
};

function resolveVoice(voiceInput?: string | null): string {
  if (!voiceInput) return "en-GB-RyanNeural";
  const cleaned = voiceInput.toLowerCase().trim();

  // Direct lookup in voice map
  for (const [key, val] of Object.entries(VOICE_MAP)) {
    if (cleaned.includes(key)) {
      return val;
    }
  }

  // If already a valid full shortName like en-GB-RyanNeural
  if (voiceInput.includes("-")) {
    return voiceInput;
  }

  return "en-GB-RyanNeural";
}

async function synthesizeTextToBuffer(text: string, voiceName: string): Promise<Buffer> {
  const cacheKey = `${voiceName}:::${text.trim()}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: unknown) => reject(err));
    });

    const fullBuffer = Buffer.concat(chunks);

    // Evict oldest if cache limit reached
    if (audioCache.size >= MAX_CACHE_ITEMS) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, fullBuffer);

    return fullBuffer;
  } finally {
    tts.close();
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text")?.trim();
    const voiceParam = searchParams.get("voice");

    if (!text) {
      return NextResponse.json({ error: "Missing 'text' query parameter." }, { status: 400 });
    }

    if (text.length > 2000) {
      return NextResponse.json({ error: "Text exceeds 2000 character limit." }, { status: 400 });
    }

    const selectedVoice = resolveVoice(voiceParam);
    const audioBuffer = await synthesizeTextToBuffer(text, selectedVoice);

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Examiner-Voice": selectedVoice,
      },
    });
  } catch (error) {
    console.error("TTS generation error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize examiner audio." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing 'text' in request body." }, { status: 400 });
    }

    const selectedVoice = resolveVoice(voice);
    const audioBuffer = await synthesizeTextToBuffer(text, selectedVoice);

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Examiner-Voice": selectedVoice,
      },
    });
  } catch (error) {
    console.error("TTS POST error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize examiner audio." },
      { status: 500 }
    );
  }
}
