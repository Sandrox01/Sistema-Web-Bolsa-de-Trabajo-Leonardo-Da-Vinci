param(
    [int]$PostulacionId,
    [string]$Tipo = 'carta_aceptacion',
    [string]$Output = 'downloaded.pdf'
)
$body = @{ correo='admin@ldv.edu.pe'; password='Admin2024@LDV' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:5500/api/auth/login' -Body $body -ContentType 'application/json'
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
$uri = "http://localhost:5500/api/admin/documentos/$PostulacionId/$Tipo"
Invoke-WebRequest -Uri $uri -Headers $headers -OutFile $Output
Write-Host "Guardado en $Output"
