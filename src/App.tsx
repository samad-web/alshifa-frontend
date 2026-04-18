import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute, getRoleRedirectPath } from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { lazy, Suspense } from "react";
import { TriageWizard } from "./components/triage/TriageWizard";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DoctorAdminDashboard = lazy(() => import("./pages/DoctorAdminDashboard"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard"));
const DoctorAvailability = lazy(() => import("./pages/DoctorAvailability"));
const DoctorGamification = lazy(() => import("./pages/DoctorGamification"));
const TherapistDashboard = lazy(() => import("./pages/TherapistDashboard"));
const TherapistPatients = lazy(() => import("./pages/TherapistPatients"));
const ConsultationRoom = lazy(() => import("./pages/ConsultationRoom"));
const PatientScreen = lazy(() => import("./pages/PatientScreen"));
const PatientDetails = lazy(() => import("./pages/PatientDetails"));
const PatientOnboarding = lazy(() => import("./pages/PatientOnboarding"));
const PatientWellness = lazy(() => import("./pages/PatientWellness"));
const PatientAppointments = lazy(() => import("./pages/PatientAppointments"));
const ExerciseLibrary = lazy(() => import("./pages/ExerciseLibrary"));
const Chat = lazy(() => import("./pages/Chat"));
const PatientTimeline = lazy(() => import("./pages/PatientTimeline"));
const PharmacyDashboard = lazy(() => import("./pages/PharmacyDashboard"));
const PharmacyDispense = lazy(() => import("./pages/PharmacyDispense"));
const PharmacyHistory = lazy(() => import("./pages/PharmacyHistory"));
const PharmacyOrders = lazy(() => import("./pages/PharmacyOrders"));
const MedicineInventory = lazy(() => import("./pages/MedicineInventory"));
const Appointments = lazy(() => import("./pages/Appointments"));
const PrescriptionManagement = lazy(() => import("./pages/PrescriptionManagement"));
const Reports = lazy(() => import("./pages/Reports"));
const ManageUsers = lazy(() => import("./pages/ManageUsers"));
const CreateUser = lazy(() => import("./pages/CreateUser"));
const BranchManagement = lazy(() => import("./pages/BranchManagement"));
const AssignPatient = lazy(() => import("./pages/AssignPatient"));
const GamificationAnalytics = lazy(() => import("./pages/admin/GamificationAnalytics"));
const FeatureFlags = lazy(() => import("./pages/FeatureFlags"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const WellnessDashboard = lazy(() => import("./pages/patient/WellnessDashboard"));
const JourneyBuilder = lazy(() => import("./pages/doctor/JourneyBuilder"));
const Billing = lazy(() => import("./pages/Billing"));

// ── New Feature Pages ────────────────────────────────────────────────────────
// Operations (Features 4, 6, 7, 8, 9, 13)
const StaffActivityFeed = lazy(() => import("./pages/admin/StaffActivityFeed"));
const PerformanceScorecards = lazy(() => import("./pages/admin/PerformanceScorecards"));
const AttendanceTracker = lazy(() => import("./pages/admin/AttendanceTracker"));
const SkillMatrix = lazy(() => import("./pages/admin/SkillMatrix"));
const ResourceSharingPage = lazy(() => import("./pages/admin/ResourceSharing"));
const CentralizedInventory = lazy(() => import("./pages/admin/CentralizedInventory"));

// Clinician Gamification (Features 14-20)
const XPDashboard = lazy(() => import("./pages/clinician/XPDashboard"));
const SeasonalChallenges = lazy(() => import("./pages/clinician/SeasonalChallenges"));
const TeamQuests = lazy(() => import("./pages/clinician/TeamQuests"));
const AchievementShowcase = lazy(() => import("./pages/clinician/AchievementShowcase"));
const RewardStore = lazy(() => import("./pages/clinician/RewardStore"));
const MentorHub = lazy(() => import("./pages/clinician/MentorHub"));

// Patient Gamification (Features 21-27)
const HealthQuests = lazy(() => import("./pages/patient/HealthQuests"));
const HealthAvatar = lazy(() => import("./pages/patient/HealthAvatar"));
const FamilyLeaderboard = lazy(() => import("./pages/patient/FamilyLeaderboard"));
const ReferralRewards = lazy(() => import("./pages/patient/ReferralRewards"));
const SocialProofDashboard = lazy(() => import("./pages/patient/SocialProofDashboard"));
const HealthContentLibrary = lazy(() => import("./pages/patient/HealthContentLibrary"));

// Communication & Portal (Features 33, 35, 37, 39)
const Announcements = lazy(() => import("./pages/Announcements"));
const HandoffNotes = lazy(() => import("./pages/HandoffNotes"));
const PatientPortal = lazy(() => import("./pages/patient/PatientPortal"));
const VisitSummaryPage = lazy(() => import("./pages/VisitSummary"));

const queryClient = new QueryClient();

// Redirect authenticated users to their role-specific dashboard
function AuthenticatedRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && role) {
    return <Navigate to={getRoleRedirectPath(role)} replace />;
  }

  return <Index />;
}

function LoginRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && role) {
    return <Navigate to={getRoleRedirectPath(role)} replace />;
  }

  return <Login />;
}

