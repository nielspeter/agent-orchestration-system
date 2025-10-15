# KRAVSPECIFIKATION
Genereret: 2025-09-19
Kilde: combined-tender-documentation.md

## UDBUDSIDENTIFIKATION
- **Udbyder**: Erhvervsstyrelsen [FAKTA]
- **Udbuds ID**: DA 1 [FAKTA]
- **Type**: Offentlig [FAKTA]
- **Udbudsform**: Miniudbud [FAKTA]

## OBLIGATORISKE KRAV

| Krav ID | Beskrivelse | Type | Kilde | Detaljer |
|---------|-------------|------|-------|----------|
| M001 | Leverandøren skal overtage de systemer/komponenter, der er beskrevet i punkt 2.2.1 Systembeskrivelse | Teknisk | Bilag 1, s.4 | Overtagelsesopgaven |
| M002 | Leverandøren skal proaktivt udføre forebyggende og afhjælpende vedligeholdelse | Teknisk | Bilag 1, s.5 | Vedligeholdelsesopgaven |
| M003 | Leverandøren skal benytte Kundens samarbejdsværktøjer | Teknisk | Bilag 1, s.5 | Samarbejdsværktøj |
| M004 | Leverandøren skal benytte den til hver tid af Kunden ønsket standard for opgave estimering | Teknisk | Bilag 1, s.5 | Estimering |
| M005 | Leverandøren skal benytte tidsregistreringsløsningen fra Kundens samarbejdsværktøjer | Teknisk | Bilag 1, s.5 | Tidsregistrering |
| M006 | Leverandøren skal foretage rapportering månedsvis | Teknisk | Bilag 1, s.5 | Månedsrapportering |
| M007 | Leverandøren skal rådgive og være Kunden behjælpelig i forbindelse med udfyldelse af request for changes (RFC) | Teknisk | Bilag 1, s.5 | Change og release |
| M008 | Systemet skal vedligeholdes på en sådan måde, at svartider så vidt muligt ikke forringes | Teknisk | Bilag 1, s.6 | Svartider |
| M009 | Leverandøren skal notificere Kunden, såfremt der er ændringer til Dokumentation | Teknisk | Bilag 1, s.6 | Dokumentation |
| M010 | Leverandøren skal stå til rådighed med rådgivning og om nødvendigt gennemføre test af systemet | Teknisk | Bilag 1, s.7 | Samarbejde |
| M011 | Leverandøren skal levere medarbejdere til support on site hos Kunden | Teknisk | Bilag 1, s.8 | Support |
| M012 | Leverandøren skal assistere Kunden med overdragelse af vedligeholdelsesopgaven | Teknisk | Bilag 1, s.8 | Assistance ved ophør |

## VALGFRIE KRAV MED POINT

| Krav ID | Beskrivelse | Point | Kategori | Kilde |
|---------|-------------|-------|----------|-------|
| O001 | Tilbudsgiver skal beskrive en struktureret og velbegrundet overtagelsesplan | 30 | Kvalitet i løsningen | Bilag 2.1 |
| O002 | Tilbudsgiver skal give et sammenhængende løsningsforslag til case 1 og case 2 | 70 | Kvalitet i løsningen | Bilag 1.1 |

## CASE KRAV

### Case 1: Plantypen Landzonetilladelser skal udvides
**Beskrivelse**: Plandata ønsker at flere anvendelser kan angives i brugerfladen og at landzonetilladelser kan indberettes via REST API.
**Krav til besvarelse**:
1. Design af ny indberetning i PPRAMs brugerflade
2. Indberetning via REST API
3. Oplysninger medsendes i udtræk til SKM
**Evalueringsfokus**: Sammenhængende løsningsforslag

### Case 2: Udvidet rollestyring
**Beskrivelse**: Plandata.dk ønsker at skifte autentificeringen af tredjeparter til virksomhedscertifikat.
**Krav til besvarelse**:
1. Rettelser til rollestyringen
2. Nedbrydning af opgaven i stories
3. Beskrivelse af berørte dele af PLEJ/PPRAM
**Evalueringsfokus**: Sammenhængende løsningsforslag

## TEKNISKE SPECIFIKATIONER

