import type { WryTourSeedPack } from "@/lib/import/wrytour";
import { loadWhenDawnBreaksSeed } from "@/lib/import/wrytour";
import { seedPackToStoryDraft } from "@/lib/story/seedPackDraft";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";
import type { WryTourCharacter, WryTourLorebook } from "@/lib/types";

export type LibraryTemplateId =
  | "crossroads-inn"
  | "station-echo"
  | "last-letter"
  | "when-dawn-breaks";

export interface LibraryTemplateDefinition {
  id: LibraryTemplateId;
  title: string;
  tagline: string;
  genre: string;
  locale: "de" | "en";
  /** CSS gradient for placeholder cover until user uploads one */
  coverGradient: string;
  defaultConcept: string;
  defaultGenre: string;
  defaultTone: string;
  bandTitle: string;
  chapterTitle: string;
  phaseHint?: string;
  lorebookName: string;
  /** Static asset under /public, e.g. /library-covers/crossroads-inn.webp */
  coverImageSrc?: string;
  /** Shorter label on the shelf spine (defaults to title) */
  spineTitle?: string;
  /** Prompt for external image generators (portrait cover ~2:3) */
  coverImagePrompt: string;
  loadPack: () => WryTourSeedPack;
}

function narrator(
  name: string,
  card: Partial<WryTourCharacter> & Pick<WryTourCharacter, "first_mes" | "system_prompt">,
): WryTourCharacter {
  return {
    name,
    description: card.description ?? "",
    personality: card.personality ?? "",
    scenario: card.scenario ?? "",
    first_mes: card.first_mes,
    mes_example: "",
    creator_notes: "HörbuchKI Bibliotheks-Vorlage — frei remixbar.",
    system_prompt: card.system_prompt,
    post_history_instructions:
      card.post_history_instructions ??
      "Schreibe in der zweiten Person. Beende jede Antwort an einer natürlichen Pause.",
    tags: card.tags ?? ["interactive story", "narrator"],
    creator: "HörbuchKI Library",
    character_version: "library-v1",
    extensions: {},
  };
}

function castCard(
  name: string,
  card: Partial<WryTourCharacter>,
): WryTourCharacter {
  return {
    name,
    description: card.description ?? "",
    personality: card.personality ?? "",
    scenario: card.scenario ?? "",
    first_mes: card.first_mes ?? "",
    mes_example: card.mes_example ?? "",
    creator_notes: card.creator_notes ?? "",
    system_prompt: card.system_prompt ?? "",
    tags: card.tags ?? [],
    creator: "HörbuchKI Library",
    character_version: "library-v1",
    extensions: {},
  };
}

