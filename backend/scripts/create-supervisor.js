import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import db from '../src/config/db.js';
dotenv.config();
const rl = readline.createInterface({ input, output });
try {
  const code = (await rl.question('Supervisor ID: ')).trim();
  const name = (await rl.question('Full name: ')).trim();
  const password = await rl.question('Password (minimum 10 characters): ');
  if (!code || !name || password.length < 10) throw new Error('Provide ID, name and a password of at least 10 characters.');
  const hash = await bcrypt.hash(password, 12);
  await db.execute('INSERT INTO supervisors (supervisor_code, full_name, password_hash, role) VALUES (?, ?, ?, ?)', [code, name, hash, 'ADMIN']);
  console.log('First administrator created successfully.');
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { rl.close(); await db.end(); }
