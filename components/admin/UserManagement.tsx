"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface User {
  id: string;
  email: string;
  bankroll: number;
  isAdmin: boolean;
  createdAt: string;
}

export function UserManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Add timeout to prevent infinite hangs (30 seconds for Supabase free tier)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
      });

      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const result = await Promise.race([
        queryPromise,
        timeoutPromise,
      ]) as { data: any[] | null; error: any };
      
      const { data, error } = result;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Map Supabase data (snake_case) to User interface (camelCase)
      const mappedUsers: User[] = (data || []).map((profile: any) => ({
        id: profile.id,
        email: profile.email || '',
        bankroll: profile.bankroll || 0,
        isAdmin: profile.is_admin === true, // Explicit boolean check
        createdAt: profile.created_at || new Date().toISOString(),
      }));

      setUsers(mappedUsers);
      console.log(`✅ Loaded ${mappedUsers.length} users`);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err instanceof Error ? err.message : "Failed to load users. Check RLS policies.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdjustBankroll = async () => {
    if (!selectedUser || !adjustmentAmount) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const amount = parseFloat(adjustmentAmount);
      if (isNaN(amount)) {
        throw new Error('Invalid adjustment amount');
      }

      const newBankroll = selectedUser.bankroll + amount;
      
      // Ensure bankroll doesn't go negative (optional - you can remove this if you want to allow negatives)
      if (newBankroll < 0) {
        throw new Error('Bankroll cannot be negative');
      }

      console.log(`Updating bankroll for ${selectedUser.email}: ${selectedUser.bankroll} + ${amount} = ${newBankroll}`);

      // Update bankroll in Supabase using snake_case field name
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ bankroll: newBankroll })
        .eq('id', selectedUser.id)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(updateError.message || 'Failed to update bankroll. Check RLS policies.');
      }

      if (!data) {
        throw new Error('No data returned from update');
      }

      console.log('✅ Bankroll updated successfully:', data);

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id 
          ? { ...u, bankroll: newBankroll }
          : u
      ));

      setSuccess(true);
      setSelectedUser(null);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      
      // Reload to ensure consistency
      await loadUsers();
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error adjusting bankroll:', err);
      setError(err instanceof Error ? err.message : "Failed to adjust bankroll");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertDescription className="text-green-600 dark:text-green-400">
            Bankroll adjusted successfully!
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search users by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={loadUsers} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[var(--text-tertiary)]">Loading users...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Bankroll</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[var(--text-tertiary)]">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {user.bankroll.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-400 text-xs">
                          User
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--text-tertiary)]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        Adjust Bankroll
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedUser && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Adjust Bankroll: {selectedUser.email}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Current Bankroll: ${selectedUser.bankroll.toFixed(2)}
              </label>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Adjustment Amount ($)
              </label>
              <Input
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="Positive to add, negative to subtract"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Reason (optional)
              </label>
              <Input
                type="text"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Reason for adjustment"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAdjustBankroll}
                disabled={isSubmitting || !adjustmentAmount}
              >
                {isSubmitting ? "Processing..." : "Apply Adjustment"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUser(null);
                  setAdjustmentAmount("");
                  setAdjustmentReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

