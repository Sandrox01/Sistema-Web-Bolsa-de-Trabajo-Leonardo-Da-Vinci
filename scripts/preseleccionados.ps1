$body = @{ correo='admin@ldv.edu.pe'; password='Admin2024@LDV' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:5500/api/auth/login' -Body $body -ContentType 'application/json'
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
$resp = Invoke-RestMethod -Method Get -Uri 'http://localhost:5500/api/admin/preseleccionados' -Headers $headers
$resp | ConvertTo-Json -Depth 4
