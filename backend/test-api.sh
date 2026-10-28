#!/usr/bin/env bash
# Smoke test for a running backend. Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... ./test-api.sh [http://localhost:4000]
set -u
API="${1:-http://localhost:4000}"
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok   $1"; else fail=$((fail+1)); echo "FAIL $1 (expected '$3', got '$2')"; fi; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

check "health" "$(code $API/api/health)" 200
check "admin routes need login" "$(code $API/api/admin/stats)" 401
check "bad login rejected" "$(code -X POST $API/api/admin/login -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"nope"}')" 401

check "malformed JSON gives 400" "$(code -X POST $API/api/admin/login -H 'Content-Type: application/json' -d '{bad json')" 400
check "uploads path traversal blocked" "$(code --path-as-is "$API/uploads/..%2f..%2fafs.db")" 404
check "forged (alg none) token rejected" "$(code -H 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOjF9.' $API/api/admin/stats)" 401
check "health checks the database" "$(curl -s $API/api/health)" '{"ok":true}'

TOKEN=$(curl -s -X POST $API/api/admin/login -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | json "d['token']")
H="Authorization: Bearer $TOKEN"
check "stats with token" "$(code -H "$H" $API/api/admin/stats)" 200

# product create / publish / draft hiding / delete
CAT=$(curl -s -H "$H" $API/api/admin/categories | json "d[0]['id']")
PID=$(curl -s -X POST $API/api/admin/products -H "$H" -H 'Content-Type: application/json' -d "{\"name\":\"Test Widget\",\"categoryId\":$CAT,\"specifications\":[{\"label\":\"Size\",\"value\":\"10 mm\"}],\"status\":\"draft\"}" | json "d['id']")
check "draft hidden from public" "$(code $API/api/products/test-widget)" 404
curl -s -o /dev/null -X PUT $API/api/admin/products/$PID -H "$H" -H 'Content-Type: application/json' -d "{\"name\":\"Test Widget\",\"categoryId\":$CAT,\"specifications\":[{\"label\":\"Size\",\"value\":\"10 mm\"}],\"status\":\"published\"}"
check "published visible" "$(code $API/api/products/test-widget)" 200
check "external image URL rejected" "$(code -X PUT $API/api/admin/products/$PID -H "$H" -H 'Content-Type: application/json' -d "{\"name\":\"Test Widget\",\"categoryId\":$CAT,\"images\":[{\"src\":\"http://evil.example/x.png\"}]}")" 422
check "delete product" "$(code -X DELETE -H "$H" $API/api/admin/products/$PID)" 200
check "deleted product gone" "$(code $API/api/products/test-widget)" 404
check "deleted product listed in bin" "$(curl -s -H "$H" "$API/api/admin/products?view=deleted" | json "len([p for p in d if p['id']==$PID])")" 1
check "deleted product not in admin list" "$(curl -s -H "$H" "$API/api/admin/products" | json "len([p for p in d if p['id']==$PID])")" 0
check "enquiry for a deleted product is refused" "$(code -X POST $API/api/enquiries -F name=Jane -F company=Acme -F email=j@acme.com -F country=UK -F phone='+44 20 1234 5678' -F message='Quote for the widget please' -F consent=true -F productSlugs=test-widget)" 409
check "restore deleted product" "$(code -X POST -H "$H" $API/api/admin/products/$PID/restore)" 200
check "restored product is a draft (still hidden)" "$(code $API/api/products/test-widget)" 404
check "delete forever needs the bin first" "$(code -X DELETE -H "$H" $API/api/admin/products/$PID/permanent)" 404
code -X DELETE -H "$H" $API/api/admin/products/$PID >/dev/null
check "delete product forever" "$(code -X DELETE -H "$H" $API/api/admin/products/$PID/permanent)" 200

# category with products cannot be deleted
check "non-empty category protected" "$(code -X DELETE -H "$H" $API/api/admin/categories/$CAT)" 409

