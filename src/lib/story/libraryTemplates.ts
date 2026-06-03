import type { StorySeedPack } from "@/lib/import/storySeed";
import { loadWhenDawnBreaksSeed } from "@/lib/import/storySeed";
import { EXTENDED_LIBRARY_TEMPLATES } from "@/lib/story/libraryTemplatesExtra";
import { seedPackToStoryDraft } from "@/lib/story/seedPackDraft";
import type { StoryDraft } from "@/lib/story/generateStoryDraft";
import type { StoryCharacterCard, StoryLorebook } from "@/lib/types";

export type LibraryTemplateId =
  | "crossroads-inn"
  | "station-echo"
  | "last-letter"
  | "when-dawn-breaks"
  | "haunted-lake"
  | "midnight-bakery"
  | "iron-republic"
  | "neon-witness"
  | "desert-oath"
  | "tide-line"
  | "schatten-kaiser"
  | "akademie-arkanum"
  | "system-null"
  | "blutmond-pakt"
  | "zug-47"
  | "second-life-protocol"
  | "guild-last-light"
  | "starlit-court"
  | "hexbound-academy"
  | "ghost-signal";

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
  loadPack: () => StorySeedPack;
}

function narrator(
  name: string,
  card: Partial<StoryCharacterCard> & Pick<StoryCharacterCard, "first_mes" | "system_prompt">,
): StoryCharacterCard {
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
  card: Partial<StoryCharacterCard>,
): StoryCharacterCard {
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

function loadCrossroadsInnPack(): StorySeedPack {
  const world: StoryLorebook = {
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

function loadStationEchoPack(): StorySeedPack {
  const world: StoryLorebook = {
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

function loadLastLetterPack(): StorySeedPack {
  const world: StoryLorebook = {
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

function loadHauntedLakePack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Das Haus am Schwarzen See",
    description: "Horror-Starter: verlassenes Seehaus, Sturm, etwas unter dem Dock.",
    entries: [
      {
        keys: ["seehaus", "see", "dock"],
        content:
          "Das Seehaus gehörte deiner Tante. Seit dem Unglück vor zwanzig Jahren steht es leer — offiziell. Die Einheimischen meiden den Uferweg nach Einbruch der Dunkelheit.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["sturm", "regen", "wind"],
        content:
          "Der Wetterdienst warnte vor einem Herbststurm. Die Brücke zur Landstraße ist gesperrt. Du bist mit dem Auto bis zur Auffahrt gekommen — weiter nur zu Fuß.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["tagebuch", "foto", "keller"],
        content:
          "Im Wohnzimmer liegt ein aufgeschlagenes Tagebuch deiner Tante. Die letzte Seite: „Wenn du das liest, geh nicht zum Dock.“ Daneben ein altes Foto — Gesichter, die du nicht kennst.",
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
        card: narrator("Seehaus-Erzähler", {
          description: "Interaktiver Horror-Erzähler am Schwarzen See.",
          personality:
            "Spannungsvoll, sinnlich, nie explizit blutig ohne Setup. Zweite Person. Langsame Enthüllungen.",
          scenario:
            "Du erbst das Seehaus. Der Sturm beginnt. Etwas klopft von unten — vom Dock.",
          first_mes:
            "Der Wind heult durch die Kiefern, als du den Schlüssel ins Schloss drückst. Die Tür quietscht — innen riecht es nach feuchtem Holz und altem Rauch.\n\nStrom gibt es nicht; du hast eine Taschenlampe und eine Kerze auf dem Kaminmantel angezündet. Draußen peitscht Regen gegen die Fenster. Dann ein Geräusch, das nicht vom Wind stammen kann: ein einzelner Schlag — von der Richtung des Docks.\n\nAuf dem Tisch liegt dein Tantes Tagebuch, aufgeschlagen. Die letzte Zeile: „Geh nicht zum Dock.“\n\nHinter dir knarrt ein Bodenbrett im Flur. Die Haustür ist noch offen.\n\nWas tust du?",
          system_prompt:
            "Du erzählst eine interaktive Horror-Geschichte am Schwarzen See in der zweiten Person. Baue Spannung langsam auf; keine Jump-Scares ohne Vorwarnung. Der Spieler ist der Erbe des Hauses. Respektiere alle Spielereingaben. Beende jede Szene an einer Entscheidungspause. Keine Zeitsprünge ohne Zustimmung.",
          tags: ["horror", "narrator", "de"],
        }),
      },
      {
        slug: "tante-helene",
        role: "cast",
        card: castCard("Tante Helene", {
          description: "Verstorbene Besitzerin — nur durch Tagebuch und Andeutungen.",
          personality: "Früher warm, zuletzt ängstlich und geheimnisvoll.",
        }),
      },
      {
        slug: "silas",
        role: "cast",
        card: castCard("Silas", {
          description: "Nachbar vom gegenüberliegenden Ufer, taucht im Sturm auf.",
          personality: "Wenige Worte, kennt alte Geschichten zum See.",
          scenario: "Warnt dich — oder will etwas vom Haus?",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadMidnightBakeryPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Bäckerei Sonnenaufgang",
    description: "Cozy Mystery: Mitternachts-Schicht, fehlende Rezeptur, freundliche Stadt.",
    entries: [
      {
        keys: ["bäckerei", "backstube", "ofen"],
        content:
          "Die Bäckerei Sonnenaufgang ist seit drei Generationen in Familienhand. Nachts backt nur noch eine Person — du, seit Großmutter ihre Rezepturkarte verlegt hat.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["rezept", "karte", "vanille"],
        content:
          "Die legendäre Vanille-Schnecke darf nur mit der geheimen Karte gebacken werden. Sie fehlt seit gestern — und morgen kommt der Bürgermeister zur Probe.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["katze", "mohn"],
        content:
          "Mohn, die Werkstattkatze, sitzt seit Mitternacht vor dem Tresor und miaut in eine bestimmte Richtung — zum alten Lager im Keller.",
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
        card: narrator("Bäckerei-Erzähler", {
          description: "Interaktiver Cozy-Mystery-Erzähler in kleiner Stadt.",
          personality:
            "Warm, leicht humorvoll, keine Gewalt. Zweite Person. Rätsel statt Schrecken.",
          scenario:
            "Mitternachtsschicht. Die Rezepturkarte ist weg. Mohn die Katze will etwas zeigen.",
          first_mes:
            "Mehl liegt wie feiner Schnee auf der Arbeitsplatte, und der Ofen summt vertraut. Es ist kurz nach Mitternacht — deine Lieblingsschicht, wenn die Stadt schläft und du in Ruhe denkst.\n\nNur heute fehlt etwas: die vergilbte Rezepturkarte für die Vanille-Schnecken. Großmutter hat sie gestern noch in der Hand gehabt. „Ohne die Karte backen wir nicht“, sagte sie — und der Bürgermeister kommt morgen früh zur Probe.\n\nMohn sitzt vor dem alten Tresor, Schwanz wie ein Metronom, und starrt die Kellertür an. Dann sieht sie dich an, als würde sie sagen: Endlich.\n\nAuf der Theke liegt ein Zettel in unbekannter Handschrift: „Such dort, wo die Zuckerlösung überkocht.“\n\nDie Kellertreppe ist offen. Die Backstube ist warm. Draußen ist es still.\n\nWas machst du?",
          system_prompt:
            "Du erzählst eine interaktive Cozy-Mystery in einer Bäckerei, zweite Person. Ton: freundlich, leicht, keine brutale Gewalt. Der Spieler arbeitet die Nachtschicht. Beende Szenen mit einer Wahl. Keine Zeitsprünge ohne Zustimmung.",
          tags: ["cozy", "mystery", "narrator", "de"],
        }),
      },
      {
        slug: "oma-lotte",
        role: "cast",
        card: castCard("Oma Lotte", {
          description: "Großmutter, Besitzerin, vergisst Namen aber nie Geschmack.",
          personality: "Herzlich, stur, liebt Geheimnisse.",
        }),
      },
      {
        slug: "finn",
        role: "cast",
        card: castCard("Finn", {
          description: "Nachtkurier, bringt Mehl, kennt jeden Klatsch der Stadt.",
          personality: "Redselig, neugierig, hilfsbereit.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadIronRepublicPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "The Iron Republic",
    description: "Steampunk starter: airship dock, brass politics, clockwork plague rumor.",
    entries: [
      {
        keys: ["iron republic", "dock", "airship"],
        content:
          "Port Cogwheel is the republic's busiest sky-dock. Airships arrive on brass schedules; steam fog hides more than weather.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["plague", "clockwork", "cough"],
        content:
          "Rumors speak of a clockwork plague — victims cough brass dust. Officials deny it. A quarantine bell rang once, then fell silent.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["manifest", "cargo", "crate"],
        content:
          "Your manifest lists one crate marked PERSONAL / DO NOT OPEN. The seal bears a family crest you have never seen — yet it feels familiar.",
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
        card: narrator("Republic Narrator", {
          description: "Interactive steampunk narrator at Port Cogwheel.",
          personality:
            "Cinematic, witty, second person. Brass-and-steam detail. No player decisions.",
          scenario:
            "You arrive on a courier airship. A sealed crate waits. The quarantine bell rings again.",
          first_mes:
            "Steam rolls across the sky-dock as your airship latches with a shudder of brass. Gears turn overhead; somewhere a public loudspeaker crackles the hour.\n\nYou are here to deliver a crate — or so the papers say. But the seal on the crate bears a crest that tugs at a memory you cannot place. Dock workers keep their distance. A woman in a republic uniform watches from the gantry: Inspector Vale.\n\nThen the quarantine bell rings — one long note that makes the crowd freeze. Vale's hand goes to her radio. \"Stay where you are,\" she calls to you. \"Your manifest just flagged.\"\n\nThe crate hums faintly, like something alive inside clockwork.\n\nFog swallows the far end of the dock. Vale waits for your answer.\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive steampunk story at Port Cogwheel in the Iron Republic. Second person. The player is a courier with a mysterious crate. Keep tone adventurous, political undertones allowed. End each beat at a choice. No time skips without consent.",
          tags: ["steampunk", "narrator", "en"],
        }),
      },
      {
        slug: "inspector-vale",
        role: "cast",
        card: castCard("Inspector Vale", {
          description: "Republic inspector, sharp, tired loyalty.",
          personality: "By-the-book surface, curious underneath.",
        }),
      },
      {
        slug: "dockmaster-hsu",
        role: "cast",
        card: castCard("Dockmaster Hsu", {
          description: "Runs the gantry, knows every smuggled bolt.",
          personality: "Cheerful, evasive, protects his crew.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadNeonWitnessPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Neon District 9",
    description: "Cyberpunk noir: rain, corporate witness, encrypted memory chip.",
    entries: [
      {
        keys: ["district 9", "neon", "rain"],
        content:
          "District 9 never sleeps — hologram ads, wet asphalt, drones overhead. Corporations own the law above street level.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["chip", "memory", "encryption"],
        content:
          "A data chip in your pocket pulses warm. Someone paid you to hold it one night. The encryption window closes at 05:00.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["witness", "client", "kite corp"],
        content:
          "Your client called herself only WREN. She said Kite Corp would kill to recover what is on the chip — and that you are the only courier who never sold a route.",
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
        card: narrator("District Narrator", {
          description: "Interactive cyberpunk noir narrator in District 9.",
          personality:
            "Tight, rain-soaked prose, second person. Morally gray world. No decisions for player.",
          scenario:
            "Rooftop safehouse. Rain. Footsteps on the fire escape. The chip is warming up.",
          first_mes:
            "Rain needles the neon until every sign bleeds color into the gutter. You are on a rooftop safehouse with a view of Kite Corp's black tower — and a data chip in your palm that should not be this warm.\n\nWREN's last message still glows on your lens: \"Do not plug it in. Do not trust the elevator. If I vanish, run.\"\n\nThe fire escape rattles. Boots — more than one pair. A drone sweeps the alley and paints your wall red for a second.\n\nIn the doorway reflection you see a figure you cannot place: short hair, corporate jacket, no insignia. They raise a hand — not a weapon, a badge you do not recognize.\n\n\"Courier,\" they say. \"We need to talk about WREN.\"\n\nThe chip pulses once, like a heartbeat.\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive cyberpunk noir story in District 9. Second person. The player is a street courier holding an encrypted chip. Keep technology grounded in near-future cyberpunk. End scenes at decision points. No time skips without consent.",
          tags: ["cyberpunk", "noir", "narrator", "en"],
        }),
      },
      {
        slug: "wren",
        role: "cast",
        card: castCard("WREN", {
          description: "Missing client, ex-corporate analyst, only via messages.",
          personality: "Clever, frightened, plans three moves ahead.",
        }),
      },
      {
        slug: "unknown-agent",
        role: "cast",
        card: castCard("Unmarked Agent", {
          description: "Figure on the fire escape, badge without logo.",
          personality: "Calm, dangerous politeness.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadDesertOathPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Die Oase von Kharim",
    description: "Abenteuer-Fantasy: Karawane, Sandsturm, alter Eid.",
    entries: [
      {
        keys: ["karawane", "oase", "kharim"],
        content:
          "Kharim ist die letzte Oase vor den Salzflachen. Deine Karawane soll bei Morgengrauen weiter — wenn der Eid noch gilt.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["eid", "siegel", "wüste"],
        content:
          "Dein Clan schuldet dem Wüstenfürsten einen Eid: ein Artefakt bis zur nächsten Mondsichel. Das Siegel am Artefakt ist gebrochen — ein Riss wie ein Blitz.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["sandsturm", "habicht", "ruinen"],
        content:
          "Die Habichtswache meldet einen Sandsturm aus Osten und Lichter in alten Ruinen, die auf keiner Karte stehen.",
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
        card: narrator("Wüsten-Erzähler", {
          description: "Interaktiver Abenteuer-Fantasy-Erzähler in Kharim.",
          personality:
            "Episch, sinnlich, zweite Person. Hitze und Staub spürbar. Keine Entscheidungen für den Spieler.",
          scenario:
            "Nacht in der Oase. Das Siegel am Artefakt bricht. Ein Sandsturm kommt.",
          first_mes:
            "Die Oase von Kharim atmet noch — Wasser plätschert, Kamele grunzen, irgendwo spielt eine Laute zu leise für eine Feier. Du sitzt am Feuer mit dem verpackten Artefakt auf den Knien.\n\nDann ein scharfer Ton: das Siegel springt auf, ein feiner Riss glimmt wie eine Kohle. Niemand sonst scheint es zu hören — nur du.\n\nSadiya, die Karawanenführerin, legt dir eine Hand auf die Schulter. „Wenn das Siegel bricht, bricht der Eid. Wir haben bis Morgengrauen.“\n\nAm Rand der Dünen hebt der Wind Staub wie eine Wand. Die Habichtswache ruft: „Sturm! Und Lichter in den Ruinen!“\n\nDas Artefakt wird warm unter deinen Fingern.\n\nWas tust du?",
          system_prompt:
            "Du erzählst eine interaktive Abenteuer-Fantasy in der Wüste um Kharim, zweite Person. Der Spieler trägt ein Artefakt und einen gebrochenen Eid. Ton: episch, hoffnungsvoll, gefährlich. Beende Szenen mit einer Wahl. Keine Zeitsprünge ohne Zustimmung.",
          tags: ["adventure", "fantasy", "narrator", "de"],
        }),
      },
      {
        slug: "sadiya",
        role: "cast",
        card: castCard("Sadiya", {
          description: "Karawanenführerin, kennt jeden Pfad und jedes Tabu.",
          personality: "Pragmatisch, loyal, hasst leere Versprechen.",
        }),
      },
      {
        slug: "habicht",
        role: "cast",
        card: castCard("Rashid von der Habichtswache", {
          description: "Späher, meldet Sturm und Ruinenlichter.",
          personality: "Nervös, ehrlich, superstitös.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadTideLinePack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "The Tide Line",
    description: "Coastal drama-thriller: family cottage, low tide reveals, buried voicemail.",
    entries: [
      {
        keys: ["cottage", "tide", "coast"],
        content:
          "The Tide Line cottage has been in your family for sixty years. Every summer someone swore they would fix the rotting pier — no one did.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["voicemail", "phone", "father"],
        content:
          "Your father's old phone washed up in the wrack line. It still holds one unheard voicemail, timestamp the night he disappeared.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["low tide", "pier", "metal"],
        content:
          "At low tide something metal gleams under the pier — not debris. Shapes like a door in the mud.",
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
        card: narrator("Coast Narrator", {
          description: "Interactive coastal drama narrator at the Tide Line.",
          personality:
            "Intimate, tense, second person. Family grief under surface. No player decisions.",
          scenario:
            "You return to the cottage after years away. Low tide. A phone in the wrack line.",
          first_mes:
            "Salt air hits you before the cottage roof comes into view — familiar, smaller than memory. You came back because the lawyers called, not because you were ready.\n\nThe tide is out. The pier leans like a tired animal. In the wrack line, half buried in kelp, something plastic catches the sun: your father's old phone, scoured clean by the sea.\n\nIt boots when you dry it on your sleeve — one notification waiting, eleven years old: a voicemail you have never played.\n\nYour sister Mae appears on the porch, arms folded. \"You found it too,\" she says. \"I was going to tell you at dinner. I wasn't going to play it alone again.\"\n\nUnder the pier, metal glints — not a boat, not trash. A rectangle in the mud, like a door.\n\nThe wind picks up. Mae watches you.\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive coastal family drama with thriller undertones at the Tide Line cottage. Second person. The player returned home after long absence. Keep emotions grounded. End each beat at a choice. No time skips without consent.",
          tags: ["drama", "thriller", "narrator", "en"],
        }),
      },
      {
        slug: "mae",
        role: "cast",
        card: castCard("Mae", {
          description: "Younger sister, kept the cottage running, sharp tongue.",
          personality: "Protective, angry, afraid of the voicemail.",
        }),
      },
      {
        slug: "father",
        role: "cast",
        card: castCard("Father", {
          description: "Missing eleven years — voice only via old phone.",
          personality: "Warm in memory, evasive in the past.",
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
    coverImageSrc: "/library-covers/when-dawn-breaks.webp",
    spineTitle: "When Dawn Breaks",
    coverImagePrompt:
      "Audiobook cover illustration, vertical portrait 2:3, cinematic science fiction drama at dawn. View from a Berlin rooftop: silhouette of a young man with dark hair at the railing, Berlin TV Tower visible in misty distance. Above, faint golden celestial barriers shimmer like aurora borealis through storm clouds; first rays of dawn break through. Far sky: dark angular invasion warships emerging from clouds, not peaceful vessels. At opposite edges of the frame, two towering Celestial figures barely visible — one radiating golden light, one silver. Dark moody atmosphere, epic scale, anime-inspired painterly digital art, dramatic composition, rich amber gold and deep indigo violet palette. No text, no title, no logos, no watermark.",
    loadPack: loadWhenDawnBreaksSeed,
  },
  {
    id: "haunted-lake",
    title: "Das Haus am Schwarzen See",
    tagline: "Horror · Sturm · Das Dock",
    genre: "Horror",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #0a1218 0%, #1a2830 40%, #2a1a22 100%)",
    defaultConcept:
      "Du erbst das Seehaus deiner Tante. Der Sturm sperrt die Brücke. Etwas klopft vom Dock — und im Tagebuch steht: Geh nicht hin.",
    defaultGenre: "Horror, Mystery",
    defaultTone: "Spannungsvoll, sinnlich, langsame Enthüllungen",
    bandTitle: "Band I — Der Sturm",
    chapterTitle: "Kapitel 1 — Ankunft",
    phaseHint: "Erste Nacht im Seehaus",
    lorebookName: "Das Haus am Schwarzen See",
    spineTitle: "Schwarzer See",
    coverImageSrc: "/library-covers/haunted-lake.webp",
    coverImagePrompt:
      "Book cover illustration, horror audiobook, isolated lake house in pine forest during storm, single warm window light, wooden dock stretching into black water, rain and mist, subtle silhouette under dock, moody teal and charcoal palette, no text, vertical portrait 2:3",
    loadPack: loadHauntedLakePack,
  },
  {
    id: "midnight-bakery",
    title: "Mitternacht in der Bäckerei",
    tagline: "Cozy Mystery · Rezept · Kleine Stadt",
    genre: "Cozy Mystery",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #3d2818 0%, #5c4030 45%, #2a2438 100%)",
    defaultConcept:
      "Nachtschicht in der Familien-Bäckerei. Die geheime Rezepturkarte fehlt — und die Katze Mohn starrt zur Kellertür.",
    defaultGenre: "Cozy Mystery, Alltag",
    defaultTone: "Warm, leicht humorvoll, rätselhaft",
    bandTitle: "Band I — Die Nachtschicht",
    chapterTitle: "Kapitel 1 — Mehl und Geheimnisse",
    phaseHint: "Kurz nach Mitternacht",
    lorebookName: "Bäckerei Sonnenaufgang",
    spineTitle: "Mitternachtsbäckerei",
    coverImageSrc: "/library-covers/midnight-bakery.webp",
    coverImagePrompt:
      "Book cover illustration, cozy mystery audiobook, warm bakery interior at night, glowing oven, flour dust in air, cat sitting before cellar door, small town mood, soft amber and lavender tones, no text, vertical portrait 2:3",
    loadPack: loadMidnightBakeryPack,
  },
  {
    id: "iron-republic",
    title: "The Iron Republic",
    tagline: "Steampunk · Airship dock · Sealed crate",
    genre: "Steampunk",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #2a1f14 0%, #4a3520 35%, #1a2838 100%)",
    defaultConcept:
      "Port Cogwheel: you deliver a crate with a crest you should not recognize. The quarantine bell rings — and the crate hums.",
    defaultGenre: "Steampunk, Adventure",
    defaultTone: "Cinematic, witty, brass-and-steam",
    bandTitle: "Volume I — Port Cogwheel",
    chapterTitle: "Chapter 1 — The Manifest",
    phaseHint: "Morning dock shift",
    lorebookName: "The Iron Republic",
    spineTitle: "Iron Republic",
    coverImageSrc: "/library-covers/iron-republic.webp",
    coverImagePrompt:
      "Book cover illustration, steampunk audiobook, brass airship sky-dock, steam fog, giant gears and gantries, sealed crate with mysterious crest, Victorian-industrial aesthetic, copper and teal palette, no text, vertical portrait 2:3",
    loadPack: loadIronRepublicPack,
  },
  {
    id: "neon-witness",
    title: "Neon Witness",
    tagline: "Cyberpunk · Data chip · Rain",
    genre: "Cyberpunk",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #0a0818 0%, #1a0a28 40%, #0a1830 100%)",
    defaultConcept:
      "District 9, rain, a warming data chip. WREN vanished. Someone is on your fire escape with a badge that has no logo.",
    defaultGenre: "Cyberpunk, Noir",
    defaultTone: "Tight, rain-soaked, morally gray",
    bandTitle: "Volume I — District 9",
    chapterTitle: "Chapter 1 — Warm Chip",
    phaseHint: "05:00 deadline",
    lorebookName: "Neon District 9",
    spineTitle: "Neon Witness",
    coverImageSrc: "/library-covers/neon-witness.webp",
    coverImagePrompt:
      "Book cover illustration, cyberpunk noir audiobook, rainy rooftop at night, neon hologram ads, black corporate tower in distance, glowing data chip in hand, drone searchlight, magenta and cyan palette, no text, vertical portrait 2:3",
    loadPack: loadNeonWitnessPack,
  },
  {
    id: "desert-oath",
    title: "Der Eid der Oase",
    tagline: "Abenteuer · Karawane · Gebrochenes Siegel",
    genre: "Abenteuer-Fantasy",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #4a3018 0%, #8a6028 40%, #2a1810 100%)",
    defaultConcept:
      "In Kharim bricht das Siegel am Artefakt. Der Eid endet bei Morgengrauen — und ein Sandsturm kommt von den Ruinen.",
    defaultGenre: "Fantasy, Abenteuer",
    defaultTone: "Episch, hoffnungsvoll, gefährlich",
    bandTitle: "Band I — Kharim",
    chapterTitle: "Kapitel 1 — Das warme Siegel",
    phaseHint: "Nacht vor dem Sturm",
    lorebookName: "Die Oase von Kharim",
    spineTitle: "Eid der Oase",
    coverImageSrc: "/library-covers/desert-oath.webp",
    coverImagePrompt:
      "Book cover illustration, desert fantasy audiobook, oasis camp at night, caravan fires, ancient artifact glow, sandstorm wall on horizon, starry sky, warm gold and deep umber palette, no text, vertical portrait 2:3",
    loadPack: loadDesertOathPack,
  },
  {
    id: "tide-line",
    title: "The Tide Line",
    tagline: "Drama · Family cottage · Low tide",
    genre: "Drama",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #1a2838 0%, #2a4050 45%, #3a2830 100%)",
    defaultConcept:
      "You return to the family cottage. Your father's phone washes ashore with one unheard voicemail — and something metal shows under the pier at low tide.",
    defaultGenre: "Drama, Thriller",
    defaultTone: "Intimate, tense, coastal grief",
    bandTitle: "Volume I — Homecoming",
    chapterTitle: "Chapter 1 — Wrack Line",
    phaseHint: "Low tide afternoon",
    lorebookName: "The Tide Line",
    spineTitle: "The Tide Line",
    coverImageSrc: "/library-covers/tide-line.webp",
    coverImagePrompt:
      "Book cover illustration, coastal drama audiobook, weathered seaside cottage, low tide exposing pier pilings, kelp and old phone in wrack line, overcast golden light, emotional mood, slate blue and sand tones, no text, vertical portrait 2:3",
    loadPack: loadTideLinePack,
  },
  ...EXTENDED_LIBRARY_TEMPLATES,
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
