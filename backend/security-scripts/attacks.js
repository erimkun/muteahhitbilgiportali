/*
 * This script demonstrates simulated SQL injection attacks against the system.
 * It sends malicious inputs to a hypothetical endpoint to test for SQL injection vulnerabilities.
 * Note: The system uses parameterized queries via sqlite3, which helps mitigate SQL injection risks.
 * 
 * Usage: Run this script with Node.js (e.g., node attacks.js).
 * Adjust the URL and endpoint as needed to target specific parts of your API.
 */

const fetch = require('node-fetch').default; // Ensure node-fetch is installed: npm install node-fetch

async function testSqlInjection() {
    // Example SQL injection payloads
    const payloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "'; SELECT * FROM users; --",
        "' OR 1=1 --"
    ];

    for (const payload of payloads) {
        try {
            // The login endpoint is a good candidate for testing SQL injection.
            // We will target the project search endpoint which takes a project code.
            // Use environment variable for API base URL in tests
            const apiBase = process.env.API_BASE_URL || 'http://localhost:3001';
            const response = await fetch(`${apiBase}/projects/code/${encodeURIComponent(payload)}`);
            const text = await response.text();
            console.log(`Payload: ${payload}`);
            console.log(`Response: ${text}`);
            console.log('---------------------------');
        } catch (err) {
            console.error(`Error with payload ${payload}: `, err);
        }
    }
}

testSqlInjection();
