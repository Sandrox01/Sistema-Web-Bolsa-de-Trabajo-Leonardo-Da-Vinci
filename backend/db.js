const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:             process.env.DB_HOST     || 'localhost',
    user:             process.env.DB_USER     || 'root',
    password:         process.env.DB_PASSWORD || '',
    database:         process.env.DB_NAME     || 'bolsa_trabajo_ldv',
    waitForConnections: true,
    connectionLimit:  10,
    queueLimit:       0,
    charset:          'utf8mb4'
});

pool.getConnection()
    .then(conn => { console.log('✅ Base de datos conectada'); conn.release(); })
    .catch(err => console.error('❌ Error BD:', err.message));

module.exports = pool;
