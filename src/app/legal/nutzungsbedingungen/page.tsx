import { LegalDocNav } from "@/components/legal/LegalDocNav";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  LegalDisclaimer,
  LegalH2,
  LegalH3,
  LegalOl,
  LegalP,
  LegalUl,
} from "@/components/legal/LegalTypography";
import { brand } from "@/lib/brand";
import { siteLegal } from "@/lib/legal/siteLegal";

export const metadata = {
  title: `Nutzungsbedingungen — ${siteLegal.productName}`,
  description: `Nutzungsbedingungen für ${siteLegal.productName}`,
};

export default function NutzungsbedingungenPage() {
  const { productName, operatorName, contactEmail, websiteUrl, lastUpdated } =
    siteLegal;

  return (
    <LegalPageShell title="Nutzungsbedingungen">
      <LegalDocNav current="/legal/nutzungsbedingungen" />
      <p className="text-zinc-500">Stand: {lastUpdated}</p>

      <LegalH2>1. Geltungsbereich</LegalH2>
      <LegalP>
        Diese Nutzungsbedingungen regeln die Nutzung von {productName} (
        {websiteUrl}) in der geschlossenen Beta-Phase. Betreiber: {operatorName}.
      </LegalP>
      <LegalP>
        Mit der Nutzung nach Einladung und Login akzeptieren Sie diese Bedingungen.
        Wenn Sie nicht einverstanden sind, nutzen Sie die App nicht.
      </LegalP>

      <LegalH2>2. Leistungsbeschreibung</LegalH2>
      <LegalP>
        {productName} ermöglicht interaktive Text-Stories im Browser mit optionaler
        Sprachausgabe (Text-to-Speech). Funktionen umfassen u. a. Bibliotheks-Vorlagen,
        Chat mit KI-Modellen, Cast/Stimmen, Story-Hub und Cloud-Speicherung.
      </LegalP>
      <LegalP>
        Die Beta wird „wie besehen“ bereitgestellt. Funktionen können sich ändern,
        ausfallen oder eingeschränkt werden (Wartung, Limits, Kostenkontrolle).
      </LegalP>

      <LegalH2>3. Zugang</LegalH2>
      <LegalUl>
        <li>Zugang nur nach persönlicher Einladung und Registrierung</li>
        <li>Sie sind für die Geheimhaltung Ihrer Zugangsdaten verantwortlich</li>
        <li>Weitergabe des Accounts an Dritte ist untersagt</li>
        <li>Mindestalter: 16 Jahre (empfohlen); bei Minderjährigen nur mit Zustimmung der Erziehungsberechtigten</li>
      </LegalUl>

      <LegalH2>4. Nutzer-Inhalte & Verantwortung</LegalH2>
      <LegalP>
        Sie sind allein verantwortlich für alle Inhalte, die Sie eingeben, erzeugen,
        importieren oder speichern (Prompts, Story-Texte, Charakterkarten, Uploads).
      </LegalP>
      <LegalOl>
        <li>
          Nutzen Sie nur Inhalte, an denen Sie die erforderlichen Rechte haben (keine
          unbefugte Verwendung fremder Marken, Figuren oder urheberrechtlich
          geschützter Werke).
        </li>
        <li>
          Keine illegalen, gewaltverherrlichenden, diskriminierenden oder
          belästigenden Inhalte.
        </li>
        <li>
          Kein unbefugtes Nachahmen realer Personen über Stimm- oder Text-Imitation
          (Voice Cloning ohne Einwilligung).
        </li>
        <li>Kein automatisiertes Auslesen, Scraping oder Missbrauch der APIs.</li>
      </LegalOl>
      <LegalP>
        Wir können Inhalte oder Accounts bei Verstößen sperren oder löschen.
      </LegalP>

      <LegalH2>5. Bibliothek ({brand.libraryName})</LegalH2>
      <LegalP>
        Die in der App bereitgestellten Story-Vorlagen („{brand.libraryName}“) sind vom
        Betreiber erstellt. Sie dürfen sie innerhalb der App für private Beta-Nutzung
        verwenden und remixen. Eine Weiterverbreitung, Veröffentlichung oder
        kommerzielle Nutzung außerhalb der App bedarf der vorherigen Zustimmung des
        Betreibers.
      </LegalP>

      <LegalH2>6. Künstliche Intelligenz & Sprachausgabe</LegalH2>
      <LegalP>
        Texte werden über Drittanbieter (OpenRouter / Modellanbieter) erzeugt. Audio
        kann über Drittanbieter (z. B. ElevenLabs) erzeugt werden. Wir übernehmen
        keine Gewähr für Richtigkeit, Qualität oder Rechtskonformität der Ausgaben.
      </LegalP>
      <LegalP>
        Sie dürfen KI-Ausgaben nicht als menschliche Beratung oder als offizielle
        Aussage des Betreibers darstellen.
      </LegalP>

      <LegalH2>7. Tarife, Limits & Kosten</LegalH2>
      <LegalP>
        In der Beta können Tarife (free, beta, pro) mit Limits für KI- und
        TTS-Nutzung gelten. Der Betreiber trägt in der Beta die Kosten der
        Drittanbieter-Schnittstellen; Limits dienen dem Missbrauchsschutz.
      </LegalP>
      <LegalP>
        Eine spätere kostenpflichtige Nutzung würde gesondert angekündigt und
        vertraglich geregelt werden.
      </LegalP>

      <LegalH2>8. Verfügbarkeit & Haftung</LegalH2>
      <LegalP>
        Wir bemühen uns um Verfügbarkeit, garantieren sie aber nicht. Geplante oder
        ungeplante Ausfälle sind möglich.
      </LegalP>
      <LegalP>
        Haftung des Betreibers: unbeschränkt bei Vorsatz und grober Fahrlässigkeit
        sowie bei Schäden aus der Verletzung von Leben, Körper oder Gesundheit. Im
        Übrigen nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf den
        typischerweise vorhersehbaren Schaden. Die Haftung für Datenverlust ist auf den
        typischen Wiederherstellungsaufwand beschränkt, wenn Sie keine angemessenen
        Sicherungen vorgenommen haben.
      </LegalP>

      <LegalH2>9. Beendigung</LegalH2>
      <LegalUl>
        <li>Sie können die Nutzung jederzeit einstellen.</li>
        <li>
          Wir können den Zugang bei Verstößen oder zum Beta-Ende beenden; auf Wunsch
          löschen wir Account-Daten, soweit gesetzlich zulässig.
        </li>
        <li>Löschanfragen: {contactEmail}</li>
      </LegalUl>

      <LegalH2>10. Änderungen der Bedingungen</LegalH2>
      <LegalP>
        Wir können diese Bedingungen mit Wirkung für die Zukunft anpassen. Wesentliche
        Änderungen teilen wir in der App oder per E-Mail mit. Die weitere Nutzung gilt
        als Zustimmung, sofern Sie nicht widersprechen.
      </LegalP>

      <LegalH2>11. Schlussbestimmungen</LegalH2>
      <LegalP>Es gilt das Recht der Bundesrepublik Deutschland.</LegalP>
      <LegalP>
        Gerichtsstand für Kaufleute und juristische Personen ist — soweit zulässig —
        der Sitz des Betreibers; für Verbraucher gelten die gesetzlichen Zuständigkeiten.
      </LegalP>
      <LegalP>
        Sollten einzelne Klauseln unwirksam sein, bleibt die Wirksamkeit der übrigen
        Regelungen unberührt.
      </LegalP>

      <LegalH3>Kontakt</LegalH3>
      <LegalP>
        {operatorName} —{" "}
        <a href={`mailto:${contactEmail}`} className="text-accent hover:underline">
          {contactEmail}
        </a>
      </LegalP>

      <LegalDisclaimer />
    </LegalPageShell>
  );
}