# enquiry: validation, success, attachment checks
check "enquiry validation" "$(code -X POST $API/api/enquiries -F name=A -F email=bad)" 422
printf '%%PDF-1.4 test' > /tmp/afs-test.pdf
printf 'MZ not really a pdf' > /tmp/afs-fake.pdf
F=(-F name="Jane Doe" -F company=Acme -F email=jane@acme.com -F country=UK -F "phone=+44 20 1234 5678" -F product="Rubber Ball" -F message="Need 4 rolls for a mill line" -F consent=true)
check "fake pdf rejected" "$(code -X POST $API/api/enquiries "${F[@]}" -F "attachment=@/tmp/afs-fake.pdf")" 422
check "exe rejected" "$(code -X POST $API/api/enquiries "${F[@]}" -F "attachment=@/tmp/afs-test.pdf;filename=evil.exe")" 422
check "valid enquiry saved" "$(code -X POST $API/api/enquiries "${F[@]}" -F "attachment=@/tmp/afs-test.pdf")" 200
check "honeypot silent ok" "$(code -X POST $API/api/enquiries -F website=spam)" 200
EID=$(curl -s -H "$H" "$API/api/admin/enquiries?q=Acme" | json "d['items'][0]['id']")
check "enquiry visible in admin" "$([ -n "$EID" ] && echo yes)" yes
check "attachment download" "$(code -H "$H" $API/api/admin/enquiries/$EID/attachment)" 200
check "attachment not public" "$(code $API/api/admin/enquiries/$EID/attachment)" 401
check "status update" "$(code -X PATCH $API/api/admin/enquiries/$EID -H "$H" -H 'Content-Type: application/json' -d '{"status":"quoted","notes":"sent quote"}')" 200
check "csv export" "$(code -H "$H" $API/api/admin/enquiries.csv)" 200

# recycle bin: delete -> Deleted tab -> restore; delete again -> delete forever
check "delete enquiry (to recycle bin)" "$(code -X DELETE -H "$H" $API/api/admin/enquiries/$EID)" 200
check "deleted enquiry leaves the main list" "$(curl -s -H "$H" "$API/api/admin/enquiries?q=Acme" | json "len([i for i in d['items'] if i['id']==$EID])")" 0
check "deleted enquiry is in the Deleted tab" "$(curl -s -H "$H" "$API/api/admin/enquiries?view=deleted" | json "len([i for i in d['items'] if i['id']==$EID])")" 1
check "Deleted tab shows days left (30)" "$(curl -s -H "$H" "$API/api/admin/enquiries?view=deleted" | json "[i for i in d['items'] if i['id']==$EID][0]['daysLeft']")" 30
check "deleted enquiry not in csv" "$(curl -s -H "$H" $API/api/admin/enquiries.csv | grep -c 'jane@acme.com')" 0
check "attachment still downloadable from the bin" "$(code -H "$H" $API/api/admin/enquiries/$EID/attachment)" 200
check "cannot edit a deleted enquiry" "$(code -X PATCH $API/api/admin/enquiries/$EID -H "$H" -H 'Content-Type: application/json' -d '{"status":"closed"}')" 404
check "deleting twice is 404" "$(code -X DELETE -H "$H" $API/api/admin/enquiries/$EID)" 404
check "cannot delete-forever an active enquiry" "$(code -X DELETE -H "$H" $API/api/admin/enquiries/999999/permanent)" 404
check "restore enquiry" "$(code -X POST -H "$H" $API/api/admin/enquiries/$EID/restore)" 200
check "restored enquiry is back in the main list" "$(curl -s -H "$H" "$API/api/admin/enquiries?q=Acme" | json "len([i for i in d['items'] if i['id']==$EID])")" 1
check "restoring an active enquiry is 404" "$(code -X POST -H "$H" $API/api/admin/enquiries/$EID/restore)" 404
check "cannot delete-forever an active enquiry" "$(code -X DELETE -H "$H" $API/api/admin/enquiries/$EID/permanent)" 404
code -X DELETE -H "$H" $API/api/admin/enquiries/$EID >/dev/null
check "delete forever from the bin" "$(code -X DELETE -H "$H" $API/api/admin/enquiries/$EID/permanent)" 200
check "gone for good" "$(code -H "$H" $API/api/admin/enquiries/$EID)" 404

