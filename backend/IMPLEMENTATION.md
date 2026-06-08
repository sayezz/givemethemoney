# C++ Backend Implementation Guide

## 🎯 Architektur

Das Backend folgt einem **layered architecture** Pattern:

```
┌─────────────────────────────────────────┐
│     HTTP Endpoints (ApiController)      │
├─────────────────────────────────────────┤
│     Business Logic (Service Layer)      │
├─────────────────────────────────────────┤
│     Data Access (Repository Pattern)    │
├─────────────────────────────────────────┤
│     PostgreSQL Database                 │
└─────────────────────────────────────────┘
```

## 📝 Implementierungs-Checkliste Phase 2

### 1. Database Service Layer
- [ ] `UserRepository.hpp` - User CRUD Operationen
- [ ] `PositionRepository.hpp` - Position CRUD mit User-Filter
- [ ] Prepared Statements für alle Queries
- [ ] Connection Pooling

### 2. Authentication Service
- [ ] Password Hashing mit PBKDF2 (bereits in PasswordUtils)
- [ ] JWT Token Generierung (bereits in JwtUtils)
- [ ] Password Verification
- [ ] Token Validation Middleware

### 3. Position Service
- [ ] `PositionService.hpp` - Business Logic
- [ ] Calculation: Break-even = (purchase_cost + purchase_fee + sell_fee) / quantity
- [ ] Calculation: Current P&L = (current_price - break_even) * quantity
- [ ] Tax-adjusted P&L = current_P&L * (1 - tax_rate)
- [ ] Target prices calculation (1%, 2%, 5%, 10%)

### 4. REST Endpoints vollständig implementieren

```cpp
// Auth (bereits als Skelette vorhanden)
POST   /api/auth/register          // Create User
POST   /api/auth/login             // Generate JWT

// Positions
GET    /api/positions              // List user positions
POST   /api/positions              // Create position
GET    /api/positions/{id}         // Get position details
PUT    /api/positions/{id}         // Update position
DELETE /api/positions/{id}         // Delete position

// Calculations
GET    /api/positions/{id}/calculations  // Get P&L, tax, targets
POST   /api/positions/{id}/update-price  // Update current price
```

### 5. External Data Integration
- [ ] yfinance API wrapper in C++ (HTTP request library)
- [ ] Background Task Scheduler (oatpp async)
- [ ] Store highest_price when new high is reached

## 🔧 Code-Template für neuen Service

```cpp
#ifndef USER_SERVICE_H
#define USER_SERVICE_H

#include "../dto/DTOs.hpp"
#include "../database/Database.hpp"
#include <memory>

class UserService {
private:
  std::shared_ptr<Database> m_database;

public:
  UserService(std::shared_ptr<Database> database) 
    : m_database(database) {}

  // User registration
  std::shared_ptr<AuthResponseDto> registerUser(const std::string& email, const std::string& password) {
    // 1. Validate email format
    // 2. Hash password with PasswordUtils::hash()
    // 3. Insert into users table
    // 4. Generate JWT with JwtUtils::encode()
    // 5. Return AuthResponseDto with token
  }

  // User login
  std::shared_ptr<AuthResponseDto> login(const std::string& email, const std::string& password) {
    // 1. Query user by email from database
    // 2. Verify password with PasswordUtils::verify()
    // 3. Generate JWT token
    // 4. Return token
  }
};

#endif // USER_SERVICE_H
```

## 📊 Database Query Examples

```sql
-- Register user
INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING id, email, created_at;

-- Find user by email
SELECT id, email, password_hash 
FROM users 
WHERE email = $1;

-- Get all positions for user
SELECT * FROM positions 
WHERE user_id = $1 
ORDER BY created_at DESC;

-- Create position with atomicity
INSERT INTO positions (user_id, name, ticker, quantity, purchase_cost, purchase_fee, sell_fee, tax_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- Update current price and highest price
UPDATE positions 
SET highest_price = GREATEST(highest_price, $1),
    updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3;
```

## 🔐 JWT Middleware Pattern

```cpp
// In AuthController
ENDPOINT("GET", "/api/positions", getPositions,
         HEADER(String, authHeader, "Authorization")) {
  
  // Extract token from "Bearer <token>"
  std::string token = authHeader->substr(7); // Remove "Bearer "
  
  int userId;
  std::string email;
  
  if (!JwtUtils::verify(token, JWT_SECRET, userId, email)) {
    return createDtoResponse(Status::CODE_401, ErrorResponseDto::createShared());
  }
  
  // userId is now validated, use it for queries
  // e.g., getPositions(userId)
}
```

## 🚀 Performance Tipps

1. **Connection Pooling**: oatpp-postgresql unterstützt bereits Pooling
2. **Prepared Statements**: Nutze parametrisierte Queries
3. **Indexes**: Schema hat bereits Indexes für user_id und email
4. **Async I/O**: oatpp nutzt Async unter der Haube
5. **Caching**: Highestprice nur updaten wenn nötig

## 🐛 Debugging

```bash
# Build mit Debug Info
cd backend/build
cmake .. -DCMAKE_BUILD_TYPE=Debug
make

# Mit gdb debuggen
gdb ./investment_tracker

# Logs in Docker
docker logs investment_tracker_backend

# PostgreSQL Queries debuggen
docker exec -it investment_tracker_db psql -U tracker_user -d investment_tracker
```

## 📚 Wichtige oatpp Links

- **Controllers**: https://oatpp.io/docs/api-controller/
- **DTOs**: https://oatpp.io/docs/dto/fields/
- **PostgreSQL**: https://github.com/oatpp/oatpp-postgresql
- **Async**: https://oatpp.io/docs/async-api/

## ✅ Testing der Endpoints

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Create Position (mit Token)
curl -X POST http://localhost:3001/api/positions \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Apple",
    "ticker":"AAPL",
    "quantity":10,
    "purchase_cost":1500,
    "purchase_fee":5,
    "sell_fee":5,
    "tax_rate":26.375
  }'
```
