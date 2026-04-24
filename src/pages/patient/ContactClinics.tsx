import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, Mail, MapPin, Clock, Building2, CalendarPlus, AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  operatingHoursFrom: string | null;
  operatingHoursTo: string | null;
}

function formatHours(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  if (from && to) return `${from} – ${to}`;
  return from ?? to;
}

export default function ContactClinics() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<Branch[]>("/api/branches")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setBranches(list.filter((b) => b.isActive !== false));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load clinics";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto px-4 py-6 md:py-8">
        <PageHeader
          title="Contact our clinics"
          subtitle="Call the reception or book your appointment directly with any of our branches."
        />

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}><CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent></Card>
            ))}
          </div>
        )}

        {!loading && error && (
          <Card className="mt-6">
            <CardContent className="flex items-center gap-3 py-6 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && branches.length === 0 && (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No clinics listed yet</p>
              <p className="text-sm">Please check back later.</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && branches.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {branches.map((b) => {
              const hours = formatHours(b.operatingHoursFrom, b.operatingHoursTo);
              return (
                <Card key={b.id} className="flex flex-col">
                  <CardContent className="p-6 flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary shrink-0" />
                        <h3 className="font-semibold text-base leading-tight">{b.name}</h3>
                      </div>
                      {hours && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="w-3 h-3" /> {hours}
                        </Badge>
                      )}
                    </div>

                    <dl className="space-y-2.5 text-sm">
                      {b.address && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{b.address}</span>
                        </div>
                      )}
                      {b.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                          <a
                            href={`tel:${b.phone}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {b.phone}
                          </a>
                        </div>
                      )}
                      {b.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                          <a
                            href={`mailto:${b.email}`}
                            className="font-medium text-foreground hover:text-primary transition-colors truncate"
                          >
                            {b.email}
                          </a>
                        </div>
                      )}
                      {!b.phone && !b.email && (
                        <p className="text-xs text-muted-foreground italic">
                          No direct contact info listed. Use the Book Appointment button or visit the clinic.
                        </p>
                      )}
                    </dl>
                  </CardContent>

                  <div className="border-t p-3 flex gap-2 bg-muted/20">
                    {b.phone && (
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <a href={`tel:${b.phone}`}>
                          <Phone className="w-3.5 h-3.5 mr-1.5" /> Call
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/appointments?branchId=${b.id}`)}
                    >
                      <CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> Book
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
