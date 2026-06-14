import { LegalDocNav } from "@/components/legal/LegalDocNav";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  LegalDisclaimer,
  LegalH2,
  LegalH3,
  LegalP,
  LegalUl,
} from "@/components/legal/LegalTypography";
import { brand } from "@/lib/brand";
import { siteLegal } from "@/lib/legal/siteLegal";

export const metadata = {
  title: `Impressum — ${siteLegal.productName}`,
  description: `Anbieterkennzeichnung nach § 5 DDG für ${siteLegal.productName}`,
};

export default function ImpressumPage() {
  const {
    productName,
    operatorName,
    contactEmail,
    postalAddress,
    country,
    serviceDescription,
    websiteUrl,
    lastUpdated,
  } = siteLegal;

  return (
    <LegalPageShell title="Impressum">
      <LegalDocNav current="/legal/impressum" />
      <p className="text-zinc-500">Stand: {lastUpdated}</p>

      <LegalH2>Angaben gemäß § 5 DDG</LegalH2>
      <LegalP>
        <strong className="text-zinc-200">{operatorName}</strong>
        <br />
        {serviceDescription}
        <br />
        {country}
        {postalAddress ? (
          <>
            <br />
            {postalAddress}
          </>
        ) : null}
      </LegalP>

      <LegalH2>Kontakt</LegalH2>
      <LegalP>
        E-Mail:{" "}
        <a href={`mailto:${contactEmail}`} className="text-accent hover:underline">
          {contactEmail}
        </a>
      </LegalP>
      {!postalAddress ? (
        <LegalP className="text-zinc-400">
          Eine ladungsfähige Postanschrift wird auf berechtigte Anfrage per E-Mail
          unverzüglich mitgeteilt (z. B. für behördliche oder gerichtliche Zustellung).
        </LegalP>
      ) : null}

      <LegalH2>Verantwortlich für den Inhalt</LegalH2>
      <LegalP>
        Verantwortlich für die eigenen Inhalte der Plattform (Bibliotheks-Vorlagen,
        Texte der Website): {operatorName}.
      </LegalP>

      <LegalH2>Online-Angebot</LegalH2>
      <LegalP>
        {productName} — {websiteUrl}
      </LegalP>
      <LegalP>
        Geschlossene Beta: Zugang nur nach Einladung. Es wird derzeit kein entgeltliches
        Abonnement über die App abgeschlossen.
      </LegalP>

      <LegalH2>Streitbeilegung</LegalH2>
      <LegalP>
        Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor
        einer Verbraucherschlichtungsstelle teilzunehmen.
      </LegalP>

      <LegalH3>EU-Streitbeilegung (Online)</LegalH3>
      <LegalP>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
        bereit:{" "}
        <a
          href="https://ec.europa.eu/consumers/odr/"
          className="text-accent hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse finden Sie oben.
      </LegalP>

      <LegalH2>Haftungshinweis</LegalH2>
      <LegalUl>
        <li>
          <strong className="text-zinc-200">Eigene Inhalte:</strong> Die Bibliothek und
          Website-Texte wurden für {productName} erstellt. Nutzer-generierte Story-Inhalte
          stammen von eingeladenen Nutzerinnen und Nutzern.
        </li>
        <li>
          <strong className="text-zinc-200">Externe Links:</strong> Für verlinkte
          externe Seiten Dritter übernehmen wir keine Haftung; für deren Inhalte sind
          jeweils die Betreiber verantwortlich.
        </li>
        <li>
          <strong className="text-zinc-200">KI-Ausgaben:</strong> Automatisch erzeugte
          Texte und Sprache können fehlerhaft sein; sie stellen keine Beratung dar.
        </li>
      </LegalUl>

      <LegalH2>Weitere rechtliche Seiten</LegalH2>
      <LegalUl>
        <li>
          <a href="/legal/datenschutz" className="text-accent hover:underline">
            Datenschutzerklärung
          </a>
        </li>
        <li>
          <a href="/legal/nutzungsbedingungen" className="text-accent hover:underline">
            Nutzungsbedingungen
          </a>
        </li>
      </LegalUl>

      <LegalDisclaimer />
    </LegalPageShell>
  );
}
