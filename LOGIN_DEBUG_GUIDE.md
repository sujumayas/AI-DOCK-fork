🚀 AI DOCK LOGIN DEBUG GUIDE
============================

## QUICK START (2 Terminals)

Terminal 1 - Backend:
cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back
./quick_start.sh

Terminal 2 - Frontend:
cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Front
npm run dev

## TEST CREDENTIALS
Email: admin@aidock.dev
Password: admin123!

## DEBUG STEPS

1. Run backend debug:
   python3 debug_backend.py

2. Open debug tool:
   open frontend_debug.html

3. Check servers are running:
   ✅ Backend: http://localhost:8000/health
   ✅ Frontend: http://localhost:8080

## COMMON ISSUES

❌ "Signing In..." forever
   → Backend not running on port 8000
   → Frontend can't reach backend
   → CORS misconfiguration

✅ SOLUTIONS:
   1. Restart backend server
   2. Check backend terminal for errors
   3. Use correct test credentials above
   4. Check browser console (F12) for errors

## AFTER FIXING:
✅ Login should work in ~2 seconds
✅ Should redirect to dashboard
✅ Should show user info in header

## NEED HELP?
Run: python3 debug_backend.py
Open: frontend_debug.html
Check: Browser console (F12 → Console)
