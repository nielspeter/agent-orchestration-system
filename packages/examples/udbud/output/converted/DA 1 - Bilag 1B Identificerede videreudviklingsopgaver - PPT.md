# Delaftale 1 (Vedligehold og videreudvikling)

# Bilag 1B Identificerede videreudviklingsopgaver

Instrukser/vejledning til Kunde og Leverandør vedrørende udfyldelse af dokumentet er markeret med farve:

- Tekst markeret med turkis skal *erstattes* med Kundens tekst inden igangsættelse af miniudbud
- Tekst markeret med gult skal *erstattes* med Leverandørens besvarelse inden tilbudsafgivelse
- Tekst markeret med gråt skal *slettes* af Kunden eller Leverandøren

## 1 Indhold

[1	Identificerede videreudviklingsopgaver	3](.)

[1.1	Videreudviklingsopgaver i PLEJ/PPRAM	3](.)

[1.1.1	Vedligehold og incidenthåndtering på PLEJ/PPRAM	3](.)

[1.1.2	Udvidelser af oplysninger til skatteforvaltningen	4](.)

[1.1.3	Planlovsændringer og yderligere indberetning af planbestemmelser	4](.)

[1.1.4	Implementering af Virksomhedscertifikat	4](.)

[1.1.5	Integration mellem Plandata.dk og EA-hub	4](.)

[1.2	Videreudviklingsopgaver i TUFF	5](.)

[1.2.1	Vedligehold på TUFF	5](.)

[1.2.2	Implementering af STR forordningen	5](.)

## 2 Identificerede videreudviklingsopgaver

Kunden har ved Leverancekontraktens indgåelse identificeret en række videreudviklingsopgaver i de systemer/komponenter, der vedligeholdes, der kan blive igangsat efter Kundens valg i løbet af Leverancekontraktens løbetid. Videreudviklingsopgaverne fremgår af Bilag 1B, Identificerede videreudviklingsopgaver.

### 2.1 Videreudviklingsopgaver i PLEJ/PPRAM

I dette afsnit findes kendte videreudviklingsopgaver på systemet PLEJ/PPRAM. Dette omfatter både opgaver der laves på Plandatas vedligeholdelsesbudget og mulige projekter bundet op på samarbejdet med Skatteministeriet (SKM) og Planlovsændringer eller aftaler med andre organisationer. Udvikling i PLEJ/PPRAM kræver i høj grad koordinering med Plandata.dk’s register PDK (Se ovenfor)

#### 2.1.1 Vedligehold og incidenthåndtering på PLEJ/PPRAM

Opgaven på PLEJ/PPRAM består blandt andet i at bistå Kunden i incidenthåndtering. Incidenthåndteringen skal ses i sammenhæng med systemets kritiske funktioner, navnlig kommunernes mulighed for at offentliggøre planer og systemets videregivelse af plan-oplysninger til vurderingsmyndighederne i SKM. Disse kritiske funktionaliteter styres via henholdsvis en udsendelses- og en beregningskø, hvor elementer står i kø indtil de bliver behandlet af et job. Fra tid til anden forekommer elementer i udsendelses- og beregningskøen, der ikke kan behandles af de respektive job. For beregningskøelementer kan det blokere for øvrige beregninger, og for udsendelser er det særlig kritisk, fordi udsendelser kan definere offentliggørelsestidspunktet for planforslag eller vedtagne planer; hvisPlandata.dk forsinker offentliggørelsen, så forsinkes de facto den kommunale planlægning. Grundet den kritiske funktionalitet af jobbene, vil der være behov for incidenthåndtering af disse elementer, fx ved "manuel" udsættelse af behandlingstidspunkt for beregningskøelementer og ved nulstilling og genstart af udsendelsesprocesser.

Plandata laver løbende forbedringer af PLEJ/PPRAM for at forbedre brugeroplevelsen af systemet. Ud over rettelser af fejl og håndtering af incidents er vedligeholdsopgaverne i systemet brede.

I Plandata API og indberetningsfladen i PPRAM handler forbedringerne om at forbedre oplevelsen for Plandatas brugere: Kommunerne og de tredjeparter der servicerer dem. I Plandata API er der derfor et ønske om at skabe bedre muligheder for at tilgå systemets valideringsregler og give muligheder for at indberette en række oplysninger som der stadig mangler muligheder for at indberette. I brugerfladen er der mange muligheder for at forbedre brugeroplevelsen, som f.eks. forbedringer til søge- og markeringsmuligheder i tabeller der knytter sig til rammer og retningslinjer, samt udvidelse af PPRAMs adminmodul så visse funktioner kan startes gennem brugerfladen af forretningsrepræsentanter.

