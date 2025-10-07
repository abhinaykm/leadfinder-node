const db = require('./config/dbconnection');

async function insertTestSearches() {
    try {
        console.log('Connecting to database...');

        // Get the user UUID for abhinay@gmail.com
        const userQuery = 'SELECT uuid FROM users WHERE email = $1';
        const userResult = await db.query(userQuery, ['abhinay@gmail.com']);

        if (userResult.rows.length === 0) {
            console.error('User not found! Please run insert_test_users.js first');
            process.exit(1);
        }

        const userUuid = userResult.rows[0].uuid;
        console.log('User UUID:', userUuid);

        // Sample search data
        const searchData = [
            {
                query: 'Restaurants',
                address: 'New York, NY',
                radius: 5,
                category: 'business_leads',
                results: {
                    keyword: 'Restaurants',
                    location: 'New York, NY',
                    results_count: 25,
                    searched_by: 'test_user',
                    searched_at: new Date()
                }
            },
            {
                query: 'Coffee Shops',
                address: 'San Francisco, CA',
                radius: 10,
                category: 'business_leads',
                results: {
                    keyword: 'Coffee Shops',
                    location: 'San Francisco, CA',
                    results_count: 15,
                    searched_by: 'test_user',
                    searched_at: new Date()
                }
            },
            {
                query: 'Hotels',
                address: 'Los Angeles, CA',
                radius: 15,
                category: 'business_leads',
                results: {
                    keyword: 'Hotels',
                    location: 'Los Angeles, CA',
                    results_count: 30,
                    searched_by: 'test_user',
                    searched_at: new Date()
                }
            },
            {
                query: 'Gyms',
                address: 'Chicago, IL',
                radius: 8,
                category: 'business_leads',
                results: {
                    keyword: 'Gyms',
                    location: 'Chicago, IL',
                    results_count: 12,
                    searched_by: 'test_user',
                    searched_at: new Date()
                }
            },
            {
                query: 'Salons',
                address: 'Miami, FL',
                radius: 5,
                category: 'business_leads',
                results: {
                    keyword: 'Salons',
                    location: 'Miami, FL',
                    results_count: 20,
                    searched_by: 'test_user',
                    searched_at: new Date()
                }
            }
        ];

        console.log('Inserting test searches...');

        for (const search of searchData) {
            const insertQuery = `
                INSERT INTO searches (user_uuid, query, address, radius, category, results, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING uuid, query, created_at
            `;

            const result = await db.query(insertQuery, [
                userUuid,
                search.query,
                search.address,
                search.radius,
                search.category,
                JSON.stringify(search.results)
            ]);

            console.log(`✓ Inserted: ${result.rows[0].query} (${result.rows[0].uuid})`);
        }

        console.log('\n✅ Test searches inserted successfully!');

        // Verify searches were inserted
        const countQuery = 'SELECT COUNT(*) FROM searches WHERE user_uuid = $1';
        const countResult = await db.query(countQuery, [userUuid]);
        console.log(`Total searches for user: ${countResult.rows[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('Error inserting test searches:', error);
        process.exit(1);
    }
}

insertTestSearches();
