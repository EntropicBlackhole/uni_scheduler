// index.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL, 
	ssl: { rejectUnauthorized: false },
});

// Config via env
const PROXY_BASE = process.env.PROXY_BASE || 'https://horext.octatec.io/api/';

// ensure schedules dir
const SCHEDULE_DIR = path.join(__dirname, 'schedules');
fs.mkdirSync(SCHEDULE_DIR, { recursive: true });

// 1> Save schedule
app.post('/saveSchedule', async (req, res) => {
  const { name, studentCode, schedule } = req.body;
  if (!name || !studentCode || !schedule) {
    return res.status(400).json({ status: 'Missing fields' });
	}
console.log(schedule)
console.log(typeof schedule)
//	schedule = JSON.parse(schedule); //test
  try {
console.log("pre-query")
console.log("Saving schedule:", JSON.stringify(schedule));
    await pool.query(
      `INSERT INTO schedules (student_code, name, schedule)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_code) DO UPDATE
       SET name = EXCLUDED.name, schedule = EXCLUDED.schedule`,
      [studentCode, name, JSON.stringify(schedule)]
		);
console.log("post-query")
		
    res.json({ status: 'OK', savedTo: 'db' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/wakeup', async (req, res) => {
	console.log("despiertate sesamo")
	res.json({ status: "OK"})
})

// 2> Load schedule
app.get('/loadSchedule/:studentCode', async (req, res) => {
	try {
		const { rows } = await pool.query(
			'SELECT * FROM schedules WHERE student_code = $1',
			[req.params.studentCode]
		);
		if (!rows.length) return res.status(404).json({ status: 'not found' });
		res.json({ status: 'OK', data: rows[0] });
	} catch (err) {
		console.error(err);
		res.status(500).json({ status: 'error', message: err.message });
	}
});

// 3> Proxy for /api/* -> PROXY_BASE + path
// !! note: using * kinda breaks some regexp route inside one of the node modules for some reason so don't use it
app.use('/api', async (req, res) => {
	try {
		// build target path from originalUrl after /api/
		const targetPath = req.originalUrl.replace(/^\/api\//, '');
		const url = PROXY_BASE + targetPath;
		console.log('Proxying to:', url);

		const fetchRes = await fetch(url);
		const text = await fetchRes.text();

		// forward content-type
		const contentType = fetchRes.headers.get('content-type') || 'text/plain';
		res.set('Content-Type', contentType);
		return res.send(text);
	} catch (err) {
		console.error('Proxy error', err);
		return res
			.status(500)
			.json({ error: 'Proxy failed', message: err.message });
	}
});

// 4> (Optional) Serve static frontend placed in /public
app.use(express.static(path.join(__dirname, 'public')));

// finally start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://0.0.0.0:${PORT}`));

// Ensure schedules table exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id SERIAL PRIMARY KEY,
      student_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      schedule JSONB NOT NULL
    );
  `);
})();
