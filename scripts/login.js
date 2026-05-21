const endpoint = 'http://localhost:5500/api/auth/login';
async function main() {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'admin@ldv.edu.pe', password: 'Admin2024@LDV' })
  });
  const text = await res.text();
  console.log(res.status, text);
}
main().catch(err => { console.error('request failed', err); process.exit(1); });