function AppointmentDispatcher() {
  const { role } = useAuth();
  if (role === "PATIENT") {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <PatientAppointments />
      </Suspense>
    );
  }
  return <Appointments />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<AuthenticatedRedirect />} />
      <Route path="/login" element={<LoginRedirect />} />

      {/* Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor-admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN_DOCTOR"]}>
            <DoctorAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assign-patient"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <AssignPatient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor-gamification"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <DoctorGamification />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gamification-analytics"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <GamificationAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/prescriptions"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST", "ADMIN", "ADMIN_DOCTOR"]}>
            <PrescriptionManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute allowedRoles={["PATIENT", "DOCTOR", "THERAPIST", "ADMIN", "ADMIN_DOCTOR"]}>
            <AppointmentDispatcher />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "ADMIN_DOCTOR"]}>
            <DoctorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/therapist"
        element={
          <ProtectedRoute allowedRoles={["THERAPIST"]}>
            <TherapistDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/therapist/session/:appointmentId"
        element={
          <ProtectedRoute allowedRoles={["THERAPIST"]}>
            <ConsultationRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/therapist/patients"
        element={
          <ProtectedRoute allowedRoles={["THERAPIST"]}>
            <TherapistPatients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <PatientScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wellness"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <PatientWellness />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exercise-library"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <ExerciseLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/onboarding"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <PatientOnboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-user"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <CreateUser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manage-users"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <ManageUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/branch-management"
        element={
          <ProtectedRoute allowedRoles={["ADMIN_DOCTOR"]}>
            <BranchManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy"
        element={
          <ProtectedRoute allowedRoles={["PHARMACIST", "ADMIN", "ADMIN_DOCTOR"]}>
            <PharmacyDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/inventory"
        element={
          <ProtectedRoute allowedRoles={["PHARMACIST", "ADMIN", "ADMIN_DOCTOR"]}>
            <MedicineInventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/dispense"
        element={
          <ProtectedRoute allowedRoles={["PHARMACIST", "ADMIN", "ADMIN_DOCTOR"]}>
            <PharmacyDispense />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/history"
        element={
          <ProtectedRoute allowedRoles={["PHARMACIST", "ADMIN", "ADMIN_DOCTOR"]}>
            <PharmacyHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/orders"
        element={
          <ProtectedRoute allowedRoles={["PHARMACIST", "ADMIN", "ADMIN_DOCTOR"]}>
            <PharmacyOrders />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute allowedRoles={["PATIENT", "DOCTOR", "ADMIN", "ADMIN_DOCTOR", "THERAPIST", "PHARMACIST"]}>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor-availability"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <DoctorAvailability />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/timeline"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT"]}>
            <PatientTimeline />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feature-flags"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <FeatureFlags />
          </ProtectedRoute>
        }
      />
      <Route
        path="/referrals"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <ReferralPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wellness-dashboard"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <WellnessDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/triage"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <div className="p-4"><TriageWizard /></div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "PATIENT"]}>
            <Billing />
          </ProtectedRoute>
        }
      />
      <Route
        path="/journey-builder"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "ADMIN_DOCTOR", "THERAPIST"]}>
            <JourneyBuilder />
          </ProtectedRoute>
        }
      />
      {/* ── Operations (Features 4, 6, 7, 8, 9, 13) ──────────────────────── */}
      <Route
        path="/staff-activity"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <StaffActivityFeed />
          </ProtectedRoute>
        }
      />
      <Route
        path="/performance-scorecards"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <PerformanceScorecards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PHARMACIST"]}>
            <AttendanceTracker />
          </ProtectedRoute>
        }
      />
      <Route
        path="/skill-matrix"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <SkillMatrix />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resource-sharing"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <ResourceSharingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/centralized-inventory"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "PHARMACIST"]}>
            <CentralizedInventory />
          </ProtectedRoute>
        }
      />

      {/* ── Clinician Gamification (Features 14-20) ──────────────────────── */}
      <Route
        path="/xp-dashboard"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST", "ADMIN_DOCTOR"]}>
            <XPDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seasonal-challenges"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <SeasonalChallenges />
          </ProtectedRoute>
        }
      />
      <Route
        path="/team-quests"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <TeamQuests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievement-showcase"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <AchievementShowcase />
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievement-showcase/:userId"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <AchievementShowcase />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reward-store"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT"]}>
            <RewardStore />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mentor-hub"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST", "ADMIN_DOCTOR"]}>
            <MentorHub />
          </ProtectedRoute>
        }
      />

      {/* ── Patient Gamification (Features 21-27) ────────────────────────── */}
      <Route
        path="/health-quests"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <HealthQuests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/health-avatar"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <HealthAvatar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/family-leaderboard"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FamilyLeaderboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/referral-rewards"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <ReferralRewards />
          </ProtectedRoute>
        }
      />
      <Route
        path="/social-proof"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <SocialProofDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/health-content"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <HealthContentLibrary />
          </ProtectedRoute>
        }
      />

      {/* ── Communication & Portal (Features 33, 35, 37, 39) ────────────── */}
      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT", "PHARMACIST"]}>
            <Announcements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/handoff-notes"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST", "ADMIN_DOCTOR"]}>
            <HandoffNotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient-portal"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <PatientPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visit-summary"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST", "ADMIN_DOCTOR", "PATIENT"]}>
            <VisitSummaryPage />
          </ProtectedRoute>
        }
      />

      <Route path="/verify-email" element={<Login />} />
      <Route path="/reset-password" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" style={{ width: 64, height: 64 }} />
        <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10 m-4" />
      </motion.div>
      <motion.p
        className="text-sm text-muted-foreground font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Loading...
      </motion.p>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <NotificationProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
            </TooltipProvider>
          </NotificationProvider>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;