# image upload: re-encoded, junk rejected
python3 - <<'PY'
from PIL import Image; Image.new("RGB",(3000,2000),(10,120,60)).save("/tmp/afs-big.png")
PY
check "image upload" "$(code -X POST -H "$H" -F file=@/tmp/afs-big.png $API/api/admin/upload/image)" 200
check "non-image upload rejected" "$(code -X POST -H "$H" -F file=@/tmp/afs-fake.pdf $API/api/admin/upload/image)" 422

# settings round trip
check "settings invalid rejected" "$(code -X PUT $API/api/admin/settings -H "$H" -H 'Content-Type: application/json' -d '{"whatsapp":"abc"}')" 422
check "cors blocks other origin" "$(code -H 'Origin: http://evil.example' $API/api/products)" 403
check "cors allows website" "$(code -H 'Origin: http://localhost:3000' $API/api/products)" 200

# password change round trip (changes it, checks, then puts it back)
TMPPW="Temporary-pass-$RANDOM-x"
check "wrong current password rejected" "$(code -X POST $API/api/admin/password -H "$H" -H 'Content-Type: application/json' -d '{"currentPassword":"wrong","newPassword":"abcdefghijkl"}')" 400
check "too-short new password rejected" "$(code -X POST $API/api/admin/password -H "$H" -H 'Content-Type: application/json' -d "{\"currentPassword\":\"$ADMIN_PASSWORD\",\"newPassword\":\"short\"}")" 400
PWRES=$(curl -s -X POST $API/api/admin/password -H "$H" -H 'Content-Type: application/json' -d "{\"currentPassword\":\"$ADMIN_PASSWORD\",\"newPassword\":\"$TMPPW\"}")
check "password change returns a fresh token" "$(echo "$PWRES" | json "'ok' if d.get('token') else 'no'")" ok
check "old session is revoked after password change" "$(code $API/api/admin/stats -H "$H")" 401
NEWTOKEN=$(echo "$PWRES" | json "d['token']"); H="Authorization: Bearer $NEWTOKEN"
check "fresh session works" "$(code $API/api/admin/stats -H "$H")" 200
check "old password no longer works" "$(code -X POST $API/api/admin/login -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")" 401
check "new password works" "$(code -X POST $API/api/admin/login -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$TMPPW\"}")" 200
RESTORE=$(curl -s -X POST $API/api/admin/password -H "$H" -H 'Content-Type: application/json' -d "{\"currentPassword\":\"$TMPPW\",\"newPassword\":\"$ADMIN_PASSWORD\"}")
check "password restored" "$(echo "$RESTORE" | json "'ok' if d.get('ok') else 'no'")" ok
H="Authorization: Bearer $(echo "$RESTORE" | json "d['token']")"

# catalogue PDF
curl -s -D /tmp/afs-cat.h -o /tmp/afs-cat.pdf $API/api/catalogue.pdf
check "catalogue is a PDF" "$(head -c 5 /tmp/afs-cat.pdf)" "%PDF-"
check "catalogue sent as a download" "$(grep -ci 'content-disposition: attachment' /tmp/afs-cat.h)" 1
CATETAG=$(grep -i '^etag:' /tmp/afs-cat.h | awk '{print $2}' | tr -d '\r')
check "catalogue supports caching (304)" "$(code -H "If-None-Match: $CATETAG" $API/api/catalogue.pdf)" 304

# email retry and logout revocation
EID=$(curl -s "$API/api/admin/enquiries" -H "$H" | json "d['items'][0]['id'] if d['items'] else 0")
if [ "$EID" != "0" ]; then check "resend email endpoint answers" "$(code -X POST $API/api/admin/enquiries/$EID/resend-email -H "$H")" 200; fi
check "resend on missing enquiry is 404" "$(code -X POST $API/api/admin/enquiries/999999/resend-email -H "$H")" 404
check "logout" "$(code -X POST $API/api/admin/logout -H "$H")" 200
check "token is dead after logout" "$(code $API/api/admin/stats -H "$H")" 401

echo; echo "passed: $pass  failed: $fail"; [ $fail -eq 0 ]
