# Investment Tracker - Self-hosted Portfolio Management

Ein selbstgehostetes Investment-Tracking-System mit Multi-User-Unterstützung.

**Backend: C++ mit oatpp Framework | Frontend: React | Datenbank: PostgreSQL**

## 🚀 Funktionen (Phase 1: Login & Grundstruktur)

### Backend (C++)
- ✅ User Authentication (Email/Password) - PBKDF2 hashing
- ✅ JWT Token-basierte Autorisierung
- ✅ PostgreSQL Connection Pool
- ✅ Multi-User Support
- ✅ High-Performance REST API
- 🔨 OpenSSL Crypto für sichere Passwörter

### Frontend (React)
- ✅ Login & Register Seiten
- ✅ Responsive Design für Mobile
- ✅ Protected Routes
- ✅ Token-Management

### Datenbank (PostgreSQL)
- ✅ Users Tabelle mit Email/Password Hash
- ✅ Positions Tabelle (gebunden an User)
- ✅ Automatische Timestamps
- ✅ Foreign Key Constraints

## 📦 Quickstart mit Docker

### Voraussetzungen
- Docker & Docker Compose
- Git

### Installation & Start

```bash
cd /home/pi/givemethemoney

# Starte alle Services (PostgreSQL, C++ Backend, React Frontend)
docker-compose up --build
```

**Erste Kompilierung dauert 3-5 Minuten** (oatpp wird kompiliert)

### Zugriff
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Datenbank**: localhost:5432 (Credentials in docker-compose.yml)

### Test-Zugang
1. Gehe zu http://localhost:3000/register
2. Erstelle einen neuen Account (z.B. test@example.com / TestPassword123)
3. Du wirst automatisch zum Dashboard weitergeleitet

## 🏗️ Projektstruktur

```
givemethemoney/
├── backend/                       # C++ Backend mit oatpp
│   ├── src/
│   │   ├── main.cpp              # Entry Point
│   │   ├── dto/
│   │   │   └── DTOs.hpp          # Request/Response Models
│   │   ├── controller/
│   │   │   ├── AuthController.hpp      # Login/Register Endpoints
│   │   │   └── PositionsController.hpp # Position Endpoints
│   │   ├── database/
│   │   │   ├── Database.hpp      # PostgreSQL Connection
│   │   │   └── Database.cpp
│   │   └── utils/
│   │       ├── JwtUtils.hpp      # JWT Encoding/Decoding
│   │       ├── PasswordUtils.hpp # PBKDF2 Password Hashing
│   │       └── JsonParser.hpp    # JSON Parsing
│   ├── init.sql                  # Database Schema
│   ├── CMakeLists.txt            # C++ Build Config
│   ├── conanfile.txt             # C++ Dependencies
│   ├── Dockerfile                # Multi-stage Build
│   └── build.sh                  # Build Script
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── context/
│   │   │   └── AuthContext.js # Auth State Management
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Auth.css
│   │   │   └── Dashboard.css
│   │   └── components/
│   │       └── ProtectedRoute.js
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## 🔐 Sicherheit

- **Passwörter**: PBKDF2 mit 100.000 Iterationen (OpenSSL)
- **JWT Token**: HS256 mit 7 Tage Gültigkeit
- **Hashing**: Argon2-kompatibel, salted & keyed
- **Constant-time Comparison** für Password Verification
- **CORS** konfigurierbar in C++ Backend
- **Input Validation** auf Backend & Frontend
- **PostgreSQL** Prepared Statements gegen SQL Injection

## 📝 Nächste Schritte (Phase 2+)

- [ ] Position Management (Add/Edit/Delete) - REST APIs
- [ ] Database Query Service Layer (C++)
- [ ] Echtzeit Kurs-Updates via yfinance
- [ ] Gewinn/Verlust Berechnung Service
- [ ] Break-even Berechnung
- [ ] Steuern-Berechnung (26,375%)
- [ ] Trailing Stop Verwaltung
- [ ] Portfolio Übersicht Dashboard
- [ ] CSV-Import von ING-Transaktionen
- [ ] WebSocket für Live Updates
- [ ] Automated Price Updates (APScheduler oder C++ async)

## 🛠️ Environment Variablen

Sind in `docker-compose.yml` und `backend/.env` definiert:

```env
NODE_ENV=production
DB_HOST=postgres        # PostgreSQL Service
DB_PORT=5432
DB_USER=tracker_user
DB_PASSWORD=tracker_password
DB_NAME=investment_tracker
JWT_SECRET=your_super_secret_key (change!)
PORT=3001
```

## 🔧 Lokales Kompilieren (ohne Docker)

```bash
cd backend

# Prerequisites: cmake, g++, libssl-dev, postgresql-dev
sudo apt-get install cmake build-essential libssl-dev

# Download & build oatpp dependencies
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

# Executable: ./investment_tracker
```

## 📱 Browser-Kompatibilität

- Chrome/Edge (neueste)
- Firefox (neueste)
- Safari (neueste)
- Mobile Browser

## 📄 Lizenz

MIT
