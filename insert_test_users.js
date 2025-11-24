const bcrypt = require('bcryptjs');
const db = require('./config/dbconnection');

async function insertTestUsers() {
    try {
        console.log('Connecting to database...');

        // Hash passwords
        const adminPasswordHash = await bcrypt.hash('admin', 10);
        const testPasswordHash = await bcrypt.hash('password', 10);

        console.log('Inserting admin user...');
        // Insert admin user
        await db.query(`
            INSERT INTO users (name, email, password, is_verified, is_active)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            password = EXCLUDED.password
        `, ['Admin User', 'admin@gmail.com', adminPasswordHash, true, true]);

        console.log('Inserting test user...');
        // Insert test user
        await db.query(`
            INSERT INTO users (name, email, password, is_verified, is_active)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            password = EXCLUDED.password
        `, ['Abhinay kumar mishra', 'abhinay@gmail.com', testPasswordHash, true, true]);

        console.log('Test users inserted successfully!');

        // Verify users were inserted
        const result = await db.query('SELECT uuid, name, email, is_verified, is_active FROM users WHERE email IN ($1, $2)',
            ['admin@gmail.com', 'abhinay@gmail.com']);

        console.log('Inserted users:');
        result.rows.forEach(user => {
            console.log(`- ${user.name} (${user.email}) - UUID: ${user.uuid}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error inserting test users:', error);
        process.exit(1);
    }
}

insertTestUsers();