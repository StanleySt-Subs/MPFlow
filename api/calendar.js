const ical = require('node-ical');
const { getSession, getUsers } = require('./_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = getSession(req);
    if (!user) { res.status(401).json({ error: 'Not logged in' }); return; }

    const users = await getUsers();
    const dbUser = users.find(u => u.email === user.email);
    
    if (!dbUser || !dbUser.calUrl) {
      res.status(200).json([]);
      return;
    }

    // Fetch and parse the iCal feed
    const events = await ical.async.fromURL(dbUser.calUrl);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysEvents = [];
    
    for (const key in events) {
      const ev = events[key];
      if (ev.type === 'VEVENT') {
        const start = new Date(ev.start);
        const end = new Date(ev.end);
        
        // Basic check if event overlaps with today
        if (start < tomorrow && end > today) {
          todaysEvents.push({
            title: ev.summary || 'Meeting',
            start: start.toISOString(),
            end: end.toISOString()
          });
        }
      }
    }
    
    // Sort chronologically
    todaysEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.status(200).json(todaysEvents);
  } catch (e) {
    console.error('Calendar error:', e);
    // If it fails, return empty array so we don't break the dashboard
    res.status(200).json([]); 
  }
};
