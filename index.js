// index.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Config via env
const PROXY_BASE = process.env.PROXY_BASE || 'https://horext.octatec.io/api/';

// ensure schedules dir
const SCHEDULE_DIR = path.join(__dirname, 'schedules');
fs.mkdirSync(SCHEDULE_DIR, { recursive: true });

// 1) Save schedule
app.post('/saveSchedule', (req, res) => {
	const { name, studentCode, schedule } = req.body;
	if (!name || !studentCode || !schedule) {
		return res.status(400).json({ status: 'Missing fields' });
	}
	const filename = path.join(SCHEDULE_DIR, `${studentCode}.json`);
	try {
		fs.writeFileSync(
			filename,
			JSON.stringify({ name, studentCode, schedule }, null, 2)
		);
		return res.json({ status: 'OK', savedTo: filename });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ status: 'error', message: err.message });
	}
});

// 2) Load schedule
app.get('/loadSchedule/:studentCode', (req, res) => {
	const studentCode = req.params.studentCode;
	const filename = path.join(SCHEDULE_DIR, `${studentCode}.json`);
	if (!fs.existsSync(filename))
		return res.status(404).json({ status: 'not found' });
	try {
		const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
		return res.json({ status: 'OK', data });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ status: 'error', message: err.message });
	}
});

// 3) Proxy for /api/* -> PROXY_BASE + path
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

// 4) (Optional) Serve static frontend placed in /public
app.use(express.static(path.join(__dirname, 'public')));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://0.0.0.0:${PORT}`));
