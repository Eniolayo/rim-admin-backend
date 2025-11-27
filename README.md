# RIM Admin Backend

Backend API for RIM Admin application built with NestJS, TypeORM, PostgreSQL, and JWT authentication.

## Features

- ✅ NestJS framework
- ✅ PostgreSQL database with TypeORM
- ✅ JWT authentication
- ✅ Pino logging
- ✅ Docker & Docker Compose setup
- ✅ Swagger API documentation
- ✅ Environment-based configuration
- ✅ Input validation with class-validator

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm or yarn

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=rim_db

JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters
JWT_REFRESH_EXPIRATION=7d
```

### 3. Run with Docker Compose

For development:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

For production:

```bash
docker-compose up --build
```

### 4. Run Locally (without Docker)

Start PostgreSQL first, then:

```bash
npm run start:dev
```

## API Documentation

Once the server is running, access Swagger documentation at:

```
http://localhost:3000/api/docs
```

### Swagger Password Protection

Swagger documentation can be password protected using HTTP Basic Authentication. To enable this, set the following environment variables:

```bash
SWAGGER_USERNAME=your_username
SWAGGER_PASSWORD=your_password
```

If these environment variables are set, you'll be prompted for credentials when accessing the Swagger UI. If they're not set, Swagger will be accessible without authentication (useful for development).

**Note:** It's recommended to set these credentials in production environments to protect your API documentation.

## Database Migrations

### Local Development (without Docker)

```bash
# Generate migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### With Docker (Development)

```bash
# Generate migration
npm run migration:generate:docker:dev -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run:docker:dev

# Revert migration
npm run migration:revert:docker:dev
```

### With Docker (Production)

```bash
# Generate migration
npm run migration:generate:docker -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run:docker

# Revert migration
npm run migration:revert:docker
```

## Project Structure

```
src/
├── modules/              # Feature modules
│   └── auth/            # Authentication module
│       ├── controllers/ # Auth controllers
│       ├── dto/         # Data transfer objects
│       ├── guards/      # Auth guards
│       ├── repositories/# Data access layer
│       ├── services/    # Business logic
│       ├── strategies/  # Passport strategies
│       └── decorators/ # Custom decorators
├── config/              # Configuration files
├── common/              # Shared modules
│   └── logger/         # Pino logger setup
├── database/            # Database configuration
│   └── migrations/      # TypeORM migrations
├── entities/            # TypeORM entities
└── main.ts              # Application entry point
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with email and password
- `GET /api/auth/me` - Get current authenticated user (requires JWT)

## Development

### Code Style

The project uses ESLint and Prettier. Run:

```bash
npm run lint
npm run format
```

### Testing

```bash
npm run test
npm run test:watch
npm run test:cov
```

## Environment Variables

| Variable                 | Description                                       | Default       |
| ------------------------ | ------------------------------------------------- | ------------- |
| `NODE_ENV`               | Environment (development/production/test/staging) | `development` |
| `PORT`                   | Server port                                       | `3000`        |
| `API_PREFIX`             | API route prefix                                  | `api`         |
| `DB_HOST`                | PostgreSQL host                                   | `localhost`   |
| `DB_PORT`                | PostgreSQL port                                   | `5432`        |
| `DB_USERNAME`            | PostgreSQL username                               | `postgres`    |
| `DB_PASSWORD`            | PostgreSQL password                               | `postgres`    |
| `DB_NAME`                | Database name                                     | `rim_db`      |
| `JWT_SECRET`             | JWT secret key (min 32 chars)                     | Required      |
| `JWT_EXPIRATION`         | JWT expiration time                               | `1h`          |
| `JWT_REFRESH_SECRET`     | JWT refresh secret (min 32 chars)                 | Required      |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiration                          | `7d`          |

## License

UNLICENSED
