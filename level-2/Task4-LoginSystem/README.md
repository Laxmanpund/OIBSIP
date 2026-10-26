# SecureSpace — Login Authentication System

A front-end authentication demo built using HTML, CSS, and Vanilla JavaScript as part of the Oasis Infobyte Web Development Internship (OIBSIP), Level 2.

## Features

- User registration with username, email, and password
- Input validation for registration
- Duplicate username and email checks
- Login using registered credentials
- Password hashing demo using the Web Crypto API
- Session state using `sessionStorage`
- Dashboard displaying the signed-in user's details
- Redirect to login when no valid demo session is found
- Logout functionality
- Responsive dark-theme UI

## Technologies Used

- HTML
- CSS3
- Vanilla JavaScript
- Web Crypto API
- localStorage
- sessionStorage

## How to Run

1. Open the project folder in Visual Studio Code.
2. Start Live Server.
3. Open `register.html` and create a test account.
4. Sign in using the same email and password.
5. Check the dashboard and test the Logout button.
6. Try opening `dashboard.html` after logging out.

## Important Security Note

This project is an educational front-end demonstration, not production-ready authentication.

- User records are stored in browser `localStorage`.
- The client-side SHA-256 hash is for demonstration and is not a suitable password-storage strategy on its own.
- Client-side checks cannot securely protect a dashboard from a user who can modify browser storage or JavaScript.
- A real application should use server-side authentication, Argon2id or bcrypt password hashing, secure server-managed sessions, HTTPS, and appropriate access controls.

## Internship Details

**Organization:** Oasis Infobyte (OIBSIP)
**Level:** Level 2
**Task:** Login Authentication System
