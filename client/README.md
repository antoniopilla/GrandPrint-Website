# GrandPrint — Large Format Printing Order System

## Project Structure

```
project/
├── client/          # React frontend (Vite)
└── server/          # Express backend (Node.js)
```

---

## Quick Setup

### 1. Backend

```bash
cd server
npm install
```

Edit `.env` with your real values:

| Variable                 | Description                                             |
|--------------------------|---------------------------------------------------------|
| `MONGO_URI`              | MongoDB connection string (local, or MongoDB Atlas)     |
| `CLIENT_URL`             | Allowed frontend origin(s) for CORS (comma-separated)   |
| `ADMIN_PASSWORD`         | Password to log into admin panel                        |
| `JWT_SECRET`             | Secret used to sign admin session tokens                |
| `EMAIL_USER`             | Gmail address for sending emails                        |
| `EMAIL_PASS`             | Gmail App Password (not your login)                     |
| `BUSINESS_NAME`          | Shown in email sender name (e.g. GrandPrint)            |
| `CLOUDINARY_CLOUD_NAME`  | Cloudinary cloud name (file storage)                    |
| `CLOUDINARY_API_KEY`     | Cloudinary API key                                      |
| `CLOUDINARY_API_SECRET`  | Cloudinary API secret                                   |
| `GCASH_NAME`             | Your GCash registered name                              |
| `GCASH_NUMBER`           | Your GCash number                                       |
| `BPI_NAME`               | BPI account holder name                                 |
| `BPI_ACCOUNT`            | BPI account number                                      |
| `FB_PAGE`                | Facebook page URL                                       |

> **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords. Generate one for "Mail".
>
> **Cloudinary**: Sign up (free) at cloudinary.com and copy the Cloud name, API Key, and API Secret from the dashboard.

```bash
npm run dev
# Server runs on http://localhost:5000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
# App runs on http://localhost:3000
```

The frontend reads the backend URL from `VITE_API_URL` (see `client/.env.example`).
Leave it unset for local dev (defaults to `http://localhost:5000`); in production set it
to your deployed backend, e.g. `VITE_API_URL=https://grandprint-api.onrender.com`.

---

## User Flow

### Customer
1. Visit site → click **Order Now**
2. Fill in details (name, email, contact)
3. Select product + dimensions + upload design
4. Review and submit → get Order ID
5. Wait for email with price quote
6. Send 50% downpayment via GCash or BPI
7. Message FB page: `Name + Order ID + Receipt screenshot`
8. Pay remaining 50% when order is completed

### Admin
1. Visit site → click **Admin Login**
2. Enter admin password (set in `.env`)
3. **Pending Approval tab** → review order → click "Approve & Set Price" → enter price → email sent automatically
4. **On-Going tab** → click "Confirm Downpayment & Start Printing" once you've received payment on FB → then "Mark as Completed" when done
5. **Completed tab** → click "Confirm Final Payment" once remaining 50% is received

---

## Order Status Flow

```
Pending Approval
     ↓  (admin sets price → email sent)
Awaiting Downpayment
     ↓  (admin confirms FB payment)
Printing
     ↓  (admin marks done)
Completed
     ↓  (admin confirms final payment)
Fully Paid ✓
```

---

## Tech Stack

- **Frontend**: React 18, React Router v6, Vite
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Email**: Nodemailer + Gmail SMTP
- **File uploads**: Multer (in-memory) → Cloudinary (designs & payment receipts stored in the cloud)
- **Deployment**: Frontend on Vercel, backend on Render, database on MongoDB Atlas
