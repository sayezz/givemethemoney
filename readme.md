# Investment Tracker – Self-hosted Portfolio Management

Ein selbst gehostetes System zur Verwaltung von Wertpapierdepots mit
Mehrbenutzer-Unterstützung.

**Backend: C++ mit oatpp-Framework | Frontend: React | Datenbank: PostgreSQL**

## Funktionen

- Mehrbenutzerfähig mit Registrierung und Login (JWT-Authentifizierung)
- Positionen anlegen, verwalten und löschen
- Live-Kurse über Yahoo Finance, Financial Modeling Prep (FMP) und Alpha Vantage
- Mehrwährungsfähig (automatische Umrechnung in EUR über Wechselkurse)
- Berechnung von Gebühren, Steuern, Break-even und Renditezielen
- Trailing-Stop-Überwachung inkl. optionaler E-Mail-Benachrichtigung

## Schnellstart mit Docker

### Voraussetzungen

- Docker & Docker Compose
- Git

### Installation & Start

```bash
git clone <repo-url>
cd givemethemoney

# Umgebungsvariablen vorbereiten und Secrets eintragen
cp .env-example .env
# .env öffnen und mindestens JWT_SECRET (und ggf. DB_PASSWORD) setzen

# Alle Dienste starten (PostgreSQL, C++-Backend, React-Frontend)
docker-compose up --build
```

**Der erste Build dauert 3–5 Minuten**, da oatpp aus dem Quellcode kompiliert wird.

### Zugriff

- **Frontend**: http://localhost:3000
- **Backend-API**: http://localhost:3001/api
- **Datenbank**: localhost:5432 (Zugangsdaten aus `.env`)

### Testkonto

1. http://localhost:3000/register aufrufen
2. Ein Konto anlegen (z. B. `test@example.com` / `TestPassword123`)
3. Nach der Registrierung erfolgt die Weiterleitung zum Dashboard

## Projektstruktur

```
givemethemoney/
├── backend/
│   ├── src/
│   │   ├── main.cpp
│   │   ├── dto/
│   │   │   └── DTOs.hpp               # Request-/Response-Modelle
│   │   ├── controller/
│   │   │   ├── AuthController.hpp     # Login-/Register-Endpunkte
│   │   │   ├── PositionsController.hpp
│   │   │   └── StocksController.hpp   # Kursdaten-Endpunkte
│   │   ├── repository/
│   │   │   ├── UserRepository.hpp     # DB-Abfragen für Benutzer
│   │   │   └── PositionRepository.hpp # DB-Abfragen für Positionen
│   │   ├── database/
│   │   │   ├── Database.hpp           # PostgreSQL-Verbindung & Retry-Logik
│   │   │   └── Database.cpp
│   │   └── utils/
│   │       ├── JwtUtils.hpp           # JWT-Kodierung/-Dekodierung
│   │       ├── PasswordUtils.hpp      # PBKDF2-Passwort-Hashing
│   │       ├── EmailUtils.hpp         # SMTP-Versand (Trailing-Stop-Mails)
│   │       ├── HttpClient.hpp         # HTTP-Client (curl) für Kursanbieter
│   │       ├── CorsUtils.hpp          # CORS-Header
│   │       └── JsonParser.hpp
│   ├── init.sql                       # Datenbankschema
│   ├── CMakeLists.txt
│   └── Dockerfile                     # Mehrstufiger Build
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── context/
│   │   │   └── AuthContext.js         # Auth-State-Management
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   └── Dashboard.js
│   │   ├── components/
│   │   │   ├── AddPositionForm.js
│   │   │   ├── PositionDetailModal.js
│   │   │   └── ProtectedRoute.js
│   │   └── utils/
│   │       └── currency.js            # Währungsformatierung/-umrechnung
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## Sicherheit

- **Passwörter**: PBKDF2-HMAC-SHA256 mit 100.000 Iterationen (OpenSSL), mit Salt
- **Passwortprüfung**: Vergleich in konstanter Zeit (`CRYPTO_memcmp`)
- **JWT-Tokens**: HS256, signiert mit `JWT_SECRET`, Ablauf nach 7 Tagen
- **CORS**: im C++-Backend konfigurierbar
- **Eingabevalidierung** im Backend und im Frontend
- **PostgreSQL Prepared Statements** als Schutz gegen SQL-Injection

> **Hinweis:** `JWT_SECRET` muss vor jedem Einsatz auf einen langen, zufälligen
> Wert gesetzt werden. Wird kein Secret gesetzt, ist die Token-Signierung nicht
> sicher. Einen Wert erzeugen z. B. mit `openssl rand -base64 48`.

## Umgebungsvariablen

In `.env` definiert (Vorlage: `.env-example`):

```env
# Pflicht
JWT_SECRET=         # langes, zufälliges Secret für die JWT-Signierung
DB_PASSWORD=        # Passwort der PostgreSQL-Datenbank

# Optional (mit Standardwerten)
DB_HOST=postgres
DB_PORT=5432
DB_USER=tracker_user
DB_NAME=investment_tracker

# Optionale Kursanbieter / E-Mail-Versand
FMP_API_KEY=
AV_API_KEY=
SMTP_URL=
SMTP_USER=
SMTP_PASS=
```

## Lokaler Build (ohne Docker)

```bash
cd backend

# Voraussetzungen
sudo apt-get install cmake build-essential libssl-dev libpq-dev libcurl4-openssl-dev

mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

# Ausführbare Datei: ./investment_tracker
```

Zur Laufzeit müssen mindestens `JWT_SECRET` sowie die Datenbankvariablen
gesetzt sein (siehe oben).

## Lizenz

Apache 2.0
