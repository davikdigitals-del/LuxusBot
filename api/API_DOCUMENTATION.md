# 🔌 WhatsApp AI Assistant - API Documentation

Complete API reference for integrating with the multi-tenant WhatsApp AI Assistant backend.

**Base URL**: `http://localhost:3000/api` (development)  
**Production**: `https://your-domain.com/api`

---

## 📑 Table of Contents

1. [Authentication](#authentication)
2. [Business Management](#business-management)
3. [Team Management](#team-management)
4. [Conversations](#conversations)
5. [Knowledge Base](#knowledge-base)
6. [WhatsApp Management](#whatsapp-management)
7. [Analytics](#analytics)
8. [Settings](#settings)
9. [Error Handling](#error-handling)

---

## 🔐 Authentication

### Register New User

Creates a new user account and business.

```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "businessName": "Acme Corporation"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "_id": "user123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false
  },
  "business": {
    "_id": "biz123",
    "name": "Acme Corporation",
    "slug": "acme-corporation-a1b2c3",
    "subscription": {
      "plan": "free",
      "status": "trialing"
    }
  },
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "message": "Registration successful. Please verify your email."
}
```

---

### Login

Authenticate user and get tokens.

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "_id": "user123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "memberships": [
      {
        "businessId": "biz123",
        "role": "owner",
        "status": "active"
      }
    ]
  },
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

### Verify Email

Verify user's email address with token from email.

```http
POST /api/auth/verify-email
```

**Request Body:**
```json
{
  "token": "abc123def456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

### Forgot Password

Request password reset link.

```http
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "If your email is registered, you will receive a password reset link"
}
```

---

### Reset Password

Reset password with token from email.

```http
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### Refresh Token

Get new access token using refresh token.

```http
POST /api/auth/refresh-token
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

---

### Get Current User

Get authenticated user's information.

```http
GET /api/auth/me
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "_id": "user123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "https://...",
    "memberships": [
      {
        "businessId": "biz123",
        "role": "owner",
        "status": "active"
      }
    ],
    "preferences": {
      "defaultBusinessId": "biz123",
      "theme": "light",
      "language": "en"
    }
  }
}
```

---

### Change Password

Change user's password.

```http
POST /api/auth/change-password
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 🏢 Business Management

### Get All Businesses

Get all businesses current user belongs to.

```http
GET /api/business
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "businesses": [
    {
      "_id": "biz123",
      "name": "Acme Corporation",
      "slug": "acme-corporation-a1b2c3",
      "logo": "https://...",
      "primaryColor": "#3B82F6",
      "subscription": {
        "plan": "professional",
        "status": "active"
      },
      "whatsapp": {
        "status": "connected",
        "number": "+15551234567"
      },
      "userRole": "owner"
    }
  ]
}
```

---

### Get Single Business

Get detailed information about a business.

```http
GET /api/business/:id
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "business": {
    "_id": "biz123",
    "name": "Acme Corporation",
    "slug": "acme-corporation-a1b2c3",
    "logo": "https://...",
    "primaryColor": "#3B82F6",
    "timezone": "America/New_York",
    "contact": {
      "email": "support@acme.com",
      "phone": "+15551234567",
      "website": "https://acme.com"
    },
    "assistant": {
      "name": "Alex",
      "personality": "professional, helpful, friendly",
      "language": "en"
    },
    "aiConfig": {
      "provider": "auto",
      "temperature": 0.7,
      "maxTokens": 1000
    },
    "subscription": {
      "plan": "professional",
      "status": "active",
      "currentPeriodEnd": "2024-02-01T00:00:00.000Z"
    },
    "userRole": "owner"
  }
}
```

---

### Update Business

Update business information.

```http
PUT /api/business/:id
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Admin or Owner

**Request Body:**
```json
{
  "name": "Acme Corp Updated",
  "logo": "https://new-logo-url.com/logo.png",
  "primaryColor": "#10B981",
  "timezone": "America/Los_Angeles",
  "contact": {
    "email": "support@acme.com",
    "phone": "+15559876543"
  },
  "assistant": {
    "name": "Alex",
    "personality": "friendly, professional, witty"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "business": { /* updated business object */ },
  "message": "Business updated successfully"
}
```

---

### Update AI Configuration

Update AI provider settings.

```http
PUT /api/business/:id/ai-config
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Admin or Owner

**Request Body:**
```json
{
  "provider": "auto",
  "openaiKey": "sk-...",
  "anthropicKey": "sk-ant-...",
  "localEnabled": true,
  "temperature": 0.8,
  "maxTokens": 1500
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "AI configuration updated successfully"
}
```

---

### Get Usage Statistics

Get current usage and limits.

```http
GET /api/business/:id/usage
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "usage": {
    "messagesThisMonth": 1542,
    "knowledgeBaseSizeMB": 45.3,
    "teamMembers": 5,
    "apiCallsThisMonth": 823
  },
  "limits": {
    "messagesPerMonth": 10000,
    "maxKnowledgeBaseMB": 500,
    "maxTeamMembers": 10,
    "maxApiCallsPerMonth": 10000
  },
  "plan": "professional"
}
```

---

### Delete Business

Soft delete a business (owner only).

```http
DELETE /api/business/:id
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Owner

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Business deleted successfully"
}
```

---

## 👥 Team Management

### Get Team Members

Get all team members for a business.

```http
GET /api/business/:id/team
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "team": [
    {
      "user": {
        "_id": "user123",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://..."
      },
      "role": "owner",
      "status": "active",
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "lastActive": "2024-01-15T10:30:00.000Z"
    },
    {
      "user": {
        "_id": "user456",
        "email": "jane@example.com",
        "firstName": "Jane",
        "lastName": "Smith"
      },
      "role": "agent",
      "status": "pending",
      "invitedAt": "2024-01-14T00:00:00.000Z",
      "invitedBy": "user123"
    }
  ]
}
```

---

### Invite Team Member

Invite a new team member.

```http
POST /api/business/:id/team/invite
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Admin or Owner

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "agent"
}
```

**Roles**: `viewer`, `agent`, `admin`, `owner`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Invitation sent to newmember@example.com"
}
```

---

### Update Team Member Role

Change a team member's role.

```http
PUT /api/business/:id/team/:userId
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Owner

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Role updated successfully"
}
```

---

### Remove Team Member

Remove a team member from the business.

```http
DELETE /api/business/:id/team/:userId
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Admin or Owner

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Team member removed successfully"
}
```

---

## 💬 Conversations

### Get Conversations

Get paginated list of conversations.

```http
GET /api/conversations?page=1&limit=20&status=active&search=keyword
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status (`active`, `resolved`, `archived`)
- `search` (optional): Search in messages
- `sentiment` (optional): Filter by sentiment
- `assignedTo` (optional): Filter by assigned agent

**Response (200 OK):**
```json
{
  "success": true,
  "conversations": [
    {
      "_id": "conv123",
      "userId": {
        "_id": "customer1",
        "name": "John Customer",
        "phoneNumber": "+15551234567"
      },
      "lastMessage": {
        "text": "Thank you for your help!",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "direction": "incoming"
      },
      "status": "resolved",
      "sentiment": "positive",
      "messageCount": 15,
      "assignedTo": "agent123",
      "tags": ["support", "billing"],
      "createdAt": "2024-01-15T09:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

---

### Get Single Conversation

Get detailed conversation with full message history.

```http
GET /api/conversations/:id
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "conversation": {
    "_id": "conv123",
    "userId": {
      "_id": "customer1",
      "name": "John Customer",
      "phoneNumber": "+15551234567",
      "email": "john@example.com"
    },
    "messages": [
      {
        "_id": "msg1",
        "text": "Hi, I need help with my order",
        "direction": "incoming",
        "timestamp": "2024-01-15T09:00:00.000Z",
        "type": "text"
      },
      {
        "_id": "msg2",
        "text": "Hello! I'd be happy to help with your order. Could you provide your order number?",
        "direction": "outgoing",
        "timestamp": "2024-01-15T09:00:15.000Z",
        "type": "text",
        "aiGenerated": true,
        "provider": "openai"
      }
    ],
    "status": "active",
    "sentiment": "neutral",
    "assignedTo": null,
    "tags": ["support"],
    "notes": [
      {
        "userId": "agent123",
        "text": "Customer seems frustrated, escalate if needed",
        "timestamp": "2024-01-15T09:05:00.000Z"
      }
    ]
  }
}
```

---

### Send Manual Message

Send a manual message in a conversation.

```http
POST /api/conversations/:id/message
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Agent, Admin, or Owner

**Request Body:**
```json
{
  "text": "I've checked your order and it's on the way!",
  "type": "text"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": {
    "_id": "msg123",
    "text": "I've checked your order and it's on the way!",
    "direction": "outgoing",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "sentBy": "user123"
  }
}
```

---

### Assign Conversation

Assign conversation to an agent.

```http
PUT /api/conversations/:id/assign
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Request Body:**
```json
{
  "assignTo": "agent123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Conversation assigned successfully"
}
```

---

### Add Note to Conversation

Add an internal note.

```http
POST /api/conversations/:id/notes
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Request Body:**
```json
{
  "text": "Customer mentioned they're a VIP member"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "note": {
    "userId": "user123",
    "text": "Customer mentioned they're a VIP member",
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## 📚 Knowledge Base

### Upload Document

Upload a document to knowledge base.

```http
POST /api/knowledge/upload
Authorization: Bearer {token}
X-Business-ID: {businessId}
Content-Type: multipart/form-data
```

**Required Role**: Agent, Admin, or Owner

**Form Data:**
- `file`: Document file (PDF, DOCX, TXT, MD)
- `title`: Document title
- `category`: Category (optional)
- `tags`: Comma-separated tags (optional)

**Response (201 Created):**
```json
{
  "success": true,
  "document": {
    "_id": "doc123",
    "title": "Product FAQ",
    "category": "Support",
    "tags": ["faq", "products"],
    "filename": "product-faq.pdf",
    "size": 2048576,
    "status": "processing",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### Get Documents

Get all knowledge base documents.

```http
GET /api/knowledge?page=1&limit=20&category=Support
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "documents": [
    {
      "_id": "doc123",
      "title": "Product FAQ",
      "category": "Support",
      "tags": ["faq", "products"],
      "filename": "product-faq.pdf",
      "size": 2048576,
      "status": "ready",
      "chunkCount": 45,
      "uploadedBy": "user123",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1
  }
}
```

---

### Search Knowledge Base

Search documents by query.

```http
GET /api/knowledge/search?q=refund%20policy&limit=5
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "results": [
    {
      "document": {
        "_id": "doc123",
        "title": "Refund Policy"
      },
      "content": "Our refund policy allows returns within 30 days...",
      "score": 0.92
    }
  ]
}
```

---

### Delete Document

Delete a document from knowledge base.

```http
DELETE /api/knowledge/:id
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Admin or Owner

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

## 📱 WhatsApp Management

### Get WhatsApp Status

Get current WhatsApp connection status.

```http
GET /api/whatsapp/status
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": {
    "connected": true,
    "number": "+15551234567",
    "platform": "android",
    "lastConnected": "2024-01-15T08:00:00.000Z",
    "health": {
      "messagesSent": 1542,
      "messagesReceived": 2103,
      "errors": 2,
      "lastPing": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### Get QR Code

Get QR code for WhatsApp connection.

```http
GET /api/whatsapp/qr
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "expiresAt": "2024-01-15T10:05:00.000Z"
}
```

---

### Disconnect WhatsApp

Disconnect WhatsApp session.

```http
POST /api/whatsapp/disconnect
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Admin or Owner

**Response (200 OK):**
```json
{
  "success": true,
  "message": "WhatsApp disconnected successfully"
}
```

---

## 📊 Analytics

### Get Dashboard Stats

Get overview statistics.

```http
GET /api/analytics/dashboard?period=7d
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Parameters:**
- `period`: `24h`, `7d`, `30d`, `90d`

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "messages": {
      "total": 1542,
      "incoming": 892,
      "outgoing": 650,
      "change": 12.5
    },
    "conversations": {
      "total": 234,
      "active": 45,
      "resolved": 189,
      "avgDuration": 15.3
    },
    "satisfaction": {
      "score": 4.2,
      "responses": 156
    },
    "aiUsage": {
      "totalTokens": 125000,
      "cost": 12.50,
      "providers": {
        "local": 45,
        "openai": 35,
        "anthropic": 20
      }
    }
  }
}
```

---

### Get Message Analytics

Get detailed message analytics.

```http
GET /api/analytics/messages?period=30d&groupBy=day
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-01",
      "incoming": 45,
      "outgoing": 38,
      "total": 83
    },
    {
      "date": "2024-01-02",
      "incoming": 52,
      "outgoing": 41,
      "total": 93
    }
  ]
}
```

---

### Get Sentiment Analysis

Get sentiment distribution.

```http
GET /api/analytics/sentiment?period=30d
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "sentiment": {
    "very_positive": 23,
    "positive": 45,
    "neutral": 67,
    "negative": 12,
    "very_negative": 3
  }
}
```

---

### Export Analytics

Export analytics data as CSV.

```http
GET /api/analytics/export?period=30d&type=messages
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="analytics-2024-01-15.csv"

