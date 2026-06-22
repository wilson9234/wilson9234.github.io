const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());
app.use(express.static('public'));

// db settings come from env vars in production, local defaults otherwise.
// set DB_SSL=true only if the host needs it (railway mysql does not).
const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'vetcare_pro',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'vetcare_pro_secret_change_this';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Please log in first.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}

app.get('/api/services', async (req, res) => {
  try {
    const [services] = await db.query('SELECT * FROM Service WHERE is_active = TRUE ORDER BY category, name');
    res.json(services);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not load services.' });
  }
});

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message, website } = req.body;
  if (website) return res.status(201).json({ message: 'Message sent.' });
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: 'Please fill in all fields.' });
  }
  try {
    await db.query(
      'INSERT INTO ContactMessage (full_name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject, message]
    );
    res.status(201).json({ message: 'Message sent. We will get back to you soon.' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, email, phone, password, confirmPassword } = req.body;
  if (!name || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Please fill in all fields.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  try {
    const [existing] = await db.query('SELECT user_id FROM User WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO User (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, 'owner', phone]
    );
    await db.query('INSERT INTO Owner (user_id) VALUES (?)', [result.insertId]);
    res.status(201).json({ message: 'Account created. Please log in.' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter your email and password.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM User WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Wrong email or password.' });
    }
    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Wrong email or password.' });
    }
    const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '8h' });
    res.json({
      message: 'Login successful.',
      token: token,
      user: { id: user.user_id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

app.get('/api/vets', async (req, res) => {
  try {
    const [vets] = await db.query(
      `SELECT v.vet_id, u.name, v.specialisation
       FROM Veterinarian v JOIN User u ON v.user_id = u.user_id ORDER BY u.name`
    );
    res.json(vets);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not load vets.' });
  }
});

app.get('/api/appointments', authenticate, async (req, res) => {
  try {
    const [owners] = await db.query('SELECT owner_id FROM Owner WHERE user_id = ?', [req.userId]);
    if (owners.length === 0) return res.json([]);
    const [appointments] = await db.query(
      `SELECT a.appt_id, a.date_time, a.end_time, a.status, a.owner_notes,
              p.name AS pet_name, u.name AS vet_name,
              s.name AS service_name, s.base_price
       FROM Appointment a
       JOIN Pet p ON a.pet_id = p.pet_id
       JOIN Veterinarian v ON a.vet_id = v.vet_id
       JOIN User u ON v.user_id = u.user_id
       JOIN Service s ON a.service_id = s.service_id
       WHERE p.owner_id = ? ORDER BY a.date_time DESC`,
      [owners[0].owner_id]
    );
    res.json(appointments);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not load appointments.' });
  }
});

app.post('/api/appointments', authenticate, async (req, res) => {
  const { petId, serviceId, vetId, dateTime, notes } = req.body;
  if (!petId || !serviceId || !vetId || !dateTime) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }
  try {
    const [owners] = await db.query('SELECT owner_id FROM Owner WHERE user_id = ?', [req.userId]);
    if (owners.length === 0) return res.status(403).json({ message: 'Owner record not found.' });

    const [petCheck] = await db.query(
      'SELECT pet_id FROM Pet WHERE pet_id = ? AND owner_id = ?',
      [petId, owners[0].owner_id]
    );
    if (petCheck.length === 0) {
      return res.status(403).json({ message: 'That pet does not belong to your account.' });
    }

    const [services] = await db.query('SELECT duration_minutes FROM Service WHERE service_id = ?', [serviceId]);
    if (services.length === 0) return res.status(404).json({ message: 'Service not found.' });

    const startTime = new Date(dateTime);
    const endTime = new Date(startTime.getTime() + services[0].duration_minutes * 60000);

    const [conflict] = await db.query(
      `SELECT appt_id FROM Appointment WHERE vet_id = ? AND date_time = ? AND status != 'cancelled'`,
      [vetId, startTime]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ message: 'That time slot is already taken for this vet. Please choose another time.' });
    }

    const [result] = await db.query(
      `INSERT INTO Appointment (pet_id, vet_id, service_id, date_time, end_time, status, owner_notes)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [petId, vetId, serviceId, startTime, endTime, notes || null]
    );

    await db.query(
      `INSERT INTO Notification (user_id, type, message, channel) VALUES (?, 'confirmation', ?, 'in_app')`,
      [req.userId, `Your appointment has been booked for ${startTime.toLocaleString('en-ZA')}. Status: Pending confirmation.`]
    );

    // make an unpaid invoice, due a week after the appointment
    const [servicePrice] = await db.query('SELECT base_price FROM Service WHERE service_id = ?', [serviceId]);
    const dueDate = new Date(startTime);
    dueDate.setDate(dueDate.getDate() + 7);
    await db.query(
      `INSERT INTO Invoice (appt_id, owner_id, subtotal, total_amount, status, due_date)
       VALUES (?, ?, ?, ?, 'unpaid', ?)`,
      [result.insertId, owners[0].owner_id, servicePrice[0].base_price, servicePrice[0].base_price, dueDate]
    );

    res.status(201).json({ message: 'Appointment booked. You will receive confirmation shortly.', apptId: result.insertId });

  } catch (err) {
    console.log(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'That time slot is already taken. Please choose another time.' });
    }
    res.status(500).json({ message: 'Could not book your appointment. Please try again.' });
  }
});

app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const [notifications] = await db.query(
      `SELECT * FROM Notification WHERE user_id = ? ORDER BY sent_at DESC LIMIT 10`,
      [req.userId]
    );
    res.json(notifications);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not load notifications.' });
  }
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE Notification SET is_read = TRUE WHERE notif_id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not update notification.' });
  }
});

app.patch('/api/appointments/:id/cancel', authenticate, async (req, res) => {
  const { reason } = req.body;
  try {
    const [owners] = await db.query('SELECT owner_id FROM Owner WHERE user_id = ?', [req.userId]);
    if (owners.length === 0) return res.status(403).json({ message: 'Owner record not found.' });

    const [apptCheck] = await db.query(
      `SELECT a.appt_id, a.status FROM Appointment a
       JOIN Pet p ON a.pet_id = p.pet_id
       WHERE a.appt_id = ? AND p.owner_id = ?`,
      [req.params.id, owners[0].owner_id]
    );
    if (apptCheck.length === 0) return res.status(404).json({ message: 'Appointment not found.' });
    if (apptCheck[0].status === 'cancelled') {
      return res.status(400).json({ message: 'This appointment is already cancelled.' });
    }
    if (apptCheck[0].status === 'completed') {
      return res.status(400).json({ message: 'A completed appointment cannot be cancelled.' });
    }

    await db.query(
      `UPDATE Appointment SET status = 'cancelled', cancellation_reason = ? WHERE appt_id = ?`,
      [reason || 'Cancelled by owner', req.params.id]
    );
    await db.query(
      `INSERT INTO Notification (user_id, type, message, channel) VALUES (?, 'cancellation', ?, 'in_app')`,
      [req.userId, 'Your appointment has been cancelled.']
    );
    res.json({ message: 'Appointment cancelled.' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not cancel this appointment.' });
  }
});

app.get('/api/pets', authenticate, async (req, res) => {
  try {
    const [owners] = await db.query('SELECT owner_id FROM Owner WHERE user_id = ?', [req.userId]);
    if (owners.length === 0) return res.status(404).json({ message: 'Owner record not found.' });
    const [pets] = await db.query(
      'SELECT * FROM Pet WHERE owner_id = ? AND is_active = TRUE ORDER BY name',
      [owners[0].owner_id]
    );
    res.json(pets);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not load your pets.' });
  }
});

app.post('/api/pets', authenticate, async (req, res) => {
  const { name, species, breed, dateOfBirth } = req.body;
  if (!name || !species) {
    return res.status(400).json({ message: 'Pet name and species are required.' });
  }
  try {
    const [owners] = await db.query('SELECT owner_id FROM Owner WHERE user_id = ?', [req.userId]);
    if (owners.length === 0) return res.status(404).json({ message: 'Owner record not found.' });
    const [result] = await db.query(
      'INSERT INTO Pet (owner_id, name, species, breed, date_of_birth) VALUES (?, ?, ?, ?, ?)',
      [owners[0].owner_id, name, species, breed || null, dateOfBirth || null]
    );
    const [newPet] = await db.query('SELECT * FROM Pet WHERE pet_id = ?', [result.insertId]);
    res.status(201).json(newPet[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not add your pet.' });
  }
});

app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    const [owners] = await db.query('SELECT owner_id FROM Owner WHERE user_id = ?', [req.userId]);
    if (owners.length === 0) return res.json([]);
    const [invoices] = await db.query(
      `SELECT i.invoice_id, i.total_amount, i.status, i.issued_at, i.due_date,
              a.date_time, a.appt_id, p.name AS pet_name, s.name AS service_name
       FROM Invoice i
       JOIN Appointment a ON i.appt_id = a.appt_id
       JOIN Pet p ON a.pet_id = p.pet_id
       JOIN Service s ON a.service_id = s.service_id
       WHERE i.owner_id = ? ORDER BY i.issued_at DESC`,
      [owners[0].owner_id]
    );
    res.json(invoices);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not load invoices.' });
  }
});

app.post('/api/invoices/:id/pay', authenticate, async (req, res) => {
  try {
    const [owners] = await db.query('SELECT owner_id FROM Owner WHERE user_id = ?', [req.userId]);
    if (owners.length === 0) return res.status(403).json({ message: 'Owner record not found.' });

    const [invoiceCheck] = await db.query(
      'SELECT invoice_id, status, total_amount FROM Invoice WHERE invoice_id = ? AND owner_id = ?',
      [req.params.id, owners[0].owner_id]
    );
    if (invoiceCheck.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (invoiceCheck[0].status === 'paid') {
      return res.status(400).json({ message: 'This invoice has already been paid.' });
    }

    // simulated payment, just marks it paid (no real card processing)
    await db.query("UPDATE Invoice SET status = 'paid' WHERE invoice_id = ?", [req.params.id]);
    await db.query(
      `INSERT INTO Payment (invoice_id, amount, payment_method, gateway_reference, status)
       VALUES (?, ?, 'card', ?, 'success')`,
      [req.params.id, invoiceCheck[0].total_amount, 'SIM-' + Date.now()]
    );
    await db.query(
      `INSERT INTO Notification (user_id, type, message, channel) VALUES (?, 'invoice', ?, 'in_app')`,
      [req.userId, `Payment of R${Number(invoiceCheck[0].total_amount).toFixed(2)} received. Thank you!`]
    );

    res.json({ message: 'Payment successful. Thank you!' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not process payment. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.json({ message: 'Logged out.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('server running on port ' + PORT);
});