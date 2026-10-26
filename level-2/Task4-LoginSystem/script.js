const USERS_KEY = "securespace-users";
const SESSION_KEY = "securespace-session";

// Read stored users safely
function getUsers() {
    try {
        const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
        return Array.isArray(users) ? users : [];
    } catch {
        return [];
    }
}

// Save users
function saveUsers(users) {
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return true;
    } catch {
        return false;
    }
}

// Display form messages
function showMessage(element, message, success = false) {
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("success", success);
}

// Normalize email
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

// Hash password using Web Crypto SHA-256
async function hashPassword(password) {
    if (!window.crypto?.subtle) {
        throw new Error("Secure hashing unavailable. Use localhost or HTTPS.");
    }

    const data = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(hash))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

// Create a random session token
function createSessionToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));

    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

// Start a demo session
function startSession(user) {
    const session = {
        email: user.email,
        token: createSessionToken()
    };

    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return true;
    } catch {
        return false;
    }
}

// Get the current demo session
function getSession() {
    try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch {
        return null;
    }
}

// Clear session and return to login
function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("index.html");
}

// REGISTRATION 

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    const message = document.getElementById("registerMessage");

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        showMessage(message, "");

        const username = document
            .getElementById("registerUsername")
            .value.trim();

        const email = normalizeEmail(
            document.getElementById("registerEmail").value
        );

        const password = document.getElementById("registerPassword").value;

        if (!username || !email || !password) {
            showMessage(message, "Please fill in all fields.");
            return;
        }

        if (username.length < 3 || username.length > 30) {
            showMessage(message, "Username must be 3–30 characters long.");
            return;
        }

        if (/\s/.test(username)) {
            showMessage(message, "Username must not contain spaces.");
            return;
        }

        if (password.length < 8 || !/\d/.test(password)) {
            showMessage(
                message,
                "Password must have at least 8 characters and one number."
            );
            return;
        }

        const users = getUsers();

        const duplicate = users.some(
            (user) =>
                user.email === email ||
                user.username.toLowerCase() === username.toLowerCase()
        );

        if (duplicate) {
            showMessage(message, "This username or email is already registered.");
            return;
        }

        try {
            const passwordHash = await hashPassword(password);

            const newUser = {
                id: createSessionToken(),
                username,
                email,
                passwordHash,
                createdAt: new Date().toISOString()
            };

            users.push(newUser);

            if (!saveUsers(users)) {
                showMessage(message, "Could not save account. Check browser storage.");
                return;
            }

            registerForm.reset();

            showMessage(
                message,
                "Account created successfully! Redirecting to login...",
                true
            );

            setTimeout(() => {
                window.location.href = "index.html";
            }, 900);
        } catch (error) {
            showMessage(
                message,
                error.message || "Unable to create account."
            );
        }
    });
}

// LOGIN 

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    const message = document.getElementById("loginMessage");

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        showMessage(message, "");

        const email = normalizeEmail(
            document.getElementById("loginEmail").value
        );

        const password = document.getElementById("loginPassword").value;

        if (!email || !password) {
            showMessage(message, "Please enter your email and password.");
            return;
        }

        try {
            const passwordHash = await hashPassword(password);
            const users = getUsers();

            const user = users.find(
                (item) =>
                    item.email === email &&
                    item.passwordHash === passwordHash
            );

            if (!user) {
                showMessage(message, "Invalid email or password.");
                return;
            }

            if (!startSession(user)) {
                showMessage(message, "Could not start session. Try again.");
                return;
            }

            window.location.href = "dashboard.html";
        } catch (error) {
            showMessage(
                message,
                error.message || "Unable to sign in. Please try again."
            );
        }
    });
}

// PROTECTED DASHBOARD 

const dashboardUsername = document.getElementById("dashboardUsername");

if (dashboardUsername) {
    const session = getSession();
    const users = getUsers();

    const user = session
        ? users.find((item) => item.email === session.email)
        : null;

    if (!user) {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.replace("index.html");
    } else {
        dashboardUsername.textContent = user.username;

        document.getElementById("accountUsername").textContent =
            user.username;

        document.getElementById("accountEmail").textContent =
            user.email;
    }
}

// -------------------- LOGOUT --------------------

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}