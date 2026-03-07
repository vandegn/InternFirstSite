// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Dashboard routes by role
const DASHBOARD_ROUTES = {
    student: 'student-dashboard.html',
    employer: 'employers-dashboard.html',
    university_admin: 'university-dashboard.html'
};

// Redirect to the appropriate dashboard based on user role
function redirectToDashboard(role) {
    const route = DASHBOARD_ROUTES[role];
    if (route) {
        window.location.href = route;
    }
}

// Check if user is logged in, redirect to login if not
async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'join.html';
        return null;
    }
    return session;
}
