// Corner-toast UIs replaced by the centered <NotifyProvider> modal in lib/notify.
// We keep the imports stubbed out so any leftover JSX references compile, but the
// actual rendering happens inside <NotifyProvider> below.
import { NotifyProvider } from "@/lib/notify";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute, getRoleRedirectPath } from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { FeatureGate } from "@/components/common/FeatureGate";
import { lazy, Suspense } from "react";
import { TriageWizard } from "./components/triage/TriageWizard";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const MfaChallenge = lazy(() => import("./pages/auth/MfaChallenge"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DoctorAdminDashboard = lazy(() => import("./pages/DoctorAdminDashboard"));
const BranchAdminDashboard = lazy(() => import("./pages/branch-admin/BranchAdminDashboard"));
const BranchAdminStaffDirectory = lazy(() => import("./pages/branch-admin/StaffDirectory"));
const LiveQueueBoard = lazy(() => import("./pages/admin/LiveQueueBoard"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard"));
const DoctorAvailability = lazy(() => import("./pages/DoctorAvailability"));
const DoctorGamification = lazy(() => import("./pages/DoctorGamification"));
const TherapistDashboard = lazy(() => import("./pages/TherapistDashboard"));
const TherapistPatients = lazy(() => import("./pages/TherapistPatients"));
const ConsultationRoom = lazy(() => import("./pages/ConsultationRoom"));
const EnhancedPatientDashboard = lazy(() => import("./pages/patient/EnhancedPatientDashboard"));
const VoiceCoachPage = lazy(() => import("./features/voiceCoach/CoachPage"));
const PatientDetails = lazy(() => import("./pages/PatientDetails"));
const PatientsPage = lazy(() => import("./pages/Patients"));
const PatientOnboarding = lazy(() => import("./pages/PatientOnboarding"));
const PatientAppointments = lazy(() => import("./pages/PatientAppointments"));
const ExerciseLibrary = lazy(() => import("./pages/ExerciseLibrary"));
const Chat = lazy(() => import("./pages/Chat"));
const StaffChat = lazy(() => import("./pages/StaffChat"));
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
const UsersExport = lazy(() => import("./pages/admin/UsersExport"));
const CreateUser = lazy(() => import("./pages/CreateUser"));
const BranchManagement = lazy(() => import("./pages/BranchManagement"));
const AssignPatient = lazy(() => import("./pages/AssignPatient"));
const GamificationAnalytics = lazy(() => import("./pages/admin/GamificationAnalytics"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const JourneyBuilder = lazy(() => import("./pages/doctor/JourneyBuilder"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

// ── New Feature Pages ────────────────────────────────────────────────────────
// Operations (Features 4, 6, 7, 8, 9, 13)
const StaffActivityFeed = lazy(() => import("./pages/admin/StaffActivityFeed"));
const PerformanceScorecards = lazy(() => import("./pages/admin/PerformanceScorecards"));
const AttendanceTracker = lazy(() => import("./pages/admin/AttendanceTracker"));
const StaffSchedule = lazy(() => import("./pages/admin/StaffSchedule"));
const ResourceSharingPage = lazy(() => import("./pages/admin/ResourceSharing"));
const CentralizedInventory = lazy(() => import("./pages/admin/CentralizedInventory"));

// Clinician Gamification (Features 14-20)
const XPDashboard = lazy(() => import("./pages/clinician/XPDashboard"));
const SeasonalChallenges = lazy(() => import("./pages/clinician/SeasonalChallenges"));
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
const SelfExaminationKit = lazy(() => import("./pages/patient/SelfExaminationKit"));
const ContactClinics = lazy(() => import("./pages/patient/ContactClinics"));
const SelfExamReview = lazy(() => import("./pages/doctor/SelfExamReview"));
const SelfExamProtocols = lazy(() => import("./pages/admin/SelfExamProtocols"));

// Communication & Portal (Features 33, 35, 37, 39)
const Announcements = lazy(() => import("./pages/Announcements"));
const MessageTemplatesPage = lazy(() => import("./pages/MessageTemplates"));
const ReminderSettingsPage = lazy(() => import("./pages/ReminderSettings"));
// Critical-journey admin page: patients flagged for non-adherence
const CriticalJourneyPage = lazy(() => import("./pages/CriticalJourney"));
// Home Therapy — admin approval dashboard
const HomeTherapyRequestsPage = lazy(() => import("./pages/admin/HomeTherapyRequests"));
const HomeTherapyLiveMapPage = lazy(() => import("./pages/admin/HomeTherapyLiveMap"));
const HandoffNotes = lazy(() => import("./pages/HandoffNotes"));
const PatientPortal = lazy(() => import("./pages/patient/PatientPortal"));
const VisitSummaryPage = lazy(() => import("./pages/VisitSummary"));

// IWIS Competitor Features (0-6)
const TherapyRoomsPage = lazy(() => import("./pages/iwis/TherapyRooms"));
const DietPrescriptionsPage = lazy(() => import("./pages/iwis/DietPrescriptions"));
const FoodDatabase = lazy(() => import("./pages/admin/FoodDatabase"));
const RecipeLibrary = lazy(() => import("./pages/admin/RecipeLibrary"));
const WorkflowAutomation = lazy(() => import("./pages/admin/WorkflowAutomation"));
const DietPackagesPage = lazy(() => import("./pages/iwis/DietPackages"));
const PatientDietPage = lazy(() => import("./pages/iwis/PatientDiet"));
const ClinicalPhotosPage = lazy(() => import("./pages/iwis/ClinicalPhotos"));
const TreatmentPackagesPage = lazy(() => import("./pages/iwis/TreatmentPackages"));
const GroupSessionsPage = lazy(() => import("./pages/iwis/GroupSessions"));

// Super Admin (IWIS platform-level)
const SuperAdminShell = lazy(() =>
  import("./components/super-admin/SuperAdminShell").then((m) => ({ default: m.SuperAdminShell }))
);
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"));
const SuperAdminHospitalList = lazy(() => import("./pages/super-admin/HospitalList"));
const SuperAdminHospitalCreate = lazy(() => import("./pages/super-admin/HospitalCreate"));
const SuperAdminHospitalDetail = lazy(() => import("./pages/super-admin/HospitalDetail"));
const SuperAdminFeatureRegistry = lazy(() => import("./pages/super-admin/FeatureRegistryPage"));
const SuperAdminAudit = lazy(() => import("./pages/super-admin/AuditLog"));
const SuperAdminTriageOversight = lazy(() => import("./pages/super-admin/TriageOversight"));
const SuperAdminSpecialtyRoutes = lazy(() => import("./pages/super-admin/SpecialtyRoutesAdmin"));

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
      {/* ── Branch Admin (scoped to a single branch) ─────────────────────── */}
      <Route
        path="/branch-admin"
        element={
          <ProtectedRoute allowedRoles={["BRANCH_ADMIN"]}>
            <BranchAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/branch-admin/staff"
        element={
          <ProtectedRoute allowedRoles={["BRANCH_ADMIN", "ADMIN", "ADMIN_DOCTOR"]}>
            <BranchAdminStaffDirectory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/branch-admin/scorecards"
        element={
          <ProtectedRoute allowedRoles={["BRANCH_ADMIN", "ADMIN", "ADMIN_DOCTOR"]}>
            <FeatureGate feature="PERFORMANCE_SCORECARDS" title="Performance Scorecards isn't enabled">
              <PerformanceScorecards />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      {/* ── Live Patient Queue Board (real-time arrival board) ──────────── */}
      <Route
        path="/branch-admin/live-queue"
        element={
          <ProtectedRoute allowedRoles={["BRANCH_ADMIN"]}>
            <LiveQueueBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/live-queue"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "SUPER_ADMIN"]}>
            <LiveQueueBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assign-patient"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN"]}>
            <AssignPatient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor-gamification"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "DOCTOR", "THERAPIST"]}>
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
          <ProtectedRoute allowedRoles={["THERAPIST", "DOCTOR", "ADMIN_DOCTOR"]}>
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
            <EnhancedPatientDashboard />
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
        path="/patient/coach"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <VoiceCoachPage />
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
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN"]}>
            <ManageUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users-export"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <UsersExport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/branch-management"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
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
          <ProtectedRoute allowedRoles={["PATIENT", "DOCTOR", "ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN", "THERAPIST", "PHARMACIST"]}>
            <Chat />
          </ProtectedRoute>
        }
      />
      {/* Staff messaging: 1-on-1 DMs + branch group chats. Patients are
          excluded — they have their own care-team chat at /chat. */}
      <Route
        path="/staff-chat"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN", "THERAPIST", "PHARMACIST"]}>
            <StaffChat />
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
        path="/staff-schedule"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN", "DOCTOR", "THERAPIST"]}>
            <StaffSchedule />
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
        path="/patients"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN", "DOCTOR", "THERAPIST", "PHARMACIST"]}>
            <PatientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR"]}>
            <PatientDetails />
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
        path="/triage"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <div className="p-4"><TriageWizard /></div>
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
            <FeatureGate feature="STAFF_ACTIVITY_FEED" title="Staff Activity Feed isn't enabled">
              <StaffActivityFeed />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/performance-scorecards"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN", "DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="PERFORMANCE_SCORECARDS" title="Performance Scorecards isn't enabled">
              <PerformanceScorecards />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN"]}>
            <FeatureGate feature="STAFF_ATTENDANCE" title="Staff Attendance isn't enabled">
              <AttendanceTracker />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/resource-sharing"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <FeatureGate feature="RESOURCE_SHARING" title="Cross-Branch Resource Sharing isn't enabled">
              <ResourceSharingPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/centralized-inventory"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "PHARMACIST"]}>
            <FeatureGate feature="CENTRALIZED_INVENTORY" title="Centralized Inventory isn't enabled">
              <CentralizedInventory />
            </FeatureGate>
          </ProtectedRoute>
        }
      />

      {/* ── Clinician Gamification (Features 14-20) ──────────────────────── */}
      <Route
        path="/xp-dashboard"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="CLINICIAN_XP" title="Clinician XP isn't enabled">
              <XPDashboard />
            </FeatureGate>
          </ProtectedRoute>
        }
      />

      <Route
        path="/seasonal-challenges"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="SEASONAL_CHALLENGES" title="Seasonal Challenges isn't enabled">
              <SeasonalChallenges />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievement-showcase"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="ACHIEVEMENT_SHOWCASE" title="Achievement Showcase isn't enabled">
              <AchievementShowcase />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievement-showcase/:userId"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="ACHIEVEMENT_SHOWCASE" title="Achievement Showcase isn't enabled">
              <AchievementShowcase />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reward-store"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT"]}>
            <FeatureGate feature="REWARD_STORE" title="Reward Store isn't enabled">
              <RewardStore />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mentor-hub"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="MENTOR_SESSIONS" title="Mentor Sessions isn't enabled">
              <MentorHub />
            </FeatureGate>
          </ProtectedRoute>
        }
      />

      {/* ── Patient Gamification (Features 21-27) ────────────────────────── */}
      <Route
        path="/health-quests"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="HEALTH_QUESTS" title="Health Quests isn't enabled">
              <HealthQuests />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/health-avatar"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="HEALTH_AVATAR" title="Health Avatar isn't enabled">
              <HealthAvatar />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family-leaderboard"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="FAMILY_LEADERBOARD" title="Family Leaderboard isn't enabled">
              <FamilyLeaderboard />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/referral-rewards"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="REFERRAL_TIERS" title="Referral Rewards isn't enabled">
              <ReferralRewards />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/social-proof"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="SOCIAL_PROOF" title="Social Proof isn't enabled">
              <SocialProofDashboard />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/health-content"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="UNLOCKABLE_CONTENT" title="Health Content Library isn't enabled">
              <HealthContentLibrary />
            </FeatureGate>
          </ProtectedRoute>
        }
      />

      {/* ── Communication & Portal (Features 33, 35, 37, 39) ────────────── */}
      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT", "PHARMACIST"]}>
            <FeatureGate feature="ANNOUNCEMENTS" title="Announcements isn't enabled">
              <Announcements />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/message-templates"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR"]}>
            <FeatureGate feature="MESSAGING_TEMPLATES" title="Message templates aren't enabled">
              <MessageTemplatesPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reminder-settings"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <FeatureGate feature="MESSAGING_TEMPLATES" title="Message templates aren't enabled">
              <ReminderSettingsPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/critical-journey"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <FeatureGate feature="CRITICAL_JOURNEY_DASHBOARD" title="Critical Journey isn't enabled">
              <CriticalJourneyPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/home-therapy"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN"]}>
            <HomeTherapyRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/home-therapy/live-map"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN"]}>
            <HomeTherapyLiveMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/handoff-notes"
        element={
          <ProtectedRoute allowedRoles={["DOCTOR", "THERAPIST", "ADMIN_DOCTOR"]}>
            <FeatureGate feature="HANDOFF_NOTES" title="Handoff Notes isn't enabled">
              <HandoffNotes />
            </FeatureGate>
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
            <FeatureGate feature="VISIT_SUMMARY" title="Visit Summary isn't enabled">
              <VisitSummaryPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />

      {/* ── IWIS Competitor Features (0-6) ────────────────────────────────── */}
      <Route
        path="/therapy-rooms"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="THERAPY_ROOM_MANAGEMENT" title="Therapy Room Management isn't enabled">
              <TherapyRoomsPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/diet-prescriptions"
        element={
          <ProtectedRoute allowedRoles={["ADMIN_DOCTOR", "DOCTOR"]}>
            <FeatureGate feature="DIET_PRESCRIPTION" title="Diet Prescriptions isn't enabled">
              <DietPrescriptionsPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      {/* Ayurvedic Food Database + Recipe Library (Feature 1) */}
      <Route
        path="/food-database"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR"]}>
            <FoodDatabase />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recipe-library"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <RecipeLibrary />
          </ProtectedRoute>
        }
      />
      {/* Workflow Automation Rules Engine (Feature 3) — branch-admin only. */}
      <Route
        path="/admin/workflow-automation"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <WorkflowAutomation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/diet-packages"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST"]}>
            <FeatureGate feature="DIET_PRESCRIPTION" title="Diet Prescriptions isn't enabled">
              <DietPackagesPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-diet"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="DIET_PRESCRIPTION" title="Diet tracking isn't enabled">
              <PatientDietPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clinical-photos"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT"]}>
            <FeatureGate feature="CLINICAL_PHOTOS" title="Clinical Photos isn't enabled">
              <ClinicalPhotosPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/self-exam"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <FeatureGate feature="SELF_EXAM_PROTOCOL" title="Self-Examination isn't enabled">
              <SelfExaminationKit />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contact-clinics"
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <ContactClinics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/self-exam-review"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR"]}>
            <FeatureGate feature="SELF_EXAM_PROTOCOL" title="Self-Examination isn't enabled">
              <SelfExamReview />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/self-exam-protocols"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR"]}>
            <FeatureGate feature="SELF_EXAM_PROTOCOL" title="Self-Examination isn't enabled">
              <SelfExamProtocols />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/treatment-packages"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR"]}>
            <FeatureGate feature="TREATMENT_PACKAGES" title="Treatment Packages isn't enabled">
              <TreatmentPackagesPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/group-sessions"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT"]}>
            <FeatureGate feature="GROUP_SESSIONS" title="Group Therapy Sessions isn't enabled">
              <GroupSessionsPage />
            </FeatureGate>
          </ProtectedRoute>
        }
      />

      <Route path="/verify-email"     element={<VerifyEmail />} />
      <Route path="/forgot-password"  element={<ForgotPassword />} />
      <Route path="/reset-password"   element={<ResetPassword />} />
      <Route path="/mfa"              element={<MfaChallenge />} />

      {/* Super Admin — platform-level; role-gated by ProtectedRoute */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
            <SuperAdminShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="hospitals" element={<SuperAdminHospitalList />} />
        <Route path="hospitals/new" element={<SuperAdminHospitalCreate />} />
        <Route path="hospitals/:id" element={<SuperAdminHospitalDetail />} />
        <Route path="feature-registry" element={<SuperAdminFeatureRegistry />} />
        <Route path="triage" element={<SuperAdminTriageOversight />} />
        <Route path="triage/routes" element={<SuperAdminSpecialtyRoutes />} />
        <Route path="audit" element={<SuperAdminAudit />} />
      </Route>

      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN", "DOCTOR", "THERAPIST", "PATIENT", "PHARMACIST"]}>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

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
            <NotifyProvider>
              <TooltipProvider>
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <AppRoutes />
                  </Suspense>
                </ErrorBoundary>
              </TooltipProvider>
            </NotifyProvider>
          </NotificationProvider>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;

