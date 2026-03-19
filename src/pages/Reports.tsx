import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, FileText, BarChart3, TrendingUp, Users, CalendarCheck, Building2 } from 'lucide-react';
import { Navigation } from '@/components/layout/navigation';
import { MonthlyCompletedAppointments } from '@/components/MonthlyCompletedAppointments';
import { PatientProgressChart } from '@/components/PatientProgressChart';
import { DoctorPerformanceChart } from '@/components/DoctorPerformanceChart';
import { BranchAnalyticsChart } from '@/components/BranchAnalyticsChart';
import { PrescriptionAnalyticsChart } from '@/components/PrescriptionAnalyticsChart';
import { useAuth } from '@/hooks/useAuth';

export default function Reports() {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN' || role === 'ADMIN_DOCTOR';
  const [loading, setLoading] = useState(false);

  const handleExport = async (type: string, format: 'csv' | 'pdf') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(
        `${apiBase}/api/reports/${type}/export/${format}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_report.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch {
      // silent — toast not needed for download failures
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navigation />
      <div className="pt-20 px-6 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Reports & Analytics</h1>
              <p className="text-muted-foreground mt-1">
                View detailed analytics and export reports
              </p>
            </div>
          </div>

          <Tabs defaultValue="appointments" className="space-y-6">
            <div className="overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
              <TabsList className={`flex w-max md:grid md:w-full md:grid-cols-${isAdmin ? '5' : '4'} gap-1 bg-transparent md:bg-muted p-0 md:p-1`}>
                <TabsTrigger value="appointments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border md:border-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap">
                  <BarChart3 className="h-3.5 w-3.5 mr-2" />
                  Appointments
                </TabsTrigger>
                <TabsTrigger value="patients" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border md:border-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 mr-2" />
                  Patient Progress
                </TabsTrigger>
                <TabsTrigger value="doctors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border md:border-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap">
                  <TrendingUp className="h-3.5 w-3.5 mr-2" />
                  Doctor Performance
                </TabsTrigger>
                <TabsTrigger value="prescriptions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border md:border-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap">
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Prescriptions
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="branches" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border md:border-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap">
                    <Building2 className="h-3.5 w-3.5 mr-2" />
                    Branches
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="appointments" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                      <CalendarCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Monthly Completed Appointments</h2>
                      <p className="text-sm text-muted-foreground">Detailed breakdown of all completed sessions this month</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleExport('appointments', 'csv')}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>

                <MonthlyCompletedAppointments />
              </Card>
            </TabsContent>

            <TabsContent value="patients" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Patient Progress Reports</h2>
                      <p className="text-sm text-muted-foreground">Session completion rates across all active journeys</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleExport('patient-progress', 'csv')}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
                <PatientProgressChart />
              </Card>
            </TabsContent>

            <TabsContent value="doctors" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Doctor Performance Analytics</h2>
                      <p className="text-sm text-muted-foreground">Appointment completion rates and prescription volumes</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleExport('doctor-performance', 'pdf')}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
                <DoctorPerformanceChart />
              </Card>
            </TabsContent>

            <TabsContent value="prescriptions" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Prescription Analytics</h2>
                    <p className="text-sm text-muted-foreground">Top medications and prescribing patterns</p>
                  </div>
                </div>
                <PrescriptionAnalyticsChart />
              </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="branches" className="space-y-4">
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Branch-Level Analytics</h2>
                      <p className="text-sm text-muted-foreground">Compare performance across all active branches</p>
                    </div>
                  </div>
                  <BranchAnalyticsChart />
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </>
  );
}
