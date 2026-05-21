$body = @{ correo='admin@ldv.edu.pe'; password='Admin2024@LDV' } | ConvertTo-Json
$response = Invoke-RestMethod -Method Post -Uri 'http://localhost:5500/api/auth/login' -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 4
