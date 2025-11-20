"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Users, DollarSign, Calendar, MapPin, Radio } from "lucide-react";
import { CreateContestForm } from "@/components/admin/CreateContestForm";
import { UserManagement } from "@/components/admin/UserManagement";
import { ContestManagement } from "@/components/admin/ContestManagement";
import { TrackManagement } from "@/components/admin/TrackManagement";
import { SimulationPanel } from "@/components/admin/SimulationPanel";

export default function AdminPage() {
  const { profile } = useAuth();
  
  // Session refresh is handled by auth interceptor automatically
  // No need for explicit session management here

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-[var(--surface-1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-8 h-8 text-[var(--brand)]" />
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                Admin Dashboard
              </h1>
            </div>
            <p className="text-[var(--text-tertiary)]">
              Manage contests, users, and platform settings
            </p>
          </div>

          <Tabs defaultValue="contests" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="contests">
                <Calendar className="w-4 h-4 mr-2" />
                Contests
              </TabsTrigger>
              <TabsTrigger value="tracks">
                <MapPin className="w-4 h-4 mr-2" />
                Tracks
              </TabsTrigger>
              <TabsTrigger value="simulation">
                <Radio className="w-4 h-4 mr-2" />
                Simulation
              </TabsTrigger>
              <TabsTrigger value="users">
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contests" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                      Create New Contest
                    </h2>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Add a new contest for players to join. Track and date are required to fetch data from MongoDB.
                    </p>
                  </div>
                  <Plus className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
                <CreateContestForm />
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                      Manage Contests
                    </h2>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      View, hide, or delete existing contests
                    </p>
                  </div>
                  <Calendar className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
                <ContestManagement />
              </Card>
            </TabsContent>

            <TabsContent value="tracks" className="space-y-6">
              <Card className="p-6">
                <TrackManagement />
              </Card>
            </TabsContent>

            <TabsContent value="simulation" className="space-y-6">
              <SimulationPanel />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                      User Management
                    </h2>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Manage user accounts and bankrolls
                    </p>
                  </div>
                  <Users className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
                <UserManagement />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
}

