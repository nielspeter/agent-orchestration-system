# Offentligt Udbud - Digitalt Borgerportal System

**Udbudstype**: Offentligt udbud
**Udbudsnummer**: 2024-DK-001234
**Ordregivende myndighed**: Eksempel Kommune
**Offentliggjort**: 2024-03-15
**Tilbudsfrist**: 2024-05-01

---

## 1. PROJEKTBESKRIVELSE

Eksempel Kommune ønsker at udvikle et nyt digitalt borgerportal system, der skal erstatte den eksisterende løsning og integrere med kommunens fagsystemer.

**Projektomfang:**
- Udvikling af nyt digitalt borgerportal (web og mobil)
- Integration med eksisterende fagsystemer
- Datamigration fra nuværende system
- Drift og vedligeholdelse i 3 år

**Kontrakt værdi**: 5.000.000 - 8.000.000 DKK (ekskl. moms)
**Projektstart**: 2024-06-01
**Go-live deadline**: 2024-12-15 (6 måneder)

---

## 2. TEKNISKE KRAV

### 2.1 Arkitektur

Systemet SKAL udvikles som en moderne **microservices arkitektur** med følgende komponenter:

1. **Frontend** (Web og Mobil):
   - Responsivt web interface (React eller Angular)
   - Mobil app (iOS og Android - native eller cross-platform)
   - Progressive Web App (PWA) support

2. **Backend Services**:
   - Minimum 5 microservices:
     - Bruger service (autentifikation, profiler)
     - Sag service (sagsbehandling)
     - Dokument service (upload, download, PDF generering)
     - Notifikation service (email, SMS, push)
     - Integration service (fagsystem integrationer)
   - RESTful API design
   - API Gateway for routing og sikkerhed

3. **Database**:
   - Relationel database (PostgreSQL eller MySQL)
   - Separate databaser per microservice (database-per-service pattern)

4. **Infrastruktur**:
   - Cloud-baseret løsning (Azure eller AWS)
   - Container orchestration med Kubernetes
   - CI/CD pipeline (Azure DevOps eller GitHub Actions)
   - Monitoring og logging (Application Insights eller CloudWatch)

### 2.2 Integrationer

Systemet SKAL integrere med følgende eksisterende systemer:

| System | Teknologi | Datatype | Frekvens |
|--------|-----------|----------|----------|
| Borgerservice Platform | REST API | JSON | Real-time |
| Skattesystem | SOAP/XML | XML | Dagligt |
| Ejendomssystem | Database-to-database | SQL | Real-time |
| NemID/MitID | OAuth2/OpenID Connect | JWT | Real-time |
| Digital Post | REST API (Kombit) | JSON | Real-time |
| Dokumentarkiv | File-based (SFTP) | PDF/XML | Dagligt |

**Total**: 6 integrationer påkrævet.

### 2.3 Datamigration

Datamigration fra eksisterende system SKAL omfatte:

- **Brugerprofiler**: Ca. 45.000 records
- **Sagsdokumenter**: Ca. 280.000 dokumenter (PDF, DOCX)
- **Sagshistorik**: Ca. 120.000 sager med metadata
- **Datakvalitet**: Moderat (nogle duplikater og manglende felter)
- **Downtime tolerance**: Maksimalt 4 timer under migration

### 2.4 Performance Krav

- **Response tid**: Max 2 sekunder for 95% af requests
- **Samtidighed**: Minimum 500 samtidige brugere
- **Tilgængelighed**: 99.5% uptime (ekskl. planlagt vedligeholdelse)
- **Skalerbarhed**: Horizontal scaling capability

### 2.5 Sikkerhed og Compliance

- GDPR compliance (obligatorisk)
- ISO 27001 certificering (ønsket, ikke påkrævet)
- End-to-end kryptering af følsomme data
- Audit logging af alle dataadgange
- Penetration testing før go-live

---

## 3. KOMPETENCEKRAV

Tilbudsgiver SKAL kunne dokumentere:

1. **Arkitektur ekspertise**:
   - Minimum 3 projekter med microservices arkitektur
   - Erfaring med Kubernetes i produktion

2. **Integration erfaring**:
   - Dokumenteret erfaring med SOAP/XML integrationer
   - Erfaring med offentlige danske systemer (NemID/MitID, Digital Post)

3. **Team sammensætning**:
   - Minimum 1 certificeret cloud arkitekt (Azure eller AWS)
   - Minimum 2 erfarne backend udviklere (3+ års erfaring)
   - Minimum 2 erfarne frontend udviklere (3+ års erfaring)
   - Minimum 1 DevOps specialist med Kubernetes erfaring
   - Minimum 1 sikkerhedsspecialist (GDPR/ISO 27001)

4. **Reference projekter**:
   - Minimum 2 reference projekter fra de sidste 3 år
   - Minimum 1 reference med offentlig sektor (dansk eller nordisk)

---

## 4. EVALUERINGSKRITERIER

| Kriterie | Vægtning |
|----------|----------|
| Pris | 40% |
| Teknisk løsning | 30% |
| Projektplan og metode | 15% |
| Team kompetencer | 10% |
| Referencer | 5% |

**Total**: 100%

---

## 5. TIDSPLAN

- **Tilbudsfrist**: 2024-05-01
- **Evaluering**: 2024-05-01 - 2024-05-20
- **Kontrakt tildeling**: 2024-05-25
- **Projektstart**: 2024-06-01
- **Design fase**: 2024-06-01 - 2024-07-15 (6 uger)
- **Udvikling fase**: 2024-07-16 - 2024-11-15 (4 måneder)
- **Test fase**: 2024-11-16 - 2024-12-01 (2 uger)
- **Datamigration**: 2024-12-01 - 2024-12-08 (1 uge)
- **Go-live**: 2024-12-15

**Total projektvarighed**: 6 måneder fra start til go-live.

---

## 6. LEVERANCER

Tilbudsgiver SKAL levere:

1. **Dokumentation**:
   - Teknisk arkitektur dokument
   - API dokumentation (Swagger/OpenAPI)
   - Deployment guide
   - Bruger- og administratormanualer

2. **Software**:
   - Kildekode (ejerskab overføres til kommune)
   - Deployment scripts
   - Test suites (unit, integration, e2e)

3. **Drift setup**:
   - CI/CD pipelines
   - Monitoring dashboards
   - Backup og restore procedurer
   - Sikkerhedsscanning automation

---

## 7. BEMÆRKNINGER

- Alle priser skal være ekskl. moms
- Tilbuddet skal indeholde opdeling af timer per komponent
- Vedligeholdelse efter go-live: 3 år (separat prissat)
- Spørgsmål til udbuddet kan stilles indtil 2024-04-15

---

**Kontaktperson**: Anders Nielsen, IT-chef
**Email**: anders.nielsen@eksempelkommune.dk
**Telefon**: +45 1234 5678