### Systemkrav
- Leverandøren skal overtage systemer/komponenter beskrevet i Bilag 1A [FAKTA - Bilag 1, s.5]

### Arkitekturkrav
- Styrelsens systemer skal opbygges efter samme model [FAKTA - Bilag 1, s.7]

### Integrationskrav
- System: PDK, Type: REST, Formål: Hent og gem af planer [FAKTA - Bilag 1A]

### Performance krav
- Svartider må ikke forringes uden Kundens samtykke [FAKTA - Bilag 1, s.6]

### Sikkerhedskrav
- Overholdelse af ISO27001-standarden [FAKTA - Bilag 7]

## KOMMERCIELLE VILKÅR

| Vilkår | Værdi | Kilde | Noter |
|--------|-------|-------|-------|
| Kontraktværdi | 37,5 mio. kr. ekskl. moms | Bilag 1, s.4 | [FAKTA] |
| Varighed | 24 måneder | Bilag 2, s.3 | [FAKTA] |
| Optioner | 2 x 12 måneder | Bilag 2, s.3 | [FAKTA] |
| Betalingsbetingelser | Månedligt vederlag | Bilag 4 | [FAKTA] |
| Dagbøder | 1% per bodspoint | Bilag 6 | [FAKTA] |
| Ansvar | Fuldt ansvarlig | Bilag 7 | [FAKTA] |
| Forsikring | Krav om ISO27001 | Bilag 7 | [FAKTA] |

## TIDSPLAN OG MILEPÆLE

| Hændelse | Dato | Tid | Dage fra nu | Type |
|----------|------|-----|-------------|------|
| Spørgsmålsfrist | 20.10.2025 | - | [Beregnet] | Deadline |
| Tilbudsfrist | 29.10.2025 | 12:00 | [Beregnet] | Deadline |
| Kontraktstart | 17.11.2025 | - | [Beregnet] | Milepæl |

## RESSOURCEKRAV

### Bemanding
| Rolle | Antal | Niveau | Certificering | On-site | Kilde |
|-------|-------|--------|---------------|---------|-------|
| Tech lead | 1 | Senior | - | Ja | Bilag 3 |
| Tester | 1 | Senior | - | Ja | Bilag 3 |
| Udvikler | 4 | Senior | - | Ja | Bilag 3 |

### Kompetencekrav
- Grails, Oracle databaser: Erfaring krævet [FAKTA]

## EVALUERINGSMODEL

### Tildelingskriterier
| Kriterium | Vægt | Underkriterier | Beskrivelse |
|-----------|------|----------------|-------------|
| Konsulenter | 40% | - | Individuelle og samlede kvalifikationer |
| Kvalitet | 25% | - | Løsningsforslag og overtagelsesplan |
| Pris | 25% | - | Overtagelsesvederlag, vedligeholdelsesvederlag, timepris |
| Organisation | 10% | - | Samarbejde og kundens medvirken |

### Tærskelværdier
- Ingen specificeret

## LEVERANCER OG DOKUMENTATION

### Påkrævede leverancer
| Leverance | Beskrivelse | Format | Deadline | Kilde |
|-----------|-------------|--------|----------|-------|
| Månedsrapportering | Status og fremdrift | PDF | Månedligt | Bilag 5 |

### Rapporteringskrav
- Frekvens: Månedlig
- Format: Regneark
- Indhold: Status, tidsforbrug, fremdrift

## REFERENCER OG ERFARING

### Påkrævede referencer
| Type | Antal | Krav | Værdi | Periode |
|------|-------|------|-------|---------|
| Konsulenter | 6 | Erfaring med lignende projekter | - | - |

### Økonomiske krav
- Årlig omsætning: [UKENDT]
- Soliditet: [UKENDT]
- Kreditvurdering: [UKENDT]

## SÆRLIGE FORHOLD
- Ingen decentrale ressourcer tilladt [FAKTA]

## DATAOVERSIGT

### Samlet statistik
- Obligatoriske krav total: 12
- Valgfrie krav total: 2 (100 point mulige)
- Cases: 2
- Kritiske datoer: 3
- Nøgle ressourcer påkrævet: 6 FTE

[Ekstraktion komplet - klar til compliance mapping]