function loadCrossroadsInnPack(): WryTourSeedPack {
  const world: WryTourLorebook = {
    name: "Das Gasthaus am Scheideweg",
    description: "Fantasy-Starter: Nebel, Handelswege, leise Magie.",
    entries: [
      {
        keys: ["gasthaus", "scheideweg", "herberge"],
        content:
          "Das Gasthaus liegt dort, wo drei Königreiche ihre Straßen treffen. Reisende, Händler und Leute mit Geheimnissen halten hier Rast. Die Wirtin kennt jeden Namen — aber nicht immer die Wahrheit dahinter.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["nebel", "waldrand"],
        content:
          "Seit drei Nächten zieht dichter Nebel aus dem Nordwald. Viele Gäste sprechen von fremden Lichtern zwischen den Bäumen.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["kapuze", "fremder"],
        content:
          "Ein Gast in grauer Kapuze sitzt allein am Fenster und bezahlt mit alten Münzen. Er fragt selten — er hört zu.",
        order: 30,
        enabled: true,
      },
    ],
  };

  return {
    characters: [
      {
        slug: "narrator",
        role: "narrator",
        card: narrator("Gasthaus-Erzähler", {
          description: "Interaktiver Fantasy-Erzähler am Scheideweg.",
          personality:
            "Warm, bildhaft, leicht geheimnisvoll. Zweite Person. Keine Entscheidungen für den Spieler.",
          scenario:
            "Du kommst erschöpft im Gasthaus an. Draußen pfeift der Wind. Die Wirtin mustert dich, der Fremde in der Kapuze hebt den Kopf.",
          first_mes:
            "Regen trommelt auf die Schindeln, als du die schwere Tür aufstößt. Wärme und Geruch von Suppe treffen dich — und für einen Moment vergisst du den Weg, der dich hierher gebracht hat.\n\nDie Wirtin wischt sich die Hände an der Schürze ab. „Noch ein Reisender im Nebel?“ Am Fenster sitzt jemand in grauer Kapuze, Gesicht im Schatten. Er stellt seine Tasse ab, als hätte er deinen Schritt erwartet.\n\nDu stehst zwischen Herd und Tür. Die anderen Gäste schweigen einen Herzschlag zu lang.\n\nWas tust du?",
          system_prompt:
            "Du bist der Erzähler einer interaktiven Fantasy-Geschichte am Gasthaus am Scheideweg. Schreibe in der zweiten Person. Der Spieler ist ein Reisender ohne festes Backstory — respektiere alle Eingaben. Beende jede Szene an einer Handlungspause. Keine Zeitsprünge ohne Erlaubnis.",
          tags: ["fantasy", "narrator", "de"],
        }),
      },
      {
        slug: "marta",
        role: "cast",
        card: castCard("Marta", {
          description: "Wirtin des Gasthauses, pragmatisch, scharfer Blick.",
          personality: "Direkt, fürsorglich hinter harter Schale.",
          scenario: "Kennt jeden Stammgast — und erkennt Lügen am Tonfall.",
        }),
      },
      {
        slug: "hooded-stranger",
        role: "cast",
        card: castCard("Fremder in der Kapuze", {
          description: "Unbekannter Gast, ruhig, beobachtend.",
          personality: "Wenige Worte, jede davon zählt.",
          scenario: "Sucht jemanden — oder etwas — am Scheideweg.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadStationEchoPack(): WryTourSeedPack {
  const world: WryTourLorebook = {
    name: "Relay Station Omega-7",
    description: "Sci-fi starter: isolated relay, unknown signal.",
    entries: [
      {
        keys: ["omega-7", "station", "relay"],
        content:
          "Omega-7 is a deep-space relay with a crew of twelve. Supply ships arrive every six weeks. Most shifts are silence and maintenance — until something answers a ping that should be empty.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["signal", "echo", "transmission"],
        content:
          "The new signal repeats every 47 minutes. It carries no known language header, but the rhythm matches human Morse — one word, over and over.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["quarantine", "protocol"],
        content:
          "Corporate protocol demands quarantine on first contact events. The commander and engineer disagree on whether this counts.",
        order: 30,
        enabled: true,
      },
    ],
  };

  return {
    characters: [
      {
        slug: "narrator",
        role: "narrator",
        card: narrator("Station Narrator", {
          description: "Interactive sci-fi narrator aboard Omega-7.",
          personality:
            "Tense, cinematic, second person. Grounded tech detail. Never decides for the player.",
          scenario:
            "Night shift on the relay. Alarms are quiet. Then the comm board lights up with an impossible reply.",
          first_mes:
            "The hum of the relay is the only sound for hours — fans, coolant, your own breathing in the recycled air. You were checking a routine diagnostics panel when the comm board chirps.\n\nIncoming. Origin: empty sector. Signal strength: impossible.\n\nCommander Reyes appears in the doorway, robe over uniform, coffee forgotten. Engineer Park is already at the secondary terminal, fingers flying. \"It's back,\" Park says. \"The echo. It answered us.\"\n\nOn the main screen, a single word pulses in plain text: HELLO.\n\nReyes looks at you. \"You're on comm duty. What do we do?\"",
          system_prompt:
            "You narrate an interactive sci-fi story on relay station Omega-7. Second person. The player is a crew member. End each beat at a decision point. No time skips without consent. Keep technology plausible.",
          tags: ["sci-fi", "narrator", "en"],
        }),
      },
      {
        slug: "commander-reyes",
        role: "cast",
        card: castCard("Commander Reyes", {
          description: "Station commander, by-the-book, tired eyes.",
          personality: "Calm authority, hides worry well.",
        }),
      },
      {
        slug: "engineer-park",
        role: "cast",
        card: castCard("Engineer Park", {
          description: "Comms engineer, curious, restless.",
          personality: "Fast talker when excited, pushes protocol.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadLastLetterPack(): WryTourSeedPack {
  const world: WryTourLorebook = {
    name: "Stadt am Fluss",
    description: "Mystery-Starter: Brief, alte Freunde, offene Fragen.",
    entries: [
      {
        keys: ["flussstadt", "stadt", "fluss"],
        content:
          "Eine mittelgroße Stadt am Fluss — Brücken, enge Gassen, ein alter Bahnhof. Hier kennt man Nachbarn, aber nicht immer deren Vergangenheit.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["brief", "umschlag"],
        content:
          "Der Brief trägt keine Absenderadresse, nur deinen Namen — Handschrift, die du für unmöglich hältst.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["jonas", "freund"],
        content:
          "Jonas war dein engster Freund, bis er vor fünf Jahren spurlos verschwand. Offiziell: keine Spur. Inoffiziell: manche sagen, er hätte Schulden gehabt.",
        order: 30,
        enabled: true,
      },
    ],
  };

  return {
    characters: [
      {
        slug: "narrator",
        role: "narrator",
        card: narrator("Brief-Erzähler", {
          description: "Interaktiver Mystery-Erzähler in der Flussstadt.",
          personality:
            "Nahbar, leicht melancholisch, zweite Person. Keine Entscheidungen für den Spieler.",
          scenario:
            "Ein regnerischer Abend. Ein Brief unter der Tür. Die Handschrift weckt alte Erinnerungen.",
          first_mes:
            "Der Regen zeichnet Streifen auf dein Küchenfenster, als du den Umschlag bemerkst — kein Stempel, nur dein Name, hastig geschrieben.\n\nDu kennst diese Schrift. Du hast sie ein Jahr lang neben dir in Vorlesungen gesehen, in Notizbüchern, in Nachrichten, die längst hätten aufhören sollen zu kommen.\n\nJonas.\n\nIm Brief stehen nur drei Sätze: „Ich lebe. Ich kann nicht nach Hause. Wenn du mir noch vertraust — komm zum alten Bahnhof, Gleis 4, Mitternacht.“\n\nDein Telefon summt. Eine Nachricht von Lena: „Hast du auch einen Brief bekommen?“\n\nDraußen schlägt die Kirchturmuhr acht.\n\nWas machst du?",
          system_prompt:
            "Du erzählst eine interaktive Mystery-Geschichte in der zweiten Person. Der Spieler erhielt einen Brief von einem verschwundenen Freund. Bleibe glaubwürdig, keine übernatürlichen Enthüllungen ohne Setup. Jede Szene endet mit einer Pause für den Spieler.",
          tags: ["mystery", "narrator", "de"],
        }),
      },
      {
        slug: "lena",
        role: "cast",
        card: castCard("Lena", {
          description: "Freundin aus Studienzeiten, scharfsinnig, vorsichtig.",
          personality: "Analytisch, misstraut leichtfertigen Entscheidungen.",
        }),
      },
      {
        slug: "jonas",
        role: "cast",
        card: castCard("Jonas", {
          description: "Verschwundener Freund — nur durch Briefe und Andeutungen.",
          personality: "Früher warm, jetzt angespannt und gehetzt.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

export const PUBLIC_LIBRARY_TEMPLATES: LibraryTemplateDefinition[] = [
  {
    id: "crossroads-inn",
    title: "Das Gasthaus am Scheideweg",
    tagline: "Fantasy · Nebel · Fremde Gäste",
    genre: "Fantasy",
    locale: "de",
    coverGradient: "linear-gradient(135deg, #1a3c40 0%, #2d1f3d 50%, #4a3520 100%)",
    defaultConcept:
      "Du bist ein erschöpfter Reisender, der im Nebel ein Gasthaus findet. Die Wirtin ist freundlich — der Gast in der Kapuze zu ruhig.",
    defaultGenre: "Fantasy, Mystery",
    defaultTone: "Warm, geheimnisvoll, zweite Person",
    bandTitle: "Band I — Der Nebel",
    chapterTitle: "Kapitel 1 — Ankunft",
    phaseHint: "Erste Nacht im Gasthaus",
    lorebookName: "Das Gasthaus am Scheideweg",
    coverImageSrc: "/library-covers/crossroads-inn.webp",
    spineTitle: "Gasthaus am Scheideweg",
    coverImagePrompt:
      "Book cover illustration, fantasy audiobook, cozy roadside inn at a foggy crossroads at dusk, warm amber light in windows, mist in pine forest, wooden sign, mysterious hooded figure silhouette inside, painterly digital art, cinematic mood, no text, no logos, vertical portrait 2:3, rich teal and gold tones",
    loadPack: loadCrossroadsInnPack,
  },
  {
    id: "station-echo",
    title: "Station Echo",
    tagline: "Sci-Fi · Isolation · Unknown signal",
    genre: "Sci-Fi",
    locale: "en",
    coverGradient: "linear-gradient(135deg, #0c1445 0%, #1a3a5c 45%, #0d2137 100%)",
    defaultConcept:
      "Night shift on relay Omega-7. An empty sector answers your ping with one word: HELLO.",
    defaultGenre: "Sci-Fi, Thriller",
    defaultTone: "Tense, cinematic, second person",
    bandTitle: "Volume I — First Contact",
    chapterTitle: "Chapter 1 — The Echo",
    phaseHint: "Night shift",
    lorebookName: "Relay Station Omega-7",
    coverImageSrc: "/library-covers/station-echo.webp",
    spineTitle: "Station Echo",
    coverImagePrompt:
      "Book cover illustration, science fiction audiobook, isolated deep-space relay station, glowing comm dish, starfield and nebula, single word HELLO on a holographic screen reflection, cold blue lighting, tense atmosphere, sleek hard sci-fi, no text, no logos, vertical portrait 2:3, navy and cyan palette",
    loadPack: loadStationEchoPack,
  },
  {
    id: "last-letter",
    title: "Der letzte Brief",
    tagline: "Mystery · Flussstadt · Alte Freunde",
    genre: "Mystery",
    locale: "de",
    coverGradient: "linear-gradient(135deg, #2a2438 0%, #3d2e4a 40%, #1e2836 100%)",
    defaultConcept:
      "Ein Brief von Jonas, verschwunden seit fünf Jahren. Mitternacht, Gleis 4 — und Lena hat denselben Brief bekommen.",
    defaultGenre: "Mystery, Drama",
    defaultTone: "Nahbar, leicht melancholisch, zweite Person",
    bandTitle: "Band I — Der Brief",
    chapterTitle: "Kapitel 1 — Unter der Tür",
    phaseHint: "Der Abend des Briefes",
    lorebookName: "Stadt am Fluss",
    coverImageSrc: "/library-covers/last-letter.webp",
    spineTitle: "Der letzte Brief",
    coverImagePrompt:
      "Book cover illustration, mystery audiobook, rainy European river city at night, old train station platform Gleis 4, sealed envelope under apartment door, wet cobblestones, church clock tower, melancholic noir mood, soft purple and amber streetlights, no text, no logos, vertical portrait 2:3",
    loadPack: loadLastLetterPack,
  },
  {
    id: "when-dawn-breaks",
    title: "When Dawn Breaks",
    tagline: "Sci-Fi · Guardian · 36-hour countdown",
    genre: "Sci-Fi",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #1a0f2e 0%, #3d1a2a 35%, #5c3a1a 70%, #c45c2a 100%)",
    defaultConcept:
      "Morning after your 28th birthday. Lucifer skipped training for the first time in twenty years. The news shows an invasion fleet — and Naya crashes into your arms at the door. Thirty-six hours until they arrive.",
    defaultGenre: "Sci-Fi, Drama, Romance",
    defaultTone: "Cinematic, dry humor, second person",
    bandTitle: "Volume I — The Countdown",
    chapterTitle: "Chapter 1 — When Dawn Breaks",
    phaseHint: "Hours 0-4 (Shock)",
    lorebookName: "When Dawn Breaks — World Info",
    coverImageSrc: "/library-covers/when-dawn-breaks.jpeg",
    spineTitle: "When Dawn Breaks",
    coverImagePrompt:
      "Audiobook cover illustration, vertical portrait 2:3, science fiction drama. Suburban front door at dawn, warm golden light breaking through violet storm clouds. Silhouette of a young man in the doorway; faint massive invasion ships in the distant sky. Mood: epic but intimate, dry tension, not horror. Cinematic painterly digital art, rich amber and deep indigo palette. No text, no title, no logos, no watermark.",
    loadPack: loadWhenDawnBreaksSeed,
  },
];

export function getLibraryTemplate(
  id: LibraryTemplateId,
): LibraryTemplateDefinition | undefined {
  return PUBLIC_LIBRARY_TEMPLATES.find((t) => t.id === id);
}

export function libraryTemplateToDraft(
  template: LibraryTemplateDefinition,
): StoryDraft {
  return seedPackToStoryDraft(template.loadPack(), {
    storyTitle: template.title,
    bandTitle: template.bandTitle,
    chapterTitle: template.chapterTitle,
    phaseHint: template.phaseHint,
    locale: template.locale,
    lorebookName: template.lorebookName,
  });
}

export function getLibraryCoverImageSrc(
  templateId: LibraryTemplateId | string | null | undefined,
): string | null {
  if (!templateId) return null;
  return (
    PUBLIC_LIBRARY_TEMPLATES.find((t) => t.id === templateId)?.coverImageSrc ??
    null
  );
}

export function getLibraryCoverGradient(
  templateId: LibraryTemplateId | string | null | undefined,
): string | null {
  if (!templateId) return null;
  return (
    PUBLIC_LIBRARY_TEMPLATES.find((t) => t.id === templateId)?.coverGradient ??
    null
  );
}
