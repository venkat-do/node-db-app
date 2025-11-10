// Load environment variables from .env file if it exists (for local development only)
// The try/catch ensures the app works even if dotenv is not installed (production)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed or .env file doesn't exist - that's fine for production
}

const express = require('express');
const { Pool } = require('pg');
const app = express();

// Configuration with sensible defaults
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'production';

// Database connection configuration
// Supports both DATABASE_URL and individual connection parameters
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    console.log('App will continue but database operations will fail');
  } else {
    console.log('Database connected successfully at', res.rows[0].now);
  }
});

// Initialize database schema
async function initializeDatabase() {
  try {
    // Create products table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        customer_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if we need to seed data
    const result = await pool.query('SELECT COUNT(*) FROM products');
    const productCount = parseInt(result.rows[0].count);

    if (productCount === 0) {
      // Seed some initial data
      const products = [
        ['Laptop', 'High-performance laptop', 1299.99, 50, 'Electronics'],
        ['Smartphone', 'Latest model smartphone', 899.99, 100, 'Electronics'],
        ['Headphones', 'Wireless noise-cancelling', 299.99, 200, 'Audio'],
        ['Monitor', '27-inch 4K display', 499.99, 75, 'Electronics'],
        ['Keyboard', 'Mechanical gaming keyboard', 149.99, 150, 'Accessories'],
        ['Mouse', 'Ergonomic wireless mouse', 79.99, 180, 'Accessories'],
        ['Tablet', '10-inch tablet', 449.99, 90, 'Electronics'],
        ['Webcam', '1080p HD webcam', 89.99, 120, 'Accessories'],
        ['Speaker', 'Bluetooth portable speaker', 129.99, 140, 'Audio'],
        ['Charger', 'USB-C fast charger', 39.99, 300, 'Accessories']
      ];

      for (const product of products) {
        await pool.query(
          'INSERT INTO products (name, description, price, stock, category) VALUES ($1, $2, $3, $4, $5)',
          product
        );
      }
      console.log('Database seeded with initial data');
    }
  } catch (err) {
    console.error('Error initializing database:', err.message);
  }
}

// Initialize database on startup
initializeDatabase();

// Middleware
app.use(express.json());

// Anti-cache middleware
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      uptime: process.uptime(),
      database: 'connected',
      dbTime: dbCheck.rows[0].now,
      version: '1.0.0',
      requestId: Math.random().toString(36).substring(7)
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message,
      requestId: Math.random().toString(36).substring(7)
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Node.js DB App!',
    timestamp: new Date().toISOString(),
    timestampMs: Date.now(),
    random: Math.random(),
    requestId: Math.random().toString(36).substring(7),
    endpoints: [
      'GET / - This endpoint',
      'GET /health - Health check with database status',
      'GET /api/products - Get all products (with filtering)',
      'GET /api/products/:id - Get product by ID',
      'GET /api/orders - Get recent orders',
      'POST /api/orders - Create a new order',
      'GET /api/stats - Get database statistics'
    ]
  });
});

// Get all products with optional filtering and processing
app.get('/api/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, inStock } = req.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (minPrice) {
      query += ` AND price >= $${paramCount}`;
      params.push(parseFloat(minPrice));
      paramCount++;
    }

    if (maxPrice) {
      query += ` AND price <= $${paramCount}`;
      params.push(parseFloat(maxPrice));
      paramCount++;
    }

    if (inStock === 'true') {
      query += ' AND stock > 0';
    }

    // Use ORDER BY random() to prevent PostgreSQL query caching
    // This forces a full table scan and prevents cached execution plans
    // Essential for accurate load testing of database performance
    query += ' ORDER BY random() LIMIT 10';

    const result = await pool.query(query, params);

    // Add some processing to mimic real-world computation
    const processedProducts = result.rows.map(product => ({
      ...product,
      priceWithTax: (parseFloat(product.price) * 1.1).toFixed(2),
      availability: product.stock > 0 ? 'In Stock' : 'Out of Stock',
      stockLevel: product.stock > 100 ? 'High' : product.stock > 50 ? 'Medium' : 'Low',
      discount: product.stock > 150 ? 10 : 0
    }));

    res.json({
      success: true,
      count: processedProducts.length,
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(7),
      data: processedProducts
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        timestamp: new Date().toISOString()
      });
    }

    const product = result.rows[0];

    // Fetch related orders for this product
    const ordersResult = await pool.query(
      'SELECT COUNT(*) as order_count, SUM(quantity) as total_sold FROM orders WHERE product_id = $1',
      [id]
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(7),
      data: {
        ...product,
        priceWithTax: (parseFloat(product.price) * 1.1).toFixed(2),
        orderCount: parseInt(ordersResult.rows[0].order_count) || 0,
        totalSold: parseInt(ordersResult.rows[0].total_sold) || 0
      }
    });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get recent orders
app.get('/api/orders', async (req, res) => {
  try {
    const limit = req.query.limit || 20;

    const result = await pool.query(`
      SELECT o.*, p.name as product_name, p.price as product_price
      FROM orders o
      JOIN products p ON o.product_id = p.id
      ORDER BY o.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      count: result.rows.length,
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(7),
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create a new order (with stock validation and processing)
app.post('/api/orders', async (req, res) => {
  const client = await pool.connect();

  try {
    const { productId, customerName, quantity } = req.body;

    if (!productId || !customerName || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: productId, customerName, quantity',
        timestamp: new Date().toISOString()
      });
    }

    await client.query('BEGIN');

    // Check product availability
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        timestamp: new Date().toISOString()
      });
    }

    const product = productResult.rows[0];

    if (product.stock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock',
        available: product.stock,
        requested: quantity,
        timestamp: new Date().toISOString()
      });
    }

    // Calculate total price
    const totalPrice = (parseFloat(product.price) * quantity).toFixed(2);

    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (product_id, customer_name, quantity, total_price, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [productId, customerName, quantity, totalPrice, 'confirmed']
    );

    // Update product stock
    await client.query(
      'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [quantity, productId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(7),
      data: {
        order: orderResult.rows[0],
        product: {
          id: product.id,
          name: product.name,
          remainingStock: product.stock - quantity
        }
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
  try {
    const productCount = await pool.query('SELECT COUNT(*) FROM products');
    const orderCount = await pool.query('SELECT COUNT(*) FROM orders');
    const totalRevenue = await pool.query('SELECT SUM(total_price) FROM orders');
    const topProducts = await pool.query(`
      SELECT p.name, COUNT(o.id) as order_count, SUM(o.quantity) as total_sold
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id
      GROUP BY p.id, p.name
      ORDER BY order_count DESC
      LIMIT 5
    `);
    const lowStock = await pool.query('SELECT COUNT(*) FROM products WHERE stock < 50');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(7),
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      database: {
        totalProducts: parseInt(productCount.rows[0].count),
        totalOrders: parseInt(orderCount.rows[0].count),
        totalRevenue: parseFloat(totalRevenue.rows[0].sum) || 0,
        lowStockProducts: parseInt(lowStock.rows[0].count),
        topProducts: topProducts.rows
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong!',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connections...');
  await pool.end();
  process.exit(0);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Node.js DB App running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Using environment config'}`);
});

module.exports = app;

