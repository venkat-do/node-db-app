# Node.js DB App

A Node.js Express application with PostgreSQL integration designed for benchmarking real-world database operations.

## Features

- **PostgreSQL Integration**: Full CRUD operations with transaction support
- **Real-world Processing**: Product catalog, order management, and inventory tracking
- **Anti-cache Headers**: Ensures proper benchmarking without cached responses
- **Database Connection Pooling**: Optimized for concurrent requests
- **Auto-initialization**: Automatically creates schema and seeds data on first run
- **Platform Agnostic**: Works on DigitalOcean App Platform and Koyeb without modifications

## Prerequisites

- Node.js 16 or higher
- PostgreSQL database (12 or higher recommended)

## Environment Variables

The app requires a PostgreSQL database connection. Set the following environment variable:

```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

## Installation

```bash
npm install
```

## Running Locally

1. Set up a PostgreSQL database
2. Create a `.env` file in the project root (or set environment variables):
   ```bash
   DATABASE_URL=postgresql://username:password@host:port/database
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

The app will automatically:
- Create the necessary tables (products, orders)
- Seed initial product data
- Start listening on the configured port

## API Endpoints

### Health Check
- `GET /health` - Returns health status and database connectivity

### Products
- `GET /api/products` - Get all products with optional filtering
  - Query params: `category`, `minPrice`, `maxPrice`, `inStock`
- `GET /api/products/:id` - Get a specific product with order statistics

### Orders
- `GET /api/orders` - Get recent orders (default: 20)
  - Query params: `limit`
- `POST /api/orders` - Create a new order
  - Body: `{ "productId": 1, "customerName": "John Doe", "quantity": 2 }`

### Statistics
- `GET /api/stats` - Get comprehensive database and server statistics

## Database Schema

### Products Table
- id (SERIAL PRIMARY KEY)
- name (VARCHAR)
- description (TEXT)
- price (DECIMAL)
- stock (INTEGER)
- category (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Orders Table
- id (SERIAL PRIMARY KEY)
- product_id (INTEGER FK)
- customer_name (VARCHAR)
- quantity (INTEGER)
- total_price (DECIMAL)
- status (VARCHAR)
- created_at (TIMESTAMP)

## Deployment

### DigitalOcean App Platform

1. Add a PostgreSQL database to your app
2. The DATABASE_URL will be automatically provided
3. Deploy with automatic build detection

### Koyeb

1. Create a PostgreSQL database service or use an external provider
2. Set the DATABASE_URL environment variable in your service settings
3. Deploy from your Git repository

## Benchmarking

This app is designed to provide realistic database operations for benchmarking:

- **No caching**: All responses include anti-cache headers and dynamic timestamps
- **Database queries**: Every request performs actual database operations
- **Transaction processing**: Order creation uses database transactions
- **Realistic computation**: Product endpoints include price calculations and stock level processing
- **Connection pooling**: Optimized for high concurrency testing

## License

MIT

