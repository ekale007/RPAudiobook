import { LegalDocNav } from "@/components/legal/LegalDocNav";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  LegalDisclaimer,
  LegalH2,
  LegalH3,
  LegalP,
  LegalUl,
} from "@/components/legal/LegalTypography";
import { siteLegal, thirdPartyLegal } from "@/lib/legal/siteLegal";

export const metadata = {
  title: "Datenschutz — HörbuchKI",
  description: "Datenschutzerklärung für HörbuchKI (DSGVO)",
};

export default function DatenschutzPage() {
  const { productName, operatorName, contactEmail, websiteUrl, lastUpdated } =
    siteLegal;

  return (
    <LegalPageShell title="Datenschutz">
      <LegalDocNav current="/legal/datenschutz" />
      <p className="text-zinc-500">Stand: {lastUpdated}</p>

      <LegalH2>1. Verantwortlicher</LegalH2>
      <LegalP>
        Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO):
        <br />
        <strong className="text-zinc-200">{operatorName}</strong> ({productName})
        <br />
        E-Mail:{" "}
        <a href={`mailto:${contactEmail}`} className="text-accent hover:underline">
          {contactEmail}
        </a>
      </LegalP>

      <LegalH2>2. Überblick</LegalH2>
      <LegalP>
        {productName} ist eine webbasierte Anwendung für interaktive Geschichten mit
        optionaler Sprachausgabe. In der geschlossenen Beta verarbeiten wir
        personenbezogene Daten, um Accounts zu führen, Stories zu speichern, KI-Texte
        zu erzeugen und — je nach Einstellung — Audio zu erzeugen.
      </LegalP>
      <LegalP>
        Diese Erklärung orientiert sich an den Informationspflichten nach Art. 13 und
        14 DSGVO sowie an gängigen Mustern für SaaS- und KI-Anwendungen (vgl. z. B.
        strukturierte Gliederungen bei{" "}
        <a
          href="https://www.e-recht24.de/muster-datenschutzerklaerung.html"
          className="text-accent hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          eRecht24
        </a>
        ,{" "}
        <a
          href="https://termly.io/de/ressourcen/vorlagen/app-datenschutzerklarung/"
          className="text-accent hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Termly (App)
        </a>
        ). Der Text ist auf unser konkretes Produkt zugeschnitten.
      </LegalP>

      <LegalH2>3. Welche Daten wir verarbeiten</LegalH2>
      <LegalH3>3.1 Account & Authentifizierung</LegalH3>
      <LegalUl>
        <li>E-Mail-Adresse, Passwort (gehasht beim Anbieter Supabase Auth)</li>
        <li>Technische Session-Daten (Login-Status, Tokens)</li>
        <li>Optional: Anzeigename im Profil</li>
        <li>Tarif (free / beta / pro) und Nutzungslimits</li>
      </LegalUl>

      <LegalH3>3.2 Story-Inhalte & App-Nutzung</LegalH3>
      <LegalUl>
        <li>Story-Titel, Einstellungen, Charakterkarten, Lore, Chat-Verläufe</li>
        <li>Generierte Zusammenfassungen (Memory), Pins, Plot-Status</li>
        <li>Pfade zu gespeicherten Audio-Dateien (TTS), sofern aktiviert</li>
        <li>Verbrauchsmetadaten (geschätzte LLM-/TTS-Kosten, Zeitstempel, Modell-ID)</li>
      </LegalUl>

      <LegalH3>3.3 Technische Zugriffsdaten</LegalH3>
      <LegalUl>
        <li>IP-Adresse, Browser-/Geräteinformationen in Server- und CDN-Logs</li>
        <li>Fehler- und Sicherheitsprotokolle der Hosting-Anbieter</li>
      </LegalUl>

      <LegalH3>3.4 Lokale Speicherung im Browser</LegalH3>
      <LegalUl>
        <li>
          <strong className="text-zinc-200">localStorage:</strong> z. B. TTS-Einstellungen,
          Onboarding-Status, optional OpenRouter-API-Key (nur auf dem Gerät, wenn vom
          Nutzer eingetragen — nicht für Server-LLM in der Beta)
        </li>
        <li>
          <strong className="text-zinc-200">PWA-Cache:</strong> App-Shell für Offline-Laden
          der Oberfläche (keine Story-Synchronisation ohne Netz)
        </li>
        <li>
          <strong className="text-zinc-200">Cookies:</strong> Session-Cookies für Login
          (Supabase). Kein Werbe-Tracking durch uns.
        </li>
      </LegalUl>

      <LegalH2>4. Zwecke und Rechtsgrundlagen</LegalH2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-surface-border text-zinc-400">
              <th className="py-2 pr-3 font-medium">Verarbeitung</th>
              <th className="py-2 pr-3 font-medium">Zweck</th>
              <th className="py-2 font-medium">Rechtsgrundlage</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            <tr className="border-b border-surface-border/60">
              <td className="py-2 pr-3 align-top">Account, Stories speichern</td>
              <td className="py-2 pr-3 align-top">Bereitstellung der App</td>
              <td className="py-2 align-top">Art. 6 Abs. 1 lit. b DSGVO</td>
            </tr>
            <tr className="border-b border-surface-border/60">
              <td className="py-2 pr-3 align-top">KI-Chat (OpenRouter)</td>
              <td className="py-2 pr-3 align-top">Story-Antworten erzeugen</td>
              <td className="py-2 align-top">Art. 6 Abs. 1 lit. b DSGVO</td>
            </tr>
            <tr className="border-b border-surface-border/60">
              <td className="py-2 pr-3 align-top">TTS (ElevenLabs / ggf. Qwen)</td>
              <td className="py-2 pr-3 align-top">Sprachausgabe</td>
              <td className="py-2 align-top">Art. 6 Abs. 1 lit. b DSGVO</td>
            </tr>
            <tr className="border-b border-surface-border/60">
              <td className="py-2 pr-3 align-top">Limits, Missbrauchsprävention</td>
              <td className="py-2 pr-3 align-top">Kostenkontrolle, Stabilität</td>
              <td className="py-2 align-top">Art. 6 Abs. 1 lit. f DSGVO</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 align-top">Server-Logs</td>
              <td className="py-2 pr-3 align-top">Betrieb & Sicherheit</td>
              <td className="py-2 align-top">Art. 6 Abs. 1 lit. f DSGVO</td>
            </tr>
          </tbody>
        </table>
      </div>

      <LegalH2>5. Empfänger & Auftragsverarbeiter</LegalH2>
      <LegalP>
        Wir setzen spezialisierte Dienstleister ein (Auftragsverarbeitung nach Art. 28
        DSGVO, soweit anwendbar). Deren Datenschutzerklärungen gelten ergänzend:
      </LegalP>
      <LegalUl>
        <li>
          <strong className="text-zinc-200">Supabase</strong> — Datenbank, Auth,
          Datei-Speicher (
          <a
            href={thirdPartyLegal.supabase}
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Datenschutz Supabase
          </a>
          ). Region des Projekts bitte im Supabase-Dashboard prüfen (EU-Region
          empfohlen).
        </li>
        <li>
          <strong className="text-zinc-200">Vercel</strong> — Hosting der Web-App (
          <a
            href={thirdPartyLegal.vercel}
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Datenschutz Vercel
          </a>
          ).
        </li>
        <li>
          <strong className="text-zinc-200">OpenRouter</strong> — Weiterleitung von
          Chat-Prompts an KI-Modellanbieter (
          <a
            href={thirdPartyLegal.openrouter}
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Datenschutz OpenRouter
          </a>
          ). Ihre Story-Texte können in die USA oder andere Drittländer übermittelt
          werden, abhängig vom gewählten Modell.
        </li>
        <li>
          <strong className="text-zinc-200">ElevenLabs</strong> — Cloud-TTS, sofern in
          den Einstellungen gewählt (
          <a
            href={thirdPartyLegal.elevenlabs}
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Datenschutz ElevenLabs
          </a>
          ).
        </li>
      </LegalUl>
      <LegalP>
        Lokale TTS (z. B. auf dem PC des Betreibers) verarbeitet Daten nur lokal und
        wird in der gehosteten Beta in der Regel nicht für Endnutzer bereitgestellt.
      </LegalP>

      <LegalH2>6. KI-Verarbeitung (besonderer Hinweis)</LegalH2>
      <LegalP>
        Wenn Sie im Chat schreiben oder Story-Inhalte generieren, werden Texte an
        OpenRouter und von dort an den jeweils gewählten Modellanbieter übermittelt.
        Verarbeiten Sie keine besonderen Kategorien personenbezogener Daten (Art. 9
        DSGVO) und keine fremden geschützten Werke ohne Berechtigung in Prompts.
      </LegalP>
      <LegalP>
        KI-Ausgaben können unzutreffend oder unangemessen sein. Prüfen Sie Inhalte vor
        dem Teilen oder Veröffentlichen.
      </LegalP>

      <LegalH2>7. Drittlandübermittlung</LegalH2>
      <LegalP>
        Durch Supabase (je nach Region), Vercel, OpenRouter und ElevenLabs kann eine
        Übermittlung in Länder außerhalb des EWR erfolgen (insbesondere USA). Soweit
        erforderlich, stützen Anbieter Übermittlungen u. a. auf Standardvertragsklauseln
        (SCC). Details entnehmen Sie den verlinkten Anbieter-Datenschutzerklärungen.
      </LegalP>

      <LegalH2>8. Speicherdauer</LegalH2>
      <LegalUl>
        <li>
          Account- und Story-Daten: bis zur Löschung durch Sie oder bis zur Löschung
          des Accounts auf Anfrage
        </li>
        <li>Verbrauchsprotokoll (Beta): für Auswertung der Betaphase, danach Löschung oder Anonymisierung</li>
        <li>Server-Logs beim Hosting-Anbieter: gemäß dessen Aufbewahrungsfristen (typisch wenige Wochen)</li>
      </LegalUl>

      <LegalH2>9. Ihre Rechte</LegalH2>
      <LegalP>Sie haben gegenüber uns insbesondere folgende Rechte:</LegalP>
      <LegalUl>
        <li>Auskunft (Art. 15 DSGVO)</li>
        <li>Berichtigung (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen (Art. 21 DSGVO)</li>
        <li>
          Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO), z. B. bei der für Ihren
          Wohnsitz zuständigen Landesbehörde
        </li>
      </LegalUl>
      <LegalP>
        Anfragen richten Sie an{" "}
        <a href={`mailto:${contactEmail}`} className="text-accent hover:underline">
          {contactEmail}
        </a>
        . In der App können Sie Stories löschen; Account-Löschung koordinieren wir per
        E-Mail.
      </LegalP>

      <LegalH2>10. Pflicht zur Bereitstellung</LegalH2>
      <LegalP>
        Für die Nutzung der Beta ist die Bereitstellung von Account-Daten erforderlich.
        Ohne diese Daten kann kein Zugang gewährt werden.
      </LegalP>

      <LegalH2>11. Änderungen</LegalH2>
      <LegalP>
        Wir passen diese Datenschutzerklärung an, wenn sich die App oder Rechtslage
        ändert. Die aktuelle Fassung ist unter {websiteUrl}/legal/datenschutz abrufbar.
      </LegalP>

      <LegalDisclaimer />
    </LegalPageShell>
  );
}