Deljordstykkeberegningen i Plandata.dk er meget kompleks. Det forekommer, at SKM spørger til forståelse af specifikke deljordstykkedata, ligesom både SKM, Plandata.dk’s forretning og de kommunale brugere af systemet bemærker fejlbehæftede deljordstykker. I alle tilfælde forventes det, at Leverandøren kan være udførende på at undersøge og forklare de relevante deljordstykkeoplysninger samt at prioritere eventuelle fejlrettelser højt. Eksempler på forbedringer i deljordstykkeberegningen kan være at gøre udtræk mere selvkørende og robuste så de er nemmere at lave, samt at skifte integrationen til BBR ud med den kommende hændelsesservice i datafordeleren for at fjerne en kendt fejlkilde i den nuværende integration.

På et mere generelt plan er der et arkitektonisk udviklingsønske om at lave integrationskomponenten om til et plugin for at spare kald mellem komponenter i systemet.

#### 2.1.2 Udvidelser af oplysninger til skatteforvaltningen

En stor del af udviklingsarbejdet i PLEJ/PPRAM er knyttet til at levere oplysninger om planlægningen til SKM’s ejendomsvurderinger. En typisk ændringsanmodning fra SKM berør ofte alle dele af PLEJ/PPRAM, fordi der skal gives mulighed for at en ny oplysning skal kunne indberettes som kræver ændringer til brugerfladen i PPRAM (inklusive upload/download-modulet) og Plandata API’et og derefter kræver ændringer til nedbrydning, beregning og udtræk. Opgaverne kan ofte vise sig store fordi de kræver grundlæggende indgreb og justeringer til Plandata.dk’s beregningskerne. På overskriftniveau erfølgende opgaver i tiltagende omfang blevet drøftet på forretningsniveau over det seneste halve år:

- Heraf-bestemmelser, hvor det ville blive muligt at indberette bestemmelser som er under-/overordnede hinanden.
- En større opdatering af de specifikke anvendelseskoder i Plandata, som er et vigtigt element i både planlægning og ejendomsvurderinger.
- Versionering af beregningskernen for at kunne lave ændringer til fremtidige terminer uden at lave ændringer til beregningslogikken på tidligere terminer.

#### 2.1.3 Planlovsændringer og yderligere indberetning af planbestemmelser

I de senere år er Plandata.dk udbygget kraftigt. Ud over samarbejdet med SKM kommer tilføjelserne har typisk sammenhæng med politiske initiativer mens det andre gange er båret frem af en digitaliseringsagenda

Det er i den forbindelse forventet at der vil komme ændringer til planloven i slutningen af 2025 som bl.a. vil medføre en standardiseringen af datagrundlaget for nogle af de retningslinjer som kommunerne skal indberette til Plandata om klimatilpasning. I den forbindelse vil det være forventeligt der skal udarbejdes yderligere værktøjer til kommunerne samt validering af planerne for at gøre dette muligt igennem Plandata.dk.

#### 2.1.4 Implementering af Virksomhedscertifikat

Plandata API bruger i dag en basic auth løsning til bruger certificering af tredjeparter. Erhvervsstyrelsens ønsker dog at udfase brugen af basic auth autentificering af sikkerhedshensyn. Plandata.dk har i den forbindelse behov for at skifte autentificeringen af tredjeparter til virksomhedscertifikat når dette bliver muligt i sector9. I den forbindelse vil rettighedsstrukturen skulle gennemgås så Plandata bedst muligt kan styre hvilke brugere der har adgang til at lave hvilke handlinger i Plandata.dk.

#### 2.1.5 Integration mellem Plandata.dk og EA-hub

EA-hub samler miljøvurderinger og konsekvensrapporter for planer og projekter i Danmark. Det har tidligere været muligt at indberette VVM i Plandata, da der er mange af disse miljøvurderinger der bliver lavet i direkte tilknytning til mange plantyper i Plandata.dk. Det vil i dent forbindelse være naturligt at man som bruger af begge systemer kan angive et id på en plan eller miljøvurdering og dermed kan relatere de to på tværs. For miljøvurderinger som er tæt tilknyttet til en eller flere planer kan det være praktisk at kunne indberette hele miljøvurderingen gennem plandata.

### 2.2 Videreudviklingsopgaver i TUFF

I dette afsnit gennemgås kendte videreudviklingsopgaver i TUFF

#### 2.2.1 Vedligehold på TUFF

Opgaven på TUFF består af incidenthåndtering og rettelser af fejl der opdages eller opstår løbende. TUFF understøtter sagsbehandling i sommerhus-teamet som laver afgørelser i sager. Det er derfor vigtigt at oplysninger i TUFF er korrekte og tilgængelige. Løbende forbedringer i TUFF inkluderer forbedring af integrationer til andre systemer, visning af oplysninger i brugerfladen.

#### 2.2.2 Implementering af STR forordningen

EU har vedtaget en forordning om dataindsamling og –udveksling i forbindelse med kortidsudlejning af indkvartering. Det kan med udgangspunkt i de nye regler blive nødvendigt at opdatere TUFF så det kan leve op til kravene i forordningen. Der er ikke på nuværende tidspunkt afsat midler til opgaven.

[Læs mere om forordningen her.](https:/eur-lex.europa.eu/legal-content/EN/LSU/?uri=CELEX:32024R1028)