Date,Incoming,Outgoing,Total
2024-01-01,45,38,83
2024-01-02,52,41,93
...
```

---

## ⚙️ Settings

### Get Business Settings

Get all business settings.

```http
GET /api/settings
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "settings": {
    "general": {
      "name": "Acme Corporation",
      "logo": "https://...",
      "timezone": "America/New_York"
    },
    "assistant": {
      "name": "Alex",
      "personality": "professional, helpful",
      "language": "en"
    },
    "businessHours": {
      "enabled": true,
      "schedule": { /* ... */ },
      "outOfHoursMessage": "We're currently closed..."
    }
  }
}
```

---

### Update Settings

Update business settings.

```http
PUT /api/settings
Authorization: Bearer {token}
X-Business-ID: {businessId}
```

**Required Role**: Admin or Owner

**Request Body:**
```json
{
  "assistant": {
    "name": "Alex",
    "personality": "friendly, professional, witty"
  },
  "businessHours": {
    "enabled": true,
    "schedule": {
      "monday": { "start": "09:00", "end": "17:00", "enabled": true },
      "tuesday": { "start": "09:00", "end": "17:00", "enabled": true }
    }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

---

## ❌ Error Handling

All API errors follow this format:

**Error Response:**
```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { /* optional additional info */ }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### Common Error Codes

- `INVALID_CREDENTIALS` - Login failed
- `EMAIL_EXISTS` - Email already registered
- `TOKEN_EXPIRED` - JWT token expired
- `INSUFFICIENT_PERMISSIONS` - User doesn't have required role
- `BUSINESS_NOT_FOUND` - Business doesn't exist
- `USAGE_LIMIT_EXCEEDED` - Plan limit reached
- `VALIDATION_ERROR` - Invalid request data

---

## 🔑 Authentication Headers

All protected endpoints require:

```
Authorization: Bearer {jwt_token}
X-Business-ID: {businessId}
```

**Example:**
```bash
curl -X GET \
  https://api.yourdomain.com/api/conversations \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'X-Business-ID: 507f1f77bcf86cd799439011'
```

---

## 🚀 Rate Limiting

API requests are rate-limited:

- **Free Plan**: 100 requests/hour
- **Starter Plan**: 1,000 requests/hour
- **Professional Plan**: 10,000 requests/hour
- **Enterprise Plan**: Unlimited

**Rate Limit Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642348800
```

---

## 📦 Pagination

List endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response includes:**
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

---

## 🔍 Filtering & Sorting

List endpoints support filtering:

```http
GET /api/conversations?status=active&sentiment=positive&sort=-createdAt
```

**Common filters:**
- `status`: Filter by status
- `search`: Search in text fields
- `sort`: Sort by field (prefix `-` for descending)
- `dateFrom`: Start date
- `dateTo`: End date

---

## 💡 Best Practices

1. **Always include error handling** in your frontend
2. **Store tokens securely** (httpOnly cookies recommended)
3. **Refresh tokens before expiry** using `/api/auth/refresh-token`
4. **Include X-Business-ID** header for all business-scoped requests
5. **Implement exponential backoff** for retries
6. **Cache responses** when appropriate
7. **Use pagination** for large lists
8. **Validate input** on frontend before API calls

---

## 📞 Support

**Need help?**
- 📖 Full Documentation: https://docs.yourdomain.com
- 💬 Discord: https://discord.gg/yourserver
- 📧 Email: support@yourdomain.com

---

**API Version**: 1.0.0  
**Last Updated**: January 2024  
**Base URL**: `https://api.yourdomain.com/api`
