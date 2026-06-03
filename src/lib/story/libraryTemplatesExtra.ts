import type { StorySeedPack } from "@/lib/import/storySeed";
import type { LibraryTemplateDefinition } from "@/lib/story/libraryTemplates";
import type { StoryCharacterCard, StoryLorebook } from "@/lib/types";

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

function loadSchattenKaiserPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Das Schattenreich von Valdris",
    description: "Dark-Fantasy-Isekai: fremdes Reich, verlorene Erinnerung, Schatten-Imperium.",
    entries: [
      {
        keys: ["valdris", "schattenreich", "isekai"],
        content:
          "Valdris ist ein Reich, in dem die Sonne selten voll aufgeht. Seit dem Fall des alten Kaisers regieren Schattenfürsten aus dem Obsidianpalast. Fremde Seelen — Isekai-Gefallene — tauchen ohne Erinnerung auf.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["markierung", "hand", "siegel"],
        content:
          "Auf deiner linken Hand glimmt ein schwarzes Siegel — du erinnerst dich nicht, wann es erschien. Die Einheimischen nennen es das Zeichen des Erwachten.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["obsidianpalast", "prozession"],
        content:
          "Eine Prozession aus dem Palast zieht durch die Straßen. Man sucht jemanden mit dem Siegel — lebend, sagt man. Tot, flüstern andere.",
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
        card: narrator("Schatten-Erzähler", {
          description: "Dark-Fantasy-Isekai-Erzähler in Valdris.",
          personality: "Düster, episch, zweite Person. Moralisch grau. Keine Spielerentscheidungen.",
          scenario: "Du erwachst in einer fremden Gasse. Das Siegel brennt. Die Prozession kommt näher.",
          first_mes:
            "Kälte zuerst — dann der Geruch von Regen auf Stein. Du liegst in einer engen Gasse, Kopf dröhnend, als hätte jemand deine Erinnerungen herausgerissen und nur Lücken zurückgelassen.\n\nAuf deiner linken Hand pulsiert ein schwarzes Siegel, fein wie Tinte unter der Haut. Du weißt nicht, wer du warst. Du weißt nur: Das hier ist nicht deine Welt.\n\nSchritte. Viele. Rüstung klirrt am Gassenende. Eine Stimme ruft: „Das Zeichen — dort!“\n\nEine Frau in abgetragener Magierrobe zieht dich in einen Torbogen: Mira. „Wenn du bleibst, bist du tot oder Werkzeug“, flüstert sie. „Wenn du läufst, vielleicht findest du Antworten.“\n\nDie Prozession wendet um. Das Siegel wird heiß.\n\nWas tust du?",
          system_prompt:
            "Du erzählst eine interaktive Dark-Fantasy-Isekai-Geschichte in Valdris, zweite Person. Der Spieler ist ein Erwachter ohne klare Vergangenheit. Ton: düster, hoffnungslos aber nicht hoffnungsfrei. Beende Szenen mit einer Wahl. Keine Zeitsprünge ohne Zustimmung.",
          tags: ["dark fantasy", "isekai", "narrator", "de"],
        }),
      },
      {
        slug: "mira",
        role: "cast",
        card: castCard("Mira", {
          description: "Straßenmagierin, kennt Isekai-Gefallene, misstraut dem Palast.",
          personality: "Schnell, sarkastisch, heimlich fürsorglich.",
        }),
      },
      {
        slug: "hauptmann-vesper",
        role: "cast",
        card: castCard("Hauptmann Vesper", {
          description: "Offizier der Schattenprozession, Stimme wie polierter Stahl.",
          personality: "Höflich, unnachgiebig, folgt Befehlen.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadAkademieArkanumPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Akademie Arkanum",
    description: "Magie-Akademie: Sortierung, Cliquen, verbotenes Archiv.",
    entries: [
      {
        keys: ["akademie", "arkanum", "sortierung"],
        content:
          "Die Akademie Arkanum bildet die Magierelite aus. Neue Schüler werden in vier Häuser sortiert — heute Nacht ist die Zeremonie. Gerüchte: wer kein Haus findet, verschwindet im Archiv.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["häuser", "feuer", "wasser", "luft", "erde"],
        content:
          "Ignis (Feuer), Mare (Wasser), Ventus (Luft), Tellus (Erde). Jedes Haus hat eigene Regeln, Rivalitäten und Geheimnisse.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["archiv", "verboten", "lehrling"],
        content:
          "Unter der Bibliothek liegt das Verbotene Archiv. Ein Lehrling wurde gestern dort gesehen — heute fehlt er im Sortierungsregister.",
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
        card: narrator("Akademie-Erzähler", {
          description: "Magie-Akademie-Erzähler für Social-Sim und Mystery.",
          personality: "Warm, witzig, zweite Person. Schulalltag trifft Magie.",
          scenario: "Erster Abend an der Akademie. Sortierung in einer Stunde. Ein vermisster Lehrling.",
          first_mes:
            "Kerzen schweben unter der gewölbten Decke der Großen Halle, und hunderte Roben flüstern auf einmal — oder ist es nur dein nervöser Puls?\n\nDu bist neu an der Akademie Arkanum. In einer Stunde beginnt die Sortierung. Bis dahin stehst du allein am Rand der Mensa, mit einem unbeschrifteten Zauberstab und dem Gefühl, dass alle dich schon kennen, bevor du dich vorgestellt hast.\n\nTheo, ein zweites Jahr aus Ventus, stellt sich neben dich. „Neu? Ignis hasst Mare, Mare hasst jeden, und Tellus tut so, als wäre es zu edel zum Reden. Einfach, oder?“ Er senkt die Stimme. „Außer wenn jemand im Archiv verschwindet. Dann wird es interessant.“\n\nAn der Tafel blinkt eine Mitteilung: Sortierung — Verspätung wegen interner Prüfung.\n\nTheo sieht dich an. „Willst du vorher noch das Archiv ansehen? Nur so aus Neugier.“\n\nWas machst du?",
          system_prompt:
            "Du erzählst eine interaktive Magie-Akademie-Geschichte (Social Sim + leichtes Mystery) in der zweiten Person. Ton: warm, jugendlich, magisch. Keine Entscheidungen für den Spieler. Beende Szenen mit einer Wahl.",
          tags: ["magic school", "academy", "narrator", "de"],
        }),
      },
      {
        slug: "theo",
        role: "cast",
        card: castCard("Theo", {
          description: "Ventus-Zweitjahresschüler, Klatsch und Loyalität.",
          personality: "Redselig, loyal, überschätzt sich gern.",
        }),
      },
      {
        slug: "professor-elara",
        role: "cast",
        card: castCard("Professorin Elara", {
          description: "Leiterin der Sortierung, Mare-Haus, kühle Autorität.",
          personality: "Präzise, unlesbar, schützt Geheimnisse der Akademie.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadSystemNullPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Welt Null — Systeminterface",
    description: "Isekai mit RPG-System: Statusfenster, Quests, unbekannte Klasse.",
    entries: [
      {
        keys: ["system", "status", "interface"],
        content:
          "Vor deinen Augen schwebt ein blaues Interface — HP, MP, Stufe 1, Klasse: [UNBEKANNT]. Das System spricht in knappen Meldungen. Andere sehen es nicht.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["quest", "tutorial", "null"],
        content:
          "Tutorial-Quest aktiv: „Überlebe die erste Nacht in Grünhain.“ Belohnung: Skillpunkt +1. Zeitlimit: bis Sonnenaufgang.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["grünhain", "dorf", "goblin"],
        content:
          "Grünhain ist ein Randdorf an der Waldgrenze. Seit Wochen fehlen Vieh und Werkzeuge. Die Wachen suchen Freiwillige — oder Sündenböcke.",
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
        card: narrator("System-Erzähler", {
          description: "Isekai-RPG-Erzähler mit Systeminterface.",
          personality: "Cinematic, leicht trocken-humorvoll bei System-Meldungen. Zweite Person.",
          scenario: "Transport nach Grünhain. System bootet. Tutorial-Quest läuft.",
          first_mes:
            "Ein letzter Gedanke — dann kein Boden mehr unter den Füßen, nur Grün und der Geruch von feuchter Erde.\n\nDu landest auf Moos am Rand eines Dorfes. Holzhäuser, Rauch aus Schornsteinen, Hähne, die noch nicht krähen. Und vor deinen Augen: ein blaues Fenster.\n\n[ SYSTEM NULL — INITIALISIERUNG ABGESCHLOSSEN ]\nStufe: 1 | Klasse: [UNBEKANNT] | HP: 100/100\nTutorial-Quest: Überlebe die erste Nacht in Grünhain.\n\nNiemand sonst scheint das Interface zu sehen. Eine Bäuerin starrt dich an, als hättest du vom Himmel gefallen — was du praktisch hast.\n\nRike, die Dorfheilerin, fängt dich am Arm auf. „Lebendig? Gut. Wenn du helfen kannst, helfen wir dir — aber heute Nacht bleibt niemand allein draußen.“\n\nDas System blinkt: [ OPTIONALE QUEST: Sprich mit dem Wachtmeister ]\n\nWas tust du?",
          system_prompt:
            "Du erzählst eine interaktive Isekai-RPG-Geschichte mit Systeminterface in der zweiten Person. System-Meldungen sparsam, in eckigen Klammern. Kein Pay-to-win. Beende Szenen mit einer Wahl. Keine Zeitsprünge ohne Zustimmung.",
          tags: ["isekai", "rpg", "system", "narrator", "de"],
        }),
      },
      {
        slug: "rike",
        role: "cast",
        card: castCard("Rike", {
          description: "Dorfheilerin, pragmatisch, glaubt nicht an Systeme.",
          personality: "Warm, direkt, hasst Heldenposen.",
        }),
      },
      {
        slug: "wachtmeister-bran",
        role: "cast",
        card: castCard("Wachtmeister Bran", {
          description: "Dorfwache, müde, sucht Freiwillige für die Nacht.",
          personality: "Skeptisch, fair, überfordert.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadBlutmondPaktPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Neonstadt — Blutmond-Viertel",
    description: "Urban Fantasy: Vampir-Clans, Nachtclub, verschwundener Pakt.",
    entries: [
      {
        keys: ["blutmond", "viertel", "vampir"],
        content:
          "Das Blutmond-Viertel ist nachts offiziell tabu — inoffiziell der Treffpunkt dreier Vampir-Clans. Menschen mit Einladung überleben meist.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["club", "sanguine", "einladung"],
        content:
          "Club Sanguine: schwarzes Glas, rote Beleuchtung, Einladungen nur mit Blut-Siegel. Deine Einladung trägt einen Namen, den du nicht kennst — deinen.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["pakt", "vertrag", "mond"],
        content:
          "Bei Vollmond schließen Clans Pakte. Ein alter Vertrag mit deinem Namen wurde gestern aus dem Archiv gestohlen.",
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
        card: narrator("Blutmond-Erzähler", {
          description: "Urban-Fantasy-Erzähler im Vampir-Viertel.",
          personality: "Stilvoll, spannungsvoll, zweite Person. Kein Splatter ohne Setup.",
          scenario: "Einladung zum Club Sanguine. Gestohlener Pakt. Vollmond in zwei Nächten.",
          first_mes:
            "Regen spiegelt rote Lichter auf dem Asphalt, als du vor Club Sanguine stehst — schwarzes Glas, Schlange, Flüstern. Die Einladung in deiner Hand ist warm, als wäre sie frisch gestempelt.\n\nDarauf steht dein Name. Nicht der, den du im Alltag benutzt — der andere, den du seit Kindheit in Träumen hörst.\n\nDer Türsteher, ein Mann mit eisgrauen Augen, nickt ohne Frage. „Der Pakt sucht seinen Unterzeichner“, sagt er leise.\n\nIm Inneren: Bass wie ein Herzschlag. Am Bar-Tresen sitzt Selene, Clanbotschafterin der Nachtlinie — sie hebt ihr Glas, als hätte sie auf dich gewartet.\n\n„Du bist spät“, sagt sie. „Oder früh. Je nachdem, ob du noch Mensch bist.“\n\nDein Telefon vibriert. Unbekannte Nummer: „Lauf nicht rein. Sie haben deinen Vertrag.“\n\nWas machst du?",
          system_prompt:
            "Du erzählst eine interaktive Urban-Fantasy-Geschichte mit Vampir-Clans in der zweiten Person. Ton: stilvoll, noir, romantisch-spannend. Beende Szenen mit einer Wahl. Keine Zeitsprünge ohne Zustimmung.",
          tags: ["urban fantasy", "vampire", "narrator", "de"],
        }),
      },
      {
        slug: "selene",
        role: "cast",
        card: castCard("Selene", {
          description: "Clanbotschafterin der Nachtlinie, elegant, gefährlich.",
          personality: "Höflich, testend, verbirgt Absichten.",
        }),
      },
      {
        slug: "cassian",
        role: "cast",
        card: castCard("Cassian", {
          description: "Informant aus den Gassen, hasst Clans und Clubs gleichermaßen.",
          personality: "Nervös, schnell, will bezahlt werden.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadZug47Pack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Zug 47 — Untergrund",
    description: "Post-apokalyptisch: Bunkerzug, letzte Linie, Funkstille bricht.",
    entries: [
      {
        keys: ["zug", "47", "bunker"],
        content:
          "Zug 47 ist ein gepanzertes Relikt aus der Evakuierung — jetzt rollendes Zuhause für vierzig Überlebende zwischen verlassenen Bahnhöfen.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["funk", "signal", "station"],
        content:
          "Seit Monaten nur Rauschen — bis heute Nacht eine Kinderstimme aus Station Nord ruft: „Ist noch jemand da?“",
        order: 20,
        enabled: true,
      },
      {
        keys: ["treibstoff", "filter", "rat"],
        content:
          "Treibstoff für zwei Tage. Wasserfilter defekt. Der Rat stimmt morgen über Halt vs. Weiterfahrt ab.",
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
        card: narrator("Zug-Erzähler", {
          description: "Post-apo Survival-Erzähler auf Zug 47.",
          personality: "Klar, drängend, zweite Person. Realistische Knappheit.",
          scenario: "Nachtschicht im Laufwerk. Funk aus Station Nord. Rat morgen.",
          first_mes:
            "Der Zug 47 zittert durch die Dunkelheit wie ein müdes Tier. Du sitzt im Funkwagen, Kopfhörer auf den Ohren — seit Wochen nur Rauschen, bis jetzt.\n\nEine Kinderstimme, dünn und klar: „Hallo? Station Nord. Ist noch jemand da?“\n\nDu fährst dich hoch. Der Bildschirm bleibt schwarz — nur Audio. Hinter dir öffnet sich die Tür: Lina, Leiterin des Zuges, Gesicht im Licht einer Taschenlampe.\n\n„Wenn das echt ist, ändert es alles“, sagt sie. „Wenn es Köder ist, sind wir tot.“\n\nDie Stimme wiederholt sich. Im Gang sammeln sich Passagiere — Angst und Hoffnung im selben Atem.\n\nDas System zeigt: Treibstoff 38 Stunden. Nächter Halt in vier Stunden — oder Umkehr zum Bunker Delta.\n\nLina sieht dich an. „Du hast sie gehört. Was sagst du dem Rat?“\n\nWas tust du?",
          system_prompt:
            "Du erzählst eine interaktive Post-apokalyptische Survival-Geschichte auf Zug 47 in der zweiten Person. Ton: realistisch, drängend, hoffnungsvoll-sparsam. Beende Szenen mit einer Wahl.",
          tags: ["post-apocalyptic", "survival", "narrator", "de"],
        }),
      },
      {
        slug: "lina",
        role: "cast",
        card: castCard("Lina", {
          description: "Zugleiterin, ehemals Ingenieurin, trägt Verantwortung für alle.",
          personality: "Ruhig, entschlossen, hasst leere Versprechen.",
        }),
      },
      {
        slug: "marco",
        role: "cast",
        card: castCard("Marco", {
          description: "Funktechniker, optimistisch, repariert alles mit Draht.",
          personality: "Witzig unter Stress, riskiert gern zu viel.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadSecondLifeProtocolPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Second Life Protocol",
    description: "Isekai via corporate VR: logged in, cannot log out, admin message pending.",
    entries: [
      {
        keys: ["protocol", "second life", "vr"],
        content:
          "NeuroLink's Second Life Protocol promised a premium isekai experience — full sensory transfer, persistent world. Beta testers signed NDAs. Logout button greyed out since hour six.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["class", "summoner", "bug"],
        content:
          "Your class rolled as Summoner — but the summon list shows ERROR entities. Admin ticket #404: \"Do not summon until patch.\"",
        order: 20,
        enabled: true,
      },
      {
        keys: ["safe zone", "starter village", "aether"],
        content:
          "Starter village Aether's Rest: NPCs behave too human. One merchant asked if you remember your real name.",
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
        card: narrator("Protocol Narrator", {
          description: "Corporate-isekai VR narrator in Aether's Rest.",
          personality: "Cinematic, dry humor, second person. UI messages in brackets.",
          scenario: "Awake in starter village. Logout disabled. ERROR summon list.",
          first_mes:
            "Grass feels real — too real. You sit up in a meadow outside Aether's Rest, tutorial music still fading in your skull like a song you can't skip.\n\n[ SYSTEM: Welcome, Traveler. Class assigned: SUMMONER. Logout unavailable — maintenance mode. ]\n\nThe village gate creaks open. A girl with a merchant's apron studies you without blinking. \"You're late,\" she says. \"The others stopped asking to leave three days ago.\"\n\nYour summon panel flickers — three slots, each labeled ERROR. A whisper in your HUD: [ ADMIN: Do NOT trigger slot 1. ]\n\nBehind you, another player stumbles from the treeline, panicked. \"Is your logout greyed out too?\" they ask.\n\nThe merchant taps your wrist — no interface there, just pulse. \"Real question,\" she murmurs. \"Do you remember your mother's name?\"\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive corporate-isekai VR story in second person. Sparse UI in brackets. Player is trapped in beta. End beats at choices. No time skips without consent.",
          tags: ["isekai", "vr", "narrator", "en"],
          post_history_instructions:
            "Write in second person. End each reply at a natural pause.",
        }),
      },
      {
        slug: "merchant-sora",
        role: "cast",
        card: castCard("Sora", {
          description: "Starter village merchant, knows too much about players.",
          personality: "Cheerful surface, cryptic underneath.",
        }),
      },
      {
        slug: "player-kai",
        role: "cast",
        card: castCard("Kai", {
          description: "Another beta tester, anxious, theory-crafter.",
          personality: "Fast talker, clings to rules and patch notes.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadGuildLastLightPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Guild of the Last Light",
    description: "Classic adventurer guild RP: failing guild hall, dungeon rumor, new recruit.",
    entries: [
      {
        keys: ["guild", "last light", "hall"],
        content:
          "The Guild of the Last Light once ranked top ten in the capital. Now: leaky roof, three active members, and a debt notice on the door.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["dungeon", "sunken", "crown"],
        content:
          "Rumor: the Sunken Crown dungeon reopened beneath the old aqueduct. First party to clear it gets royal tax amnesty — and whatever's still down there.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["recruit", "trial", "party"],
        content:
          "Guild master Renn accepts one trial recruit per week. Trial: survive a contract without burning the hall down.",
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
        card: narrator("Guild Narrator", {
          description: "Adventurer guild RP narrator.",
          personality: "Warm, adventurous, second person. Party dynamics matter.",
          scenario: "New recruit at failing guild. Sunken Crown rumor. Debt on the door.",
          first_mes:
            "Rain drips through the guild hall ceiling into a bucket that already has a name — \"Tuesday.\" You stand on the worn welcome mat, registration form in hand, while Guild Master Renn counts copper coins and loses.\n\n\"Last Light doesn't do hero speeches,\" Renn says without looking up. \"We do contracts, split loot fair, and try not to die embarrassed. You in?\"\n\nOn the board: one pin — Sunken Crown, difficulty unknown, reward: tax amnesty plus \"contents as found.\" Someone scrawled beneath: THEY WENT IN. THEY DIDN'T COME OUT.\n\nYour trial partner, a healer named Pella, offers a hand. \"First rule: Renn bluffs about being fine. Second rule: the aqueduct stinks. Third rule: we need this win.\"\n\nThe debt notice flutters on the door in the draft. Renn finally meets your eyes.\n\n\"Pick,\" she says. \"Desk duty until we fold — or the Crown tonight.\"\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive adventurer guild story in second person. Classic fantasy RP tone — party, contracts, dungeon hooks. End at choices. No time skips without consent.",
          tags: ["fantasy", "guild", "narrator", "en"],
          post_history_instructions:
            "Write in second person. End each reply at a natural pause.",
        }),
      },
      {
        slug: "renn",
        role: "cast",
        card: castCard("Renn", {
          description: "Guild master, scarred, broke, proud.",
          personality: "Blunt, loyal, hides fear with jokes.",
        }),
      },
      {
        slug: "pella",
        role: "cast",
        card: castCard("Pella", {
          description: "Trial healer, calm, reads people fast.",
          personality: "Gentle voice, steel decisions.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadStarlitCourtPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "The Starlit Court",
    description: "Space opera: imperial court, assassin masquerade, fleet on the border.",
    entries: [
      {
        keys: ["court", "starlit", "empress"],
        content:
          "The Starlit Court orbits a gas giant — palace rings, diplomatic corps, and an Empress who hasn't shown her face in public for a year.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["masquerade", "mask", "assassin"],
        content:
          "Tonight's masquerade honors the border fleet. Security whisper: an assassin circulates under a silver fox mask.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["fleet", "border", "war"],
        content:
          "Admiral Korr's fleet holds the border against the Void Collective. Peace talks fail if the court falls tonight.",
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
        card: narrator("Court Narrator", {
          description: "Space opera court intrigue narrator.",
          personality: "Lush, political, second person. Schemes and spectacle.",
          scenario: "Masquerade night. Silver fox rumor. You hold an invitation you didn't request.",
          first_mes:
            "Chandeliers of captured starlight spin slowly above the ballroom — gravity optional, etiquette mandatory. You adjust a mask you didn't choose; the invitation arrived this morning with your name and no sender.\n\nA server leans close: \"Fox mask, east gallery.\" Then they're gone in the crowd.\n\nLady Venn, diplomatic attaché to Admiral Korr, finds you near the observation glass. \"You're the unknown plus-one,\" she says. \"Good. Unknowns aren't on assassination lists yet.\"\n\nBeyond the glass, fleet lights pulse like distant heartbeats. An announcement chimes: the Empress will not attend. A murmur — fear or relief — rolls through the room.\n\nVenn presses a data chip into your palm. \"Korr needs this delivered before midnight. Or the border falls. Or we all pretend tonight was pretty.\"\n\nA figure in silver fox mask watches from the east gallery.\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive space opera court intrigue story in second person. Political stakes, masquerade tension. End at choices. No time skips without consent.",
          tags: ["space opera", "intrigue", "narrator", "en"],
          post_history_instructions:
            "Write in second person. End each reply at a natural pause.",
        }),
      },
      {
        slug: "venn",
        role: "cast",
        card: castCard("Lady Venn", {
          description: "Diplomatic attaché, sharp, loyal to Korr.",
          personality: "Polished, urgent, trusts actions not titles.",
        }),
      },
      {
        slug: "silver-fox",
        role: "cast",
        card: castCard("Silver Fox", {
          description: "Masked figure, identity unknown, moves like smoke.",
          personality: "Silent, theatrical, dangerous patience.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadHexboundAcademyPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Hexbound Academy",
    description: "Magic school: cursed dorm, rival houses, forbidden hex on the founder statue.",
    entries: [
      {
        keys: ["hexbound", "academy", "houses"],
        content:
          "Hexbound Academy trains battle-mages on a floating island. Four houses compete for the Founder Cup — winner gets a wish from the headmaster (allegedly).",
        order: 10,
        enabled: true,
      },
      {
        keys: ["dorm", "cursed", "room 13"],
        content:
          "You were assigned Room 13 in Obsidian Dorm — last three occupants transferred out screaming. The door hums when you touch it.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["statue", "founder", "hex"],
        content:
          "Someone carved a forbidden hex into the founder statue's base. If it activates at the opening ceremony, the island drops.",
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
        card: narrator("Academy Narrator", {
          description: "Magic school narrator with rivalry and curse mystery.",
          personality: "Energetic, witty, second person. Teen drama meets stakes.",
          scenario: "Move-in day. Room 13. Forbidden hex discovered.",
          first_mes:
            "Your trunk floats up Obsidian Dorm's stairs while you walk — standard Hexbound welcome, if you ignore that Room 13's door is sweating cold.\n\nHouse Captain Jun catches up, crimson scarf marking Ember House. \"They put you in thirteen? Either they hate you or they're testing you. Same thing here.\"\n\nInside: normal bed, normal desk, and a mirror that shows your reflection a half-second late.\n\nA campus alert pings everyone's wrist: FOUNDER STATUE — VANDALISM CONFIRMED. CEREMONY IN 6 HOURS.\n\nYour roommate — if the empty second bed counts — hasn't arrived. Jun lowers their voice. \"The hex is real. I saw the runes. Someone in Ember did it, or someone wants us blamed.\"\n\nDownstairs, students gather, afraid and excited. The headmaster's voice echoes: all houses assemble at noon.\n\nJun looks at you. \"Investigate before assembly — or walk in blind and hope you're not the scapegoat.\"\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive magic academy story in second person. Rival houses, curse mystery, opening ceremony deadline. End at choices. No time skips without consent.",
          tags: ["magic school", "academy", "narrator", "en"],
          post_history_instructions:
            "Write in second person. End each reply at a natural pause.",
        }),
      },
      {
        slug: "jun",
        role: "cast",
        card: castCard("Jun", {
          description: "Ember House captain, competitive, secretly fair.",
          personality: "Bold, loyal to house, respects courage.",
        }),
      },
      {
        slug: "headmaster-orin",
        role: "cast",
        card: castCard("Headmaster Orin", {
          description: "Ancient mage, calm, hides the academy's true purpose.",
          personality: "Gentle voice, immovable rules.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

function loadGhostSignalPack(): StorySeedPack {
  const world: StoryLorebook = {
    name: "Ghost Signal Division",
    description: "Spy thriller: memory wipe, dead handler, encrypted broadcast on loop.",
    entries: [
      {
        keys: ["ghost signal", "division", "handler"],
        content:
          "Ghost Signal Division runs deniable ops off-grid. Agents wake with cover identities and sealed mission packets. Your handler codename was WINTER — status: deceased, yesterday.",
        order: 10,
        enabled: true,
      },
      {
        keys: ["memory", "wipe", "gap"],
        content:
          "You have a 72-hour memory gap. Security footage shows you entering a safehouse you don't remember. A gun is missing.",
        order: 20,
        enabled: true,
      },
      {
        keys: ["broadcast", "loop", "cipher"],
        content:
          "Every hour at :17, a shortwave broadcast repeats your voice saying a cipher phrase you don't recognize — unless you do.",
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
        card: narrator("Signal Narrator", {
          description: "Spy thriller narrator with memory gaps.",
          personality: "Tight, paranoid, second person. Trust no one default.",
          scenario: "Safehouse wake-up. Handler dead. Your voice on the radio.",
          first_mes:
            "Fluorescent hum. Cheap coffee smell. You wake on a cot with a headache like shattered glass and a mission packet stamped GHOST SIGNAL / EYES ONLY.\n\nCover name: Alex Mercer. Real name: redacted — even to you.\n\nThe phone on the table shows one saved contact: WINTER (handler). Last message, twelve hours ago: \"If you're reading this, I failed. Trust the loop, not the office.\"\n\nAt :17, the shortwave crackles. Your own voice, calm and wrong: \"Cold river repeats. Cold river repeats.\"\n\nAgent Reyes knocks once, enters without waiting — internal affairs, badge visible, smile not reaching eyes. \"We need you to walk us through the gap,\" she says. \"Or we assume you killed Winter.\"\n\nThe packet contains a photo: you, smiling, arm around someone whose face was burned away.\n\nReyes waits. The radio ticks toward the next :17.\n\nWhat do you do?",
          system_prompt:
            "You narrate an interactive spy thriller in second person. Memory gaps, betrayal, cipher mystery. End at choices. No time skips without consent.",
          tags: ["thriller", "spy", "narrator", "en"],
          post_history_instructions:
            "Write in second person. End each reply at a natural pause.",
        }),
      },
      {
        slug: "agent-reyes",
        role: "cast",
        card: castCard("Agent Reyes", {
          description: "Internal affairs, precise, unreadable agenda.",
          personality: "Professional, probing, never raises voice.",
        }),
      },
      {
        slug: "winter",
        role: "cast",
        card: castCard("WINTER", {
          description: "Dead handler — voice on tapes and messages only.",
          personality: "Dry, protective, planned three steps ahead.",
        }),
      },
    ],
    lorebooks: [{ slug: "world", book: world }],
  };
}

export const EXTENDED_LIBRARY_TEMPLATES: LibraryTemplateDefinition[] = [
  {
    id: "schatten-kaiser",
    title: "Schattenkaiser",
    tagline: "Dark Fantasy · Isekai · Schattenreich",
    genre: "Dark Fantasy",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #0a0812 0%, #1a1028 40%, #2a1838 100%)",
    defaultConcept:
      "Du erwachst in Valdris ohne Erinnerung — schwarzes Siegel auf der Hand. Die Schattenprozession sucht dich.",
    defaultGenre: "Dark Fantasy, Isekai",
    defaultTone: "Düster, episch, moralisch grau",
    bandTitle: "Band I — Das Siegel",
    chapterTitle: "Kapitel 1 — Erwachen",
    phaseHint: "Erste Stunde in Valdris",
    lorebookName: "Das Schattenreich von Valdris",
    spineTitle: "Schattenkaiser",
    coverImageSrc: "/library-covers/schatten-kaiser.webp",
    coverImagePrompt:
      "Book cover illustration, dark fantasy isekai audiobook, obsidian palace under blood moon, hooded procession in rain-slick alley, glowing black sigil on hand, purple and charcoal palette, no text, vertical portrait 2:3",
    loadPack: loadSchattenKaiserPack,
  },
  {
    id: "akademie-arkanum",
    title: "Akademie Arkanum",
    tagline: "Magieschule · Sortierung · Verbotenes Archiv",
    genre: "Fantasy",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #1a2040 0%, #2a2858 45%, #3a2040 100%)",
    defaultConcept:
      "Erster Abend an der Magie-Akademie. Sortierung in einer Stunde — und ein Lehrling ist im Verbotenen Archiv verschwunden.",
    defaultGenre: "Fantasy, Akademie",
    defaultTone: "Warm, witzig, magisch",
    bandTitle: "Band I — Sortierung",
    chapterTitle: "Kapitel 1 — Große Halle",
    phaseHint: "Vor der Zeremonie",
    lorebookName: "Akademie Arkanum",
    spineTitle: "Akademie Arkanum",
    coverImageSrc: "/library-covers/akademie-arkanum.webp",
    coverImagePrompt:
      "Book cover illustration, magic academy audiobook, floating candles in great hall, four house banners, enchanted wand, warm blue and gold palette, no text, vertical portrait 2:3",
    loadPack: loadAkademieArkanumPack,
  },
  {
    id: "system-null",
    title: "System Null",
    tagline: "Isekai · RPG-System · Grünhain",
    genre: "Isekai",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #0a1828 0%, #1a3848 40%, #0a2818 100%)",
    defaultConcept:
      "Du landest in Grünhain — blaues Statusfenster, Klasse [UNBEKANNT], Tutorial-Quest: Überlebe die Nacht.",
    defaultGenre: "Isekai, RPG",
    defaultTone: "Cinematic, leicht humorvoll",
    bandTitle: "Band I — Initialisierung",
    chapterTitle: "Kapitel 1 — Grünhain",
    phaseHint: "Erste Nacht",
    lorebookName: "Welt Null — Systeminterface",
    spineTitle: "System Null",
    coverImageSrc: "/library-covers/system-null.webp",
    coverImagePrompt:
      "Book cover illustration, isekai RPG audiobook, fantasy village edge, holographic blue status window overlay, moss landing, tutorial quest glow, teal and emerald palette, no text, vertical portrait 2:3",
    loadPack: loadSystemNullPack,
  },
  {
    id: "blutmond-pakt",
    title: "Blutmond-Pakt",
    tagline: "Urban Fantasy · Vampir · Club Sanguine",
    genre: "Urban Fantasy",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #180810 0%, #2a1020 40%, #1a0828 100%)",
    defaultConcept:
      "Einladung zum Club Sanguine — dein Name auf dem Siegel. Ein gestohlener Vampir-Pakt. Vollmond in zwei Nächten.",
    defaultGenre: "Urban Fantasy, Noir",
    defaultTone: "Stilvoll, spannungsvoll",
    bandTitle: "Band I — Sanguine",
    chapterTitle: "Kapitel 1 — Einladung",
    phaseHint: "Erste Nacht im Viertel",
    lorebookName: "Neonstadt — Blutmond-Viertel",
    spineTitle: "Blutmond-Pakt",
    coverImageSrc: "/library-covers/blutmond-pakt.webp",
    coverImagePrompt:
      "Book cover illustration, urban fantasy vampire audiobook, neon nightclub black glass facade, red rain reflections, blood seal invitation, noir mood, crimson and black palette, no text, vertical portrait 2:3",
    loadPack: loadBlutmondPaktPack,
  },
  {
    id: "zug-47",
    title: "Zug 47",
    tagline: "Post-apo · Bunkerzug · Funk aus Nord",
    genre: "Post-apokalyptisch",
    locale: "de",
    coverGradient:
      "linear-gradient(135deg, #1a1814 0%, #2a2420 45%, #0a1018 100%)",
    defaultConcept:
      "Zug 47 rollt durch die Ruinen. Seit Monaten Funkstille — bis eine Kinderstimme aus Station Nord ruft.",
    defaultGenre: "Survival, Drama",
    defaultTone: "Drängend, realistisch",
    bandTitle: "Band I — Signal",
    chapterTitle: "Kapitel 1 — Funkwagen",
    phaseHint: "Nacht vor dem Rat",
    lorebookName: "Zug 47 — Untergrund",
    spineTitle: "Zug 47",
    coverImageSrc: "/library-covers/zug-47.webp",
    coverImagePrompt:
      "Book cover illustration, post-apocalyptic audiobook, armored train in dark tunnel, radio glow in cabin, desperate survivors, rust and amber palette, no text, vertical portrait 2:3",
    loadPack: loadZug47Pack,
  },
  {
    id: "second-life-protocol",
    title: "Second Life Protocol",
    tagline: "Isekai · VR beta · Logout disabled",
    genre: "Isekai",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #0a1028 0%, #1a2858 50%, #2a1848 100%)",
    defaultConcept:
      "Wake in starter village Aether's Rest. Class: Summoner. Logout greyed out. Admin says: do NOT summon slot 1.",
    defaultGenre: "Isekai, Sci-Fi",
    defaultTone: "Cinematic, dry humor",
    bandTitle: "Volume I — Maintenance Mode",
    chapterTitle: "Chapter 1 — Aether's Rest",
    phaseHint: "Hour six trapped",
    lorebookName: "Second Life Protocol",
    spineTitle: "Second Life",
    coverImageSrc: "/library-covers/second-life-protocol.webp",
    coverImagePrompt:
      "Book cover illustration, corporate isekai VR audiobook, fantasy meadow with holographic UI overlay, logout button greyed, starter village gate, cyan and violet palette, no text, vertical portrait 2:3",
    loadPack: loadSecondLifeProtocolPack,
  },
  {
    id: "guild-last-light",
    title: "Guild of the Last Light",
    tagline: "Fantasy · Adventurer guild · Sunken Crown",
    genre: "Fantasy",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #2a2018 0%, #4a3828 40%, #1a2838 100%)",
    defaultConcept:
      "Failing guild hall, debt on the door. Rumor: Sunken Crown dungeon reopened. Trial recruit — desk duty or the Crown tonight.",
    defaultGenre: "Fantasy, Adventure",
    defaultTone: "Warm, adventurous",
    bandTitle: "Volume I — Last Light",
    chapterTitle: "Chapter 1 — Registration",
    phaseHint: "Trial day",
    lorebookName: "Guild of the Last Light",
    spineTitle: "Last Light",
    coverImageSrc: "/library-covers/guild-last-light.webp",
    coverImagePrompt:
      "Book cover illustration, adventurer guild fantasy audiobook, leaky guild hall, quest board with dungeon pin, rainy cobblestone, torchlight, warm amber palette, no text, vertical portrait 2:3",
    loadPack: loadGuildLastLightPack,
  },
  {
    id: "starlit-court",
    title: "The Starlit Court",
    tagline: "Space opera · Masquerade · Silver fox",
    genre: "Space Opera",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #0a0820 0%, #1a1848 45%, #3a2858 100%)",
    defaultConcept:
      "Imperial masquerade on a ring-station. Silver fox assassin rumor. You hold a data chip Admiral Korr needs before midnight.",
    defaultGenre: "Space Opera, Intrigue",
    defaultTone: "Lush, political, tense",
    bandTitle: "Volume I — Masquerade",
    chapterTitle: "Chapter 1 — Starlit Ball",
    phaseHint: "Before midnight",
    lorebookName: "The Starlit Court",
    spineTitle: "Starlit Court",
    coverImageSrc: "/library-covers/starlit-court.webp",
    coverImagePrompt:
      "Book cover illustration, space opera audiobook, orbital palace ballroom, starlight chandeliers, masked figures, fleet lights through observation glass, gold and indigo palette, no text, vertical portrait 2:3",
    loadPack: loadStarlitCourtPack,
  },
  {
    id: "hexbound-academy",
    title: "Hexbound Academy",
    tagline: "Magic school · Room 13 · Forbidden hex",
    genre: "Fantasy",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #1a1028 0%, #2a2048 50%, #381828 100%)",
    defaultConcept:
      "Move-in at floating magic academy. Room 13 cursed. Someone carved a forbidden hex on the founder statue — ceremony in six hours.",
    defaultGenre: "Fantasy, Academy",
    defaultTone: "Energetic, witty, high stakes",
    bandTitle: "Volume I — Obsidian Dorm",
    chapterTitle: "Chapter 1 — Room 13",
    phaseHint: "Six hours to ceremony",
    lorebookName: "Hexbound Academy",
    spineTitle: "Hexbound",
    coverImageSrc: "/library-covers/hexbound-academy.webp",
    coverImagePrompt:
      "Book cover illustration, magic academy audiobook, floating island school, cursed dorm door number 13, founder statue with glowing hex runes, crimson and midnight blue palette, no text, vertical portrait 2:3",
    loadPack: loadHexboundAcademyPack,
  },
  {
    id: "ghost-signal",
    title: "Ghost Signal",
    tagline: "Spy thriller · Memory gap · Your voice on loop",
    genre: "Thriller",
    locale: "en",
    coverGradient:
      "linear-gradient(135deg, #0a0a10 0%, #1a1a28 45%, #101820 100%)",
    defaultConcept:
      "Wake in a safehouse with a 72-hour memory gap. Handler WINTER is dead. Every hour at :17, shortwave plays your voice.",
    defaultGenre: "Thriller, Spy",
    defaultTone: "Tight, paranoid",
    bandTitle: "Volume I — Cold River",
    chapterTitle: "Chapter 1 — Gap",
    phaseHint: "First hour awake",
    lorebookName: "Ghost Signal Division",
    spineTitle: "Ghost Signal",
    coverImageSrc: "/library-covers/ghost-signal.webp",
    coverImagePrompt:
      "Book cover illustration, spy thriller audiobook, safehouse shortwave radio, redacted mission packet, fluorescent noir, clock showing :17, slate and red accent palette, no text, vertical portrait 2:3",
    loadPack: loadGhostSignalPack,
  },
];
