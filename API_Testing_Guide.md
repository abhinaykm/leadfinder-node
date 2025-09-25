# LeadFinder API Testing Guide

## 🚀 Quick Start

### Prerequisites
- PostgreSQL running on port 5432
- Node.js application running on port 3000
- Postman installed

### Test User Credentials
**Admin User:**
```
Email: admin@gmail.com
Password: admin
```

**Test User:**
```
Name: Abhinay kumar mishra
Email: abhinay@gmail.com
Password: password
```

## 📋 API Endpoints

### Authentication

#### POST /api/login
**Description**: Authenticate user and get JWT token

**Request Body**:
```json
{
  "email": "admin@gmail.com",
  "password": "admin"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "uuid": "b608b691-5397-422e-88a3-41673e09d93f",
      "email": "test@example.com",
      "is_verified": true
    }
  }
}
```

**Error Responses**:
- `400`: Missing email or password
- `401`: Invalid credentials or unverified user
- `500`: Server error

## 🔧 Postman Setup

### 1. Import Collection
1. Open Postman
2. Click "Import"
3. Select `LeadFinder_API.postman_collection.json`

### 2. Set Environment Variables
- `base_url`: `http://localhost:3000`
- `auth_token`: (auto-set after successful login)

### 3. Test Flow
1. **Login**: Run the "Login" request
   - Token automatically saved to `{{auth_token}}`
2. **Protected Routes**: Use `Bearer {{auth_token}}` in Authorization header

## 🧪 Test Scenarios

### Valid Login (Admin)
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"admin"}'
```

### Valid Login (Test User)
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"abhinay@gmail.com","password":"password"}'
```

### Invalid Password
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
```

### Missing Fields
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Using JWT Token (Example)
```bash
curl -X GET http://localhost:3000/api/protected-route \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## 📊 Database Schema

### Users Table
```sql
id          SERIAL PRIMARY KEY
uuid        UUID (unique identifier)
name        VARCHAR(255) 
email       VARCHAR(255) UNIQUE
password    VARCHAR(255) (bcrypt hashed)
is_verified BOOLEAN
is_active   BOOLEAN
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

### Tokens Table
```sql
id          SERIAL PRIMARY KEY
uuid        UUID (unique identifier)
user_uuid   UUID (foreign key to users)
token       VARCHAR(500)
token_type  VARCHAR(50)
expires_at  TIMESTAMP
is_active   BOOLEAN
created_at  TIMESTAMP
```

## 🔐 JWT Token Details

- **Algorithm**: HS256
- **Expiry**: 24 hours
- **Payload**: Contains user UUID and email
- **Storage**: Tokens stored in database for validation

## 🚨 Error Handling

All API responses follow this format:
```json
{
  "success": boolean,
  "message": "string",
  "data": object (only on success)
}
```

## 📝 Additional Notes

- All passwords are hashed using bcrypt
- JWT tokens are validated against database storage
- User must be verified and active to login
- Tokens are automatically cleaned up on expiry