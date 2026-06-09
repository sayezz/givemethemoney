# Investment Tracker - Self-hosted Portfolio Management

A self-hosted investment tracking system with multi-user support.

**Backend: C++ with oatpp Framework | Frontend: React | Database: PostgreSQL**


## Quickstart with Docker

### Prerequisites
- Docker & Docker Compose
- Git

### Installation & Start

```bash
git clone <repo-url>
cd givemethemoney

# Start all services (PostgreSQL, C++ Backend, React Frontend)
docker-compose up --build
```

**First build takes 3-5 minutes** (oatpp is compiled from source)

### Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Database**: localhost:5432 (credentials in docker-compose.yml)

### Test Account
1. Go to http://localhost:3000/register
2. Create a new account (e.g. test@example.com / TestPassword123)
3. You will be redirected to the dashboard automatically

## Project Structure

```
givemethemoney/
├── backend/
│   ├── src/
│   │   ├── main.cpp
│   │   ├── dto/
│   │   │   └── DTOs.hpp               # Request/Response models
│   │   ├── controller/
│   │   │   ├── AuthController.hpp     # Login/Register endpoints
│   │   │   ├── PositionsController.hpp
│   │   │   └── StocksController.hpp   # Stock data endpoints
│   │   ├── repository/
│   │   │   ├── UserRepository.hpp     # User DB queries
│   │   │   └── PositionRepository.hpp # Position DB queries
│   │   ├── database/
│   │   │   ├── Database.hpp           # PostgreSQL connection & retry logic
│   │   │   └── Database.cpp
│   │   └── utils/
│   │       ├── JwtUtils.hpp           # JWT encoding/decoding
│   │       ├── PasswordUtils.hpp      # PBKDF2 password hashing
│   │       ├── EmailUtils.hpp
│   │       ├── HttpClient.hpp
│   │       ├── CorsUtils.hpp
│   │       └── JsonParser.hpp
│   ├── init.sql                       # Database schema
│   ├── CMakeLists.txt
│   └── Dockerfile                     # Multi-stage build
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── context/
│   │   │   └── AuthContext.js         # Auth state management
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   └── Dashboard.js
│   │   └── components/
│   │       ├── AddPositionForm.js
│   │       ├── PositionDetailModal.js
│   │       └── ProtectedRoute.js
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## Security

- **Passwords**: PBKDF2 with 100,000 iterations (OpenSSL), salted
- **JWT Tokens**: HS256, 7-day expiry
- **Constant-time comparison** for password verification
- **CORS** configurable in C++ backend
- **Input validation** on both backend and frontend
- **PostgreSQL prepared statements** against SQL injection

## Environment Variables

Defined in `docker-compose.yml`:

```env
DB_HOST=postgres
DB_PORT=5432
DB_USER=tracker_user
DB_PASSWORD=tracker_password
DB_NAME=investment_tracker
JWT_SECRET=your_super_secret_key   # Change before deploying!
PORT=3001
```

## Building Locally (without Docker)

```bash
cd backend

# Prerequisites
sudo apt-get install cmake build-essential libssl-dev libpq-dev

mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

# Executable: ./investment_tracker
```

## License

Apache 2.0
