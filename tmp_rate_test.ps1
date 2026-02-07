for ($i=1; $i -le 11; $i++) {
  $body = '{"text":"rate limit test","signerUuid":"0603c233-00c3-4513-9fe1-46d5dd5debeb","scheduled_time":"2099-01-01T00:00:00Z"}'
  $status = & curl.exe -s -o $null -w "%{http_code}" -X POST https://homiehouse.vercel.app/api/schedule-cast -H "Content-Type: application/json" -d $body
  Write-Output ("Request {0}: HTTP {1}" -f $i, $status)
  Start-Sleep -Milliseconds 200
}
